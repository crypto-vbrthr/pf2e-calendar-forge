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
    assertLabel(month.alternateLabel, `calendar.months[${index}].alternateLabel`);
    assertLabel(month.alternateShortLabel, `calendar.months[${index}].alternateShortLabel`);
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
    assertLabel(weekday.alternateLabel, `calendar.week.days[${index}].alternateLabel`);
    assertLabel(weekday.alternateShortLabel, `calendar.week.days[${index}].alternateShortLabel`);
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

export function validateSeasonProfile(definition, calendar = null) {
  assert(definition && typeof definition === "object", "Season profile must be an object");
  assertId(definition.id, "season.id");
  assertLabel(definition.label, "season.label");
  assertId(definition.calendarId, "season.calendarId");
  assert(Array.isArray(definition.seasons) && definition.seasons.length > 0, "season.seasons must contain at least one season");
  const ids = new Set();
  const boundaries = new Set();
  definition.seasons.forEach((season, index) => {
    assertId(season?.id, `season.seasons[${index}].id`);
    assert(!ids.has(season.id), `Duplicate season id '${season.id}'`);
    ids.add(season.id);
    assertLabel(season.label, `season.seasons[${index}].label`);
    assert(typeof season.monthId === "string" && season.monthId.length > 0, `season.seasons[${index}].monthId is required`);
    assert(Number.isInteger(Number(season.day)) && Number(season.day) > 0, `season.seasons[${index}].day must be positive`);
    if (calendar) {
      const monthIndex = calendar.months.findIndex((month) => month.id === season.monthId);
      assert(monthIndex >= 0, `season.seasons[${index}].monthId '${season.monthId}' is unknown`);
      const month = calendar.months[monthIndex];
      const max = Number(month.days) + Number(month.leapDays ?? 0);
      assert(Number(season.day) <= max, `season.seasons[${index}].day is outside month '${season.monthId}'`);
    }
    const boundary = `${season.monthId}:${Number(season.day)}`;
    assert(!boundaries.has(boundary), `Duplicate season boundary '${boundary}'`);
    boundaries.add(boundary);
  });
  return true;
}

export function validateMoonProfile(definition, calendar = null) {
  assert(definition && typeof definition === "object", "Moon profile must be an object");
  assertId(definition.id, "moon.id");
  assertLabel(definition.label, "moon.label");
  assertId(definition.calendarId, "moon.calendarId");
  assert(Number.isFinite(Number(definition.cycleLengthDays)) && Number(definition.cycleLengthDays) > 0, "moon.cycleLengthDays must be positive");
  assert(Number.isFinite(Number(definition.referenceWorldTime ?? 0)), "moon.referenceWorldTime must be numeric");
  if (definition.referenceDate != null) {
    assert(definition.referenceDate && typeof definition.referenceDate === "object", "moon.referenceDate must be an object");
    assert(Number.isInteger(Number(definition.referenceDate.year)), "moon.referenceDate.year must be an integer");
    assertId(definition.referenceDate.monthId, "moon.referenceDate.monthId");
    assert(Number.isInteger(Number(definition.referenceDate.day)) && Number(definition.referenceDate.day) > 0, "moon.referenceDate.day must be positive");
    if (calendar) {
      const monthIndex = calendar.months.findIndex((month) => month.id === definition.referenceDate.monthId);
      assert(monthIndex >= 0, `moon.referenceDate.monthId '${definition.referenceDate.monthId}' is unknown`);
      if (monthIndex >= 0) {
        const maxDay = Number(calendar.months[monthIndex].days) + Number(calendar.months[monthIndex].leapDays ?? 0);
        assert(Number(definition.referenceDate.day) <= maxDay, `moon.referenceDate.day is outside month '${definition.referenceDate.monthId}'`);
      }
    }
  }
  const progress = Number(definition.referenceProgress ?? 0);
  assert(Number.isFinite(progress) && progress >= 0 && progress < 1, "moon.referenceProgress must be between 0 and 1");
  assert(Array.isArray(definition.phases) && definition.phases.length > 0, "moon.phases must contain at least one phase");
  const ids = new Set();
  const starts = new Set();
  definition.phases.forEach((phase, index) => {
    assertId(phase?.id, `moon.phases[${index}].id`);
    assert(!ids.has(phase.id), `Duplicate moon phase id '${phase.id}'`);
    ids.add(phase.id);
    assertLabel(phase.label, `moon.phases[${index}].label`);
    const start = Number(phase.start);
    assert(Number.isFinite(start) && start >= 0 && start < 1, `moon.phases[${index}].start must be between 0 and 1`);
    assert(!starts.has(start), `Duplicate moon phase start '${start}'`);
    starts.add(start);
  });
  return true;
}

