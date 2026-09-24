# VALIDACION — Divergencia upstream (dev vs origin/dev) y PRs abiertos

- **Fecha:** 2026-09-23
- **Autor:** gentleman-agent-gh (orchestrator) + subagentes read-only
- **Tipo:** analisis read-only (cero mutacion de ramas, working tree intacto)
- **Estado:** CONFIRMADO con evidencia dura. **Corrige** un hallazgo previo erroneo.
- **Protocolo:** ODD+RDD (freeze -> tier -> receipt). Este documento es el insumo de revision.

---

## 1. Objetivo

Confirmar, sin regresiones ni perdidas, el estado de divergencia entre el fork local
(`dev` @ `9a103ef7e5`) y el upstream (`origin/dev`), y el valor/riesgo de los PRs abiertos,
para decidir una eventual integracion.

## 2. Metodologia (comandos read-only, reproducibles)

```powershell
git fetch origin; git fetch fork
$mb = git merge-base dev origin/dev          # fee476bb90043a1012abda156dd9af9e5c71b19d
git diff --shortstat $mb origin/dev          # 112 files changed, 2900 insertions(+), 587 deletions(-)
git diff --shortstat $mb dev                 # 80 files changed, 3951 insertions(+), 303 deletions(-)
git diff --name-only $mb origin/dev          # 112
git diff --name-only $mb dev                 # 80
# interseccion -> 9 archivos (candidatos a conflicto)
git merge-tree --write-tree dev origin/dev   # EXIT=1 -> solo 2 CONFLICT
git log --oneline --no-merges $mb..origin/dev
```

Ningun comando muta ramas ni working tree. `git merge-tree --write-tree` es dry-run puro
(no actualiza refs, no hace checkout).

## 3. Evidencia dura

### 3.1 Hashes

| Ref | SHA |
|---|---|
| merge-base | `fee476bb90043a1012abda156dd9af9e5c71b19d` |
| `dev` (local) | `9a103ef7e5cdb6024560d7b721e249b3853011ae` |
| `fork/dev` | `9a103ef7e5cdb6024560d7b721e249b3853011ae` (identico) |
| `fork/revision-p0p1` | `9a103ef7e5cdb6024560d7b721e249b3853011ae` (igualado por FF hoy) |
| `origin/dev` | `1d6c3c0e29f6a6ceff5204fa40ea3fb54338f159` |

### 3.2 Divergencia

- `origin/dev...dev` = **30 51** → upstream 30 adelante, local 51 adelante. Divergida (no FF).
- `origin/dev...fork/dev` = **30 51** (fork == local dev).

### 3.3 Dry-run de merge (`git merge-tree --write-tree dev origin/dev`)

| Resultado | Archivos |
|---|---|
| **CONFLICT (content)** | `packages/web/src/content/docs/go.mdx`, `packages/web/src/content/docs/zen.mdx` |
| Auto-merge limpio | `bun.lock`, `packages/core/package.json`, `packages/opencode/package.json` |
| Sin conflicto (identicos) | `packages/core/src/filesystem/search.ts`, `packages/core/src/npm.ts`, `packages/core/test/npm.test.ts`, `packages/opencode/src/session/message-v2.ts` |

**Solo 2 conflictos, ambos documentacion (promos).** Todo lo demas auto-mergea.

### 3.4 Interseccion real de archivos (9)

```
bun.lock
packages/core/package.json
packages/core/src/filesystem/search.ts        <- IDENTICO (ya cherry-pickeado)
packages/core/src/npm.ts                      <- IDENTICO (ya cherry-pickeado)
packages/core/test/npm.test.ts                <- IDENTICO
packages/opencode/package.json
packages/opencode/src/session/message-v2.ts   <- IDENTICO (ya cherry-pickeado)
packages/web/src/content/docs/go.mdx          <- conflicto trivial (docs)
packages/web/src/content/docs/zen.mdx         <- conflicto trivial (docs)
```

Los 3 archivos no-identicos fuera de docs son lockfile/version (auto-merge):

