import {
  validateAstronomyEvent,
  validateCalendarDefinition,
  validateHistoricalEvent,
  validateHolidayDefinition,
  validateMoonProfile,
  validateRegionDefinition,
  validateSeasonProfile
} from "../validation/definition-validator.js";

export class ProviderApi {
  constructor({ calendarRegistry, seasonRegistry, moonRegistry, regionRegistry, astronomyRegistry, holidayRegistry, historicalRegistry, eventService }) {
    this.calendars = calendarRegistry;
    this.seasons = seasonRegistry;
    this.moons = moonRegistry;
    this.regions = regionRegistry;
    this.astronomy = astronomyRegistry;
    this.holidays = holidayRegistry;
    this.historical = historicalRegistry;
    this.events = eventService;
    this.providers = new Map();
  }

  register(provider) {
    if (!provider?.id) throw new TypeError("Calendar Forge provider requires an id");
    if (this.providers.has(provider.id)) throw new Error(`Provider '${provider.id}' is already registered`);

    const calendars = provider.calendars ?? [];
    const seasons = provider.seasonProfiles ?? [];
    const moons = provider.moonProfiles ?? [];
    const regions = provider.regionProfiles ?? provider.regions ?? [];
    const astronomyEvents = provider.astronomyEvents ?? [];
    const holidays = provider.holidays ?? [];
    const historicalEvents = provider.historicalEvents ?? [];

    for (const definition of calendars) validateCalendarDefinition(definition);
    for (const definition of seasons) validateSeasonProfile(definition, calendars.find((calendar) => calendar.id === definition.calendarId) ?? this.calendars.get(definition.calendarId));
    for (const definition of moons) validateMoonProfile(definition);
    for (const definition of regions) validateRegionDefinition(definition);
    for (const definition of astronomyEvents) validateAstronomyEvent(definition, definition.calendarId ? (calendars.find((calendar) => calendar.id === definition.calendarId) ?? this.calendars.get(definition.calendarId)) : null);
    for (const definition of holidays) validateHolidayDefinition(definition, calendars.find((calendar) => calendar.id === definition.calendarId) ?? this.calendars.get(definition.calendarId));
    for (const definition of historicalEvents) validateHistoricalEvent(definition, calendars.find((calendar) => calendar.id === definition.calendarId) ?? this.calendars.get(definition.calendarId));

    const calendarById = (id) => calendars.find((entry) => entry.id === id) ?? this.calendars.get(id);
    const seasonById = (id) => seasons.find((entry) => entry.id === id) ?? this.seasons.get(id);
    const moonById = (id) => moons.find((entry) => entry.id === id) ?? this.moons.get(id);
    const regionById = (id) => regions.find((entry) => entry.id === id) ?? this.regions.get(id);
    for (const definition of seasons) {
      if (!calendarById(definition.calendarId)) throw new Error(`Season profile '${definition.id}' references unknown calendar '${definition.calendarId}'`);
    }
    for (const definition of moons) {
      if (!calendarById(definition.calendarId)) throw new Error(`Moon profile '${definition.id}' references unknown calendar '${definition.calendarId}'`);
    }
    for (const definition of astronomyEvents) {
      if (!calendarById(definition.calendarId)) throw new Error(`Astronomical event '${definition.id}' references unknown calendar '${definition.calendarId}'`);
      if (definition.regionId && !regionById(definition.regionId)) throw new Error(`Astronomical event '${definition.id}' references unknown region '${definition.regionId}'`);
    }
    for (const definition of holidays) {
      if (!calendarById(definition.calendarId)) throw new Error(`Holiday '${definition.id}' references unknown calendar '${definition.calendarId}'`);
      if (definition.regionId && !regionById(definition.regionId)) throw new Error(`Holiday '${definition.id}' references unknown region '${definition.regionId}'`);
      for (const regionId of definition.regionIds ?? []) if (!regionById(regionId)) throw new Error(`Holiday '${definition.id}' references unknown region '${regionId}'`);
    }
    for (const definition of historicalEvents) {
      if (!calendarById(definition.calendarId)) throw new Error(`Historical event '${definition.id}' references unknown calendar '${definition.calendarId}'`);
      if (definition.regionId && !regionById(definition.regionId)) throw new Error(`Historical event '${definition.id}' references unknown region '${definition.regionId}'`);
      for (const regionId of definition.regionIds ?? []) if (!regionById(regionId)) throw new Error(`Historical event '${definition.id}' references unknown region '${regionId}'`);
    }
    for (const definition of regions) {
      const calendar = definition.calendarId ? calendarById(definition.calendarId) : null;
      if (definition.calendarId && !calendar) throw new Error(`Region '${definition.id}' references unknown calendar '${definition.calendarId}'`);
      if (definition.seasonProfileId) {
        const season = seasonById(definition.seasonProfileId);
        if (!season) throw new Error(`Region '${definition.id}' references unknown season profile '${definition.seasonProfileId}'`);
        if (calendar && season.calendarId !== calendar.id) throw new Error(`Region '${definition.id}' uses a season profile for another calendar`);
      }
      for (const moonId of definition.moonProfileIds ?? []) {
        const moon = moonById(moonId);
        if (!moon) throw new Error(`Region '${definition.id}' references unknown moon profile '${moonId}'`);
        if (calendar && moon.calendarId !== calendar.id) throw new Error(`Region '${definition.id}' uses a moon profile for another calendar`);
      }
    }

    for (const definition of calendars) if (this.calendars.has(definition.id)) throw new Error(`Calendar '${definition.id}' is already registered`);
    for (const definition of seasons) if (this.seasons.has(definition.id)) throw new Error(`Season profile '${definition.id}' is already registered`);
    for (const definition of moons) if (this.moons.has(definition.id)) throw new Error(`Moon profile '${definition.id}' is already registered`);
    for (const definition of regions) if (this.regions.has(definition.id)) throw new Error(`Region profile '${definition.id}' is already registered`);
    for (const definition of astronomyEvents) if (this.astronomy.has(definition.id)) throw new Error(`Astronomical event '${definition.id}' is already registered`);
    for (const definition of holidays) if (this.holidays?.has(definition.id)) throw new Error(`Holiday '${definition.id}' is already registered`);
    for (const definition of historicalEvents) if (this.historical?.has(definition.id)) throw new Error(`Historical event '${definition.id}' is already registered`);

    for (const definition of calendars) this.calendars.register({ ...definition, providerId: definition.providerId ?? provider.id });
    for (const definition of seasons) this.seasons.register({ ...definition, providerId: definition.providerId ?? provider.id });
    for (const definition of moons) this.moons.register({ ...definition, providerId: definition.providerId ?? provider.id });
    for (const definition of regions) this.regions.register({ ...definition, providerId: definition.providerId ?? provider.id });
    for (const definition of astronomyEvents) this.astronomy.register({ ...definition, providerId: definition.providerId ?? provider.id });
    for (const definition of holidays) this.holidays?.register({ ...definition, providerId: definition.providerId ?? provider.id });
    for (const definition of historicalEvents) this.historical?.register({ ...definition, providerId: definition.providerId ?? provider.id });
    for (const event of provider.events ?? []) this.events.register({ ...event, providerId: event.providerId ?? provider.id });

    this.providers.set(provider.id, Object.freeze({
      id: provider.id,
      schemaVersion: provider.schemaVersion ?? 1,
      contentVersion: provider.contentVersion ?? "0.0.0"
    }));

    Hooks.callAll("calendarForgeProviderRegistered", provider.id);
    Hooks.callAll("calendarForgeDefinitionsChanged");
    return this.providers.get(provider.id);
  }

  list() {
    return [...this.providers.values()];
  }
}
