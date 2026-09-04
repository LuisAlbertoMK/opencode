# ADR-004 — Reciclaje de child scopes en VirtualList (índice absoluto no reactivo)

Fecha: 2026-09-04 · Ciclo 6 · Rama: experimento/mejora-autonoma-2026-09-04

## Contexto

El candidato diferido "For recreation en window shift" (~18 filas recreadas
por shift, mejora-log.md:47-49) se atribuía al framework (OpenTUI/Solid).
El recon del ciclo 6 lo refuta: el `<For>` de solid-js reusa scopes por
referencia de item. El verdadero culpable estaba en el children callback de
VirtualList (virtual-list.tsx):

```ts
const index = visible().offset + i()
```

Ese read reactivo del memo `visible` dentro del callback hacía que el scope
de CADA hijo visible dependiera de `visible` → cada shift re-ejecutaba todos
los scopes → Solid destruía y recreaba cada box (~viewport filas por shift).
El valor calculado (índice absoluto del item) ni siquiera cambia durante un
shift: la dependencia reactiva era innecesaria.

## Decisión

1. Memo `itemIndex` (Map item → índice absoluto), reconstruido solo cuando
   cambia `props.items()` — O(n) por cambio de items, no por tick.
2. El children callback lee el índice con `untrack()` en el momento de la
   creación del scope. Sin reads reactivos dentro del scope, `<For>` reusa
   los scopes de los items que persisten entre shifts y solo crea/destruye
   los items que entran/salen de la ventana.
3. `itemRefs` (Map índice → box) sigue indexado por índice: con scopes
   estables el índice capturado es constante por item, así que el cleanup del
   ciclo 2 sigue siendo correcto sin cambios.

## Alternativas descartadas

- **Parchear `For` en solid-js/@opentui**: el framework ya reusa por
  referencia correctamente — el bug era del call-site. Parchear era blast
  radius Alto sin necesidad.
- **`<Index>`**: reusa por posición y actualiza el item reactivo — con
  ventanas deslizantes re-renderizaría el contenido de cada posición por
  shift (peor).
- **Índice reactivo como memo + `index()`**: seguiría re-renderizando el box
  del item en cada shift (el JSX depende del valor).

## Consecuencias

- Recreación por shift: de ~window completo a solo items entrantes (+ una
  cascada de medición de alturas de una ola, inherente a la virtualización).
- **Caveat documentado**: los índices capturados asumen items append-only.
  Un prepend/splice en el array invalidaría los índices de los scopes
  existentes (no ocurre en transcripciones de sesión de opencode). Si alguna
  ruta reordena mensajes, este componente necesita revisión.
- Verificación: test/component/virtual-list-recycle.test.tsx (testRender
  headless) — recreaciones por shift ≤ max(8, window/2) + equivalencia de
  índices. Los fails del suite completo son pre-existentes (verificado en
  base sin el fix).

## Checkpoint humano

Blast radius Medio-Alto en rendering → merge a port-vmk-perf pendiente del
veredicto del usuario probando el binario del worktree en vivo (protocolo §1).
