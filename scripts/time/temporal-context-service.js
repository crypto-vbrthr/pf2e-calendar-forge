import { CalendarEngine } from "../calendar/calendar-engine.js";
import { formatCalendarDate, formatClock } from "../localization/date-formatter.js";
import { resolveLabel } from "../localization/label-resolver.js";

export class TemporalContextService {
  constructor({ calendarRegistry, seasonService, moonService, eventService, settings }) {
    this.calendars = calendarRegistry;
    this.seasons = seasonService;
    this.moons = moonService;
    this.events = eventService;
    this.settings = settings;
  }

  getCalendar(calendarId = null) {
    const id = calendarId ?? this.settings.activeCalendarId();
    return this.calendars.get(id) ?? this.calendars.list()[0] ?? null;
  }

  getAnchor(calendar) {
    return this.settings.anchor(calendar);
  }

  getDate({ worldTime = game.time.worldTime, calendarId = null } = {}) {
    const calendar = this.getCalendar(calendarId);
    if (!calendar) throw new Error("No Calendar Forge calendar is registered");
    return CalendarEngine.fromWorldTime(worldTime, calendar, this.getAnchor(calendar));
  }

  toWorldTime(date, { calendarId = null } = {}) {
    const calendar = this.getCalendar(calendarId);
    if (!calendar) throw new Error("No Calendar Forge calendar is registered");
    return CalendarEngine.toWorldTime(date, calendar, this.getAnchor(calendar));
  }

  async getTemporalContext({ worldTime = game.time.worldTime, calendarId = null, regionId = null } = {}) {
    const calendar = this.getCalendar(calendarId);
    if (!calendar) throw new Error("No Calendar Forge calendar is registered");
    const date = CalendarEngine.fromWorldTime(worldTime, calendar, this.getAnchor(calendar));
    const seasonProfileId = this.settings.activeSeasonProfileId();
    const moonProfileIds = this.settings.activeMoonProfileIds();
    const season = this.seasons.getState(date, calendar, seasonProfileId);
    const moons = this.moons.getStates(worldTime, calendar, moonProfileIds);
    const events = await this.events.getEventsForDate(date, { calendarId: calendar.id, regionId });

    return {
      worldTime,
      regionId,
      calendar: {
        id: calendar.id,
        label: resolveLabel(calendar.label, calendar.id),
        year: date.year,
        monthId: date.monthId,
        monthIndex: date.monthIndex,
        day: date.day,
        weekdayId: date.weekdayId,
        weekdayIndex: date.weekdayIndex,
        dayOfYear: date.dayOfYear,
        yearProgress: date.yearProgress
      },
      time: {
        hour: date.hour,
        minute: date.minute,
        second: date.second,
        dayProgress: (date.hour + date.minute / 60 + date.second / 3600) / (calendar.time?.hoursPerDay ?? 24)
      },
      season,
      moons,
      events,
      formatted: {
        date: formatCalendarDate(date, calendar),
        time: formatClock(date),
        dateTime: formatCalendarDate(date, calendar, { includeTime: true })
      },
      raw: { date }
    };
  }
}
