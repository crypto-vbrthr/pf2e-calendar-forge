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
  const astronomy = new DefinitionRegistry("astronomy");
  const holidays = new DefinitionRegistry("holiday");
  const historical = new DefinitionRegistry("historical");
  const events = { register() {} };
  return {
    calendars,
    regions,
    astronomy,
    holidays,
    historical,
    api: new ProviderApi({ calendarRegistry: calendars, seasonRegistry: seasons, moonRegistry: moons, regionRegistry: regions, astronomyRegistry: astronomy, holidayRegistry: holidays, historicalRegistry: historical, eventService: events })
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


test("provider can register localized season, moon, and astronomical definitions", () => {
  const { api, astronomy } = build();
  api.register({
    id: "sky-provider",
    calendars: [{ ...calendar, id: "sky-calendar" }],
    seasonProfiles: [{ id: "sky-seasons", calendarId: "sky-calendar", label: { value: "Seasons" }, seasons: [{ id: "warm", monthId: "month", day: 1 }] }],
    moonProfiles: [{ id: "sky-moon", calendarId: "sky-calendar", label: { value: "Moon" }, cycleLengthDays: 20, referenceWorldTime: 0, referenceProgress: 0, phases: [{ id: "new", start: 0 }] }],
    astronomyEvents: [{ id: "sky-eclipse", calendarId: "sky-calendar", label: { value: "Eclipse" }, type: "solar-eclipse", mode: "date", date: { monthId: "month", day: 2 } }]
  });
  assert.equal(astronomy.get("sky-eclipse").providerId, "sky-provider");
});


test("provider can register localized holidays and historical events", () => {
  const { api, holidays, historical } = build();
  api.register({
    id: "history-provider",
    calendars: [{ ...calendar, id: "history-calendar" }],
    holidays: [{ id: "feast", calendarId: "history-calendar", label: { i18n: "PACK.Feast" }, recurrence: { type: "yearly", monthId: "month", day: 2 }, durationDays: 2 }],
    historicalEvents: [{ id: "founding", calendarId: "history-calendar", label: { i18n: "PACK.Founding" }, precision: "year", date: { year: 10 } }]
  });
  assert.equal(holidays.get("feast").providerId, "history-provider");
  assert.equal(historical.get("founding").providerId, "history-provider");
});
