import { MODULE_ID } from "../constants.js";
import { resolveLabel } from "../localization/label-resolver.js";
import { slugifyId } from "../validation/definition-validator.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function rootOf(app) {
  return app.element?.querySelector ? app.element : app.element?.[0] ?? null;
}

export class RegionManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "calendar-forge-region-manager",
    classes: ["calendar-forge-manager", "calendar-forge-region-manager"],
    position: { width: 980, height: 680 },
    window: { icon: "fa-solid fa-map-location-dot", resizable: true, minimizable: true },
    actions: {
      selectRegion: RegionManagerApp.#selectRegion,
      newRegion: RegionManagerApp.#newRegion,
      duplicateRegion: RegionManagerApp.#duplicateRegion,
      saveRegion: RegionManagerApp.#saveRegion,
      deleteRegion: RegionManagerApp.#deleteRegion,
      setDefaultRegion: RegionManagerApp.#setDefaultRegion,
      clearDefaultRegion: RegionManagerApp.#clearDefaultRegion
    }
  };

  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/region-manager.hbs` } };

  constructor(services, options = {}) {
    super(options);
    this.services = services;
    this.selectedId = null;
    this.draft = null;
    this.isNew = false;
  }

  get title() {
    return game.i18n.localize("CALENDAR_FORGE.RegionManager.Title");
  }

  #uniqueId(base) {
    const seed = slugifyId(base, "region");
    let id = seed;
    let counter = 2;
    while (this.services.registries.regions.has(id)) id = `${seed}-${counter++}`;
    return id;
  }

  #editableCopy(source = null) {
    const base = source ? structuredClone(source) : {
      id: "region",
      label: { value: game.i18n.localize("CALENDAR_FORGE.RegionManager.NewRegion") },
      calendarId: this.services.settings.activeCalendarId(),
      timeOffsetSeconds: 0,
      seasonProfileId: this.services.settings.activeSeasonProfileId(),
      moonProfileIds: this.services.settings.activeMoonProfileIds()
    };
    base.id = this.#uniqueId(`${base.id}-custom`);
    base.providerId = "calendar-forge-world";
    base.label = { value: resolveLabel(base.label, base.id) };
    return base;
  }

  #ensureSelection() {
    if (this.draft) return;
    const defaultId = this.services.settings.defaultRegionId();
    const selected = this.services.registries.regions.get(defaultId) ?? this.services.registries.regions.list()[0] ?? null;
    if (!selected) return;
    this.selectedId = selected.id;
    this.draft = structuredClone(selected);
  }

  #capture() {
    const root = rootOf(this);
    if (!root || !this.draft) return;
    const editable = this.isNew || this.services.worldData.isWorldRegion(this.selectedId);
    if (!editable) return;
    const value = (name, fallback = "") => root.querySelector(`[name="${name}"]`)?.value ?? fallback;
    this.draft.id = this.isNew ? slugifyId(value("region.id"), this.draft.id) : this.draft.id;
    this.draft.label = { value: value("region.label") };
    this.draft.calendarId = value("region.calendarId") || null;
    this.draft.timeOffsetSeconds = Math.round(Number(value("region.offsetHours", 0)) * 3600);
    this.draft.seasonProfileId = value("region.seasonProfileId") || null;
    this.draft.moonProfileIds = [...root.querySelectorAll('[name="region.moons"]:checked')].map((input) => input.value);
  }

  async _prepareContext(options) {
    this.#ensureSelection();
    const context = await super._prepareContext(options);
    const defaultId = this.services.settings.defaultRegionId();
    const regions = this.services.registries.regions.list().map((region) => ({
      id: region.id,
      label: resolveLabel(region.label, region.id),
      providerId: region.providerId ?? "unknown",
      selected: region.id === this.selectedId,
      isDefault: region.id === defaultId,
      isWorld: this.services.worldData.isWorldRegion(region.id)
    })).sort((a, b) => a.label.localeCompare(b.label));

    const calendars = this.services.registries.calendars.list().map((calendar) => ({
      id: calendar.id,
      label: resolveLabel(calendar.label, calendar.id),
      selected: calendar.id === this.draft?.calendarId
    })).sort((a, b) => a.label.localeCompare(b.label));
    const seasons = this.services.registries.seasons.list().map((profile) => ({
      id: profile.id,
      label: resolveLabel(profile.label, profile.id),
      selected: profile.id === this.draft?.seasonProfileId
    })).sort((a, b) => a.label.localeCompare(b.label));
    const selectedMoons = new Set(this.draft?.moonProfileIds ?? []);
    const moons = this.services.registries.moons.list().map((profile) => ({
      id: profile.id,
      label: resolveLabel(profile.label, profile.id),
      selected: selectedMoons.has(profile.id)
    })).sort((a, b) => a.label.localeCompare(b.label));

    const editable = !!this.draft && (this.isNew || this.services.worldData.isWorldRegion(this.selectedId));
    const display = this.draft ? { ...this.draft, label: { value: resolveLabel(this.draft.label, this.draft.id) } } : null;
    return foundry.utils.mergeObject(context, {
      regions,
      hasSelection: !!this.draft,
      definition: display,
      editable,
      isNew: this.isNew,
      isProvider: !!this.draft && !editable,
      isDefault: this.selectedId === defaultId,
      providerId: this.draft?.providerId ?? "calendar-forge-world",
      offsetHours: Number(this.draft?.timeOffsetSeconds ?? 0) / 3600,
      calendars,
      seasons,
      moons,
      hasDefault: !!defaultId
    }, { inplace: false });
  }

  static async #selectRegion(_event, target) {
    this.#capture();
    const region = this.services.registries.regions.get(target.dataset.regionId);
    if (!region) return;
    this.selectedId = region.id;
    this.draft = structuredClone(region);
    this.isNew = false;
    this.render({ force: true });
  }

  static async #newRegion() {
    this.#capture();
    this.draft = this.#editableCopy(null);
    this.selectedId = this.draft.id;
    this.isNew = true;
    this.render({ force: true });
  }

  static async #duplicateRegion() {
    this.#capture();
    this.draft = this.#editableCopy(this.draft);
    this.selectedId = this.draft.id;
    this.isNew = true;
    this.render({ force: true });
  }

  static async #saveRegion() {
    this.#capture();
    try {
      if (!this.isNew && !this.services.worldData.isWorldRegion(this.selectedId)) return;
      const saved = await this.services.worldData.saveRegion(this.draft);
      this.selectedId = saved.id;
      this.draft = structuredClone(saved);
      this.isNew = false;
      ui.notifications.info(game.i18n.localize("CALENDAR_FORGE.Messages.Saved"));
      this.render({ force: true });
    } catch (error) {
      console.error("Calendar Forge | Region save failed", error);
      ui.notifications.error(`${game.i18n.localize("CALENDAR_FORGE.Messages.InvalidDefinition")} ${error.message}`);
    }
  }

  static async #deleteRegion() {
    if (!this.services.worldData.isWorldRegion(this.selectedId)) return;
    if (!globalThis.confirm(game.i18n.localize("CALENDAR_FORGE.Messages.ConfirmDeleteRegion"))) return;
    const deletedId = this.selectedId;
    await this.services.worldData.deleteRegion(deletedId);
    if (this.services.settings.defaultRegionId() === deletedId) await this.services.settings.setDefaultRegionId(null);
    this.selectedId = null;
    this.draft = null;
    this.isNew = false;
    this.render({ force: true });
  }

  static async #setDefaultRegion() {
    this.#capture();
    if (this.isNew) {
      try {
        const saved = await this.services.worldData.saveRegion(this.draft);
        this.selectedId = saved.id;
        this.draft = structuredClone(saved);
        this.isNew = false;
      } catch (error) {
        ui.notifications.error(`${game.i18n.localize("CALENDAR_FORGE.Messages.InvalidDefinition")} ${error.message}`);
        return;
      }
    }
    await this.services.settings.setDefaultRegionId(this.selectedId);
    Hooks.callAll("calendarForgeDefinitionsChanged");
    this.render({ force: true });
  }

  static async #clearDefaultRegion() {
    await this.services.settings.setDefaultRegionId(null);
    Hooks.callAll("calendarForgeDefinitionsChanged");
    this.render({ force: true });
  }
}
