# LSP Client Lifecycle — opencode vMK

> How opencode manages LSP clients: connection lifecycle, file tracking, diagnostics flow, and idle eviction.

---

## 1. Overview

LSP (Language Server Protocol) in opencode provides diagnostics, completions, hover info, go-to-definition, references, and call hierarchy for supported languages. Unlike an editor that keeps a persistent workspace, opencode opens files transiently as the user navigates the codebase. This imposes two architectural requirements:

- **On-demand spawning**: clients are created lazily when a file with a matching extension is first touched.
- **Resource limits**: opencode caps tracked files per client (`MAX_FILES = 128`) and evicts idle LSP processes after 30 minutes.

The implementation is split across three layers:

| Layer | File | Responsibility |
|-------|------|----------------|
| Server definitions | `server.ts` | `Info` objects describing how to find a root and spawn a process |
| Client instance | `client.ts` | Per-process connection, file tracking, diagnostics |
| Orchestration | `lsp.ts` | `Service` layer — client pooling, idle eviction, file touch dispatching |

---

## 2. Server Definitions (`server.ts`)

Each language server exports an `Info` object conforming to the `LSPServer.Info` interface:

```typescript
// server.ts:82
interface Info {
  id: string
  extensions: string[]
  global?: boolean
  root: RootFunction
  spawn(root: string, ctx: InstanceContext, flags: RuntimeFlags.Info): Promise<Handle | undefined>
}
```

- `root` — async function that walks up from the file to find the project root (package-lock.json, go.mod, Cargo.toml, etc.).
- `spawn` — spawns the server process. Returns `{ process, initialization? }` or `undefined` if the binary is unavailable.
- `extensions` — file extensions this server handles. If empty, the server matches all files.

**Registered servers** (as of vMK): TypeScript, Deno, Vue, ESLint, Oxlint, Biome, Gopls, Rubocop, Ty, Pyright, ElixirLS, Zls, CSharp/Razor, FSharp, SourceKit, Rust Analyzer, Clangd, Svelte, Astro, JDTLS (Java), KotlinLS, YamlLS, LuaLS, PHP Intelephense, Prisma, Dart, OCaml, BashLS, TerraformLS, TexLab, DockerfileLS, Gleam, Clojure, Nixd.

---

## 3. Connection Lifecycle (`client.ts`)

### 3.1 `create()` — Instantiation

`client.ts:123`

```typescript
export async function create(input: {
  serverID: string
  server: LSPServer.Handle    // { process, initialization? }
  root: string
  directory: string
  instance: InstanceContext
})
```

The `create` function:

1. **Creates a JSON-RPC connection** over the process stdio:

```typescript
const connection = createMessageConnection(
  new StreamMessageReader(input.server.process.stdout as any),
  new StreamMessageWriter(input.server.process.stdin as any),
)
```

2. **Resumes stderr** so the server's diagnostic output flows (not consumed by opencode).

3. **Initializes diagnostic state**:

```typescript
const pushDiagnostics = new Map<string, Diagnostic[]>()   // server-pushed
const pullDiagnostics = new Map<string, Diagnostic[]>()   // client-requested
const published = new Map<string, { at: number; version?: number }>()
const diagnosticRegistrations = new Map<string, CapabilityRegistration>()
const MAX_FILES = 128
```

4. **Sets up LSP handlers**: `textDocument/publishDiagnostics`, `workspace/configuration`, `client/registerCapability`, `client/unregisterCapability`, `workspace/workspaceFolders`, `workspace/diagnostic/refresh`.

5. **Calls `connection.listen()`** to activate the message channel.

### 3.2 Initialize Handshake

```typescript
const initialized = await withTimeout(
  connection.sendRequest("initialize", { ... }),
  INITIALIZE_TIMEOUT_MS,  // 45s
)
```

The client advertises capabilities:

```typescript
capabilities: {
  window: { workDoneProgress: true },
  workspace: {
    configuration: true,
    didChangeWatchedFiles: { dynamicRegistration: true },
    diagnostics: { refreshSupport: false },
  },
  textDocument: {
    synchronization: { didOpen: true, didChange: true },
    diagnostic: { dynamicRegistration: true, relatedDocumentSupport: true },
    publishDiagnostics: { versionSupport: false },
  },
}
```

After receiving the server's capabilities, the client:

- **Detects sync kind** via `getSyncKind()` — determines incremental vs full document sync:

```typescript
// client.ts:76
function getSyncKind(capabilities?: ServerCapabilities) {
  if (!capabilities) return
  const sync = capabilities.textDocumentSync
  if (typeof sync === "number") return sync
  return sync?.change
}
```

