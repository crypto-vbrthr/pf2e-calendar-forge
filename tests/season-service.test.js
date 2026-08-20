import test from "node:test";
import assert from "node:assert/strict";
import { DefinitionRegistry } from "../scripts/registry/registry.js";
import { SeasonService } from "../scripts/time/season-service.js";

const calendar = {
  id: "season-calendar",
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
  week: { days: [{ id: "d" }] },
  months: [{ id: "a", days: 30 }, { id: "b", days: 30 }, { id: "c", days: 30 }, { id: "d", days: 30 }],
  leapYear: { type: "none" }
};

globalThis.game = { i18n: { localize: (key) => key } };

test("season service reports progress and next season", () => {
  const registry = new DefinitionRegistry("season");
  registry.register({
    id: "four-seasons",
    calendarId: "season-calendar",
    seasons: [
      { id: "spring", label: { value: "Spring" }, monthId: "a", day: 1 },
      { id: "summer", label: { value: "Summer" }, monthId: "b", day: 1 },
      { id: "autumn", label: { value: "Autumn" }, monthId: "c", day: 1 },
      { id: "winter", label: { value: "Winter" }, monthId: "d", day: 1 }
    ]
  });
  const service = new SeasonService(registry);
  const state = service.getState({ year: 10, monthId: "b", day: 16, dayOfYear: 46 }, calendar, "four-seasons");
  assert.equal(state.id, "summer");
  assert.equal(state.nextSeasonId, "autumn");
  assert.equal(state.lengthDays, 30);
  assert.equal(state.daysElapsed, 15);
  assert.equal(state.progress, 0.5);
});

test("season service handles a season crossing into a leap year", () => {
  const leapCalendar = {
    id: "leap-season-calendar",
    time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
    week: { days: [{ id: "d" }] },
    months: [{ id: "jan", days: 31 }, { id: "feb", days: 28, leapDays: 1 }, { id: "mar", days: 31 }, { id: "dec", days: 31 }],
    leapYear: { type: "gregorian" }
  };
  const registry = new DefinitionRegistry("season");
  registry.register({
    id: "cross-year",
    calendarId: "leap-season-calendar",
    seasons: [
      { id: "spring", label: { value: "Spring" }, monthId: "mar", day: 1 },
      { id: "winter", label: { value: "Winter" }, monthId: "dec", day: 1 }
    ]
  });
  const service = new SeasonService(registry);
  // Jan 1, 2024 belongs to winter that began in 2023. 2024 is a leap year,
  // and the next boundary is Mar 1 after 60 days in the new year.
  const state = service.getState({ year: 2024, monthId: "jan", day: 1, dayOfYear: 1 }, leapCalendar, "cross-year");
  assert.equal(state.id, "winter");
  assert.equal(state.nextSeasonId, "spring");
  assert.equal(state.daysRemaining, 60);
});
