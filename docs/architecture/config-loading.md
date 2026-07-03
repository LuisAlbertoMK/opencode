# Config Loading Pipeline — opencode vMK

> Arquitectura del sistema de carga, merge y resolución de configuración en opencode.
> Basado en el código real de `packages/opencode/src/config/`.

---

## 1. Overview

El sistema de configuración responde a una pregunta fundamental: **¿qué configuración debe usar opencode en este directorio?** Responde cargando desde múltiples fuentes, fusionándolas en orden de precedencia y resolviendo referencias (variables, plugins remotos, rutas relativas).

**Fuentes de configuración** (en orden de merge — la última gana):

| # | Fuente | Ruta / Origen | Ámbito |
|---|--------|---------------|--------|
| 1 | Managed (MDM) | `ConfigManaged.managedConfigDir()` + `readManagedPreferences()` | global |
| 2 | Remote (active org) | `{url}/api/config` vía account service | global |
| 3 | Remote (well-known) | `{origin}/.well-known/opencode` → `remote_config.url` | global |
| 4 | Global | `~/.config/opencode/{opencode.jsonc,opencode.json,config.json}` | global |
| 5 | `OPENCODE_CONFIG` flag | Path vía flag | local |
| 6 | Project files | `{project-root}/{opencode.jsonc,opencode.json}` (walk up tree) | local |
| 7 | `.opencode/` directories | `{dir}/.opencode/{opencode.json,opencode.jsonc}` | local |
| 8 | `OPENCODE_CONFIG_CONTENT` | Env var | local |
| 9 | `OPENCODE_PERMISSION` | Env var (JSON) | local |

**Archivos involucrados:**

| Archivo | Rol |
|---------|-----|
| `config.ts` | Pipeline principal: orquestación, merge, estado, update |
| `paths.ts` | Descubrimiento de archivos de proyecto y directorios `.opencode` |
| `parse.ts` | Parseo JSONC + validación con Effect Schema |
| `plugin.ts` | Resolución de specs de plugins (path → URL, dedup, origen) |
| `variable.ts` | Sustitución `{env:VAR}` y `{file:path}` en texto de config |
| `agent.ts` | Carga de agentes/modos desde archivos Markdown |
| `command.ts` | Carga de comandos personalizados |
| `managed.ts` | Configuración gestionada (MDM en macOS) |

---

## 2. Merge Order and Precedence

El merge sigue el principio **"later wins"** — cada fuente se mergea sobre el resultado acumulado. El orden exacto dentro de `loadInstanceState()` (`config.ts:334-657`):

```
1. Well-known remotes     (Phase 2-3, merge con scope="global")
2. Global config files     (via loadGlobal)
3. OPENCODE_CONFIG file    (si el flag está seteado)
4. Project config files    (walk up desde el directorio actual)
5. .opencode/ dirs         (por cada directorio en ConfigPaths.directories)
6. OPENCODE_CONFIG_CONTENT (env var)
7. Active org config       (desde account service, scope="global")
8. Managed config dir      (managedConfigDir)
9. Managed preferences     (macOS .mobileconfig, último — override total)
```

Dentro de cada grupo, archivos individuales se mergean secuencialmente (el orden dentro del grupo importa). Los grupos están en secuencia estricta.

**Array fields**: `instructions` se concatenan con dedup (`mergeConfigConcatArrays`, `config.ts:45-51`). Todos los demás campos se mergean deep con `mergeDeep` de remeda (último valor gana).

---

## 3. Loading Pipeline

### 3.1 Parallel I/O

El pipeline aprovecha `Effect.all` con `{ concurrency: "unbounded" }` en tres puntos clave:

