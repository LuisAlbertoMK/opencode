# Effect v4 Patterns — opencode

> Guía de patrones Effect v4 usados en opencode. Basado en código real del repo.

---

## 1. Service Layer Pattern

Cada servicio sigue la convención: `Interface` + `Service extends Context.Service` + `layer` + `defaultLayer`.

```typescript
// src/foo/foo.ts
import { Context, Effect, Layer } from "effect"

export interface Interface {
  readonly doSomething: (input: string) => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Foo") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const dep = yield* OtherService
    // ... implementation
    return Service.of({ doSomething: ... })
  })
)

export const defaultLayer = layer.pipe(
  Layer.provide(OtherService.defaultLayer),
  Layer.provide(FSUtil.defaultLayer)
)

// Self-reexport for namespace imports
export * as Foo from "./foo"
```

**Consumo**:
```typescript
import { Foo } from "@/foo/foo"

yield* Foo.Service
Foo.layer
Foo.defaultLayer
```

---

## 2. Effect.gen + Effect.fn

**Composición principal**: `Effect.gen(function* () { ... })`

**Funciones nombradas/trazadas**: `Effect.fn("Domain.method")(function* () { ... })`

**Helpers internos**: `Effect.fnUntraced(function* () { ... })`

```typescript
const loadConfig = Effect.fnUntraced(function* (
  text: string,
  options: { path: string } | { dir: string; source: string },
  env?: Record<string, string>
) {
  // ...
})

// Uso con pipe operators
const result = yield* loadConfig(text, { path }).pipe(
  Effect.catch((e) => Effect.logError("failed", { error: e }))
)
```

---

## 3. Dependency Injection via Layer.provide

```typescript
export const defaultLayer = layer.pipe(
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Auth.defaultLayer),
  Layer.provide(Account.defaultLayer),
  Layer.provide(Env.defaultLayer),
  Layer.provide(Npm.defaultLayer),
  Layer.provide(HttpClient.layer),
  Layer.provide(EffectFlock.defaultLayer)
)
```

**Node-specific layers** (para binario compilado):
```typescript
export const node = LayerNode.make(layer, [
  FSUtil.node,
  Auth.node,
  Account.node,
  Env.node,
  Npm.node,
  httpClient
])
```

---

## 4. Schema-First (Effect Schema)

**Class-based schemas** para tipos multi-campo:
```typescript
export class Info extends Schema.Class<Info>("ConfigV2.ToolOutput")({
  max_lines: PositiveInt.pipe(Schema.optional),
  max_bytes: PositiveInt.pipe(Schema.optional),
}) {}
```

**Branded schemas** para single-value types:
```typescript
export const PositiveInt = Schema.Int.pipe(
  Schema.int(),
  Schema.filter((n): n is number & { readonly __brand: "PositiveInt" } => n > 0)
)
```

**Tagged errors**:
```typescript
export class RemoteAuthError extends Schema.TaggedError<RemoteAuthError>()("Config.RemoteAuthError", {
  url: Schema.String,
  remote: Schema.String,
}) {}
```

**Decode con error handling**:
```typescript
return yield* Schema.decodeEffect(Schema.fromJsonString(schema))(body).pipe(
  Effect.catch((error) => Effect.die(new Error(`failed to decode: ${String(error)}`)))
)
```

---

## 5. Error Handling Patterns

**Early return con yield***:
```typescript
// Good - direct yield* for early failure
yield* new MyError({ message: "failed" })

// Avoid - Effect.fail wrapper
yield* Effect.fail(new MyError({ message: "failed" }))
```

**Catch con Defect para errores no recuperables**:
```typescript
Effect.die(new Error("unexpected: " + String(error)))
```

**Void effect**:
```typescript
Effect.void  // en lugar de Effect.succeed(undefined)
```

---

## 6. ScopedCache + InstanceState (Per-Directory State)

```typescript
// instance-state.ts
export const make = <A, E = never, R = never>(
  init: (ctx: InstanceContext) => Effect.Effect<A, E, R | Scope.Scope>
): Effect.Effect<InstanceState<A, E, Exclude<R, Scope.Scope>>, never, R | Scope.Scope> =>
  Effect.gen(function* () {
    const cache = yield* ScopedCache.make<string, A, E, R>({
      capacity: Number.POSITIVE_INFINITY,
      lookup: () => Effect.gen(function* () {
        return yield* init(yield* context)
      }),
    })

    const off = registerDisposer((directory) => Effect.runPromise(ScopedCache.invalidate(cache, directory)))
    yield* Effect.addFinalizer(() => Effect.sync(off))

    return { [TypeId]: TypeId, cache }
  })
```

