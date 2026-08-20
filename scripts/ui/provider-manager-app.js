import { MODULE_ID } from "../constants.js";
import { resolveLabel } from "../localization/label-resolver.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ProviderManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "calendar-forge-provider-manager",
    classes: ["calendar-forge-manager", "calendar-forge-provider-manager"],
    position: { width: 980, height: 680 },
    window: { icon: "fa-solid fa-puzzle-piece", resizable: true, minimizable: true },
    actions: {
      applyDefaults: ProviderManagerApp.#applyDefaults,
      alignClock: ProviderManagerApp.#alignClock
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/provider-manager.hbs` }
  };

  constructor(services, options = {}) {
    super(options);
    this.services = services;
  }

  get title() {
    return game.i18n.localize("CALENDAR_FORGE.ProviderManager.Title");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const providers = this.services.providers.list().map((provider) => {
      const content = this.services.providers.listContent(provider.id) ?? {};
      const total = Object.values(provider.counts ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0);
      const capabilities = Object.entries(provider.capabilities ?? {})
        .filter(([, enabled]) => enabled)
        .map(([id]) => game.i18n.localize(`CALENDAR_FORGE.ProviderManager.Capability.${id}`));
      return {
        ...provider,
        labelText: resolveLabel(provider.label, provider.id),
        descriptionText: resolveLabel(provider.description, ""),
        total,
        capabilities,
        hasDefaults: Object.keys(provider.defaults ?? {}).length > 0,
        supportsClockAlignment: Boolean(provider.supportsClockAlignment),
        defaultsSummary: [
          provider.defaults?.calendarId ? game.i18n.format("CALENDAR_FORGE.ProviderManager.DefaultCalendar", { id: provider.defaults.calendarId }) : null,
          provider.defaults?.regionId ? game.i18n.format("CALENDAR_FORGE.ProviderManager.DefaultRegion", { id: provider.defaults.regionId }) : null,
          provider.defaults?.seasonProfileId ? game.i18n.format("CALENDAR_FORGE.ProviderManager.DefaultSeason", { id: provider.defaults.seasonProfileId }) : null,
          provider.defaults?.moonProfileIds?.length ? game.i18n.format("CALENDAR_FORGE.ProviderManager.DefaultMoons", { count: provider.defaults.moonProfileIds.length }) : null
        ].filter(Boolean),
        warningCount: provider.warnings?.length ?? 0,
        contentCount: Object.values(content).reduce((sum, values) => sum + (Array.isArray(values) ? values.length : 0), 0)
      };
    }).sort((a, b) => a.labelText.localeCompare(b.labelText));

    return foundry.utils.mergeObject(context, {
      providers,
      hasProviders: providers.length > 0,
      apiVersion: this.services.providers?.constructor ? globalThis.CalendarForge?.api?.version : "?",
      schemaVersion: globalThis.CalendarForge?.api?.schemaVersion ?? "?"
    }, { inplace: false });
  }

  static async #applyDefaults(_event, target) {
    const id = target.dataset.providerId;
    if (!id) return;
    try {
      await this.services.providers.applyDefaults(id);
      ui.notifications.info(game.i18n.format("CALENDAR_FORGE.ProviderManager.DefaultsApplied", { id }));
      this.render({ force: true });
    } catch (error) {
      console.error("Calendar Forge | Unable to apply provider defaults", error);
      ui.notifications.error(error.message);
    }
  }

  static async #alignClock(_event, target) {
    const id = target.dataset.providerId;
    if (!id) return;
    try {
      await this.services.providers.alignClock(id, { force: true });
      ui.notifications.info(game.i18n.format("CALENDAR_FORGE.ProviderManager.ClockAligned", { id }));
      this.render({ force: true });
    } catch (error) {
      console.error("Calendar Forge | Unable to align provider calendar", error);
      ui.notifications.error(error.message);
    }
  }
}