```typescript
// Global: 3 archivos en paralelo (config.ts:273-278)
const loaded = yield* Effect.all(
  ["config.json", "opencode.json", "opencode.jsonc"].map((f) =>
    loadFile(path.join(Global.Path.config, f), env),
  ),
  { concurrency: "unbounded" },
)

// Remote: todos los well-known en paralelo (config.ts:387-423)
const wellknownResults = yield* Effect.all(
  wellknownEntries.map(({ key, value, url }) =>
    Effect.gen(function* () { /* fetch + parse */ }),
  ),
  { concurrency: "unbounded" },
)

// Project: todos los archivos encontrados en paralelo (config.ts:442-449)
const projectConfigs = yield* Effect.all(
  projectFiles.map((file) => loadFile(file, authEnv)),
  { concurrency: "unbounded" },
)
```

Después de cada `Effect.all` paralelo, los resultados se mergean **secuencialmente** (el orden de merge importa, pero el I/O ocurre en paralelo).

### 3.2 Global Config Discovery

`globalConfigFile()` (`config.ts:139-147`) busca en `Global.Path.config`:

```typescript
function globalConfigFile() {
  const candidates = ["opencode.jsonc", "opencode.json", "config.json"].map((file) =>
    path.join(Global.Path.config, file),
  )
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return candidates[0]  // opencode.jsonc como default
}
```

Si no existe ningún archivo y no hay flags de override (`OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG_CONTENT`), se siembra un archivo `opencode.jsonc` con solo el `$schema`.

### 3.3 normalizeLoadedConfig

`normalizeLoadedConfig()` (`config.ts:53-63`) es una micro-optimización para evitar spread copies innecesarias:

```typescript
function normalizeLoadedConfig(data: unknown) {
  if (!isRecord(data)) return data
  // Avoid the unconditional spread copy — only create one when we need to delete legacy fields.
  // Saves ~15 spread copies worst case (one per config file).
  if (!("theme" in data || "keybinds" in data || "tui" in data)) return data
  const copy = { ...data }
  delete copy.theme
  delete copy.keybinds
  delete copy.tui
  return copy
}
```

Esto elimina campos heredados (`theme`, `keybinds`, `tui`) que migraron a otros subsistemas. El early return evita copiar objetos grandes innecesariamente.

### 3.4 mergeConfigConcatArrays

`mergeConfigConcatArrays()` (`config.ts:45-51`) envuelve `mergeDeep` de remeda con lógica específica para arrays:

```typescript
function mergeConfigConcatArrays(target: Info, source: Info): Info {
  const merged = mergeConfig(target, source);
  if (target.instructions && source.instructions) {
    merged.instructions = Array.from(new Set([...target.instructions, ...source.instructions]));
  }
  return merged;
}
```

Solo `instructions` recibe concatenación con dedup. Todos los demás campos se comportan como `mergeDeep` estándar (último valor gana).

### 3.5 resolveLoadedPlugins

`resolveLoadedPlugins()` (`config.ts:101-109`) normaliza rutas de plugins relativas **inmediatamente después de parsear cada archivo**, antes de que el merge pueda reinterpretar la ruta:

```typescript
async function resolveLoadedPlugins<T extends { plugin?: ConfigPluginV1.Spec[] }>(config: T, filepath: string) {
  if (!config.plugin) return config
  for (let i = 0; i < config.plugin.length; i++) {
    config.plugin[i] = await ConfigPlugin.resolvePluginSpec(config.plugin[i], filepath)
  }
  return config
}
```

Esto evita que `./plugin.ts` declarado en `~/.opencode/opencode.jsonc` sea resuelto contra el directorio del proyecto tras el merge.

### 3.6 File Loading Flow

```
loadFile(filepath)
  → readConfigFile(filepath)        // fs.readFileStringSafe + orDie
  → loadConfig(text, { path })
      → ConfigVariable.substitute()  // {env:VAR} y {file:path}
      → ConfigParse.jsonc(text)      // jsonc-parser con errores formateados
      → normalizeLoadedConfig()      // elimina legacy fields
      → ConfigParse.schema(Info)     // valida contra Effect Schema, rechaza keys extra
      → resolveLoadedPlugins()       // normaliza rutas relativas
      → inyecta $schema si falta     // y persiste al archivo
```

