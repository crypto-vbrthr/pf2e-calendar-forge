import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function flatten(value, prefix = "") {
  const out = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) out.push(...flatten(child, path));
    else out.push(path);
  }
  return out.sort();
}

test("German and English localization keys stay in parity", async () => {
  const de = JSON.parse(await readFile(new URL("../lang/de.json", import.meta.url), "utf8"));
  const en = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8"));
  assert.deepEqual(flatten(de), flatten(en));
});
