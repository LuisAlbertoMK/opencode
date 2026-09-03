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
import { buildHeightPrefix, computeVisibleRangePrefixed } from "./virtual-range"

const POLL_ACTIVE_MS = 100   // Check scroll position every 100ms when scrolling
const POLL_IDLE_MS = 500     // Check every 500ms when idle (no scroll changes)
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

    // vMK: Two-tier polling — 100ms when scrolling, 500ms when idle
    let lastScrollTop = ref.scrollTop
    let idleCycles = 0
    let currentInterval = POLL_ACTIVE_MS

    const tick = () => {
      try {
        const r2 = props.scrollRef()
        if (!r2 || r2.isDestroyed) {
          clearInterval(id)
          return
        }

        // --- scroll tracking ---
        const st = r2.scrollTop
        const vh = r2.height
        const changed = Math.abs(lastScrollTop - st) > 0.5 || viewportHeight() !== vh
        setScrollTop((prev) => (Math.abs(prev - st) > 0.5 ? st : prev))
        setViewportHeight((prev) => (prev !== vh ? vh : prev))

        // vMK: adaptive polling — slow down when idle
        if (changed) {
          idleCycles = 0
          if (currentInterval !== POLL_ACTIVE_MS) {
            clearInterval(id)
            currentInterval = POLL_ACTIVE_MS
            id = setInterval(tick, currentInterval)
          }
        } else {
          idleCycles++
          if (idleCycles > 5 && currentInterval !== POLL_IDLE_MS) {
            clearInterval(id)
            currentInterval = POLL_IDLE_MS
            id = setInterval(tick, currentInterval)
          }
        }
        lastScrollTop = st

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
    }

    let id = setInterval(tick, currentInterval)

    onCleanup(() => clearInterval(id))
  })

  // Prefix-sum over item heights — rebuilt ONLY when heights or item count
  // change (not per scroll tick), dropping per-tick cost from O(n) scans to
  // O(log n) binary searches. Ciclo 1, experimento/mejora-autonoma-2026-09-03.
  const prefix = createMemo(() =>
    buildHeightPrefix(heightCache(), props.items().length, props.estimatedHeight ?? ESTIMATED_HEIGHT),
  )

  // Compute visible range using cached heights (fall back to estimate)
  const visible = createMemo(() => {
    const items = props.items()
    if (items.length === 0) return { items: [] as T[], offset: 0, paddingTop: 0, paddingBottom: 0 }

    const range = computeVisibleRangePrefixed(
      prefix(),
      Math.max(scrollTop(), 0),
      Math.max(viewportHeight(), 1),
      props.overscan ?? OVERSCAN,
    )

    return {
      items: items.slice(range.offset, range.offset + range.count),
      offset: range.offset,
      paddingTop: range.paddingTop,
      paddingBottom: range.paddingBottom,
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
