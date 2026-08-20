# Calendar Forge Provider Contract (API 5 / Schema 4)

External Foundry modules should register setting content after Calendar Forge announces readiness:

```js
Hooks.once("calendarForgeReady", (api) => {
  api.providers.register({
    id: "my-calendar-pack",
    moduleId: "my-calendar-pack",
    namespace: "MY_CALENDAR_PACK",
    schemaVersion: 4,
    contentVersion: "1.0.0",
    compatibility: {
      api: { min: 5, max: 5 },
      schema: { min: 4, max: 4 }
    },
    calendars: [],
    seasonProfiles: [],
    moonProfiles: [],
    regionProfiles: [],
    astronomyEvents: [],
    holidays: [],
    historicalEvents: [],
    defaults: {}
  });
});
```

## Registration is transactional

Calendar Forge validates definition shape, cross references, dependencies, compatibility ranges, ID collisions, and provider defaults before mutating registries. If an unexpected failure occurs later during registration, all content already inserted by that registration attempt is rolled back.

## Dependencies

A content module may split its setting data into multiple provider packages:

```js
requires: [
  { id: "golarion-core", minContentVersion: "1.0.0" },
  { id: "golarion-regional-holidays", optional: true }
]
```

Required providers must already be registered. Calendar Forge also protects a required provider from normal runtime unregistration while dependants remain registered.

## Suggested defaults

A provider may recommend a coherent initial context without silently taking control of a world:

```js
defaults: {
  calendarId: "setting-calendar",
  regionId: "setting-default-region",
  seasonProfileId: "setting-seasons",
  moonProfileIds: ["setting-moon"]
}
```

These values are never applied automatically. A GM may apply them from the Content Providers window or with `api.providers.applyDefaults(providerId)`.

### Optional system-clock alignment

A setting/system provider may additionally supply a runtime `anchorResolver`. The resolver is intentionally code, not persisted provider data, because it may read a game-system clock such as PF2e's World Clock:

```js
api.providers.register({
  // ...provider data...
  clockAlignment: { calendarId: "setting-calendar", source: "my-system-clock" },
  anchorResolver: async ({ calendar, worldTime }) => ({
    worldTime: 0,
    year: 1234,
    monthId: calendar.months[0].id,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    weekdayIndex: 0
  }),
  defaults: { calendarId: "setting-calendar", alignClock: true }
});
```

`api.providers.alignClock(providerId)` stores the resolved anchor in world data. `applyDefaults()` attempts the alignment only when no world-specific anchor already exists. The Provider Manager's explicit synchronization action may replace an existing anchor. Canonical Foundry `worldTime` is never reset or rewritten.

Moon definitions that must remain tied to a setting date can use `referenceDate` instead of `referenceWorldTime`:

```js
{
  cycleLengthDays: 29.5,
  referenceDate: { year: 4712, monthId: "abadius", day: 1 },
  referenceProgress: 0.25
}
```

Calendar Forge resolves that date through the active calendar anchor before calculating moon phase and transitions.

## Localization

All user-visible provider labels should be normal Foundry localization references:

```js
label: { i18n: "MY_PACK.Months.First.Name" }
```

Providers can opt into a best-effort localization diagnostic by setting `checkI18n: true`. Missing keys are warnings, not registration failures.

### Optional alternate month and weekday names

Calendar Forge 0.6.0 allows every month and weekday definition to provide a second localized name pair:

```js
{
  id: "setting-month",
  label: { i18n: "MY_PACK.Month.Setting" },
  shortLabel: { i18n: "MY_PACK.Month.SettingShort" },
  alternateLabel: { i18n: "CALENDAR_FORGE.Months.September" },
  alternateShortLabel: { i18n: "CALENDAR_FORGE.Months.SeptemberShort" },
  days: 30
}
```

`alternateLabel` and `alternateShortLabel` are generic aliases. They can represent an Earth-calendar equivalent, a second cultural name, or any other useful correspondence. They are optional and do not affect calendar arithmetic. Each user controls whether they are shown in Calendar Forge; integrations can always inspect both forms through `getTemporalContext().calendar.names`.

## Diagnostics and inspection

```js
api.providers.diagnose(provider);   // non-mutating report
api.providers.validate(provider);   // throws ProviderRegistrationError if invalid
api.providers.get("my-calendar-pack");
api.providers.list();
api.providers.listContent("my-calendar-pack");
api.providers.owns("my-calendar-pack", "calendars", "setting-calendar");
```

Registered provider descriptors expose content version, compatibility, dependencies, suggested defaults, capability flags, definition counts, and localization warnings.

## Provenance

Provider-owned definitions receive `providerId` and `providerContentVersion`. When users duplicate provider content into editable world data, Calendar Forge keeps source provenance (`source.providerId`, `source.definitionId`, `source.contentVersion`) while changing ownership to `calendar-forge-world`.

## Unregistration

`api.providers.unregister(id)` removes only content still owned by that provider, including static events. It refuses to remove a provider required by another registered provider unless `{ force: true }` is explicitly used.

## Golarion package boundary

Calendar Forge core remains system- and setting-agnostic. A Golarion content module should therefore be a separate Foundry module and use this provider contract for the Absalom Reckoning calendar, localized month/weekday names, regional profiles, seasons, moon data, holidays, astronomy and historical material.
