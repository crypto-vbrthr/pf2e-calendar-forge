import test from "node:test";
import assert from "node:assert/strict";
import { formatCalendarDate, getCalendarNameSet } from "../scripts/localization/date-formatter.js";
import { validateCalendarDefinition } from "../scripts/validation/definition-validator.js";

const calendar = {
  id: "fantasy",
  label: { value: "Fantasy" },
  era: { value: "AR" },
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
  week: { days: [
    { id: "moonday", label: { value: "Moonday" }, shortLabel: { value: "Moon" }, alternateLabel: { value: "Monday" }, alternateShortLabel: { value: "Mon" } }
  ] },
  months: [
    { id: "rova", days: 30, label: { value: "Rova" }, shortLabel: { value: "Rov" }, alternateLabel: { value: "September" }, alternateShortLabel: { value: "Sep" } }
  ],
  leapYear: { type: "none" },
  dateFormats: { date: { value: "{weekday}, {day}. {month} {year} {era}" }, dateTime: { value: "{weekday}, {day}. {month} {year} {era}, {hour}:{minute}" } }
};

globalThis.game = { i18n: { localize: (key) => key } };

test("calendar schema accepts localized alternate month and weekday names", () => {
  assert.equal(validateCalendarDefinition(calendar), true);
});

test("name set exposes alternate labels independently of display preference", () => {
  const names = getCalendarNameSet({ monthIndex: 0, weekdayIndex: 0 }, calendar);
  assert.equal(names.month, "Rova");
  assert.equal(names.monthAlternate, "September");
  assert.equal(names.weekday, "Moonday");
  assert.equal(names.weekdayAlternate, "Monday");
});

test("date formatter can add alternate names without replacing canonical names", () => {
  const date = { year: 4726, monthIndex: 0, weekdayIndex: 0, day: 19, hour: 14, minute: 5, second: 0 };
  assert.equal(formatCalendarDate(date, calendar), "Moonday, 19. Rova 4726 AR");
  assert.equal(formatCalendarDate(date, calendar, { includeAlternate: true }), "Moonday (Monday), 19. Rova (September) 4726 AR");
});
