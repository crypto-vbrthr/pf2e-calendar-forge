import { CalendarEngine } from "../calendar/calendar-engine.js";
import { formatCalendarDate, formatClock } from "../localization/date-formatter.js";
import { resolveLabel } from "../localization/label-resolver.js";
import { MODULE_ID } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CalendarForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "calendar-forge",
    classes: ["calendar-forge-app"],
    position: { width: 1180, height: 760 },
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
      advanceHour: CalendarForgeApp.#advanceHour,
      rewindHour: CalendarForgeApp.#rewindHour,
      advanceDay: CalendarForgeApp.#advanceDay,
      rewindDay: CalendarForgeApp.#rewindDay
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/calendar-app.hbs`
    }
  };

  constructor(service, options = {}) {
    super(options);
    this.service = service;
    this.viewYear = null;
    this.viewMonthIndex = null;
    this.selectedWorldTime = null;
  }

  get title() {
    return game.i18n.localize("CALENDAR_FORGE.Title");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const current = await this.service.temporal.getTemporalContext();
    const calendar = this.service.temporal.getCalendar();
    const currentDate = current.raw.date;

    if (this.viewYear == null) this.viewYear = currentDate.year;
    if (this.viewMonthIndex == null) this.viewMonthIndex = currentDate.monthIndex;
    if (this.selectedWorldTime == null) this.selectedWorldTime = current.worldTime;

    const selected = await this.service.temporal.getTemporalContext({ worldTime: this.selectedWorldTime });
    const month = calendar.months[this.viewMonthIndex];
    const monthDays = CalendarEngine.daysInMonth(this.viewYear, this.viewMonthIndex, calendar);
    const firstWorldTime = this.service.temporal.toWorldTime({
      year: this.viewYear,
      monthIndex: this.viewMonthIndex,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0
    });
    const firstDate = this.service.temporal.getDate({ worldTime: firstWorldTime });
    const weekLength = calendar.week.days.length;

    const cells = [];
    for (let index = 0; index < (firstDate.weekdayIndex ?? 0); index += 1) {
      cells.push({ empty: true, key: `lead-${index}` });
    }

    for (let day = 1; day <= monthDays; day += 1) {
      const worldTime = this.service.temporal.toWorldTime({
        year: this.viewYear,
        monthIndex: this.viewMonthIndex,
        day,
        hour: 12,
        minute: 0,
        second: 0
      });
      const date = this.service.temporal.getDate({ worldTime });
      const events = await this.service.events.getEventsForDate(date, { calendarId: calendar.id });
      const seasonChange = this.service.seasons.getChangeForDate(
        date,
        calendar,
        this.service.settings.activeSeasonProfileId()
      );
      const markers = [];
      if (seasonChange) markers.push(seasonChange);
      for (const event of events) markers.push(event);

      const isToday = date.year === currentDate.year
        && date.monthIndex === currentDate.monthIndex
        && date.day === currentDate.day;
      const selectedDate = selected.raw.date;
      const isSelected = date.year === selectedDate.year
        && date.monthIndex === selectedDate.monthIndex
        && date.day === selectedDate.day;

      cells.push({
        empty: false,
        key: `day-${day}`,
        day,
        worldTime,
        isToday,
        isSelected,
        markers: markers.slice(0, 3),
        extraMarkers: Math.max(0, markers.length - 3),
        markerTitle: markers.map((marker) => marker.label).filter(Boolean).join("\n")
      });
    }

    while (cells.length % weekLength !== 0) cells.push({ empty: true, key: `trail-${cells.length}` });

    const selectedEvents = await this.service.events.getEventsForDate(selected.raw.date, { calendarId: calendar.id });
    const selectedSeasonChange = this.service.seasons.getChangeForDate(
      selected.raw.date,
      calendar,
      this.service.settings.activeSeasonProfileId()
    );

    return foundry.utils.mergeObject(context, {
      current,
      calendarLabel: resolveLabel(calendar.label, calendar.id),
      monthLabel: resolveLabel(month.label, month.id),
      viewYear: this.viewYear,
      weekdays: calendar.week.days.map((weekday) => ({
        id: weekday.id,
        label: resolveLabel(weekday.shortLabel ?? weekday.label, weekday.id)
      })),
      cells,
      selected: {
        ...selected,
        formattedDate: formatCalendarDate(selected.raw.date, calendar),
        formattedTime: formatClock(selected.raw.date),
        weekday: resolveLabel(calendar.week.days[selected.raw.date.weekdayIndex]?.label, ""),
        events: selectedEvents,
        seasonChange: selectedSeasonChange
      },
      isGM: game.user?.isGM ?? false,
      labels: {
        today: game.i18n.localize("CALENDAR_FORGE.Actions.Today"),
        previousMonth: game.i18n.localize("CALENDAR_FORGE.Actions.PreviousMonth"),
        nextMonth: game.i18n.localize("CALENDAR_FORGE.Actions.NextMonth"),
        events: game.i18n.localize("CALENDAR_FORGE.Sections.Events"),
        moons: game.i18n.localize("CALENDAR_FORGE.Sections.Moons"),
        season: game.i18n.localize("CALENDAR_FORGE.Sections.Season"),
        noEvents: game.i18n.localize("CALENDAR_FORGE.Messages.NoEvents")
      }
    }, { inplace: false });
  }

  static async #previousMonth() {
    const calendar = this.service.temporal.getCalendar();
    const shifted = CalendarEngine.shiftMonth(this.viewYear, this.viewMonthIndex, -1, calendar);
    this.viewYear = shifted.year;
    this.viewMonthIndex = shifted.monthIndex;
    this.render({ force: true });
  }

  static async #nextMonth() {
    const calendar = this.service.temporal.getCalendar();
    const shifted = CalendarEngine.shiftMonth(this.viewYear, this.viewMonthIndex, 1, calendar);
    this.viewYear = shifted.year;
    this.viewMonthIndex = shifted.monthIndex;
    this.render({ force: true });
  }

  static async #today() {
    const date = this.service.temporal.getDate();
    this.viewYear = date.year;
    this.viewMonthIndex = date.monthIndex;
    this.selectedWorldTime = game.time.worldTime;
    this.render({ force: true });
  }

  static async #selectDay(_event, target) {
    this.selectedWorldTime = Number(target.dataset.worldTime);
    this.render({ force: true });
  }

  static async #advanceHour() {
    await game.time.advance(this.service.temporal.getCalendar().time.secondsPerMinute * this.service.temporal.getCalendar().time.minutesPerHour);
  }

  static async #rewindHour() {
    await game.time.advance(-this.service.temporal.getCalendar().time.secondsPerMinute * this.service.temporal.getCalendar().time.minutesPerHour);
  }

  static async #advanceDay() {
    await game.time.advance(CalendarEngine.secondsPerDay(this.service.temporal.getCalendar()));
  }

  static async #rewindDay() {
    await game.time.advance(-CalendarEngine.secondsPerDay(this.service.temporal.getCalendar()));
  }
}
