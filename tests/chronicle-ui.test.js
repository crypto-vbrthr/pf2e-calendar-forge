import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("calendar exposes chronicle launcher and day event links", async () => {
  const template = await readFile(new URL("../templates/calendar-app.hbs", import.meta.url), "utf8");
  assert.match(template, /data-action="openChronicle"/);
  assert.match(template, /data-action="openEventDocument"/);
});

test("chronicle UI contains chronicle, holiday, and historical tabs", async () => {
  const template = await readFile(new URL("../templates/chronicle-app.hbs", import.meta.url), "utf8");
  assert.match(template, /data-mode="chronicle"/);
  assert.match(template, /data-mode="holidays"/);
  assert.match(template, /data-mode="historical"/);
});
