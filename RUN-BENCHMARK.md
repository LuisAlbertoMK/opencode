# Benchmark: opencode-vMK vs Upstream

> Cómo medir el ahorro real de recursos de tu fork vMK.
> Metodología verificada por 3 subagentes.
>
> **Baseline actual**: `docs/metricas/bench-baseline-vMK-dev.json`
> **Rama activa**: `vMK-dev`

---

## Lo que tenés que medir

| Métrica | Herramienta | Dónde |
|---------|-------------|-------|
| RAM (RSS) | `Bun.unsafe.memoryFootprint()` + `process.memoryUsage()` | Inyectado en app |
| CPU | `process.cpuUsage()` o `bun --cpu-prof` | Inyectado en app |
| Frame times TUI | `gatherStats: true` en OpenTUI renderer | `runtime.lifecycle.ts` |
| Binary size | `Get-Item .Length` | Consola |
| JS bundle size | `unbun extract` + `Measure-Object` | Consola |

---

## Paso a paso

### 1. Compilá vMK (ya está hecho)

```powershell
cd packages/opencode
bun run build --single
```

Binario en: `packages/opencode/dist/opencode-windows-x64/bin/opencode-vMK.exe`

### 2. Asegurate de tener opencode upstream

```powershell
# Instalar la versión estable de npm (o tener otro build de referencia)
npm install -g opencode-ai
# Verificar
opencode --version
```

### 3. Corré el benchmark A/B

```powershell
# El script de abajo hace 8 runs por versión.
# Usa opencode run "prompt" --format json (batch nativo, no necesita TUI)
# Aísla config/db/cache por run via OPENCODE_CONFIG_DIR

$runs = 8
$prompt = "Write a short poem about coding"

foreach ($version in @("vmk", "upstream")) {
    $binary = if ($version -eq "vmk") {
        "packages/opencode/dist/opencode-windows-x64/bin/opencode-vMK.exe"
    } else {
        (Get-Command opencode).Source
    }

    foreach ($i in 1..$runs) {
        # Aislar entorno
        $env:OPENCODE_CONFIG_DIR = "$env:TEMP\bench-$version-$i"
        New-Item -ItemType Directory -Force $env:OPENCODE_CONFIG_DIR | Out-Null

        # Medir
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $proc = Start-Process -FilePath $binary -ArgumentList "run `"$prompt`" --format json" `
            -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\bench-$version-$i-out.log"
        $proc.WaitForExit()
        $sw.Stop()

        $rss = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").WorkingSetSize / 1MB
        Write-Host "$version run $i: $($sw.Elapsed.TotalSeconds)s, ${rss}MB RSS"
    }
}
```

### 4. Interpretar resultados

```powershell
# Para cada métrica, compará media y mediana entre las dos versiones
# vMK debería mostrar:
# - Menor RSS (~25-30% con smol=true)
# - Menor CPU (drop console + useThread offload)
# - Menor binary size (drop + minify)
# - Frame times más estables (useThread)
```

---

## Baseline registrado

| Métrica | Valor | Fecha |
|---------|-------|-------|
| Binary size | 130.5 MB | 2026-06-30 |
| Cold boot (--help) | 1889ms avg | 2026-06-30 |
| Pre-consolidación | 155.8 MB (-16.2%) | vmk-containment |

Próximas optimizaciones se comparan contra `docs/metricas/bench-baseline-vMK-dev.json`.
Corré `.\scripts\vmk-bench.ps1` para generar un nuevo reporte y comparar deltas.

---

## Referencia: optimizaciones aplicadas

| # | Cambio | Impacto esperado | Commit |
|---|--------|-----------------|--------|
| A2 | `drop: ["console", "debugger"]` en build.ts | -5-10% payload JS | `139a24fd1` |
| A3 | Heap thresholds 512MB/768MB/30s | Detección temprana de leaks | `139a24fd1` |
| B1 | `smol=true` en bunfig.toml | -25-30% RAM runtime | `4ba06d155` |
| B3 | `useThread: true` en renderer | UI responsiva durante CPU pesado | `66d6300b6` |

Documentación completa: `docs/optimization/opencode-vmk-plan.md`
