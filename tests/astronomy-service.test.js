import test from "node:test";
import assert from "node:assert/strict";
import { DefinitionRegistry } from "../scripts/registry/registry.js";
import { AstronomyService } from "../scripts/time/astronomy-service.js";
import { CalendarEngine } from "../scripts/calendar/calendar-engine.js";

const calendar = {
  id: "astro-calendar",
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
  months: [{ id: "alpha", days: 30 }]
};

globalThis.game = { user: { isGM: true }, i18n: { localize: (key) => key } };

test("fixed astronomical event can recur every year", () => {
  const registry = new DefinitionRegistry("astronomy");
  registry.register({
    id: "eclipse",
    label: { value: "Eclipse" },
    type: "solar-eclipse",
    calendarId: "astro-calendar",
    mode: "date",
    date: { year: null, monthId: "alpha", day: 5, hour: 12, minute: 0, second: 0 }
  });
  const service = new AstronomyService(registry);
  const day = 86400;
  const events = service.getEventsForDate({ year: 77, monthId: "alpha", day: 5 }, { calendar, dayStartWorldTime: 4 * day, dayEndWorldTime: 5 * day });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "solar-eclipse");
  assert.equal(events[0].worldTime, 4.5 * day);
});

test("cyclic astronomical event can generate an occurrence inside the local day", () => {
  const registry = new DefinitionRegistry("astronomy");
  registry.register({
    id: "comet-pass",
    label: { value: "Comet" },
    type: "comet",
    calendarId: "astro-calendar",
    mode: "cycle",
    cycleLengthDays: 10,
    referenceWorldTime: 3 * 86400
  });
  const service = new AstronomyService(registry);
  const events = service.getEventsForDate({ year: 1, monthId: "alpha", day: 14 }, { calendar, dayStartWorldTime: 13 * 86400, dayEndWorldTime: 14 * 86400 });
  assert.equal(events.length, 1);
  assert.equal(events[0].worldTime, 13 * 86400);
});

test("astronomy range query returns yearly fixed-date occurrences without scanning every day", () => {
  globalThis.game = { user: { isGM: true } };
  const rangeCalendar = {
    id: "range-calendar",
    time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
    week: { days: Array.from({ length: 7 }, (_v, i) => ({ id: `d${i}` })) },
    months: [
      { id: "january", days: 31 }, { id: "february", days: 28 }, { id: "march", days: 31 },
      { id: "april", days: 30 }, { id: "may", days: 31 }, { id: "june", days: 30 },
      { id: "july", days: 31 }, { id: "august", days: 31 }, { id: "september", days: 30 },
      { id: "october", days: 31 }, { id: "november", days: 30 }, { id: "december", days: 31 }
    ],
    leapYear: { type: "none" }
  };
  const registry = new DefinitionRegistry("astronomy");
  registry.register({
    id: "equinox",
    calendarId: rangeCalendar.id,
    label: { value: "Equinox" },
    type: "equinox",
    visibility: "public",
    mode: "date",
    date: { monthId: "march", day: 20, hour: 6 }
  });
  const service = new AstronomyService(registry);
  const anchor = { worldTime: 0, year: 2026, monthId: "january", day: 1, hour: 0, minute: 0, second: 0, weekdayIndex: 3 };
  const start = CalendarEngine.toWorldTime({ year: 2026, monthId: "january", day: 1, hour: 0, minute: 0, second: 0 }, rangeCalendar, anchor);
  const end = CalendarEngine.toWorldTime({ year: 2027, monthId: "january", day: 1, hour: 0, minute: 0, second: 0 }, rangeCalendar, anchor);
  const events = service.getEventsBetween(start, end, {
    calendar: rangeCalendar,
    dateFromWorldTime: (worldTime) => CalendarEngine.fromWorldTime(worldTime, rangeCalendar, anchor),
    dateToWorldTime: (date) => CalendarEngine.toWorldTime(date, rangeCalendar, anchor)
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "equinox");
});
