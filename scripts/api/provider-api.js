import {
  validateAstronomyEvent,
  validateCalendarDefinition,
  validateHistoricalEvent,
  validateHolidayDefinition,
  validateMoonProfile,
  validateRegionDefinition,
  validateSeasonProfile
} from "../validation/definition-validator.js";
import { API_VERSION, SCHEMA_VERSION } from "../constants.js";

const CONTENT_KEYS = Object.freeze({
  calendars: "calendars",
  seasonProfiles: "seasons",
  moonProfiles: "moons",
  regionProfiles: "regions",
  astronomyEvents: "astronomy",
  holidays: "holidays",
  historicalEvents: "historical"
});

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function compareVersions(left, right) {
  const a = String(left ?? "0").split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  const b = String(right ?? "0").split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta) return Math.sign(delta);
  }
  return 0;
}

function asRequirement(entry) {
  if (typeof entry === "string") return { id: entry };
  return entry && typeof entry === "object" ? entry : null;
}

function providerContent(provider) {
  return {
    calendars: provider.calendars ?? [],
    seasons: provider.seasonProfiles ?? [],
    moons: provider.moonProfiles ?? [],
    regions: provider.regionProfiles ?? provider.regions ?? [],
    astronomy: provider.astronomyEvents ?? [],
    holidays: provider.holidays ?? [],
    historical: provider.historicalEvents ?? [],
    events: provider.events ?? []
  };
}

function capabilities(content) {
  return Object.freeze(Object.fromEntries(Object.entries(content).map(([key, values]) => [key, Array.isArray(values) && values.length > 0])));
}

function counts(content) {
  return Object.freeze(Object.fromEntries(Object.entries(content).map(([key, values]) => [key, Array.isArray(values) ? values.length : 0])));
}

export class ProviderRegistrationError extends Error {
  constructor(message, diagnostics) {
    super(message);
    this.name = "ProviderRegistrationError";
    this.diagnostics = diagnostics;
  }
}

export class ProviderApi {
  constructor({ calendarRegistry, seasonRegistry, moonRegistry, regionRegistry, astronomyRegistry, holidayRegistry, historicalRegistry, eventService, settings = null }) {
    this.calendars = calendarRegistry;
    this.seasons = seasonRegistry;
    this.moons = moonRegistry;
    this.regions = regionRegistry;
    this.astronomy = astronomyRegistry;
    this.holidays = holidayRegistry;
    this.historical = historicalRegistry;
    this.events = eventService;
    this.settings = settings;
    this.providers = new Map();
  }

