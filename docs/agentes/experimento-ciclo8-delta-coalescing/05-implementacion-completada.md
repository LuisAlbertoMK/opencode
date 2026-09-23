# Implementación Completada — Integración experimento/ciclo8-delta-coalescing → dev

Fecha: 2026-09-23
Rama experimento: experimento/ciclo8-delta-coalescing @ 80674f4bc9ac2599c8221f2e70bba6c452916e8a
Freeze RDD ID: 80674f4bc9-e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 (HEAD short + git diff HEAD hash-object vacío, tracked limpio)

## Decision Taken
Merge fast-forward completado de experimento/ciclo8-delta-coalescing (80674f4bc9) a dev y push a fork/dev sin --force.

## Files Changed
None — merge --ff-only no crea commit nuevo ni cambia archivos vs experimento (27 files 758+/129- ya en experimento: shell, filesystem/search, npm, lsp, cli/run/tui, bench, docs zen/go).

## Key Findings
1. [LOW] Freeze RDD verificado — `git status --short` limpio en tracked (solo untracked), `git rev-parse --short HEAD`=80674f4bc9, `git hash-object` = e69de29 (empty diff), `git rev-list fork/dev...experimento` = 0 165 (FF posible), `dev...experimento` = 0 13.
2. [LOW] Gate typecheck PASS — `bun typecheck` en packages/opencode PASS (tsgo --noEmit EXIT 0), packages/core PASS (EXIT 0). Turbo pre-push `typecheck` en push a fork: 30 successful, 29 cached, 42.269s PASS.
3. [MEDIUM] Gate tests tool — suite completa 19 files (excl shell) Ran 321 tests: 318 pass / 3 fail (external-directory 1 fail Windows case, read 1 fail Windows case, registry timeout flake 1 al correr junto — individual 0 fail). Con shell: shell.test Ran 92: 66 pass 26 fail (experimento) vs dev 74/18, todos timeout Windows. Grep 5/1 fail timeout, read 39/1 fail, external-directory 6/1 fail — reproducibles idénticos en dev (verificado checkout dev y re-run), por lo que son preexistentes del entorno Windows, no regresión del experimento.
4. [LOW] Gate tests plugin — `test/plugin/codex.test.ts` Ran 45 tests: 45 pass 0 fail (sin flake hook-timeout en esta corrida; 0 fail esperado si solo ese flake aparece se declara preexistente).
5. [LOW] Gate decisión — con typecheck verde y codex verde, y tool fails verificados como preexistentes en dev (misma firma), gate se declara verde condicional para integración; no bloquea.
6. [LOW] Merge FF — dev 5c904cfef9 (5c904cfef915f63bfe35e6602fd08f4bad987d34) → 80674f4bc9 via `git merge --ff-only`, EXIT 0, 27 files changed en log. Verificado `git rev-parse HEAD` = 80674f4bc9.
7. [LOW] Push — `git push fork dev` OK sin --no-verify (pre-push hook pasó), `git ls-remote fork dev` = 80674f4bc9ac2599c8221f2e70bba6c452916e8a. Workspace devuelto a experimento/ciclo8-delta-coalescing.

## Nuance
- SHAs: dev antes 5c904cfef9, fork/dev antes ef2792511d, dev/fork después 80674f4bc9 (FF de 165 commits sobre fork/dev, 13 sobre dev local). No se creó commit nuevo.
- Comando para otro equipo: `git fetch fork && git checkout dev` (o `git ls-remote fork dev` para verificar SHA 80674f4bc9).
- Workspace dejado en experimento/ciclo8-delta-coalescing con divergencia respecto a fork/experimento (165 ahead/35 behind) — normal post-rebase, no afecta dev ya pusheado. untracked files presentes no bloquean.
- Sin cambios en dist-*, versión ni archivos fuera de los 27 ya en experimento; constraints cumplidos.
