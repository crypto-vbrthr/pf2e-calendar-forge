import { CalendarEngine } from "../calendar/calendar-engine.js";
import { formatCalendarDate, formatClock } from "../localization/date-formatter.js";
import { resolveLabel } from "../localization/label-resolver.js";
import { MODULE_ID } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const DEFAULT_CONTEXT = "__default__";
const WORLD_CONTEXT = "__world__";

export class CalendarForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "calendar-forge",
    classes: ["calendar-forge-app"],
    position: { width: 1240, height: 790 },
    window: {
      icon: "fa-solid fa-calendar-days",
      resizable: true,
      minimizable: true
    },
    actions: {
      previousMonth: CalendarForgeApp.#previousMonth,
      nextMonth: CalendarForgeApp.#nextMonth,
      today: CalendarForgeApp.#today,
      selectDay: CalendarForgeApp.#selectDay,
      manageCalendars: CalendarForgeApp.#manageCalendars,
      manageRegions: CalendarForgeApp.#manageRegions,
      manageTemporalProfiles: CalendarForgeApp.#manageTemporalProfiles,
      advanceHour: CalendarForgeApp.#advanceHour,
      rewindHour: CalendarForgeApp.#rewindHour,
      advanceDay: CalendarForgeApp.#advanceDay,
      rewindDay: CalendarForgeApp.#rewindDay
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/calendar-app.hbs` }
  };

  constructor(service, options = {}) {
    super(options);
    this.service = service;
    this.viewYear = null;
    this.viewMonthIndex = null;
    this.selectedWorldTime = null;
    this.regionSelection = options.regionId === null ? WORLD_CONTEXT : (options.regionId ?? DEFAULT_CONTEXT);
  }

  get title() {
    return game.i18n.localize("CALENDAR_FORGE.Title");
  }

  #contextOptions(extra = {}) {
    if (this.regionSelection === WORLD_CONTEXT) return { ...extra, regionId: null };
    if (this.regionSelection === DEFAULT_CONTEXT) return { ...extra };
    return { ...extra, regionId: this.regionSelection };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element?.querySelector ? this.element : this.element?.[0];
    const select = root?.querySelector(".cf-region-select select");
    if (select) {
      select.addEventListener("change", () => {
        this.regionSelection = select.value || DEFAULT_CONTEXT;
        const date = this.service.temporal.getDate(this.#contextOptions());
        this.viewYear = date.year;
        this.viewMonthIndex = date.monthIndex;
        this.selectedWorldTime = game.time.worldTime;
        this.render({ force: true });
      }, { once: true });
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const current = await this.service.temporal.getTemporalContext(this.#contextOptions());
    const calendar = current.raw.calendar;
    const currentDate = current.raw.date;

    if (this.viewYear == null) this.viewYear = currentDate.year;
    if (this.viewMonthIndex == null || this.viewMonthIndex >= calendar.months.length) this.viewMonthIndex = currentDate.monthIndex;
    if (this.selectedWorldTime == null) this.selectedWorldTime = current.worldTime;

    const selected = await this.service.temporal.getTemporalContext(this.#contextOptions({ worldTime: this.selectedWorldTime }));
    const month = calendar.months[this.viewMonthIndex];
    const monthDays = CalendarEngine.daysInMonth(this.viewYear, this.viewMonthIndex, calendar);
    const firstWorldTime = this.service.temporal.toWorldTime({
      year: this.viewYear,
      monthIndex: this.viewMonthIndex,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0
    }, this.#contextOptions());
    const firstDate = this.service.temporal.getDate(this.#contextOptions({ worldTime: firstWorldTime }));
    const weekLength = calendar.week.days.length;

    const cells = [];
    for (let index = 0; index < (firstDate.weekdayIndex ?? 0); index += 1) cells.push({ empty: true, key: `lead-${index}` });

    for (let day = 1; day <= monthDays; day += 1) {
      const worldTime = this.service.temporal.toWorldTime({
        year: this.viewYear,
        monthIndex: this.viewMonthIndex,
        day,
        hour: Math.min(12, (calendar.time?.hoursPerDay ?? 24) - 1),
        minute: 0,
        second: 0
      }, this.#contextOptions());
      const dayContext = await this.service.temporal.getTemporalContext(this.#contextOptions({ worldTime }));
      const date = dayContext.raw.date;
      const seasonChange = this.service.seasons.getChangeForDate(date, calendar, dayContext.profiles.seasonProfileId);
      const markers = [];
      if (seasonChange) markers.push(seasonChange);
      for (const transition of dayContext.moonTransitions ?? []) markers.push(transition);
      for (const event of dayContext.astronomicalEvents ?? []) markers.push(event);
      for (const event of dayContext.events) markers.push(event);

      const isToday = date.year === currentDate.year && date.monthIndex === currentDate.monthIndex && date.day === currentDate.day;
      const selectedDate = selected.raw.date;
      const isSelected = date.year === selectedDate.year && date.monthIndex === selectedDate.monthIndex && date.day === selectedDate.day;

      cells.push({
        empty: false,
        key: `day-${day}`,
        day,
        worldTime,
        isToday,
        isSelected,
        markers: markers.slice(0, 4),
        extraMarkers: Math.max(0, markers.length - 4),
        markerTitle: markers.map((marker) => marker.formattedTime ? `${marker.formattedTime} · ${marker.label}` : marker.label).filter(Boolean).join("\n")
      });
    }

    while (cells.length % weekLength !== 0) cells.push({ empty: true, key: `trail-${cells.length}` });

    const selectedSeasonChange = this.service.seasons.getChangeForDate(selected.raw.date, calendar, selected.profiles.seasonProfileId);
    const regions = [
      {
        id: DEFAULT_CONTEXT,
        label: this.service.settings.defaultRegionId()
          ? game.i18n.format("CALENDAR_FORGE.RegionSelector.DefaultWithRegion", { region: resolveLabel(this.service.registries.regions.get(this.service.settings.defaultRegionId())?.label, this.service.settings.defaultRegionId()) })
          : game.i18n.localize("CALENDAR_FORGE.RegionSelector.Default"),
        selected: this.regionSelection === DEFAULT_CONTEXT
      },
      { id: WORLD_CONTEXT, label: game.i18n.localize("CALENDAR_FORGE.RegionSelector.World"), selected: this.regionSelection === WORLD_CONTEXT },
      ...this.service.regionService.listDecorated().map((region) => ({ id: region.id, label: region.label, selected: this.regionSelection === region.id }))
    ];

    return foundry.utils.mergeObject(context, {
      current,
      calendarLabel: resolveLabel(calendar.label, calendar.id),
      regionLabel: current.region?.label ?? game.i18n.localize("CALENDAR_FORGE.RegionSelector.World"),
      monthLabel: resolveLabel(month.label, month.id),
      viewYear: this.viewYear,
      weekLength,
      weekdays: calendar.week.days.map((weekday) => ({ id: weekday.id, label: resolveLabel(weekday.shortLabel ?? weekday.label, weekday.id) })),
      cells,
      regions,
      selected: {
        ...selected,
        formattedDate: formatCalendarDate(selected.raw.date, calendar),
        formattedTime: formatClock(selected.raw.date, calendar),
        weekday: resolveLabel(calendar.week.days[selected.raw.date.weekdayIndex]?.label, ""),
        events: selected.events,
        astronomicalEvents: selected.astronomicalEvents,
        moonTransitions: selected.moonTransitions,
        seasonChange: selectedSeasonChange
      },
      isGM: game.user?.isGM ?? false,
      labels: {
        today: game.i18n.localize("CALENDAR_FORGE.Actions.Today"),
        previousMonth: game.i18n.localize("CALENDAR_FORGE.Actions.PreviousMonth"),
        nextMonth: game.i18n.localize("CALENDAR_FORGE.Actions.NextMonth"),
        events: game.i18n.localize("CALENDAR_FORGE.Sections.Events"),
        astronomy: game.i18n.localize("CALENDAR_FORGE.Sections.Astronomy"),
        moons: game.i18n.localize("CALENDAR_FORGE.Sections.Moons"),
        season: game.i18n.localize("CALENDAR_FORGE.Sections.Season"),
        noEvents: game.i18n.localize("CALENDAR_FORGE.Messages.NoEvents"),
        noAstronomy: game.i18n.localize("CALENDAR_FORGE.Messages.NoAstronomy"),
        calendars: game.i18n.localize("CALENDAR_FORGE.Actions.ManageCalendars"),
        regions: game.i18n.localize("CALENDAR_FORGE.Actions.ManageRegions"),
        temporalProfiles: game.i18n.localize("CALENDAR_FORGE.Actions.ManageTemporalProfiles")
      }
    }, { inplace: false });
  }

  static async #previousMonth() {
    const calendar = (await this.service.temporal.getTemporalContext(this.#contextOptions())).raw.calendar;
    const shifted = CalendarEngine.shiftMonth(this.viewYear, this.viewMonthIndex, -1, calendar);
    this.viewYear = shifted.year;
    this.viewMonthIndex = shifted.monthIndex;
    this.render({ force: true });
  }

  static async #nextMonth() {
    const calendar = (await this.service.temporal.getTemporalContext(this.#contextOptions())).raw.calendar;
    const shifted = CalendarEngine.shiftMonth(this.viewYear, this.viewMonthIndex, 1, calendar);
    this.viewYear = shifted.year;
    this.viewMonthIndex = shifted.monthIndex;
    this.render({ force: true });
  }

  static async #today() {
    const date = this.service.temporal.getDate(this.#contextOptions());
    this.viewYear = date.year;
    this.viewMonthIndex = date.monthIndex;
    this.selectedWorldTime = game.time.worldTime;
    this.render({ force: true });
  }

  static async #selectDay(_event, target) {
    this.selectedWorldTime = Number(target.dataset.worldTime);
    this.render({ force: true });
  }

  static async #manageCalendars() { this.service.openCalendarManager(); }
  static async #manageRegions() { this.service.openRegionManager(); }
  static async #manageTemporalProfiles() { this.service.openTemporalProfiles(); }

  static async #advanceHour() {
    const calendar = (await this.service.temporal.getTemporalContext(this.#contextOptions())).raw.calendar;
    await game.time.advance(CalendarEngine.secondsPerHour(calendar));
  }
  static async #rewindHour() {
    const calendar = (await this.service.temporal.getTemporalContext(this.#contextOptions())).raw.calendar;
    await game.time.advance(-CalendarEngine.secondsPerHour(calendar));
  }
  static async #advanceDay() {
    const calendar = (await this.service.temporal.getTemporalContext(this.#contextOptions())).raw.calendar;
    await game.time.advance(CalendarEngine.secondsPerDay(calendar));
  }
  static async #rewindDay() {
    const calendar = (await this.service.temporal.getTemporalContext(this.#contextOptions())).raw.calendar;
    await game.time.advance(-CalendarEngine.secondsPerDay(calendar));
  }
}