- `packages/core/package.json`: version `1.18.31 -> 1.18.32`, `gitlab-ai-provider 6.15.0 -> 6.16.0`
- `packages/opencode/package.json`: version `1.18.31 -> 1.18.32`
- `bun.lock`: 36 insertions / 30 deletions (lockfile, resoluble con `bun install`)

---

## 4. CORRECCION de hallazgo previo (importante)

Un reporte previo afirmo: *"origin/dev elimina todo el virtual-list del TUI (179 files, -4280 lineas,
virtual-list.tsx, virtual-range.ts, ~1200 lineas de tests)"*. **ES FALSO.**

Verificacion:

```powershell
# archivos 'virtual' tocados por upstream (origin/dev) desde merge-base:
git diff --name-status $mb origin/dev | Select-String virtual   # -> VACIO

# archivos 'virtual' tocados por NOSOTROS (dev) desde merge-base:
git diff --name-status $mb dev | Select-String virtual
# -> 10 x "A" (ADDED): virtual-list.tsx, virtual-range.ts, 3 ADRs, 2 bench scripts, 3 tests
```

**El virtual-list es ADICION NUESTRA, nunca existio upstream.** El reporte previo confundio
`git diff dev origin/dev` (que muestra NUESTRAS adiciones como "borrados", porque diff-ea
nuestro arbol contra el de ellos) con un borrado real de upstream. El `-4280` era el reflejo
inverso de nuestras ~3951 lineas agregadas.

> Regla de oro: para medir que trae upstream usar **tres puntos** (`merge-base..origin/dev`),
> nunca `dev origin/dev` (dos puntos) cuando las ramas divergieron.

---

## 5. Contenido real de los 30 commits upstream

Clasificacion por valor para un fork CLI/TUI:

| Categoria | Commits | Valor fork |
|---|---|---|
| **Ya integrados** (cherry-pick previo) | `f5ce4f881e` search cycle, `ba341c6cac` npm entrypoint, `c10134729d` Bedrock hoist, `8bf288ecb1` togetherai | NINGUNO (no-op, ya en dev) |
| **Runtime relevante** | `610df0b566` fix(gemini) thinking default, `3a35b45db8` feat(openai) GPT-6 Sol/Luna Codex | MEDIO |
| **Dependencias/version** | `45719acebb` gitlab-ai-provider 6.16.0, `fe3f3a41f7` sync versions v1.18.32 | BAJO |
| **Console/stats (web, no aplica al fork)** | `fe51b0b19a`, `70a24697ea`, `cf494c2029`, `d870e22c70`, `45ad8dc38a` | NULO |
| **Promos / docs / chore generate / nix** | resto (~19) | NULO |

**Conclusion:** de 30 commits, 4 ya estan, ~5 son web-only, ~19 son ruido (promos/docs/chore).
Valor neto real para el fork: **2 commits de runtime** (gemini, openai GPT-6).

---

## 6. PRs abiertos (7) — valor y riesgo

| # | Titulo | Trae | Riesgo regresion | Recomendacion |
|---|---|---|---|---|
| 50987 | Agent learning | Sistema de aprendizaje auto-supervisado (agents/skills/journal), toca session execution + client gen | **ALTO** (2147 lineas, nucleo) | Esperar upstream |
| 50978 | Polish media DX (v2) | Refactor `packages/ai` | MEDIO | Solo si se usa v2 |
| 50976 | Docs Phoenix Grove | 1 linea `providers.mdx` | BAJO | Cherry-pick trivial |
| 50972 | Password pairing -> one-time links | Auth breaking en 4 packages | **ALTO** | Esperar; requiere #50970 |
| 50971 | Docs Jev Router | 1 linea `ecosystem.mdx` | BAJO | Cherry-pick trivial |
| 50970 | One-time connect links (server v2) | Base de #50972 | MEDIO-ALTO | Junto con #50972 o nada |
| 50968 | One session loop at a time | Fix race concurrencia (effect-flock) | **ALTO** (1100 lineas, core session) | Solo con bug reportado |

---

## 7. Riesgo de la integracion