export function validateAstronomyEvent(definition, calendar = null) {
  assert(definition && typeof definition === "object", "Astronomical event must be an object");
  assertId(definition.id, "astronomy.id");
  assertLabel(definition.label, "astronomy.label");
  assertId(definition.calendarId, "astronomy.calendarId");
  if (definition.regionId) assertId(definition.regionId, "astronomy.regionId");
  if (definition.regionIds != null) {
    assert(Array.isArray(definition.regionIds), "astronomy.regionIds must be an array");
    definition.regionIds.forEach((id, index) => assertId(id, `astronomy.regionIds[${index}]`));
  }
  assert(["public", "gm"].includes(definition.visibility ?? "public"), "astronomy.visibility must be public or gm");
  const mode = definition.mode ?? "date";
  assert(["date", "cycle"].includes(mode), `Unsupported astronomical-event mode '${mode}'`);
  if (mode === "date") {
    assert(definition.date && typeof definition.date === "object", "astronomy.date is required for date mode");
    assert(typeof definition.date.monthId === "string" && definition.date.monthId.length > 0, "astronomy.date.monthId is required");
    assert(Number.isInteger(Number(definition.date.day)) && Number(definition.date.day) > 0, "astronomy.date.day must be positive");
    if (definition.date.year != null && definition.date.year !== "") assert(Number.isInteger(Number(definition.date.year)), "astronomy.date.year must be an integer");
    for (const [key, min] of [["hour", 0], ["minute", 0], ["second", 0]]) {
      if (definition.date[key] != null) assert(Number.isInteger(Number(definition.date[key])) && Number(definition.date[key]) >= min, `astronomy.date.${key} must be non-negative`);
    }
    if (calendar) {
      const monthIndex = calendar.months.findIndex((month) => month.id === definition.date.monthId);
      assert(monthIndex >= 0, `astronomy.date.monthId '${definition.date.monthId}' is unknown`);
      const month = calendar.months[monthIndex];
      const maxDay = Number(month.days) + Number(month.leapDays ?? 0);
      assert(Number(definition.date.day) <= maxDay, `astronomy.date.day is outside month '${definition.date.monthId}'`);
      assert(Number(definition.date.hour ?? 0) < Number(calendar.time?.hoursPerDay ?? 24), "astronomy.date.hour is outside the calendar day");
      assert(Number(definition.date.minute ?? 0) < Number(calendar.time?.minutesPerHour ?? 60), "astronomy.date.minute is outside the calendar hour");
      assert(Number(definition.date.second ?? 0) < Number(calendar.time?.secondsPerMinute ?? 60), "astronomy.date.second is outside the calendar minute");
    }
  } else {
    assert(Number.isFinite(Number(definition.cycleLengthDays)) && Number(definition.cycleLengthDays) > 0, "astronomy.cycleLengthDays must be positive");
    assert(Number.isFinite(Number(definition.referenceWorldTime ?? 0)), "astronomy.referenceWorldTime must be numeric");
  }
  if (definition.durationSeconds != null) assert(Number.isFinite(Number(definition.durationSeconds)) && Number(definition.durationSeconds) >= 0, "astronomy.durationSeconds must be non-negative");
  return true;
}

function validateVisibility(value, path) {
  assert(["public", "gm"].includes(value ?? "public"), `${path} must be public or gm`);
}

function validateRegions(definition, path) {
  if (definition.regionId) assertId(definition.regionId, `${path}.regionId`);
  if (definition.regionIds != null) {
    assert(Array.isArray(definition.regionIds), `${path}.regionIds must be an array`);
    definition.regionIds.forEach((id, index) => assertId(id, `${path}.regionIds[${index}]`));
  }
}

function validateDocumentLink(definition, path) {
  if (definition.journalUuid != null) assert(typeof definition.journalUuid === "string", `${path}.journalUuid must be text`);
  if (definition.description != null) assertLabel(definition.description, `${path}.description`);
  if (definition.category != null) assertLabel(definition.category, `${path}.category`);
}

