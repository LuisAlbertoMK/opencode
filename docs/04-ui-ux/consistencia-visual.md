# Consistencia Visual TUI -- Audit

Fecha: 2026-07-03
Auditor: subagente (read-only)

## Resumen

Total: 20 | Altos: 2 | Medios: 11 | Bajos: 7

---

## Hallazgos

### 1. Sistema de Theming

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 1.1 | Bajo | packages/tui/src/theme/index.ts:69-91 | Theme interface bien definida con ~40 propiedades de color incluyendo: foregrounds, backgrounds, borders, diff colors, syntax colors, markdown, y thinkingOpacity. Sistema completo. | Sin cambios -- el sistema de theming es maduro. |
| 1.2 | Medio | packages/tui/src/theme/index.ts:96-113 | selectedForeground() usa fallback heuristico: si _hasSelectedListItemText no esta definido, usa background como foreground (lo que puede dar contraste bajo). La logica es compleja para un simple color de texto seleccionado. | Simplificar: requerir selectedListItemText en todos los temas, eliminar fallback. |
| 1.3 | Bajo | packages/tui/src/theme/index.ts:354-365 | generateSystem() crea tema automatico desde colores ANSI del terminal. Soporta dark/light detection. Buen feature para usuarios sin tema personalizado. | Sin cambios. |
| 1.4 | Medio | packages/tui/src/context/theme.tsx:257-267 | Acceso al theme: store.themes[store.active] con fallback a store.themes.opencode!. La asercion non-null (!) puede fallar si opencode.json no esta cargado. | Usar ?? fallback a un tema hardcodeado en vez de non-null assertion. |

### 2. Consistencia de Estilo entre Componentes

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 2.1 | Medio | packages/tui/src/ui/dialog-alert.tsx:42-53 | DialogAlert: boton "ok" con primary color + selectedListItemText. | Sin cambios -- consistente con otros dialogos. |
| 2.2 | Medio | packages/tui/src/ui/dialog-confirm.tsx:69-88 | DialogConfirm: botones "cancel"/"confirm". El activo tiene primary background, el inactivo no tiene background. selectedListItemText para activo, textMuted para inactivo. | Considerar que el boton inactivo tenga un background sutil (backgroundElement) para mejor visibilidad. |
| 2.3 | Alto | packages/tui/src/component/error-component.tsx:19-42 | ErrorComponent define su propia palette hardcodeada (light/dark) en vez de usar el ThemeContext. Esto es intencional (el theme puede haber crasheado), pero significa duplicacion manual de colores. | Centralizar los colores de fallback en un archivo compartido para mantener sincronizados ambos sets. |
| 2.4 | Bajo | packages/tui/src/component/spinner.tsx:15-22 | Spinner usa opentui-spinner con <spinner> tag. Design consistente con el ecosistema OpenTUI. | Sin cambios. |
| 2.5 | Medio | packages/tui/src/ui/toast.tsx:23-47 | Toast usa border estilo SplitBorder (left/right). Usa theme.backgroundPanel como fondo. variant controla borderColor (theme[variant] = theme.info/success/warning/error). | Sin cambios -- bien disenado. |

### 3. Text Wrapping y Estilo de Texto

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 3.1 | Alto | .opencode/style-guide.md:100-121 | Regla critica: texto crudo como hijo directo de <box> esta PROHIBIDO. Todo texto debe envolverse en <text>. Esta regla existe pero hay 30+ violaciones en el codebase (detectadas parcialmente). | Ejecutar el test de orphan-text antes de cada commit (ya existe: bun test test/static/orphan-text.test.ts). Agregar CI gate. |
| 3.2 | Bajo | packages/tui/src/ui/toast.tsx:44 | Toast usa wrapMode="word" para el mensaje. Bueno para evitar overflow. | Sin cambios. |
| 3.3 | Medio | packages/tui/src/routes/session/index.tsx:1693 | Mensajes de tool tienen wrapMode="none" (no word wrap). En terminales angostas, el contenido puede cortarse. | Usar wrapMode="word" para tool output a menos que diffWrapMode = "none". |
| 3.4 | Medio | packages/tui/src/component/prompt/autocomplete.tsx:774 | Autocomplete items con wrapMode="none". Si la sugerencia es mas ancha que la terminal, se corta sin indicacion. | Agregar truncate con ellipsis o tooltip expandible. |
| 3.5 | Bajo | packages/tui/src/routes/session/permission.tsx:68 | Permission diff viewer usa wrapMode="word" para diffs. Los diffs pueden ser anchos. | Considerar wrapMode="char" como opcion (configurable via diffWrapMode). |

