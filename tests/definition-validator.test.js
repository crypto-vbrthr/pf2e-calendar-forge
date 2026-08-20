import test from "node:test";
import assert from "node:assert/strict";
import { validateAnchor, validateCalendarDefinition, validateRegionDefinition } from "../scripts/validation/definition-validator.js";

const calendar = {
  id: "validator-test",
  label: { value: "Validator Test" },
  time: { secondsPerMinute: 50, minutesPerHour: 50, hoursPerDay: 20 },
  week: { days: [{ id: "one", label: { value: "One" } }, { id: "two", label: { value: "Two" } }] },
  months: [{ id: "alpha", days: 30 }, { id: "beta", days: 25, leapDays: 1 }],
  leapYear: { type: "interval", interval: 4, offset: 1 }
};

test("calendar validator accepts non-Earth time structures", () => {
  assert.equal(validateCalendarDefinition(calendar), true);
});

test("anchor validator enforces fantasy clock limits", () => {
  assert.throws(() => validateAnchor({ worldTime: 0, year: 1, monthId: "alpha", day: 1, hour: 20, minute: 0, second: 0, weekdayIndex: 0 }, calendar), /hour must be between/);
});

test("region validator allows translated labels and fixed negative offsets", () => {
  assert.equal(validateRegionDefinition({ id: "west", label: { i18n: "TEST.Region.West" }, calendarId: "validator-test", timeOffsetSeconds: -19800 }), true);
});
