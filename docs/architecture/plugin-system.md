# Plugin System Architecture — opencode vMK

> Arquitectura del sistema de plugins de opencode. Basado en código real del repo.

---

## 1. Overview

El Plugin System permite extender opencode con funcionalidad adicional de servidor (hooks de eventos) e interfaz de usuario (TUI). Existen dos tipos de plugins:

- **npm plugins**: publicados en un registry npm, instalados on-demand vía `Npm.add()`.
- **File plugins**: archivos `.ts` locales, pensados para desarrollo, con reintento en fallos de pre-import.

Un plugin declara entrada para `"server"`, `"tui"`, o ambas mediante `package.json#exports`:

```json
{
  "exports": {
    "./server": "./dist/server.js",
    "./tui": "./dist/tui.js"
  }
}
```

Si no hay `exports`, se usa `main` para server. El TUI runtime también soporta `oc-themes` para paquetes de temas sin código.

---

## 2. Plugin Types

### npm plugins

- Se resuelven vía `resolvePluginTarget(spec)` → `Npm.add(pkg)` → directorio instalado.
- El spec sigue formato npm: `@org/pkg`, `pkg@version`, `pkg@tag`.
- Entrypoint: se lee `package.json` del target, se busca `exports["./server"]` o `main`.
- Pasan por `checkPluginCompatibility()` que verifica `engines.opencode` contra la versión actual.
- Metadata persistente en `plugin-meta.json` (versión solicitada, versión instalada, fingerprint).

### file plugins

- Spec comienza con `file://`, `.`, o es una ruta absoluta.
- Se resuelven vía `resolvePathPluginTarget()` que busca:
  - Archivo directo
  - Directorio con `package.json`
  - Directorio con `index.ts`/`index.tsx`/`index.js`/`index.mjs`/`index.cjs`
- No pasan por `checkPluginCompatibility()` — son código de desarrollo local.
- En caso de error de instalación (e.g. "missing package.json or index file"), reciben un reintento.

---

## 3. PluginLoader Pipeline

```ascii
┌─────────────────────────────────────────────────────────┐
│                    PluginLoader Pipeline                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Config Spec ──► Stage 1: Plan ──► Plan                 │
│                                                         │
│  Plan ──► Stage 2: Resolve ──► Resolved | Missing       │
│             ├── resolvePluginTarget()                   │
│             ├── createPluginEntry()                     │
│             └── checkPluginCompatibility() (npm only)   │
│                                                         │
│  Resolved ──► Stage 3: Load ──► Loaded                  │
│             └── dynamic import(entry)                   │
│                                                         │
│  Loaded ──► Stage 4: Finish ──► R                       │
│             └── caller transforms into runtime shape    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Stage 1 — Plan

Normaliza un `ConfigPluginV1.Spec` (string o `[string, Options]`) a un `Plan` inmutable:

```typescript
// packages/opencode/src/plugin/loader.ts
export type Plan = {
  spec: string
  options: ConfigPluginV1.Options | undefined
  deprecated: boolean
}

function plan(item: ConfigPluginV1.Spec): Plan {
  const spec = ConfigPlugin.pluginSpecifier(item)
  return { spec, options: ConfigPlugin.pluginOptions(item), deprecated: isDeprecatedPlugin(spec) }
}
```

Plugins deprecated (`opencode-openai-codex-auth`, `opencode-copilot-auth`) se silencian en Stage 4.

### Stage 2 — Resolve

`resolve(plan, kind)` produce un `Resolved`, un `Missing`, o falla con stage + error:

```typescript
export async function resolve(
  plan: Plan,
  kind: PluginKind,
): Promise<
  | { ok: true; value: Resolved }
  | { ok: false; stage: "missing"; value: Missing }
  | { ok: false; stage: "install" | "entry" | "compatibility"; error: unknown }
>
```

**Sub-pasos**:

1. **Install target**: `resolvePluginTarget(plan.spec)` →
   - File specs: `resolvePathPluginTarget()` — validación de archivo/directorio local.
   - npm specs: `Npm.add(pkg)` — instala el paquete si no existe.
   - Error → stage `"install"`.

2. **Entrypoint detection**: `createPluginEntry(spec, target, kind)` →
   - Lee `package.json` (o detecta index para file plugins).
   - Busca `exports["./<kind>"]`, luego `main`.
   - Si no hay entrypoint para el kind → stage `"missing"`.
   - Error → stage `"entry"`.

3. **Compatibility check**: `checkPluginCompatibility(target, version, pkg)` —
   - Solo para npm plugins.
   - Lee `engines.opencode` del `package.json`.
   - Si no satisface el semver → stage `"compatibility"`.

```typescript
export type Resolved = Plan & {
  source: PluginSource  // "file" | "npm"
  target: string        // filesystem path
  entry: string         // importable URL
  pkg?: PluginPackage
}

