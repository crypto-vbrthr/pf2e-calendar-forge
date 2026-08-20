import { MODULE_ID, SETTINGS } from "../constants.js";
import {
  validateAnchor,
  validateAstronomyEvent,
  validateCalendarDefinition,
  validateHistoricalEvent,
  validateHolidayDefinition,
  validateMoonProfile,
  validateRegionDefinition,
  validateSeasonProfile
} from "../validation/definition-validator.js";

const WORLD_PROVIDER_ID = "calendar-forge-world";

function clone(value) {
  return structuredClone(value);
}

export class WorldDataRepository {
  constructor({ calendarRegistry, regionRegistry, seasonRegistry, moonRegistry, astronomyRegistry, holidayRegistry, historicalRegistry }) {
    this.calendars = calendarRegistry;
    this.regions = regionRegistry;
    this.seasons = seasonRegistry;
    this.moons = moonRegistry;
    this.astronomy = astronomyRegistry;
    this.holidays = holidayRegistry;
    this.historical = historicalRegistry;
    this.data = { calendars: [], regions: [], seasonProfiles: [], moonProfiles: [], astronomyEvents: [], holidays: [], historicalEvents: [], anchors: {} };
  }

  async load() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.WORLD_DATA) ?? {};
    this.data = {
      calendars: Array.isArray(stored.calendars) ? clone(stored.calendars) : [],
      regions: Array.isArray(stored.regions) ? clone(stored.regions) : [],
      seasonProfiles: Array.isArray(stored.seasonProfiles) ? clone(stored.seasonProfiles) : [],
      moonProfiles: Array.isArray(stored.moonProfiles) ? clone(stored.moonProfiles) : [],
      astronomyEvents: Array.isArray(stored.astronomyEvents) ? clone(stored.astronomyEvents) : [],
      holidays: Array.isArray(stored.holidays) ? clone(stored.holidays) : [],
      historicalEvents: Array.isArray(stored.historicalEvents) ? clone(stored.historicalEvents) : [],
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
    for (const profile of this.data.seasonProfiles) {
      try {
        validateSeasonProfile(profile, this.calendars.get(profile.calendarId));
        this.seasons.register({ ...profile, providerId: WORLD_PROVIDER_ID }, { replace: true });
      } catch (error) {
        console.warn("Calendar Forge | Skipping invalid world season profile", profile?.id, error);
      }
    }
    for (const profile of this.data.moonProfiles) {
      try {
        validateMoonProfile(profile, this.calendars.get(profile.calendarId));
        this.moons.register({ ...profile, providerId: WORLD_PROVIDER_ID }, { replace: true });
      } catch (error) {
        console.warn("Calendar Forge | Skipping invalid world moon profile", profile?.id, error);
      }
    }
    for (const event of this.data.astronomyEvents) {
      try {
        validateAstronomyEvent(event, event.calendarId ? this.calendars.get(event.calendarId) : null);
        this.astronomy.register({ ...event, providerId: WORLD_PROVIDER_ID }, { replace: true });
      } catch (error) {
        console.warn("Calendar Forge | Skipping invalid world astronomical event", event?.id, error);
      }
    }
    for (const holiday of this.data.holidays) {
      try {
        validateHolidayDefinition(holiday, this.calendars.get(holiday.calendarId));
        this.holidays?.register({ ...holiday, providerId: WORLD_PROVIDER_ID }, { replace: true });
      } catch (error) {
        console.warn("Calendar Forge | Skipping invalid world holiday", holiday?.id, error);
      }
    }
    for (const event of this.data.historicalEvents) {
      try {
        validateHistoricalEvent(event, this.calendars.get(event.calendarId));
        this.historical?.register({ ...event, providerId: WORLD_PROVIDER_ID }, { replace: true });
      } catch (error) {
        console.warn("Calendar Forge | Skipping invalid world historical event", event?.id, error);
      }
    }
  }

  async #persist() {
    await game.settings.set(MODULE_ID, SETTINGS.WORLD_DATA, clone(this.data));
    Hooks.callAll("calendarForgeDefinitionsChanged");
  }

  isWorldCalendar(id) { return this.data.calendars.some((entry) => entry.id === id); }
  isWorldRegion(id) { return this.data.regions.some((entry) => entry.id === id); }
  isWorldSeasonProfile(id) { return this.data.seasonProfiles.some((entry) => entry.id === id); }
  isWorldMoonProfile(id) { return this.data.moonProfiles.some((entry) => entry.id === id); }
  isWorldAstronomyEvent(id) { return this.data.astronomyEvents.some((entry) => entry.id === id); }
  isWorldHoliday(id) { return this.data.holidays.some((entry) => entry.id === id); }
  isWorldHistoricalEvent(id) { return this.data.historicalEvents.some((entry) => entry.id === id); }

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
    const index = this.data.calendars.findIndex((entry) => entry.id === normalized.id);
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
    const usedByRegion = this.regions.list().find((region) => region.calendarId === id);
    if (usedByRegion) throw new Error(`Calendar '${id}' is used by region '${usedByRegion.id}'`);
    const usedBySeason = this.seasons.list().find((profile) => profile.calendarId === id);
    if (usedBySeason) throw new Error(`Calendar '${id}' is used by season profile '${usedBySeason.id}'`);
    const usedByMoon = this.moons.list().find((profile) => profile.calendarId === id);
    if (usedByMoon) throw new Error(`Calendar '${id}' is used by moon profile '${usedByMoon.id}'`);
    const usedByAstronomy = this.astronomy.list().find((event) => event.calendarId === id);
    if (usedByAstronomy) throw new Error(`Calendar '${id}' is used by astronomical event '${usedByAstronomy.id}'`);
    const usedByHoliday = this.holidays?.list().find((event) => event.calendarId === id);
    if (usedByHoliday) throw new Error(`Calendar '${id}' is used by holiday '${usedByHoliday.id}'`);
    const usedByHistorical = this.historical?.list().find((event) => event.calendarId === id);
    if (usedByHistorical) throw new Error(`Calendar '${id}' is used by historical event '${usedByHistorical.id}'`);
    const before = this.data.calendars.length;
    this.data.calendars = this.data.calendars.filter((entry) => entry.id !== id);
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
    if (normalized.seasonProfileId) {
      const season = this.seasons.get(normalized.seasonProfileId);
      if (!season) throw new Error(`Unknown season profile '${normalized.seasonProfileId}'`);
      if (normalized.calendarId && season.calendarId !== normalized.calendarId) throw new Error(`Season profile '${season.id}' belongs to calendar '${season.calendarId}'`);
    }
    for (const id of normalized.moonProfileIds ?? []) {
      const moon = this.moons.get(id);
      if (!moon) throw new Error(`Unknown moon profile '${id}'`);
      if (normalized.calendarId && moon.calendarId && moon.calendarId !== normalized.calendarId) throw new Error(`Moon profile '${moon.id}' belongs to calendar '${moon.calendarId}'`);
    }
    const index = this.data.regions.findIndex((entry) => entry.id === normalized.id);
    if (index < 0 && this.regions.has(normalized.id)) throw new Error(`Region id '${normalized.id}' is already provided by another source`);
    if (index >= 0) this.data.regions[index] = normalized;
    else this.data.regions.push(normalized);
    this.regions.register(normalized, { replace: true });
    await this.#persist();
    return this.regions.get(normalized.id);
  }

  async deleteRegion(id) {
    const usedByAstronomy = this.astronomy.list().find((event) => event.regionId === id || (event.regionIds ?? []).includes(id));
    if (usedByAstronomy) throw new Error(`Region '${id}' is used by astronomical event '${usedByAstronomy.id}'`);
    const usedByHoliday = this.holidays?.list().find((event) => event.regionId === id || (event.regionIds ?? []).includes(id));
    if (usedByHoliday) throw new Error(`Region '${id}' is used by holiday '${usedByHoliday.id}'`);
    const usedByHistorical = this.historical?.list().find((event) => event.regionId === id || (event.regionIds ?? []).includes(id));
    if (usedByHistorical) throw new Error(`Region '${id}' is used by historical event '${usedByHistorical.id}'`);
    const before = this.data.regions.length;
    this.data.regions = this.data.regions.filter((entry) => entry.id !== id);
    if (this.data.regions.length === before) return false;
    this.regions.unregister(id);
    await this.#persist();
    return true;
  }

  async saveSeasonProfile(definition) {
    const normalized = { ...clone(definition), providerId: WORLD_PROVIDER_ID };
    const calendar = this.calendars.get(normalized.calendarId);
    if (!calendar) throw new Error(`Unknown calendar '${normalized.calendarId}'`);
    validateSeasonProfile(normalized, calendar);
    const index = this.data.seasonProfiles.findIndex((entry) => entry.id === normalized.id);
    if (index < 0 && this.seasons.has(normalized.id)) throw new Error(`Season profile id '${normalized.id}' is already provided by another source`);
    if (index >= 0) this.data.seasonProfiles[index] = normalized;
    else this.data.seasonProfiles.push(normalized);
    this.seasons.register(normalized, { replace: true });
    await this.#persist();
    return this.seasons.get(normalized.id);
  }

  async deleteSeasonProfile(id) {
    const usedBy = this.regions.list().find((region) => region.seasonProfileId === id);
    if (usedBy) throw new Error(`Season profile '${id}' is used by region '${usedBy.id}'`);
    const before = this.data.seasonProfiles.length;
    this.data.seasonProfiles = this.data.seasonProfiles.filter((entry) => entry.id !== id);
    if (this.data.seasonProfiles.length === before) return false;
    this.seasons.unregister(id);
    await this.#persist();
    return true;
  }

  async saveMoonProfile(definition) {
    const normalized = { ...clone(definition), providerId: WORLD_PROVIDER_ID };
    if (normalized.calendarId && !this.calendars.has(normalized.calendarId)) throw new Error(`Unknown calendar '${normalized.calendarId}'`);
    const calendar = normalized.calendarId ? this.calendars.get(normalized.calendarId) : null;
    validateMoonProfile(normalized, calendar);
    const index = this.data.moonProfiles.findIndex((entry) => entry.id === normalized.id);
    if (index < 0 && this.moons.has(normalized.id)) throw new Error(`Moon profile id '${normalized.id}' is already provided by another source`);
    if (index >= 0) this.data.moonProfiles[index] = normalized;
    else this.data.moonProfiles.push(normalized);
    this.moons.register(normalized, { replace: true });
    await this.#persist();
    return this.moons.get(normalized.id);
  }

  async deleteMoonProfile(id) {
    const usedBy = this.regions.list().find((region) => (region.moonProfileIds ?? []).includes(id));
    if (usedBy) throw new Error(`Moon profile '${id}' is used by region '${usedBy.id}'`);
    const before = this.data.moonProfiles.length;
    this.data.moonProfiles = this.data.moonProfiles.filter((entry) => entry.id !== id);
    if (this.data.moonProfiles.length === before) return false;
    this.moons.unregister(id);
    await this.#persist();
    return true;
  }

  async saveAstronomyEvent(definition) {
    const normalized = { ...clone(definition), providerId: WORLD_PROVIDER_ID };
    if (normalized.calendarId && !this.calendars.has(normalized.calendarId)) throw new Error(`Unknown calendar '${normalized.calendarId}'`);
    if (normalized.regionId && !this.regions.has(normalized.regionId)) throw new Error(`Unknown region '${normalized.regionId}'`);
    validateAstronomyEvent(normalized, normalized.calendarId ? this.calendars.get(normalized.calendarId) : null);
    const index = this.data.astronomyEvents.findIndex((entry) => entry.id === normalized.id);
    if (index < 0 && this.astronomy.has(normalized.id)) throw new Error(`Astronomical event id '${normalized.id}' is already provided by another source`);
    if (index >= 0) this.data.astronomyEvents[index] = normalized;
    else this.data.astronomyEvents.push(normalized);
    this.astronomy.register(normalized, { replace: true });
    await this.#persist();
    return this.astronomy.get(normalized.id);
  }

  async deleteAstronomyEvent(id) {
    const before = this.data.astronomyEvents.length;
    this.data.astronomyEvents = this.data.astronomyEvents.filter((entry) => entry.id !== id);
    if (this.data.astronomyEvents.length === before) return false;
    this.astronomy.unregister(id);
    await this.#persist();
    return true;
  }

  async saveHoliday(definition) {
    const normalized = { ...clone(definition), providerId: WORLD_PROVIDER_ID };
    const calendar = this.calendars.get(normalized.calendarId);
    if (!calendar) throw new Error(`Unknown calendar '${normalized.calendarId}'`);
    if (normalized.regionId && !this.regions.has(normalized.regionId)) throw new Error(`Unknown region '${normalized.regionId}'`);
    for (const regionId of normalized.regionIds ?? []) if (!this.regions.has(regionId)) throw new Error(`Unknown region '${regionId}'`);
    validateHolidayDefinition(normalized, calendar);
    const index = this.data.holidays.findIndex((entry) => entry.id === normalized.id);
    if (index < 0 && this.holidays?.has(normalized.id)) throw new Error(`Holiday id '${normalized.id}' is already provided by another source`);
    if (index >= 0) this.data.holidays[index] = normalized;
    else this.data.holidays.push(normalized);
    this.holidays?.register(normalized, { replace: true });
    await this.#persist();
    return this.holidays?.get(normalized.id) ?? normalized;
  }

  async deleteHoliday(id) {
    const before = this.data.holidays.length;
    this.data.holidays = this.data.holidays.filter((entry) => entry.id !== id);
    if (this.data.holidays.length === before) return false;
    this.holidays?.unregister(id);
    await this.#persist();
    return true;
  }

  async saveHistoricalEvent(definition) {
    const normalized = { ...clone(definition), providerId: WORLD_PROVIDER_ID };
    const calendar = this.calendars.get(normalized.calendarId);
    if (!calendar) throw new Error(`Unknown calendar '${normalized.calendarId}'`);
    if (normalized.regionId && !this.regions.has(normalized.regionId)) throw new Error(`Unknown region '${normalized.regionId}'`);
    for (const regionId of normalized.regionIds ?? []) if (!this.regions.has(regionId)) throw new Error(`Unknown region '${regionId}'`);
    validateHistoricalEvent(normalized, calendar);
    const index = this.data.historicalEvents.findIndex((entry) => entry.id === normalized.id);
    if (index < 0 && this.historical?.has(normalized.id)) throw new Error(`Historical event id '${normalized.id}' is already provided by another source`);
    if (index >= 0) this.data.historicalEvents[index] = normalized;
    else this.data.historicalEvents.push(normalized);
    this.historical?.register(normalized, { replace: true });
    await this.#persist();
    return this.historical?.get(normalized.id) ?? normalized;
  }

  async deleteHistoricalEvent(id) {
    const before = this.data.historicalEvents.length;
    this.data.historicalEvents = this.data.historicalEvents.filter((entry) => entry.id !== id);
    if (this.data.historicalEvents.length === before) return false;
    this.historical?.unregister(id);
    await this.#persist();
    return true;
  }
}

export { WORLD_PROVIDER_ID };
