import { CalendarEngine } from "../calendar/calendar-engine.js";

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

function assertId(value, path) {
  assert(typeof value === "string" && /^[a-z0-9][a-z0-9._-]*$/i.test(value), `${path} must be a stable id`);
}

function assertLabel(value, path) {
  if (value == null) return;
  if (typeof value === "string") return;
  assert(typeof value === "object", `${path} must be text or a label object`);
  assert(typeof value.value === "string" || typeof value.i18n === "string", `${path} needs value or i18n`);
}

export function validateCalendarDefinition(definition) {
  assert(definition && typeof definition === "object", "Calendar definition must be an object");
  assertId(definition.id, "calendar.id");
  assertLabel(definition.label, "calendar.label");

  const time = definition.time ?? {};
  for (const [key, fallback] of [["secondsPerMinute", 60], ["minutesPerHour", 60], ["hoursPerDay", 24]]) {
    const value = Number(time[key] ?? fallback);
    assert(Number.isInteger(value) && value > 0, `calendar.time.${key} must be a positive integer`);
  }

  assert(Array.isArray(definition.months) && definition.months.length > 0, "calendar.months must contain at least one month");
  const monthIds = new Set();
  definition.months.forEach((month, index) => {
    assertId(month?.id, `calendar.months[${index}].id`);
    assert(!monthIds.has(month.id), `Duplicate month id '${month.id}'`);
    monthIds.add(month.id);
    assert(Number.isInteger(Number(month.days)) && Number(month.days) > 0, `calendar.months[${index}].days must be positive`);
    if (month.leapDays != null) assert(Number.isInteger(Number(month.leapDays)) && Number(month.leapDays) >= 0, `calendar.months[${index}].leapDays must be non-negative`);
    assertLabel(month.label, `calendar.months[${index}].label`);
    assertLabel(month.shortLabel, `calendar.months[${index}].shortLabel`);
  });

  const weekdays = definition.week?.days ?? [];
  assert(Array.isArray(weekdays) && weekdays.length > 0, "calendar.week.days must contain at least one weekday");
  const weekdayIds = new Set();
  weekdays.forEach((weekday, index) => {
    assertId(weekday?.id, `calendar.week.days[${index}].id`);
    assert(!weekdayIds.has(weekday.id), `Duplicate weekday id '${weekday.id}'`);
    weekdayIds.add(weekday.id);
    assertLabel(weekday.label, `calendar.week.days[${index}].label`);
    assertLabel(weekday.shortLabel, `calendar.week.days[${index}].shortLabel`);
  });

  const leap = definition.leapYear ?? { type: "none" };
  assert(["none", "gregorian", "interval"].includes(leap.type), `Unsupported leap-year rule '${leap.type}'`);
  if (leap.type === "interval") {
    assert(Number.isInteger(Number(leap.interval)) && Number(leap.interval) > 0, "leapYear.interval must be a positive integer");
    if (leap.offset != null) assert(Number.isInteger(Number(leap.offset)), "leapYear.offset must be an integer");
  }

  if (definition.defaultAnchor) validateAnchor(definition.defaultAnchor, definition);
  return true;
}

export function validateAnchor(anchor, calendar) {
  assert(anchor && typeof anchor === "object", "Calendar anchor must be an object");
  assert(Number.isFinite(Number(anchor.worldTime ?? 0)), "anchor.worldTime must be numeric");
  assert(Number.isInteger(Number(anchor.year)), "anchor.year must be an integer");
  assert(calendar.months.some((month) => month.id === anchor.monthId), `anchor.monthId '${anchor.monthId}' is unknown`);
  CalendarEngine.validateDate({
    year: Number(anchor.year),
    monthId: anchor.monthId,
    day: Number(anchor.day),
    hour: Number(anchor.hour ?? 0),
    minute: Number(anchor.minute ?? 0),
    second: Number(anchor.second ?? 0)
  }, calendar);
  const weekdayIndex = Number(anchor.weekdayIndex ?? 0);
  assert(Number.isInteger(weekdayIndex) && weekdayIndex >= 0 && weekdayIndex < calendar.week.days.length, "anchor.weekdayIndex is outside the calendar week");
  return true;
}

export function validateRegionDefinition(definition) {
  assert(definition && typeof definition === "object", "Region definition must be an object");
  assertId(definition.id, "region.id");
  assertLabel(definition.label, "region.label");
  if (definition.calendarId != null) assertId(definition.calendarId, "region.calendarId");
  assert(Number.isFinite(Number(definition.timeOffsetSeconds ?? 0)), "region.timeOffsetSeconds must be numeric");
  if (definition.seasonProfileId != null && definition.seasonProfileId !== "") assertId(definition.seasonProfileId, "region.seasonProfileId");
  if (definition.moonProfileIds != null) {
    assert(Array.isArray(definition.moonProfileIds), "region.moonProfileIds must be an array");
    definition.moonProfileIds.forEach((id, index) => assertId(id, `region.moonProfileIds[${index}]`));
  }
  return true;
}

export function slugifyId(value, fallback = "entry") {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || fallback;
}
