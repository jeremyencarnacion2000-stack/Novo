import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("the installed app keeps the island and uses one unified settings surface", () => {
  assert.match(read("index.html"), /src\/main.ts/);
  assert.match(read("companion.html"), /src\/settings\/main.ts/);
  const cfg = JSON.parse(read("src-tauri/tauri.conf.json"));
  const island = cfg.app.windows.find((w) => w.label === "island");
  assert.equal(island.transparent, true);
  assert.equal(island.decorations, false);
  assert.equal(island.alwaysOnTop, true);
  assert.equal(island.skipTaskbar, true);
});
test("every literal island bridge command is wired to the native runtime", () => {
  const bridge = read("src/core/bridge.ts");
  const native = read("src-tauri/src/lib.rs").split(".invoke_handler(tauri::generate_handler![")[1].split("])")[0];
  const commands = [...bridge.matchAll(/call(?:OrThrow)?(?:<[^\n]*?>)?\("([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(commands.length > 50);
  for (const command of commands) assert.match(native, new RegExp("\\b" + command + "\\b"), command);
  const boot = read("src-tauri/src/lib.rs").split("pub fn run()")[1];
  for (const required of ["desktop::setup", "island::spawn_cursor_poll", "pipe::start", "create_settings_window", "shortcuts::apply"]) {
    assert.ok(boot.includes(required), required);
  }
});
test("upstream reserved sounds and the replacement orb are not bundled", () => {
  const vite = read("vite.config.ts");
  assert.doesNotMatch(vite, /sharedSounds|NotchBuddy\/Resources\/sounds|widget.html/);
  assert.doesNotMatch(read("src/core/sound.ts"), /fetch\(.*\.wav/);
  assert.doesNotMatch(read("src-tauri/src/lib.rs"), /widget::setup/);
});

test("release versions agree and keep native identity, helper and legal resources", () => {
  const cfg = JSON.parse(read('src-tauri/tauri.conf.json'));
  const version=JSON.parse(read('package.json')).version;
  assert.match(version,/^\d+\.\d+\.\d+$/);
  assert.equal(JSON.parse(read('package-lock.json')).version,version);
  assert.equal(JSON.parse(read('package-lock.json')).packages[''].version,version);
  assert.equal(cfg.version,version);assert.equal(cfg.productName,'Novo Companion');assert.equal(cfg.identifier,'com.novo.companion');
  assert.ok(read('Cargo.toml').includes(`version = "${version}"`));
  assert.ok(read('Cargo.lock').includes(`name = "novo-companion"\nversion = "${version}"`));
  assert.ok(read('Cargo.lock').includes(`name = "coucou-hook"\nversion = "${version}"`));
  assert.ok(Object.values(cfg.bundle.resources).includes('THIRD-PARTY-LICENSE.txt'));
  assert.ok(Object.values(cfg.bundle.resources).includes('coucou-hook.exe'));
  assert.doesNotMatch(read('vite.config.ts'), /novo-states/);
  assert.match(read('THIRD-PARTY-LICENSE.txt'), /MIT License/);
});
