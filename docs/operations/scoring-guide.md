# Scoring Guide — opencode vMK

> **Propósito**: Explica las 2 fuentes de score del proyecto, qué mide cada una,
> y cómo reconciliarlas para tomar decisiones.

## Las 2 Fuentes

| Aspecto | `inter-track` (gentleman-agent) | `.project.json` (opencode repo) |
|---------|--------------------------------|----------------------------------|
| **Qué mide** | Actividad del agente (interacciones de mejora) | Salud del proyecto opencode-vMK |
| **Score actual** | 9.8/10 | 8.7/10 |
| **Dims** | Cycle Activity, Project Artifacts, Dead Code, Clean Code, Metrics, Backlog Integrity, Bitacora, Security, Score Depth, Best Practices, Orthography | Mismas 11 dimensiones |
| **Quién lo actualiza** | `inter-track.ps1 -Increment` + `score-auto.ps1` | Manual (humano o agente) |
| **Frecuencia** | Por cada interacción | Por ciclo de mejora |
| **Propietario** | gentleman-agent-gh (skills/scripts) | opencode-vMK (el fork) |

## ¿Por qué Difieren?

`inter-track` mide la **actividad del agente** sobre el proyecto — cuántas
interacciones de mejora se ejecutaron, qué skills se usaron, etc. Su score 9.8
refleja que el agente está funcionando bien y la infraestructura de skills/scripts
está sólida.

`.project.json` mide la **salud del proyecto en sí** — qué tan bien están las
dimensiones reales del código, la documentación, los procesos. Su score 8.7
refleja que el proyecto tiene margen de mejora en backlog, profundidad de
métricas, y actividad de ciclo.

**Ambos son correctos.** Miden cosas distintas.

## Regla de Decisión

| Situación | Usar |
|-----------|------|
| Decidir qué mejorar en el fork | `.project.json` — la dim más baja es el próximo target |
| Evaluar si el agente está productivo | `inter-track` — >30 inter y score >9.0 = saludable |
| Reporte de ciclo | Ambas — el inter-track muestra actividad, `.project.json` muestra progreso real |
| Urgencia de un fix | `.project.json` — una dim que baja de 7.0 es alerta |

## Ciclo de Actualización Recomendado

```
Por interacción:  inter-track.ps1 -Increment  (automático)
Por ciclo:        score-auto.ps1 + .project.json refresh
Trimestral:       Revisar dimensiones, agregar/quitar según evolucione el proyecto
```

## Meta

- **Score Depth objetivo**: 9.0/10
- **Cómo subir**: Mantener este documento actualizado, asegurar que ambas fuentes
  se usen consistentemente en las decisiones de ciclo.