export type Missing = Plan & {
  source: PluginSource
  target: string
  pkg?: PluginPackage
  message: string       // "Plugin X does not expose a Y entrypoint"
}
```

### Stage 3 — Load

`load(resolved)` hace `import()` dinámico del entrypoint:

```typescript
export async function load(row: Resolved): Promise<
  { ok: true; value: Loaded } | { ok: false; error: unknown }
>
```

Bun cachea resultados de `import()` fallidos — por eso los reintentos solo ocurren antes del load.

```typescript
export type Loaded = Resolved & {
  mod: Record<string, unknown>  // module namespace
}
```

### Stage 4 — Finish

No es parte del loader directamente. El caller pasa un callback `finish(loaded, origin, retry)` que transforma `Loaded` en el tipo runtime específico:

- **Server** (`plugin/index.ts`): `applyPlugin()` → `readV1Plugin()` o `getLegacyPlugins()` → extrae hooks.
- **TUI** (`plugin/tui/runtime.ts`): `readV1Plugin()` + `resolvePluginId()` + `readThemeFiles()` → estructura con `TuiPluginModule`, `id`, `plugin_root`, `theme_files`.

---

## 4. Attempt Flow

`attempt()` es la ejecución unitaria de un solo candidato a través del pipeline completo:

```typescript
async function attempt<R>(
  candidate: Candidate,     // { origin: ConfigPlugin.Origin; plan: Plan }
  kind: PluginKind,         // "server" | "tui"
  retry: boolean,           // true si es un reintento
  finish?: (load: Loaded, origin, retry) => Promise<R | undefined>,
  missing?: (value: Missing, origin, retry) => Promise<R | undefined>,
  report?: Report,
): Promise<AttemptResult<R>>
```

```typescript
type AttemptResult<R> = {
  value?: R
  retry: boolean  // true si debe reintentarse
}

type Report = {
  start?: (candidate: Candidate, retry: boolean) => void
  missing?: (candidate, retry, message, resolved: Missing) => void
  error?: (candidate, retry, stage: "install" | "entry" | "compatibility" | "load", error, resolved?: Resolved) => void
}
```

**Flujo**:

1. Si `plan.deprecated` → `{ retry: false }` (silencioso).
2. `report.start?.(candidate, retry)`.
3. `resolve(plan, kind)`:
   - Stage `"missing"` → llama `missing()`, reporta, `{ retry: false }`.
   - Stage `"install"`/`"entry"`/`"compatibility"` → reporta error.
     - `retry = true` solo si: stage es `"install"` **y** error contiene "missing package.json or index file" (típico de file plugins que necesitan build previo).
4. `load(resolved)` → si falla, reporta error, `{ retry: false }`.
5. `finish(loaded)` → transforma a tipo final `R`.

---

## 5. Parallel Loading

`loadExternal()` orquesta todos los plugins configurados:

```typescript
export async function loadExternal<R = Loaded>(input: Input<R>): Promise<R[]>
```

```typescript
type Input<R> = {
  items: ConfigPlugin.Origin[]
  kind: PluginKind
  wait?: () => Promise<void>
  finish?: (load: Loaded, origin, retry) => Promise<R | undefined>
  missing?: (value: Missing, origin, retry) => Promise<R | undefined>
  report?: Report
}
```

```ascii
┌──────────────────────────────────────────────────────┐
│                  loadExternal()                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  items ──► map(plan) ──► candidates[]               │
│                                                      │
│  ┌─────────────────────────────────────┐             │
│  │  Promise.all (todos en paralelo)    │             │
│  │  ┌──────┐ ┌──────┐ ┌──────┐        │             │
│  │  │attempt│ │attempt│ │attempt│ ...  │             │
│  │  └──────┘ └──────┘ └──────┘        │             │
│  └─────────────────────────────────────┘             │
│                                                      │
│  if (wait) {                                         │
│    ──► Sequential retry (uno a la vez)              │
│    ──► Solo file plugins con retry=true             │
│    ──► Se espera wait() y se reintenta               │
│  }                                                   │
│                                                      │
│  ──► Filter: solo value !== undefined                │
│  ──► Preserve order                                  │
│  ──► Return R[]                                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Concurrencia en fase 1**: todos los plugins se intentan en paralelo vía `Promise.all`.

**Reintento secuencial**: solo file plugins cuyo `attempt` devolvió `retry: true`. Se procesan uno a la vez porque el `wait()` puede implicar setup que otros reintentos necesitan completar (ej. compilación de TypeScript).

