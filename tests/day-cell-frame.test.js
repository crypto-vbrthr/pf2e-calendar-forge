import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../styles/calendar-forge.css", import.meta.url), "utf8");

test("month view day cells use a complete subtle frame", () => {
  const dayBlock = css.match(/\.cf-day\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  assert.match(dayBlock, /border:\s*1px solid rgba\(255,255,255,0\.075\)/);
  assert.match(dayBlock, /border-radius:\s*2px/);
  assert.doesNotMatch(dayBlock, /border-right:/);
  assert.doesNotMatch(dayBlock, /border-bottom:/);
});

test("day hover and selected states strengthen the frame without replacing it", () => {
  assert.match(css, /button\.cf-day:hover\s*\{[^}]*border-color:/);
  assert.match(css, /\.cf-day\.is-selected\s*\{[^}]*border-color:/);
  assert.match(css, /\.cf-day\.is-today\s*\{[^}]*box-shadow:/);
});
