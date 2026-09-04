# Rollback Map — experimento/mejora-autonoma-2026-09-03

Mapeo commit ↔ ciclo ↔ gap. Cada ciclo se revierte en aislado sin afectar posteriores.

| Ciclo | Gap | Commits (en orden) | Rollback quirúrgico |
|---|---|---|---|
| 1 | VirtualList range O(n)/tick | `e7d89685f2` refactor: extraer computeVisibleRange · `590bf90514` perf: prefix-sum + tests + harness | `git revert 590bf90514` → vuelve al baseline O(n) conservando la extracción. Revert total: `git revert 590bf90514 e7d89685f2` |
| 2 | (pendiente) | — | — |
| 3 | (pendiente) | — | — |
| 4 | (pendiente) | — | — |

Notas:
- Los docs (`docs/vmk/*`) no afectan runtime — no requieren rollback.
- Refactor y perf están en commits separados (protocolo §3.4) → el revert del
  perf restaura el algoritmo original sin perder la función pura testeable.

| 5 | build levers (bytecode/smol) | `flags build.ts opt-in` | sin revert necesario — flags opt-in, el build default no cambia |
