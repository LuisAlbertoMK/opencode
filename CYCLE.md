# Ciclo de Auto-MeJora: Optimización de Recursos

> **Inicio**: 2026-06-18
> **Objetivo**: Reducir uso de CPU, RAM, GPU/VRAM en opencode-vMK

## Métricas Target

| Métrica | Línea Base | Target | Instrumento |
|---------|-----------|--------|-------------|
| RAM opencode-vMK | ~920 MB | <500 MB | `Get-Process` |
| CPU (sesión nueva 30min) | Medir baseline | -30% | `Get-Process CPU(s)` |
| Tamaño binario | ~143.5 MB | -20% (~115 MB) | `Get-Item .exe` |
| # Skills registrados | 60 | <40 | `skill-graph.ps1` (sparse load) |
| Score general | 7.5 | >8.0 | `.project.json` |

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
RAM total sistema: 14.3 GB (13.9 GB usable)
RAM opencode-vMK:  ~920 MB (2 procesos: 919.7 + 929.1)
CPU: AMD Ryzen 7 3700U (4C/8T, lógicos: 8)
GPU: AMD Radeon RX Vega 10 (2GB VRAM)
Disk D:\: 195.5 GB free
Binario vMK:       143.5 MB (150508032 bytes)
opencode skills:   60 registrados (9 SDD stubs removidos)
Score actual:      7.5/10
```
