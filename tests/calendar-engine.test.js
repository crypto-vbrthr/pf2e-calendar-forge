import test from "node:test";
import assert from "node:assert/strict";
import { CalendarEngine } from "../scripts/calendar/calendar-engine.js";

const calendar = {
  id: "test",
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
  week: { days: [0,1,2,3,4,5,6].map((id) => ({ id: String(id) })) },
  months: [
    { id: "jan", days: 31 },
    { id: "feb", days: 28, leapDays: 1 },
    { id: "mar", days: 31 }
  ],
  leapYear: { type: "gregorian" }
};
const anchor = {
  worldTime: 0,
  year: 2024,
  monthId: "jan",
  day: 1,
  hour: 0,
  minute: 0,
  second: 0,
  weekdayIndex: 0
};

test("world time advances through leap day", () => {
  const worldTime = CalendarEngine.toWorldTime({ year: 2024, monthId: "mar", day: 1 }, calendar, anchor);
  assert.equal(worldTime, 60 * 24 * 60 * 60);
  const date = CalendarEngine.fromWorldTime(worldTime, calendar, anchor);
  assert.equal(date.year, 2024);
  assert.equal(date.monthId, "mar");
  assert.equal(date.day, 1);
});

test("non leap year has 59 days before March", () => {
  const target = { year: 2025, monthId: "mar", day: 1, hour: 0, minute: 0, second: 0 };
  const worldTime = CalendarEngine.toWorldTime(target, calendar, anchor);
  const start2025 = CalendarEngine.toWorldTime({ year: 2025, monthId: "jan", day: 1 }, calendar, anchor);
  assert.equal((worldTime - start2025) / 86400, 59);
});

test("negative world time moves before anchor", () => {
  const date = CalendarEngine.fromWorldTime(-86400, calendar, anchor);
  assert.equal(date.year, 2023);
  assert.equal(date.monthId, "mar");
  assert.equal(date.day, 31);
  assert.equal(date.weekdayIndex, 6);
});

test("round trip preserves date and time", () => {
  const original = { year: 2027, monthId: "feb", day: 14, hour: 17, minute: 42, second: 11 };
  const worldTime = CalendarEngine.toWorldTime(original, calendar, anchor);
  const roundTrip = CalendarEngine.fromWorldTime(worldTime, calendar, anchor);
  assert.deepEqual(
    { year: roundTrip.year, monthId: roundTrip.monthId, day: roundTrip.day, hour: roundTrip.hour, minute: roundTrip.minute, second: roundTrip.second },
    original
  );
});

test("month shifting crosses year boundaries", () => {
  assert.deepEqual(CalendarEngine.shiftMonth(2024, 0, -1, calendar), { year: 2023, monthIndex: 2, monthId: "mar" });
  assert.deepEqual(CalendarEngine.shiftMonth(2024, 2, 1, calendar), { year: 2025, monthIndex: 0, monthId: "jan" });
});

test("custom fantasy calendar supports non-Earth months and leap interval", () => {
  const fantasy = {
    id: "fantasy",
    time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 20 },
    week: { days: [0,1,2,3,4].map((id) => ({ id: String(id) })) },
    months: [
      { id: "ember", days: 30 },
      { id: "harvest", days: 30, leapDays: 1 },
      { id: "frost", days: 30 }
    ],
    leapYear: { type: "interval", interval: 3, offset: 0 }
  };
  const fantasyAnchor = {
    worldTime: 1000,
    year: 900,
    monthId: "ember",
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    weekdayIndex: 0
  };
  assert.equal(CalendarEngine.daysInYear(900, fantasy), 91);
  assert.equal(CalendarEngine.daysInYear(901, fantasy), 90);
  const target = { year: 903, monthId: "harvest", day: 31, hour: 19, minute: 59, second: 59 };
  const worldTime = CalendarEngine.toWorldTime(target, fantasy, fantasyAnchor);
  const roundTrip = CalendarEngine.fromWorldTime(worldTime, fantasy, fantasyAnchor);
  assert.equal(roundTrip.monthId, "harvest");
  assert.equal(roundTrip.day, 31);
  assert.equal(roundTrip.hour, 19);
  assert.equal(roundTrip.weekdayIndex >= 0 && roundTrip.weekdayIndex < 5, true);
});

test("day shifting and day distance cross fantasy year boundaries", () => {
  const tiny = {
    id: "tiny",
    time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
    week: { days: [{ id: "d" }] },
    months: [{ id: "a", days: 3 }, { id: "b", days: 2 }],
    leapYear: { type: "none" }
  };
  const shifted = CalendarEngine.shiftDateByDays({ year: 4, monthId: "b", day: 2 }, 2, tiny);
  assert.deepEqual({ year: shifted.year, monthId: shifted.monthId, day: shifted.day }, { year: 5, monthId: "a", day: 2 });
  assert.equal(CalendarEngine.daysBetween({ year: 4, monthId: "b", day: 2 }, { year: 5, monthId: "a", day: 2 }, tiny), 2);
});
