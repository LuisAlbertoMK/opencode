# Ciclo de Auto-MeJora: Optimización de Recursos

> **Inicio**: 2026-06-18
> **Objetivo**: Reducir uso de CPU, RAM, GPU/VRAM en opencode-vMK

## Métricas Target

| Métrica | Línea Base | Target | Instrumento |
|---------|-----------|--------|-------------|
| RAM opencode-vMK | ~708 MB | <500 MB | `Get-Process` |
| CPU (sesión nueva 30min) | Medir baseline | -30% | `Get-Process CPU(s)` |
| Tamaño binario | Medir baseline | -20% | `Get-Item .exe` |
| # Skills cargados | 65 | <40 | `skill-graph.ps1` |
| Score general | 7.0 | >8.0 | `.project.json` |

## Dificultad → Verify

| Nivel | Verify | Aplica a |
|-------|--------|----------|
| Fácil | E2 (estático) | Config changes, env vars |
| Medio | E1+E2 | Sistema, procesos |
| Difícil | Full + 4R | Build config, binaries |
| Complejo | Full + judgment-day | Source code changes |

## Ciclo

1. **Diagnóstico** → identificar targets
2. **Aplicar fix** con verify según dificultad
3. **inter-track.ps1 -Increment** + BITACORA
4. **Re-score** → delta → keep o revert
5. **Engram** + anti-patterns

## Exit Conditions

- inter ≥ 30 + no dim < 9.0 → SUCCESS
- Score drop > 0.5 → revert todo
- 3 fails same fix → SKIP

## Línea Base (capturada)

```
RAM total sistema: 13.9 GB
RAM opencode:      ~773 MB
RAM opencode-vMK:  ~708 MB
CPU: AMD Ryzen 7 3700U (4C/8T) @ 24% load
GPU: AMD Radeon RX Vega 10 (2GB VRAM)
Disk D:\: 195 GB free
opencode skills:   65 registrados
Score actual:      7.0/10
```
