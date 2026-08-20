import { API_VERSION, SCHEMA_VERSION } from "../constants.js";

export function createCalendarApi({ temporal, providers, registries, events, worldData, settings, openCalendar, openCalendarManager, openRegionManager, openTemporalProfiles }) {
  return Object.freeze({
    version: API_VERSION,
    schemaVersion: SCHEMA_VERSION,

    getWorldTime() {
      return game.time.worldTime;
    },

    current(options = {}) {
      return temporal.getTemporalContext(options);
    },

    getTemporalContext(options = {}) {
      return temporal.getTemporalContext(options);
    },

    getDate(options = {}) {
      return temporal.getDate(options);
    },

    toWorldTime(date, options = {}) {
      return temporal.toWorldTime(date, options);
    },

    async getSeason(options = {}) {
      return (await temporal.getTemporalContext(options)).season;
    },

    async getMoons(options = {}) {
      return (await temporal.getTemporalContext(options)).moons;
    },

    async getAstronomicalEvents(options = {}) {
      return (await temporal.getTemporalContext(options)).astronomicalEvents;
    },

    getAnchor(calendarId = null, options = {}) {
      const calendar = temporal.getCalendar(calendarId, options);
      return calendar ? temporal.getAnchor(calendar) : null;
    },

    async advanceTime(seconds) {
      if (!game.user?.isGM) throw new Error("Only a GM may advance world time");
      return game.time.advance(Number(seconds));
    },

    async setWorldTime(worldTime) {
      if (!game.user?.isGM) throw new Error("Only a GM may set world time");
      return game.time.set(Number(worldTime));
    },

    open(options = {}) {
      return openCalendar(options);
    },

    openCalendarManager() {
      if (!game.user?.isGM) return null;
      return openCalendarManager();
    },

    openRegionManager() {
      if (!game.user?.isGM) return null;
      return openRegionManager();
    },

    openTemporalProfiles(options = {}) {
      if (!game.user?.isGM) return null;
      return openTemporalProfiles(options);
    },

    providers,

    calendars: Object.freeze({
      get: (id) => registries.calendars.get(id),
      list: () => registries.calendars.list(),
      isWorld: (id) => worldData.isWorldCalendar(id)
    }),

    regions: Object.freeze({
      get: (id) => registries.regions.get(id),
      list: () => registries.regions.list(),
      defaultId: () => settings.defaultRegionId(),
      isWorld: (id) => worldData.isWorldRegion(id)
    }),

    seasonProfiles: Object.freeze({
      get: (id) => registries.seasons.get(id),
      list: () => registries.seasons.list(),
      defaultId: () => settings.activeSeasonProfileId(),
      isWorld: (id) => worldData.isWorldSeasonProfile(id)
    }),

    moonProfiles: Object.freeze({
      get: (id) => registries.moons.get(id),
      list: () => registries.moons.list(),
      defaultIds: () => settings.activeMoonProfileIds(),
      isWorld: (id) => worldData.isWorldMoonProfile(id)
    }),

    astronomicalEvents: Object.freeze({
      get: (id) => registries.astronomy.get(id),
      list: () => registries.astronomy.list(),
      isWorld: (id) => worldData.isWorldAstronomyEvent(id)
    }),

    registerEventProvider(id, provider) {
      return events.registerProvider(id, provider);
    },

    unregisterEventProvider(id) {
      return events.unregisterProvider(id);
    }
  });
}
