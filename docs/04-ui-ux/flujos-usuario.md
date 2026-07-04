# Flujos de Usuario — TUI Audit

Fecha: 2026-07-03
Auditor: subagente (read-only)

## Resumen

Total: 24 | Altos: 3 | Medios: 11 | Bajos: 10

---

## Hallazgos

### 1. Onboarding / First-Run Experience

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 1.1 | Medio | packages/tui/src/feature-plugins/home/tips.tsx:41 | No existe un flujo onboarding dedicado. La unica senal de "primer uso" es first() = api.state.session.count() === 0 en tips.tsx, que oculta tips cuando hay 0 sesiones y no hay provider conectado. Un usuario nuevo ve pantalla en blanco con logo + prompt, sin guia inicial. | Implementar una secuencia de onboarding tipo "bienvenida" guiada que muestre tips esenciales o un mini-tutorial al primer inicio. |
| 1.2 | Bajo | packages/tui/src/feature-plugins/home/footer.tsx:10-25 | El footer muestra directorio, estado MCP y version. Sin mensajes de ayuda contextual para nuevo usuario. | Agregar hint sutil tipo "Press Ctrl+P for commands" en el home cuando no hay sesiones. |
| 1.3 | Medio | packages/tui/src/routes/home.tsx:17-20 | El placeholder del prompt en home tiene 3 ejemplos hardcodeados: "Fix a TODO", "What is the tech stack?", "Fix broken tests". Estos rotan pero no son contextuales al proyecto actual. | Hacer los placeholders dinamicos segun el proyecto detectado (ej. "Run tests" si hay package.json con test script). |
| 1.4 | Bajo | packages/tui/src/component/startup-loading.tsx:8 | Pantalla de carga inicial: "Loading plugins..." y "Finishing startup...". Aparece tras 500ms de startup. Sin barra de progreso, solo texto + spinner. | Considerar agregar indicador de progreso por pasos (1/3, 2/3, 3/3) o un mensaje mas descriptivo si el startup se alarga. |

### 2. Manejo de Errores

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 2.1 | Bajo | packages/tui/src/util/error.ts:34 | Errores de inicializacion de provider se muestran como inline cliErrorMessage y en toast. No hay un patron unificado de captura. | Estandarizar: todos los errores de runtime deberian pasar por Toast.error() o DialogAlert.show(), no mezclar estilos. |
| 2.2 | Alto | packages/tui/src/component/error-component.tsx:11-241 | Crash screen robusta: stack trace scrolleable, botones Copy report / Restart / Quit, colores segun modo dark/light, fallback palette si el theme crasheo. Construye URL de GitHub issue pre-rellenada. Buen manejo. | Sin cambios -- excelente implementacion. |
| 2.3 | Medio | packages/tui/src/ui/dialog-alert.tsx:59-66 | DialogAlert.show() retorna Promise<void>. OK para notificaciones. Pero errores inesperados no tienen un "Report" button como el crash screen. | Para errores no-fatales del runtime, considerar agregar un boton "Copy error details" similar al crash screen. |
| 2.4 | Bajo | packages/tui/src/ui/toast.tsx:61-68 | Toast timer default 5000ms. No hay "sticky" toast para errores graves; todos se auto-dismiss. | Errores criticos (provider desconectado, sync fail) podrian usar duration: 0 (sticky hasta dismiss manual). |
| 2.5 | Medio | packages/tui/src/routes/session/index.tsx:334-343 | Error al cargar sesion -> toast "Session not found" + navigate home. Buen fallback pero el usuario pierde contexto sin explicacion. | Agregar DialogAlert.show() con detalle del error antes de redirigir, para que el usuario entienda que paso. |
| 2.6 | Medio | packages/tui/src/component/dialog-session-delete-failed.tsx:63-68 | Dialogo de recovery para sesion con workspace no disponible: da opciones "Delete workspace" y "Restore to new workspace". Bien disenado pero solo aparece en session list, no inline en sesion. | Considerar mostrar este dialogo automaticamente al intentar abrir una sesion huerfana. |

