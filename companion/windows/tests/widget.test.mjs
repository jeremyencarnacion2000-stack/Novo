import test from "node:test";
import assert from "node:assert/strict";
import { sent } from "./tauri.mjs";

test("clicking the desktop widget opens the existing Novo companion window", async () => {
  let onClick;
  const button = {
    addEventListener(type, listener) {
      assert.equal(type, "click");
      onClick = listener;
    },
  };
  globalThis.document = {
    querySelector(selector) {
      assert.equal(selector, "#open-companion");
      return button;
    },
  };

  await import("../src/widget.ts");
  assert.equal(typeof onClick, "function");

  onClick();
  await new Promise(setImmediate);

  assert.deepEqual(sent("novo_widget_open"), [{}]);
});
