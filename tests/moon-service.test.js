import test from "node:test";
import assert from "node:assert/strict";
import { DefinitionRegistry } from "../scripts/registry/registry.js";
import { MoonService } from "../scripts/time/moon-service.js";

const calendar = {
  id: "moon-calendar",
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 }
};

globalThis.game = { i18n: { localize: (key) => key } };

test("moon service reports phase, illumination, and next phase", () => {
  const registry = new DefinitionRegistry("moon");
  registry.register({
    id: "luna",
    calendarId: "moon-calendar",
    label: { value: "Luna" },
    cycleLengthDays: 8,
    referenceWorldTime: 0,
    referenceProgress: 0,
    phases: [
      { id: "new", start: 0, label: { value: "New" }, marker: true },
      { id: "quarter", start: 0.25, label: { value: "Quarter" }, marker: true },
      { id: "full", start: 0.5, label: { value: "Full" }, marker: true },
      { id: "last", start: 0.75, label: { value: "Last" }, marker: true }
    ]
  });
  const service = new MoonService(registry);
  const day = 86400;
  const state = service.getStates(4 * day, calendar, ["luna"])[0];
  assert.equal(state.phase, "full");
  assert.ok(state.illumination > 0.999);
  assert.equal(state.nextPhase, "last");
  assert.equal(state.daysUntilNextPhase, 2);
});

test("moon service returns marked phase transitions across a day", () => {
  const registry = new DefinitionRegistry("moon");
  registry.register({
    id: "luna",
    calendarId: "moon-calendar",
    label: { value: "Luna" },
    cycleLengthDays: 8,
    referenceWorldTime: 0,
    referenceProgress: 0,
    phases: [
      { id: "new", start: 0, label: { value: "New" }, marker: true },
      { id: "quarter", start: 0.25, label: { value: "Quarter" }, marker: true }
    ]
  });
  const service = new MoonService(registry);
  const day = 86400;
  const transitions = service.getTransitionsBetween(2 * day - 1, 3 * day, calendar, ["luna"], { markersOnly: true });
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].phase, "quarter");
  assert.equal(transitions[0].worldTime, 2 * day);
});

test("moon referenceDate follows the calendar anchor instead of an arbitrary worldTime epoch", () => {
  const registry = new DefinitionRegistry("moon");
  const datedCalendar = {
    id: "moon-calendar",
    time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
    week: { days: [{ id: "day" }] },
    months: [{ id: "m1", days: 30 }, { id: "m2", days: 30 }],
    leapYear: { type: "none" }
  };
  registry.register({
    id: "dated-moon",
    calendarId: "moon-calendar",
    label: { value: "Dated Moon" },
    cycleLengthDays: 8,
    referenceDate: { year: 10, monthId: "m1", day: 1 },
    referenceProgress: 0.25,
    phases: [
      { id: "new", start: 0, label: { value: "New" } },
      { id: "quarter", start: 0.25, label: { value: "Quarter" } },
      { id: "full", start: 0.5, label: { value: "Full" } }
    ]
  });
  const service = new MoonService(registry);
  const day = 86400;
  const anchorA = { worldTime: 0, year: 10, monthId: "m1", day: 1, hour: 0, minute: 0, second: 0, weekdayIndex: 0 };
  const anchorB = { worldTime: 11 * day, year: 10, monthId: "m1", day: 1, hour: 0, minute: 0, second: 0, weekdayIndex: 0 };

  assert.equal(service.getStates(0, datedCalendar, ["dated-moon"], { anchor: anchorA })[0].phase, "quarter");
  assert.equal(service.getStates(11 * day, datedCalendar, ["dated-moon"], { anchor: anchorB })[0].phase, "quarter");
});