- **Checks for pull diagnostics** support: `hasStaticPullDiagnostics = Boolean(capabilities.diagnosticProvider)`.
- **Sends `initialized`** notification.
- **Sends `workspace/didChangeConfiguration`** if `initialization` options were provided.

### 3.3 File Tracking

Files are tracked in a plain object acting as a map keyed by normalized path:

```typescript
const files: Record<string, { version: number; text: string }> = {}
```

- `version` — monotonic counter incremented on each `didChange`.
- `text` — full file content held in memory.

### 3.4 LRU Eviction (`pruneFiles`)

`client.ts:148`

```typescript
function pruneFiles(currentPath: string) {
  const keys = Object.keys(files)
  if (keys.length <= MAX_FILES) return
  const toRemove = keys.length - MAX_FILES
  let removed = 0
  for (const key of keys) {
    if (key === currentPath) continue
    const entry = files[key]
    delete files[key]
    connection.sendNotification("textDocument/didClose", {
      textDocument: { uri: pathToFileURL(key).href },
    }).catch(() => {})
    pushDiagnostics.delete(key)
    pullDiagnostics.delete(key)
    published.delete(key)
    removed++
    if (removed >= toRemove) break
  }
  // Re-insert current file at tail (most recently used)
  if (files[currentPath]) {
    const entry = files[currentPath]
    delete files[currentPath]
    files[currentPath] = entry
  }
}
```

Key behaviors:

- **Eviction triggers** after every `open()` or `didChange` if the file count exceeds `MAX_FILES`.
- **LRU via Map insertion order**: the current file is deleted then re-assigned to become the youngest key. Object property enumeration order in modern JS guarantees insertion order, so the first `keys` are the oldest.
- **`didClose` notification** is sent so the server can release its internal state.
- **Diagnostic caches** for evicted files are cleared.

### 3.5 `open()` — Opening a File

`client.ts:584`

```typescript
async open(request: { path: string }) {
  request.path = Filesystem.normalizePath(
    path.isAbsolute(request.path) ? request.path : path.resolve(input.directory, request.path),
  )
  const text = await Filesystem.readText(request.path)
  const extension = path.extname(request.path)
  const languageId = LANGUAGE_EXTENSIONS[extension] ?? "plaintext"
  ...
}
```

Two paths:

**File already tracked** (`files[path] !== undefined`):

1. Sends `workspace/didChangeWatchedFiles` with `type: 2` (CHANGED).
2. Increments version, updates file content.
3. Sends `textDocument/didChange` — uses incremental sync if `syncKind === TEXT_DOCUMENT_SYNC_INCREMENTAL` (2), full-text otherwise.
4. Calls `pruneFiles()`.
5. Diagnostics are *not* wiped on `didChange` — see comment at line 595 about clangd behavior.

**New file**:

1. Sends `workspace/didChangeWatchedFiles` with `type: 1` (CREATED).
2. Clears push + pull diagnostics for the path (fresh state).
3. Sends `textDocument/didOpen` with `version: 0`.
4. Stores `{ version: 0, text }` in `files`.
5. Calls `pruneFiles()`.
6. Returns version number (0 for new files, `previous + 1` for re-opens).

### 3.6 `shutdown()` — Clean Teardown

`client.ts:675`

```typescript
async shutdown() {
  connection.end()     // close the JSON-RPC channel
  connection.dispose() // release resources
  await Process.stop(input.server.process) // kill the server process
}
```

Called from `lsp.ts` during idle eviction and instance cleanup.

---

## 4. Idle TTL (`lsp.ts`)

`lsp.ts:126-243`

To prevent accumulating stale LSP server processes, opencode vMK tracks when each client was last used and evicts idle ones.

### ClientEntry wrapper

```typescript
// lsp.ts:126
interface ClientEntry {
  client: LSPClient.Info
  lastUsed: number  // Date.now() timestamp
}
```

### Constants

```typescript
const CLIENT_IDLE_TTL_MS = 30 * 60_000       // 30 minutes
const CLIENT_IDLE_SCAN_INTERVAL_MS = 5 * 60_000  // 5 minutes
```

### Periodic eviction fiber

```typescript
// lsp.ts:229
yield* Effect.forkScoped(
  Effect.gen(function* evictIdleClients() {
    while (true) {
      yield* Effect.sleep(Duration.millis(CLIENT_IDLE_SCAN_INTERVAL_MS))
      const now = Date.now()
      for (let i = s.clients.length - 1; i >= 0; i--) {
        const entry = s.clients[i]!
        if (now - entry.lastUsed > CLIENT_IDLE_TTL_MS) {
          entry.client.shutdown().catch(() => {})
          s.clients.splice(i, 1)  // remove from pool
        }
      }
    }
  }),
)
```

