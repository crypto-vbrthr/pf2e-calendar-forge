import { MODULE_ID } from "./constants.js";
import { registerSettings, SettingsAdapter } from "./settings.js";
import { DefinitionRegistry } from "./registry/registry.js";
import { BUILTIN_CALENDARS, BUILTIN_MOON_PROFILES, BUILTIN_SEASON_PROFILES } from "./calendar/builtin-calendars.js";
import { EventService } from "./events/event-service.js";
import { SeasonService } from "./time/season-service.js";
import { MoonService } from "./time/moon-service.js";
import { TemporalContextService } from "./time/temporal-context-service.js";
import { RegionService } from "./region/region-service.js";
import { WorldDataRepository } from "./storage/world-data-repository.js";
import { ProviderApi } from "./api/provider-api.js";
import { createCalendarApi } from "./api/calendar-api.js";
import { CalendarForgeApp } from "./ui/calendar-app.js";
import { CalendarManagerApp } from "./ui/calendar-manager-app.js";
import { RegionManagerApp } from "./ui/region-manager-app.js";
import { installRegionLauncher } from "./ui/region-launcher.js";
import { validateCalendarDefinition } from "./validation/definition-validator.js";

const registries = {
  calendars: new DefinitionRegistry("calendar"),
  seasons: new DefinitionRegistry("season profile"),
  moons: new DefinitionRegistry("moon profile"),
  regions: new DefinitionRegistry("region profile")
};
const eventService = new EventService();
let app = null;
let calendarManager = null;
let regionManager = null;
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
  for (const definition of BUILTIN_SEASON_PROFILES) registries.seasons.register(definition);
  for (const definition of BUILTIN_MOON_PROFILES) registries.moons.register(definition);
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

async function recomputeContext(reason = "configuration") {
  if (!temporal || !isReady) return;
  const previous = lastContext;
  const current = await temporal.getTemporalContext();
  lastContext = current;
  Hooks.callAll("calendarForgeContextChanged", current, { reason, previous });
  if (previous?.regionId !== current.regionId) Hooks.callAll("calendarForgeRegionChanged", current, { reason, previous });
  if (previous?.calendar?.id !== current.calendar?.id) Hooks.callAll("calendarForgeCalendarChanged", current, { reason, previous });
  if (app?.rendered) app.render({ force: true });
  if (calendarManager?.rendered) calendarManager.render({ force: true });
  if (regionManager?.rendered) regionManager.render({ force: true });
}

Hooks.once("init", () => {
  registerSettings();
  registerBuiltins();

  const seasonService = new SeasonService(registries.seasons);
  const moonService = new MoonService(registries.moons);
  const regionService = new RegionService({ regionRegistry: registries.regions, settings: SettingsAdapter });
  worldData = new WorldDataRepository({ calendarRegistry: registries.calendars, regionRegistry: registries.regions });
  temporal = new TemporalContextService({
    calendarRegistry: registries.calendars,
    seasonService,
    moonService,
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
    eventService
  });

  services = {
    temporal,
    seasons: seasonService,
    moons: moonService,
    events: eventService,
    regionService,
    settings: SettingsAdapter,
    worldData,
    registries,
    openCalendarManager,
    openRegionManager
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
    openRegionManager
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
    if (previous.calendar.monthId !== current.calendar.monthId || previous.calendar.year !== current.calendar.year) {
      Hooks.callAll("calendarForgeMonthChanged", current, change);
    }
    if (previous.calendar.day !== current.calendar.day
      || previous.calendar.monthId !== current.calendar.monthId
      || previous.calendar.year !== current.calendar.year) {
      Hooks.callAll("calendarForgeDayChanged", current, change);
    }
    if (previous.season?.id !== current.season?.id) Hooks.callAll("calendarForgeSeasonChanged", current, change);

    const beforeMoons = new Map((previous.moons ?? []).map((moon) => [moon.id, moon.phase]));
    const moonChanged = (current.moons ?? []).some((moon) => beforeMoons.get(moon.id) !== moon.phase);
    if (moonChanged) Hooks.callAll("calendarForgeMoonPhaseChanged", current, change);
  }

  lastContext = current;
  if (app?.rendered) app.render({ force: true });
});
