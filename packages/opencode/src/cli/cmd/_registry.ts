// vMK: lazy module loaders — Bun.compile() bundles via dynamic import() with string literals.
// vMK: Arrow functions wrap import() so modules are bundled but NOT evaluated until invoked.
// vMK: --help and --version now load 0 command modules (down from 23).

/** vMK: maps import paths to lazy loader functions.
 *  Bun's static analyzer traces the string literals inside arrow functions
 *  and bundles the target modules. The modules' top-level code does NOT
 *  execute until the loader is called for the first time.
 */
export const cmdLoaders: Record<string, () => Promise<any>> = {
  "./cli/cmd/acp": () => import("./acp"),
  "./cli/cmd/attach": () => import("./attach"),
  "./cli/cmd/agent": () => import("./agent"),
  "./cli/cmd/account": () => import("./account"),
  "./cli/cmd/db": () => import("./db"),
  "./cli/cmd/debug": () => import("./debug"),
  "./cli/cmd/export": () => import("./export"),
  "./cli/cmd/generate": () => import("./generate"),
  "./cli/cmd/github": () => import("./github"),
  "./cli/cmd/import": () => import("./import"),
  "./cli/cmd/mcp": () => import("./mcp"),
  "./cli/cmd/models": () => import("./models"),
  "./cli/cmd/plug": () => import("./plug"),
  "./cli/cmd/pr": () => import("./pr"),
  "./cli/cmd/providers": () => import("./providers"),
  "./cli/cmd/run": () => import("./run"),
  "./cli/cmd/serve": () => import("./serve"),
  "./cli/cmd/session": () => import("./session"),
  "./cli/cmd/stats": () => import("./stats"),
  "./cli/cmd/tui": () => import("./tui"),
  "./cli/cmd/uninstall": () => import("./uninstall"),
  "./cli/cmd/upgrade": () => import("./upgrade"),
  "./cli/cmd/web": () => import("./web"),
}
