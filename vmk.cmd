@echo off
REM ============================================================
REM vMK - opencode fork wrapper con aislamiento de contencion
REM ============================================================
REM Busca automaticamente el binario compilado de TU fork
REM en packages/opencode/dist/ y lo ejecuta con isolation.
REM ============================================================
setlocal

REM --- Aislamiento de Config/Data/Cache ---
set "OPENCODE_CONFIG_DIR=%~dp0.vmk-config"
set "OPENCODE_DB=%~dp0.vmk-data\opencode.db"
set "OPENCODE_CACHE_DIR=%~dp0.vmk-cache"
set "OPENCODE_DATA_DIR=%~dp0.vmk-data"
set "OPENCODE_STATE_DIR=%~dp0.vmk-data\state"
set "OPENCODE_TMP_DIR=%~dp0.vmk-cache\tmp"

REM --- XDG overrides para xdg-basedir (Windows) ---
set "XDG_DATA_HOME=%~dp0.vmk-data"
set "XDG_CONFIG_HOME=%~dp0.vmk-config"
set "XDG_CACHE_HOME=%~dp0.vmk-cache"
set "XDG_STATE_HOME=%~dp0.vmk-data\state"

REM --- Optimizaciones de memoria vMK ---
set "OPENCODE_AUTO_HEAP_SNAPSHOT=true"
set "OPENCODE_DISABLE_MODELS_FETCH=true"
set "OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER=true"
set "OPENCODE_DISABLE_EMBEDDED_WEB_UI=true"

REM --- Canal de desarrollo vMK ---
set "OPENCODE_CHANNEL=vMK-dev"

REM --- Comando build: compila binario sin Web UI embebida ---
if /i "%1"=="build" (
    echo [vMK] Compilando binario vMK...
    echo [vMK] Variables de aislamiento activas:
    echo   OPENCODE_CHANNEL=%OPENCODE_CHANNEL%
    echo   OPENCODE_DISABLE_EMBEDDED_WEB_UI=%OPENCODE_DISABLE_EMBEDDED_WEB_UI%
    echo   XDG_DATA_HOME=%XDG_DATA_HOME%
    echo   XDG_CONFIG_HOME=%XDG_CONFIG_HOME%
    set "BINARY_NAME=opencode-vMK.exe"
    bun run packages/cli/script/build.ts --single
    if errorlevel 1 (
        echo [vMK] ERROR: Build fallo.
        exit /b 1
    )
    REM --- Post-build validation ---
    if exist "%~dp0packages\cli\dist\opencode-vMK.exe" (
        echo [vMK] Build completado: opencode-vMK.exe encontrado.
    ) else (
        echo [vMK] ADVERTENCIA: opencode-vMK.exe no encontrado en packages/cli/dist/
        echo [vMK] Verifica que el build.ts incluye el post-build step para vMK.
    )
    goto :eof
)

REM --- Auto-descubrir el binario vMK ---
set VMK_EXE=
REM Buscar en packages/cli/dist/ (path correcto post-build)
if exist "%~dp0packages\cli\dist\opencode-vMK.exe" (
    set "VMK_EXE=%~dp0packages\cli\dist\opencode-vMK.exe"
    goto :run
)
REM Fallback: buscar recursivamente en packages
for /r "%~dp0packages" %%f in (opencode-vMK.exe) do (
    if exist "%%f" (
        set VMK_EXE=%%f
        goto :run
    )
)

REM No encontrado
echo ERROR: opencode-vMK.exe no encontrado.
echo.
echo Compila primero con:
echo   vmk build
echo.
exit /b 1

:run
REM --- Bridge precheck: detecta mensajes de gentleman-vMK antes de arrancar ---
call "%~dp0scripts\vmk-bridge-precheck.cmd"
if errorlevel 1 (
    echo [vMK] ╔══════════════════════════════════════════════╗
    echo [vMK] ║  Bridge tiene mensajes PENDIENTES ^<%</%>        ║
    echo [vMK] ║  Revisalos al iniciar la sesion.            ║
    echo [vMK] ╚══════════════════════════════════════════════╝
    echo.
)

REM Ejecutar binario directamente. ANSI VT processing lo maneja @opentui/core
REM internamente (Windows 10+ con Windows Terminal o ConPTY).
echo [vMK] Usando: %VMK_EXE%
"%VMK_EXE%" %*

exit /b %ERRORLEVEL%