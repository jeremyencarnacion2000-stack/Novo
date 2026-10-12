// Loaded before every test file (see the `test` script in package.json).
// Node runs the island's TypeScript as it is; this only supplies what the
// webview and the bundler normally would.

import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
import { internals, eventPluginInternals } from "./tauri.mjs";

// The sources import each other without an extension, which Vite resolves.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const ours = !context.parentURL?.includes("/node_modules/");
    if (ours && specifier.startsWith(".") && !/\.(?:[cm]?[jt]s|json)$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
  // Vite imports JSON (src/i18n/*.json) without `with { type: "json" }`;
  // Node would refuse it, so it is handed over as a module.
  load(url, context, nextLoad) {
    // This existing module uses a TS parameter property. Transform it for
    // runtime renderer tests, without changing the production sequence.
    if (url.endsWith('/src/upload/sequence.ts')) {
      const result = nextLoad(url, context);
      return { ...result, format: 'module', source: stripTypeScriptTypes(String(result.source), { mode: 'transform', disableWarning: true }) };
    }
    if (url.startsWith("file:") && url.endsWith(".json") && !url.includes("/node_modules/")) {
      const source = readFileSync(fileURLToPath(url), "utf8");
      return { format: "module", source: `export default ${source};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

// The island reaches timers and Tauri through `window`.
globalThis.window = globalThis;
globalThis.__TAURI_INTERNALS__ = internals;
globalThis.__TAURI_EVENT_PLUGIN_INTERNALS__ = eventPluginInternals;
