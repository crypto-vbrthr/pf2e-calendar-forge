import { CalendarEngine } from "../calendar/calendar-engine.js";
import { resolveLabel } from "../localization/label-resolver.js";

const TYPE_ICONS = Object.freeze({
  "solar-eclipse": "fa-sun",
  "lunar-eclipse": "fa-moon",
  "meteor-shower": "fa-meteor",
  equinox: "fa-circle-half-stroke",
  solstice: "fa-sun",
  conjunction: "fa-circle-nodes",
  comet: "fa-meteor",
  custom: "fa-star-and-crescent"
});

export class AstronomyService {
  constructor(registry) {
    this.registry = registry;
  }

  #visible(definition, regionId) {
    if (definition.visibility === "gm" && !game.user?.isGM) return false;
    if (definition.regionId && definition.regionId !== regionId) return false;
    if (Array.isArray(definition.regionIds) && definition.regionIds.length && !definition.regionIds.includes(regionId)) return false;
    return true;
  }

  #decorate(definition, occurrenceWorldTime = null) {
    return {
      ...definition,
      type: definition.type ?? "custom",
      label: resolveLabel(definition.label, definition.id),
      icon: definition.icon ?? TYPE_ICONS[definition.type] ?? TYPE_ICONS.custom,
      worldTime: occurrenceWorldTime
    };
  }

  getEventsForDate(date, { calendar, regionId = null, dayStartWorldTime, dayEndWorldTime } = {}) {
    const matches = [];
    for (const definition of this.registry.list()) {
      if (definition.calendarId && definition.calendarId !== calendar.id) continue;
      if (!this.#visible(definition, regionId)) continue;
      const mode = definition.mode ?? "date";
      if (mode === "date") {
        const eventDate = definition.date ?? {};
        const yearMatches = eventDate.year == null || eventDate.year === "" || Number(eventDate.year) === Number(date.year);
        if (!yearMatches || eventDate.monthId !== date.monthId || Number(eventDate.day) !== Number(date.day)) continue;
        const seconds = Number(eventDate.hour ?? 0) * CalendarEngine.secondsPerHour(calendar)
          + Number(eventDate.minute ?? 0) * CalendarEngine.secondsPerMinute(calendar)
          + Number(eventDate.second ?? 0);
        matches.push(this.#decorate(definition, Number(dayStartWorldTime) + seconds));
        continue;
      }

      const cycleSeconds = Number(definition.cycleLengthDays) * CalendarEngine.secondsPerDay(calendar);
      if (!(cycleSeconds > 0)) continue;
      const reference = Number(definition.referenceWorldTime ?? 0);
      const start = Number(dayStartWorldTime);
      const end = Number(dayEndWorldTime);
      const first = Math.ceil((start - reference) / cycleSeconds);
      let occurrence = reference + first * cycleSeconds;
      while (occurrence < end) {
        if (occurrence >= start) matches.push(this.#decorate(definition, occurrence));
        occurrence += cycleSeconds;
      }
    }
    return matches.sort((a, b) => Number(a.worldTime ?? 0) - Number(b.worldTime ?? 0));
  }
  getEventsBetween(startWorldTime, endWorldTime, { calendar, regionId = null, dateFromWorldTime = null, dateToWorldTime = null } = {}) {
    const start = Number(startWorldTime);
    const end = Number(endWorldTime);
    if (!calendar || !(end > start)) return [];
    const matches = [];
    for (const definition of this.registry.list()) {
      if (definition.calendarId && definition.calendarId !== calendar.id) continue;
      if (!this.#visible(definition, regionId)) continue;
      const mode = definition.mode ?? "date";
      if (mode === "cycle") {
        const cycleSeconds = Number(definition.cycleLengthDays) * CalendarEngine.secondsPerDay(calendar);
        if (!(cycleSeconds > 0)) continue;
        const reference = Number(definition.referenceWorldTime ?? 0);
        let occurrence = reference + Math.ceil((start - reference) / cycleSeconds) * cycleSeconds;
        while (occurrence < end) {
          if (occurrence >= start) matches.push(this.#decorate(definition, occurrence));
          occurrence += cycleSeconds;
        }
        continue;
      }
      if (typeof dateFromWorldTime !== "function" || typeof dateToWorldTime !== "function") continue;
      const startDate = dateFromWorldTime(start);
      const endDate = dateFromWorldTime(Math.max(start, end - 1));
      const eventDate = definition.date ?? {};
      const years = eventDate.year == null || eventDate.year === ""
        ? Array.from({ length: Math.max(0, Number(endDate.year) - Number(startDate.year) + 1) }, (_v, i) => Number(startDate.year) + i)
        : [Number(eventDate.year)];
      for (const year of years) {
        if (year < Number(startDate.year) || year > Number(endDate.year)) continue;
        try {
          const date = { year, monthId: eventDate.monthId, day: Number(eventDate.day), hour: Number(eventDate.hour ?? 0), minute: Number(eventDate.minute ?? 0), second: Number(eventDate.second ?? 0) };
          const occurrence = Number(dateToWorldTime(date));
          if (occurrence >= start && occurrence < end) matches.push(this.#decorate(definition, occurrence));
        } catch (_error) { /* invalid dates are ignored */ }
      }
    }
    return matches.sort((a, b) => Number(a.worldTime ?? 0) - Number(b.worldTime ?? 0));
  }

}