  #registryFor(key) {
    return {
      calendars: this.calendars,
      seasons: this.seasons,
      moons: this.moons,
      regions: this.regions,
      astronomy: this.astronomy,
      holidays: this.holidays,
      historical: this.historical
    }[key] ?? null;
  }

  #definitionById(content, key, id) {
    return content[key]?.find((entry) => entry.id === id) ?? this.#registryFor(key)?.get(id) ?? null;
  }

  #checkCompatibility(provider, errors) {
    const compatibility = provider.compatibility ?? {};
    const api = compatibility.api ?? {};
    const schema = compatibility.schema ?? {};
    if (api.min != null && API_VERSION < Number(api.min)) errors.push(`Provider requires Calendar Forge API >= ${api.min}; current API is ${API_VERSION}`);
    if (api.max != null && API_VERSION > Number(api.max)) errors.push(`Provider supports Calendar Forge API <= ${api.max}; current API is ${API_VERSION}`);
    if (schema.min != null && SCHEMA_VERSION < Number(schema.min)) errors.push(`Provider requires Calendar Forge schema >= ${schema.min}; current schema is ${SCHEMA_VERSION}`);
    if (schema.max != null && SCHEMA_VERSION > Number(schema.max)) errors.push(`Provider supports Calendar Forge schema <= ${schema.max}; current schema is ${SCHEMA_VERSION}`);
  }

  #checkDependencies(provider, errors) {
    for (const raw of provider.requires ?? []) {
      const requirement = asRequirement(raw);
      if (!requirement?.id) {
        errors.push("Provider contains an invalid dependency declaration");
        continue;
      }
      const installed = this.providers.get(requirement.id);
      if (!installed) {
        if (!requirement.optional) errors.push(`Provider requires '${requirement.id}', which is not registered`);
        continue;
      }
      if (requirement.minContentVersion && compareVersions(installed.contentVersion, requirement.minContentVersion) < 0) {
        errors.push(`Provider requires '${requirement.id}' content version >= ${requirement.minContentVersion}; registered version is ${installed.contentVersion}`);
      }
      if (requirement.maxContentVersion && compareVersions(installed.contentVersion, requirement.maxContentVersion) > 0) {
        errors.push(`Provider requires '${requirement.id}' content version <= ${requirement.maxContentVersion}; registered version is ${installed.contentVersion}`);
      }
    }
  }

  #checkI18n(provider, content, warnings) {
    if (!provider.checkI18n || typeof game === "undefined" || typeof game.i18n?.has !== "function") return;
    const seen = new Set();
    const walk = (value) => {
      if (!value || typeof value !== "object") return;
      if (typeof value.i18n === "string" && !seen.has(value.i18n)) {
        seen.add(value.i18n);
        if (!game.i18n.has(value.i18n)) warnings.push(`Missing localization key '${value.i18n}'`);
      }
      for (const child of Object.values(value)) walk(child);
    };
    walk(content);
  }

  diagnose(provider, { checkCollisions = true, checkDependencies = true } = {}) {
    const errors = [];
    const warnings = [];
    if (!provider?.id || typeof provider.id !== "string") errors.push("Calendar Forge provider requires a string id");
    if (provider?.id === "calendar-forge-world") errors.push("Provider id 'calendar-forge-world' is reserved");
    if (provider?.schemaVersion != null && !Number.isInteger(Number(provider.schemaVersion))) errors.push("Provider schemaVersion must be an integer");
    if (provider?.contentVersion != null && typeof provider.contentVersion !== "string") errors.push("Provider contentVersion must be a string");
    if (provider?.id && this.providers.has(provider.id)) errors.push(`Provider '${provider.id}' is already registered`);

    const content = providerContent(provider ?? {});
    this.#checkCompatibility(provider ?? {}, errors);
    if (checkDependencies) this.#checkDependencies(provider ?? {}, errors);

    const calendarById = (id) => this.#definitionById(content, "calendars", id);
    const seasonById = (id) => this.#definitionById(content, "seasons", id);
    const moonById = (id) => this.#definitionById(content, "moons", id);
    const regionById = (id) => this.#definitionById(content, "regions", id);

    const validateMany = (values, validator, label) => {
      for (const definition of values) {
        try { validator(definition); } catch (error) { errors.push(`${label} '${definition?.id ?? "?"}': ${error.message}`); }
      }
    };

    validateMany(content.calendars, (definition) => validateCalendarDefinition(definition), "Calendar");
    validateMany(content.seasons, (definition) => validateSeasonProfile(definition, calendarById(definition.calendarId)), "Season profile");
    validateMany(content.moons, (definition) => validateMoonProfile(definition), "Moon profile");
    validateMany(content.regions, (definition) => validateRegionDefinition(definition), "Region");
    validateMany(content.astronomy, (definition) => validateAstronomyEvent(definition, definition.calendarId ? calendarById(definition.calendarId) : null), "Astronomical event");
    validateMany(content.holidays, (definition) => validateHolidayDefinition(definition, calendarById(definition.calendarId)), "Holiday");
    validateMany(content.historical, (definition) => validateHistoricalEvent(definition, calendarById(definition.calendarId)), "Historical event");

    for (const definition of content.seasons) if (!calendarById(definition.calendarId)) errors.push(`Season profile '${definition.id}' references unknown calendar '${definition.calendarId}'`);
    for (const definition of content.moons) if (!calendarById(definition.calendarId)) errors.push(`Moon profile '${definition.id}' references unknown calendar '${definition.calendarId}'`);
    for (const definition of content.astronomy) {
      if (!calendarById(definition.calendarId)) errors.push(`Astronomical event '${definition.id}' references unknown calendar '${definition.calendarId}'`);
      if (definition.regionId && !regionById(definition.regionId)) errors.push(`Astronomical event '${definition.id}' references unknown region '${definition.regionId}'`);
    }
    for (const definition of [...content.holidays, ...content.historical]) {
      const kind = content.holidays.includes(definition) ? "Holiday" : "Historical event";
      if (!calendarById(definition.calendarId)) errors.push(`${kind} '${definition.id}' references unknown calendar '${definition.calendarId}'`);
      if (definition.regionId && !regionById(definition.regionId)) errors.push(`${kind} '${definition.id}' references unknown region '${definition.regionId}'`);
      for (const regionId of definition.regionIds ?? []) if (!regionById(regionId)) errors.push(`${kind} '${definition.id}' references unknown region '${regionId}'`);
    }
    for (const definition of content.regions) {
      const calendar = definition.calendarId ? calendarById(definition.calendarId) : null;
      if (definition.calendarId && !calendar) errors.push(`Region '${definition.id}' references unknown calendar '${definition.calendarId}'`);
      if (definition.seasonProfileId) {
        const season = seasonById(definition.seasonProfileId);
        if (!season) errors.push(`Region '${definition.id}' references unknown season profile '${definition.seasonProfileId}'`);
        else if (calendar && season.calendarId !== calendar.id) errors.push(`Region '${definition.id}' uses a season profile for another calendar`);
      }
      for (const moonId of definition.moonProfileIds ?? []) {
        const moon = moonById(moonId);
        if (!moon) errors.push(`Region '${definition.id}' references unknown moon profile '${moonId}'`);
        else if (calendar && moon.calendarId !== calendar.id) errors.push(`Region '${definition.id}' uses a moon profile for another calendar`);
      }
    }

    if (checkCollisions) {
      for (const [key, values] of Object.entries(content)) {
        if (key === "events") continue;
        const registry = this.#registryFor(key);
        const localIds = new Set();
        for (const definition of values) {
          if (!definition?.id) continue;
          if (localIds.has(definition.id)) errors.push(`Provider contains duplicate ${key} id '${definition.id}'`);
          localIds.add(definition.id);
          if (registry?.has(definition.id)) errors.push(`${registry.kind ?? key} '${definition.id}' is already registered`);
        }
      }
      const eventIds = new Set();
      for (const event of content.events) {
        if (!event?.id) errors.push("Provider static event requires an id");
        else if (eventIds.has(event.id)) errors.push(`Provider contains duplicate event id '${event.id}'`);
        else if (this.events?.has?.(event.id)) errors.push(`Event '${event.id}' is already registered`);
        eventIds.add(event?.id);
      }
    }

    const defaults = provider.defaults ?? {};
    if (defaults.calendarId && !calendarById(defaults.calendarId)) errors.push(`Provider default calendar '${defaults.calendarId}' is unknown`);
    if (defaults.regionId && !regionById(defaults.regionId)) errors.push(`Provider default region '${defaults.regionId}' is unknown`);
    if (defaults.seasonProfileId && !seasonById(defaults.seasonProfileId)) errors.push(`Provider default season profile '${defaults.seasonProfileId}' is unknown`);
    for (const id of defaults.moonProfileIds ?? []) if (!moonById(id)) errors.push(`Provider default moon profile '${id}' is unknown`);

    this.#checkI18n(provider ?? {}, content, warnings);

    return Object.freeze({
      ok: errors.length === 0,
      providerId: provider?.id ?? null,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      counts: counts(content),
      capabilities: capabilities(content)
    });
  }

  validate(provider, options = {}) {
    const diagnostics = this.diagnose(provider, options);
    if (!diagnostics.ok) throw new ProviderRegistrationError(`Provider '${provider?.id ?? "unknown"}' failed validation: ${diagnostics.errors.join("; ")}`, diagnostics);
    return diagnostics;
  }

  #decorateDefinition(definition, provider) {
    return {
      ...clone(definition),
      providerId: definition.providerId ?? provider.id,
      providerContentVersion: provider.contentVersion ?? "0.0.0"
    };
  }

  #descriptor(provider, content, diagnostics) {
    return Object.freeze({
      id: provider.id,
      moduleId: provider.moduleId ?? provider.id,
      namespace: provider.namespace ?? provider.id,
      label: clone(provider.label ?? { value: provider.id }),
      description: clone(provider.description ?? null),
      schemaVersion: Number(provider.schemaVersion ?? SCHEMA_VERSION),
      contentVersion: provider.contentVersion ?? "0.0.0",
      compatibility: clone(provider.compatibility ?? {}),
      requires: clone(provider.requires ?? []),
      defaults: clone(provider.defaults ?? {}),
      counts: diagnostics.counts,
      capabilities: diagnostics.capabilities,
      warnings: diagnostics.warnings
    });
  }

  register(provider) {
    const diagnostics = this.validate(provider);
    const content = providerContent(provider);
    const registered = [];
    try {
      for (const [sourceKey, registryKey] of Object.entries(CONTENT_KEYS)) {
        const registry = this.#registryFor(registryKey);
        for (const definition of content[registryKey]) {
          const decorated = this.#decorateDefinition(definition, provider);
          registry.register(decorated);
          registered.push({ type: registryKey, id: definition.id });
        }
      }
      for (const event of content.events) {
        this.events.register(this.#decorateDefinition(event, provider));
        registered.push({ type: "events", id: event.id });
      }
      const descriptor = this.#descriptor(provider, content, diagnostics);
      this.providers.set(provider.id, descriptor);
      Hooks.callAll("calendarForgeProviderRegistered", descriptor);
      Hooks.callAll("calendarForgeDefinitionsChanged");
      return descriptor;
    } catch (error) {
      for (const item of registered.reverse()) {
        if (item.type === "events") this.events.unregister?.(item.id);
        else this.#registryFor(item.type)?.unregister(item.id);
      }
      this.providers.delete(provider.id);
      throw error;
    }
  }

  unregister(id, { force = false } = {}) {
    const descriptor = this.providers.get(id);
    if (!descriptor) return false;
    if (!force) {
      const dependent = [...this.providers.values()].find((candidate) => (candidate.requires ?? []).some((raw) => asRequirement(raw)?.id === id && !asRequirement(raw)?.optional));
      if (dependent) throw new Error(`Provider '${id}' is required by '${dependent.id}'`);
    }
    for (const key of Object.values(CONTENT_KEYS)) {
      const registry = this.#registryFor(key);
      for (const definition of registry?.list?.() ?? []) if (definition.providerId === id) registry.unregister(definition.id);
    }
    this.events?.unregisterByProvider?.(id);
    this.providers.delete(id);
    Hooks.callAll("calendarForgeProviderUnregistered", descriptor);
    Hooks.callAll("calendarForgeDefinitionsChanged");
    return true;
  }

  get(id) {
    return this.providers.get(id) ?? null;
  }

  list() {
    return [...this.providers.values()];
  }

  listContent(id) {
    if (!this.providers.has(id)) return null;
    const result = {};
    for (const key of Object.values(CONTENT_KEYS)) result[key] = this.#registryFor(key)?.list().filter((definition) => definition.providerId === id) ?? [];
    result.events = this.events?.listRegistered?.().filter((event) => event.providerId === id) ?? [];
    return result;
  }

  owns(providerId, type, definitionId) {
    if (type === "events") return this.events?.get?.(definitionId)?.providerId === providerId;
    return this.#registryFor(type)?.get(definitionId)?.providerId === providerId;
  }

  async applyDefaults(id) {
    if (!this.settings) throw new Error("Provider defaults are not available in this Calendar Forge context");
    if (typeof game !== "undefined" && !game.user?.isGM) throw new Error("Only a GM may apply provider defaults");
    const descriptor = this.get(id);
    if (!descriptor) throw new Error(`Unknown provider '${id}'`);
    const defaults = descriptor.defaults ?? {};
    if (defaults.calendarId) await this.settings.setActiveCalendarId(defaults.calendarId);
    if (Object.prototype.hasOwnProperty.call(defaults, "regionId")) await this.settings.setDefaultRegionId(defaults.regionId ?? null);
    if (Object.prototype.hasOwnProperty.call(defaults, "seasonProfileId")) await this.settings.setActiveSeasonProfileId(defaults.seasonProfileId ?? "");
    if (Array.isArray(defaults.moonProfileIds)) await this.settings.setActiveMoonProfileIds(defaults.moonProfileIds);
    Hooks.callAll("calendarForgeProviderDefaultsApplied", descriptor);
    Hooks.callAll("calendarForgeDefinitionsChanged");
    return descriptor;
  }
}
