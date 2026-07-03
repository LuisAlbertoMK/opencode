# InstanceState / ScopedCache Lifecycle — opencode

> Documenta el patrón `InstanceState` + `ScopedCache` para estado por-directorio/proyecto en opencode vMK.

---

## ¿Por Qué InstanceState?

opencode soporta **múltiples proyectos abiertos simultáneamente** (multi-workspace, multi-repo). Cada proyecto necesita su propio estado aislado:

- Configuración cargada (merge de global + project + `.opencode`)
- LSP clients cache
- Session state
- Plugin instances
- Background fibers (file watchers, npm installs, etc.)

**`makeRuntime`** (singleton global) **NO sirve** — compartiría estado entre proyectos.
**`InstanceState` + `ScopedCache`** = estado por `directory` con cleanup automático.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    ScopedCache<string, A, E, R>             │
│  Key: directory path (string)                               │
│  Value: A (estado tipado del servicio)                      │
│  Scope: Effect.Scope (limpia al cerrar proyecto)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  InstanceState<A, E, R>                                     │
│  - cache: ScopedCache                                       │
│  - get()     → Effect.Effect<A>                             │
│  - use(f)    → Effect.Effect<B>  (map sobre get)            │
│  - useEffect → Effect.Effect<B>  (flatMap sobre get)        │
│  - invalidate()                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## API Principal

### `InstanceState.make<A, E, R>(init)`

Crea el estado. `init` recibe `InstanceContext` (directory + worktree) y retorna `Effect<A>`.

```typescript
const state = yield* InstanceState.make<State>(Effect.fn("Config.state")(function* (ctx) {
  return yield* loadInstanceState(ctx).pipe(Effect.orDie)
}))
```

- `init` se ejecuta **una vez por directorio** (lazy, on first `get`)
- `ScopedCache` memoiza el resultado
- Retorna `{ cache, [TypeId] }`

### `InstanceState.get<A, E, R>(state)`

Obtiene el estado para el directorio actual.

```typescript
const config = yield* InstanceState.get(state)
```

### `InstanceState.use<A, E, R, B>(state, select)`

Proyección simple (map).

```typescript
const username = yield* InstanceState.use(state, (s) => s.config.username)
```

### `InstanceState.useEffect<A, E, R, B, E2, R2>(state, select)`

Proyección con efecto (flatMap).

```typescript
const result = yield* InstanceState.useEffect(state, (s) => s.deps[0].pipe(Effect.flatMap(Fiber.join)))
```

### `InstanceState.invalidate<A, E, R>(state)`

Invalida cache para directorio actual (fuerza recarga).

```typescript
yield* InstanceState.invalidate(state)
```

---

## Lifecycle Completo

```
1. Servicio inicia
   │
   ├─ InstanceState.make(init)
   │     │
   │     ├─ ScopedCache.make({ lookup: init })
   │     │     └─ capacity: Infinity (no eviction por LRU)
   │     │
   │     ├─ registerDisposer(dir => ScopedCache.invalidate(cache, dir))
   │     │     └─ Se llama cuando proyecto se cierra (WorkspaceContext)
   │     │
   │     └─ Effect.addFinalizer(() => off())  // Cleanup al cerrar scope del servicio
   │
2. Primer uso (get/use/useEffect)
   │
   ├─ ScopedCache.get(directory)
   │     │
   │     ├─ ¿Existe en cache? → Return memoized
   │     │
   │     └─ No existe → Ejecuta lookup (init) → Memoiza → Return
   │
3. Uso subsiguiente
   │
   └─ Return memoized (O(1))
  
4. Proyecto cierra / WorkspaceContext dispose
   │
   ├─ registerDisposer callback → ScopedCache.invalidate(cache, dir)
   │     └─ Elimina entrada + corre finalizers del init
   │
   └─ Scope del servicio se cierra → addFinalizer → off()
```

---

## Ejemplo Real: Config Service

```typescript
// packages/opencode/src/config/config.ts

export const layer = Layer.effect(Service, Effect.gen(function* () {
  // ... dependencies
  
  const state = yield* InstanceState.make<State>(
    Effect.fn("Config.state")(function* (ctx) {
      return yield* loadInstanceState(ctx).pipe(Effect.orDie)
    }),
    Effect.provideService(FSUtil.Service, fs)
  )

  const get = Effect.fn("Config.get")(function* () {
    return yield* InstanceState.use(state, (s) => s.config)
  })

  const directories = Effect.fn("Config.directories")(function* () {
    return yield* InstanceState.use(state, (s) => s.directories)
  })

  const waitForDependencies = Effect.fn("Config.waitForDependencies")(function* () {
    yield* InstanceState.useEffect(state, (s) =>
      Effect.forEach(s.deps, Fiber.join, { concurrency: "unbounded" }).pipe(Effect.asVoid)
    )
  })

  // ...
}))
```

