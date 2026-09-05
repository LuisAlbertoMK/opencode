# ADR-003 — Build levers: bytecode rechazado, smol diferido a prueba en vivo

Fecha: 2026-09-04 · Ciclo 5 · Rama: experimento/mejora-autonoma-2026-09-04

## Contexto

Los build levers (bytecode, smol, WAL) quedaron diferidos del experimento
2026-09-03 (mejora-log.md:50-51). Este ciclo mide los dos primeros sobre el
binario compilado con un harness reproducible nuevo
(`packages/opencode/script/bench-boot.ps1`: mediana n=8, warmup 1, exit code
validado por corrida, RAM pico por sampling 200ms).

## Decisión

1. **Bytecode: RECHAZADO.** Bun compila bytecode para `bun-windows-x64`
   (verificado empíricamente — el build pasa y el binario corre), pero el
   boot NO mejora: 634.4 ms vs 629.1 ms baseline (mediana n=8, dentro del
   ruido), y el binario crece +136% (137.5 → 324.7 MB). El costo de boot del
   binario no está dominado por el parseo del bundle.
2. **Smol: boot NEUTRAL — diferido.** El -28% de la primera corrida (450.3 ms)
   no se repite (segunda corrida 638.4 ms; control del baseline 632.2 ms).
   Los mins son equivalentes (~427-448 ms) en todas las variantes: el piso de
   boot no cambia con smol. El valor potencial de smol es el RSS de sesiones
   largas (GC más frecuente), que no es medible con un bench de boot — se
   difiere a la prueba en vivo del usuario. El flag `--smol` queda disponible
   como opt-in en build.ts para esa prueba.

## Consecuencias

- El build default NO cambia (ambos flags son opt-in) — riesgo de regresión cero.
- WAL mmap se pospone al próximo ciclo (requiere recon de la capa db:
  packages/core + effect-sqlite).
- La prueba de smol en vivo requiere un binario `--smol` (comando:
  `bun run build --single --skip-embed-web-ui --smol`).

## Datos

Ver docs/vmk/mejora-log.md §Ciclo 5 (tabla completa de 5 corridas).
