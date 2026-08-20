# Calendar Forge 0.5.0

Calendar Forge is a Foundry VTT 14 calendar and temporal-context service. Foundry `game.time.worldTime` remains the only running clock. Calendar Forge translates that absolute time into localized calendar dates, regional contexts, seasons, moon states, astronomy, holidays, and chronology for users and other modules.

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

0.5.0 automated coverage includes the existing calendar/time/season/moon/astronomy/holiday/chronicle suite plus transactional provider rollback, dependency enforcement, compatibility ranges, provider ownership inspection, clean unregistration, suggested-default application, provider diagnostics UI exposure, localization parity, and world-data migration safety.

Still deliberately deferred:

- the actual Calendar Forge: Golarion content module;
- Weather Forge integration changes;
- Campaign Forge integration changes;
- physically derived orbital eclipse simulation;
- complex holiday rule expressions such as “first full moon after the equinox”.
