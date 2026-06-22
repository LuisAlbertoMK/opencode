# .learnings

Contexto compartido entre sesiones y desarrolladores. Esto es lo que el equipo aprendió trabajando en el código — decisiones, gotchas, descubrimientos, configuraciones.

## Propósito

- **Handoff entre desarrolladores**: cuando alguien nuevo toma el proyecto, encuentra aquí las lecciones que ya nos costó aprender.
- **Memoria fuera del agente**: no depende de Engram ni de tu sesión local. Está en el repo.
- **Continuidad entre sesiones**: retomás donde dejaste sin tener que re-aprender.

## Formato

Cada archivo es `YYYY-MM-DD-breve-descripcion.md`. Contenido libre pero sugerido:

```markdown
# Sesión: [breve descripción]

## Goal
¿Qué estábamos haciendo?

## Aprendizajes Clave

### [Título del aprendizaje]
- **Qué**: [Lo que aprendimos]
- **Por qué**: [Contexto que lo motiva]
- **Dónde**: [Archivos/componentes afectados]
- **Detalle**: [Explicación del gotcha, decisión o descubrimiento]

## Decisiones
- [Decisión importante con su justificación]

## Pendiente
- [Qué queda por hacer o explorar]
```

## Convenciones

- Primer archivo siempre: `template.md` como referencia.
- Un archivo por sesión lógica (no uno por commit).
- Priorizá claridad sobre formalidad. El objetivo es que otro humano (o agente) lo entienda rápido.
