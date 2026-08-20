import { MODULE_ID, SETTINGS } from "./constants.js";
import { CalendarEngine } from "./calendar/calendar-engine.js";

function register(name, data) {
  game.settings.register(MODULE_ID, name, data);
}

export function registerSettings() {
  register(SETTINGS.ACTIVE_CALENDAR, {
    name: "CALENDAR_FORGE.Settings.ActiveCalendar.Name",
    hint: "CALENDAR_FORGE.Settings.ActiveCalendar.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "earth-gregorian"
  });
  register(SETTINGS.DEFAULT_REGION, {
    name: "CALENDAR_FORGE.Settings.DefaultRegion.Name",
    hint: "CALENDAR_FORGE.Settings.DefaultRegion.Hint",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  register(SETTINGS.WORLD_DATA, {
    scope: "world",
    config: false,
    type: Object,
    default: { calendars: [], regions: [], seasonProfiles: [], moonProfiles: [], astronomyEvents: [], holidays: [], historicalEvents: [], anchors: {} }
  });

  // Legacy 0.1.x anchor settings remain as a migration-safe fallback. New anchors are
  // stored per calendar in WORLD_DATA and edited from Calendar Forge itself.
  register(SETTINGS.ANCHOR_WORLD_TIME, {
    name: "CALENDAR_FORGE.Settings.AnchorWorldTime.Name",
    hint: "CALENDAR_FORGE.Settings.AnchorWorldTime.Hint",
    scope: "world", config: false, type: Number, default: 0
  });
  register(SETTINGS.ANCHOR_YEAR, {
    name: "CALENDAR_FORGE.Settings.AnchorYear.Name",
    hint: "CALENDAR_FORGE.Settings.AnchorYear.Hint",
    scope: "world", config: false, type: Number, default: 2026
  });
  register(SETTINGS.ANCHOR_MONTH, {
    name: "CALENDAR_FORGE.Settings.AnchorMonth.Name",
    hint: "CALENDAR_FORGE.Settings.AnchorMonth.Hint",
    scope: "world", config: false, type: String, default: "january"
  });
  register(SETTINGS.ANCHOR_DAY, {
    name: "CALENDAR_FORGE.Settings.AnchorDay.Name",
    scope: "world", config: false, type: Number, default: 1
  });
  register(SETTINGS.ANCHOR_HOUR, {
    name: "CALENDAR_FORGE.Settings.AnchorHour.Name",
    scope: "world", config: false, type: Number, default: 0
  });
  register(SETTINGS.ANCHOR_MINUTE, {
    name: "CALENDAR_FORGE.Settings.AnchorMinute.Name",
    scope: "world", config: false, type: Number, default: 0
  });
  register(SETTINGS.ANCHOR_SECOND, {
    name: "CALENDAR_FORGE.Settings.AnchorSecond.Name",
    scope: "world", config: false, type: Number, default: 0
  });
  register(SETTINGS.ANCHOR_WEEKDAY, {
    name: "CALENDAR_FORGE.Settings.AnchorWeekday.Name",
    hint: "CALENDAR_FORGE.Settings.AnchorWeekday.Hint",
    scope: "world", config: false, type: Number, default: 3
  });
  register(SETTINGS.ACTIVE_SEASON_PROFILE, {
    name: "CALENDAR_FORGE.Settings.SeasonProfile.Name",
    hint: "CALENDAR_FORGE.Settings.SeasonProfile.Hint",
    scope: "world", config: true, type: String, default: "earth-northern-temperate"
  });
  register(SETTINGS.ACTIVE_MOON_PROFILES, {
    name: "CALENDAR_FORGE.Settings.MoonProfiles.Name",
    hint: "CALENDAR_FORGE.Settings.MoonProfiles.Hint",
    scope: "world", config: true, type: String, default: "earth-luna"
  });
  register(SETTINGS.SHOW_ALTERNATE_NAMES, {
    name: "CALENDAR_FORGE.Settings.ShowAlternateNames.Name",
    hint: "CALENDAR_FORGE.Settings.ShowAlternateNames.Hint",
    scope: "client", config: true, type: Boolean, default: false,
    onChange: () => Hooks.callAll("calendarForgeDisplaySettingsChanged")
  });
}

export const SettingsAdapter = {
  activeCalendarId() {
    return game.settings.get(MODULE_ID, SETTINGS.ACTIVE_CALENDAR);
  },
  async setActiveCalendarId(id) {
    return game.settings.set(MODULE_ID, SETTINGS.ACTIVE_CALENDAR, id);
  },
  defaultRegionId() {
    return game.settings.get(MODULE_ID, SETTINGS.DEFAULT_REGION) || null;
  },
  async setDefaultRegionId(id) {
    return game.settings.set(MODULE_ID, SETTINGS.DEFAULT_REGION, id ?? "");
  },
  activeSeasonProfileId() {
    return game.settings.get(MODULE_ID, SETTINGS.ACTIVE_SEASON_PROFILE);
  },
  async setActiveSeasonProfileId(id) {
    return game.settings.set(MODULE_ID, SETTINGS.ACTIVE_SEASON_PROFILE, id ?? "");
  },
  activeMoonProfileIds() {
    return String(game.settings.get(MODULE_ID, SETTINGS.ACTIVE_MOON_PROFILES) ?? "")
      .split(",").map((value) => value.trim()).filter(Boolean);
  },
  async setActiveMoonProfileIds(ids) {
    return game.settings.set(MODULE_ID, SETTINGS.ACTIVE_MOON_PROFILES, [...(ids ?? [])].join(","));
  },
  showAlternateNames() {
    return Boolean(game.settings.get(MODULE_ID, SETTINGS.SHOW_ALTERNATE_NAMES));
  },
  async setShowAlternateNames(value) {
    return game.settings.set(MODULE_ID, SETTINGS.SHOW_ALTERNATE_NAMES, Boolean(value));
  },
  legacyAnchor(calendar) {
    const preferredMonth = game.settings.get(MODULE_ID, SETTINGS.ANCHOR_MONTH);
    const monthId = calendar.months.some((month) => month.id === preferredMonth)
      ? preferredMonth
      : calendar.months[0]?.id;
    const year = Number(game.settings.get(MODULE_ID, SETTINGS.ANCHOR_YEAR));
    const monthIndex = calendar.months.findIndex((month) => month.id === monthId);
    const requestedDay = Number(game.settings.get(MODULE_ID, SETTINGS.ANCHOR_DAY));
    const maxDay = CalendarEngine.daysInMonth(year, monthIndex, calendar);
    const day = Math.max(1, Math.min(maxDay, Number.isFinite(requestedDay) ? Math.trunc(requestedDay) : 1));
    return {
      worldTime: Number(game.settings.get(MODULE_ID, SETTINGS.ANCHOR_WORLD_TIME)),
      year,
      monthId,
      day,
      hour: Number(game.settings.get(MODULE_ID, SETTINGS.ANCHOR_HOUR)),
      minute: Number(game.settings.get(MODULE_ID, SETTINGS.ANCHOR_MINUTE)),
      second: Number(game.settings.get(MODULE_ID, SETTINGS.ANCHOR_SECOND)),
      weekdayIndex: Number(game.settings.get(MODULE_ID, SETTINGS.ANCHOR_WEEKDAY))
    };
  }
};
