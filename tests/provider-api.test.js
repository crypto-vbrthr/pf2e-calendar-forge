import test from "node:test";
import assert from "node:assert/strict";
import { DefinitionRegistry } from "../scripts/registry/registry.js";
import { ProviderApi } from "../scripts/api/provider-api.js";

const calendar = {
  id: "provider-calendar",
  label: { i18n: "PROVIDER.Calendar" },
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
  week: { days: [{ id: "day", label: { i18n: "PROVIDER.Day" } }] },
  months: [{ id: "month", days: 30, label: { i18n: "PROVIDER.Month" } }],
  leapYear: { type: "none" }
};

globalThis.Hooks = { callAll() {} };

function build() {
  const calendars = new DefinitionRegistry("calendar");
  const seasons = new DefinitionRegistry("season");
  const moons = new DefinitionRegistry("moon");
  const regions = new DefinitionRegistry("region");
  const events = { register() {} };
  return {
    calendars,
    regions,
    api: new ProviderApi({ calendarRegistry: calendars, seasonRegistry: seasons, moonRegistry: moons, regionRegistry: regions, eventService: events })
  };
}

test("provider can register a localized calendar and regional context", () => {
  const { api, calendars, regions } = build();
  api.register({
    id: "provider-module",
    schemaVersion: 1,
    contentVersion: "1.0.0",
    calendars: [calendar],
    regionProfiles: [{ id: "provider-region", label: { i18n: "PROVIDER.Region" }, calendarId: "provider-calendar", timeOffsetSeconds: 3600 }]
  });
  assert.equal(calendars.get("provider-calendar").providerId, "provider-module");
  assert.equal(regions.get("provider-region").calendarId, "provider-calendar");
  assert.equal(api.list()[0].contentVersion, "1.0.0");
});

test("provider rejects duplicate month ids before mutating registries", () => {
  const { api, calendars } = build();
  assert.throws(() => api.register({
    id: "bad-provider",
    calendars: [{ ...calendar, id: "bad-calendar", months: [{ id: "same", days: 30 }, { id: "same", days: 30 }] }]
  }), /Duplicate month id/);
  assert.equal(calendars.has("bad-calendar"), false);
});
