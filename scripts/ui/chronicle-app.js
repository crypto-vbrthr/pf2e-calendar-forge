import { MODULE_ID } from "../constants.js";
import { formatPartialCalendarDate } from "../localization/date-formatter.js";
import { resolveLabel } from "../localization/label-resolver.js";
import { slugifyId } from "../validation/definition-validator.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const DEFAULT_CONTEXT = "__default__";
const WORLD_CONTEXT = "__world__";

function rootOf(app) {
  return app.element?.querySelector ? app.element : app.element?.[0] ?? null;
}

function labelValue(label, fallback = "") {
  return resolveLabel(label, fallback);
}

export class ChronicleApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "calendar-forge-chronicle",
    classes: ["calendar-forge-manager", "calendar-forge-chronicle"],
    position: { width: 1260, height: 820 },
    window: { icon: "fa-solid fa-book-open", resizable: true, minimizable: true },
    actions: {
      setMode: ChronicleApp.#setMode,
      applyFilters: ChronicleApp.#applyFilters,
      selectDefinition: ChronicleApp.#selectDefinition,
      newDefinition: ChronicleApp.#newDefinition,
      duplicateDefinition: ChronicleApp.#duplicateDefinition,
      saveDefinition: ChronicleApp.#saveDefinition,
      deleteDefinition: ChronicleApp.#deleteDefinition,
      openDocument: ChronicleApp.#openDocument,
      resetFilters: ChronicleApp.#resetFilters,
      currentYear: ChronicleApp.#currentYear,
      toggleSort: ChronicleApp.#toggleSort,
      openInCalendar: ChronicleApp.#openInCalendar
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/chronicle-app.hbs` }
  };

  constructor(services, options = {}) {
    super(options);
    this.services = services;
    this.mode = options.mode ?? "chronicle";
    this.regionSelection = options.regionId === null ? WORLD_CONTEXT : (options.regionId ?? DEFAULT_CONTEXT);
    const current = services.temporal.getDate(this.#contextOptions());
    this.fromYear = Number(options.fromYear ?? current.year - 1);
    this.toYear = Number(options.toYear ?? current.year + 1);
    this.query = String(options.query ?? "");
    this.eventType = options.eventType ?? "all";
    this.sortDirection = options.sortDirection === "desc" ? "desc" : "asc";
    this.selectedId = null;
    this.draft = null;
    this.isNew = false;
  }

  get title() {
    return game.i18n.localize("CALENDAR_FORGE.Chronicle.Title");
  }

  #contextOptions(extra = {}) {
    if (this.regionSelection === WORLD_CONTEXT) return { ...extra, regionId: null };
    if (this.regionSelection === DEFAULT_CONTEXT) return { ...extra };
    return { ...extra, regionId: this.regionSelection };
  }

  #registry() {
    return this.mode === "holidays" ? this.services.registries.holidays : this.services.registries.historical;
  }

  #isWorld(id) {
    return this.mode === "holidays"
      ? this.services.worldData.isWorldHoliday(id)
      : this.services.worldData.isWorldHistoricalEvent(id);
  }

  #uniqueId(base) {
    const fallback = this.mode === "holidays" ? "holiday" : "historical-event";
    const seed = slugifyId(base, fallback);
    let id = seed;
    let counter = 2;
    while (this.#registry().has(id)) id = `${seed}-${counter++}`;
    return id;
  }

  #activeCalendar() {
    return this.services.temporal.resolve(this.#contextOptions()).calendar
      ?? this.services.registries.calendars.list()[0]
      ?? null;
  }

  #newDraft() {
    const calendar = this.#activeCalendar();
    const date = this.services.temporal.getDate(this.#contextOptions());
    const firstMonth = calendar?.months?.[date.monthIndex]?.id ?? calendar?.months?.[0]?.id ?? "month";
    if (this.mode === "holidays") {
      return {
        id: this.#uniqueId("holiday"),
        providerId: "calendar-forge-world",
        calendarId: calendar?.id ?? "",
        label: { value: game.i18n.localize("CALENDAR_FORGE.Chronicle.NewHoliday") },
        description: { value: "" },
        category: { value: "" },
        icon: "fa-star",
        visibility: "public",
        regionId: "",
        recurrence: { type: "yearly", monthId: firstMonth, day: Number(date.day ?? 1) },
        durationDays: 1,
        journalUuid: ""
      };
    }
    return {
      id: this.#uniqueId("historical-event"),
      providerId: "calendar-forge-world",
      calendarId: calendar?.id ?? "",
      label: { value: game.i18n.localize("CALENDAR_FORGE.Chronicle.NewHistoricalEvent") },
      description: { value: "" },
      category: { value: "" },
      icon: "fa-scroll",
      visibility: "public",
      regionId: "",
      precision: "day",
      date: {
        year: Number(date.year),
        monthId: firstMonth,
        day: Number(date.day ?? 1)
      },
      journalUuid: ""
    };
  }

  #editableCopy(source) {
    const copy = structuredClone(source);
    copy.id = this.#uniqueId(`${source.id}-custom`);
    copy.source = source.providerId && source.providerId !== "calendar-forge-world" ? { providerId: source.providerId, definitionId: source.id, contentVersion: source.providerContentVersion ?? null } : (source.source ? structuredClone(source.source) : undefined);
    copy.providerId = "calendar-forge-world";
    copy.label = { value: labelValue(source.label, source.id) };
    copy.description = { value: labelValue(source.description, "") };
    copy.category = { value: labelValue(source.category, "") };
    return copy;
  }

  #ensureSelection() {
    if (this.mode === "chronicle" || this.draft) return;
    const selected = this.#registry().get(this.selectedId) ?? this.#registry().list()[0] ?? null;
    if (!selected) return;
    this.selectedId = selected.id;
    this.draft = structuredClone(selected);
    this.isNew = false;
  }

  #capture() {
    if (this.mode === "chronicle" || !this.draft) return;
    const root = rootOf(this);
    if (!root) return;
    const editable = this.isNew || this.#isWorld(this.selectedId);
    if (!editable) return;
    const value = (name, fallback = "") => root.querySelector(`[name="${name}"]`)?.value ?? fallback;
    const number = (name, fallback = 0) => Number(value(name, fallback));

    this.draft.id = this.isNew ? slugifyId(value("definition.id"), this.draft.id) : this.draft.id;
    this.draft.label = { value: value("definition.label") };
    this.draft.description = { value: value("definition.description") };
    this.draft.category = { value: value("definition.category") };
    this.draft.calendarId = value("definition.calendarId", this.draft.calendarId);
    this.draft.icon = value("definition.icon", this.mode === "holidays" ? "fa-star" : "fa-scroll");
    this.draft.visibility = value("definition.visibility", "public");
    this.draft.regionId = value("definition.regionId", "");
    this.draft.journalUuid = value("definition.journalUuid", "").trim();

    if (this.mode === "holidays") {
      const recurrenceType = value("holiday.recurrenceType", "yearly");
      this.draft.recurrence = {
        type: recurrenceType,
        year: recurrenceType === "once" ? number("holiday.year", 1) : undefined,
        monthId: value("holiday.monthId"),
        day: number("holiday.day", 1)
      };
      if (recurrenceType !== "once") delete this.draft.recurrence.year;
      const calendar = this.services.registries.calendars.get(this.draft.calendarId);
      if (calendar && !calendar.months.some((month) => month.id === this.draft.recurrence.monthId)) this.draft.recurrence.monthId = calendar.months[0]?.id ?? "";
      this.draft.durationDays = Math.max(1, Math.trunc(number("holiday.durationDays", 1)));
      return;
    }

    this.draft.precision = value("historical.precision", "day");
    const rank = ["year", "month", "day", "hour", "minute", "second"].indexOf(this.draft.precision);
    const date = { year: number("historical.year", 1) };
    if (rank >= 1) date.monthId = value("historical.monthId", this.draft.date?.monthId ?? "");
    if (rank >= 2) date.day = number("historical.day", 1);
    if (rank >= 3) date.hour = number("historical.hour", 0);
    if (rank >= 4) date.minute = number("historical.minute", 0);
    if (rank >= 5) date.second = number("historical.second", 0);
    this.draft.date = date;
    const calendar = this.services.registries.calendars.get(this.draft.calendarId);
    if (rank >= 1 && calendar && !calendar.months.some((month) => month.id === this.draft.date.monthId)) this.draft.date.monthId = calendar.months[0]?.id ?? "";
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = rootOf(this);
    for (const select of root?.querySelectorAll?.(".cf-chronicle-reactive") ?? []) {
      select.addEventListener("change", () => {
        this.#capture();
        this.render({ force: true });
      }, { once: true });
    }
    for (const input of root?.querySelectorAll?.(".cf-chronicle-filterbar input, .cf-chronicle-filterbar select") ?? []) {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        root.querySelector('[data-action="applyFilters"]')?.click();
      });
    }
  }

  async _prepareContext(options) {
    this.#ensureSelection();
    const context = await super._prepareContext(options);
    const current = await this.services.temporal.getTemporalContext(this.#contextOptions());
    const calendar = current.raw.calendar;
    const regions = [
      {
        id: DEFAULT_CONTEXT,
        label: this.services.settings.defaultRegionId()
          ? game.i18n.format("CALENDAR_FORGE.RegionSelector.DefaultWithRegion", { region: resolveLabel(this.services.registries.regions.get(this.services.settings.defaultRegionId())?.label, this.services.settings.defaultRegionId()) })
          : game.i18n.localize("CALENDAR_FORGE.RegionSelector.Default"),
        selected: this.regionSelection === DEFAULT_CONTEXT
      },
      { id: WORLD_CONTEXT, label: game.i18n.localize("CALENDAR_FORGE.RegionSelector.World"), selected: this.regionSelection === WORLD_CONTEXT },
      ...this.services.regionService.listDecorated().map((region) => ({ id: region.id, label: region.label, selected: this.regionSelection === region.id }))
    ];

    let entries = [];
    if (this.mode === "chronicle") {
      const lowYear = Math.min(this.fromYear, this.toYear);
      const highYear = Math.max(this.fromYear, this.toYear);
      const firstMonthId = calendar.months[0]?.id;
      const rangeStartWorldTime = this.services.temporal.toWorldTime({ year: lowYear, monthId: firstMonthId, day: 1, hour: 0, minute: 0, second: 0 }, this.#contextOptions());
      const rangeEndWorldTime = this.services.temporal.toWorldTime({ year: highYear + 1, monthId: firstMonthId, day: 1, hour: 0, minute: 0, second: 0 }, this.#contextOptions());
      entries = await this.services.events.getChronicle({
        calendar,
        regionId: current.regionId,
        fromYear: this.fromYear,
        toYear: this.toYear,
        query: this.query,
        eventType: this.eventType,
        context: {
          ...this.#contextOptions(),
          rangeStartWorldTime,
          rangeEndWorldTime,
          dateFromWorldTime: (worldTime) => this.services.temporal.getDate(this.#contextOptions({ worldTime }))
        }
      });
      entries = entries.map((entry) => ({
        ...entry,
        formattedDate: formatPartialCalendarDate(entry.date, entry.precision ?? "day", calendar, { includeAlternate: this.services.settings.showAlternateNames() }),
        sourceLabel: this.#sourceLabel(entry),
        durationLabel: entry.type === "holiday" && Number(entry.durationDays ?? 1) > 1
          ? game.i18n.format("CALENDAR_FORGE.Chronicle.DurationDays", { days: Number(entry.durationDays) })
          : ""
      }));
    }

    if (this.mode === "chronicle") {
      entries = entries.map((entry) => {
        const precision = entry.precision ?? "day";
        const rank = ["year", "month", "day", "hour", "minute", "second"].indexOf(precision);
        const monthId = rank >= 1 ? entry.date?.monthId : calendar.months[0]?.id;
        const day = rank >= 2 ? Number(entry.date?.day ?? 1) : 1;
        let navigationWorldTime = null;
        try {
          navigationWorldTime = this.services.temporal.toWorldTime({
            year: Number(entry.date?.year),
            monthId,
            day,
            hour: rank >= 3 ? Number(entry.date?.hour ?? 0) : 0,
            minute: rank >= 4 ? Number(entry.date?.minute ?? 0) : 0,
            second: rank >= 5 ? Number(entry.date?.second ?? 0) : 0
          }, this.#contextOptions());
        } catch (_error) { /* partial or provider-specific dates may not navigate */ }
        return { ...entry, navigationWorldTime, canNavigate: Number.isFinite(Number(navigationWorldTime)) };
      });
      if (this.sortDirection === "desc") entries.reverse();
    }

    const entryCounts = this.mode === "chronicle"
      ? ["holiday", "historical", "campaign", "external"].map((type) => ({ type, label: game.i18n.localize(`CALENDAR_FORGE.Chronicle.EventTypes.${type}`), count: entries.filter((entry) => (entry.sourceType ?? entry.type ?? "external") === type || (type === "external" && !["holiday", "historical", "campaign"].includes(entry.sourceType ?? entry.type))).length }))
      : [];

    const result = {
      mode: this.mode,
      isChronicle: this.mode === "chronicle",
      isHolidays: this.mode === "holidays",
      isHistorical: this.mode === "historical",
      isGM: game.user?.isGM ?? false,
      calendarLabel: current.calendar.label,
      regionLabel: current.region?.label ?? game.i18n.localize("CALENDAR_FORGE.RegionSelector.World"),
      regions,
      fromYear: this.fromYear,
      toYear: this.toYear,
      query: this.query,
      eventType: this.eventType,
      sortDirection: this.sortDirection,
      sortDescending: this.sortDirection === "desc",
      entries,
      entryCounts,
      entryCount: entries.length,
      eventTypeOptions: ["all", "holiday", "historical", "campaign", "external"].map((id) => ({ id, label: game.i18n.localize(`CALENDAR_FORGE.Chronicle.EventTypes.${id}`), selected: this.eventType === id })),
      labels: {
        chronicle: game.i18n.localize("CALENDAR_FORGE.Chronicle.Tabs.Chronicle"),
        holidays: game.i18n.localize("CALENDAR_FORGE.Chronicle.Tabs.Holidays"),
        historical: game.i18n.localize("CALENDAR_FORGE.Chronicle.Tabs.Historical")
      }
    };

    if (this.mode !== "chronicle") Object.assign(result, this.#editorContext());
    return foundry.utils.mergeObject(context, result, { inplace: false });
  }

  #sourceLabel(entry) {
    if (entry.sourceType === "holiday") return game.i18n.localize("CALENDAR_FORGE.Chronicle.Sources.Holiday");
    if (entry.sourceType === "historical") return game.i18n.localize("CALENDAR_FORGE.Chronicle.Sources.Historical");
    if (entry.sourceType === "campaign") return game.i18n.localize("CALENDAR_FORGE.Chronicle.Sources.Campaign");
    return game.i18n.localize("CALENDAR_FORGE.Chronicle.Sources.External");
  }

  #editorContext() {
    const registry = this.#registry();
    const items = registry.list().map((definition) => ({
      id: definition.id,
      label: labelValue(definition.label, definition.id),
      providerId: definition.providerId ?? "",
      selected: definition.id === this.selectedId,
      isWorld: this.#isWorld(definition.id)
    }));
    const draft = this.draft;
    if (!draft) return { items, hasDraft: false };
    const editable = this.isNew || this.#isWorld(this.selectedId);
    const draftCalendar = this.services.registries.calendars.get(draft.calendarId) ?? this.#activeCalendar();
    const calendars = this.services.registries.calendars.list().map((entry) => ({ id: entry.id, label: labelValue(entry.label, entry.id), selected: entry.id === draft.calendarId }));
    const regions = [{ id: "", label: game.i18n.localize("CALENDAR_FORGE.Chronicle.AllRegions"), selected: !draft.regionId }, ...this.services.regionService.listDecorated().map((region) => ({ id: region.id, label: region.label, selected: region.id === draft.regionId }))];
    const months = (draftCalendar?.months ?? []).map((month) => ({ id: month.id, label: labelValue(month.label, month.id), selected: month.id === (this.mode === "holidays" ? draft.recurrence?.monthId : draft.date?.monthId) }));
    const visibilityOptions = ["public", "gm"].map((id) => ({ id, label: game.i18n.localize(`CALENDAR_FORGE.TemporalProfiles.VisibilityOptions.${id}`), selected: (draft.visibility ?? "public") === id }));
    const result = {
      items,
      hasDraft: true,
      editable,
      isProvider: !editable,
      isNew: this.isNew,
      draft: {
        ...draft,
        labelValue: labelValue(draft.label, draft.id),
        descriptionValue: labelValue(draft.description, ""),
        categoryValue: labelValue(draft.category, "")
      },
      calendars,
      regions,
      months,
      visibilityOptions
    };
    if (this.mode === "holidays") {
      result.recurrenceOptions = ["yearly", "once"].map((id) => ({ id, label: game.i18n.localize(`CALENDAR_FORGE.Chronicle.Recurrence.${id}`), selected: (draft.recurrence?.type ?? "yearly") === id }));
      result.isOnceHoliday = draft.recurrence?.type === "once";
    } else {
      result.precisionOptions = ["year", "month", "day", "hour", "minute", "second"].map((id) => ({ id, label: game.i18n.localize(`CALENDAR_FORGE.Chronicle.Precision.${id}`), selected: (draft.precision ?? "day") === id }));
      const rank = ["year", "month", "day", "hour", "minute", "second"].indexOf(draft.precision ?? "day");
      result.showMonth = rank >= 1;
      result.showDay = rank >= 2;
      result.showHour = rank >= 3;
      result.showMinute = rank >= 4;
      result.showSecond = rank >= 5;
    }
    return result;
  }

  static async #setMode(_event, target) {
    const mode = target.dataset.mode;
    if (!["chronicle", "holidays", "historical"].includes(mode)) return;
    if (mode !== "chronicle" && !game.user?.isGM) return;
    this.#capture();
    this.mode = mode;
    this.selectedId = null;
    this.draft = null;
    this.isNew = false;
    this.render({ force: true });
  }

  static async #applyFilters() {
    const root = rootOf(this);
    if (!root) return;
    this.regionSelection = root.querySelector('[name="chronicle.region"]')?.value ?? this.regionSelection;
    this.fromYear = Number(root.querySelector('[name="chronicle.fromYear"]')?.value ?? this.fromYear);
    this.toYear = Number(root.querySelector('[name="chronicle.toYear"]')?.value ?? this.toYear);
    this.query = root.querySelector('[name="chronicle.query"]')?.value ?? "";
    this.eventType = root.querySelector('[name="chronicle.eventType"]')?.value ?? "all";
    this.render({ force: true });
  }

  static async #resetFilters() {
    const current = this.services.temporal.getDate(this.#contextOptions());
    this.fromYear = Number(current.year) - 1;
    this.toYear = Number(current.year) + 1;
    this.query = "";
    this.eventType = "all";
    this.render({ force: true });
  }

  static async #currentYear() {
    const current = this.services.temporal.getDate(this.#contextOptions());
    this.fromYear = Number(current.year);
    this.toYear = Number(current.year);
    this.render({ force: true });
  }

  static async #toggleSort() {
    this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
    this.render({ force: true });
  }

  static async #openInCalendar(_event, target) {
    const worldTime = Number(target.dataset.worldTime);
    if (!Number.isFinite(worldTime)) return;
    const regionId = this.regionSelection === WORLD_CONTEXT ? null : (this.regionSelection === DEFAULT_CONTEXT ? undefined : this.regionSelection);
    this.services.openCalendar({ worldTime, regionId, viewMode: "month" });
  }

  static async #selectDefinition(_event, target) {
    this.#capture();
    this.selectedId = target.dataset.id;
    this.draft = structuredClone(this.#registry().get(this.selectedId));
    this.isNew = false;
    this.render({ force: true });
  }

  static async #newDefinition() {
    this.#capture();
    this.selectedId = null;
    this.draft = this.#newDraft();
    this.isNew = true;
    this.render({ force: true });
  }

  static async #duplicateDefinition() {
    const source = this.#registry().get(this.selectedId);
    if (!source) return;
    this.draft = this.#editableCopy(source);
    this.selectedId = null;
    this.isNew = true;
    this.render({ force: true });
  }

  static async #saveDefinition() {
    this.#capture();
    if (!this.draft || !(this.isNew || this.#isWorld(this.selectedId))) return;
    try {
      const saved = this.mode === "holidays"
        ? await this.services.worldData.saveHoliday(this.draft)
        : await this.services.worldData.saveHistoricalEvent(this.draft);
      this.selectedId = saved.id;
      this.draft = structuredClone(saved);
      this.isNew = false;
      ui.notifications.info(game.i18n.localize("CALENDAR_FORGE.Messages.Saved"));
      this.render({ force: true });
    } catch (error) {
      console.error("Calendar Forge | Event save failed", error);
      ui.notifications.error(`${game.i18n.localize("CALENDAR_FORGE.Messages.InvalidDefinition")} ${error.message}`);
    }
  }

  static async #deleteDefinition() {
    if (!this.selectedId || !this.#isWorld(this.selectedId)) return;
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CALENDAR_FORGE.Chronicle.DeleteTitle") },
      content: `<p>${game.i18n.localize("CALENDAR_FORGE.Chronicle.ConfirmDelete")}</p>`
    });
    if (!confirm) return;
    if (this.mode === "holidays") await this.services.worldData.deleteHoliday(this.selectedId);
    else await this.services.worldData.deleteHistoricalEvent(this.selectedId);
    this.selectedId = null;
    this.draft = null;
    this.isNew = false;
    this.render({ force: true });
  }

  static async #openDocument(_event, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    try {
      const document = await fromUuid(uuid);
      if (!document) throw new Error(game.i18n.localize("CALENDAR_FORGE.Chronicle.DocumentNotFound"));
      document.sheet?.render(true);
    } catch (error) {
      console.warn("Calendar Forge | Unable to open linked document", uuid, error);
      ui.notifications.warn(game.i18n.localize("CALENDAR_FORGE.Chronicle.DocumentNotFound"));
    }
  }
}
