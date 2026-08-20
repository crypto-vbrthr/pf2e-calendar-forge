import { validateCalendarDefinition, validateRegionDefinition } from "../validation/definition-validator.js";

export class ProviderApi {
  constructor({ calendarRegistry, seasonRegistry, moonRegistry, regionRegistry, eventService }) {
    this.calendars = calendarRegistry;
    this.seasons = seasonRegistry;
    this.moons = moonRegistry;
    this.regions = regionRegistry;
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
    for (const definition of calendars) validateCalendarDefinition(definition);
    for (const definition of regions) validateRegionDefinition(definition);

    for (const definition of calendars) if (this.calendars.has(definition.id)) throw new Error(`Calendar '${definition.id}' is already registered`);
    for (const definition of seasons) if (this.seasons.has(definition.id)) throw new Error(`Season profile '${definition.id}' is already registered`);
    for (const definition of moons) if (this.moons.has(definition.id)) throw new Error(`Moon profile '${definition.id}' is already registered`);
    for (const definition of regions) if (this.regions.has(definition.id)) throw new Error(`Region profile '${definition.id}' is already registered`);

    for (const definition of calendars) {
      this.calendars.register({ ...definition, providerId: definition.providerId ?? provider.id });
    }
    for (const definition of seasons) {
      this.seasons.register({ ...definition, providerId: definition.providerId ?? provider.id });
    }
    for (const definition of moons) {
      this.moons.register({ ...definition, providerId: definition.providerId ?? provider.id });
    }
    for (const definition of regions) {
      this.regions.register({ ...definition, providerId: definition.providerId ?? provider.id });
    }
    for (const event of provider.events ?? []) {
      this.events.register({ ...event, providerId: event.providerId ?? provider.id });
    }

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
