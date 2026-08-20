import { MODULE_ID } from "./constants.js";
import { registerSettings, SettingsAdapter } from "./settings.js";
import { DefinitionRegistry } from "./registry/registry.js";
import { BUILTIN_CALENDARS, BUILTIN_MOON_PROFILES, BUILTIN_SEASON_PROFILES } from "./calendar/builtin-calendars.js";
import { EventService } from "./events/event-service.js";
import { SeasonService } from "./time/season-service.js";
import { MoonService } from "./time/moon-service.js";
import { TemporalContextService } from "./time/temporal-context-service.js";
import { ProviderApi } from "./api/provider-api.js";
import { createCalendarApi } from "./api/calendar-api.js";
import { CalendarForgeApp } from "./ui/calendar-app.js";
import { installRegionLauncher } from "./ui/region-launcher.js";

const registries = {
  calendars: new DefinitionRegistry("calendar"),
  seasons: new DefinitionRegistry("season profile"),
  moons: new DefinitionRegistry("moon profile")
};
const eventService = new EventService();
let app = null;
let api = null;
let temporal = null;
let services = null;
let lastContext = null;

function registerBuiltins() {
  for (const definition of BUILTIN_CALENDARS) registries.calendars.register(definition);
  for (const definition of BUILTIN_SEASON_PROFILES) registries.seasons.register(definition);
  for (const definition of BUILTIN_MOON_PROFILES) registries.moons.register(definition);
}

function openCalendar(options = {}) {
  if (!app) app = new CalendarForgeApp(services, options);
  app.render({ force: true });
  return app;
}

Hooks.once("init", () => {
  registerSettings();
  registerBuiltins();

  const seasonService = new SeasonService(registries.seasons);
  const moonService = new MoonService(registries.moons);
  temporal = new TemporalContextService({
    calendarRegistry: registries.calendars,
    seasonService,
    moonService,
    eventService,
    settings: SettingsAdapter
  });

  const providers = new ProviderApi({
    calendarRegistry: registries.calendars,
    seasonRegistry: registries.seasons,
    moonRegistry: registries.moons,
    eventService
  });

  services = {
    temporal,
    seasons: seasonService,
    moons: moonService,
    events: eventService,
    settings: SettingsAdapter,
    registries
  };

  api = createCalendarApi({
    temporal,
    providers,
    registries,
    events: eventService,
    openCalendar
  });

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = api;
  globalThis.CalendarForge = { api };

  installRegionLauncher(openCalendar);
});

Hooks.once("ready", async () => {
  lastContext = await temporal?.getTemporalContext();
  Hooks.callAll("calendarForgeReady", api);
});

Hooks.on("updateWorldTime", async (worldTime, delta, options, userId) => {
  const previous = lastContext;
  const current = await temporal?.getTemporalContext({ worldTime });
  const change = { delta, options, userId, previous };

  Hooks.callAll("calendarForgeTimeChanged", current, change);
  Hooks.callAll("calendarForgeContextChanged", current, change);

  if (previous) {
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
