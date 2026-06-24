# Anti-Pattern Catalog — opencode fork (vMK)

> Patterns to avoid. Add new entries as discovered. Each entry: symptom → root cause → fix → prevention.

---

## AP-001: Concurrent revert without session mutex

**Symptom**: Two revert operations on the same session can interleave, causing data corruption — messages removed partially, snapshot state inconsistent, diff events out of order.

**Root cause**: `assertNotBusy()` in `run-state.ts` is a read-only check (no state change combined atomically). No session-level mutex protects the revert operation. Snapshot ops (`track`/`restore`/`revert`) use a gitdir semaphore, not a per-snapshot lock.

**Fix**: Added `RevertLock` — `SynchronizedRef<Map<SessionID, boolean>>` acquired atomically at revert start, released via `Effect.ensuring` on both success and failure.

**Prevention**: Any operation that reads + writes session state non-atomically MUST acquire a per-session mutex. The `SynchronizedRef.modify` pattern (atomic check-and-set) is preferred over separate read-then-write.

**Files**: `packages/opencode/src/session/revert.ts:30-45`

---

## AP-002: Stale session snapshot in cleanup

**Symptom**: `cleanup()` receives a `Session.Info` from the caller that may be stale — if a concurrent operation cleared or changed the revert state between the caller's read and the cleanup execution.

**Root cause**: The caller's `session` parameter is captured at a previous point in time. Between then and `cleanup()`, another operation may have modified the session's revert state.

**Fix**: Re-read the session fresh from DB at the start of `cleanup()`: `yield* sessions.get(session.id).pipe(Effect.orDie)`.

**Prevention**: Never trust caller-provided session data for critical operations. Always re-read from the authoritative source inside the function.

**Files**: `packages/opencode/src/session/revert.ts:133-137`
