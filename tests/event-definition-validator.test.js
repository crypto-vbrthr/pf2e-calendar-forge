import test from "node:test";
import assert from "node:assert/strict";
import { validateHistoricalEvent, validateHolidayDefinition } from "../scripts/validation/definition-validator.js";

const calendar = {
  id: "c",
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
  week: { days: [{ id: "d" }] },
  months: [{ id: "first", days: 30 }, { id: "second", days: 30 }],
  leapYear: { type: "none" }
};

test("holiday validator accepts localized multi-day regional holiday", () => {
  assert.equal(validateHolidayDefinition({
    id: "festival",
    calendarId: "c",
    label: { i18n: "PACK.Festival" },
    regionId: "north",
    recurrence: { type: "yearly", monthId: "second", day: 30 },
    durationDays: 4,
    visibility: "public"
  }, calendar), true);
});

test("historical validator preserves year precision without fake month or day", () => {
  assert.equal(validateHistoricalEvent({
    id: "old-war",
    calendarId: "c",
    label: { value: "Old War" },
    precision: "year",
    date: { year: -120 },
    visibility: "gm"
  }, calendar), true);
});

test("historical validator enforces clock bounds at minute precision", () => {
  assert.throws(() => validateHistoricalEvent({
    id: "bad-time",
    calendarId: "c",
    label: { value: "Bad" },
    precision: "minute",
    date: { year: 2, monthId: "first", day: 1, hour: 25, minute: 0 },
    visibility: "public"
  }, calendar), /outside the calendar day/);
});