**Usage en servicio**:
```typescript
const state = yield* InstanceState.make<State>(Effect.fn("Config.state")(function* (ctx) {
  return yield* loadInstanceState(ctx).pipe(Effect.orDie)
}))

const get = Effect.fn("Config.get")(function* () {
  return yield* InstanceState.use(state, (s) => s.config)
})
```

---

## 7. Effect.cached / cachedInvalidateWithTTL

**Deduplication** para cargas concurrentes:
```typescript
const [cachedGlobal, invalidateGlobal] = yield* Effect.cachedInvalidateWithTTL(
  loadGlobal().pipe(
    Effect.tapError((error) => Effect.logError("failed to load global config", { error: String(error) })),
    Effect.orElseSucceed((): Info => ({}))
  ),
  Duration.infinity
)

const getGlobal = Effect.fn("Config.getGlobal")(function* () {
  return yield* cachedGlobal
})
```

---

## 8. Forking & Concurrency

**forkIn** (Effect v4 - no fork/forkDaemon):
```typescript
const dep = yield* npmSvc
  .install(dir, { add: [{ name: "@opencode-ai/plugin", version }] })
  .pipe(
    Effect.exit,
    Effect.tap((exit) => Exit.isFailure(exit) ? Effect.logWarning(...) : Effect.void),
    Effect.asVoid,
    Effect.forkDetach  // or Effect.forkIn(scope)
  )
deps.push(dep)
```

**Effect.all con concurrencia**:
```typescript
const loaded = yield* Effect.all(
  ["config.json", "opencode.json", "opencode.jsonc"].map((f) =>
    loadFile(path.join(Global.Path.config, f), env)
  ),
  { concurrency: "unbounded" }  // o número: 10
)
```

**Effect.forEach concurrencia**:
```typescript
yield* Effect.forEach(items, (item) => process(item), { concurrency: 10 })
```

---

## 9. Resource Management

**addFinalizer** para cleanup:
```typescript
yield* Effect.addFinalizer(() => Effect.sync(() => {
  subscription.unsubscribe()
}))
```

**acquireRelease** para recursos complejos:
```typescript
yield* Effect.acquireRelease(
  Effect.sync(() => createConnection()),
  (conn) => Effect.sync(() => conn.close())
)
```

---

## 10. HTTP Client (Effect HttpClient)

```typescript
const http = yield* HttpClient.HttpClient

const response = yield* HttpClient.filterStatusOk(withTransientReadRetry(http))
  .execute(
    HttpClientRequest.get(url).pipe(
      HttpClientRequest.acceptJson,
      HttpClientRequest.setHeaders(headers ?? {})
    )
  )

const body = yield* response.text
```

---

## 11. Logging

```typescript
yield* Effect.logInfo("loading", { path: filepath })
yield* Effect.logDebug("fetching remote config", { url })
yield* Effect.logWarning("failed to write $schema", { path, error: String(e) })
yield* Effect.logError("failed to load global config", { error: String(error) })
```

---

## 12. Time & Dates

```typescript
import { DateTime, Duration } from "effect"

const now = yield* DateTime.nowAsDate  // Date object
const timeout = Duration.millis(5000)
```

---

## 13. Common Anti-Patterns to Avoid

| ❌ Avoid | ✅ Prefer |
|----------|-----------|
| `Effect.succeed(undefined)` | `Effect.void` |
| `yield* Effect.fail(new Err())` | `yield* new Err()` |
| `try/catch` en Effect code | `Effect.catch` / `Effect.catchAll` |
| `import * as Foo` | `import { Foo } from "@/foo/foo"` |
| `export namespace Foo` | `export * as Foo from "./foo"` |
| `fork` / `forkDaemon` | `forkIn(scope)` / `forkScoped` |

---

## 14. Module Import Conventions

```typescript
// Good - explicit imports
import { Context, Effect, Layer, Schema } from "effect"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Auth } from "@/auth"

// Avoid
import * as Effect from "effect"
import { Foo as Bar } from "..."  // no aliases
```

---

## Referencias Rápidas

| Archivo | Patrón |
|---------|--------|
| `packages/opencode/src/config/config.ts` | Layer + Effect.gen + cachedInvalidateWithTTL + InstanceState |
| `packages/opencode/src/effect/instance-state.ts` | ScopedCache pattern |
| `packages/opencode/src/auth/auth.ts` | Service + Schema.TaggedError |
| `packages/core/src/config.ts` | LayerNode.make + Schema.Class |
| `packages/opencode/src/llm/native-runtime.ts` | Effect.all concurrency + Stream |

---

*Actualizado: 2026-07-02 | Basado en opencode vMK codebase*