### 3. Loading States y Feedback de Progreso

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 3.1 | Medio | packages/tui/src/component/spinner.tsx:8-24 | Spinner animado con frames braille (10 frames, 80ms intervalo). Soporta animations_enabled kv -> fallback a "..." estatico. Buen diseno. Pero no hay spinner global para operaciones largas (sync inicial, etc.). | Agregar un "global progress" sutil (ej. barra superior tipo VSCode) para operaciones que duran >2s. |
| 3.2 | Bajo | packages/tui/src/component/startup-loading.tsx:46 | Delay de 500ms antes de mostrar spinner de startup para evitar flicker. Buen patron. El ready-state espera 3s minimo antes de ocultar. | Considerar reducir hold time a 1.5s para usuarios con startup rapido. |
| 3.3 | Bajo | packages/tui/src/routes/session/index.tsx:1209-1211 | "Loading session..." spinner con texto simple. Sin indicador de progreso. | Agregar paso actual (ej. "Loading session... (fetching workspace data)"). |
| 3.4 | Medio | packages/tui/src/routes/session/index.tsx:241-250 | El pending memo para mensajes usa msg.id > completedID para strings. Esto es fragil si los IDs no son valores comparables lexicograficamente. | Usar time.completed en vez de comparacion de strings para determinar el ultimo mensaje completado. |
| 3.5 | Bajo | packages/tui/src/routes/session/index.tsx:1360-1378 | Pending state para mensajes encolados. Se muestra con indicador visual queued() para mensajes cuyo ID > pending. Buen approach. | Considerar agregar un contador "N messages queued" en el status bar. |

### 4. Flujo de Session/Chat

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 4.1 | Alto | packages/tui/src/routes/session/index.tsx:1215-1219 | El scrollbox de mensajes usa scrollTo(scrollHeight) al cargar. No hay virtual scrolling (windowed list). Sesiones largas (>100 mensajes) renderizan todos los nodos DOM del terminal. Esto es problematico para performance y memoria. | Implementar virtual scrolling para mensajes (solo renderizar viewport + buffer). Alternativamente: lazy-render mensajes antiguos. |
| 4.2 | Medio | packages/tui/src/routes/session/index.tsx:1184 | createEffect(on(() => route.sessionID, () => toBottom())) -- scroll al fondo al cambiar de sesion. No recuerda posicion de scroll por sesion. | Store scroll position per sessionID en KV para restaurar posicion al volver. |
| 4.3 | Medio | packages/tui/src/routes/session/index.tsx:366 | Variable scroll: ScrollBoxRenderable mutable fuera del reactive system. El scrolling se maneja con scroll.scrollBy() y scroll.scrollTo() imperativos. Esto funciona pero es fragil. | Considerar abstraer scroll management en un hook reactive que evite mutaciones directas. |
| 4.4 | Bajo | packages/tui/src/routes/session/index.tsx:401-445 | findNextVisibleMessage() usa scroll.getChildren() y posiciones y. Es no-virtual y asume que los children son los messages. Si se agregan otros elementos al scrollbox, se rompe. | Usar IDs de mensajes y estructura de datos dedicada en vez de inspeccionar el arbol de render. |
| 4.5 | Medio | packages/tui/src/routes/session/index.tsx:258 | Sidebar state "auto" | "hide" se guarda en KV. Auto = visible si width > 120. No hay estado "show" forzado. Si el usuario redimensiona la terminal, la sidebar aparece/desaparece automaticamente, lo que puede ser desorientador. | Separar auto de manual: si el usuario explicitamente abrio sidebar, mantener hasta que la cierre explicitamente. |
| 4.6 | Bajo | packages/tui/src/routes/session/index.tsx:1132-1151 | Keybindings de sesion organizados en 4 grupos: session.global, session.global.unfocused, session, y uno para foreground tasks. Buena segmentacion. | Documentar los grupos en help dialog para que usuarios entiendan que bindings aplican en cada modo. |

