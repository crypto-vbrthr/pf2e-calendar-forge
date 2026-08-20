import { CalendarEngine } from "../calendar/calendar-engine.js";
import { resolveLabel } from "../localization/label-resolver.js";

export class SeasonService {
  constructor(seasonRegistry) {
    this.registry = seasonRegistry;
  }

  getState(date, calendar, profileId) {
    const profile = this.registry.get(profileId);
    if (!profile || profile.calendarId !== calendar.id || !profile.seasons?.length) return null;

    const yearDays = CalendarEngine.daysInYear(date.year, calendar);
    const currentOrdinal = date.dayOfYear - 1;
    const starts = profile.seasons.map((season) => ({
      season,
      ordinal: CalendarEngine.dayOfYear({ year: date.year, monthId: season.monthId, day: season.day }, calendar)
    })).sort((a, b) => a.ordinal - b.ordinal);

    let activeIndex = starts.findLastIndex((entry) => entry.ordinal <= currentOrdinal);
    if (activeIndex < 0) activeIndex = starts.length - 1;

    const active = starts[activeIndex];
    const next = starts[(activeIndex + 1) % starts.length];
    let startOrdinal = active.ordinal;
    let endOrdinal = next.ordinal;
    let position = currentOrdinal;
    if (activeIndex === starts.length - 1) endOrdinal += yearDays;
    if (position < startOrdinal) position += yearDays;

    const length = Math.max(1, endOrdinal - startOrdinal);
    return {
      id: active.season.id,
      label: resolveLabel(active.season.label, active.season.id),
      icon: active.season.icon ?? "fa-leaf",
      progress: Math.max(0, Math.min(1, (position - startOrdinal) / length))
    };
  }

  getChangeForDate(date, calendar, profileId) {
    const profile = this.registry.get(profileId);
    if (!profile || profile.calendarId !== calendar.id) return null;
    const season = profile.seasons?.find((entry) => entry.monthId === date.monthId && Number(entry.day) === Number(date.day));
    if (!season) return null;
    return {
      type: "season-change",
      label: resolveLabel(season.label, season.id),
      icon: season.icon ?? "fa-leaf"
    };
  }
}
