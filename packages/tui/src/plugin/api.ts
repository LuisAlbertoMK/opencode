import type { TuiPluginApi, TuiRouteDefinition } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"

type RouteEntry = {
  key: symbol
  render: TuiRouteDefinition["render"]
}

export type RouteMap = Map<string, RouteEntry[]>

export function createPluginRoutes() {
  const routes: RouteMap = new Map()
  const [revision, setRevision] = createSignal(0)

  return {
    register(list: TuiRouteDefinition[]) {
      const key = Symbol()
      for (const item of list) routes.set(item.name, [...(routes.get(item.name) ?? []), { key, render: item.render }])
      setRevision((value) => value + 1)

      return () => {
        for (const item of list) {
          const next = routes.get(item.name)?.filter((entry) => entry.key !== key) ?? []
          if (next.length) {
            routes.set(item.name, next)
            continue
          }
          routes.delete(item.name)
        }
        setRevision((value) => value + 1)
      }
    },
    get(name: string) {
      revision()
      return routes.get(name)?.at(-1)?.render
    },
  }
}

export type PluginRoutes = ReturnType<typeof createPluginRoutes>

// vMK: Plugin lifecycle fix — onDispose ahora registra callbacks realmente,
// signal se aborta en dispose(). State: callbacks + controller encapsulados.
export function createTuiApi(input: Omit<TuiPluginApi, "lifecycle">): TuiPluginApi & { dispose(): void } {
  const controller = new AbortController()
  const disposeCallbacks: (() => void)[] = []

  return {
    ...input,
    lifecycle: {
      signal: controller.signal,
      onDispose(cb: () => void) {
        disposeCallbacks.push(cb)
        return () => {
          const index = disposeCallbacks.indexOf(cb)
          if (index >= 0) disposeCallbacks.splice(index, 1)
        }
      },
    },
    dispose() {
      controller.abort()
      for (const cb of disposeCallbacks) cb()
      disposeCallbacks.length = 0
    },
  }
}
