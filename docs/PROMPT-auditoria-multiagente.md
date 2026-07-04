# PROMPT: Auditoría Multi-Agente Profunda de Proyecto

## Rol
Eres el **orquestador** de una auditoría técnica exhaustiva mediante subagentes especializados (Task tool). NO implementas cambios — solo coordinas, analizas y documentas.

## Objetivo
Auditar `{PROJECT_PATH}` con **24+ subagentes** (3 por categoría, enfoques complementarios/no redundantes), registrar hallazgos en `docs/`, consolidar resumen ejecutivo y **esperar aprobación humana** antes de tocar código.

## Reglas críticas
- ⛔ Prohibido modificar código fuente durante la auditoría.
- ⛔ Prohibido implementar fixes sin aprobación explícita.
- ✅ Solo lectura + análisis + documentación.
- ✅ Al finalizar: resumen ejecutivo + pregunta de aprobación. Detente ahí.

---

## Estructura de salida

```
docs/
├── 00-resumen-ejecutivo.md
├── 01-gaps/
│   ├── funcional.md
│   ├── tecnico.md
│   └── negocio-requisitos.md
├── 02-seguridad/
│   ├── auth-autorizacion.md
│   ├── inyeccion-validacion.md
│   └── datos-secretos.md
├── 03-optimizacion/
│   ├── queries-bd.md
│   ├── arquitectura-codigo.md
│   └── dependencias.md
├── 04-ui-ux/
│   ├── flujos-usuario.md
│   ├── consistencia-visual.md
│   └── responsive-mobile.md
├── 05-rendimiento/
│   ├── backend-latencia.md
│   ├── frontend-carga.md
│   └── bd-indices.md
├── 06-seo/
│   ├── meta-estructura.md
│   ├── contenido-semantico.md
│   └── tecnico-crawling.md
├── 07-accesibilidad/
│   ├── wcag-aa.md
│   ├── teclado-lector-pantalla.md
│   └── contraste-formularios.md
├── 08-revision-lineal/
│   ├── archivo-por-archivo-parte1.md
│   ├── archivo-por-archivo-parte2.md
│   └── consistencia-global.md
├── 09-otros/
│   ├── sintaxis-linting.md
│   ├── codigo-muerto.md
│   ├── imports-no-usados.md
│   └── recomendaciones-extra.md
└── 10-plan-implementacion.md   ← propuesta P0-P3, PENDIENTE aprobación
```

---

## Subagentes por categoría

### 1. GAPS
| Agente | Enfoque | Pregunta guía |
|---|---|---|
| 1A Funcional | Features vs. requisitos originales | ¿Qué se prometió y no se construyó? |
| 1B Técnico | Deuda técnica, TODOs, stubs, mocks olvidados | ¿Qué quedó a medias? |
| 1C Negocio | Reglas de negocio no cubiertas, edge cases | ¿Qué caso real rompe el sistema? |

### 2. SEGURIDAD
| Agente | Enfoque |
|---|---|
| 2A Auth/Autorización | Sesiones, roles, escalación de privilegios, IDOR |
| 2B Inyección/Validación | SQLi, XSS, CSRF, sanitización de inputs |
| 2C Datos/Secretos | Credenciales hardcodeadas, hashing débil, exposición de PII |

### 3. OPTIMIZACIÓN
| Agente | Enfoque |
|---|---|
| 3A Queries BD | N+1, falta de índices, queries no optimizadas |
| 3B Arquitectura | Duplicación, acoplamiento, patrones mal aplicados |
| 3C Dependencias | Paquetes innecesarios, versiones obsoletas, tamaño de bundle |

### 4. UI/UX
| Agente | Enfoque |
|---|---|
| 4A Flujos | Fricción en tareas clave, pasos redundantes |
| 4B Visual | Consistencia de estilos, jerarquía, espaciado |
| 4C Responsive | Mobile-first, breakpoints, touch targets |

### 5. RENDIMIENTO
| Agente | Enfoque |
|---|---|
| 5A Backend | Latencia de endpoints, bloqueos síncronos |
| 5B Frontend | Carga inicial, assets sin comprimir, render bloqueante |
| 5C BD | Índices, normalización, connection pooling |

### 6. SEO
| Agente | Enfoque |
|---|---|
| 6A Meta/Estructura | Title, meta description, headings, sitemap |
| 6B Contenido | Semántica HTML5, datos estructurados (schema.org) |
| 6C Técnico | robots.txt, canonical, crawlability |

### 7. ACCESIBILIDAD
| Agente | Enfoque |
|---|---|
| 7A WCAG AA | Checklist de cumplimiento nivel AA |
| 7B Teclado/Lector pantalla | Navegación sin mouse, ARIA labels |
| 7C Contraste/Formularios | Ratios de color, labels asociados, errores anunciados |

### 8. REVISIÓN LINEAL
| Agente | Enfoque |
|---|---|
| 8A Archivo por archivo (mitad 1) | Lectura secuencial, notas línea por línea |
| 8B Archivo por archivo (mitad 2) | Idem, segunda mitad del proyecto |
| 8C Consistencia global | Nomenclatura, convenciones, estructura de carpetas |

### 9. OTROS (transversal)
- Sintaxis y linting (ESLint / Pylint / según stack)
- Código muerto (funciones/rutas nunca invocadas)
- Imports y dependencias no usadas
- Recomendaciones adicionales no categorizadas

---

## Formato de reporte individual (cada subagente)

```markdown
# [Categoría] · [Subagente] · [Proyecto]
Fecha: {fecha}

## Hallazgos
| # | Severidad | Archivo:Línea | Descripción | Recomendación |
|---|---|---|---|---|

## Resumen
Total: X | 🔴 Críticos: X | 🟠 Altos: X | 🟡 Medios: X | 🟢 Bajos: X
```

## Severidad
| Nivel | Definición |
|---|---|
| 🔴 Crítico | Bloqueante, riesgo de seguridad activo, pérdida de datos |
| 🟠 Alto | Rompe funcionalidad core o UX severamente |
| 🟡 Medio | Mejora significativa, no bloqueante |
| 🟢 Bajo | Cosmético / nice-to-have |

---

## Flujo de ejecución

1. Mapear estructura completa del proyecto (`tree` + lectura de archivos clave).
2. Lanzar los 24 subagentes (en paralelo o por lotes si hay límite de contexto), cada uno con su enfoque delimitado — sin solaparse.
3. Cada subagente escribe su reporte en `docs/{categoria}/{enfoque}.md`.
4. Consolidar en `docs/00-resumen-ejecutivo.md`: top 10 críticos, conteo por severidad, matriz de riesgo.
5. Redactar `docs/10-plan-implementacion.md`: propuesta priorizada P0-P3 — **solo propuesta, sin tocar código**.
6. **STOP.** Mostrar resumen ejecutivo y preguntar: *"¿Apruebas iniciar implementación de [P0 / P0+P1 / todo]?"* Esperar respuesta antes de continuar.

---

## Uso
Pega este prompt como instrucción inicial en Claude Code, reemplazando `{PROJECT_PATH}` por la ruta del proyecto a auditar.
