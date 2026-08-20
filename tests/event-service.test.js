import test from "node:test";
import assert from "node:assert/strict";
import { DefinitionRegistry } from "../scripts/registry/registry.js";
import { EventService } from "../scripts/events/event-service.js";

const calendar = {
  id: "tiny",
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
  week: { days: [{ id: "d" }] },
  months: [{ id: "one", days: 3 }, { id: "two", days: 3 }],
  leapYear: { type: "none" }
};

globalThis.game = {
  user: { isGM: true },
  i18n: {
    localize: (key) => key,
    format: (key, data) => `${key}:${data.day ?? ""}/${data.duration ?? ""}`
  }
};

function service() {
  const holidays = new DefinitionRegistry("holiday");
  const historical = new DefinitionRegistry("historical");
  return { holidays, historical, events: new EventService({ holidayRegistry: holidays, historicalRegistry: historical }) };
}

test("multi-day yearly holiday continues across the year boundary", async () => {
  const { holidays, events } = service();
  holidays.register({
    id: "turning",
    calendarId: "tiny",
    label: { value: "Turning" },
    recurrence: { type: "yearly", monthId: "two", day: 3 },
    durationDays: 3,
    visibility: "public"
  });

  const matches = await events.getEventsForDate({ year: 2, monthId: "one", day: 2 }, { calendarId: "tiny", calendar, regionId: null });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].dayOfFestival, 3);
  assert.equal(matches[0].durationDays, 3);
});

test("historical year-only events appear in chronicle but not on an invented day", async () => {
  const { historical, events } = service();
  historical.register({
    id: "founding",
    calendarId: "tiny",
    label: { value: "Founding" },
    precision: "year",
    date: { year: 4 },
    visibility: "public"
  });

  const day = await events.getEventsForDate({ year: 4, monthId: "one", day: 1 }, { calendarId: "tiny", calendar, regionId: null });
  assert.equal(day.length, 0);
  const chronicle = await events.getChronicle({ calendar, fromYear: 3, toYear: 5, eventType: "historical" });
  assert.equal(chronicle.length, 1);
  assert.equal(chronicle[0].precision, "year");
  assert.equal(chronicle[0].date.monthId, null);
});

test("chronicle expands yearly holidays into occurrences inside the requested range", async () => {
  const { holidays, events } = service();
  holidays.register({
    id: "market-day",
    calendarId: "tiny",
    label: { value: "Market Day" },
    recurrence: { type: "yearly", monthId: "one", day: 2 },
    durationDays: 1,
    visibility: "public"
  });
  const chronicle = await events.getChronicle({ calendar, fromYear: 10, toYear: 12, eventType: "holiday" });
  assert.deepEqual(chronicle.map((entry) => entry.date.year), [10, 11, 12]);
});

test("event providers can supply campaign chronicle entries", async () => {
  const { events } = service();
  events.registerProvider("campaign-forge", async ({ type }) => type === "chronicle" ? [{
    id: "quest-complete",
    calendarId: "tiny",
    sourceType: "campaign",
    label: { value: "Quest complete" },
    precision: "day",
    date: { year: 7, monthId: "one", day: 1 }
  }] : []);
  const entries = await events.getChronicle({ calendar, fromYear: 7, toYear: 7, eventType: "campaign" });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceType, "campaign");
});

test("chronicle providers may return canonical worldTime instead of a calendar date", async () => {
  const { events } = service();
  events.registerProvider("worldtime-provider", async ({ type }) => type === "chronicle" ? [{
    id: "instant",
    sourceType: "campaign",
    label: { value: "Instant" },
    worldTime: 1234
  }] : []);
  const entries = await events.getChronicle({
    calendar,
    fromYear: 8,
    toYear: 8,
    eventType: "campaign",
    context: { dateFromWorldTime: () => ({ year: 8, monthId: "two", day: 2, hour: 3, minute: 4, second: 5 }) }
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].precision, "second");
  assert.equal(entries[0].date.monthId, "two");
});
