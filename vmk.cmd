@echo off
REM ============================================================
REM vMK - opencode fork wrapper con aislamiento de contencion
REM ============================================================
REM Busca automaticamente el binario compilado de TU fork
REM en packages/opencode/dist/ y lo ejecuta con isolation.
REM ============================================================
setlocal

REM --- Aislamiento de Config/Data/Cache ---
set OPENCODE_CONFIG_DIR=%~dp0.vmk-config
set OPENCODE_DB=%~dp0.vmk-data\opencode.db
set OPENCODE_CACHE_DIR=%~dp0.vmk-cache

REM --- Optimizaciones de memoria vMK ---
set OPENCODE_AUTO_HEAP_SNAPSHOT=true
set OPENCODE_DISABLE_MODELS_FETCH=true
set OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER=true
set OPENCODE_DISABLE_EMBEDDED_WEB_UI=true

REM --- Canal de desarrollo vMK ---
set OPENCODE_CHANNEL=vMK-dev

REM --- Auto-descubrir el binario vMK ---
set VMK_EXE=
for /r "%~dp0packages\opencode\dist" %%f in (opencode-vMK.exe) do (
    if exist "%%f" (
        set VMK_EXE=%%f
        goto :run
    )
)

REM Fallback: buscar en toda la carpeta packages
for /r "%~dp0packages" %%f in (opencode-vMK.exe) do (
    if exist "%%f" (
        set VMK_EXE=%%f
        goto :run
    )
)

REM No encontrado
echo ERROR: opencode-vMK.exe no encontrado.
echo.
echo Compila primero TU fork:
echo   set OPENCODE_CHANNEL=vMK-dev
echo   bun run --cwd packages/opencode build -- --skip-embed-web-ui
echo.
exit /b 1

:run
REM Ejecutar binario directamente. ANSI VT processing lo maneja @opentui/core
REM internamente (Windows 10+ con Windows Terminal o ConPTY).
echo [vMK] Usando: %VMK_EXE%
"%VMK_EXE%" %*

exit /b %ERRORLEVEL%