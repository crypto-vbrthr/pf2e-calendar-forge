import { CalendarEngine } from "../calendar/calendar-engine.js";
import { resolveLabel } from "../localization/label-resolver.js";

const PRECISION_ORDER = Object.freeze(["year", "month", "day", "hour", "minute", "second"]);

function visible(definition, regionId) {
  if (definition.visibility === "gm" && !game.user?.isGM) return false;
  if (definition.regionId && definition.regionId !== regionId) return false;
  if (Array.isArray(definition.regionIds) && definition.regionIds.length && !definition.regionIds.includes(regionId)) return false;
  if (definition.scope?.type === "region" && Array.isArray(definition.scope.regionIds) && !definition.scope.regionIds.includes(regionId)) return false;
  return true;
}

function sameDay(a, b) {
  return Number(a?.year) === Number(b?.year)
    && a?.monthId === b?.monthId
    && Number(a?.day) === Number(b?.day);
}

function dateForPrecision(date, precision) {
  const rank = PRECISION_ORDER.indexOf(precision ?? "day");
  return {
    year: Number(date.year),
    monthId: rank >= 1 ? date.monthId : null,
    day: rank >= 2 ? Number(date.day) : null,
    hour: rank >= 3 ? Number(date.hour ?? 0) : null,
    minute: rank >= 4 ? Number(date.minute ?? 0) : null,
    second: rank >= 5 ? Number(date.second ?? 0) : null
  };
}

export class EventService {
  #events = new Map();
  #providers = new Map();

  constructor({ holidayRegistry = null, historicalRegistry = null } = {}) {
    this.holidays = holidayRegistry;
    this.historical = historicalRegistry;
  }

  register(event, { replace = false } = {}) {
    if (!event?.id) throw new TypeError("Calendar event requires an id");
    if (this.#events.has(event.id) && !replace) throw new Error(`Event '${event.id}' is already registered`);
    this.#events.set(event.id, Object.freeze(structuredClone(event)));
  }

  unregister(id) {
    return this.#events.delete(id);
  }

  unregisterByProvider(providerId) {
    let removed = 0;
    for (const [id, event] of this.#events.entries()) {
      if (event.providerId !== providerId) continue;
      this.#events.delete(id);
      removed += 1;
    }
    return removed;
  }

  has(id) {
    return this.#events.has(id);
  }

  get(id) {
    return this.#events.get(id) ?? null;
  }

  listRegistered() {
    return [...this.#events.values()];
  }

  registerProvider(id, provider) {
    if (!id || typeof provider !== "function") throw new TypeError("Event provider requires id and function");
    this.#providers.set(id, provider);
  }

  unregisterProvider(id) {
    return this.#providers.delete(id);
  }

  #holidayOccurrenceStart(definition, targetYear) {
    const recurrence = definition.recurrence ?? {};
    if (recurrence.type === "once") {
      return { year: Number(recurrence.year), monthId: recurrence.monthId, day: Number(recurrence.day) };
    }
    return { year: Number(targetYear), monthId: recurrence.monthId, day: Number(recurrence.day) };
  }

  #holidayOccurrenceForDate(definition, date, calendar) {
    const duration = Math.max(1, Number(definition.durationDays ?? 1));
    const recurrence = definition.recurrence ?? {};
    const years = recurrence.type === "yearly" ? [Number(date.year), Number(date.year) - 1] : [Number(recurrence.year)];
    for (const year of years) {
      if (!Number.isInteger(year)) continue;
      const start = this.#holidayOccurrenceStart(definition, year);
      try {
        CalendarEngine.validateDate({ ...start, hour: 0, minute: 0, second: 0 }, calendar);
        const distance = CalendarEngine.daysBetween(start, date, calendar);
        if (distance >= 0 && distance < duration) return { start, distance };
      } catch (_error) {
        // Invalid provider content is ignored for display; validation catches editable definitions.
      }
    }
    return null;
  }

