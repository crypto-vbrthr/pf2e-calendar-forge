import { API_VERSION, SCHEMA_VERSION } from "../constants.js";

export function createCalendarApi({ temporal, providers, registries, events, openCalendar }) {
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

    providers,

    calendars: Object.freeze({
      get: (id) => registries.calendars.get(id),
      list: () => registries.calendars.list()
    }),

    seasonProfiles: Object.freeze({
      get: (id) => registries.seasons.get(id),
      list: () => registries.seasons.list()
    }),

    moonProfiles: Object.freeze({
      get: (id) => registries.moons.get(id),
      list: () => registries.moons.list()
    }),

    registerEventProvider(id, provider) {
      return events.registerProvider(id, provider);
    },

    unregisterEventProvider(id) {
      return events.unregisterProvider(id);
    }
  });
}
