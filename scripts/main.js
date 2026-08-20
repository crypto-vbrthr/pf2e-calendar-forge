import { MODULE_ID } from "./constants.js";
import { registerSettings, SettingsAdapter } from "./settings.js";
import { DefinitionRegistry } from "./registry/registry.js";
import { BUILTIN_CALENDARS, BUILTIN_MOON_PROFILES, BUILTIN_SEASON_PROFILES } from "./calendar/builtin-calendars.js";
import { EventService } from "./events/event-service.js";
import { SeasonService } from "./time/season-service.js";
import { MoonService } from "./time/moon-service.js";
import { AstronomyService } from "./time/astronomy-service.js";
import { TemporalContextService } from "./time/temporal-context-service.js";
import { RegionService } from "./region/region-service.js";
import { WorldDataRepository } from "./storage/world-data-repository.js";
import { ProviderApi } from "./api/provider-api.js";
import { createCalendarApi } from "./api/calendar-api.js";
import { CalendarForgeApp } from "./ui/calendar-app.js";
import { CalendarManagerApp } from "./ui/calendar-manager-app.js";
import { RegionManagerApp } from "./ui/region-manager-app.js";
import { TemporalProfilesApp } from "./ui/temporal-profiles-app.js";
import { ChronicleApp } from "./ui/chronicle-app.js";
import { installRegionLauncher } from "./ui/region-launcher.js";
import { validateCalendarDefinition, validateMoonProfile, validateSeasonProfile } from "./validation/definition-validator.js";

const registries = {
  calendars: new DefinitionRegistry("calendar"),
  seasons: new DefinitionRegistry("season profile"),
  moons: new DefinitionRegistry("moon profile"),
  regions: new DefinitionRegistry("region profile"),
  astronomy: new DefinitionRegistry("astronomical event"),
  holidays: new DefinitionRegistry("holiday"),
  historical: new DefinitionRegistry("historical event")
};
const eventService = new EventService({ holidayRegistry: registries.holidays, historicalRegistry: registries.historical });
let app = null;
let calendarManager = null;
let regionManager = null;
let temporalProfiles = null;
let chronicle = null;
let api = null;
let temporal = null;
let services = null;
let worldData = null;
let lastContext = null;
let isReady = false;

function registerBuiltins() {
  for (const definition of BUILTIN_CALENDARS) {
    validateCalendarDefinition(definition);
    registries.calendars.register(definition);
  }
  for (const definition of BUILTIN_SEASON_PROFILES) {
    validateSeasonProfile(definition, registries.calendars.get(definition.calendarId));
    registries.seasons.register(definition);
  }
  for (const definition of BUILTIN_MOON_PROFILES) {
    validateMoonProfile(definition);
    registries.moons.register(definition);
  }
}

function openCalendar(options = {}) {
  if (!app) app = new CalendarForgeApp(services, options);
  app.render({ force: true });
  return app;
}

function openCalendarManager() {
  if (!calendarManager) calendarManager = new CalendarManagerApp(services);
  calendarManager.render({ force: true });
  return calendarManager;
}

function openRegionManager() {
  if (!regionManager) regionManager = new RegionManagerApp(services);
  regionManager.render({ force: true });
  return regionManager;
}

function openTemporalProfiles(options = {}) {
  if (!temporalProfiles) temporalProfiles = new TemporalProfilesApp(services, options);
  else if (options.mode && options.mode !== temporalProfiles.mode) {
    temporalProfiles.mode = options.mode;
    temporalProfiles.selectedId = null;
    temporalProfiles.draft = null;
    temporalProfiles.isNew = false;
  }
  temporalProfiles.render({ force: true });
  return temporalProfiles;
}

function openChronicle(options = {}) {
  if (!chronicle) chronicle = new ChronicleApp(services, options);
  else {
    if (options.mode && options.mode !== chronicle.mode) {
      chronicle.mode = options.mode;
      chronicle.selectedId = null;
      chronicle.draft = null;
      chronicle.isNew = false;
    }
    if (Object.prototype.hasOwnProperty.call(options, "regionId")) chronicle.regionSelection = options.regionId === null ? "__world__" : (options.regionId ?? "__default__");
  }
  chronicle.render({ force: true });
  return chronicle;
}

async function recomputeContext(reason = "configuration") {
  if (!temporal || !isReady) return;
  const previous = lastContext;
  const current = await temporal.getTemporalContext();
  lastContext = current;
  Hooks.callAll("calendarForgeContextChanged", current, { reason, previous });
  if (previous?.regionId !== current.regionId) Hooks.callAll("calendarForgeRegionChanged", current, { reason, previous });
  if (previous?.calendar?.id !== current.calendar?.id) Hooks.callAll("calendarForgeCalendarChanged", current, { reason, previous });
  if (previous?.season?.id !== current.season?.id) Hooks.callAll("calendarForgeSeasonChanged", current, { reason, previous });
  if (app?.rendered) app.render({ force: true });
  if (calendarManager?.rendered) calendarManager.render({ force: true });
  if (regionManager?.rendered) regionManager.render({ force: true });
  if (temporalProfiles?.rendered) temporalProfiles.render({ force: true });
  if (chronicle?.rendered) chronicle.render({ force: true });
}