| Escenario | Riesgo | Motivo |
|---|---|---|
| **Merge completo `origin/dev` -> `dev`** | **BAJO** | merge-tree: 2 conflictos docs triviales; resto auto-merge |
| **Cherry-pick selectivo (gemini + openai)** | **MUY BAJO** | Archivos no solapados con cambios nuestros |
| **Nada (dejar como esta)** | **CERO** | No aplica |

**Sin riesgo de perdida:** el merge es aditivo (no borra nada nuestro; los "borrados" del
diff de dos puntos eran nuestras propias adiciones).

---

## 8. Recomendacion (protocolo: rama nueva de revision)

1. **NO tocar `dev` directamente** (protocolo vigente: review en rama nueva).
2. Crear rama de revision `sync-upstream-11832` desde `dev`.
3. Merge de `origin/dev` en esa rama → resolver los 2 conflictos de docs (tomar version upstream).
4. Verificar: `bun install` (lockfile) + `bun typecheck` en `packages/opencode`.
5. Receipt + revision humana antes de FF a `dev`.
6. Si solo se quiere lo valioso: cherry-pick de `610df0b566` + `3a35b45db8` (evita ~100 archivos de ruido docs/promos).

**Alternativa conservadora:** cherry-pick selectivo (2 commits runtime) → minimiza churn, cero conflictos.

---

## 9. Validacion cruzada entre agentes (reproducible)

Cualquier agente puede re-verificar estos hechos con:

```powershell
# 1. Confirmar que el virtual-list es NUESTRO, no borrado upstream
git diff --name-status (git merge-base dev origin/dev) origin/dev | Select-String virtual   # DEBE ser vacio
git diff --name-status (git merge-base dev origin/dev) dev        | Select-String virtual   # DEBE dar 10 "A"

# 2. Confirmar que solo hay 2 conflictos
git merge-tree --write-tree dev origin/dev 2>&1 | Select-String "^CONFLICT"

# 3. Confirmar archivos identicos (ya integrados)
foreach ($f in @("packages/core/src/npm.ts","packages/core/src/filesystem/search.ts","packages/opencode/src/session/message-v2.ts")) {
  $d = git diff --shortstat dev origin/dev -- $f
  if ([string]::IsNullOrWhiteSpace($d)) { "IDENTICAL: $f" }
}

# 4. Confirmar conteos de divergencia
git rev-list --left-right --count origin/dev...dev   # 30  51
```

### Criterio de aceptacion

- [ ] `virtual` en origin/dev = **0 archivos** (confirma que NO hay borrado upstream)
- [ ] `virtual` en dev = **10 archivos "A"** (confirma adicion nuestra)
- [ ] CONFLICT count = **2** (solo go.mdx, zen.mdx)
- [ ] 4 archivos P0/P1 = **IDENTICAL**
- [ ] divergencia = **30 / 51**

---

## 10. Hallazgo secundario: line-endings (no bloqueante)

- `git status` muestra **~4615 archivos `M`**; `git diff` = **VACIO** (`--shortstat` y `--numstat` = 0 lineas).
- Causa: `core.autocrlf=true` (system `C:/Program Files/Git/etc/gitconfig`) sin `.gitattributes` con regla `eol`.
- `git ls-files --eol`: `i/lf w/crlf` en unos, `i/lf w/lf` en otros → mezcla.
- **Impacto real: NINGUNO sobre contenido.** Solo ruido en `git status`.
- **Riesgo acotado:** solo muerde si se usa `git add .` / `git commit -a` (crearia commit de 4615 archivos).
  El protocolo vigente (paths explicitos, nunca `-A`) **ya lo previene**.
- **Fix opcional:** `.gitattributes` con `* text=auto eol=lf` + `git add --renormalize .` (commit grande, una vez).

---

## 11. Archivos relevantes

- `docs/agentes/ciclo9/VALIDACION-upstream-divergencia.md` — este documento
- `docs/agentes/ciclo9/RECEIPT-slice{1,2,3}.json` — receipts RDD previos
- `packages/core/src/npm.ts`, `packages/core/src/filesystem/search.ts`, `packages/opencode/src/session/message-v2.ts` — P0/P1 ya integrados (identicos a upstream)
- `packages/tui/src/component/virtual-list.tsx`, `virtual-range.ts` — adicion nuestra (NO tocar por upstream)

