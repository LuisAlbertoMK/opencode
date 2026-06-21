@echo off
REM Optimización de memoria vMK: GC proactivo + menos overhead
set OPENCODE_AUTO_HEAP_SNAPSHOT=true
set OPENCODE_DISABLE_MODELS_FETCH=true
set OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER=true
set OPENCODE_DISABLE_EMBEDDED_WEB_UI=true
"%~dp0packages\opencode\dist\opencode-windows-x64\bin\opencode-vMK.exe" %*