**Flujo**:
1. `Config.get()` → `InstanceState.use(state, select config)`
2. Primera vez en dir X → `loadInstanceState(ctx)` ejecuta:
   - Load global config (parallel)
   - Load wellknown remote configs (parallel HTTP)
   - Load project configs (parallel I/O)
   - Merge en orden de precedencia
   - Fork background npm installs (`deps`)
3. Resultado memoizado en `ScopedCache` keyed by `directory`
4. Llamadas posteriores → O(1) lookup

---

## Background Fibers en InstanceState

Los fibers spawnados en `init` deben ser **scoped al directorio**:

```typescript
const state = yield* InstanceState.make<State>(Effect.gen(function* (ctx) {
  const deps: Fiber.Fiber<void>[] = []
  
  for (const dir of directories) {
    const dep = yield* npmSvc
      .install(dir, { add: [{ name: "@opencode-ai/plugin", version }] })
      .pipe(
        Effect.exit,
        Effect.tap((exit) => 
          Exit.isFailure(exit) 
            ? Effect.logWarning("install failed", { dir, error: String(exit.cause) })
            : Effect.void
        ),
        Effect.asVoid,
        Effect.forkDetach  // o Effect.forkIn(scope)
      )
    deps.push(dep)
  }
  
  return { config: result, directories, deps }
}))
```

**Cleanup automático**: Al cerrar proyecto, `ScopedCache.invalidate` elimina la entrada y el scope de `init` se cierra → todos los fibers `forkIn(scope)` se interrumpen.

---

## Diferencia: makeRuntime vs InstanceState

| Aspecto | `makeRuntime` | `InstanceState` |
|---------|---------------|-----------------|
| **Scope** | Global (singleton) | Por directorio |
| **Cache** | `memoMap` manual | `ScopedCache` auto |
| **Cleanup** | Manual / never | Auto via Scope + disposer |
| **Uso** | Servicios verdaderamente globales (Logger, Clock) | Servicios por proyecto (Config, LSP, Session) |
| **Multi-project** | ❌ Comparte estado | ✅ Aislado |

**Regla**: Si dos directorios abiertos **no deben compartir** una copia del servicio → `InstanceState`.

---

## Testing InstanceState

```typescript
import { InstanceState } from "@/effect/instance-state"
import { Effect, Layer, Scope } from "effect"

const TestLayer = Layer.effect(
  MyService,
  Effect.gen(function* () {
    const state = yield* InstanceState.make<State>(init)
    return Service.of({ get: () => InstanceState.use(state, ...) })
  })
)

// Test: aislamiento por directorio
Effect.gen(function* () {
  // Directorio A
  yield* InstanceRef.set({ directory: "/project-a", worktree: "/project-a" })
  const configA = yield* MyService.get()
  
  // Directorio B  
  yield* InstanceRef.set({ directory: "/project-b", worktree: "/project-b" })
  const configB = yield* MyService.get()
  
  // Deben ser independientes
  assert(configA !== configB)
}).pipe(Effect.provide(TestLayer), Effect.scoped, Effect.runPromise)
```

---

## Debugging Tips

### Ver estado actual del cache
```typescript
// En REPL o test
const cache = yield* MyService.state.cache
const keys = yield* ScopedCache.keys(cache)  // ["dir1", "dir2", ...]
```

### Forzar recarga
```typescript
yield* InstanceState.invalidate(state)
// Next get() re-ejecuta init
```

### Loggear init
```typescript
const state = yield* InstanceState.make<State>(Effect.gen(function* (ctx) {
  yield* Effect.logDebug("InstanceState init", { dir: ctx.directory })
  return yield* loadHeavyStuff(ctx)
}))
```

---

## Referencias en Código

| Archivo | Rol |
|---------|-----|
| `packages/opencode/src/effect/instance-state.ts` | Implementación core |
| `packages/opencode/src/effect/instance-ref.ts` | `InstanceRef` / `WorkspaceRef` context |
| `packages/opencode/src/effect/instance-registry.ts` | `registerDisposer` para cleanup cross-project |
| `packages/opencode/src/config/config.ts` | Uso real: Config service |
| `packages/opencode/src/lsp/client.ts` | Uso real: LSP clients cache |
| `packages/opencode/src/session/session.ts` | Uso real: Session state |

---

## Checklist: ¿Necesito InstanceState?

- [ ] ¿El servicio maneja estado que varía por proyecto/directorio?
- [ ] ¿Dos proyectos abiertos simultáneamente deben tener estado **independiente**?
- [ ] ¿Hay background fibers/tasks que deben morir al cerrar el proyecto?
- [ ] ¿El estado incluye recursos que necesitan cleanup (LSP processes, file watchers, DB connections)?

**Si SÍ a cualquiera → InstanceState**.

---

*Actualizado: 2026-07-02 | Basado en opencode vMK codebase*