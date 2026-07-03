# Skills Index — opencode vMK

> Catálogo de skills del agente. Actualizado: 2026-07-02.
>
> Una skill es un conjunto de instrucciones especializadas que el agente carga
> cuando el task coincide con su descripción.
>
> La mayoría de las skills están instaladas colectivamente en `.vmk-config/skills/`
> (symlink a gentleman-agent-gh). Este índice solo lista las skills locales a opencode.

## Skills Instaladas

| Skill | Descripción | Prioridad | Estado |
|-------|-------------|-----------|--------|
| [`effect`](.opencode/skills/effect/SKILL.md) | Effect v4 / effect-smol — tipos, schemas, servicios, testing | core | ✅ Activa |
| [`codebase-memory`](https://github.com/anomalyco/opencode) | Graph-augmented code search — MCP server integrado | core | ✅ Activa |
| — | **68 skills en `.vmk-config/skills/`** (P0-P4) | todas | ✅ Colectivas |

### Skills P0 (críticas) — ya instaladas en `.vmk-config/skills/`

| Skill | Descripción |
|-------|-------------|
| `quality-gate` | Pre-commit quality — TDD, secrets, conventional commits |
| `commit-crafter` | Conventional commits desde diff analysis |
| `triple-verify` | Triple verificación antes de cambios |

### Skills P1-P4 — instaladas en `.vmk-config/skills/`

Incluyen: `code-review-agent`, `immune-system`, `lean-context`, `judgment-day`,
`karpathy-loop`, `session-resume`, `code-memory`, `recovery-protocol`,
`self-improvement`, `metricas`, `auto-metrics`, SDD completo (init→archive),
`skill-creator`, `project-mapper`, `security-scanner`, `bitacora`,
`context-watchdog`, `delivery-harness`, `subagent-isolation`, `dreaming`,
`skill-digestion`, `skill-improver`, `skill-testing`, `doc-sync`, `go-testing`,
`research`, `work-unit-commits`, `comment-writer`, `prompt-engineering`,
`cognitive-doc-design`, `command-wrapper`, `execution-mode`,
`performance`, `performance-tracker`, `seo`, `caveman`,
`development-mode`, `external-auditor`, `gap-analysis`,
`opencode-model-router`, `python-async`, `refactoring-planner`,
`senior-engineer`, `web-quality-audit`, `accessibility`, `best-practices`,
`baseline-ui`, `ci-cd`, `branch-pr`, `chained-pr`, `issue-creation`,
`external-improvement`, `decision-capture`, `self-reflection`, `skill-graph`,
`sdd`, `sdd-onboard`, `skill-registry`.

## Skills NO Instaladas (gap real)

| Skill | Propósito | Prioridad |
|-------|-----------|:---------:|
| `core-web-vitals` | Core Web Vitals optimization | Baja |
| — | Todas las demás skills del roadmap están cubiertas | — |

## Commands Instalados

| Command | Propósito | Estado |
|---------|-----------|--------|
| `ai-deps` | Gestión de dependencias AI | ✅ Activo |
| `changelog` | Generar changelog | ✅ Activo |
| `commit` | Crear commits | ✅ Activo |
| `issues` | Manejo de issues | ✅ Activo |
| `learn` | Aprendizaje | ✅ Activo |
| `rmslop` | Cleanup de slop | ✅ Activo |
| `spellcheck` | Corrección ortográfica | ✅ Activo |
| `translate` | Traducción | ✅ Activo |

## Tools Personalizadas

| Tool | Propósito | Estado |
|------|-----------|--------|
| `github-pr-search` | Búsqueda de PRs en GitHub | ⚠️ Deshabilitada en config |
| `github-triage` | Triage automation | ⚠️ Deshabilitada en config |

## Plugins TUI

| Plugin | Propósito | Estado |
|--------|-----------|--------|
| `tui-smoke` | Smoke test modal/screen | ✅ Activo |

## Cómo Usar Este Índice

- El agente carga skills automáticamente cuando el task coincide con la
  descripción de la skill.
- Las skills P0-P1 son las que más impacto tienen en la calidad del agente.
- Para crear una nueva skill: seguir el formato de `effect/SKILL.md` como
  referencia.
