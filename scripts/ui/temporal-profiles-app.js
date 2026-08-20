import { MODULE_ID } from "../constants.js";
import { resolveLabel } from "../localization/label-resolver.js";
import { slugifyId } from "../validation/definition-validator.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function rootOf(app) {
  return app.element?.querySelector ? app.element : app.element?.[0] ?? null;
}

function labelValue(label, fallback = "") {
  return resolveLabel(label, fallback);
}

function modeRegistry(services, mode) {
  if (mode === "seasons") return services.registries.seasons;
  if (mode === "moons") return services.registries.moons;
  return services.registries.astronomy;
}

export class TemporalProfilesApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "calendar-forge-temporal-profiles",
    classes: ["calendar-forge-manager", "calendar-forge-temporal-profiles"],
    position: { width: 1180, height: 800 },
    window: { icon: "fa-solid fa-moon", resizable: true, minimizable: true },
    actions: {
      setMode: TemporalProfilesApp.#setMode,
      selectDefinition: TemporalProfilesApp.#selectDefinition,
      newDefinition: TemporalProfilesApp.#newDefinition,
      duplicateDefinition: TemporalProfilesApp.#duplicateDefinition,
      saveDefinition: TemporalProfilesApp.#saveDefinition,
      deleteDefinition: TemporalProfilesApp.#deleteDefinition,
      setDefaultSeason: TemporalProfilesApp.#setDefaultSeason,
      toggleDefaultMoon: TemporalProfilesApp.#toggleDefaultMoon,
      addSeason: TemporalProfilesApp.#addSeason,
      removeSeason: TemporalProfilesApp.#removeSeason,
      addPhase: TemporalProfilesApp.#addPhase,
      removePhase: TemporalProfilesApp.#removePhase
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/temporal-profiles.hbs` }
  };

  constructor(services, options = {}) {
    super(options);
    this.services = services;
    this.mode = options.mode ?? "seasons";
    this.selectedId = null;
    this.draft = null;
    this.isNew = false;
  }

  get title() {
    return game.i18n.localize("CALENDAR_FORGE.TemporalProfiles.Title");
  }

  #registry() {
    return modeRegistry(this.services, this.mode);
  }

  #isWorld(id) {
    if (this.mode === "seasons") return this.services.worldData.isWorldSeasonProfile(id);
    if (this.mode === "moons") return this.services.worldData.isWorldMoonProfile(id);
    return this.services.worldData.isWorldAstronomyEvent(id);
  }

  #uniqueId(base) {
    const seed = slugifyId(base, this.mode === "astronomy" ? "astronomical-event" : this.mode === "moons" ? "moon-profile" : "season-profile");
    let id = seed;
    let counter = 2;
    while (this.#registry().has(id)) id = `${seed}-${counter++}`;
    return id;
  }

  #activeCalendar() {
    return this.services.registries.calendars.get(this.services.settings.activeCalendarId())
      ?? this.services.registries.calendars.list()[0]
      ?? null;
  }

  #newDraft() {
    const calendar = this.#activeCalendar();
    const firstMonth = calendar?.months?.[0]?.id ?? "month";
    if (this.mode === "seasons") {
      return {
        id: this.#uniqueId("custom-seasons"),
        providerId: "calendar-forge-world",
        calendarId: calendar?.id ?? "",
        label: { value: game.i18n.localize("CALENDAR_FORGE.TemporalProfiles.NewSeasonProfile") },
        seasons: [
          { id: "season-1", label: { value: game.i18n.localize("CALENDAR_FORGE.TemporalProfiles.NewSeason") }, monthId: firstMonth, day: 1, icon: "fa-leaf" }
        ]
      };
    }
    if (this.mode === "moons") {
      return {
        id: this.#uniqueId("custom-moon"),
        providerId: "calendar-forge-world",
        calendarId: calendar?.id ?? "",
        label: { value: game.i18n.localize("CALENDAR_FORGE.TemporalProfiles.NewMoonProfile") },
        cycleLengthDays: 30,
        referenceWorldTime: Number(game.time.worldTime),
        referenceProgress: 0,
        phases: [
          { id: "new", start: 0, label: { value: game.i18n.localize("CALENDAR_FORGE.MoonPhases.New") }, icon: "fa-circle", marker: true },
          { id: "first-quarter", start: 0.25, label: { value: game.i18n.localize("CALENDAR_FORGE.MoonPhases.FirstQuarter") }, icon: "fa-circle-half-stroke", marker: true },
          { id: "full", start: 0.5, label: { value: game.i18n.localize("CALENDAR_FORGE.MoonPhases.Full") }, icon: "fa-circle", marker: true },
          { id: "last-quarter", start: 0.75, label: { value: game.i18n.localize("CALENDAR_FORGE.MoonPhases.LastQuarter") }, icon: "fa-circle-half-stroke", marker: true }
        ]
      };
    }
    return {
      id: this.#uniqueId("astronomical-event"),
      providerId: "calendar-forge-world",
      calendarId: calendar?.id ?? "",
      label: { value: game.i18n.localize("CALENDAR_FORGE.TemporalProfiles.NewAstronomyEvent") },
      type: "custom",
      icon: "fa-star-and-crescent",
      visibility: "public",
      regionId: "",
      mode: "date",
      date: { year: null, monthId: firstMonth, day: 1, hour: 0, minute: 0, second: 0 },
      durationSeconds: 0
    };
  }

  #editableCopy(source) {
    const copy = structuredClone(source);
    copy.id = this.#uniqueId(`${source.id}-custom`);
    copy.source = source.providerId && source.providerId !== "calendar-forge-world" ? { providerId: source.providerId, definitionId: source.id, contentVersion: source.providerContentVersion ?? null } : (source.source ? structuredClone(source.source) : undefined);
    copy.providerId = "calendar-forge-world";
    copy.label = { value: labelValue(source.label, source.id) };
    if (this.mode === "seasons") {
      copy.seasons = (source.seasons ?? []).map((season) => ({
        ...season,
        label: { value: labelValue(season.label, season.id) }
      }));
    } else if (this.mode === "moons") {
      copy.phases = (source.phases ?? []).map((phase) => ({
        ...phase,
        label: { value: labelValue(phase.label, phase.id) }
      }));
    }
    return copy;
  }

  #ensureSelection() {
    if (this.draft) return;
    const registry = this.#registry();
    let selected = null;
    if (this.mode === "seasons") selected = registry.get(this.services.settings.activeSeasonProfileId());
    if (this.mode === "moons") selected = this.services.settings.activeMoonProfileIds().map((id) => registry.get(id)).find(Boolean);
    selected ??= registry.list()[0] ?? null;
    if (!selected) return;
    this.selectedId = selected.id;
    this.draft = structuredClone(selected);
    this.isNew = false;
  }

  #capture() {
    const root = rootOf(this);
    if (!root || !this.draft) return;
    const value = (name, fallback = "") => root.querySelector(`[name="${name}"]`)?.value ?? fallback;
    const number = (name, fallback = 0) => Number(value(name, fallback));
    const editable = this.isNew || this.#isWorld(this.selectedId);
    if (!editable) return;

    this.draft.id = this.isNew ? slugifyId(value("definition.id"), this.draft.id) : this.draft.id;
    this.draft.label = { value: value("definition.label") };
    this.draft.calendarId = value("definition.calendarId", this.draft.calendarId);

    if (this.mode === "seasons") {
      this.draft.seasons = [...root.querySelectorAll("[data-season-row]")].map((row) => ({
        id: slugifyId(row.querySelector('[data-field="id"]')?.value, "season"),
        label: { value: row.querySelector('[data-field="label"]')?.value ?? "" },
        monthId: row.querySelector('[data-field="monthId"]')?.value ?? "",
        day: Number(row.querySelector('[data-field="day"]')?.value ?? 1),
        icon: row.querySelector('[data-field="icon"]')?.value || "fa-leaf"
      }));
      return;
    }

    if (this.mode === "moons") {
      this.draft.cycleLengthDays = number("moon.cycleLengthDays", 30);
      this.draft.referenceWorldTime = number("moon.referenceWorldTime", 0);
      this.draft.referenceProgress = number("moon.referenceProgress", 0);
      this.draft.phases = [...root.querySelectorAll("[data-phase-row]")].map((row) => ({
        id: slugifyId(row.querySelector('[data-field="id"]')?.value, "phase"),
        label: { value: row.querySelector('[data-field="label"]')?.value ?? "" },
        start: Number(row.querySelector('[data-field="start"]')?.value ?? 0),
        icon: row.querySelector('[data-field="icon"]')?.value || "fa-moon",
        marker: !!row.querySelector('[data-field="marker"]')?.checked
      }));
      return;
    }

    this.draft.type = value("astronomy.type", "custom");
    this.draft.icon = value("astronomy.icon", "");
    this.draft.visibility = value("astronomy.visibility", "public");
    this.draft.regionId = value("astronomy.regionId", "");
    this.draft.mode = value("astronomy.mode", "date");
    this.draft.durationSeconds = number("astronomy.durationSeconds", 0);
    if (this.draft.mode === "date") {
      const yearValue = value("astronomy.year", "").trim();
      this.draft.date = {
        year: yearValue === "" ? null : Number(yearValue),
        monthId: value("astronomy.monthId"),
        day: number("astronomy.day", 1),
        hour: number("astronomy.hour", 0),
        minute: number("astronomy.minute", 0),
        second: number("astronomy.second", 0)
      };
      delete this.draft.cycleLengthDays;
      delete this.draft.referenceWorldTime;
    } else {
      this.draft.cycleLengthDays = number("astronomy.cycleLengthDays", 1);
      this.draft.referenceWorldTime = number("astronomy.referenceWorldTime", 0);
      delete this.draft.date;
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = rootOf(this);
    for (const selector of [".cf-profile-calendar-select", ".cf-astronomy-mode-select"]) {
      const select = root?.querySelector(selector);
      if (select) select.addEventListener("change", () => {
        this.#capture();
        this.render({ force: true });
      }, { once: true });
    }
  }

  async _prepareContext(options) {
    this.#ensureSelection();
    const context = await super._prepareContext(options);
    const registry = this.#registry();
    const items = registry.list().map((definition) => ({
      id: definition.id,
      label: labelValue(definition.label, definition.id),
      providerId: definition.providerId ?? "unknown",
      selected: definition.id === this.selectedId,
      isWorld: this.#isWorld(definition.id),
      isDefault: this.mode === "seasons"
        ? definition.id === this.services.settings.activeSeasonProfileId()
        : this.mode === "moons"
          ? this.services.settings.activeMoonProfileIds().includes(definition.id)
          : false
    })).sort((a, b) => a.label.localeCompare(b.label));

    const modes = ["seasons", "moons", "astronomy"].map((id) => ({
      id,
      selected: id === this.mode,
      label: game.i18n.localize(`CALENDAR_FORGE.TemporalProfiles.Modes.${id}`),
      icon: id === "seasons" ? "fa-leaf" : id === "moons" ? "fa-moon" : "fa-star-and-crescent"
    }));

    if (!this.draft) return { ...context, modes, mode: this.mode, items, hasSelection: false };
    const editable = this.isNew || this.#isWorld(this.selectedId);
    const display = structuredClone(this.draft);
    display.label = { value: labelValue(display.label, display.id) };
    if (this.mode === "seasons") display.seasons = (display.seasons ?? []).map((season) => ({ ...season, label: { value: labelValue(season.label, season.id) } }));
    if (this.mode === "moons") display.phases = (display.phases ?? []).map((phase) => ({ ...phase, label: { value: labelValue(phase.label, phase.id) } }));

    const calendars = this.services.registries.calendars.list().map((calendar) => ({
      id: calendar.id,
      label: labelValue(calendar.label, calendar.id),
      selected: calendar.id === display.calendarId
    })).sort((a, b) => a.label.localeCompare(b.label));
    const selectedCalendar = this.services.registries.calendars.get(display.calendarId) ?? this.#activeCalendar();
    const months = (selectedCalendar?.months ?? []).map((month) => ({ id: month.id, label: labelValue(month.label, month.id) }));

    const seasonRows = this.mode === "seasons" ? (display.seasons ?? []).map((season, index) => ({
      ...season,
      index,
      monthOptions: months.map((month) => ({ ...month, selected: month.id === season.monthId }))
    })) : [];
    const phaseRows = this.mode === "moons" ? (display.phases ?? []).map((phase, index) => ({ ...phase, index })) : [];

    const astronomyTypes = ["solar-eclipse", "lunar-eclipse", "meteor-shower", "equinox", "solstice", "conjunction", "comet", "custom"].map((id) => ({
      id,
      selected: display.type === id,
      label: game.i18n.localize(`CALENDAR_FORGE.AstronomyTypes.${id}`)
    }));
    const astronomyModes = ["date", "cycle"].map((id) => ({
      id,
      selected: (display.mode ?? "date") === id,
      label: game.i18n.localize(`CALENDAR_FORGE.TemporalProfiles.AstronomyModes.${id}`)
    }));
    const visibilities = ["public", "gm"].map((id) => ({ id, selected: (display.visibility ?? "public") === id, label: game.i18n.localize(`CALENDAR_FORGE.TemporalProfiles.Visibility.${id}`) }));
    const regions = [
      { id: "", label: game.i18n.localize("CALENDAR_FORGE.TemporalProfiles.AllRegions"), selected: !display.regionId },
      ...this.services.regionService.listDecorated().map((region) => ({ id: region.id, label: region.label, selected: display.regionId === region.id }))
    ];
    const eventMonthOptions = months.map((month) => ({ ...month, selected: month.id === display.date?.monthId }));

    return foundry.utils.mergeObject(context, {
      modes,
      mode: this.mode,
      isSeasons: this.mode === "seasons",
      isMoons: this.mode === "moons",
      isAstronomy: this.mode === "astronomy",
      items,
      hasSelection: true,
      definition: display,
      providerId: display.providerId ?? "calendar-forge-world",
      editable,
      isNew: this.isNew,
      isProvider: !editable,
      isDefaultSeason: this.mode === "seasons" && this.selectedId === this.services.settings.activeSeasonProfileId(),
      isDefaultMoon: this.mode === "moons" && this.services.settings.activeMoonProfileIds().includes(this.selectedId),
      calendars,
      months,
      seasonRows,
      phaseRows,
      astronomyTypes,
      astronomyModes,
      visibilities,
      regions,
      eventMonthOptions,
      isDateMode: (display.mode ?? "date") === "date",
      isCycleMode: (display.mode ?? "date") === "cycle"
    }, { inplace: false });
  }

  static async #setMode(_event, target) {
    this.#capture();
    this.mode = target.dataset.mode;
    this.selectedId = null;
    this.draft = null;
    this.isNew = false;
    this.render({ force: true });
  }

  static async #selectDefinition(_event, target) {
    this.#capture();
    const definition = this.#registry().get(target.dataset.definitionId);
    if (!definition) return;
    this.selectedId = definition.id;
    this.draft = structuredClone(definition);
    this.isNew = false;
    this.render({ force: true });
  }

  static async #newDefinition() {
    this.#capture();
    this.draft = this.#newDraft();
    this.selectedId = this.draft.id;
    this.isNew = true;
    this.render({ force: true });
  }

  static async #duplicateDefinition() {
    this.#capture();
    this.draft = this.#editableCopy(this.draft);
    this.selectedId = this.draft.id;
    this.isNew = true;
    this.render({ force: true });
  }

  async #saveCurrent({ notify = true } = {}) {
    this.#capture();
    let saved;
    if (this.mode === "seasons") saved = await this.services.worldData.saveSeasonProfile(this.draft);
    else if (this.mode === "moons") saved = await this.services.worldData.saveMoonProfile(this.draft);
    else saved = await this.services.worldData.saveAstronomyEvent(this.draft);
    this.selectedId = saved.id;
    this.draft = structuredClone(saved);
    this.isNew = false;
    if (notify) ui.notifications.info(game.i18n.localize("CALENDAR_FORGE.Messages.Saved"));
    return saved;
  }

  static async #saveDefinition() {
    try {
      await this.#saveCurrent();
      this.render({ force: true });
    } catch (error) {
      console.error("Calendar Forge | Temporal profile save failed", error);
      ui.notifications.error(`${game.i18n.localize("CALENDAR_FORGE.Messages.InvalidDefinition")} ${error.message}`);
    }
  }

  static async #deleteDefinition() {
    if (!this.#isWorld(this.selectedId)) return;
    if (!globalThis.confirm(game.i18n.localize("CALENDAR_FORGE.Messages.ConfirmDeleteTemporalDefinition"))) return;
    try {
      if (this.mode === "seasons") {
        await this.services.worldData.deleteSeasonProfile(this.selectedId);
        if (this.services.settings.activeSeasonProfileId() === this.selectedId) await this.services.settings.setActiveSeasonProfileId("");
      } else if (this.mode === "moons") {
        await this.services.worldData.deleteMoonProfile(this.selectedId);
        const remaining = this.services.settings.activeMoonProfileIds().filter((id) => id !== this.selectedId);
        await this.services.settings.setActiveMoonProfileIds(remaining);
      } else await this.services.worldData.deleteAstronomyEvent(this.selectedId);
      this.selectedId = null;
      this.draft = null;
      this.isNew = false;
      this.render({ force: true });
    } catch (error) {
      ui.notifications.error(`${game.i18n.localize("CALENDAR_FORGE.Messages.DeleteFailed")} ${error.message}`);
    }
  }

  static async #setDefaultSeason() {
    this.#capture();
    if (this.isNew) await this.#saveCurrent({ notify: false });
    await this.services.settings.setActiveSeasonProfileId(this.selectedId);
    Hooks.callAll("calendarForgeDefinitionsChanged");
    this.render({ force: true });
  }

  static async #toggleDefaultMoon() {
    this.#capture();
    if (this.isNew) await this.#saveCurrent({ notify: false });
    const active = new Set(this.services.settings.activeMoonProfileIds());
    if (active.has(this.selectedId)) active.delete(this.selectedId);
    else active.add(this.selectedId);
    await this.services.settings.setActiveMoonProfileIds([...active]);
    Hooks.callAll("calendarForgeDefinitionsChanged");
    this.render({ force: true });
  }

  static async #addSeason() {
    this.#capture();
    const calendar = this.services.registries.calendars.get(this.draft.calendarId) ?? this.#activeCalendar();
    this.draft.seasons ??= [];
    this.draft.seasons.push({
      id: `season-${this.draft.seasons.length + 1}`,
      label: { value: game.i18n.localize("CALENDAR_FORGE.TemporalProfiles.NewSeason") },
      monthId: calendar?.months?.[0]?.id ?? "month",
      day: 1,
      icon: "fa-leaf"
    });
    this.render({ force: true });
  }

  static async #removeSeason(_event, target) {
    this.#capture();
    this.draft.seasons.splice(Number(target.dataset.index), 1);
    this.render({ force: true });
  }

  static async #addPhase() {
    this.#capture();
    this.draft.phases ??= [];
    this.draft.phases.push({ id: `phase-${this.draft.phases.length + 1}`, label: { value: game.i18n.localize("CALENDAR_FORGE.TemporalProfiles.NewPhase") }, start: 0, icon: "fa-moon", marker: false });
    this.render({ force: true });
  }

  static async #removePhase(_event, target) {
    this.#capture();
    this.draft.phases.splice(Number(target.dataset.index), 1);
    this.render({ force: true });
  }
}
