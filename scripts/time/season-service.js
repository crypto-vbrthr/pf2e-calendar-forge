import { CalendarEngine } from "../calendar/calendar-engine.js";
import { resolveLabel } from "../localization/label-resolver.js";

export class SeasonService {
  constructor(seasonRegistry) {
    this.registry = seasonRegistry;
  }

  #startsForYear(profile, year, calendar) {
    return profile.seasons.map((season) => ({
      season,
      ordinal: CalendarEngine.dayOfYear({ year, monthId: season.monthId, day: season.day }, calendar)
    })).sort((a, b) => a.ordinal - b.ordinal);
  }

  getState(date, calendar, profileId) {
    const profile = this.registry.get(profileId);
    if (!profile || profile.calendarId !== calendar.id || !profile.seasons?.length) return null;

    const currentOrdinal = date.dayOfYear - 1;
    const starts = this.#startsForYear(profile, date.year, calendar);
    let activeIndex = starts.findLastIndex((entry) => entry.ordinal <= currentOrdinal);
    let active;
    let next;
    let elapsed;
    let length;

    if (activeIndex < 0) {
      const previousYear = date.year - 1;
      const previousStarts = this.#startsForYear(profile, previousYear, calendar);
      active = previousStarts[previousStarts.length - 1];
      next = starts[0];
      const previousYearDays = CalendarEngine.daysInYear(previousYear, calendar);
      elapsed = (previousYearDays - active.ordinal) + currentOrdinal;
      length = (previousYearDays - active.ordinal) + next.ordinal;
    } else {
      active = starts[activeIndex];
      elapsed = currentOrdinal - active.ordinal;
      if (activeIndex < starts.length - 1) {
        next = starts[activeIndex + 1];
        length = next.ordinal - active.ordinal;
      } else {
        const nextYearStarts = this.#startsForYear(profile, date.year + 1, calendar);
        next = nextYearStarts[0];
        length = (CalendarEngine.daysInYear(date.year, calendar) - active.ordinal) + next.ordinal;
      }
    }

    length = Math.max(1, length);
    elapsed = Math.max(0, elapsed);
    return {
      id: active.season.id,
      label: resolveLabel(active.season.label, active.season.id),
      icon: active.season.icon ?? "fa-leaf",
      progress: Math.max(0, Math.min(1, elapsed / length)),
      daysElapsed: elapsed,
      lengthDays: length,
      daysRemaining: Math.max(0, length - elapsed),
      nextSeasonId: next.season.id,
      nextSeasonLabel: resolveLabel(next.season.label, next.season.id),
      profileId: profile.id
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
      icon: season.icon ?? "fa-leaf",
      seasonId: season.id
    };
  }
}
