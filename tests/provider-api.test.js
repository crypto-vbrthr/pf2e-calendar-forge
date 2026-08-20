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

function build({ eventService = null, settings = null } = {}) {
  const calendars = new DefinitionRegistry("calendar");
  const seasons = new DefinitionRegistry("season");
  const moons = new DefinitionRegistry("moon");
  const regions = new DefinitionRegistry("region");
  const astronomy = new DefinitionRegistry("astronomy");
  const holidays = new DefinitionRegistry("holiday");
  const historical = new DefinitionRegistry("historical");
  const eventItems = new Map();
  const events = eventService ?? {
    register(event) { if (eventItems.has(event.id)) throw new Error(`Event '${event.id}' is already registered`); eventItems.set(event.id, structuredClone(event)); },
    unregister(id) { return eventItems.delete(id); },
    unregisterByProvider(providerId) { for (const [id, event] of eventItems) if (event.providerId === providerId) eventItems.delete(id); },
    has(id) { return eventItems.has(id); },
    get(id) { return eventItems.get(id) ?? null; },
    listRegistered() { return [...eventItems.values()]; }
  };
  return {
    calendars, seasons, moons, regions, astronomy, holidays, historical, events,
    api: new ProviderApi({ calendarRegistry: calendars, seasonRegistry: seasons, moonRegistry: moons, regionRegistry: regions, astronomyRegistry: astronomy, holidayRegistry: holidays, historicalRegistry: historical, eventService: events, settings })
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


test("provider descriptor exposes counts, capabilities, and content ownership", () => {
  const { api } = build();
  const descriptor = api.register({
    id: "golarion-foundation",
    schemaVersion: 4,
    contentVersion: "0.1.0",
    calendars: [{ ...calendar, id: "golarion-ar" }],
    defaults: { calendarId: "golarion-ar" }
  });
  assert.equal(descriptor.counts.calendars, 1);
  assert.equal(descriptor.capabilities.calendars, true);
  assert.equal(descriptor.capabilities.moons, false);
  assert.equal(api.owns("golarion-foundation", "calendars", "golarion-ar"), true);
  assert.equal(api.listContent("golarion-foundation").calendars.length, 1);
});

test("provider dependencies are checked before registration", () => {
  const { api, calendars } = build();
  assert.throws(() => api.register({
    id: "golarion-holidays",
    requires: [{ id: "golarion-core", minContentVersion: "1.0.0" }],
    calendars: [{ ...calendar, id: "should-not-register" }]
  }), /requires 'golarion-core'/);
  assert.equal(calendars.has("should-not-register"), false);

  api.register({ id: "golarion-core", contentVersion: "1.2.0", calendars: [{ ...calendar, id: "golarion-ar-core" }] });
  assert.doesNotThrow(() => api.register({ id: "golarion-holidays", requires: [{ id: "golarion-core", minContentVersion: "1.0.0" }] }));
});

test("provider compatibility range rejects unsupported Calendar Forge API", () => {
  const { api } = build();
  assert.throws(() => api.register({ id: "future-pack", compatibility: { api: { min: 999 } } }), /requires Calendar Forge API/);
});

test("registration rolls back definitions if a later event registration fails", () => {
  const badEvents = {
    register() { throw new Error("simulated event failure"); },
    unregister() {}, unregisterByProvider() {}, has() { return false; }, listRegistered() { return []; }
  };
  const { api, calendars } = build({ eventService: badEvents });
  assert.throws(() => api.register({
    id: "rollback-provider",
    calendars: [{ ...calendar, id: "rollback-calendar" }],
    events: [{ id: "broken-event" }]
  }), /simulated event failure/);
  assert.equal(calendars.has("rollback-calendar"), false);
  assert.equal(api.get("rollback-provider"), null);
});

test("unregister removes provider-owned content and protects required providers", () => {
  const { api, calendars, events } = build();
  api.register({ id: "base-provider", calendars: [{ ...calendar, id: "base-calendar" }], events: [{ id: "base-event" }] });
  api.register({ id: "dependent-provider", requires: ["base-provider"] });
  assert.throws(() => api.unregister("base-provider"), /required by 'dependent-provider'/);
  assert.equal(api.unregister("dependent-provider"), true);
  assert.equal(api.unregister("base-provider"), true);
  assert.equal(calendars.has("base-calendar"), false);
  assert.equal(events.has("base-event"), false);
});

test("provider defaults can be applied explicitly by a GM", async () => {
  const calls = [];
  const settings = {
    async setActiveCalendarId(value) { calls.push(["calendar", value]); },
    async setDefaultRegionId(value) { calls.push(["region", value]); },
    async setActiveSeasonProfileId(value) { calls.push(["season", value]); },
    async setActiveMoonProfileIds(value) { calls.push(["moons", value]); }
  };
  globalThis.game = { user: { isGM: true } };
  const { api } = build({ settings });
  api.register({
    id: "defaults-provider",
    calendars: [{ ...calendar, id: "defaults-calendar" }],
    regionProfiles: [{ id: "defaults-region", label: { value: "Region" }, calendarId: "defaults-calendar", seasonProfileId: "defaults-seasons", moonProfileIds: ["defaults-moon"] }],
    seasonProfiles: [{ id: "defaults-seasons", calendarId: "defaults-calendar", label: { value: "Seasons" }, seasons: [{ id: "warm", monthId: "month", day: 1 }] }],
    moonProfiles: [{ id: "defaults-moon", calendarId: "defaults-calendar", label: { value: "Moon" }, cycleLengthDays: 20, referenceWorldTime: 0, referenceProgress: 0, phases: [{ id: "new", start: 0 }] }],
    defaults: { calendarId: "defaults-calendar", regionId: "defaults-region", seasonProfileId: "defaults-seasons", moonProfileIds: ["defaults-moon"] }
  });
  await api.applyDefaults("defaults-provider");
  assert.deepEqual(calls, [["calendar", "defaults-calendar"], ["region", "defaults-region"], ["season", "defaults-seasons"], ["moons", ["defaults-moon"]]]);
});
