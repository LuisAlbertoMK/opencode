# Cómo medir el ahorro de recursos — opencode-vMK vs original

> Metodología verificada por 3 subagentes independientes.
> Basada en herramientas nativas de Bun, Windows y PowerShell.

---

## Principio clave: NO necesitás automatizar la TUI

`opencode run "prompt" --format json` ya es batch nativo:
- Lee stdin, escribe JSON events a stdout, sale al terminar
- No necesita TTY, tmux, ni ConPTY
- Ya se usa en producción para piping output

---

## 1. RAM (RSS)

### La medición más precisa

```typescript
// benchmark.ts — injectar en app.ts de ambas builds
const footprint = Bun.unsafe.memoryFootprint?.() ?? process.memoryUsage().rss;
```

- `Bun.unsafe.memoryFootprint()` → `PrivateUsage` en Windows (excluye páginas lazy-free)
- `process.memoryUsage().rss` → incluye páginas que el OS no ha reclamado aún
- [Bun docs](https://bun.sh/reference/bun/unsafe) | [Issue #28318](https://github.com/oven-sh/bun/issues/28318)

### Heap snapshot (Chrome DevTools)

```bash
# Generar en ambas builds
bun --heap-prof --heap-prof-name vmk.heapsnapshot --smol ./app.ts
bun --heap-prof --heap-prof-name orig.heapsnapshot ./app.ts
```

Cargar ambos en Chrome DevTools → Memory → Load → dropdown "Comparison" → columna **Delta** muestra objetos que desaparecieron (negativo = ganancia).

### Native heap stats

```bash
MIMALLOC_SHOW_STATS=1 bun --smol ./app.ts 2>&1
```

Muestra al exit: `rss: 57.4 MiB, commit: 64.0 MiB` con detalle de pages/segments.

---

## 2. CPU

### `process.cpuUsage()` — dentro de la app

```typescript
const cpu0 = process.cpuUsage()
await runSession()  // misma carga en ambas builds
const cpu1 = process.cpuUsage()
const userDiff = cpu1.user - cpu0.user   // μs user
const sysDiff  = cpu1.system - cpu0.system // μs system
```

### `bun --cpu-prof` — perfil completo de CPU

```bash
bun --cpu-prof-md --cpu-prof --cpu-prof-dir ./profiles --smol ./app.ts
```

Genera markdown con tabla de hot functions. [Bun docs](https://bun.com/docs/project/benchmarking#cpu-profiling)

### OpenTUI frame times (`gatherStats: true`)

```typescript
const renderer = await createCliRenderer({
  targetFps: 60,
  gatherStats: true,
  maxStatSamples: 300,
})
// Log cada 5s
setInterval(() => {
  const s = renderer.getStats()
  console.log({ fps: s.fps, avg: s.averageFrameTime, min: s.minFrameTime })
}, 5000)
```

[OpenTUI performance docs](https://anomalyco-opentui.mintlify.app/advanced/performance)

---

## 3. Análisis de binario

### Tamaño total (PowerShell)

```powershell
Get-Item opencode-vMK.exe, opencode.exe | Select-Object Name, Length
```

### Secciones PE (dumpbin — necesita VS Build Tools)

```powershell
dumpbin /HEADERS opencode-vMK.exe | Select-String "^  [0-9A-F]"
```

La sección `.bun` contiene el JS bundle + WASM + assets. [PR #26923](https://github.com/oven-sh/bun/pull/26923)

### Extraer JS bundle del binario

```powershell
npx unbun extract opencode-vMK.exe -o ./vmk-extracted
Get-ChildItem ./vmk-extracted -Recurse -File | Measure-Object -Sum Length
```

[unbun](https://github.com/skelpo/unbun) | [bun-demincer](https://github.com/vicnaum/bun-demincer)

### Per-module size (antes de compilar)

```powershell
bun build ./src/index.ts --outdir ./dist --metafile=meta.json
npx esbuild-visualizer --metadata meta.json --filename report.html
```

### Strip de símbolos (si aplica)

```powershell
# Usar llvm-strip, NO strip de Git Bash (no maneja PE/MSVC)
llvm-strip --strip-all -s opencode-vMK.exe -o opencode-vMK-stripped.exe
```

⚠️ **UPX no recomendado**: puede romper el JS bundle embebido ([Issue #10051](https://github.com/oven-sh/bun/issues/10051)).

---

## 4. Script A/B completo (PowerShell)

```powershell
# compare-vmk.ps1 — A/B benchmark automatizado
param(
    [string]$Prompt = "Write a short poem about coding",
    [string]$Model = "openai/gpt-4o-mini",
    [int]$Runs = 8,                        # 8 runs por versión
    [string]$VMK_Binary = "packages/opencode/dist/opencode-win32-x64/bin/opencode-vMK.exe",
    [string]$Upstream_Binary = "",          # "" = opencode global (npm)
    [int]$SampleIntervalMs = 500
)

function Measure-Version {
    param([string]$Binary, [string]$Label)
    $results = [System.Collections.Generic.List[PSObject]]::new()

    foreach ($i in 1..$Runs) {
        # Aislamiento de entorno
        $env:OPENCODE_CONFIG_DIR = Join-Path $env:TEMP "opencode-ab-$Label-$i"
        $env:OPENCODE_DB = Join-Path $env:TEMP "opencode-ab-$Label-$i\data\opencode.db"
        $env:OPENCODE_CACHE_DIR = Join-Path $env:TEMP "opencode-ab-$Label-$i\cache"
        $null = New-Item -ItemType Directory -Path $env:OPENCODE_CONFIG_DIR -Force

        $proc = Start-Process -FilePath $Binary -ArgumentList "run `"$Prompt`" --model $Model --format json" `
            -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\ab-$Label-$i-out.log"

        # Sampleo de RAM/CPU cada SampleIntervalMs
        $samples = [System.Collections.Generic.List[PSObject]]::new()
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        while (!$proc.HasExited) {
            $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue
            if ($p) {
                $samples.Add([PSCustomObject]@{
                    WS_MB   = [Math]::Round($p.WorkingSetSize / 1MB, 1)
                    Priv_MB = [Math]::Round($p.PageFileUsage / 1MB, 1)
                })
            }
            Start-Sleep -Milliseconds $SampleIntervalMs
        }
        $sw.Stop()

        $stats = $samples | ForEach-Object { $_.WS_MB }
        $results.Add([PSCustomObject]@{
            Run        = $i
            Duration_s = [Math]::Round($sw.Elapsed.TotalSeconds, 2)
            AvgWS_MB   = [Math]::Round(($stats | Measure-Object -Average).Average, 1)
            PeakWS_MB  = ($stats | Measure-Object -Maximum).Maximum
        })
        Remove-Item -Recurse -Force "$env:TEMP\opencode-ab-$Label-$i" -ErrorAction SilentlyContinue
    }
    return $results
}

# --- Ejecutar ---
$vmk  = Measure-Version -Binary (Resolve-Path $VMK_Binary) -Label "vmk"
$orig = Measure-Version -Binary $Upstream_Binary -Label "orig"

# --- Reporte ---
function Show-Compat($v, $u, $prop) {
    $vm = ($v.$prop | Measure-Object -Average).Average
    $um = ($u.$prop | Measure-Object -Average).Average
    $d = $vm - $um
    $p = if ($um) { "{0:P1}" -f ($d / $um) } else { "N/A" }
    return "$([Math]::Round($um,2)) → $([Math]::Round($vm,2)) ($p)"
}

Write-Host "`n=== A/B BENCHMARK: vMK vs UPSTREAM ===" -ForegroundColor Magenta
Write-Host "  Prompt: $Prompt | Model: $Model | Runs: $Runs"
Write-Host "`nResultados:"
Write-Host "  Duration:  $(Show-Compat $vmk $orig 'Duration_s')"
Write-Host "  Avg WS:   $(Show-Compat $vmk $orig 'AvgWS_MB') MB"
Write-Host "  Peak WS:  $(Show-Compat $vmk $orig 'PeakWS_MB') MB"
```

---

## Resumen de herramientas

| Qué medir | Herramienta | Precisión |
|-----------|-------------|-----------|
| RAM runtime | `Bun.unsafe.memoryFootprint()` | ✅ Alta |
| RAM (externo) | `Get-CimInstance Win32_Process` | ✅ Alta (~1MB) |
| Heap diff | Chrome DevTools Memory Comparison | ✅ Visual |
| Native heap | `MIMALLOC_SHOW_STATS=1` | ✅ Detalle pages |
| CPU inside app | `process.cpuUsage()` | ✅ μs |
| CPU full profile | `bun --cpu-prof` | ✅ Hot functions |
| Frame times TUI | `gatherStats: true` | ✅ ms |
| Binary size | `Get-Item .Length` | ✅ byte exacto |
| Bundle JS size | `unbun extract` + `Measure-Object` | ✅ byte exacto |
| Per-module size | `bun build --metafile` | ✅ byte exacto |
| Binary sections | `dumpbin /HEADERS` | ✅ byte/sección |
| Strip symbols | `llvm-strip --strip-all` | ✅ Variable |
| A/B automation | Script PowerShell + `opencode run --format json` | ✅ Batch nativo |

> Fuentes: [Bun benchmarking](https://bun.com/docs/project/benchmarking), [OpenTUI perf](https://anomalyco-opentui.mintlify.app/advanced/performance), [Bun memory leaks](https://bun.com/blog/debugging-memory-leaks), [unbun](https://github.com/skelpo/unbun), [microsoft/tui-test](https://github.com/microsoft/tui-test)