---

## 4. Remote Config

### 4.1 Well-Known Discovery

Las entradas de auth con `type: "wellknown"` disparan fetching de configuración remota. El proceso tiene 3 fases (vMK: antes era secuencial, ahora paralelo):

**Phase 1 — Preparación** (`config.ts:377-384`): recolecta entradas well-known y sus URLs:

```typescript
const wellknownEntries: { key: string; value: typeof auth[string]; url: string }[] = []
for (const [key, value] of Object.entries(auth)) {
  if (value.type === "wellknown") {
    authEnv[value.key] = value.token
    wellknownEntries.push({ key, value, url: key.replace(/\/+$/, "") })
  }
}
```

**Phase 2 — Fetching paralelo** (`config.ts:387-423`): para cada well-known:

1. Fetch `{url}/.well-known/opencode` → `fetchRemoteJson(url, undefined, ConfigV1.WellKnown, url)`
2. Si tiene `remote_config`, resuelve URL/headers vía `substituteWellKnownRemoteConfig()`
3. Fetch de la URL remota → `fetchRemoteJson(remote.url, remote.headers, Schema.Json, url)`
4. Mergea wellknown.config + fetchedConfig
5. Serializa a JSON y pasa por `loadConfig()` (para variable substitution y schema validation)

**Phase 3 — Merge secuencial** (`config.ts:426-429`): los resultados se mergean con `scope: "global"`.

### 4.2 substituteWellKnownRemoteConfig

`substituteWellKnownRemoteConfig()` (`config.ts:65-99`) procesa la entrada `remote_config` del well-known:

```typescript
async function substituteWellKnownRemoteConfig(input: {
  value: unknown; dir: string; source: string; env: Record<string, string>
}) {
  if (!isRecord(input.value) || typeof input.value.url !== "string") return undefined

  const url = await ConfigVariable.substitute({ text: input.value.url, type: "virtual", ... })

  const headers = isRecord(input.value.headers)
    ? await (async () => {
        // sustituye {env:TOKEN} en cada header value
      })()
    : undefined

  return { url, headers }
}
```

### 4.3 Error Handling

`fetchRemoteJson()` (`config.ts:187-211`) usa `Effect.die` para errores no recuperables:

```typescript
Effect.catch((error) => Effect.die(new Error(`failed to fetch remote config from ${url}: ${String(error)}`)))
```

Detecta respuestas HTML (pantalla de login de proxy auth) como `RemoteAuthError`:

```typescript
const contentType = (response.headers["content-type"] ?? "").toLowerCase()
if (contentType.includes("html") || /^\s*<!doctype|^\s*<html/i.test(body)) {
  return yield* Effect.die(new RemoteAuthError({ url: loginOrigin, remote: url }))
}
```

---

## 5. Plugin Resolution

### 5.1 Spec Normalization

`ConfigPlugin.resolvePluginSpec()` (`plugin.ts:42-60`) convierte cualquier spec path-like a URL absoluta `file://`:

```typescript
export async function resolvePluginSpec(plugin: ConfigPluginV1.Spec, configFilepath: string) {
  const spec = pluginSpecifier(plugin)
  if (!isPathPluginSpec(spec)) return plugin  // npm spec, no tocar

  const base = path.dirname(configFilepath)
  const file = (() => {
    if (spec.startsWith("file://")) return spec
    if (path.isAbsolute(spec) || /^[A-Za-z]:[\\/]/.test(spec)) return pathToFileURL(spec).href
    return pathToFileURL(path.resolve(base, spec)).href
  })()

  const resolved = await resolvePathPluginTarget(file).catch(() => file)
  if (Array.isArray(plugin)) return [resolved, plugin[1]]
  return resolved
}
```

### 5.2 plugin_origins Derived State

