# Skills Index — opencode vMK

> Catálogo de skills del agente. Actualizado: 2026-06-22.
>
> Una skill es un conjunto de instrucciones especializadas que el agente carga
> cuando el task coincide con su descripción.

## Skills Instaladas

| Skill | Descripción | Prioridad | Estado |
|-------|-------------|-----------|--------|
| [`effect`](.opencode/skills/effect/SKILL.md) | Effect v4 / effect-smol — tipos, schemas, servicios, testing | core | ✅ Activa |

## Skills Referenciadas en Protocolo (roadmap)

Skills mencionadas en `AGENTS.md` que aún no están instaladas. Priorizadas por
impacto:

| Prioridad | Skill | Uso en Protocolo | Estado |
|-----------|-------|------------------|--------|
| P0 | `quality-gate` | Pre-commit quality — TDD, secrets, conventional commits | 📋 Pendiente |
| P0 | `commit-crafter` | Conventional commits desde diff analysis | 📋 Pendiente |
| P0 | `triple-verify` | Triple verificación antes de cambios | 📋 Pendiente |
| P1 | `karpathy-prompt` | Prompts ultra-concisos (50-300 tokens) | 📋 Pendiente |
| P1 | `karpathy-loop` | Iterative prompt optimization | 📋 Pendiente |
| P1 | `lean-context` | Compresión de contexto | 📋 Pendiente |
| P1 | `judgment-day` | Dual adversarial code review | 📋 Pendiente |
| P1 | `code-review-agent` | 4R code review (Risk/Readability/Reliability/Resilience) | 📋 Pendiente |
| P1 | `immune-system` | Anti-pattern detection + auto-corrección | 📋 Pendiente |
| P2 | `caveman` | Token budget optimization | 📋 Pendiente |
| P2 | `session-resume` | Safe session resume — git state + Engram | 📋 Pendiente |
| P2 | `code-memory` | Multi-session memory handoff | 📋 Pendiente |
| P2 | `recovery-protocol` | Stop-diagnose-correct-learn para errores de agente | 📋 Pendiente |
| P2 | `self-improvement` | Continuous improvement cycle con inter(30) | 📋 Pendiente |
| P2 | `metricas` | Before/after comparison con delta y % | 📋 Pendiente |
| P2 | `auto-metrics` | Post-task self-evaluation | 📋 Pendiente |
| P3 | `sdd-init` | Bootstrap SDD project context | 📋 Pendiente |
| P3 | `sdd-explore` | Investigación de codebase pre-diseño | 📋 Pendiente |
| P3 | `sdd-propose` | Change proposals con scope y risks | 📋 Pendiente |
| P3 | `sdd-design` | Technical design documents | 📋 Pendiente |
| P3 | `sdd-spec` | Specs con Given/When/Then | 📋 Pendiente |
| P3 | `sdd-tasks` | Descomposición en tareas implementables | 📋 Pendiente |
| P3 | `sdd-apply` | Implementación spec-first con TDD | 📋 Pendiente |
| P3 | `sdd-verify` | Validación contra specs | 📋 Pendiente |
| P3 | `sdd-archive` | Archive + rollback snapshots | 📋 Pendiente |
| P3 | `skill-creator` | Crear nuevas skills del agente | 📋 Pendiente |
| P3 | `senior-engineer` | Senior engineering competencies | 📋 Pendiente |
| P4 | `project-mapper` | Scan + detect stack + dependency map | 📋 Pendiente |
| P4 | `security-scanner` | Security audit de skills | 📋 Pendiente |
| P4 | `bitacora` | Historical log + BITACORA.md | 📋 Pendiente |
| P4 | `context-watchdog` | Context window monitoring | 📋 Pendiente |
| P4 | `chained-pr` | Stacked sequential PRs | 📋 Pendiente |
| P4 | `delivery-harness` | Multi-agent orchestration | 📋 Pendiente |
| P4 | `subagent-isolation` | Clean context boundaries | 📋 Pendiente |
| P4 | `dreaming` | Cross-session pattern extraction | 📋 Pendiente |
| P4 | `skill-digestion` | Load only critical sections | 📋 Pendiente |
| P4 | `skill-improver` | Audit + improve skills | 📋 Pendiente |
| P4 | `skill-testing` | Test skill quality | 📋 Pendiente |
| P4 | `doc-sync` | Sync documentation | 📋 Pendiente |
| P4 | `go-testing` | Go testing patterns | 📋 Pendiente |
| P4 | `research` | Structured research workflow | 📋 Pendiente |
| P4 | `work-unit-commits` | Plan commits as work units | 📋 Pendiente |
| P4 | `comment-writer` | Warm, direct collaboration comments | 📋 Pendiente |
| P4 | `prompt-engineering` | SPEARS framework | 📋 Pendiente |
| P4 | `cognitive-doc-design` | Design docs with low cognitive load | 📋 Pendiente |
| P4 | `decision-capture` | Capture technical decisions | 📋 Pendiente |
| P4 | `command-wrapper` | Safe command execution | 📋 Pendiente |
| P4 | `self-reflection` | Hermes closed learning loop | 📋 Pendiente |
| P4 | `execution-mode` | Auto-detect QUICK/THOROUGH/DRAFT | 📋 Pendiente |

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
