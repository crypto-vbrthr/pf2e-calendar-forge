import test from "node:test";
import assert from "node:assert/strict";
import { validateAstronomyEvent, validateMoonProfile, validateSeasonProfile } from "../scripts/validation/definition-validator.js";

const calendar = {
  id: "c",
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 20 },
  months: [{ id: "m", days: 30, leapDays: 1 }],
  leapYear: { type: "interval", interval: 4 }
};

test("season profile rejects duplicate boundaries", () => {
  assert.throws(() => validateSeasonProfile({ id: "s", calendarId: "c", seasons: [
    { id: "one", monthId: "m", day: 1 }, { id: "two", monthId: "m", day: 1 }
  ] }, calendar), /Duplicate season boundary/);
});

test("moon profile rejects duplicate phase starts", () => {
  assert.throws(() => validateMoonProfile({ id: "moon", calendarId: "c", cycleLengthDays: 20, phases: [
    { id: "a", start: 0 }, { id: "b", start: 0 }
  ] }), /Duplicate moon phase start/);
});

test("astronomical date respects custom calendar clock", () => {
  assert.throws(() => validateAstronomyEvent({ id: "e", calendarId: "c", mode: "date", date: { monthId: "m", day: 1, hour: 20 } }, calendar), /hour is outside/);
});
