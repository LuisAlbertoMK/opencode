// vMK: Virtual list component — only renders items in the visible viewport + buffer
// to reduce SolidJS/Yoga overhead for long message lists.
//
// Design rationale:
// - opentui ScrollBox has viewportCulling but it only skips terminal RENDER, not
//   SolidJS component tree creation or Yoga layout. For 200+ messages, all 200+
//   components are still created and laid out.
// - VirtualList renders ONLY the visible window + overscan buffer, dramatically
//   reducing SolidJS/Yoga work.
// - Height estimation is used since opentui doesn't expose reactive layout events.
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

const POLL_MS = 100         // Check scroll position every 100ms
const ESTIMATED_HEIGHT = 3  // Default height per item (lines)
const OVERSCAN = 3          // Extra items above/below viewport

export interface VirtualListProps<T> {
  /** Reactive list of items to render */
  items: () => readonly T[]
  /** Render function for each item — receives (item, indexInFullList) */
  children: (item: T, index: number) => JSX.Element
  /** Accessor that returns the parent ScrollBox ref */
  scrollRef: () => ScrollBoxRenderable | null
  /** Estimated height per item in terminal lines (default: 3) */
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

  // Poll scroll position from the scrollbox ref (no scroll events in opentui)
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
        const st = r.scrollTop
        const vh = r.height
        // Avoid redundant updates
        setScrollTop((prev) => (Math.abs(prev - st) > 0.5 ? st : prev))
        setViewportHeight((prev) => (prev !== vh ? vh : prev))
      } catch {
        // scrollbox may be in inconsistent state during destruction
      }
    }, POLL_MS)

    onCleanup(() => clearInterval(id))
  })

  // Compute visible range using estimated heights
  const visible = createMemo(() => {
    const items = props.items()
    const count = items.length
    if (count === 0) return { items: [] as T[], offset: 0, paddingTop: 0, paddingBottom: 0 }

    const st = Math.max(scrollTop(), 0)
    const vh = Math.max(viewportHeight(), 1)
    const est = props.estimatedHeight ?? ESTIMATED_HEIGHT
    const over = props.overscan ?? OVERSCAN

    // Find first visible item via linear scan over estimates
    let accum = 0
    let start = 0
    for (let i = 0; i < count; i++) {
      if (accum >= st) {
        start = i
        break
      }
      accum += est
      start = i + 1
    }

    // Find last visible item
    accum = start * est
    let end = count
    for (let i = start; i < count; i++) {
      if (accum >= st + vh) {
        end = i
        break
      }
      accum += est
    }

    // Apply overscan
    const paddedStart = Math.max(0, start - over)
    const paddedEnd = Math.min(count, end + over)

    return {
      items: items.slice(paddedStart, paddedEnd),
      offset: paddedStart,
      paddingTop: paddedStart * est,
      paddingBottom: (count - paddedEnd) * est,
    }
  })

  return (
    <>
      {/* Top spacer — pushes visible items to correct scroll position */}
      <box height={visible().paddingTop} />
      {/* Only render items in the visible window */}
      <For each={visible().items}>
        {(item, i) => props.children(item, visible().offset + i())}
      </For>
      {/* Bottom spacer */}
      <box height={visible().paddingBottom} />
    </>
  )
}
