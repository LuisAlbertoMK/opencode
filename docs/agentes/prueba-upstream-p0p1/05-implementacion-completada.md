# Implementación completada — prueba/upstream-p0p1

Fecha: 2026-09-22
Rama base: experimento/ciclo8-delta-coalescing @ d7a921e41e
Rama prueba: prueba/upstream-p0p1

## SHAs aplicados (orden estricto, cherry-pick -x)
1. f5ce4f881e477c7b75421cea2d20939f0ddd71fb fix(core) filesystem import cycle → ff445020ef
2. ba341c6cac5ed1ef867ef127245a42b5e33d4946 fix(core) npm entrypoint Node → ae1c419ae8
3. c10134729dd2ce00beb18604ec91f10319f59a78 fix(opencode) Bedrock hoist images → 596732d2b9
4. 8bf288ecb15263f6a6bf4a82fa806975c6261046 bump togetherai → 28e86ece6e

Todos aplicaron limpio, sin conflictos. No se usó --all, merge ni rebase.

## Verificación

### Stash resguardo (paso 1)
Comando: `git stash push -m "WIP pre-prueba-p0p1" -- packages/core/src/flag/flag.ts packages/core/src/plugin/provider/opencode.ts packages/opencode/package.json packages/opencode/src/cli/cmd/run.ts packages/opencode/src/cli/cmd/tui.ts packages/opencode/src/lsp/lsp.ts packages/opencode/src/provider/provider.ts packages/web/src/content/docs/agents.mdx packages/web/src/content/docs/cli.mdx bun.lock`
Resultado: stash@{0} creado. `git status --short` en tracked quedó limpio (solo untracked: .gentleman-mode, test-yargs*.mjs, etc. intactos).

### Cherry-pick
Cada `git cherry-pick -x <sha>` pasó sin conflictos. No hubo necesidad de `git cherry-pick --abort`.

### Typecheck
- `bun typecheck` en packages/core (tsgo --noEmit): EXIT 0 — pass
- `bun typecheck` en packages/opencode (tsgo --noEmit): EXIT 0 — pass

### Tests
- `bun test test/npm.test.ts` en packages/core: 5 pass, 0 fail, 10 expect() calls — EXIT 0 (incluye el nuevo test del entrypoint Node del SHA ba341c6)
- `bun test test/plugin/codex.test.ts` en packages/opencode: 45 pass, 1 fail (hook timeout beforeEach/afterEach, 68 expect calls) — repetido 2× mismo resultado. No relacionado a los 4 SHAs (ese archivo no fue tocado; P2 no tocado como pedido). Requiere investigación separada si es flaky preexistente.

### Archivos tocados vs esperados
`git diff --name-only d7a921e41e..HEAD`:
- bun.lock
- packages/core/package.json
- packages/core/src/filesystem/search.ts
- packages/core/src/npm.ts
- packages/core/test/npm.test.ts
- packages/opencode/package.json
- packages/opencode/src/session/message-v2.ts

Coincide con esperado: search.ts, npm.ts (+test), message-v2.ts, package.jsons, bun.lock. Confirmado NO tocado: packages/opencode/src/plugin/openai/codex.ts (P2).

### Log
```
28e86ece6e fix(opencode): bump togetherai so streams report usage (#50264)
596732d2b9 fix(opencode): hoist Bedrock tool images except Claude, Nova, and Llama 4 (#50272)
ae1c419ae8 fix(core): resolve npm package entrypoint to a file under Node (#50413)
ff445020ef fix(core): break filesystem search import cycle (#50439)
d7a921e41e docs(bitacora): rebase 19/09 + FF dev
5c904cfef9 docs(bitacora): asentar E9, fix stale y rebuild 1.18.26
```

### Constraints respetados
- NO push, NO commits extra, NO bump 1.18.31→1.18.32, NO docs Zen ni console/stats.
- Rama original experimento/ciclo8-delta-coalescing intacta en d7a921e41e (verificado `git log experimento/ciclo8-delta-coalescing -3`).
- Untracked test-yargs*.mjs y resto dejados intactos.

## Restauración dirty (para volver al trabajo)
Estás actualmente en rama `prueba/upstream-p0p1`.
Tu trabajo dirty está en `stash@{0}: On experimento/ciclo8-delta-coalescing: WIP pre-prueba-p0p1` con 10 files tracked (ver `git stash list`).
Para restaurar:
```bash
git checkout experimento/ciclo8-delta-coalescing
git stash pop
# o si querés mantener stash: git stash apply stash@{0}
```
Si preferís quedarte en prueba/upstream-p0p1 y traer el dirty allí: `git stash apply stash@{0}` (no hace pop, deja stash para volver).
Verificación tras pop: `git status --short` debe volver a mostrar M bun.lock + los 9 M restantes + untracked igual.

## 4-field report (canonical)

## Decision Taken
Rama prueba/upstream-p0p1 creada desde d7a921e41e con 4 cherry-picks -x aplicados limpio en orden sin conflictos.

## Files Changed
bun.lock, packages/core/package.json, packages/core/src/filesystem/search.ts, packages/core/src/npm.ts, packages/core/test/npm.test.ts, packages/opencode/package.json, packages/opencode/src/session/message-v2.ts | git log -6: 28e86ece6e, 596732d2b9, ae1c419ae8, ff445020ef, d7a921e41e, 5c904cfef9

## Key Findings
1. [LOW] typecheck packages/core: PASS (tsgo --noEmit EXIT 0) — Evidence: bun typecheck en packages/core — Recommendation: ok
2. [LOW] typecheck packages/opencode: PASS (tsgo --noEmit EXIT 0) — Evidence: bun typecheck en packages/opencode — Recommendation: ok
3. [LOW] bun test packages/core/test/npm.test.ts: PASS 5/5 — Evidence: 10 expect calls — Recommendation: ok
4. [MEDIUM] bun test packages/opencode/test/plugin/codex.test.ts: 45 pass 1 fail (hook timeout 7s, flaky, no tocado por SHAs) — Evidence: 2 runs idénticos, codex.ts no modificado — Recommendation: investigar flake fuera de este P0P1
5. [LOW] Archivos tocados coinciden con esperado P0P1, P2 codex.ts no tocado — Evidence: git diff --name-only — Recommendation: ok
6. [LOW] No push/commits extra/version bump/docs Zen — Evidence: git log y diff — Recommendation: ok

## Nuance
Restaurar dirty: `git checkout experimento/ciclo8-delta-coalescing && git stash pop` (stash@{0} WIP pre-prueba-p0p1); estás en prueba/upstream-p0p1, original intacta en d7a921e41e; untracked test-yargs*.mjs dejados intactos como pedido; codex.test.ts 1 fail es preexistente/flaky, no bloquea P0P1.
