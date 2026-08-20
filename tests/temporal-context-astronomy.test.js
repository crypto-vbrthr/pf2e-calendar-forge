import test from "node:test";
import assert from "node:assert/strict";
import { DefinitionRegistry } from "../scripts/registry/registry.js";
import { RegionService } from "../scripts/region/region-service.js";
import { SeasonService } from "../scripts/time/season-service.js";
import { MoonService } from "../scripts/time/moon-service.js";
import { AstronomyService } from "../scripts/time/astronomy-service.js";
import { TemporalContextService } from "../scripts/time/temporal-context-service.js";

const calendar = {
  id: "ctx-calendar",
  label: { value: "Context" },
  era: { value: "" },
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
  week: { days: [{ id: "d0", label: { value: "D0" } }] },
  months: [{ id: "month", days: 30, label: { value: "Month" } }],
  leapYear: { type: "none" },
  dateFormats: { date: { value: "{day} {month} {year}" }, dateTime: { value: "{day} {month} {year} {hour}:{minute}" } },
  defaultAnchor: { worldTime: 0, year: 1, monthId: "month", day: 1, hour: 0, minute: 0, second: 0, weekdayIndex: 0 }
};

globalThis.game = {
  time: { worldTime: 0 },
  user: { isGM: true },
  i18n: { localize: (key) => key, format: (key) => key }
};

test("temporal context exposes season, moon transition and astronomical event on the regional day", async () => {
  const calendars = new DefinitionRegistry("calendar");
  const regions = new DefinitionRegistry("region");
  const seasons = new DefinitionRegistry("season");
  const moons = new DefinitionRegistry("moon");
  const astronomy = new DefinitionRegistry("astronomy");
  calendars.register(calendar);
  seasons.register({ id: "seasons", calendarId: "ctx-calendar", seasons: [{ id: "warm", monthId: "month", day: 1, label: { value: "Warm" } }] });
  moons.register({
    id: "moon", calendarId: "ctx-calendar", label: { value: "Moon" }, cycleLengthDays: 4, referenceWorldTime: 0, referenceProgress: 0,
    phases: [{ id: "new", start: 0, label: { value: "New" }, marker: true }, { id: "full", start: 0.5, label: { value: "Full" }, marker: true }]
  });
  astronomy.register({ id: "meteor", calendarId: "ctx-calendar", label: { value: "Meteor" }, type: "meteor-shower", mode: "date", date: { monthId: "month", day: 1, hour: 6 } });
  const settings = {
    activeCalendarId: () => "ctx-calendar",
    defaultRegionId: () => null,
    activeSeasonProfileId: () => "seasons",
    activeMoonProfileIds: () => ["moon"],
    legacyAnchor: () => calendar.defaultAnchor
  };
  const temporal = new TemporalContextService({
    calendarRegistry: calendars,
    seasonService: new SeasonService(seasons),
    moonService: new MoonService(moons),
    astronomyService: new AstronomyService(astronomy),
    eventService: { getEventsForDate: async () => [] },
    regionService: new RegionService({ regionRegistry: regions, settings }),
    settings,
    worldData: { getAnchor: () => null }
  });
  const context = await temporal.getTemporalContext({ worldTime: 0, regionId: null });
  assert.equal(context.season.id, "warm");
  assert.equal(context.moonTransitions[0].phase, "new");
  assert.equal(context.astronomicalEvents[0].type, "meteor-shower");
  assert.equal(context.astronomicalEvents[0].formattedTime, "06:00");
});