### 5. Confirmaciones y Acciones Destructivas

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 5.1 | Bajo | packages/tui/src/component/dialog-session-list.tsx:30-33 | Session delete usa patron "press again to confirm" (no dialogo modal). El hint muestra el shortcut configurado. | Buen patron -- considerar usarlo en mas lugares (stash delete, etc.). |
| 5.2 | Medio | packages/tui/src/routes/session/index.tsx:514-517 | Share session usa DialogConfirm.show(). El consentimiento se guarda en KV. Pero no hay confirmation para session.delete (Ctrl+D). | Agregar DialogConfirm antes de eliminar sesion si hay mensajes no guardados o si la sesion tiene costo asociado. |
| 5.3 | Medio | packages/tui/src/routes/session/index.tsx:2697-2706 | Redo (unrevert) usa DialogConfirm.show() con titulo "Confirm Redo". Protegido. Pero undo no tiene confirmacion. | Agregar confirmacion opcional para undo configurable via setting. |
| 5.4 | Bajo | packages/tui/src/ui/dialog-confirm.tsx:19-108 | Dialogo de confirmacion: navegacion con left/right, Enter para confirmar, highlight visual. Clean. | Agregar shortcut para "always confirm" toggle (Shift+Enter para saltar confirmacion en el futuro). |

### 6. Copy/Paste Support

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 6.1 | Medio | packages/tui/src/clipboard.ts:26 | OSC 52 clipboard esta deshabilitado en Windows: "Windows Terminal handles copy natively; OSC 52 can corrupt TUI". Esto significa copy via keyboard shortcut no funciona en Windows. | Investigar alternativa nativa Windows para copy desde el TUI (pwsh Set-Clipboard). |
| 6.2 | Bajo | packages/tui/src/util/selection.ts:26-39 | Selection.copy() extrae texto visible + sintaxis highlight (ANSI stripped). OK. | Considerar preservar syntax coloring en el clipboard como Markdown. |
| 6.3 | Bajo | packages/tui/src/app.tsx:201 | Keybinding { name: "y", ctrl: true, action: "copy-selection" } para copy-on-select. Tambien soporte mouse right-click + selection release. | Documentar que Ctrl+Y copia seleccion. |
| 6.4 | Medio | packages/tui/src/routes/session/index.tsx:134 | messages.copy tiene shortcut <leader>y y session.copy tiene shortcut none (sin bind por defecto). | Asignar shortcut por defecto a session.copy (ej. <leader>c), o documentar que esta disponible en command palette. |

### 7. Scrolling y Navegacion

| # | Severidad | Archivo:Linea | Descripcion | Recomendacion |
|---|---|---|---|---|
| 7.1 | Medio | packages/tui/src/util/scroll.ts:8-27 | Scroll acceleration configurable: scroll_acceleration (MacOS-style inertial) o scroll_speed (custom speed). Default speed = 3. No hay smooth scrolling. | Para terminales que lo soporten, considerar smooth scrolling via escape sequences. |
| 7.2 | Bajo | packages/tui/src/routes/session/index.tsx:133-141 | Scroll commands: page up/down, line up/down, half page, first/last message. Todos tienen default shortcuts (Ctrl+Alt+{B,F,Y,E,U,D}, Home/End). | Considerar agregar messages_next/messages_previous shortcuts por defecto (actualmente none). |
| 7.3 | Medio | packages/tui/src/routes/session/index.tsx:1217-1218 | Scrollbar visibility toggle (kv scrollbar_visible, default false). Cuando esta activo, padding right = 1. Sin scrollbar, el usuario no tiene indicacion de posicion en sesiones largas. | Activar scrollbar por defecto, o mostrar indicador de posicion tipo "3/47 messages". |

---

## Resumen de Severidad

| Tipo | Cantidad |
|---|---|
| Alto | 3 |
| Medio | 11 |
| Bajo | 10 |
| **Total** | **24** |