- Scans in reverse to safely splice while iterating.
- Calls `client.shutdown()` (connection.end + process kill).
- A subsequent `touchFile` will re-spawn the server if needed (the broken-cooldown does not apply to idle eviction).

### lastUsed updates

`lastUsed` is bumped in three places:

| Location | When | Line |
|----------|------|------|
| `getClients` — existing client | Found in pool for a matching root+serverID | `287` |
| `getClients` — new client | After successful `create()` | `292` |
| `getClients` — cached match | Matching client found without re-spawn | `305` |

### Cleanup on instance disposal

```typescript
// lsp.ts:222
yield* Effect.addFinalizer(() =>
  Effect.promise(async () => {
    await Promise.all(s.clients.map((entry) => entry.client.shutdown()))
  }),
)
```

All clients are shut down when the `InstanceState` for a directory is disposed.

---

## 5. Diagnostics Flow

### 5.1 Dual Diagnostics Model

opencode supports both push and pull diagnostic models, merged per file:

```typescript
const mergedDiagnostics = (filePath: string) =>
  dedupeDiagnostics([
    ...(pushDiagnostics.get(filePath) ?? []),
    ...(pullDiagnostics.get(filePath) ?? []),
  ])
```

**Push diagnostics**: Server-initiated via `textDocument/publishDiagnostics`. Stored in `pushDiagnostics`.

**Pull diagnostics**: Client-initiated via `textDocument/diagnostic` (per-document) or `workspace/diagnostic` (workspace-wide). Stored in `pullDiagnostics`.

### 5.2 Push Diagnostics Handler

```typescript
connection.onNotification("textDocument/publishDiagnostics", (params) => {
  const filePath = getFilePath(params.uri)
  if (!filePath) return
  published.set(filePath, { at: Date.now(), version: ... })
  if (shouldSeedDiagnosticsOnFirstPush(serverID) && !pushDiagnostics.has(filePath)) {
    pushDiagnostics.set(filePath, params.diagnostics)  // seed immediately
    return
  }
  updatePushDiagnostics(filePath, params.diagnostics)  // normal update
})
```

- `shouldSeedDiagnosticsOnFirstPush("typescript")` returns `true` — TypeScript pushes all diagnostics on the first publish for a file, so the seed avoids waiting for a second debounced push.
- `published` map tracks when and at what version each file's last push arrived, used by `waitForFreshPush`.

### 5.3 Pull Diagnostics

Two strategies, toggled by `waitForDiagnostics` mode:

| Mode | Strategy | Timeout |
|------|----------|---------|
| `"document"` | `requestDocumentDiagnostics` | `DIAGNOSTICS_DOCUMENT_WAIT_TIMEOUT_MS` (5s) |
| `"full"` | `requestFullDiagnostics` | `DIAGNOSTICS_FULL_WAIT_TIMEOUT_MS` (10s) |

**Document-level pull** (`requestDocumentDiagnostics`):

- Checks `documentPullState()` — returns `supported: boolean` plus a deduplicated list of `documentIdentifiers` from capability registrations.
- Fires parallel requests: one unlabeled `textDocument/diagnostic` + one per registered identifier.
- Uses `hasCurrentFileDiagnostics` as a fast-path gate: resolves as soon as *any* identifier pull returns diagnostics for the current file. Remaining pulls continue merging in the background.

**Workspace-level pull** (`requestFullDiagnostics`):

- Combines document-level `textDocument/diagnostic` requests with workspace-level `workspace/diagnostic` requests.
- Waits for all to complete, then merges.

### 5.4 Debounce & Wait Loop

`waitForDocumentDiagnostics` and `waitForFullDiagnostics` share the same loop pattern:

```
1. Record startedAt
2. Start waitForFreshPush (fires on publishDiagnostics, debounced 150ms)
3. Loop:
   a. Request diagnostics (document or full)
   b. If matched/handled → return
   c. Race between push notification and registration change
   d. If push arrived → return
   e. If registration changed → loop again (server may now support pull)
   f. Timeout → return
```

The debounce in `waitForFreshPush`:

```typescript
debounceTimer = setTimeout(
  () => finish(true),
  Math.max(0, DIAGNOSTICS_DEBOUNCE_MS - (Date.now() - hit.at)),
)
```

If the push arrived 100ms ago, it waits only 50ms more to reach the 150ms debounce window.

### 5.5 Published Tracking

```typescript
const published = new Map<string, { at: number; version?: number }>()
```

Used by `waitForFreshPush` to detect whether a push has arrived for a given file+version. The version check ensures a stale push (for an older version) doesn't satisfy the wait.

### 5.6 Diagnostics Merging & Dedup

`mergedDiagnostics` combines push + pull and runs `dedupeDiagnostics`:

