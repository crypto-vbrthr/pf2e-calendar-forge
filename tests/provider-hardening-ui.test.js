import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Calendar Forge exposes provider diagnostics from the main calendar", () => {
  const app = fs.readFileSync(new URL("../scripts/ui/calendar-app.js", import.meta.url), "utf8");
  const template = fs.readFileSync(new URL("../templates/calendar-app.hbs", import.meta.url), "utf8");
  const providerTemplate = fs.readFileSync(new URL("../templates/provider-manager.hbs", import.meta.url), "utf8");
  assert.match(app, /manageProviders/);
  assert.match(template, /fa-puzzle-piece/);
  assert.match(providerTemplate, /applyDefaults/);
  assert.match(providerTemplate, /contentVersion/);
});
