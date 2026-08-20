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

## Localization

All user-visible provider labels should be normal Foundry localization references:

```js
label: { i18n: "MY_PACK.Months.First.Name" }
```

Providers can opt into a best-effort localization diagnostic by setting `checkI18n: true`. Missing keys are warnings, not registration failures.

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
