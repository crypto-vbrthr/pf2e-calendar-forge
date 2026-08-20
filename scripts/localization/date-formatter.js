import { resolveLabel, interpolateFormat } from "./label-resolver.js";

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function distinctAlternate(primary, alternate) {
  const a = String(primary ?? "").trim();
  const b = String(alternate ?? "").trim();
  if (!b || a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0) return "";
  return b;
}

export function getCalendarNameSet(date, calendar) {
  const month = calendar.months[date.monthIndex];
  const weekday = date.weekdayIndex == null ? null : calendar.week?.days?.[date.weekdayIndex];
  const monthLabel = resolveLabel(month?.label, month?.id ?? "");
  const weekdayLabel = resolveLabel(weekday?.label, weekday?.id ?? "");
  const monthAlternate = distinctAlternate(monthLabel, resolveLabel(month?.alternateLabel, ""));
  const weekdayAlternate = distinctAlternate(weekdayLabel, resolveLabel(weekday?.alternateLabel, ""));
  return {
    month: monthLabel,
    monthShort: resolveLabel(month?.shortLabel ?? month?.label, month?.id ?? ""),
    monthAlternate,
    monthAlternateShort: distinctAlternate(
      resolveLabel(month?.shortLabel ?? month?.label, month?.id ?? ""),
      resolveLabel(month?.alternateShortLabel ?? month?.alternateLabel, "")
    ),
    weekday: weekdayLabel,
    weekdayShort: resolveLabel(weekday?.shortLabel ?? weekday?.label, weekday?.id ?? ""),
    weekdayAlternate,
    weekdayAlternateShort: distinctAlternate(
      resolveLabel(weekday?.shortLabel ?? weekday?.label, weekday?.id ?? ""),
      resolveLabel(weekday?.alternateShortLabel ?? weekday?.alternateLabel, "")
    )
  };
}

function withAlternate(primary, alternate, includeAlternate) {
  return includeAlternate && alternate ? `${primary} (${alternate})` : primary;
}

export function formatCalendarDate(date, calendar, { includeTime = false, includeAlternate = false } = {}) {
  const names = getCalendarNameSet(date, calendar);
  const values = {
    year: date.year,
    month: withAlternate(names.month, names.monthAlternate, includeAlternate),
    monthShort: withAlternate(names.monthShort, names.monthAlternateShort, includeAlternate),
    monthAlternate: names.monthAlternate,
    monthAlternateShort: names.monthAlternateShort,
    day: date.day,
    weekday: withAlternate(names.weekday, names.weekdayAlternate, includeAlternate),
    weekdayShort: withAlternate(names.weekdayShort, names.weekdayAlternateShort, includeAlternate),
    weekdayAlternate: names.weekdayAlternate,
    weekdayAlternateShort: names.weekdayAlternateShort,
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

export function formatClock(date, calendar = null) {
  const hoursPerDay = Number(calendar?.time?.hoursPerDay ?? 24);
  const minutesPerHour = Number(calendar?.time?.minutesPerHour ?? 60);
  const hourWidth = Math.max(2, String(Math.max(0, hoursPerDay - 1)).length);
  const minuteWidth = Math.max(2, String(Math.max(0, minutesPerHour - 1)).length);
  return `${pad(date.hour ?? 0, hourWidth)}:${pad(date.minute ?? 0, minuteWidth)}`;
}

export function formatPrecisionTime(date, precision, calendar = null) {
  const hoursPerDay = Number(calendar?.time?.hoursPerDay ?? 24);
  const minutesPerHour = Number(calendar?.time?.minutesPerHour ?? 60);
  const secondsPerMinute = Number(calendar?.time?.secondsPerMinute ?? 60);
  const hourWidth = Math.max(2, String(Math.max(0, hoursPerDay - 1)).length);
  const minuteWidth = Math.max(2, String(Math.max(0, minutesPerHour - 1)).length);
  const secondWidth = Math.max(2, String(Math.max(0, secondsPerMinute - 1)).length);
  if (precision === "hour") return `${pad(date?.hour ?? 0, hourWidth)}`;
  if (precision === "minute") return `${pad(date?.hour ?? 0, hourWidth)}:${pad(date?.minute ?? 0, minuteWidth)}`;
  if (precision === "second") return `${pad(date?.hour ?? 0, hourWidth)}:${pad(date?.minute ?? 0, minuteWidth)}:${pad(date?.second ?? 0, secondWidth)}`;
  return "";
}

export function formatPartialCalendarDate(date, precision, calendar, { includeAlternate = false } = {}) {
  const month = date?.monthId ? calendar.months.find((entry) => entry.id === date.monthId) : null;
  const monthPrimary = resolveLabel(month?.label, month?.id ?? "");
  const monthAlternate = distinctAlternate(monthPrimary, resolveLabel(month?.alternateLabel, ""));
  const monthLabel = withAlternate(monthPrimary, monthAlternate, includeAlternate);
  const era = resolveLabel(calendar.era, "");
  const year = Number(date?.year ?? 0);
  const parts = [];

  if (precision === "year") return `${year}${era ? ` ${era}` : ""}`.trim();
  if (precision === "month") return `${monthLabel} ${year}${era ? ` ${era}` : ""}`.trim();

  parts.push(`${Number(date?.day ?? 1)}.`);
  if (monthLabel) parts.push(monthLabel);
  parts.push(String(year));
  if (era) parts.push(era);
  let result = parts.join(" ");
  if (["hour", "minute", "second"].includes(precision)) {
    const time = formatPrecisionTime(date, precision, calendar);
    const suffix = precision === "hour" ? ` ${game.i18n.localize("CALENDAR_FORGE.Chronicle.HourSuffix")}` : "";
    result += `, ${time}${suffix}`;
  }
  return result.trim();
}