El tipo `Info` extiende `ConfigV1.Info` con `plugin_origins`:

```typescript
type Info = ConfigV1.Info & {
  plugin_origins?: ConfigPlugin.Origin[]
}

type Origin = {
  spec: ConfigPluginV1.Spec
  source: string      // archivo donde se declaró
  scope: "global" | "local"
}
```

`plugin_origins` **no es persistido** — se elimina antes de escribir con `writable()`. Se construye incrementalmente durante el merge en `mergePluginOrigins()` (`config.ts:350-369`).

### 5.3 Plugin Scope Detection

`pluginScopeForSource()` (`config.ts:343-348`) determina si un plugin es "global" o "local" basado en su fuente:

```typescript
const pluginScopeForSource = Effect.fnUntraced(function* (source: string) {
  if (source.startsWith("http://") || source.startsWith("https://")) return "global"
  if (source === "OPENCODE_CONFIG_CONTENT") return "local"
  if (containsPath(source, ctx)) return "local"
  return "global"
})
```

### 5.4 Deduplication

`ConfigPlugin.deduplicatePluginOrigins()` (`plugin.ts:64-77`) mantiene el primer origen que vio cada plugin (recorriendo en reversa para que el último que ganó en merge tenga precedencia):

```typescript
export function deduplicatePluginOrigins(plugins: Origin[]): Origin[] {
  const seen = new Set<string>()
  const list: Origin[] = []
  for (const plugin of plugins.toReversed()) {
    const spec = pluginSpecifier(plugin.spec)
    const name = spec.startsWith("file://") ? spec : parsePluginSpecifier(spec).pkg
    if (seen.has(name)) continue
    seen.add(name)
    list.push(plugin)
  }
  return list.toReversed()
}
```

### 5.5 Auto-Discovery

Además de los plugins declarados en config, `ConfigPlugin.load()` (`plugin.ts:18-30`) descubre archivos `{plugin,plugins}/*.{ts,js}` en cada directorio `.opencode/`:

```typescript
export async function load(dir: string) {
  for (const item of await Glob.scan("{plugin,plugins}/*.{ts,js}", { cwd: dir, absolute: true })) {
    plugins.push(pathToFileURL(item).href)
  }
  return plugins
}
```

---

## 6. InstanceState Pattern

### 6.1 Per-Directory State

El estado de configuración se maneja con `InstanceState` (`config.ts:661-665`):

```typescript
const state = yield* InstanceState.make<State>(
  Effect.fn("Config.state")(function* (ctx) {
    return yield* loadInstanceState(ctx).pipe(Effect.orDie)
  }),
)
```

Cada directorio abierto en opencode tiene su propia instancia de `State`. `InstanceState.make()` usa `ScopedCache` con `capacity: Infinity` — las entradas se limpian cuando el directorio se cierra.

### 6.2 State Shape

```typescript
type State = {
  config: Info           // configuración mergeada final
  directories: string[]  // directorios de config descubiertos
  deps: Fiber.Fiber<void>[]  // background installs de dependencias
  consoleState: ConsoleState // estado de consola gestionada
}
```

### 6.3 Accessors

```typescript
const get = Effect.fn("Config.get")(function* () {
  return yield* InstanceState.use(state, (s) => s.config)
})

const directories = Effect.fn("Config.directories")(function* () {
  return yield* InstanceState.use(state, (s) => s.directories)
})
```

`InstanceState.use()` provee acceso síncrono al estado cachead; `InstanceState.useEffect()` permite efectos sobre el estado (usado en `waitForDependencies`).

### 6.4 Global Config Caching

La config global usa `Effect.cachedInvalidateWithTTL` (`config.ts:302-310`) con TTL infinito:

```typescript
const [cachedGlobal, invalidateGlobal] = yield* Effect.cachedInvalidateWithTTL(
  loadGlobal().pipe(
    Effect.tapError((error) => Effect.logError("failed to load global config", { error: String(error) })),
    Effect.orElseSucceed((): Info => ({})),
  ),
  Duration.infinity,
)
```

