import test from "node:test";
import assert from "node:assert/strict";
import { DefinitionRegistry } from "../scripts/registry/registry.js";
import { RegionService } from "../scripts/region/region-service.js";
import { TemporalContextService } from "../scripts/time/temporal-context-service.js";

const calendar = {
  id: "regional-test",
  label: { value: "Regional Test" },
  era: { value: "RT" },
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
  week: { days: [0,1,2,3,4,5,6].map((id) => ({ id: `d${id}`, label: { value: `D${id}` } })) },
  months: [{ id: "first", days: 30, label: { value: "First" } }],
  leapYear: { type: "none" },
  dateFormats: { date: { value: "{day} {month} {year}" }, dateTime: { value: "{day} {month} {year} {hour}:{minute}" } },
  defaultAnchor: { worldTime: 0, year: 100, monthId: "first", day: 1, hour: 0, minute: 0, second: 0, weekdayIndex: 0 }
};

globalThis.game = {
  time: { worldTime: 0 },
  i18n: { localize: (key) => key, format: (key) => key },
  user: { isGM: true }
};

function build() {
  const calendars = new DefinitionRegistry("calendar");
  const regions = new DefinitionRegistry("region");
  calendars.register(calendar);
  regions.register({
    id: "east",
    label: { value: "East" },
    calendarId: "regional-test",
    timeOffsetSeconds: 2 * 3600,
    seasonProfileId: null,
    moonProfileIds: []
  });
  const settings = {
    activeCalendarId: () => "regional-test",
    defaultRegionId: () => "east",
    activeSeasonProfileId: () => null,
    activeMoonProfileIds: () => [],
    legacyAnchor: () => calendar.defaultAnchor
  };
  const regionService = new RegionService({ regionRegistry: regions, settings });
  const temporal = new TemporalContextService({
    calendarRegistry: calendars,
    seasonService: { getState: () => null },
    moonService: { getStates: () => [] },
    eventService: { getEventsForDate: async () => [] },
    regionService,
    settings,
    worldData: { getAnchor: () => null }
  });
  return { temporal };
}

test("default region applies local time offset without changing canonical world time", async () => {
  const { temporal } = build();
  const context = await temporal.getTemporalContext({ worldTime: 0 });
  assert.equal(context.worldTime, 0);
  assert.equal(context.localWorldTime, 7200);
  assert.equal(context.regionId, "east");
  assert.equal(context.time.hour, 2);
  assert.equal(context.time.offsetSeconds, 7200);
});

test("explicit null region bypasses default region", async () => {
  const { temporal } = build();
  const context = await temporal.getTemporalContext({ worldTime: 0, regionId: null });
  assert.equal(context.regionId, null);
  assert.equal(context.time.hour, 0);
  assert.equal(context.localWorldTime, 0);
});

test("regional local date converts back to canonical Foundry world time", () => {
  const { temporal } = build();
  const worldTime = temporal.toWorldTime({ year: 100, monthId: "first", day: 1, hour: 2, minute: 0, second: 0 }, { regionId: "east" });
  assert.equal(worldTime, 0);
});
