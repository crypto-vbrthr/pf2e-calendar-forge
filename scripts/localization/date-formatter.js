import { resolveLabel, interpolateFormat } from "./label-resolver.js";

function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatCalendarDate(date, calendar, { includeTime = false } = {}) {
  const month = calendar.months[date.monthIndex];
  const weekday = date.weekdayIndex == null ? null : calendar.week?.days?.[date.weekdayIndex];
  const values = {
    year: date.year,
    month: resolveLabel(month?.label, month?.id ?? ""),
    monthShort: resolveLabel(month?.shortLabel, month?.id ?? ""),
    day: date.day,
    weekday: resolveLabel(weekday?.label, weekday?.id ?? ""),
    weekdayShort: resolveLabel(weekday?.shortLabel, weekday?.id ?? ""),
    era: resolveLabel(calendar.era, ""),
    hour: pad(date.hour ?? 0),
    minute: pad(date.minute ?? 0),
    second: pad(date.second ?? 0)
  };

  const formatSpec = includeTime ? calendar.dateFormats?.dateTime : calendar.dateFormats?.date;
  const fallbackKey = includeTime ? "CALENDAR_FORGE.Formats.DateTime" : "CALENDAR_FORGE.Formats.Date";
  const format = resolveLabel(formatSpec, game.i18n.localize(fallbackKey));
  return interpolateFormat(format, values).replace(/\s+/g, " ").trim();
}

export function formatClock(date) {
  return `${pad(date.hour ?? 0)}:${pad(date.minute ?? 0)}`;
}
