import { CalendarEngine } from "../calendar/calendar-engine.js";
import { formatCalendarDate, formatClock, formatPrecisionTime } from "../localization/date-formatter.js";
import { resolveLabel } from "../localization/label-resolver.js";

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export class TemporalContextService {
  constructor({ calendarRegistry, seasonService, moonService, astronomyService, eventService, regionService, settings, worldData }) {
    this.calendars = calendarRegistry;
    this.seasons = seasonService;
    this.moons = moonService;
    this.astronomy = astronomyService;
    this.events = eventService;
    this.regions = regionService;
    this.settings = settings;
    this.worldData = worldData;
  }

  resolve(options = {}) {
    const region = this.regions.resolve(options);
    const requestedCalendarId = hasOwn(options, "calendarId") && options.calendarId
      ? options.calendarId
      : region?.calendarId ?? this.settings.activeCalendarId();
    const calendar = this.calendars.get(requestedCalendarId) ?? this.calendars.list()[0] ?? null;
    if (!calendar) return { calendar: null, region };

    const seasonProfileId = hasOwn(options, "seasonProfileId")
      ? options.seasonProfileId
      : region?.seasonProfileId ?? this.settings.activeSeasonProfileId();
    const moonProfileIds = hasOwn(options, "moonProfileIds")
      ? [...(options.moonProfileIds ?? [])]
      : region?.moonProfileIds?.length
        ? [...region.moonProfileIds]
        : this.settings.activeMoonProfileIds();

    return {
      calendar,
      region,
      timeOffsetSeconds: Number(region?.timeOffsetSeconds ?? 0),
      seasonProfileId: seasonProfileId || null,
      moonProfileIds
    };
  }

  getCalendar(calendarId = null, options = {}) {
    if (calendarId) return this.calendars.get(calendarId) ?? null;
    return this.resolve(options).calendar;
  }

  getAnchor(calendar) {
    const stored = this.worldData.getAnchor(calendar.id);
    if (stored) return stored;
    if (calendar.id === "earth-gregorian") return this.settings.legacyAnchor(calendar);
    if (calendar.defaultAnchor) return structuredClone(calendar.defaultAnchor);
    if (calendar.id === this.settings.activeCalendarId()) return this.settings.legacyAnchor(calendar);
    return {
      worldTime: 0,
      year: 1,
      monthId: calendar.months[0]?.id,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      weekdayIndex: 0
    };
  }

  getDate(options = {}) {
    const worldTime = hasOwn(options, "worldTime") ? Number(options.worldTime) : Number(game.time.worldTime);
    const resolved = this.resolve(options);
    if (!resolved.calendar) throw new Error("No Calendar Forge calendar is registered");
    const localWorldTime = worldTime + resolved.timeOffsetSeconds;
    return CalendarEngine.fromWorldTime(localWorldTime, resolved.calendar, this.getAnchor(resolved.calendar));
  }

  toWorldTime(date, options = {}) {
    const resolved = this.resolve(options);
    if (!resolved.calendar) throw new Error("No Calendar Forge calendar is registered");
    const localWorldTime = CalendarEngine.toWorldTime(date, resolved.calendar, this.getAnchor(resolved.calendar));
    return localWorldTime - resolved.timeOffsetSeconds;
  }

  async getTemporalContext(options = {}) {
    const worldTime = hasOwn(options, "worldTime") ? Number(options.worldTime) : Number(game.time.worldTime);
    const resolved = this.resolve(options);
    const calendar = resolved.calendar;
    if (!calendar) throw new Error("No Calendar Forge calendar is registered");

    const localWorldTime = worldTime + resolved.timeOffsetSeconds;
    const anchor = this.getAnchor(calendar);
    const date = CalendarEngine.fromWorldTime(localWorldTime, calendar, anchor);
    const season = this.seasons.getState(date, calendar, resolved.seasonProfileId);
    const moons = this.moons.getStates(worldTime, calendar, resolved.moonProfileIds, { anchor });
    const regionId = resolved.region?.id ?? null;

    const dayStartWorldTime = this.toWorldTime({
      year: date.year,
      monthId: date.monthId,
      day: date.day,
      hour: 0,
      minute: 0,
      second: 0
    }, options);
    const dayEndWorldTime = dayStartWorldTime + CalendarEngine.secondsPerDay(calendar);
    const events = await this.events.getEventsForDate(date, {
      calendarId: calendar.id,
      regionId,
      calendar,
      dayStartWorldTime,
      dayEndWorldTime
    });
    const astronomicalEvents = this.astronomy?.getEventsForDate(date, {
      calendar,
      regionId,
      dayStartWorldTime,
      dayEndWorldTime
    }) ?? [];
    const moonTransitions = this.moons.getTransitionsBetween?.(
      dayStartWorldTime,
      dayEndWorldTime,
      calendar,
      resolved.moonProfileIds,
      { markersOnly: true, anchor }
    ) ?? [];

    for (const event of astronomicalEvents) {
      if (event.worldTime != null) {
        const localDate = this.getDate({ ...options, worldTime: event.worldTime });
        event.formattedTime = formatClock(localDate, calendar);
      }
    }
    for (const transition of moonTransitions) {
      const localDate = this.getDate({ ...options, worldTime: transition.worldTime });
      transition.formattedTime = formatClock(localDate, calendar);
    }
    for (const event of events) {
      if (event.worldTime != null && Number.isFinite(Number(event.worldTime))) {
        const localDate = this.getDate({ ...options, worldTime: Number(event.worldTime) });
        event.formattedTime = formatClock(localDate, calendar);
      } else if (event.type === "historical" && ["hour", "minute", "second"].includes(event.precision)) {
        event.formattedTime = formatPrecisionTime(event.date ?? {}, event.precision, calendar);
        if (event.precision === "hour") event.formattedTime += ` ${game.i18n.localize("CALENDAR_FORGE.Chronicle.HourSuffix")}`;
      }
    }

    const secondsPerDay = CalendarEngine.secondsPerDay(calendar);
    const secondsPerHour = CalendarEngine.secondsPerHour(calendar);
    const secondsPerMinute = CalendarEngine.secondsPerMinute(calendar);
    const timeSeconds = date.hour * secondsPerHour + date.minute * secondsPerMinute + date.second;

    return {
      worldTime,
      localWorldTime,
      region: resolved.region ? {
        id: resolved.region.id,
        label: resolveLabel(resolved.region.label, resolved.region.id),
        timeOffsetSeconds: resolved.timeOffsetSeconds
      } : null,
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
        dayProgress: secondsPerDay > 0 ? timeSeconds / secondsPerDay : 0,
        offsetSeconds: resolved.timeOffsetSeconds
      },
      season,
      moons,
      moonTransitions,
      astronomicalEvents,
      events,
      profiles: {
        seasonProfileId: resolved.seasonProfileId,
        moonProfileIds: [...resolved.moonProfileIds]
      },
      formatted: {
        date: formatCalendarDate(date, calendar),
        time: formatClock(date, calendar),
        dateTime: formatCalendarDate(date, calendar, { includeTime: true })
      },
      raw: { date, calendar, region: resolved.region }
    };
  }
}