export function validateHolidayDefinition(definition, calendar = null) {
  assert(definition && typeof definition === "object", "Holiday definition must be an object");
  assertId(definition.id, "holiday.id");
  assertLabel(definition.label, "holiday.label");
  assertId(definition.calendarId, "holiday.calendarId");
  validateVisibility(definition.visibility, "holiday.visibility");
  validateRegions(definition, "holiday");
  validateDocumentLink(definition, "holiday");

  const recurrence = definition.recurrence ?? {};
  assert(["yearly", "once"].includes(recurrence.type), "holiday.recurrence.type must be yearly or once");
  assert(typeof recurrence.monthId === "string" && recurrence.monthId.length > 0, "holiday.recurrence.monthId is required");
  assert(Number.isInteger(Number(recurrence.day)) && Number(recurrence.day) > 0, "holiday.recurrence.day must be positive");
  if (recurrence.type === "once") assert(Number.isInteger(Number(recurrence.year)), "holiday.recurrence.year must be an integer for one-time holidays");
  const durationDays = Number(definition.durationDays ?? 1);
  assert(Number.isInteger(durationDays) && durationDays > 0, "holiday.durationDays must be a positive integer");

  if (calendar) {
    const monthIndex = calendar.months.findIndex((month) => month.id === recurrence.monthId);
    assert(monthIndex >= 0, `holiday.recurrence.monthId '${recurrence.monthId}' is unknown`);
    const year = recurrence.type === "once" ? Number(recurrence.year) : 0;
    const maxDay = recurrence.type === "once"
      ? CalendarEngine.daysInMonth(year, monthIndex, calendar)
      : Number(calendar.months[monthIndex].days) + Number(calendar.months[monthIndex].leapDays ?? 0);
    assert(Number(recurrence.day) <= maxDay, `holiday.recurrence.day is outside month '${recurrence.monthId}'`);
  }
  return true;
}

export function validateHistoricalEvent(definition, calendar = null) {
  assert(definition && typeof definition === "object", "Historical event must be an object");
  assertId(definition.id, "historical.id");
  assertLabel(definition.label, "historical.label");
  assertId(definition.calendarId, "historical.calendarId");
  validateVisibility(definition.visibility, "historical.visibility");
  validateRegions(definition, "historical");
  validateDocumentLink(definition, "historical");

  const precision = definition.precision ?? "day";
  const precisions = ["year", "month", "day", "hour", "minute", "second"];
  assert(precisions.includes(precision), `Unsupported historical precision '${precision}'`);
  const rank = precisions.indexOf(precision);
  const date = definition.date ?? {};
  assert(Number.isInteger(Number(date.year)), "historical.date.year must be an integer");
  if (rank >= 1) assert(typeof date.monthId === "string" && date.monthId.length > 0, "historical.date.monthId is required");
  if (rank >= 2) assert(Number.isInteger(Number(date.day)) && Number(date.day) > 0, "historical.date.day must be positive");
  if (rank >= 3) assert(Number.isInteger(Number(date.hour)) && Number(date.hour) >= 0, "historical.date.hour must be non-negative");
  if (rank >= 4) assert(Number.isInteger(Number(date.minute)) && Number(date.minute) >= 0, "historical.date.minute must be non-negative");
  if (rank >= 5) assert(Number.isInteger(Number(date.second)) && Number(date.second) >= 0, "historical.date.second must be non-negative");

  if (calendar && rank >= 1) {
    const monthIndex = calendar.months.findIndex((month) => month.id === date.monthId);
    assert(monthIndex >= 0, `historical.date.monthId '${date.monthId}' is unknown`);
    if (rank >= 2) {
      const maxDay = CalendarEngine.daysInMonth(Number(date.year), monthIndex, calendar);
      assert(Number(date.day) <= maxDay, `historical.date.day is outside month '${date.monthId}'`);
    }
    if (rank >= 3) assert(Number(date.hour) < Number(calendar.time?.hoursPerDay ?? 24), "historical.date.hour is outside the calendar day");
    if (rank >= 4) assert(Number(date.minute) < Number(calendar.time?.minutesPerHour ?? 60), "historical.date.minute is outside the calendar hour");
    if (rank >= 5) assert(Number(date.second) < Number(calendar.time?.secondsPerMinute ?? 60), "historical.date.second is outside the calendar minute");
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
