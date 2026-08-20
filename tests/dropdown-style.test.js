import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dropdown option lists have explicit dark readable colors", async () => {
  const css = await readFile(new URL("../styles/calendar-forge.css", import.meta.url), "utf8");
  assert.match(css, /\.calendar-forge-manager select option\s*\{/);
  assert.match(css, /background:\s*#272b31/);
  assert.match(css, /color:\s*#e9e5da/);
  assert.match(css, /color-scheme:\s*dark/);
});
