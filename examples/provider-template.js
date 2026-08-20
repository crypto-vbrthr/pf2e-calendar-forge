/**
 * Calendar Forge external content provider template.
 * This file is documentation only and is not loaded by Calendar Forge.
 */
Hooks.once("calendarForgeReady", (api) => {
  api.providers.register({
    id: "example-setting-calendar",
    moduleId: "example-setting-calendar",
    namespace: "EXAMPLE_CALENDAR",
    schemaVersion: 4,
    contentVersion: "1.0.0",
    compatibility: { api: { min: 5, max: 5 }, schema: { min: 4, max: 4 } },
    checkI18n: true,

    calendars: [{
      id: "example-calendar",
      label: { i18n: "EXAMPLE_CALENDAR.Calendar.Name" },
      time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
      week: {
        days: [
          { id: "firstday", label: { i18n: "EXAMPLE_CALENDAR.Weekdays.First" }, shortLabel: { i18n: "EXAMPLE_CALENDAR.Weekdays.FirstShort" } }
        ]
      },
      months: [
        { id: "firstmonth", days: 30, label: { i18n: "EXAMPLE_CALENDAR.Months.First" }, shortLabel: { i18n: "EXAMPLE_CALENDAR.Months.FirstShort" } }
      ],
      leapYear: { type: "none" },
      defaultAnchor: { worldTime: 0, year: 1, monthId: "firstmonth", day: 1, hour: 0, minute: 0, second: 0, weekdayIndex: 0 }
    }],

    seasonProfiles: [],
    moonProfiles: [],
    regionProfiles: [],
    astronomyEvents: [],
    holidays: [],
    historicalEvents: [],

    defaults: { calendarId: "example-calendar" }
  });
});
