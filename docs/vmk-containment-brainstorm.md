# vMK Containment — Lluvia de Ideas

> Fecha: 2026-06-25
> Estado: ANÁLISIS — pendiente de aprobación
> Contexto: Aislamiento entre opencode-vMK.exe y opencode global (npm)

---

## Problema

```
SITUACIÓN ACTUAL:
├── Mismo código fuente → ambos binarios
├── Misma config (~/.config/opencode/) → ambos leen
├── Misma DB (~/.local/share/opencode/) → ambos escriben
├── Mismo bun cache → ambos usan
└── Aislamiento REAL: solo el nombre del exe + env vars en vmk.cmd

RIESGO: Si modificás algo para vmk, puede romper el global.
```

---

## Categoría 1: Bajo Esfuerzo (Quick Wins)

### 1.1 Aislamiento Total de Config + DB via Env Vars
**Concepto**: Usar `OPENCODE_CONFIG_DIR` y `OPENCODE_DB` en `vmk.cmd` para apuntar a directorios separados.

```powershell
# vmk.cmd modificado
set OPENCODE_CONFIG_DIR=D:\opencode\.vmk-config
set OPENCODE_DB=D:\opencode\.vmk-data\opencode.db
set OPENCODE_CACHE_DIR=D:\opencode\.vmk-cache
```

| Pros | Contras |
|------|---------|
| Cambio mínimo (solo vmk.cmd) | Comparte código fuente |
| Zero riesgo al global | Comparte bun cache |
| Fácil de revertir | Config se "desincroniza" del global |
| Funciona ya (las env vars existen) | Hay que migrar configs manualmente |

**Aislamiento**: ⭐⭐⭐ | **Complejidad**: ⭐

---

### 1.2 Git Worktree para vMK
**Concepto**: Usar `git worktree` para crear un directorio separado que comparte el mismo repo pero tiene su propio working tree.

```powershell
git worktree add D:\opencode-vmk dev
```

| Pros | Contras |
|------|---------|
| Separación física completa | Requiere sincronizar commits |
| Mismo historial de git | Ocupa disco extra |
| Fácil de hacer merge/rebase | Workflow más complejo |
| Puedes tener patches diferentes | Config sigue compartida |

**Aislamiento**: ⭐⭐⭐⭐ | **Complejidad**: ⭐⭐

---

### 1.3 Bun con Cache Separado
**Concepto**: Usar `BUN_CACHE_DIR` para que vMK use su propio cache de bun.

```powershell
set BUN_CACHE_DIR=D:\opencode\.vmk-bun-cache
```

| Pros | Contras |
|------|---------|
| Un solo env var | No aísla source ni config |
| Evita corrupción de cache | Solo resuelve un vector de riesgo |

**Aislamiento**: ⭐ | **Complejidad**: ⭐

---

## Categoría 2: Esfuerzo Medio

### 2.1 bun-vmk como Runtime Separado
**Concepto**: Crear un wrapper `bun-vmk` que sea una copia de bun con su propio directorio de trabajo y env vars preconfiguradas.

| Pros | Contras |
|------|---------|
| Runtime completamente separado | Copia de bun ocupa ~50MB |
| Cache aislado por defecto | Hay que mantener 2 copies de bun |
| No afecta bun global | No resuelve source sharing |

**Aislamiento**: ⭐⭐⭐ | **Complejidad**: ⭐⭐

---