`getGlobal()` llama `cachedGlobal` — múltiples llamadas concurrentes comparten una sola carga. `invalidate()` (`config.ts:694-696`) invalida el cache:

```typescript
const invalidate = Effect.fn("Config.invalidate")(function* () {
  yield* invalidateGlobal
})
```

---

## 7. Update Pipeline

### 7.1 update()

`update()` (`config.ts:685-692`) escribe config local en `config.json` del directorio actual:

```typescript
const update = Effect.fn("Config.update")(function* (config: Info) {
  const dir = yield* InstanceState.directory
  const file = path.join(dir, "config.json")
  const existing = yield* loadFile(file)
  yield* fs.writeFileString(file, JSON.stringify(mergeDeep(writable(existing), writable(config)), null, 2))
    .pipe(Effect.orDie)
})
```

Carga la config existente, mergea con la nueva, y serializa. Usa `writable()` para eliminar `plugin_origins` antes de persistir.

### 7.2 updateGlobal()

`updateGlobal()` (`config.ts:698-721`) maneja dos formatos:

- **`.jsonc`**: usa `patchJsonc()` con `jsonc-parser` para preservar comentarios y formato
- **`.json`**: serializa con `JSON.stringify` (replace completo)

```typescript
const updateGlobal = Effect.fn("Config.updateGlobal")(function* (config: Info) {
  const file = globalConfigFile()
  const before = (yield* readConfigFile(file)) ?? "{}"
  const patch = writableGlobal(config)

  if (!file.endsWith(".jsonc")) {
    // JSON: reemplazo completo
    const merged = mergeDeep(writable(existing), patch)
    const serialized = JSON.stringify(merged, null, 2)
    changed = serialized !== before
    if (changed) yield* fs.writeFileString(file, serialized).pipe(Effect.orDie)
  } else {
    // JSONC: patch quirúrgico
    const updated = patchJsonc(before, patch)
    if (changed) yield* fs.writeFileString(file, updated).pipe(Effect.orDie)
  }

  if (changed) yield* invalidate()
  return { info: next, changed }
})
```

### 7.3 patchJsonc()

`patchJsonc()` (`config.ts:149-161`) aplica patches recursivamente sobre texto JSONC, preservando comentarios:

```typescript
function patchJsonc(input: string, patch: unknown, path: string[] = []): string {
  if (!isRecord(patch)) {
    const edits = modify(input, path, patch, { formattingOptions: { insertSpaces: true, tabSize: 2 } })
    return applyEdits(input, edits)
  }
  return Object.entries(patch).reduce((result, [key, value]) => patchJsonc(result, value, [...path, key]), input)
}
```

### 7.4 writable()

`writable()` (`config.ts:163-166`) y `writableGlobal()` (`config.ts:168-173`) eliminan estado derivado antes de escribir:

```typescript
function writable(info: Info) {
  const { plugin_origins: _plugin_origins, ...next } = info
  return next
}

function writableGlobal(info: Info) {
  const next = writable(info)
  if ("shell" in next && next.shell === "") return { ...next, shell: undefined }
  return next
}
```

---

## 8. Config Structure (Info Type)

El tipo central es `ConfigV1.Info` extendido con `plugin_origins`:

```typescript
type Info = ConfigV1.Info & {
  plugin_origins?: ConfigPlugin.Origin[]
}
```

