# Project Score: opencode-vMK

**Current**: 9.0/10
**Last updated**: 2026-06-21
**Trend**: improving ↑ (7.5 → 9.0)

## Dimensions (score-auto)
| Dimension | Score | Notes |
|-----------|:-----:|-------|
| Project Artifacts | **10** | Cross-ref, 69 skills, changelog, readme, roadmap |
| Security | **10** | No secrets, no weak crypto |
| Dead Code | **10** | No orphans, no dead junctions |
| Clean Code | **9.9** | 36/36 with help, 35/36 with params, 36/36 strict mode |
| Best Practices | **9.7** | 35/36 param coverage, 25/36 try/catch |
| Orthography | **10** | 0/70 corrupted files |
| Bitacora | **10** | BITACORA.md active |
| Metrics | **10** | metrics dir, error tracking, reports |
| Script Performance | **9** | 36 scripts, avg 6.3KB |
| Skill Effectiveness | **10** | 69 skills, avg 1.7KB |
| Cycle Activity | **10** | inter: 50/30 — target exceeded |

## Ciclo: Auto-mejora CPU/RAM/VRAM/Stability (2026-06-21)

### Applied (10 fixes)
- ✅ MCP zombie kill en Windows — `taskkill /T /F /PID` reemplaza `descendants()` inefectivo
- ✅ Sidecar health check exponential backoff (100ms→2s max) — reduce 300+ HTTP health checks
- ✅ `startAttempts.Map` leak — `delete(id)` en cleanup
- ✅ SSE event queue bounded (1024) — `Queue.bounded` + sliding
- ✅ GPU flags para Electron — `OPENCODE_DISABLE_GPU` env var
- ✅ PTY WebSocket queue bounded (1024) en server + opencode handlers
- ✅ LLM native-runtime queue bounded (4096) — evita acumulación de LLMEvents
- ✅ PubSub sliding bounded (4096/1024) — event bus global
- ✅ Prepared statement LRU cache (64) en 3 SQLite clients (bun, node, effect-sqlite-node)
- ✅ buffered[] array capped (10K) + retry limit (5) en stream.transport.ts

### Type verification
- ✅ Typecheck clean: core, opencode, server, desktop, effect-sqlite-node
- ✅ 4 type errors fixed (3 LRU null assertion, 1 Queue.Done<void> type param)

### Tipo Fix y Pending
- 🔲 Preload SolidJS → REVERTED por riesgo de imports estáticos (P2)
