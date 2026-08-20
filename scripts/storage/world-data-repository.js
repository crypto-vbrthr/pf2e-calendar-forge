import { MODULE_ID, SETTINGS } from "../constants.js";
import { validateAnchor, validateCalendarDefinition, validateRegionDefinition } from "../validation/definition-validator.js";

const WORLD_PROVIDER_ID = "calendar-forge-world";

function clone(value) {
  return structuredClone(value);
}

export class WorldDataRepository {
  constructor({ calendarRegistry, regionRegistry }) {
    this.calendars = calendarRegistry;
    this.regions = regionRegistry;
    this.data = { calendars: [], regions: [], anchors: {} };
  }

  async load() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.WORLD_DATA) ?? {};
    this.data = {
      calendars: Array.isArray(stored.calendars) ? clone(stored.calendars) : [],
      regions: Array.isArray(stored.regions) ? clone(stored.regions) : [],
      anchors: stored.anchors && typeof stored.anchors === "object" ? clone(stored.anchors) : {}
    };

    for (const calendar of this.data.calendars) {
      try {
        validateCalendarDefinition(calendar);
        this.calendars.register({ ...calendar, providerId: WORLD_PROVIDER_ID }, { replace: true });
      } catch (error) {
        console.warn("Calendar Forge | Skipping invalid world calendar", calendar?.id, error);
      }
    }
    for (const region of this.data.regions) {
      try {
        validateRegionDefinition(region);
        this.regions.register({ ...region, providerId: WORLD_PROVIDER_ID }, { replace: true });
      } catch (error) {
        console.warn("Calendar Forge | Skipping invalid world region", region?.id, error);
      }
    }
  }

  async #persist() {
    await game.settings.set(MODULE_ID, SETTINGS.WORLD_DATA, clone(this.data));
    Hooks.callAll("calendarForgeDefinitionsChanged");
  }

  isWorldCalendar(id) {
    return this.data.calendars.some((calendar) => calendar.id === id);
  }

  isWorldRegion(id) {
    return this.data.regions.some((region) => region.id === id);
  }

  getAnchor(calendarId) {
    return this.data.anchors?.[calendarId] ? clone(this.data.anchors[calendarId]) : null;
  }

  async saveAnchor(calendar, anchor) {
    validateAnchor(anchor, calendar);
    this.data.anchors[calendar.id] = clone(anchor);
    await this.#persist();
    return this.getAnchor(calendar.id);
  }

  async saveCalendar(definition, anchor = null) {
    const normalized = { ...clone(definition), providerId: WORLD_PROVIDER_ID };
    validateCalendarDefinition(normalized);
    const index = this.data.calendars.findIndex((calendar) => calendar.id === normalized.id);
    if (index < 0 && this.calendars.has(normalized.id)) throw new Error(`Calendar id '${normalized.id}' is already provided by another source`);
    if (index >= 0) this.data.calendars[index] = normalized;
    else this.data.calendars.push(normalized);
    this.calendars.register(normalized, { replace: true });
    if (anchor) {
      validateAnchor(anchor, normalized);
      this.data.anchors[normalized.id] = clone(anchor);
    }
    await this.#persist();
    return this.calendars.get(normalized.id);
  }

  async deleteCalendar(id) {
    const usedBy = this.regions.list().find((region) => region.calendarId === id);
    if (usedBy) throw new Error(`Calendar '${id}' is used by region '${usedBy.id}'`);
    const before = this.data.calendars.length;
    this.data.calendars = this.data.calendars.filter((calendar) => calendar.id !== id);
    delete this.data.anchors[id];
    if (this.data.calendars.length === before) return false;
    this.calendars.unregister(id);
    await this.#persist();
    return true;
  }

  async saveRegion(definition) {
    const normalized = { ...clone(definition), providerId: WORLD_PROVIDER_ID };
    validateRegionDefinition(normalized);
    if (normalized.calendarId && !this.calendars.has(normalized.calendarId)) throw new Error(`Unknown calendar '${normalized.calendarId}'`);
    const index = this.data.regions.findIndex((region) => region.id === normalized.id);
    if (index < 0 && this.regions.has(normalized.id)) throw new Error(`Region id '${normalized.id}' is already provided by another source`);
    if (index >= 0) this.data.regions[index] = normalized;
    else this.data.regions.push(normalized);
    this.regions.register(normalized, { replace: true });
    await this.#persist();
    return this.regions.get(normalized.id);
  }

  async deleteRegion(id) {
    const before = this.data.regions.length;
    this.data.regions = this.data.regions.filter((region) => region.id !== id);
    if (this.data.regions.length === before) return false;
    this.regions.unregister(id);
    await this.#persist();
    return true;
  }
}

export { WORLD_PROVIDER_ID };
