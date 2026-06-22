# Sesión: Compilación con Bun nativo en Windows

## Goal
Compilar opencode con `Bun.build()` + `compile` para generar binario autocontenido en Windows.

## Aprendizajes Clave

### Bun no está instalado por defecto — hay que instalarlo
- **Qué**: El repo usa `bun@1.3.14` como package manager. No funcionan npm ni pnpm.
- **Por qué**: Todos los scripts (`build.ts`, `dev`, `postinstall`) llaman a `bun` directamente.
- **Dónde**: `package.json` → `packageManager: "bun@1.3.14"`
- **Detalle**: En Windows se instala con `powershell -c "irm bun.sh/install.ps1 | iex"`. Queda en `~/.bun/bin/bun.exe`. Hay que agregarlo al PATH de la sesión.

### El build script tiene múltiples flags útiles
- **Qué**: `packages/opencode/script/build.ts` soporta `--single`, `--skip-install`, `--skip-embed-web-ui`, `--sourcemaps`, `--baseline`.
- **Por qué**: `--single` compila solo la plataforma actual (ahorra ~5min vs los 12 targets default). `--skip-embed-web-ui` reduce el binario en ~44MB.
- **Dónde**: `packages/opencode/script/build.ts`
- **Detalle**: Sin `--single`, intenta compilar para Linux/macOS/Windows × x64/arm64 × glibc/musl — falla en Windows por falta de toolchains cruzados.

### La versión del binario se resuelve dinámicamente
- **Qué**: `Script.version` se compone como `package.json version` + `-{branch}`. En `dev` da `1.17.7-dev`.
- **Por qué**: El módulo `@opencode-ai/script` en `packages/script/src/index.ts` lee el branch de git y genera preview builds automáticamente.
- **Dónde**: `packages/script/src/index.ts`
- **Detalle**: Se puede forzar con `$env:OPENCODE_VERSION = "1.17.7-vmk1.2"` antes del build para version custom.

### Web UI embebido es ~25% del binario
- **Qué**: El build de Vite para `packages/app` genera ~44MB de assets embebidos en el binario.
- **Por qué**: El build.ts ejecuta `bun run --cwd packages/app build`, genera un file map virtual (`opencode-web-ui.gen.ts`), y lo compila dentro del binario.
- **Dónde**: `packages/app/dist/` (985 archivos, 44MB)
- **Detalle**: Si no se necesita web UI, `--skip-embed-web-ui` evita ese paso y reduce el binario de 169MB a ~125MB.

## Decisiones
- Usar `--single --skip-install` para builds rápidos de desarrollo en Windows.
- El web UI embebido es necesario para la versión completa; se omite solo si es un build de CLI/server.

## Pendiente
- Verificar si UPX compression post-build es viable para distribuir binarios más chicos.
- Probar `bun run script/build.ts` sin flags para ver si cross-compile funciona en WSL2.
