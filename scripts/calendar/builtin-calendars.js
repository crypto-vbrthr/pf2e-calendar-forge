export const BUILTIN_CALENDARS = [
  {
    id: "earth-gregorian",
    providerId: "calendar-forge-core",
    schemaVersion: 1,
    label: { i18n: "CALENDAR_FORGE.Calendars.Gregorian" },
    description: { i18n: "CALENDAR_FORGE.Calendars.GregorianDescription" },
    era: { i18n: "CALENDAR_FORGE.Eras.CE" },
    time: {
      secondsPerMinute: 60,
      minutesPerHour: 60,
      hoursPerDay: 24
    },
    week: {
      days: [
        { id: "monday", label: { i18n: "CALENDAR_FORGE.Weekdays.Monday" }, shortLabel: { i18n: "CALENDAR_FORGE.Weekdays.MondayShort" } },
        { id: "tuesday", label: { i18n: "CALENDAR_FORGE.Weekdays.Tuesday" }, shortLabel: { i18n: "CALENDAR_FORGE.Weekdays.TuesdayShort" } },
        { id: "wednesday", label: { i18n: "CALENDAR_FORGE.Weekdays.Wednesday" }, shortLabel: { i18n: "CALENDAR_FORGE.Weekdays.WednesdayShort" } },
        { id: "thursday", label: { i18n: "CALENDAR_FORGE.Weekdays.Thursday" }, shortLabel: { i18n: "CALENDAR_FORGE.Weekdays.ThursdayShort" } },
        { id: "friday", label: { i18n: "CALENDAR_FORGE.Weekdays.Friday" }, shortLabel: { i18n: "CALENDAR_FORGE.Weekdays.FridayShort" } },
        { id: "saturday", label: { i18n: "CALENDAR_FORGE.Weekdays.Saturday" }, shortLabel: { i18n: "CALENDAR_FORGE.Weekdays.SaturdayShort" } },
        { id: "sunday", label: { i18n: "CALENDAR_FORGE.Weekdays.Sunday" }, shortLabel: { i18n: "CALENDAR_FORGE.Weekdays.SundayShort" } }
      ]
    },
    months: [
      { id: "january", days: 31, label: { i18n: "CALENDAR_FORGE.Months.January" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.JanuaryShort" } },
      { id: "february", days: 28, leapDays: 1, label: { i18n: "CALENDAR_FORGE.Months.February" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.FebruaryShort" } },
      { id: "march", days: 31, label: { i18n: "CALENDAR_FORGE.Months.March" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.MarchShort" } },
      { id: "april", days: 30, label: { i18n: "CALENDAR_FORGE.Months.April" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.AprilShort" } },
      { id: "may", days: 31, label: { i18n: "CALENDAR_FORGE.Months.May" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.MayShort" } },
      { id: "june", days: 30, label: { i18n: "CALENDAR_FORGE.Months.June" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.JuneShort" } },
      { id: "july", days: 31, label: { i18n: "CALENDAR_FORGE.Months.July" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.JulyShort" } },
      { id: "august", days: 31, label: { i18n: "CALENDAR_FORGE.Months.August" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.AugustShort" } },
      { id: "september", days: 30, label: { i18n: "CALENDAR_FORGE.Months.September" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.SeptemberShort" } },
      { id: "october", days: 31, label: { i18n: "CALENDAR_FORGE.Months.October" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.OctoberShort" } },
      { id: "november", days: 30, label: { i18n: "CALENDAR_FORGE.Months.November" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.NovemberShort" } },
      { id: "december", days: 31, label: { i18n: "CALENDAR_FORGE.Months.December" }, shortLabel: { i18n: "CALENDAR_FORGE.Months.DecemberShort" } }
    ],
    leapYear: { type: "gregorian" },
    dateFormats: {
      date: { i18n: "CALENDAR_FORGE.Formats.Date" },
      dateTime: { i18n: "CALENDAR_FORGE.Formats.DateTime" }
    }
  }
];

export const BUILTIN_SEASON_PROFILES = [
  {
    id: "earth-northern-temperate",
    providerId: "calendar-forge-core",
    calendarId: "earth-gregorian",
    label: { i18n: "CALENDAR_FORGE.SeasonProfiles.NorthernTemperate" },
    seasons: [
      { id: "spring", monthId: "march", day: 1, label: { i18n: "CALENDAR_FORGE.Seasons.Spring" }, icon: "fa-seedling" },
      { id: "summer", monthId: "june", day: 1, label: { i18n: "CALENDAR_FORGE.Seasons.Summer" }, icon: "fa-sun" },
      { id: "autumn", monthId: "september", day: 1, label: { i18n: "CALENDAR_FORGE.Seasons.Autumn" }, icon: "fa-leaf" },
      { id: "winter", monthId: "december", day: 1, label: { i18n: "CALENDAR_FORGE.Seasons.Winter" }, icon: "fa-snowflake" }
    ]
  }
];

export const BUILTIN_MOON_PROFILES = [
  {
    id: "earth-luna",
    providerId: "calendar-forge-core",
    calendarId: "earth-gregorian",
    label: { i18n: "CALENDAR_FORGE.Moons.Moon" },
    cycleLengthDays: 29.530588,
    referenceWorldTime: 0,
    referenceProgress: 0,
    phases: [
      { id: "new", start: 0.0000, label: { i18n: "CALENDAR_FORGE.MoonPhases.New" }, icon: "fa-circle" },
      { id: "waxing-crescent", start: 0.0625, label: { i18n: "CALENDAR_FORGE.MoonPhases.WaxingCrescent" }, icon: "fa-moon" },
      { id: "first-quarter", start: 0.1875, label: { i18n: "CALENDAR_FORGE.MoonPhases.FirstQuarter" }, icon: "fa-circle-half-stroke" },
      { id: "waxing-gibbous", start: 0.3125, label: { i18n: "CALENDAR_FORGE.MoonPhases.WaxingGibbous" }, icon: "fa-moon" },
      { id: "full", start: 0.4375, label: { i18n: "CALENDAR_FORGE.MoonPhases.Full" }, icon: "fa-circle" },
      { id: "waning-gibbous", start: 0.5625, label: { i18n: "CALENDAR_FORGE.MoonPhases.WaningGibbous" }, icon: "fa-moon" },
      { id: "last-quarter", start: 0.6875, label: { i18n: "CALENDAR_FORGE.MoonPhases.LastQuarter" }, icon: "fa-circle-half-stroke" },
      { id: "waning-crescent", start: 0.8125, label: { i18n: "CALENDAR_FORGE.MoonPhases.WaningCrescent" }, icon: "fa-moon" }
    ]
  }
];
