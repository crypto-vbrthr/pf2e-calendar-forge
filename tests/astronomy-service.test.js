import test from "node:test";
import assert from "node:assert/strict";
import { DefinitionRegistry } from "../scripts/registry/registry.js";
import { AstronomyService } from "../scripts/time/astronomy-service.js";

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
