export class ProviderApi {
  constructor({ calendarRegistry, seasonRegistry, moonRegistry, eventService }) {
    this.calendars = calendarRegistry;
    this.seasons = seasonRegistry;
    this.moons = moonRegistry;
    this.events = eventService;
    this.providers = new Map();
  }

  register(provider) {
    if (!provider?.id) throw new TypeError("Calendar Forge provider requires an id");
    if (this.providers.has(provider.id)) throw new Error(`Provider '${provider.id}' is already registered`);

    for (const definition of provider.calendars ?? []) {
      this.calendars.register({ ...definition, providerId: definition.providerId ?? provider.id });
    }
    for (const definition of provider.seasonProfiles ?? []) {
      this.seasons.register({ ...definition, providerId: definition.providerId ?? provider.id });
    }
    for (const definition of provider.moonProfiles ?? []) {
      this.moons.register({ ...definition, providerId: definition.providerId ?? provider.id });
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
    return this.providers.get(provider.id);
  }

  list() {
    return [...this.providers.values()];
  }
}