**Filtro final**: se descartan los `undefined` (skip/error) preservando el orden original.

---

## 6. Plugin Discovery

Los plugins se declaran en `opencode.json` / `opencode.jsonc` bajo el campo `plugin`:

```json
{
  "plugin": [
    "my-plugin",
    ["@org/plugin", { "option": "value" }]
  ]
}
```

**ConfigPlugin.Origin** mantiene la procedencia:

```typescript
// packages/opencode/src/config/plugin.ts
export type Origin = {
  spec: ConfigPluginV1.Spec   // string | [string, Options]
  source: string               // path del archivo config donde se declaró
  scope: "global" | "local"
}
```

**Resolución de rutas relativas**: `resolvePluginSpec()` convierte specs relativos (`./plugin.ts`) a URLs absolutas usando el directorio del archivo config donde se declararon — previene reinterpretación tras merges.

**Deduplicación**: `deduplicatePluginOrigins()` elimina duplicados por identidad de paquete (npm: `parsePluginSpecifier().pkg`, file: URL exacta), manteniendo el primer Origin encontrado.

**Auto-detección de file plugins**: `ConfigPlugin.load(dir)` escanea `{plugin,plugins}/*.{ts,js}` en un directorio y los añade como specs file://.

---

## 7. Key Types Summary

```typescript
// ── Config layer (packages/core/src/v1/config/plugin.ts) ──
type ConfigPluginV1.Spec = string | [string, ConfigPluginV1.Options]
type ConfigPluginV1.Options = Record<string, unknown>

// ── Origin tracking (packages/opencode/src/config/plugin.ts) ──
type ConfigPlugin.Origin = {
  spec: ConfigPluginV1.Spec
  source: string    // config file path
  scope: "global" | "local"
}

// ── PluginLoader namespace (packages/opencode/src/plugin/loader.ts) ──
type Plan         = { spec: string; options?: Options; deprecated: boolean }
type Resolved     = Plan & { source: PluginSource; target: string; entry: string; pkg?: PluginPackage }
type Missing      = Plan & { source: PluginSource; target: string; pkg?: PluginPackage; message: string }
type Loaded       = Resolved & { mod: Record<string, unknown> }
type Candidate    = { origin: ConfigPlugin.Origin; plan: Plan }
type AttemptResult<R> = { value?: R; retry: boolean }
type Input<R>     = { items: Origin[]; kind: PluginKind; wait?; finish?; missing?; report? }
type Report       = { start?; missing?; error? }

// ── Shared types (packages/opencode/src/plugin/shared.ts) ──
type PluginSource = "file" | "npm"
type PluginKind   = "server" | "tui"
type PluginPackage = { dir: string; pkg: string; json: Record<string, unknown> }
type PluginEntry   = { spec: string; source: PluginSource; target: string; pkg?: PluginPackage; entry?: string }
```

---

## 8. Integration with Config

El flujo completo desde config hasta plugins cargados:

```ascii
opencode.json
    │
    ▼
Config merge ──► plugin_origins: ConfigPlugin.Origin[]
    │
    ▼
Plugin.loadExternal()
    │
    ├── Server: plugin/index.ts layer
    │     ├── internalPlugins() — auth plugins built-in
    │     ├── loadExternal({ kind: "server", ... })
    │     └── applyPlugin() → hooks[]
    │
    └── TUI: plugin/tui/runtime.ts
          ├── resolveExternalPlugins()
          ├── loadExternal({ kind: "tui", finish, missing, ... })
          └── installPlugin() / patchPluginConfig()
```

**Server (plugin/index.ts)**:

- Los plugins internos (Codex, Copilot, GitLab, Poe, Cloudflare, Azure, DO, Xai, Snowflake) se cargan primero vía `internalPlugins()` con `Effect.forEach({ concurrency: "unbounded" })`.
- Luego se cargan plugins externos si `flags.pure` es false y hay `plugin_origins`.
- `applyPlugin()` lee el módulo: si usa formato v1 (`readV1Plugin` con `"detect"` → busca `default` export con `server()`/`tui()`/`id`), o legacy (`getLegacyPlugins()` → `server` property o función directa).
- Los resultados se aplican secuencialmente para mantener orden determinístico de hooks.

**TUI (plugin/tui/runtime.ts)**:

- `resolveExternalPlugins()` usa `finish` para extraer `TuiPluginModule`, `id`, `plugin_root`, y `theme_files`.
- `missing()` permite cargar paquetes que solo aportan temas (sin entrypoint de código) → `EMPTY_TUI`.
- Soportan `oc-themes` en `package.json` para temas declarativos.

---

*Actualizado: 2026-07-03 | Basado en opencode vMK codebase*
