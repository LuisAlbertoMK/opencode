# Código Muerto / Imports No Usados

Fecha: 2026-07-03
Auditor: subagente (read-only)

## Hallazgos

| # | Severidad | Archivo:Línea | Descripción | Recomendación |
|---|---|---|---|---|
| 1 | 🟡 Medio | packages/core/src/session/runner/index.ts:1 | export * as SessionRunner from "./index" — self-re-export del mismo archivo. Si el módulo runner/index.ts solo reexporta SessionRunner, todo lo que exporta es este namespace circular. De hecho el archivo exporta la clase Service, StepLimitExceededError, etc., pero el self-reexport envuelve todo en un namespace que apunta a sí mismo. No es técnicamente dead code pero es un antipatrón que puede confundir a consumidores. | Verificar que el patrón self-reexport es intencional por convención de módulos (ver AGENTS.md). Si es así, considerar mover la lógica a un archivo sibling en vez de index.ts para evitar la circularidad. |
| 2 | 🟡 Medio | packages/core/src/system-context/index.ts:1 | export * as SystemContext from "./index" — mismo self-reexport circular que el runner. | Misma recomendación que #1. |
| 3 | 🟢 Bajo | packages/core/src/public/index.ts:8 | export { Prompt } from "../session/prompt" — se exporta Prompt en la API pública core. Sin embargo, Prompt es un Schema.Class de Effect/Schema. Se importa en session.ts del mismo public/ (línea 11) pero podría accederse vía subpath. | Evaluar si Prompt necesita ser parte de la API pública estable. Si es solo para uso interno, remover de public/index.ts. |
| 4 | 🟡 Medio | packages/core/src/tool/tool.ts | Definiciones genéricas SchemaType<A> = Schema.Codec<A, any, never, never> y AnyTool = Definition<any, any> — uso extensivo de any que erosiona type safety en toda la tool API pública. | Ver hallazgo de severidad alta en sintaxis-linting.md. |
| 5 | 🟢 Bajo | packages/opencode/src/session/status.ts:43 | Comentario // deprecated sin más contexto en medio del código. | Remover el comentario o documentar qué está deprecated. |
| 6 | 🟢 Bajo | packages/opencode/src/session/instruction.ts:66 | Comentario // deprecated junto a "CONTEXT.md" indicando que el archivo está deprecated como fuente de instrucciones. | Código legacy mantenido intencionalmente — considerar si se puede remover en v2. |
| 7 | 🟢 Bajo | packages/opencode/src/provider/provider.ts:1123,1455 | Filtrado de modelos deprecated en runtime — models con status === "deprecated" se excluyen de listados. | Lógica válida pero worth noting que hay un concepto de "deprecated" que nunca se limpia automáticamente. |
| 8 | 🟠 Alto | packages/plugin/src/tui.ts:89-118 | 5 funciones/keymaps marcados como @deprecated en la API pública de plugins TUI. El shim api.command sigue funcionando para v1 plugins (ver packages/tui/src/plugin/command-shim.ts:15 y packages/tui/src/plugin/adapters.tsx:176). | Establecer fecha de corte para remover el shim en v2. Hay warnings en consola pero sin mecanismo de forced migration. |
| 9 | 🟠 Alto | packages/plugin/src/index.ts:102-219 | 5 miembros del hook API @deprecated: configure, create, remove, target (todos reemplazados por when), y AuthOAuthResult (reemplazado). | Ídem #8 — coordinar remoción en v2. |
| 10 | 🟡 Medio | packages/opencode/src/plugin/loader.ts:20,79,161 | Manejo de deprecated: boolean para plugins — plugins deprecated se saltan el loading con return { retry: false }. | Este código muerto condicional es válido pero worth auditing cuántos plugins deprecated existen. |
| 11 | 🟢 Bajo | packages/core/src/v1/config/config.ts:49,62,92,124 | Múltiples campos @deprecated en schemas V1: references, share, agent, layout. Son schemas de compatibilidad V1 que se mantienen para migración. | Código legacy necesario — considerar remover cuando se deprecie V1 por completo. |
| 12 | 🟡 Medio | packages/opencode/src/cli/effect-cmd.ts:30,59 | Comentarios refiriendo a "legacy bootstrap() finally-disposal semantics". El código actual usa Effect.ensuring(store.dispose(ctx)) como alternativa. | Si la migración está completa, remover los comentarios legacy. |
| 13 | 🟢 Bajo | packages/opencode/src/share/share-next.ts:94,219 | legacyApi fallback — si no hay cuenta org activa, usa la API legacy de share. | Código legacy necesario mientras existan cuentas sin org activa. |
| 14 | 🟡 Medio | packages/opencode/src/config/config.ts:283-293 | Migración legacy TOML a JSON: lee archivo TOML legacy y luego lo borra. | Migración one-shot que ya no se ejecutará en instalaciones nuevas. Considerar remover después de un periodo de gracia. |
| 15 | 🟢 Bajo | packages/core/src/session/runner/llm.ts:40 | Comentario "Keep this as orchestration over smaller collaborators rather than rebuilding the legacy ..." | Documentación de diseño, no action needed. |
| 16 | 🟡 Medio | packages/opencode/src/server/routes/instance/httpapi/public.ts:79-148 | Múltiples referencias a "legacy SDK", "legacy OpenAPI surface", "legacy public OpenAPI metadata" — el servidor HTTP mantiene compatibilidad con SDK v0/v1. | Evaluar si toda la ruta /public es código legacy mantenido solo por compatibilidad. |
| 17 | 🟡 Medio | packages/opencode/src/config/tui-migrate.ts:40 | legacyTui decode de configuración TUI legacy. | Verificar si la migración ya se completó para todos los usuarios. |

## Resumen

Total: 17 | 🔴 Críticos: 0 | 🟠 Altos: 2 | 🟡 Medios: 8 | 🟢 Bajos: 7

### Notas adicionales

- **No existe configuración de linter** (ni eslint, ni biome, ni oxlint config files encontrados en el root del repo). Esto significa que no hay verificación automática de dead code — depende enteramente de tsc y del programador.
- **TypeScript noUnusedLocals: false y noUnusedParameters: false** en la base config @tsconfig/bun. Esto desactiva la detección de código muerto a nivel de compilador.
- El patrón export * as X from "." / export * as X from "./index" se usa extensamente en el codebase (ver AGENTS.md para la convención). Es intencional pero crea namespaces circulares que pueden ocultar exports no usados.
- **No se encontraron imports no utilizados** de @opencode-ai/plugin en otros packages — el plugin package solo es consumido por packages/opencode/src/ y packages/tui/, lo cual es esperado dado que plugin es el SDK de plugins.
- **Archivos packages/core/src/public/**: La API pública exporta 8 símbolos (Agent, Model, OpenCode, Session, Tool, Location, Prompt, AbsolutePath). Son todos usados internamente. Sin embargo, Prompt como export directo desde "../session/prompt" en lugar de desde un namespace Session podría confundir.
