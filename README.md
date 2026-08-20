# Calendar Forge 0.4.0

Calendar Forge is a Foundry VTT 14 calendar and temporal-context service. Foundry `game.time.worldTime` remains the only running clock. Calendar Forge translates that absolute time into localized calendar dates, regional contexts, seasons, moon states, astronomy, holidays, and campaign/world chronology for users and other modules.

## 0.4.0 – Holidays, Historical Events & Chronicle

### Holidays

Holidays are now first-class Calendar Forge content.

A holiday can be:

- global or restricted to a region;
- public or GM-only;
- annually recurring or tied to one specific year;
- one or several calendar days long;
- localized by provider modules;
- categorized and assigned a custom Font Awesome icon;
- linked to a Foundry document by UUID.

Multi-day festivals are evaluated using calendar arithmetic, so they can continue correctly across month and year boundaries. A holiday that begins on the final day of a year can therefore remain active on the first days of the following year without any separate running calendar clock.

### Historical events

Historical events are separate from holidays and support explicit time precision:

- year;
- month;
- day;
- hour;
- minute;
- second.

Precision is semantic, not cosmetic. A historical event known only to have happened in a certain year remains a year-level entry and does not receive an invented month, day, or midnight timestamp. Day-or-better precision events also appear as markers on the monthly calendar.

Historical events may be global/regional, public/GM-only, localized, categorized, iconized, and linked to Foundry documents.

### Chronicle

The main Calendar Forge window now has a Chronicle button. The Chronicle is a large, searchable time-line view that can be used while the calendar itself remains closed most of the session.

Filters include:

- regional/world time context;
- start and end year;
- holidays;
- historical events;
- Campaign Forge/provider events;
- other external events;
- text search across names, descriptions, and categories.

Yearly holidays are expanded into concrete occurrences inside the requested range. Historical entries retain their declared precision.

GM users also receive Holidays and History management tabs in the same window. Provider content is read-only and can be duplicated into a world-owned definition before editing.

### Monthly calendar integration

Calendar day markers can now include:

- season changes;
- moon-phase transitions;
- astronomical events;
- holidays;
- historical events;
- Campaign Forge or other external provider events.

The day inspector shows holiday/festival progress, historical event time where known, descriptions, and optional Foundry-document links.

## Event provider contract

The existing event-provider mechanism is extended for Chronicle use. This is intended for modules such as Campaign Forge that own their event data and should not duplicate it into Calendar Forge.

```js
CalendarForge.api.registerEventProvider("campaign-forge", async (request) => {
  if (request.type === "date") {
    // Return events relevant to request.date / request.context.
    // Canonical Foundry worldTime may be supplied and Calendar Forge
    // will filter it against the regional calendar day.
    return [];
  }

  if (request.type === "chronicle") {
    // request.range: { fromYear, toYear }
    // request.context.rangeStartWorldTime / rangeEndWorldTime are canonical
    // Foundry world-time bounds for modules that store timestamps that way.
    return [{
      id: "quest-complete",
      sourceType: "campaign",
      label: { value: "The northern gate was reclaimed" },
      worldTime: 18422311,
      precision: "second",
      journalUuid: "JournalEntry.example"
    }];
  }

  return [];
});
```

Chronicle providers may return either a calendar `date` plus `precision`, or canonical `worldTime`. The latter is especially useful for Campaign Forge because Calendar Forge converts it into the currently requested regional calendar context.

## Provider content additions

Calendar content modules can now register holidays and historical events alongside calendars, regions, seasons, moons, and astronomy:

```js
Hooks.once("calendarForgeReady", (api) => {
  api.providers.register({
    id: "my-setting-calendar-pack",
    schemaVersion: 3,
    contentVersion: "1.0.0",

    calendars: [/* ... */],
    regionProfiles: [/* ... */],

    holidays: [{
      id: "harvest-festival",
      calendarId: "my-calendar",
      regionId: "my-region",
      label: { i18n: "MY_PACK.Holidays.HarvestFestival.Name" },
      description: { i18n: "MY_PACK.Holidays.HarvestFestival.Description" },
      recurrence: { type: "yearly", monthId: "harvest", day: 17 },
      durationDays: 3,
      visibility: "public",
      icon: "fa-wheat-awn"
    }],

    historicalEvents: [{
      id: "founding-of-the-city",
      calendarId: "my-calendar",
      label: { i18n: "MY_PACK.History.CityFounded.Name" },
      description: { i18n: "MY_PACK.History.CityFounded.Description" },
      precision: "year",
      date: { year: 812 },
      visibility: "public",
      icon: "fa-landmark"
    }]
  });
});
```

Labels, descriptions, categories, calendar/month/weekday names, seasons, moon names and phases continue to support normal Foundry i18n keys.

## API additions

```js
await CalendarForge.api.getEventsForDate({ regionId: "varisia" });

await CalendarForge.api.getChronicle({
  regionId: "varisia",
  fromYear: 4700,
  toYear: 4724,
  eventType: "all", // all | holiday | historical | campaign | external
  query: "war"
});

CalendarForge.api.holidays.list();
CalendarForge.api.historicalEvents.list();
CalendarForge.api.openChronicle({ regionId: "varisia" });
```

`getTemporalContext()` continues to expose `events` for the currently resolved regional calendar day.

## Hooks

0.4.0 adds event-state hooks driven by changes to Foundry world time:

- `calendarForgeEventsChanged(events, context, change)`
- `calendarForgeHolidaysStarted(holidays, context, change)`
- `calendarForgeHolidaysEnded(holidays, context, change)`

Existing calendar, day, month, year, region, season, moon, and astronomy hooks remain available.

## Persistence and migration

The world-data object now supports:

```js
{
  calendars: [],
  regions: [],
  seasonProfiles: [],
  moonProfiles: [],
  astronomyEvents: [],
  holidays: [],
  historicalEvents: [],
  anchors: {}
}
```

Older 0.2.x/0.3.x world data remains migration-safe; missing arrays are initialized automatically. No second running clock is introduced.

## Core design rule

Calendar Forge never owns a second advancing time value. Time-sensitive Foundry effects, Affliction Forge, and other systems continue to age from Foundry world time. Calendar Forge only answers what that instant means in a configured calendar and regional context.

## Development status

0.4.0 automated coverage includes calendar arithmetic, regional translation, season/moon/astronomy behavior, localization parity, holiday duration across year boundaries, historical precision, Chronicle expansion/filtering, canonical-world-time provider entries, provider content registration, migration safety, launcher integration, and dropdown readability.

Still deliberately deferred:

- physically derived orbital eclipse simulation;
- complex rule expressions such as “first full moon after the equinox” for holidays;
- direct Campaign Forge implementation changes;
- Weather Forge integration changes;
- a setting-specific content pack such as Calendar Forge: Golarion.