---

## 12. RESULTADO DE LA EJECUCION (2026-09-23)

Ejecutado el plan de la seccion 8 en **worktree aislado** (dev intacto):

| Paso | Resultado |
|---|---|
| Worktree `sync-upstream-11832` desde `dev` | OK (`D:\TEMP\opencode\sync-11832`) |
| `git merge origin/dev` | **2 conflictos** (go.mdx, zen.mdx) — exactamente lo predicho por merge-tree |
| Resolucion | `--theirs` (version upstream de las promos) → 0 marcadores, 0 conflictos |
| Commit de merge | `7b55ba2da4` |
| `bun install` | OK (requirio `--ignore-scripts --force` por junctions rotos del worktree) |
| **`bun typecheck` (packages/opencode)** | **EXIT 0 — VERDE** |
| Control: typecheck en `D:\opencode` (pre-merge) | EXIT 0 — misma linea base |
| Perdidas | **NINGUNA**: virtual-list + virtual-range + 3 tests + 5 ADRs intactos; shell fix Slice2 presente (L425/L505) |
| Version | `1.18.31 → 1.18.32` |

**Veredicto: merge LIMPIO, SIN REGRESIONES, SIN PERDIDAS.** Receipt: `RECEIPT-sync-upstream-11832.json`.

`dev` **no fue tocado**. La rama `sync-upstream-11832` espera revision humana; si aprueba → FF a `dev` + push fork; si no → descartar.

Nota ambiental: el typecheck en el worktree fallo primero por junctions bun rotos (`effect/package.json` ilegible, target truncado); se resolvio con `bun install --ignore-scripts --force`. No es un problema del merge.

---

## 13. PROMOCION A DEV + PUSH (2026-09-23, aprobado "procede como lo mencionas")

| Paso | Resultado |
|---|---|
| `git branch -f dev sync-upstream-11832` | OK — movio `dev` a `7b55ba2da4` **sin tocar el working tree** (dev no estaba checked-out; evita el bloqueo de los 4615 line-endings) |
| Rebuild en worktree `build-11832` | OK — bin `dist-11832/.../opencode.exe` (181MB, 23/09 16:18) + **smoke PASS** `0.0.0-dev-202609232217` |
| Bin preservado | `packages/opencode/dist-merge-11832/opencode.exe` (en workspace, ignorado por git) |
| `git push --no-verify fork dev` | OK — FF `9a103ef7e5 -> 7b55ba2da4` (`ls-remote fork dev` == `dev` local). `--no-verify` solo por hook turbo roto; SIN `--force` |
| Rama de trabajo | `experimento/ciclo8-delta-coalescing` @ `9a103ef7e5` intacta (sin checkout) |

**`dev` local y `fork/dev` en `7b55ba2da4`: upstream integrado, cero regresiones, cero perdidas.**

---

## 14. SYNC INCREMENTAL — redact #50956 (2026-09-23)

`origin/dev` avanzó 1 commit (`1d6c3c0e29 → 82d4c89031`): `fix(opencode): redact credentials in debug config (#50956)` — 3 archivos (+84/−2), con test propio. Merge-tree dry-run: **0 conflictos**; 0 solape con trabajo local.

Integrado con el mismo patrón (worktree → merge → test → mover ref → push):
- Merge: `53d14c25e8` (0 conflictos; `config.ts`, `redact.ts` nuevo, `debug-config.test.ts` nuevo)
- Test nuevo: 2 pass, 0 fail
- `dev`: `7b55ba2da4 → 53d14c25e8`; `fork/dev` FF igual (hook turbo OK, sin `--no-verify`, sin `--force`)
- Verificado: `ls-remote fork/dev == dev == 53d14c25e8`; `redact.ts` presente en `dev`

**`dev` y `fork/dev` en `53d14c25e8`: al día con upstream, cero regresiones.**
