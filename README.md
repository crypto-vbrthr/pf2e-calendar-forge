# Calendar Forge 0.6.2

Calendar Forge is a Foundry VTT 14 calendar and temporal-context service. Foundry `game.time.worldTime` remains the only running clock. Calendar Forge translates that absolute time into localized calendar dates, regional contexts, seasons, moon states, astronomy, holidays, and chronology for users and other modules.



## 0.6.2 – Month Cell Framing Polish

0.6.2 is a tiny visual finishing pass. Every day in the month view now has a complete, restrained frame so the day number and its event markers read immediately as one unit. Hover and selected states strengthen that frame slightly, while the current-day accent remains distinct. No data, API, provider, calendar, or time behavior changes.

## 0.6.1 – UI Polish

0.6.1 is a small finishing pass before external integrations. It does not change the Calendar Forge data or provider contracts.

- the alternate-name toggle is now a clearly labelled control instead of an icon that has to be guessed;
- its tooltip changes between **Show alternate names** and **Hide alternate names**, and the active state gains an explicit check mark;
- display, content and GM-management controls are visually grouped more clearly;
- primary toolbar buttons expose `aria-label` / `aria-pressed` state and receive visible keyboard focus;
- season progress and moon illumination are rendered as explicit percentages, avoiding ambiguous values such as `0` where `0%` is meant;
- compact windows collapse the alternate-name text back to the icon while preserving tooltip and pressed-state semantics.

The provider contract remains **API 5 / Schema 4** and Calendar Forge still uses Foundry `game.time.worldTime` as its sole running clock.

## 0.6.0 – UX & Chronicle Polish

0.6.0 turns the existing calendar and chronicle services into a more comfortable day-to-day interface while keeping Foundry `game.time.worldTime` as the only running clock.

### Alternate calendar names

Months and weekdays may now carry optional `alternateLabel` and `alternateShortLabel` values in addition to their canonical names. These labels are deliberately generic rather than Earth-specific: a provider can use them for Earth equivalents such as `Rova (September)`, for a second cultural name, or leave them empty for calendars where no meaningful correspondence exists.

Each client can enable **Show alternate month and weekday names** in module settings or toggle the language button in Calendar Forge. The preference changes presentation only. Integrations can always read both canonical and alternate labels from `getTemporalContext().calendar.names`.

Example provider content:

```js
{
  id: "rova",
  days: 30,
  label: { i18n: "MY_PACK.Months.Rova" },
  alternateLabel: { i18n: "CALENDAR_FORGE.Months.September" },
  alternateShortLabel: { i18n: "CALENDAR_FORGE.Months.SeptemberShort" }
}
```

### Calendar UX

- large month view retained as the main working surface;
- new full **year overview** with compact month grids and special-day indicators;
- month/year view toggle and year navigation;
- direct **jump to date** controls;
- marker legend for seasons, moon phases, astronomy, holidays, history and Campaign/provider events;
- alternate names appear as restrained secondary labels rather than replacing setting names;
- improved responsive layout for large and smaller Foundry windows.

### Chronicle polish

The Chronicle now supports quick **current year** and **reset filters** actions, ascending/descending order, entry/source summaries, Enter-to-apply filtering, and a **Show in calendar** action that jumps the main Calendar Forge window directly to an event. Partial historical precision is preserved: year-only and month-only entries navigate to the first known date without inventing a more precise historical timestamp in storage.

### Astronomy range query

The astronomy service now exposes an efficient range query used by the year overview so fixed and cyclic events can be marked without calculating a full temporal context for every single day.

### Compatibility

The provider contract remains **API 5 / Schema 4**. Alternate labels are optional additive fields, so existing providers continue to work unchanged.

## 0.5.1 – System Clock Anchor Alignment

0.5.1 fixes a constant-offset problem exposed by the first PF2e/Golarion provider. Foundry `game.time.worldTime` remains canonical, but a provider may now supply an optional runtime `anchorResolver` that translates a system-specific clock epoch into a Calendar Forge anchor. This changes only the interpretation baseline, never the advancing world time.

The Content Providers window exposes an explicit **Synchronize with system clock** action for providers that support it. Applying suggested defaults also performs a non-destructive first alignment when no world-specific anchor exists. Existing world anchors are preserved unless the GM explicitly chooses synchronization.

Moon profiles may now use a calendar-based `referenceDate` in addition to `referenceWorldTime`. This is important when a provider aligns its calendar epoch to an existing system clock: the lunar cycle remains tied to the intended in-world date instead of drifting with an arbitrary Foundry epoch.

## 0.5.0 – Provider Hardening & Golarion Integration Foundation

0.5.0 hardens the external-content boundary before the first setting package is built. The goal is that a module such as **Calendar Forge: Golarion** can provide large localized datasets without owning time, copying content into world settings, or relying on private Calendar Forge internals.

