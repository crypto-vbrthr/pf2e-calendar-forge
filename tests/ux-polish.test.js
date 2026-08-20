import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const calendarTemplate = fs.readFileSync(new URL("../templates/calendar-app.hbs", import.meta.url), "utf8");
const managerTemplate = fs.readFileSync(new URL("../templates/calendar-manager.hbs", import.meta.url), "utf8");
const chronicleTemplate = fs.readFileSync(new URL("../templates/chronicle-app.hbs", import.meta.url), "utf8");
const settingsSource = fs.readFileSync(new URL("../scripts/settings.js", import.meta.url), "utf8");

test("main calendar exposes month/year views, date jump, legend, and alternate-name toggle", () => {
  assert.match(calendarTemplate, /data-mode="year"/);
  assert.match(calendarTemplate, /data-action="jumpToDate"/);
  assert.match(calendarTemplate, /cf-marker-legend/);
  assert.match(calendarTemplate, /data-action="toggleAlternateNames"/);
});

test("calendar editor exposes alternate labels for months and weekdays", () => {
  assert.match(managerTemplate, /data-field="alternateLabel"/);
  assert.match(managerTemplate, /data-field="alternateShortLabel"/);
  assert.match(managerTemplate, /CALENDAR_FORGE\.Fields\.AlternateName/);
});

test("alternate-name display preference is client scoped", () => {
  assert.match(settingsSource, /SETTINGS\.SHOW_ALTERNATE_NAMES/);
  assert.match(settingsSource, /scope: "client"/);
  assert.match(settingsSource, /type: Boolean/);
});

test("chronicle offers quick-range, reset, sorting, and calendar navigation controls", () => {
  assert.match(chronicleTemplate, /data-action="currentYear"/);
  assert.match(chronicleTemplate, /data-action="resetFilters"/);
  assert.match(chronicleTemplate, /data-action="toggleSort"/);
  assert.match(chronicleTemplate, /data-action="openInCalendar"/);
});


test("0.6.1 makes alternate-name state explicit and keeps percentage labels unambiguous", () => {
  assert.match(calendarTemplate, /cf-alternate-toggle/);
  assert.match(calendarTemplate, /aria-pressed=/);
  assert.match(calendarTemplate, /alternateNamesShort/);
  assert.match(calendarTemplate, /alternateNamesTooltip/);
  assert.match(calendarTemplate, /selected\.season\.progressLabel/);
  assert.match(calendarTemplate, /moon\.illuminationLabel/);
});
