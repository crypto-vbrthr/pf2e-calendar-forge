# Calendar Forge 0.2.1

Calendar Forge is a Foundry VTT 14 calendar and temporal-context service. Foundry `game.time.worldTime` remains the only running clock; Calendar Forge translates that absolute time into localized calendar dates and regional temporal contexts.


## 0.2.1 – Dropdown Readability Fix

- Native select controls now explicitly request a dark color scheme.
- Dropdown option lists use a dark background with high-contrast light text on Windows/Chromium.
- Selected and disabled options have distinct readable states.
- Applies to the Calendar Forge main region selector and all calendar/region manager dropdowns.

## 0.2.0 – Calendar Definitions & Regional Time Context

### Calendar definitions

- Large Calendar Forge monthly view remains the primary calendar UI.
- New GM calendar-definition manager.
- Custom calendars can define:
  - seconds per minute, minutes per hour, and hours per day;
  - any number of weekdays with long and short names;
  - any number of months with individual lengths;
  - optional leap days per month;
  - no leap rule, Gregorian leap rule, or interval-based leap rule;
  - era labels;
  - localized/custom date and date-time formats.
- Every calendar has an independent world-time anchor. Provider calendars remain read-only, but their world anchor can be overridden for the current world.
- Provider calendars can be duplicated into editable world calendars.
- Existing 0.1.x Earth-calendar anchor settings remain a migration-safe fallback.

### Regional temporal context

- New regional-context manager.
- A region can define:
  - calendar ID;
  - fixed local time offset while retaining the same Foundry world time;
  - season profile;
  - moon profiles.
- One region can be selected as the world default.
- The main calendar can preview the world default, no region, or any registered region.
- `getTemporalContext({ regionId })`, `getDate({ regionId })`, and `toWorldTime(date, { regionId })` are bidirectional and region-aware.
- Explicit `regionId: null` bypasses the configured default region.

### Provider API

External modules can register prebuilt localized calendar content. All user-facing labels may be Foundry i18n keys.

```js
Hooks.once("calendarForgeReady", (api) => {
  api.providers.register({
    id: "calendar-forge-golarion",
    schemaVersion: 1,
    contentVersion: "1.0.0",
    calendars: [
      {
        id: "golarion-ar",
        label: { i18n: "CF_GOLARION.Calendar.Name" },
        era: { i18n: "CF_GOLARION.Calendar.Era" },
        time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
        week: {
          days: [
            {
              id: "moonday",
              label: { i18n: "CF_GOLARION.Weekdays.Moonday" },
              shortLabel: { i18n: "CF_GOLARION.Weekdays.MoondayShort" }
            }
          ]
        },
        months: [
          {
            id: "abadius",
            days: 31,
            label: { i18n: "CF_GOLARION.Months.Abadius" },
            shortLabel: { i18n: "CF_GOLARION.Months.AbadiusShort" }
          }
        ],
        leapYear: { type: "none" },
        defaultAnchor: {
          worldTime: 0,
          year: 4724,
          monthId: "abadius",
          day: 1,
          hour: 0,
          minute: 0,
          second: 0,
          weekdayIndex: 0
        },
        dateFormats: {
          date: { i18n: "CF_GOLARION.Formats.Date" },
          dateTime: { i18n: "CF_GOLARION.Formats.DateTime" }
        }
      }
    ],
    regionProfiles: [
      {
        id: "varisia",
        label: { i18n: "CF_GOLARION.Regions.Varisia" },
        calendarId: "golarion-ar",
        timeOffsetSeconds: -7200,
        seasonProfileId: "varisia-seasons",
        moonProfileIds: ["golarion-moon"]
      }
    ]
  });
});
```

Provider definitions are read-only. A GM can duplicate a provider calendar or region into a world-owned editable definition.

## Public API highlights

```js
await CalendarForge.api.getTemporalContext();
await CalendarForge.api.getTemporalContext({ regionId: "varisia" });
await CalendarForge.api.getTemporalContext({ regionId: null });

CalendarForge.api.getDate({ regionId: "varisia" });
CalendarForge.api.toWorldTime(date, { regionId: "varisia" });
CalendarForge.api.getAnchor("golarion-ar");

CalendarForge.api.calendars.list();
CalendarForge.api.regions.list();
CalendarForge.api.regions.defaultId();
CalendarForge.api.providers.register(provider);

CalendarForge.api.open();
CalendarForge.api.openCalendarManager();
CalendarForge.api.openRegionManager();
```

## Temporal-context shape

A regional context preserves canonical world time and exposes the translated local world-time value separately:

```js
{
  worldTime: 100000,          // canonical Foundry time
  localWorldTime: 92800,      // worldTime + regional offset
  regionId: "varisia",
  region: {
    id: "varisia",
    label: "Varisia",
    timeOffsetSeconds: -7200
  },
  calendar: { /* date fields */ },
  time: {
    hour: 12,
    minute: 30,
    second: 0,
    dayProgress: 0.52,
    offsetSeconds: -7200
  },
  season: { /* optional */ },
  moons: [],
  events: [],
  profiles: {
    seasonProfileId: "varisia-seasons",
    moonProfileIds: ["golarion-moon"]
  },
  formatted: { /* localized date/time strings */ }
}
```

## Hooks

- `calendarForgeReady(api)`
- `calendarForgeProviderRegistered(providerId)`
- `calendarForgeDefinitionsChanged()`
- `calendarForgeTimeChanged(context, change)`
- `calendarForgeContextChanged(context, change)`
- `calendarForgeCalendarChanged(context, change)`
- `calendarForgeRegionChanged(context, change)`
- `calendarForgeDayChanged(context, change)`
- `calendarForgeMonthChanged(context, change)`
- `calendarForgeYearChanged(context, change)`
- `calendarForgeSeasonChanged(context, change)`
- `calendarForgeMoonPhaseChanged(context, change)`

## Still deliberately deferred

- Holiday editor and complex recurrence rules.
- Historical chronicle editor.
- Solar/lunar eclipse calculation.
- Rich astronomy editor and multiple-orbit modelling.
- Campaign Forge bridge.
- Weather Forge integration changes.

The schemas and provider registries remain designed for those later layers without introducing a second clock.
