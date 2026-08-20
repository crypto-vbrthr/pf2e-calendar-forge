# Calendar Forge 0.1.1

First architectural draft for Foundry VTT 14.

## Core principles

- `game.time.worldTime` is the only running clock.
- Calendar Forge converts world time to calendar date/time and back.
- Calendar Forge does not maintain a second ticking time value.
- Other modules consume a stable Temporal Context API.
- External modules can register calendars, season profiles, moon profiles, and calendar events.
- All provider-facing labels can use Foundry i18n keys.

## Included in 0.1.1

- Pure CalendarEngine with month/year/leap-year conversion.
- Gregorian Earth-like built-in calendar with DE/EN month and weekday localization.
- World-time anchor settings.
- Season and moon context services.
- Event registry with annual and fixed-date event support.
- Provider API for external content modules.
- Large ApplicationV2 monthly view with day inspector and day markers.
- GM world-time controls.
- Small launcher button in the Foundry V14 Scene Regions control submenu (left-hand Scene Controls).
- Public API via `game.modules.get("pf2e-calendar-forge").api` and `globalThis.CalendarForge.api`.

## Provider example

```js
Hooks.once("calendarForgeReady", (api) => {
  api.providers.register({
    id: "my-setting-calendar",
    schemaVersion: 1,
    contentVersion: "1.0.0",
    calendars: [
      {
        id: "my-calendar",
        schemaVersion: 1,
        label: { i18n: "MY_MODULE.Calendar.Name" },
        era: { i18n: "MY_MODULE.Calendar.Era" },
        time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
        week: {
          days: [
            { id: "firstday", label: { i18n: "MY_MODULE.Weekdays.First" }, shortLabel: { i18n: "MY_MODULE.Weekdays.FirstShort" } }
          ]
        },
        months: [
          { id: "harvest", days: 30, label: { i18n: "MY_MODULE.Months.Harvest" }, shortLabel: { i18n: "MY_MODULE.Months.HarvestShort" } }
        ],
        leapYear: { type: "none" },
        dateFormats: {
          date: { i18n: "MY_MODULE.Formats.Date" },
          dateTime: { i18n: "MY_MODULE.Formats.DateTime" }
        }
      }
    ]
  });
});
```

## Public API highlights

```js
await CalendarForge.api.getTemporalContext();
CalendarForge.api.getDate();
CalendarForge.api.toWorldTime(date);
await CalendarForge.api.advanceTime(seconds);
CalendarForge.api.providers.register(provider);
CalendarForge.api.registerEventProvider(id, providerFn);
CalendarForge.api.open();
```

## Hooks

- `calendarForgeReady(api)`
- `calendarForgeProviderRegistered(providerId)`
- `calendarForgeTimeChanged(context, change)`
- `calendarForgeContextChanged(context, change)`
- `calendarForgeDayChanged(context, change)`
- `calendarForgeMonthChanged(context, change)`
- `calendarForgeYearChanged(context, change)`
- `calendarForgeSeasonChanged(context, change)`
- `calendarForgeMoonPhaseChanged(context, change)`

## Deliberately deferred

The 0.1.x schema leaves room for these features, but they are not yet full editors/runtimes:

- Regional calendar overrides and regional time zones.
- Holiday editor and complex recurrence rules.
- Historical chronicle editor.
- Solar/lunar eclipse calculation.
- Multiple calendar instances per world.
- Campaign Forge bridge.
- Weather Forge integration changes.


## 0.1.1 fix

- Moved the launcher integration to the supported Foundry V14 `getSceneControlButtons` hook.
- Calendar Forge now appears as a button in the Scene Regions control submenu instead of targeting the RegionTab sidebar application.
