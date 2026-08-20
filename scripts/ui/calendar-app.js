import { CalendarEngine } from "../calendar/calendar-engine.js";
import { formatCalendarDate, formatClock, getCalendarNameSet } from "../localization/date-formatter.js";
import { resolveLabel } from "../localization/label-resolver.js";
import { MODULE_ID } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const DEFAULT_CONTEXT = "__default__";
const WORLD_CONTEXT = "__world__";
const DAY_PRECISIONS = new Set(["day", "hour", "minute", "second"]);

function markerType(entry) {
  if (entry?.type === "holiday") return "holiday";
  if (entry?.type === "historical") return "historical";
  if (entry?.sourceType === "campaign" || entry?.type === "campaign") return "campaign";
  return entry?.type ?? "external";
}

export class CalendarForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "calendar-forge",
    classes: ["calendar-forge-app"],
    position: { width: 1280, height: 820 },
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
      selectMonth: CalendarForgeApp.#selectMonth,
      setViewMode: CalendarForgeApp.#setViewMode,
      jumpToDate: CalendarForgeApp.#jumpToDate,
      toggleAlternateNames: CalendarForgeApp.#toggleAlternateNames,
      manageCalendars: CalendarForgeApp.#manageCalendars,
      manageRegions: CalendarForgeApp.#manageRegions,
      manageTemporalProfiles: CalendarForgeApp.#manageTemporalProfiles,
      manageProviders: CalendarForgeApp.#manageProviders,
      openChronicle: CalendarForgeApp.#openChronicle,
      openEventDocument: CalendarForgeApp.#openEventDocument,
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
    this.viewYear = Number.isFinite(Number(options.viewYear)) ? Number(options.viewYear) : null;
    this.viewMonthIndex = Number.isFinite(Number(options.viewMonthIndex)) ? Number(options.viewMonthIndex) : null;
    this.viewMode = options.viewMode === "year" ? "year" : "month";
    this.selectedWorldTime = Number.isFinite(Number(options.worldTime)) ? Number(options.worldTime) : null;
    this.regionSelection = options.regionId === null ? WORLD_CONTEXT : (options.regionId ?? DEFAULT_CONTEXT);
  }

  get title() {
    return game.i18n.localize("CALENDAR_FORGE.Title");
  }

  navigate(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, "regionId")) {
      this.regionSelection = options.regionId === null ? WORLD_CONTEXT : (options.regionId ?? DEFAULT_CONTEXT);
    }
    if (options.viewMode) this.viewMode = options.viewMode === "year" ? "year" : "month";
    if (Number.isFinite(Number(options.worldTime))) {
      this.selectedWorldTime = Number(options.worldTime);
      const date = this.service.temporal.getDate(this.#contextOptions({ worldTime: this.selectedWorldTime }));
      this.viewYear = date.year;
      this.viewMonthIndex = date.monthIndex;
    }
    if (Number.isFinite(Number(options.viewYear))) this.viewYear = Number(options.viewYear);
    if (Number.isFinite(Number(options.viewMonthIndex))) this.viewMonthIndex = Number(options.viewMonthIndex);
    return this;
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
    for (const input of root?.querySelectorAll?.(".cf-jump-controls input, .cf-jump-controls select") ?? []) {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const button = root.querySelector('[data-action="jumpToDate"]');
        button?.click();
      });
    }
  }

  async #yearOverview(calendar, current, selected, showAlternateNames) {
    const year = this.viewYear;
    const firstMonthId = calendar.months[0]?.id;
    const yearStart = this.service.temporal.toWorldTime({ year, monthId: firstMonthId, day: 1, hour: 0, minute: 0, second: 0 }, this.#contextOptions());
    const yearEnd = this.service.temporal.toWorldTime({ year: year + 1, monthId: firstMonthId, day: 1, hour: 0, minute: 0, second: 0 }, this.#contextOptions());
    const special = new Map();
    const addMarker = (date, item) => {
      if (!date || Number(date.year) !== Number(year) || date.monthId == null || date.day == null) return;
      const monthIndex = calendar.months.findIndex((month) => month.id === date.monthId);
      if (monthIndex < 0) return;
      const key = `${monthIndex}:${Number(date.day)}`;
      const list = special.get(key) ?? [];
      list.push({ type: markerType(item), label: item.label ?? "" });
      special.set(key, list);
    };

    const chronicle = await this.service.events.getChronicle({
      calendar,
      regionId: current.regionId,
      fromYear: year,
      toYear: year,
      eventType: "all",
      context: {
        ...this.#contextOptions(),
        rangeStartWorldTime: yearStart,
        rangeEndWorldTime: yearEnd,
        dateFromWorldTime: (worldTime) => this.service.temporal.getDate(this.#contextOptions({ worldTime }))
      }
    });
    for (const entry of chronicle) if (DAY_PRECISIONS.has(entry.precision ?? "day")) addMarker(entry.date, entry);

    const profile = this.service.registries.seasons.get(current.profiles.seasonProfileId);
    if (profile?.calendarId === calendar.id) {
      for (const season of profile.seasons ?? []) addMarker({ year, monthId: season.monthId, day: Number(season.day) }, { type: "season-change", label: resolveLabel(season.label, season.id) });
    }

    const anchor = this.service.temporal.getAnchor(calendar);
    for (const transition of this.service.moons.getTransitionsBetween?.(yearStart, yearEnd, calendar, current.profiles.moonProfileIds, { markersOnly: true, anchor }) ?? []) {
      addMarker(this.service.temporal.getDate(this.#contextOptions({ worldTime: transition.worldTime })), { ...transition, type: "moon-phase" });
    }

    for (const event of this.service.astronomy.getEventsBetween?.(yearStart, yearEnd, {
      calendar,
      regionId: current.regionId,
      dateFromWorldTime: (worldTime) => this.service.temporal.getDate(this.#contextOptions({ worldTime })),
      dateToWorldTime: (date) => this.service.temporal.toWorldTime(date, this.#contextOptions())
    }) ?? []) {
      if (event.worldTime != null) addMarker(this.service.temporal.getDate(this.#contextOptions({ worldTime: event.worldTime })), event);
    }

    return calendar.months.map((month, monthIndex) => {
      const monthDays = CalendarEngine.daysInMonth(year, monthIndex, calendar);
      const firstWorldTime = this.service.temporal.toWorldTime({ year, monthIndex, day: 1, hour: 0, minute: 0, second: 0 }, this.#contextOptions());
      const firstDate = this.service.temporal.getDate(this.#contextOptions({ worldTime: firstWorldTime }));
      const cells = [];
      for (let index = 0; index < (firstDate.weekdayIndex ?? 0); index += 1) cells.push({ empty: true, key: `lead-${monthIndex}-${index}` });
      for (let day = 1; day <= monthDays; day += 1) {
        const markers = special.get(`${monthIndex}:${day}`) ?? [];
        const isToday = Number(current.raw.date.year) === Number(year) && current.raw.date.monthIndex === monthIndex && Number(current.raw.date.day) === day;
        const isSelected = Number(selected.raw.date.year) === Number(year) && selected.raw.date.monthIndex === monthIndex && Number(selected.raw.date.day) === day;
        cells.push({
          empty: false,
          key: `day-${monthIndex}-${day}`,
          day,
          isToday,
          isSelected,
          hasMarkers: markers.length > 0,
          markerTitle: markers.map((entry) => entry.label).filter(Boolean).join("\n")
        });
      }
      while (cells.length % calendar.week.days.length !== 0) cells.push({ empty: true, key: `trail-${monthIndex}-${cells.length}` });
      const alternate = resolveLabel(month.alternateLabel, "");
      return {
        monthIndex,
        label: resolveLabel(month.label, month.id),
        alternateLabel: showAlternateNames ? alternate : "",
        cells
      };
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const current = await this.service.temporal.getTemporalContext(this.#contextOptions());
    const calendar = current.raw.calendar;
    const currentDate = current.raw.date;
    const showAlternateNames = this.service.settings.showAlternateNames();

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
    const selectedNames = getCalendarNameSet(selected.raw.date, calendar);
    const monthAlternate = resolveLabel(month.alternateLabel, "");
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
    const yearMonths = this.viewMode === "year" ? await this.#yearOverview(calendar, current, selected, showAlternateNames) : [];

    const jumpMonthOptions = calendar.months.map((entry, index) => ({
      index,
      label: resolveLabel(entry.label, entry.id),
      alternateLabel: showAlternateNames ? resolveLabel(entry.alternateLabel, "") : "",
      selected: index === this.viewMonthIndex
    }));

    return foundry.utils.mergeObject(context, {
      current: {
        ...current,
        formatted: {
          ...current.formatted,
          date: formatCalendarDate(current.raw.date, calendar, { includeAlternate: showAlternateNames }),
          dateTime: formatCalendarDate(current.raw.date, calendar, { includeTime: true, includeAlternate: showAlternateNames })
        }
      },
      calendarLabel: resolveLabel(calendar.label, calendar.id),
      regionLabel: current.region?.label ?? game.i18n.localize("CALENDAR_FORGE.RegionSelector.World"),
      monthLabel: resolveLabel(month.label, month.id),
      monthAlternateLabel: showAlternateNames ? monthAlternate : "",
      viewYear: this.viewYear,
      weekLength,
      weekdays: calendar.week.days.map((weekday) => ({
        id: weekday.id,
        label: resolveLabel(weekday.shortLabel ?? weekday.label, weekday.id),
        alternateLabel: showAlternateNames ? resolveLabel(weekday.alternateShortLabel ?? weekday.alternateLabel, "") : ""
      })),
      cells,
      regions,
      selected: {
        ...selected,
        formattedDate: formatCalendarDate(selected.raw.date, calendar, { includeAlternate: showAlternateNames }),
        formattedTime: formatClock(selected.raw.date, calendar),
        weekday: selectedNames.weekday,
        weekdayAlternate: showAlternateNames ? selectedNames.weekdayAlternate : "",
        monthAlternate: showAlternateNames ? selectedNames.monthAlternate : "",
        season: selected.season ? {
          ...selected.season,
          progressLabel: `${Math.round(Math.max(0, Math.min(1, Number(selected.season.progress ?? 0))) * 100)}%`
        } : null,
        moons: (selected.moons ?? []).map((moon) => ({
          ...moon,
          illuminationLabel: `${Math.round(Math.max(0, Math.min(1, Number(moon.illumination ?? 0))) * 100)}%`
        })),
        events: selected.events,
        astronomicalEvents: selected.astronomicalEvents,
        moonTransitions: selected.moonTransitions,
        seasonChange: selectedSeasonChange
      },
      isMonthView: this.viewMode === "month",
      isYearView: this.viewMode === "year",
      yearMonths,
      showAlternateNames,
      jumpMonthOptions,
      jumpDay: this.viewMode === "month" && Number(selected.raw.date.year) === Number(this.viewYear) && selected.raw.date.monthIndex === this.viewMonthIndex ? selected.raw.date.day : 1,
      isGM: game.user?.isGM ?? false,
      labels: {
        today: game.i18n.localize("CALENDAR_FORGE.Actions.Today"),
        previousMonth: this.viewMode === "year" ? game.i18n.localize("CALENDAR_FORGE.Actions.PreviousYear") : game.i18n.localize("CALENDAR_FORGE.Actions.PreviousMonth"),
        nextMonth: this.viewMode === "year" ? game.i18n.localize("CALENDAR_FORGE.Actions.NextYear") : game.i18n.localize("CALENDAR_FORGE.Actions.NextMonth"),
        events: game.i18n.localize("CALENDAR_FORGE.Sections.Events"),
        astronomy: game.i18n.localize("CALENDAR_FORGE.Sections.Astronomy"),
        moons: game.i18n.localize("CALENDAR_FORGE.Sections.Moons"),
        season: game.i18n.localize("CALENDAR_FORGE.Sections.Season"),
        noEvents: game.i18n.localize("CALENDAR_FORGE.Messages.NoEvents"),
        noAstronomy: game.i18n.localize("CALENDAR_FORGE.Messages.NoAstronomy"),
        calendars: game.i18n.localize("CALENDAR_FORGE.Actions.ManageCalendars"),
        regions: game.i18n.localize("CALENDAR_FORGE.Actions.ManageRegions"),
        temporalProfiles: game.i18n.localize("CALENDAR_FORGE.Actions.ManageTemporalProfiles"),
        providers: game.i18n.localize("CALENDAR_FORGE.Actions.ManageProviders"),
        chronicle: game.i18n.localize("CALENDAR_FORGE.Actions.OpenChronicle"),
        openDocument: game.i18n.localize("CALENDAR_FORGE.Chronicle.OpenDocument"),
        monthView: game.i18n.localize("CALENDAR_FORGE.Actions.MonthView"),
        yearView: game.i18n.localize("CALENDAR_FORGE.Actions.YearView"),
        jump: game.i18n.localize("CALENDAR_FORGE.Actions.JumpToDate"),
        displayTools: game.i18n.localize("CALENDAR_FORGE.Actions.DisplayTools"),
        alternateNamesShort: game.i18n.localize("CALENDAR_FORGE.Actions.AlternateNamesShort"),
        alternateNamesTooltip: game.i18n.localize(showAlternateNames ? "CALENDAR_FORGE.Actions.HideAlternateNames" : "CALENDAR_FORGE.Actions.ShowAlternateNames")
      },
      legend: [
        { type: "season-change", icon: "fa-leaf", label: game.i18n.localize("CALENDAR_FORGE.Legend.SeasonChange") },
        { type: "moon-phase", icon: "fa-moon", label: game.i18n.localize("CALENDAR_FORGE.Legend.MoonPhase") },
        { type: "astronomy", icon: "fa-star-and-crescent", label: game.i18n.localize("CALENDAR_FORGE.Legend.Astronomy") },
        { type: "holiday", icon: "fa-star", label: game.i18n.localize("CALENDAR_FORGE.Legend.Holiday") },
        { type: "historical", icon: "fa-scroll", label: game.i18n.localize("CALENDAR_FORGE.Legend.Historical") },
        { type: "campaign", icon: "fa-flag", label: game.i18n.localize("CALENDAR_FORGE.Legend.Campaign") }
      ]
    }, { inplace: false });
  }

  static async #previousMonth() {
    if (this.viewMode === "year") {
      this.viewYear -= 1;
      this.render({ force: true });
      return;
    }
    const calendar = (await this.service.temporal.getTemporalContext(this.#contextOptions())).raw.calendar;
    const shifted = CalendarEngine.shiftMonth(this.viewYear, this.viewMonthIndex, -1, calendar);
    this.viewYear = shifted.year;
    this.viewMonthIndex = shifted.monthIndex;
    this.render({ force: true });
  }

  static async #nextMonth() {
    if (this.viewMode === "year") {
      this.viewYear += 1;
      this.render({ force: true });
      return;
    }
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

  static async #selectMonth(_event, target) {
    const monthIndex = Number(target.dataset.monthIndex);
    if (!Number.isInteger(monthIndex)) return;
    this.viewMonthIndex = monthIndex;
    this.viewMode = "month";
    const calendar = (await this.service.temporal.getTemporalContext(this.#contextOptions())).raw.calendar;
    this.selectedWorldTime = this.service.temporal.toWorldTime({ year: this.viewYear, monthIndex, day: 1, hour: Math.min(12, Number(calendar.time?.hoursPerDay ?? 24) - 1), minute: 0, second: 0 }, this.#contextOptions());
    this.render({ force: true });
  }

  static async #setViewMode(_event, target) {
    this.viewMode = target.dataset.mode === "year" ? "year" : "month";
    this.render({ force: true });
  }

  static async #jumpToDate() {
    const root = this.element?.querySelector ? this.element : this.element?.[0];
    if (!root) return;
    const year = Number(root.querySelector('[name="jump.year"]')?.value ?? this.viewYear);
    const monthIndex = Number(root.querySelector('[name="jump.monthIndex"]')?.value ?? this.viewMonthIndex);
    const day = Number(root.querySelector('[name="jump.day"]')?.value ?? 1);
    const calendar = (await this.service.temporal.getTemporalContext(this.#contextOptions())).raw.calendar;
    try {
      const worldTime = this.service.temporal.toWorldTime({ year, monthIndex, day, hour: Math.min(12, Number(calendar.time?.hoursPerDay ?? 24) - 1), minute: 0, second: 0 }, this.#contextOptions());
      this.viewYear = year;
      this.viewMonthIndex = monthIndex;
      this.viewMode = "month";
      this.selectedWorldTime = worldTime;
      this.render({ force: true });
    } catch (error) {
      ui.notifications.warn(`${game.i18n.localize("CALENDAR_FORGE.Messages.InvalidDate")} ${error.message}`);
    }
  }

  static async #toggleAlternateNames() {
    await this.service.settings.setShowAlternateNames(!this.service.settings.showAlternateNames());
    this.render({ force: true });
  }

  static async #manageCalendars() { this.service.openCalendarManager(); }
  static async #manageRegions() { this.service.openRegionManager(); }
  static async #manageTemporalProfiles() { this.service.openTemporalProfiles(); }
  static async #manageProviders() { this.service.openProviderManager(); }
  static async #openChronicle() {
    const regionId = this.regionSelection === WORLD_CONTEXT ? null : (this.regionSelection === DEFAULT_CONTEXT ? undefined : this.regionSelection);
    this.service.openChronicle({ mode: "chronicle", regionId, fromYear: this.viewYear, toYear: this.viewYear });
  }
  static async #openEventDocument(_event, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    try {
      const document = await fromUuid(uuid);
      if (!document) throw new Error("not-found");
      document.sheet?.render(true);
    } catch (error) {
      console.warn("Calendar Forge | Unable to open linked document", uuid, error);
      ui.notifications.warn(game.i18n.localize("CALENDAR_FORGE.Chronicle.DocumentNotFound"));
    }
  }

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