### Transactional provider registration

Provider registration now performs a complete preflight before changing any live registry:

- definition validation;
- cross-reference validation between calendars, regions, seasons, moons and events;
- duplicate and global ID collision detection;
- Calendar Forge API/schema compatibility checks;
- provider dependency checks;
- suggested-default validation;
- optional localization-key diagnostics.

If a later unexpected failure occurs while content is being inserted, the registration is rolled back. A broken content pack can therefore no longer leave half of its calendar definitions resident until Foundry is reloaded.

### Provider dependency contract

Providers can depend on other providers and require content-version ranges:

```js
requires: [
  { id: "calendar-forge-golarion-core", minContentVersion: "1.0.0" },
  { id: "calendar-forge-golarion-holidays", optional: true }
]
```

This allows future setting content to be split cleanly, for example into a Golarion core calendar and optional regional/history packs.

### Compatibility contract

A provider can explicitly declare the Calendar Forge contract it supports:

```js
compatibility: {
  api: { min: 5, max: 5 },
  schema: { min: 4, max: 4 }
}
```

Calendar Forge 0.5.0 exposes **API 5 / Schema 4** through `CalendarForge.api.providerContract`.

### Provider diagnostics and management

The Calendar Forge top bar now contains a small **puzzle-piece** button for GMs. It opens the Content Providers window and shows:

- registered provider ID and content version;
- provider schema version;
- content counts;
- capability badges for calendars, seasons, moons, regions, astronomy, holidays, history and events;
- localization warnings;
- suggested world defaults where supplied.

This is deliberately an administrative view rather than a permanent panel.

The public API now supports:

```js
CalendarForge.api.providers.diagnose(provider);  // no mutation
CalendarForge.api.providers.validate(provider);  // throws on invalid content
CalendarForge.api.providers.get(id);
CalendarForge.api.providers.list();
CalendarForge.api.providers.listContent(id);
CalendarForge.api.providers.owns(id, "calendars", calendarId);
CalendarForge.api.providers.unregister(id);
CalendarForge.api.providers.applyDefaults(id);
```

### Suggested defaults without silent takeover

A setting provider may recommend a coherent initial setup:

```js
defaults: {
  calendarId: "golarion-ar",
  regionId: "inner-sea-default",
  seasonProfileId: "golarion-temperate-north",
  moonProfileIds: ["golarion-moon"]
}
```

Calendar Forge never applies those values automatically. The GM can choose **Apply suggested defaults** in the provider manager, or call the API explicitly. This is particularly important for existing campaigns that activate a setting pack after play has already begun.

### Provider provenance

Every externally supplied definition now records both:

```js
providerId
providerContentVersion
```

When provider content is duplicated into an editable world definition, Calendar Forge preserves its origin:

```js
source: {
  providerId,
  definitionId,
  contentVersion
}
```

Ownership still changes to `calendar-forge-world`, so later provider updates do not overwrite campaign-specific edits.

### Safe unregistration

Provider-owned definitions and static events can now be removed as one unit. Calendar Forge refuses normal unregistration when another registered provider declares a required dependency on that provider. This mainly supports development/hot reload and keeps the contract deterministic for modular setting packs.

### Static event ownership

The event service now exposes provider-aware static-event registration helpers so provider rollback and unregistration can cleanly remove only their own events. Dynamic event providers, such as the intended Campaign Forge bridge, remain separately registered through `registerEventProvider()`.

## Golarion integration foundation

No Pathfinder lore content is baked into Calendar Forge core. 0.5.0 instead freezes the integration shape needed by a separate **Calendar Forge: Golarion** module:

- localized calendar/month/weekday labels;
- one or more regional contexts;
- season and moon profiles;
- holidays and astronomy;
- historical timeline data;
- dependency/version metadata;
- suggested defaults;
- source provenance for user-created copies.

The next Golarion package can therefore remain a pure content provider and does not need privileged access to Calendar Forge internals.

See `docs/provider-contract.md` and `examples/provider-template.js` for the external-module contract.

## Core design rule

Calendar Forge still never owns a second advancing time value. Foundry world time remains canonical. All provider calendars and regional contexts are interpretations of that same instant.

## Development status

0.6.0 automated coverage includes the existing calendar/time/season/moon/astronomy/holiday/chronicle suite plus transactional provider rollback, dependency enforcement, compatibility ranges, provider ownership inspection, clean unregistration, suggested-default application, provider diagnostics UI exposure, localization parity, and world-data migration safety.

Still deliberately deferred:

- the actual Calendar Forge: Golarion content module;
- Weather Forge integration changes;
- Campaign Forge integration changes;
- physically derived orbital eclipse simulation;
- complex holiday rule expressions such as “first full moon after the equinox”.