### 4. Responsive / Terminal Size Handling

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 4.1 | Medio | packages/tui/src/routes/home.tsx:33-36 | promptMaxWidth: "auto" = max(75, width*0.7). En terminales de 80 columnas -> 75. En terminales de 40 columnas -> 28. Buen responsive. | Sin cambios. |
| 4.2 | Medio | packages/tui/src/routes/session/index.tsx:274-282 | Sidebar: "auto" = visible cuando width > 120. contentWidth ajusta restando 42 (sidebar) + 4 (padding). Buen responsive. | 120 es un threshold razonable pero alto: considerar 100 para terminales medianas. |
| 4.3 | Bajo | packages/tui/src/component/error-component.tsx:96-98 | ErrorComponent: contentWidth = min(84, max(24, width-4)). showSubtext si height >= 18, showFooter si height >= 20. Buen responsive. | Sin cambios. |
| 4.4 | Medio | packages/tui/src/feature-plugins/system/diff-viewer.tsx:41-43 | Diff viewer: split view si width > 120, unified si no. | Sin cambios -- buena decision de diseno. |
| 4.5 | Bajo | packages/tui/src/routes/session/permission.tsx:41-42 | Permission dialog: mismo threshold 120 para split vs unified. | Centralizar la constante 120 en un lugar compartido. |
| 4.6 | Medio | packages/tui/src/ui/dialog.tsx:23-26 | Dialog width: medium=60, large=88, xlarge=116. maxWidth=dimensions().width-2. No hay "small" size. | Agregar tamano "small" (40) para dialogos simples (confirm, alert). |

### 5. Styling Approach / Ink+SolidJS Patterns

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 5.1 | Bajo | Context/theme.tsx:276-281 | Theme se expone via Proxy que delega a values() memo. Esto permite acceso directo a theme.text, theme.primary, etc. sin .() . Elegante pero oculta la reactividad. | Considerar agregar un lint rule que marque theme.X fuera de JSX como posible bug (no reactive si se guarda en variable). |
| 5.2 | Medio | packages/tui/src/component/prompt/index.tsx:1603 | Comentario "defensive wrap - prevent orphan text if hint is a string". Esto sugiere que el sistema de tipos no atrapa el error de raw text en <box>. | El style-guide.md ya documenta esto. Reforzar con linting automatizado. |
| 5.3 | Medio | packages/tui/src/component/prompt/index.tsx:456-474 | Logica de "virtual text" en el prompt input: manipula extmarks (marcas sinteticas en el textarea). Codigo fragil con manipulacion directa de source.text.value. | Extraer a un helper con tests unitarios. |
| 5.4 | Medio | packages/tui/src/ui/dialog-select.tsx:225-234 | DialogSelect: height = min(rows(), floor(dimensions().height / 2) - 6). Si hay 200 opciones, renderiza 200 filas (no virtual). | Implementar virtual scrolling para listas largas en dialog-select. |
| 5.5 | Medio | packages/tui/src/component/dialog-session-list.tsx:30-31 | Session list usa debounced search (150ms) con createDebouncedSignal. Pero el resource fetch usa limit:30. Si hay >30 resultados, el usuario solo ve 30 sin paginacion visible. | Agregar indicador "Showing 30 of N results -- refine search" cuando hay mas resultados. |

### 6. Border y Decorators

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 6.1 | Bajo | packages/tui/src/ui/border.ts | SplitBorder: usa "|" (vertical) para borders left/right. EmptyBorder para esquinas vacias. Consistente en toda la app. | Sin cambios. |
| 6.2 | Bajo | packages/tui/src/ui/link.tsx | Componente Link: clickeable, abre URL en browser nativo. Styled con theme.primary. | Sin cambios. |

### 7. Keyboard Shortcuts y Help

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 7.1 | Medio | packages/tui/src/config/keybind.ts:46-238 | Gran sistema de keybindings: 90+ definiciones con defaults sensatos. Soporta leader key (Ctrl+X), which-key, y binding overrides por usuario. Sistema maduro. | Sin cambios -- excelente implementacion. |
| 7.2 | Medio | packages/tui/src/ui/dialog-help.tsx:6-39 | DialogHelp: minimal -- solo dice "Press Ctrl+P to see all available actions". No lista shortcuts comunes. | Expandir help dialog para mostrar shortcuts esenciales (navegacion, edicion, sesion) con categorias. |
| 7.3 | Medio | packages/tui/src/feature-plugins/system/which-key.tsx | Which-key panel: overlay y dock mode, tabs por grupo, busqueda. Sistema Vim-like completo. | Sin cambios -- robusto. |
| 7.4 | Bajo | packages/tui/src/keymap.tsx:112-117 | Key aliases: enter->return, esc->escape, pgdn->pagedown, pgup->pageup. Buen UX para usuarios. | Sin cambios. |

---

## Resumen de Severidad

| Tipo | Cantidad |
|---|---|
| Alto | 2 |
| Medio | 11 |
| Bajo | 7 |
| **Total** | **20** |