Hooks.once("init", () => {
  registerSettings();
  registerBuiltins();

  const seasonService = new SeasonService(registries.seasons);
  const moonService = new MoonService(registries.moons);
  const astronomyService = new AstronomyService(registries.astronomy);
  const regionService = new RegionService({ regionRegistry: registries.regions, settings: SettingsAdapter });
  worldData = new WorldDataRepository({
    calendarRegistry: registries.calendars,
    regionRegistry: registries.regions,
    seasonRegistry: registries.seasons,
    moonRegistry: registries.moons,
    astronomyRegistry: registries.astronomy,
    holidayRegistry: registries.holidays,
    historicalRegistry: registries.historical
  });
  temporal = new TemporalContextService({
    calendarRegistry: registries.calendars,
    seasonService,
    moonService,
    astronomyService,
    eventService,
    regionService,
    settings: SettingsAdapter,
    worldData
  });

  const providers = new ProviderApi({
    calendarRegistry: registries.calendars,
    seasonRegistry: registries.seasons,
    moonRegistry: registries.moons,
    regionRegistry: registries.regions,
    astronomyRegistry: registries.astronomy,
    holidayRegistry: registries.holidays,
    historicalRegistry: registries.historical,
    eventService
  });

  services = {
    temporal,
    seasons: seasonService,
    moons: moonService,
    astronomy: astronomyService,
    events: eventService,
    regionService,
    settings: SettingsAdapter,
    worldData,
    registries,
    openCalendarManager,
    openRegionManager,
    openTemporalProfiles,
    openChronicle
  };

  api = createCalendarApi({
    temporal,
    providers,
    registries,
    events: eventService,
    worldData,
    settings: SettingsAdapter,
    openCalendar,
    openCalendarManager,
    openRegionManager,
    openTemporalProfiles,
    openChronicle
  });

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = api;
  globalThis.CalendarForge = { api };

  installRegionLauncher(openCalendar);
});

Hooks.once("ready", async () => {
  await worldData?.load();
  lastContext = await temporal?.getTemporalContext();
  isReady = true;
  Hooks.callAll("calendarForgeReady", api);
});

Hooks.on("calendarForgeDefinitionsChanged", () => {
  void recomputeContext("definitions");
});

Hooks.on("updateWorldTime", async (worldTime, delta, options, userId) => {
  const previous = lastContext;
  const current = await temporal?.getTemporalContext({ worldTime });
  const change = { delta, options, userId, previous };

  Hooks.callAll("calendarForgeTimeChanged", current, change);
  Hooks.callAll("calendarForgeContextChanged", current, change);

  if (previous) {
    if (previous.calendar.id !== current.calendar.id) Hooks.callAll("calendarForgeCalendarChanged", current, change);
    if (previous.regionId !== current.regionId) Hooks.callAll("calendarForgeRegionChanged", current, change);
    if (previous.calendar.year !== current.calendar.year) Hooks.callAll("calendarForgeYearChanged", current, change);
    if (previous.calendar.monthId !== current.calendar.monthId || previous.calendar.year !== current.calendar.year) Hooks.callAll("calendarForgeMonthChanged", current, change);
    if (previous.calendar.day !== current.calendar.day || previous.calendar.monthId !== current.calendar.monthId || previous.calendar.year !== current.calendar.year) Hooks.callAll("calendarForgeDayChanged", current, change);
    if (previous.season?.id !== current.season?.id) Hooks.callAll("calendarForgeSeasonChanged", current, change);

    const eventKey = (event) => `${event.sourceType ?? event.type ?? "event"}:${event.id ?? event.label}`;
    const beforeEvents = new Map((previous.events ?? []).map((event) => [eventKey(event), event]));
    const currentEvents = new Map((current.events ?? []).map((event) => [eventKey(event), event]));
    const startedEvents = [...currentEvents.entries()].filter(([key]) => !beforeEvents.has(key)).map(([, event]) => event);
    const endedEvents = [...beforeEvents.entries()].filter(([key]) => !currentEvents.has(key)).map(([, event]) => event);
    if (startedEvents.length || endedEvents.length) {
      const eventChange = { ...change, started: startedEvents, ended: endedEvents };
      Hooks.callAll("calendarForgeEventsChanged", current.events ?? [], current, eventChange);
      const startedHolidays = startedEvents.filter((event) => event.type === "holiday");
      const endedHolidays = endedEvents.filter((event) => event.type === "holiday");
      if (startedHolidays.length) Hooks.callAll("calendarForgeHolidaysStarted", startedHolidays, current, eventChange);
      if (endedHolidays.length) Hooks.callAll("calendarForgeHolidaysEnded", endedHolidays, current, eventChange);
    }

    const beforeMoons = new Map((previous.moons ?? []).map((moon) => [moon.id, moon.phase]));
    const moonChanged = (current.moons ?? []).some((moon) => beforeMoons.get(moon.id) !== moon.phase);
    if (moonChanged) Hooks.callAll("calendarForgeMoonPhaseChanged", current, change);

    const start = Math.min(Number(previous.worldTime), Number(current.worldTime));
    const end = Math.max(Number(previous.worldTime), Number(current.worldTime));
    if (end > start) {
      const resolved = temporal.resolve();
      const transitions = services.moons.getTransitionsBetween(start, end, resolved.calendar, resolved.moonProfileIds);
      if (transitions.length) Hooks.callAll("calendarForgeMoonTransitionsCrossed", transitions, current, change);
    }
  }

  if ((current.astronomicalEvents ?? []).length) Hooks.callAll("calendarForgeAstronomicalEventsCurrent", current.astronomicalEvents, current, change);

  lastContext = current;
  if (app?.rendered) app.render({ force: true });
  if (chronicle?.rendered) chronicle.render({ force: true });
});