  #historicalMatches(definition, date) {
    const precision = definition.precision ?? "day";
    if (PRECISION_ORDER.indexOf(precision) < PRECISION_ORDER.indexOf("day")) return false;
    return sameDay(definition.date, date);
  }

  #legacyMatches(event, date, context) {
    if (event.calendarId && event.calendarId !== context.calendarId) return false;
    if (!visible(event, context.regionId)) return false;

    if (event.recurrence?.type === "yearly") {
      return event.recurrence.monthId === date.monthId && Number(event.recurrence.day) === Number(date.day);
    }
    if (event.date) return sameDay(event.date, date);
    return false;
  }

  #decorate(event, extra = {}) {
    const type = event.type ?? extra.type ?? "event";
    return {
      ...event,
      ...extra,
      type,
      label: resolveLabel(event.label ?? event.title, event.id),
      descriptionText: resolveLabel(event.description, ""),
      categoryLabel: resolveLabel(event.category, ""),
      icon: event.icon ?? this.#iconFor(type)
    };
  }

  async getEventsForDate(date, context = {}) {
    const calendar = context.calendar;
    const matches = [];

    if (calendar && this.holidays) {
      for (const holiday of this.holidays.list()) {
        if (holiday.calendarId !== calendar.id || !visible(holiday, context.regionId)) continue;
        const occurrence = this.#holidayOccurrenceForDate(holiday, date, calendar);
        if (occurrence) {
          const durationDays = Math.max(1, Number(holiday.durationDays ?? 1));
          matches.push(this.#decorate(holiday, {
            type: "holiday",
            sourceType: "holiday",
            occurrenceDate: structuredClone(date),
            occurrenceStart: occurrence.start,
            dayOfFestival: occurrence.distance + 1,
            durationDays,
            festivalProgressLabel: durationDays > 1
              ? game.i18n.format("CALENDAR_FORGE.Chronicle.FestivalDay", { day: occurrence.distance + 1, duration: durationDays })
              : ""
          }));
        }
      }
    }

    if (this.historical) {
      for (const event of this.historical.list()) {
        if (event.calendarId !== context.calendarId || !visible(event, context.regionId)) continue;
        if (this.#historicalMatches(event, date)) matches.push(this.#decorate(event, { type: "historical", sourceType: "historical" }));
      }
    }

    for (const event of this.#events.values()) {
      if (this.#legacyMatches(event, date, context)) matches.push(this.#decorate(event));
    }

    for (const [providerId, provider] of this.#providers.entries()) {
      const provided = await provider({ type: "date", date, context });
      if (Array.isArray(provided)) {
        for (const event of provided) {
          if (event.calendarId && event.calendarId !== context.calendarId) continue;
          if (!visible(event, context.regionId)) continue;
          if (event.worldTime != null && Number.isFinite(Number(event.worldTime))
            && Number.isFinite(Number(context.dayStartWorldTime)) && Number.isFinite(Number(context.dayEndWorldTime))) {
            const instant = Number(event.worldTime);
            if (instant < Number(context.dayStartWorldTime) || instant >= Number(context.dayEndWorldTime)) continue;
          }
          matches.push(this.#decorate(event, { providerId: event.providerId ?? providerId, sourceType: event.sourceType ?? "external" }));
        }
      }
    }

    return matches;
  }

  #chronicleSortKey(date, precision, calendar) {
    const rank = PRECISION_ORDER.indexOf(precision ?? "day");
    const monthIndex = rank >= 1 ? Math.max(0, calendar.months.findIndex((month) => month.id === date.monthId)) : 0;
    const day = rank >= 2 ? Number(date.day ?? 1) : 1;
    const hour = rank >= 3 ? Number(date.hour ?? 0) : 0;
    const minute = rank >= 4 ? Number(date.minute ?? 0) : 0;
    const second = rank >= 5 ? Number(date.second ?? 0) : 0;
    return [Number(date.year), monthIndex, day, hour, minute, second, rank];
  }

  #compareChronicle(a, b) {
    const left = a.sortKey ?? [];
    const right = b.sortKey ?? [];
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      const delta = Number(left[index] ?? 0) - Number(right[index] ?? 0);
      if (delta) return delta;
    }
    return String(a.label ?? "").localeCompare(String(b.label ?? ""));
  }

  async getChronicle({ calendar, regionId = null, fromYear, toYear, query = "", eventType = "all", context = {} } = {}) {
    if (!calendar) return [];
    const low = Math.min(Number(fromYear), Number(toYear));
    const high = Math.max(Number(fromYear), Number(toYear));
    const needle = String(query ?? "").trim().toLocaleLowerCase();
    const entries = [];

    if (this.holidays && ["all", "holiday"].includes(eventType)) {
      for (const holiday of this.holidays.list()) {
        if (holiday.calendarId !== calendar.id || !visible(holiday, regionId)) continue;
        const recurrence = holiday.recurrence ?? {};
        const years = recurrence.type === "once"
          ? [Number(recurrence.year)].filter((year) => year >= low && year <= high)
          : Array.from({ length: high - low + 1 }, (_value, index) => low + index);
        for (const year of years) {
          const date = this.#holidayOccurrenceStart(holiday, year);
          try { CalendarEngine.validateDate({ ...date, hour: 0, minute: 0, second: 0 }, calendar); } catch (_error) { continue; }
          entries.push(this.#decorate(holiday, {
            type: "holiday",
            sourceType: "holiday",
            precision: "day",
            date,
            sortKey: this.#chronicleSortKey(date, "day", calendar),
            durationDays: Math.max(1, Number(holiday.durationDays ?? 1))
          }));
        }
      }
    }

    if (this.historical && ["all", "historical"].includes(eventType)) {
      for (const event of this.historical.list()) {
        if (event.calendarId !== calendar.id || !visible(event, regionId)) continue;
        const year = Number(event.date?.year);
        if (year < low || year > high) continue;
        const precision = event.precision ?? "day";
        const date = dateForPrecision(event.date, precision);
        entries.push(this.#decorate(event, {
          type: "historical",
          sourceType: "historical",
          precision,
          date,
          sortKey: this.#chronicleSortKey(date, precision, calendar)
        }));
      }
    }

    if (["all", "external", "campaign"].includes(eventType)) {
      for (const [providerId, provider] of this.#providers.entries()) {
        const provided = await provider({
          type: "chronicle",
          range: { fromYear: low, toYear: high },
          context: { ...context, calendarId: calendar.id, regionId }
        });
        if (!Array.isArray(provided)) continue;
        for (const event of provided) {
          if (event.calendarId && event.calendarId !== calendar.id) continue;
          if (!visible(event, regionId)) continue;
          const sourceType = event.sourceType ?? "external";
          if (eventType === "campaign" && sourceType !== "campaign") continue;
          if (eventType === "external" && sourceType === "campaign") continue;
          let precision = event.precision ?? (event.worldTime != null ? "second" : "day");
          let rawDate = event.date ?? null;
          if (!rawDate && event.worldTime != null && typeof context.dateFromWorldTime === "function") {
            rawDate = context.dateFromWorldTime(Number(event.worldTime));
          }
          const date = dateForPrecision(rawDate ?? {}, precision);
          if (!Number.isInteger(date.year) || date.year < low || date.year > high) continue;
          entries.push(this.#decorate(event, {
            providerId: event.providerId ?? providerId,
            sourceType,
            precision,
            date,
            sortKey: this.#chronicleSortKey(date, precision, calendar)
          }));
        }
      }
    }

    return entries
      .filter((entry) => !needle || `${entry.label} ${entry.descriptionText} ${entry.categoryLabel}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => this.#compareChronicle(a, b));
  }

  #iconFor(type) {
    const icons = {
      holiday: "fa-star",
      historical: "fa-scroll",
      campaign: "fa-flag",
      "solar-eclipse": "fa-sun",
      "lunar-eclipse": "fa-moon",
      astronomy: "fa-star-and-crescent",
      external: "fa-link"
    };
    return icons[type] ?? "fa-circle-info";
  }
}
