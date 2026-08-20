# Calendar Forge 0.3.0

Calendar Forge is a Foundry VTT 14 calendar and temporal-context service. Foundry `game.time.worldTime` remains the only running clock. Calendar Forge translates that absolute time into localized calendar dates, regional contexts, seasons, moon states, and astronomical events for both users and other modules.

## 0.3.0 – Seasons, Moons & Astronomical Events

### Seasons

- Season profiles are now first-class editable world content.
- A season profile belongs to a calendar and defines any number of seasons by start month/day.
- The temporal context exposes:
  - active season id and localized label;
  - progress through the season;
  - elapsed/remaining season days;
  - next season id and localized label.
- Season changes appear as markers in the monthly calendar.
- A season profile can be selected as the world default or overridden by a regional context.

### Moons

- Moon profiles are now editable world content.
- Multiple moons may be active simultaneously.
- Each moon defines:
  - cycle length in calendar days;
  - a canonical Foundry-world-time reference point;
  - reference cycle progress;
  - freely configurable localized phases;
  - optional phase markers for the monthly calendar.
- The temporal context exposes phase, illumination, cycle progress, moon age, next phase, and days until the next phase.
- Marked phase transitions are calculated from Foundry world time and appear on the exact regional calendar day on which they occur.
- The day inspector shows phase transitions with their local time.

### Astronomical events

Astronomical events are now a dedicated content type. They can be created as:

- fixed dated events, optionally restricted to one year;
- annually recurring events when the year is left empty;
- periodic events driven directly by Foundry world time and a cycle length.

Supported semantic event types include:

- solar eclipse;
- lunar eclipse;
- meteor shower;
- equinox;
- solstice;
- conjunction;
- comet;
- custom event.

Events may be global or restricted to one region, public or GM-only, and may carry a custom Font Awesome icon. They appear as calendar markers and in a dedicated astronomy card in the day inspector.

Calendar Forge does **not** yet attempt full orbital eclipse simulation. Eclipse entries can be provided by a content module, entered for known dates, or modeled as a configured cycle when a setting has a simple periodic rule.

### Temporal Profiles manager

The main calendar now has a third GM management button alongside calendar and region management. It opens a large management window with three areas:

- Seasons
- Moons
- Astronomical Events

Provider definitions are read-only and can be duplicated into editable world-owned definitions. World-owned definitions persist in the Calendar Forge world-data setting.

### Regional integration

Regional contexts continue to select their own season and moon profiles. The region editor now only offers season/moon profiles that are compatible with the selected calendar, and saving a mismatched profile is rejected.

### Calendar markers

A calendar day can now combine markers from several independent sources:

- season changes;
- marked moon-phase transitions;
- astronomical events;
- external/general Calendar Forge events.

Up to four icons are shown directly in the day cell; additional markers use the existing `+N` overflow indicator. Tooltips list all markers and include local event times where available.

## Temporal context additions

```js
const context = await CalendarForge.api.getTemporalContext({ regionId: "varisia" });

context.season;
// {
//   id, label, icon, progress,
//   daysElapsed, lengthDays, daysRemaining,
//   nextSeasonId, nextSeasonLabel, profileId
// }

context.moons;
// [{
//   id, label, phase, phaseLabel, icon,
//   progress, illumination, ageDays, cycleLengthDays,
//   nextPhase, nextPhaseLabel, daysUntilNextPhase
// }]

context.moonTransitions;
// marked phase transitions occurring on the current regional calendar day

context.astronomicalEvents;
// astronomical events occurring on the current regional calendar day
```

Convenience calls:

```js
await CalendarForge.api.getSeason({ regionId: "varisia" });
await CalendarForge.api.getMoons({ regionId: "varisia" });
await CalendarForge.api.getAstronomicalEvents({ regionId: "varisia" });
```

Registries:

```js
CalendarForge.api.seasonProfiles.list();
CalendarForge.api.moonProfiles.list();
CalendarForge.api.astronomicalEvents.list();
```

## Provider API additions

External content modules may now register all three new content types directly:

```js
Hooks.once("calendarForgeReady", (api) => {
  api.providers.register({
    id: "my-world-calendar-pack",
    schemaVersion: 2,
    contentVersion: "1.0.0",

    calendars: [/* ... */],

    seasonProfiles: [{
      id: "temperate-seasons",
      calendarId: "my-calendar",
      label: { i18n: "MY_PACK.Seasons.Name" },
      seasons: [
        {
          id: "spring",
          monthId: "first-month",
          day: 1,
          label: { i18n: "MY_PACK.Seasons.Spring" },
          icon: "fa-seedling"
        }
      ]
    }],

    moonProfiles: [{
      id: "silver-moon",
      calendarId: "my-calendar",
      label: { i18n: "MY_PACK.Moons.Silver" },
      cycleLengthDays: 28,
      referenceWorldTime: 0,
      referenceProgress: 0,
      phases: [
        {
          id: "full",
          start: 0.5,
          label: { i18n: "MY_PACK.MoonPhases.Full" },
          icon: "fa-circle",
          marker: true
        }
      ]
    }],

    astronomyEvents: [{
      id: "great-eclipse",
      calendarId: "my-calendar",
      regionId: "my-region",
      label: { i18n: "MY_PACK.Astronomy.GreatEclipse" },
      type: "solar-eclipse",
      mode: "date",
      date: {
        year: 812,
        monthId: "first-month",
        day: 17,
        hour: 11,
        minute: 20
      }
    }]
  });
});
```

All labels can use Foundry i18n keys. Provider content remains read-only inside Calendar Forge and can be duplicated for world-specific changes.

## Hooks

Existing hooks remain available. 0.3.0 additionally exposes:

- `calendarForgeMoonTransitionsCrossed(transitions, context, change)`
- `calendarForgeAstronomicalEventsCurrent(events, context, change)`

The existing `calendarForgeSeasonChanged` and `calendarForgeMoonPhaseChanged` hooks continue to report changes in the current resolved context.

## Persistence and migration

The world-data object now supports:

```js
{
  calendars: [],
  regions: [],
  seasonProfiles: [],
  moonProfiles: [],
  astronomyEvents: [],
  anchors: {}
}
```

0.2.x world data is loaded migration-safely; missing new arrays are initialized automatically. No second running clock is introduced.

## Development status

0.3.0 includes automated coverage for calendar arithmetic, regional time translation, localization parity, season progress, moon phase calculations and transitions, astronomical fixed/cyclic events, validators, provider content registration, launcher integration, and dropdown styling.

Still deliberately deferred:

- full orbital/positional astronomy and physically derived eclipse simulation;
- holiday editor and complex holiday recurrence rules;
- historical chronicle editor;
- Campaign Forge bridge;
- Weather Forge integration changes.
