# 2026-06-24 — Revert-loop bug fix + RevertLock safety checkpoint

## Findings

### TUI rendering bug
- `<Match when={msgRevert}>` mostraba RevertBanner en TODOS los mensajes cuando revert estaba activo
- Fix: scope guard con `message.id === msgRevertMID`
- File: `packages/tui/src/routes/session/index.tsx:1220`

### Server-side race conditions (4 descubiertos)
1. **TOCTOU**: `assertNotBusy()` es check read-only, no reserva el runner
2. **Sin mutex**: No hay lock por sesión para revert → concurrent reverts se interleavan
3. **Snapshot ops no atómicas**: Semáforo por gitdir, no por snapshot
4. **Stale snapshot en cleanup**: `cleanup()` en prompt.ts:1101 corre fuera del runner scope con snapshot viejo

### Fixes aplicados
- **RevertLock**: `SynchronizedRef<Map<SessionID, boolean>>` — atomic check-and-set via `SynchronizedRef.modify`
- **Effect.ensuring**: release del lock tanto en éxito como en error
- **cleanup stale fix**: re-read session fresh from DB

### Build verified
- `bun run build` en packages/opencode: ✅ pasa en 74s
- ARM64 cross-compile error es pre-existente en Windows

### 3-subagentes verdict
1. ✅ Code correctness: PASS
2. ✅ Build/regression: PASS
3. ❌ Close completeness: FAIL (bitácora, score, anti-patrones) → CORREGIDO

### Project score: 7.3 → 7.5
- errorPrevention: 6→9 (RevertLock + stale snapshot fix)
- correctness: 7→8 (TUI fix verified)
- skill: 7→8 (3 subagents used)
- breadth: 7→8 (TUI + server + binary + deep findings)

### Anti-patrones documentados
- AP-001: Concurrent revert without mutex
- AP-002: Stale session snapshot in cleanup
