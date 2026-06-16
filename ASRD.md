# ASRD — Arquitectura de Referencias Semánticas Dinámicas

## Problema
Agentes (Claude Code, Cursor, Copilot) releen archivos completos en cada acción → tokens/CPU/RAM/VRAM/latencia/costo innecesarios.

---

## Hipótesis central
No hace falta un tokenizador mejor.  
Hace falta **procesar menos texto** — representar el repo como grafo semántico persistente y operar sobre referencias, no sobre código crudo.

---

## Flujo comparativo

```
Actual:  Texto → Tokenización → Contexto masivo → Inferencia
ASRD:    Repo → Grafo semántico → Referencias → Expansión lazy → Inferencia
```

---

## Componentes

### 1. Intent Graph Encoding (IGE)
Convierte instrucciones de usuario en grafos de intención estructurados.

```
"Busca el bug en UserService y crea tests"
→
ACTION: FIND_BUG      TARGET: UserService.ts
ACTION: CREATE_TESTS  TARGET: UserService.ts
```

**Gap crítico:** Requiere un parser NLU previo. Si ese parser es un LLM, el costo de tokens no desaparece — se desplaza. Necesita un parser ligero dedicado (regex + reglas + clasificador small) para no crear overhead mayor al que resuelve.

---

### 2. Workspace State Compression (WSC)
Solo transmite deltas entre estados, no archivos completos.

```
Estado #182 → #183
Δ: línea 84 — método login() reescrito
```

**Nota:** Análogo a git diff / LSP incremental sync — tecnología madura.  
**Riesgo real:** Algunos cambios requieren contexto amplio para ser interpretados. Un delta sin contexto puede ser ambiguo para el modelo.  
**Solución:** Incluir contexto mínimo de vecindad (N líneas alrededor del delta) + firma de la función modificada.

---

### 3. Symbol Memory Layer (SML) + Dynamic Neural References (DNR)
*Estos dos componentes resuelven el mismo problema — se unifican aquí.*

IDs persistentes para cada entidad del codebase. Expansión lazy bajo demanda.

```
validateUser(email, password) → REF_A712
AUTH_SERVICE                  → REF_104
LOGIN_METHOD                  → REF_104_01

Modelo opera sobre: REF_104_01
Si necesita detalles: EXPAND REF_104_01 → carga código completo
```

Análogo a: paginación de memoria virtual / caché semántica.

**Gap crítico:** Paradoja de expansión — el modelo necesita saber *qué contiene* una referencia para decidir si expandirla. Sin contenido, no puede razonar sobre ella.  
**Solución:** Cada referencia lleva un **summary token comprimido** (firma + tipo + docstring en 1-2 líneas). El modelo decide con eso si expandir o no.

**Gap adicional:** Los LLMs actuales fueron entrenados sobre texto, no sobre IDs arbitrarios. Operar con REF_A712 sin fine-tuning es inviable.  
**Solución:** Fine-tuning o prefix-tuning sobre el esquema de referencias, o inyectar el summary al resolver la ref antes de pasarlo al modelo base.

---

### 4. Predictive Context Materialization (PCM)
Precarga solo archivos con alta probabilidad de uso real.

```
UserService.ts → 96% ✓ materializado
Auth.ts        → 92% ✓ materializado
Logger.ts      →  4% ✗ ignorado
```

**Gap crítico:** ¿Cómo se calcula el 96%? Necesita un modelo de relevancia (embeddings + historial de acceso). Ese modelo tiene su propio costo de cómputo.  
**Solución:** Modelo de relevancia small y local (embedding + BM25 híbrido), ejecutado offline sobre el grafo semántico ya construido. Costo amortizable entre llamadas.

---

## Prerequisito sistémico: construcción del grafo

Todo ASRD depende de un grafo semántico del repo construido y mantenido incrementalmente.

```
Repo → AST parsing (tree-sitter) → Symbol graph → Embeddings → Índice
```

- Construcción inicial: costo único alto  
- Actualización incremental: bajo (solo archivos modificados)  
- Tecnología existente: tree-sitter + ctags + LSP cubren gran parte de esto

---

## Beneficios esperados (cuando el sistema está maduro)

| Recurso  | Mejora                              |
|----------|-------------------------------------|
| CPU      | Menos tokenización y reprocesado    |
| RAM      | Menos contexto duplicado            |
| VRAM     | Ventanas de atención más pequeñas   |
| Latencia | Menos datos enviados/procesados     |
| Costo    | Menos tokens por interacción        |

---

## Lo que ya existe vs. lo que es nuevo

| Concepto ASRD         | Equivalente actual          | Lo realmente nuevo                    |
|-----------------------|-----------------------------|---------------------------------------|
| WSC (deltas)          | git diff, LSP               | Aplicarlo al contexto del LLM         |
| SML/DNR (symbol IDs)  | ctags, LSP symbols          | Lazy expansion con summary tokens     |
| PCM (relevance)       | RAG, BM25, embeddings       | Integración en tiempo de inferencia   |
| IGE (intent graph)    | Sin equivalente directo     | Parser NLU ligero → grafo estructurado|

---

## Diferenciador clave

Los sistemas actuales optimizan **cómo** procesar texto.  
ASRD propone reducir **cuánto** texto llega al modelo.

> **Paradigma actual:** releer texto constantemente  
> **Paradigma ASRD:** operar sobre conocimiento estructurado, expandir solo lo necesario