`ConfigV1.Info` (definido en `@opencode-ai/core/v1/config/config`) incluye (parcial):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `$schema` | `string?` | URL del schema JSON |
| `agent` | `Record<string, AgentInfo>?` | Configuración de agentes |
| `mode` | `Record<string, AgentInfo>?` | Modos de agente (se mergean a agent) |
| `plugin` | `ConfigPluginV1.Spec[]?` | Plugins declarados |
| `provider` | `Record<string, ProviderConfig>?` | Proveedores de LLM |
| `model` | `string?` | Modelo por defecto |
| `instructions` | `string[]?` | Instrucciones globales |
| `shell` | `string?` | Shell para comandos |
| `permission` | `Record<string, Action>?` | Permisos de herramientas |
| `tools` | `Record<string, boolean>?` | Mapa tools → allow/deny (se transforma a permission) |
| `username` | `string?` | Nombre de usuario (fallback: os.userInfo) |
| `share` | `string?` | Modo de compartir |
| `autoshare` | `boolean?` | Auto-share (transforma share="auto") |
| `compaction` | `{ auto?: boolean; prune?: boolean }?` | Config de compactación |

---

## 9. Service Interface

```typescript
export interface Interface {
  readonly get: () => Effect.Effect<Info>                    // config mergeada del directorio actual
  readonly getGlobal: () => Effect.Effect<Info>              // solo config global
  readonly getConsoleState: () => Effect.Effect<ConsoleState> // estado de consola gestionada
  readonly update: (config: Info) => Effect.Effect<void>      // escribe config local
  readonly updateGlobal: (config: Info) => Effect.Effect<{ info: Info; changed: boolean }>
  readonly invalidate: () => Effect.Effect<void>              // invalida cache global
  readonly directories: () => Effect.Effect<string[]>         // directorios de config
  readonly waitForDependencies: () => Effect.Effect<void>     // espera background installs
}
```

---

## 10. Layer Dependencies

```typescript
export const defaultLayer = layer.pipe(
  Layer.provide(EffectFlock.defaultLayer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Env.defaultLayer),
  Layer.provide(Auth.defaultLayer),
  Layer.provide(Account.defaultLayer),
  Layer.provide(Npm.defaultLayer),
  Layer.provide(FetchHttpClient.layer),
)
```

Para binario compilado (node):

```typescript
export const node = LayerNode.make(layer, [
  FSUtil.node, Auth.node, Account.node, Env.node, Npm.node, httpClient,
])
```

---

## 11. vMK-Specific Changes

| Aspecto | Upstream (secuencial) | vMK (paralelo) |
|---------|----------------------|----------------|
| Well-known fetching | `for` loop secuencial | `Effect.all` con `concurrency: "unbounded"` |
| Project file I/O | Secuencial | `Effect.all` con `concurrency: "unbounded"` |
| Merge post-fetch | N/A (era secuencial) | Secuencial (el merge debe ser ordenado) |

---

## Diagrama de Flujo

```
start
  │
  ├─► loadInstanceState(ctx)
  │     │
  │     ├─► Phase 1: collect wellknown auth entries
  │     │
  │     ├─► Phase 2: fetch all wellknown/remote (PARALLEL)
  │     │
  │     ├─► Phase 3: merge wellknown results (SEQUENTIAL)
  │     │
  │     ├─► loadGlobal(): merge 3 files (PARALLEL I/O)
  │     │     └── legacy config migration (config → config.json)
  │     │
  │     ├─► OPENCODE_CONFIG (si flag)
  │     │
  │     ├─► project files (PARALLEL I/O → SEQUENTIAL merge)
  │     │
  │     ├─► .opencode/ directories:
  │     │     ├── Phase 1: config files (SEQUENTIAL — merge order matters)
  │     │     └── Phase 2: agents, modes, commands, plugins (PARALLEL I/O, concurrency=10)
  │     │
  │     ├─► OPENCODE_CONFIG_CONTENT (env var)
  │     │
  │     ├─► active org config (remote)
  │     │
  │     ├─► managed config dir
  │     │
  │     └─► managed preferences (macOS MDM — last wins)
  │
  └─► State { config, directories, deps, consoleState }
```

---

*Actualizado: 2026-07-03 | Basado en opencode vMK codebase — `packages/opencode/src/config/`*
