// vMK: Virtual list component — only renders items in the visible viewport + buffer
// to reduce SolidJS/Yoga overhead for long message lists.
//
// Design rationale:
// - opentui ScrollBox has viewportCulling but it only skips terminal RENDER, not
//   SolidJS component tree creation or Yoga layout. For 200+ messages, all 200+
//   components are still created and laid out.
// - VirtualList renders ONLY the visible window + overscan buffer, dramatically
//   reducing SolidJS/Yoga work.
// - Real item heights are measured post-Yoga via polling (no reactive layout events);
//   heights are cached and reused for accurate scroll positioning.
// - Scroll position is polled at ~10fps since ScrollBox doesn't expose scroll events.
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  type JSX,
} from "solid-js"
import type { ScrollBoxRenderable } from "@opentui/core"

const POLL_MS = 100          // Check scroll position every 100ms
const ESTIMATED_HEIGHT = 5   // Fallback height per item when not yet measured
const OVERSCAN = 3           // Extra items above/below viewport

export interface VirtualListProps<T> {
  /** Reactive list of items to render */
  items: () => readonly T[]
  /** Render function for each item — receives (item, indexInFullList) */
  children: (item: T, index: number) => JSX.Element
  /** Accessor that returns the parent ScrollBox ref */
  scrollRef: () => ScrollBoxRenderable | null
  /** Estimated height per item in terminal lines (default: 5) */
  estimatedHeight?: number
  /** Overscan buffer in items (default: 3) */
  overscan?: number
}

/**
 * Renders only items within the visible viewport + overscan buffer.
 *
 * Usage:
 * ```tsx
 * <scrollbox ref={el => (scroll = el)}>
 *   <VirtualList items={messages} scrollRef={() => scroll}>
 *     {(msg, i) => <MessageComponent message={msg} />}
 *   </VirtualList>
 * </scrollbox>
 * ```
 */
export function VirtualList<T>(props: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportHeight, setViewportHeight] = createSignal(30)
  // Cache of measured heights: index → lines. Populated via ref polling.
  const [heightCache, setHeightCache] = createSignal<Map<number, number>>(new Map())

  // Tracks rendered box refs keyed by message index.
  // Plain variable (not signal) — only read in the polling interval.
  const itemRefs = new Map<number, { height: number }>()

  // Poll scroll position AND measure actual item heights.
  createEffect(() => {
    const ref = props.scrollRef()
    if (!ref || ref.isDestroyed) return

    const id = setInterval(() => {
      try {
        const r = props.scrollRef()
        if (!r || r.isDestroyed) {
          clearInterval(id)
          return
        }

        // --- scroll tracking ---
        const st = r.scrollTop
        const vh = r.height
        setScrollTop((prev) => (Math.abs(prev - st) > 0.5 ? st : prev))
        setViewportHeight((prev) => (prev !== vh ? vh : prev))

        // --- height measurement ---
        // Read Yoga-computed heights from currently rendered box refs.
        // Heights are unknown until Yoga layout runs (next frame after SolidJS commit).
        // We check every poll cycle — once set, the value stabilizes.
        const changes: Array<[number, number]> = []
        const cache = heightCache()
        for (const [index, el] of itemRefs) {
          if (el.height > 0) {
            const prev = cache.get(index)
            if (prev !== el.height) {
              changes.push([index, el.height])
            }
          }
        }
        if (changes.length > 0) {
          const next = new Map(cache)
          for (const [idx, h] of changes) next.set(idx, h)
          setHeightCache(next)
        }
      } catch {
        // scrollbox may be in inconsistent state during destruction
      }
    }, POLL_MS)

    onCleanup(() => clearInterval(id))
  })

  // Compute visible range using cached heights (fall back to estimate)
  const visible = createMemo(() => {
    const items = props.items()
    const count = items.length
    if (count === 0) return { items: [] as T[], offset: 0, paddingTop: 0, paddingBottom: 0 }

    const st = Math.max(scrollTop(), 0)
    const vh = Math.max(viewportHeight(), 1)
    const est = props.estimatedHeight ?? ESTIMATED_HEIGHT
    const over = props.overscan ?? OVERSCAN
    const hc = heightCache()

    // Helper: get height for an index, with fallback
    const h = (i: number): number => hc.get(i) ?? est

    // Find first visible item: accumulate heights until past scrollTop
    let accum = 0
    let start = 0
    for (let i = 0; i < count; i++) {
      if (accum >= st) {
        start = i
        break
      }
      accum += h(i)
      start = i + 1
    }
    // If we never broke, all items are above viewport — start = count

    // Find last visible item: continue accumulating until past viewport
    let end = count
    for (let i = start; i < count; i++) {
      if (accum >= st + vh) {
        end = i
        break
      }
      accum += h(i)
    }

    // Apply overscan
    const paddedStart = Math.max(0, start - over)
    const paddedEnd = Math.min(count, end + over)

    // Recalculate padding using actual heights
    let paddingTop = 0
    for (let i = 0; i < paddedStart; i++) paddingTop += h(i)

    let paddingBottom = 0
    for (let i = paddedEnd; i < count; i++) paddingBottom += h(i)

    return {
      items: items.slice(paddedStart, paddedEnd),
      offset: paddedStart,
      paddingTop,
      paddingBottom,
    }
  })

  return (
    <>
      {/* Top spacer — pushes visible items to correct scroll position */}
      <box height={visible().paddingTop} />
      {/* Only render items in the visible window */}
      <For each={visible().items}>
        {(item, i) => {
          const index = visible().offset + i()
          return (
            // Inner box for Yoga height measurement. The children function
            // typically returns a box/message component that has its own layout.
            // We wrap in a plain box to capture the total height of the item,
            // including any margins/borders added by the child.
            <box ref={(el) => itemRefs.set(index, el)}>
              {props.children(item, index)}
            </box>
          )
        }}
      </For>
      {/* Bottom spacer */}
      <box height={visible().paddingBottom} />
    </>
  )
}
