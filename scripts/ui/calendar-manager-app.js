import { MODULE_ID } from "../constants.js";
import { resolveLabel } from "../localization/label-resolver.js";
import { slugifyId } from "../validation/definition-validator.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function rootOf(app) {
  return app.element?.querySelector ? app.element : app.element?.[0] ?? null;
}

function editableLabel(label, fallback = "") {
  return resolveLabel(label, fallback);
}

export class CalendarManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "calendar-forge-calendar-manager",
    classes: ["calendar-forge-manager", "calendar-forge-calendar-manager"],
    position: { width: 1120, height: 780 },
    window: { icon: "fa-solid fa-calendar-days", resizable: true, minimizable: true },
    actions: {
      selectCalendar: CalendarManagerApp.#selectCalendar,
      newCalendar: CalendarManagerApp.#newCalendar,
      duplicateCalendar: CalendarManagerApp.#duplicateCalendar,
      saveCalendar: CalendarManagerApp.#saveCalendar,
      deleteCalendar: CalendarManagerApp.#deleteCalendar,
      setActiveCalendar: CalendarManagerApp.#setActiveCalendar,
      addMonth: CalendarManagerApp.#addMonth,
      removeMonth: CalendarManagerApp.#removeMonth,
      addWeekday: CalendarManagerApp.#addWeekday,
      removeWeekday: CalendarManagerApp.#removeWeekday
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/calendar-manager.hbs` }
  };

  constructor(services, options = {}) {
    super(options);
    this.services = services;
    this.selectedId = null;
    this.draft = null;
    this.anchorDraft = null;
    this.isNew = false;
  }

  get title() {
    return game.i18n.localize("CALENDAR_FORGE.CalendarManager.Title");
  }

  #uniqueId(base) {
    const seed = slugifyId(base, "custom-calendar");
    let id = seed;
    let counter = 2;
    while (this.services.registries.calendars.has(id)) id = `${seed}-${counter++}`;
    return id;
  }

  #makeEditableCopy(source) {
    const copy = structuredClone(source);
    copy.id = this.#uniqueId(`${source.id}-custom`);
    copy.providerId = "calendar-forge-world";
    copy.label = { value: editableLabel(source.label, source.id) };
    copy.description = { value: editableLabel(source.description, "") };
    copy.era = { value: editableLabel(source.era, "") };
    copy.week = { days: (source.week?.days ?? []).map((day) => ({
      id: day.id,
      label: { value: editableLabel(day.label, day.id) },
      shortLabel: { value: editableLabel(day.shortLabel ?? day.label, day.id) }
    })) };
    copy.months = (source.months ?? []).map((month) => ({
      id: month.id,
      days: Number(month.days),
      leapDays: Number(month.leapDays ?? 0),
      label: { value: editableLabel(month.label, month.id) },
      shortLabel: { value: editableLabel(month.shortLabel ?? month.label, month.id) }
    }));
    copy.dateFormats = {
      date: { value: editableLabel(source.dateFormats?.date, game.i18n.localize("CALENDAR_FORGE.Formats.Date")) },
      dateTime: { value: editableLabel(source.dateFormats?.dateTime, game.i18n.localize("CALENDAR_FORGE.Formats.DateTime")) }
    };
    delete copy.defaultAnchor;
    return copy;
  }

  #startNewFrom(source) {
    this.draft = this.#makeEditableCopy(source);
    this.selectedId = this.draft.id;
    this.anchorDraft = structuredClone(this.services.temporal.getAnchor(source));
    if (!this.draft.months.some((month) => month.id === this.anchorDraft.monthId)) this.anchorDraft.monthId = this.draft.months[0]?.id;
    this.isNew = true;
  }

  #ensureSelection() {
    if (this.draft) return;
    const activeId = this.services.settings.activeCalendarId();
    const selected = this.services.registries.calendars.get(activeId) ?? this.services.registries.calendars.list()[0];
    if (!selected) return;
    this.selectedId = selected.id;
    this.draft = structuredClone(selected);
    this.anchorDraft = this.services.temporal.getAnchor(selected);
    this.isNew = false;
  }

  #capture() {
    const root = rootOf(this);
    if (!root || !this.draft) return;
    const value = (name, fallback = "") => root.querySelector(`[name="${name}"]`)?.value ?? fallback;
    const number = (name, fallback = 0) => Number(value(name, fallback));

    const editable = this.isNew || this.services.worldData.isWorldCalendar(this.selectedId);
    const requestedAnchorMonth = value("anchor.monthId", this.anchorDraft?.monthId);
    const oldAnchorMonthIndex = (this.draft.months ?? []).findIndex((month) => month.id === requestedAnchorMonth);
    if (editable) {
      this.draft.id = this.isNew ? slugifyId(value("calendar.id"), this.draft.id) : this.draft.id;
      this.draft.label = { value: value("calendar.label") };
      this.draft.description = { value: value("calendar.description") };
      this.draft.era = { value: value("calendar.era") };
      this.draft.time = {
        secondsPerMinute: number("time.secondsPerMinute", 60),
        minutesPerHour: number("time.minutesPerHour", 60),
        hoursPerDay: number("time.hoursPerDay", 24)
      };
      const leapType = value("leap.type", "none");
      this.draft.leapYear = { type: leapType };
      if (leapType === "interval") {
        this.draft.leapYear.interval = number("leap.interval", 4);
        this.draft.leapYear.offset = number("leap.offset", 0);
      }
      this.draft.dateFormats = {
        date: { value: value("format.date") },
        dateTime: { value: value("format.dateTime") }
      };

      this.draft.week = { days: [...root.querySelectorAll("[data-weekday-row]")].map((row) => ({
        id: slugifyId(row.querySelector('[data-field="id"]')?.value, "day"),
        label: { value: row.querySelector('[data-field="label"]')?.value ?? "" },
        shortLabel: { value: row.querySelector('[data-field="shortLabel"]')?.value ?? "" }
      })) };

      this.draft.months = [...root.querySelectorAll("[data-month-row]")].map((row) => ({
        id: slugifyId(row.querySelector('[data-field="id"]')?.value, "month"),
        label: { value: row.querySelector('[data-field="label"]')?.value ?? "" },
        shortLabel: { value: row.querySelector('[data-field="shortLabel"]')?.value ?? "" },
        days: Number(row.querySelector('[data-field="days"]')?.value ?? 30),
        leapDays: Number(row.querySelector('[data-field="leapDays"]')?.value ?? 0)
      }));
    }

    const resolvedAnchorMonth = this.draft.months.some((month) => month.id === requestedAnchorMonth)
      ? requestedAnchorMonth
      : this.draft.months[Math.max(0, oldAnchorMonthIndex)]?.id ?? this.draft.months[0]?.id;
    this.anchorDraft = {
      worldTime: number("anchor.worldTime", 0),
      year: number("anchor.year", 1),
      monthId: resolvedAnchorMonth,
      day: number("anchor.day", 1),
      hour: number("anchor.hour", 0),
      minute: number("anchor.minute", 0),
      second: number("anchor.second", 0),
      weekdayIndex: number("anchor.weekdayIndex", 0)
    };
  }

  async _prepareContext(options) {
    this.#ensureSelection();
    const context = await super._prepareContext(options);
    const calendars = this.services.registries.calendars.list().map((calendar) => ({
      id: calendar.id,
      label: resolveLabel(calendar.label, calendar.id),
      providerId: calendar.providerId ?? "unknown",
      isSelected: calendar.id === this.selectedId,
      isActive: calendar.id === this.services.settings.activeCalendarId(),
      isWorld: this.services.worldData.isWorldCalendar(calendar.id)
    })).sort((a, b) => a.label.localeCompare(b.label));

    if (!this.draft) return { ...context, calendars, hasSelection: false };
    const editable = this.isNew || this.services.worldData.isWorldCalendar(this.selectedId);
    const display = editable ? this.draft : {
      ...this.draft,
      label: { value: editableLabel(this.draft.label, this.draft.id) },
      description: { value: editableLabel(this.draft.description, "") },
      era: { value: editableLabel(this.draft.era, "") },
      week: { days: (this.draft.week?.days ?? []).map((day) => ({ ...day, label: { value: editableLabel(day.label, day.id) }, shortLabel: { value: editableLabel(day.shortLabel ?? day.label, day.id) } })) },
      months: (this.draft.months ?? []).map((month) => ({ ...month, label: { value: editableLabel(month.label, month.id) }, shortLabel: { value: editableLabel(month.shortLabel ?? month.label, month.id) } })),
      dateFormats: {
        date: { value: editableLabel(this.draft.dateFormats?.date, game.i18n.localize("CALENDAR_FORGE.Formats.Date")) },
        dateTime: { value: editableLabel(this.draft.dateFormats?.dateTime, game.i18n.localize("CALENDAR_FORGE.Formats.DateTime")) }
      }
    };

    const leapTypes = ["none", "gregorian", "interval"].map((id) => ({ id, selected: (display.leapYear?.type ?? "none") === id, label: game.i18n.localize(`CALENDAR_FORGE.CalendarManager.Leap.${id}`) }));
    const monthOptions = (display.months ?? []).map((month) => ({ id: month.id, label: editableLabel(month.label, month.id), selected: month.id === this.anchorDraft?.monthId }));
    const weekdayOptions = (display.week?.days ?? []).map((day, index) => ({ index, label: editableLabel(day.label, day.id), selected: index === Number(this.anchorDraft?.weekdayIndex ?? 0) }));

    return foundry.utils.mergeObject(context, {
      calendars,
      hasSelection: true,
      definition: display,
      anchor: this.anchorDraft,
      editable,
      isNew: this.isNew,
      isProvider: !editable,
      isActive: this.selectedId === this.services.settings.activeCalendarId(),
      providerId: this.draft.providerId ?? "calendar-forge-world",
      leapTypes,
      showInterval: (display.leapYear?.type ?? "none") === "interval",
      monthOptions,
      weekdayOptions
    }, { inplace: false });
  }

  static async #selectCalendar(_event, target) {
    this.#capture();
    const id = target.dataset.calendarId;
    const calendar = this.services.registries.calendars.get(id);
    if (!calendar) return;
    this.selectedId = id;
    this.draft = structuredClone(calendar);
    this.anchorDraft = this.services.temporal.getAnchor(calendar);
    this.isNew = false;
    this.render({ force: true });
  }

  static async #newCalendar() {
    this.#capture();
    const source = this.draft ?? this.services.registries.calendars.list()[0];
    if (!source) return;
    this.#startNewFrom(source);
    this.render({ force: true });
  }

  static async #duplicateCalendar() {
    this.#capture();
    const source = this.draft ?? this.services.registries.calendars.list()[0];
    if (!source) return;
    this.#startNewFrom(source);
    this.render({ force: true });
  }

  static async #saveCalendar() {
    this.#capture();
    try {
      if (this.isNew || this.services.worldData.isWorldCalendar(this.selectedId)) {
        const saved = await this.services.worldData.saveCalendar(this.draft, this.anchorDraft);
        this.selectedId = saved.id;
        this.draft = structuredClone(saved);
        this.isNew = false;
      } else {
        await this.services.worldData.saveAnchor(this.draft, this.anchorDraft);
      }
      ui.notifications.info(game.i18n.localize("CALENDAR_FORGE.Messages.Saved"));
      this.render({ force: true });
    } catch (error) {
      console.error("Calendar Forge | Calendar save failed", error);
      ui.notifications.error(`${game.i18n.localize("CALENDAR_FORGE.Messages.InvalidDefinition")} ${error.message}`);
    }
  }

  static async #deleteCalendar() {
    if (!this.services.worldData.isWorldCalendar(this.selectedId)) return;
    if (!globalThis.confirm(game.i18n.localize("CALENDAR_FORGE.Messages.ConfirmDeleteCalendar"))) return;
    const deletedId = this.selectedId;
    try {
      await this.services.worldData.deleteCalendar(deletedId);
      if (this.services.settings.activeCalendarId() === deletedId) {
        const fallback = this.services.registries.calendars.list()[0]?.id ?? "";
        if (fallback) await this.services.settings.setActiveCalendarId(fallback);
      }
      this.selectedId = null;
      this.draft = null;
      this.anchorDraft = null;
      this.isNew = false;
      this.render({ force: true });
    } catch (error) {
      ui.notifications.error(`${game.i18n.localize("CALENDAR_FORGE.Messages.DeleteFailed")} ${error.message}`);
    }
  }

  static async #setActiveCalendar() {
    this.#capture();
    if (this.isNew) {
      try {
        const saved = await this.services.worldData.saveCalendar(this.draft, this.anchorDraft);
        this.selectedId = saved.id;
        this.draft = structuredClone(saved);
        this.isNew = false;
      } catch (error) {
        ui.notifications.error(`${game.i18n.localize("CALENDAR_FORGE.Messages.InvalidDefinition")} ${error.message}`);
        return;
      }
    }
    await this.services.settings.setActiveCalendarId(this.selectedId);
    Hooks.callAll("calendarForgeDefinitionsChanged");
    this.render({ force: true });
  }

  static async #addMonth() {
    this.#capture();
    this.draft.months.push({ id: `month-${this.draft.months.length + 1}`, label: { value: game.i18n.localize("CALENDAR_FORGE.CalendarManager.NewMonth") }, shortLabel: { value: "" }, days: 30, leapDays: 0 });
    this.render({ force: true });
  }

  static async #removeMonth(_event, target) {
    this.#capture();
    if (this.draft.months.length <= 1) return;
    this.draft.months.splice(Number(target.dataset.index), 1);
    if (!this.draft.months.some((month) => month.id === this.anchorDraft.monthId)) this.anchorDraft.monthId = this.draft.months[0].id;
    this.render({ force: true });
  }

  static async #addWeekday() {
    this.#capture();
    this.draft.week.days.push({ id: `day-${this.draft.week.days.length + 1}`, label: { value: game.i18n.localize("CALENDAR_FORGE.CalendarManager.NewWeekday") }, shortLabel: { value: "" } });
    this.render({ force: true });
  }

  static async #removeWeekday(_event, target) {
    this.#capture();
    if (this.draft.week.days.length <= 1) return;
    this.draft.week.days.splice(Number(target.dataset.index), 1);
    this.anchorDraft.weekdayIndex = Math.min(this.anchorDraft.weekdayIndex, this.draft.week.days.length - 1);
    this.render({ force: true });
  }
}