### 2.2 Source Separado con Symlinks Selectivos
**Concepto**: Crear `D:\opencode-vmk-src\` como directorio separado, con symlinks solo a los paquetes compartidos.

```
D:\opencode-vmk-src\
├── packages/opencode/src/    # ← COPY propio (modificable)
├── packages/core/            # ← SYMLINK a D:\opencode\packages\core\
├── packages/tui/             # ← SYMLINK a D:\opencode\packages\tui\
├── patches/                  # ← SYMLINK
└── vmk-specific/             # ← Directorio exclusivo vMK
```

| Pros | Contras |
|------|---------|
| Source vMK completamente separado | Complejidad de symlinks en Windows |
| Shared packages siguen actualizándose | Puede romper con updates de upstream |

**Aislamiento**: ⭐⭐⭐⭐⭐ | **Complejidad**: ⭐⭐⭐

---

### 2.3 Docker/DevContainer para vMK
**Concepto**: Correr el build de vMK en un container Docker con su propio filesystem.

| Pros | Contras |
|------|---------|
| Aislamiento TOTAL | Requiere Docker instalado |
| Reproducible | Build es más lento |
| No afecta host bajo ninguna circunstancia | Configuración inicial compleja |

**Aislamiento**: ⭐⭐⭐⭐⭐ | **Complejidad**: ⭐⭐⭐⭐

---

## Categoría 3: Alto Esfuerzo

### 3.1 Fork Completo con Upstream Sync
**Concepto**: Fork el repo de opencode, tener un branch `vmk` con todos los cambios, y sincronizar con upstream periódicamente.

| Pros | Contras |
|------|---------|
| Separación completa y limpia | Requiere discipline de sync |
| Fácil de comparar cambios | 2 repos que mantener |
| No hay riesgo de contaminación cruzada | Merge conflicts posibles |

**Aislamiento**: ⭐⭐⭐⭐⭐ | **Complejidad**: ⭐⭐⭐⭐

---

### 3.2 Monorepo con Packages Separados
**Concepto**: Reestructurar el repo como monorepo con packages dedicados a vMK.

| Pros | Contras |
|------|---------|
| Arquitectura limpia y escalable | Requiere refactor significativo |
| Separación por diseño | Hay que migrar código existente |

**Aislamiento**: ⭐⭐⭐⭐ | **Complejidad**: ⭐⭐⭐⭐⭐

---

## Categoría 4: Creativas / No Convencionales

### 4.1 Script de Pre-Flight Check
**Concepto**: Un script que se ejecuta ANTES de cualquier modificación y verifica que no se vaya a contaminar el global.

| Pros | Contras |
|------|---------|
| No cambia la arquitectura | Depende de discipline humana |
| Fácil de integrar | No previene errores de build |

**Aislamiento**: ⭐⭐ | **Complejidad**: ⭐

---

### 4.2 Alias de Shell con Guardias
**Concepto**: Crear un alias `vmk` que siempre lance con las env vars correctas y verifique el entorno.

```powershell
function Invoke-vMK {
    $env:OPENCODE_CONFIG_DIR = "D:\opencode\.vmk-config"
    $env:OPENCODE_DB = "D:\opencode\.vmk-data\opencode.db"
    $env:OPENCODE_AUTO_HEAP_SNAPSHOT = "true"
    $env:OPENCODE_DISABLE_MODELS_FETCH = "true"
    $env:OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER = "true"
    $env:OPENCODE_DISABLE_EMBEDDED_WEB_UI = "true"
    & "D:\opencode\opencode-vMK.exe" @args
}
Set-Alias -Name vmk -Value Invoke-vMK
```

| Pros | Contras |
|------|---------|
| Siempre ejecuta con aislamiento | Solo protege la invocación |
| No depende de vmk.cmd | No protege el build |
| Fácil de usar | No aísla source |

**Aislamiento**: ⭐⭐⭐ | **Complejidad**: ⭐

---

### 4.3 Filesystem Watchdog
**Concepto**: Un proceso background que monitorea cambios en archivos críticos y alerta si algo modifica el global.

| Pros | Contras |
|------|---------|
| Monitoreo passivo 24/7 | Consume recursos |
| Detecta cambios no intencionados | Puede generar falsos positivos |

**Aislamiento**: ⭐⭐ | **Complejidad**: ⭐⭐

---

## Matriz de Comparación

| Idea | Aislamiento | Esfuerzo | Mantenimiento | Recomendación |
|------|-------------|----------|---------------|---------------|
| 1.1 Env vars config/DB | ⭐⭐⭐ | ⭐ | ⭐ | ✅ HACER PRIMERO |
| 1.2 Git worktree | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ✅ Buen opción |
| 1.3 Bun cache separado | ⭐ | ⭐ | ⭐ | ⚠️ Solo como complemento |
| 2.1 bun-vmk runtime | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⚠️ Copia de bun es molesta |
| 2.2 Symlinks selectivos | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⚠️ Complejo en Windows |
| 2.3 Docker | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ✅ Si tenés Docker |
| 3.1 Fork completo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⚠️ Overkill para 1 persona |
| 3.2 Monorepo refactor | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ Demasiado esfuerzo |
| 4.1 Pre-flight check | ⭐⭐ | ⭐ | ⭐ | ✅ Complemento útil |
| 4.2 Alias con guardias | ⭐⭐⭐ | ⭐ | ⭐ | ✅ Fácil y efectivo |
| 4.3 Watchdog | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⚠️ Opcional |

---

## Recomendación Seleccionada: Combo de 3 Capas

**Capa 1 (Inmediato)**: Idea 1.1 — Env vars de aislamiento en vmk.cmd
**Capa 2 (Esta semana)**: Idea 4.2 — Alias `vmk` en PowerShell profile
**Capa 3 (Opcional)**: Idea 4.1 — Script de safety check para builds

### Beneficios del Combo
- ✅ Config y DB separados (1.1)
- ✅ Invocación siempre segura (4.2)
- ✅ Detección de errores humanos (4.1)

### Lo que NO se necesita
- ❌ Docker
- ❌ Fork de repos
- ❌ Refactor de monorepo
- ❌ Copias de bun

---

## Próximos Pasos (pendientes de aprobación)

1. [ ] Crear directorios `.vmk-config`, `.vmk-data`, `.vmk-cache`
2. [ ] Modificar `vmk.cmd` con env vars de aislamiento
3. [ ] Crear función `Invoke-vMK` en profile de PowerShell
4. [ ] Crear script `scripts/vmk-safety-check.ps1`
5. [ ] Documentar la regla en AGENTS.md
