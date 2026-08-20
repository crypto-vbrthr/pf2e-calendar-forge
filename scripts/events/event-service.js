import { resolveLabel } from "../localization/label-resolver.js";

export class EventService {
  #events = new Map();
  #providers = new Map();

  register(event, { replace = false } = {}) {
    if (!event?.id) throw new TypeError("Calendar event requires an id");
    if (this.#events.has(event.id) && !replace) throw new Error(`Event '${event.id}' is already registered`);
    this.#events.set(event.id, Object.freeze(structuredClone(event)));
  }

  registerProvider(id, provider) {
    if (!id || typeof provider !== "function") throw new TypeError("Event provider requires id and function");
    this.#providers.set(id, provider);
  }

  unregisterProvider(id) {
    return this.#providers.delete(id);
  }

  async getEventsForDate(date, context = {}) {
    const matches = [...this.#events.values()].filter((event) => this.#matches(event, date, context));
    for (const provider of this.#providers.values()) {
      const provided = await provider({ type: "date", date, context });
      if (Array.isArray(provided)) matches.push(...provided);
    }
    return matches.map((event) => this.#decorate(event));
  }

  #matches(event, date, context) {
    if (event.calendarId && event.calendarId !== context.calendarId) return false;
    if (event.visibility === "gm" && !game.user?.isGM) return false;

    if (event.recurrence?.type === "yearly") {
      return event.recurrence.monthId === date.monthId && Number(event.recurrence.day) === Number(date.day);
    }

    if (event.date) {
      return Number(event.date.year) === Number(date.year)
        && event.date.monthId === date.monthId
        && Number(event.date.day) === Number(date.day);
    }

    return false;
  }

  #decorate(event) {
    return {
      ...event,
      label: resolveLabel(event.label ?? event.title, event.id),
      icon: event.icon ?? this.#iconFor(event.type)
    };
  }

  #iconFor(type) {
    const icons = {
      holiday: "fa-star",
      historical: "fa-scroll",
      campaign: "fa-flag",
      "solar-eclipse": "fa-sun",
      "lunar-eclipse": "fa-moon",
      astronomy: "fa-star-and-crescent"
    };
    return icons[type] ?? "fa-circle-info";
  }
}