```typescript
function dedupeDiagnostics(items: Diagnostic[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = JSON.stringify({
      code: item.code, severity: item.severity,
      message: item.message, source: item.source, range: item.range,
    })
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
```

The `diagnostics` getter returns the merged map. `diagnosticsForFile(filePath)` returns the merged array for a single file.

---

## 6. Code Flow: File Open → Diagnostics

Tracing a complete cycle through the system (e.g., user navigates to `src/foo.ts`):

```
TouchFile (lsp.ts:389)
  │
  ├─ getClients(file)                            :: spawn/resolve clients
  │    ├─ For each matching server:
  │    │    ├─ server.root(file, ctx)            :: find project root
  │    │    ├─ isBroken(key)? → skip             :: 5min cooldown
  │    │    ├─ Existing client in pool?
  │    │    │    └─ match.lastUsed = Date.now()   :: bump idle TTL
  │    │    └─ No → spawn + create:
  │    │         ├─ server.spawn(root, ctx)       :: launch process
  │    │         ├─ LSPClient.create(handle)      :: init handshake
  │    │         └─ s.clients.push(ClientEntry)   :: add to pool
  │    └─ Returns LSPClient.Info[]
  │
  ├─ client.notify.open({ path })                :: LSPClient.open (client.ts:584)
  │    ├─ Filesystem.readText(path)
  │    ├─ LANGUAGE_EXTENSIONS[ext] → languageId
  │    ├─ Already tracked?
  │    │    ├─ Yes: didChangeWatchedFiles(CHANGED)
  │    │    │      + textDocument/didChange (v+1)
  │    │    ├─ No:  didChangeWatchedFiles(CREATED)
  │    │           + textDocument/didOpen (v=0)
  │    ├─ files[path] = { version, text }
  │    └─ pruneFiles(path)                       :: evict oldest if > 128
  │
  └─ client.waitForDiagnostics({ path, version, mode })
       │
       ├─ waitForFreshPush                       :: debounced 150ms
       │    └─ Listens to diagnosticListeners + published map
       │
       └─ Loop (max 5s document / 10s full):
            ├─ requestDocumentDiagnostics(path)  :: parallel pulls
            ├─ matched? → return
            └─ Race:
                 ├─ push ready → return
                 ├─ registration change → loop
                 └─ timeout → return
```

---

## 7. Key Constants

### client.ts

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_FILES` | 128 | Max tracked files per client before LRU eviction |
| `DIAGNOSTICS_DEBOUNCE_MS` | 150 | Debounce window for push diagnostics |
| `DIAGNOSTICS_DOCUMENT_WAIT_TIMEOUT_MS` | 5,000 (5s) | Max wait for document-level diagnostics |
| `DIAGNOSTICS_FULL_WAIT_TIMEOUT_MS` | 10,000 (10s) | Max wait for full (document + workspace) diagnostics |
| `DIAGNOSTICS_REQUEST_TIMEOUT_MS` | 3,000 (3s) | Per-request timeout for `textDocument/diagnostic` |
| `INITIALIZE_TIMEOUT_MS` | 45,000 (45s) | Timeout for the `initialize` handshake |
| `TEXT_DOCUMENT_SYNC_INCREMENTAL` | 2 | Constant for LSP incremental sync kind |

### lsp.ts

| Constant | Value | Purpose |
|----------|-------|---------|
| `CLIENT_IDLE_TTL_MS` | 1,800,000 (30 min) | Idle timeout before evicting a client |
| `CLIENT_IDLE_SCAN_INTERVAL_MS` | 300,000 (5 min) | Interval for the idle eviction background fiber |
| `BROKEN_RETRY_MS` | 300,000 (5 min) | Cooldown before re-trying a failed server spawn |

---

## 8. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Plain object for `files`** (not `Map`) | LRU eviction relies on insertion-order enumeration. A `Map` would work too, but the pattern uses `delete` + re-assignment, which is equivalent. |
| **Push + pull dual storage** | Some servers only push (e.g., TypeScript), some only support pull (e.g., via `diagnosticProvider` capabilities), some do both. Merging gives complete coverage. |
| **No diagnostics wipe on `didChange`** | Servers like clangd only re-emit diagnostics when content actually changes. Wiping on a no-op `touchFile` would lose errors. |
| **Reverse iteration in eviction** | Splice-safe: removing elements from the end doesn't affect indices of remaining elements. |
| **`forkScoped` for idle eviction** | The fiber's lifecycle is tied to the `Scope` created by `InstanceState.make`, so it's automatically interrupted when the instance is disposed. |
| **Identifiers in pull diagnostics** | Some servers register multiple diagnostic providers with different identifiers. The client fires parallel requests for each identifier to ensure coverage. |

---

*Actualizado: 2026-07-03 | Basado en opencode vMK codebase*
