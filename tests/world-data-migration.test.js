import test from "node:test";
import assert from "node:assert/strict";
import { DefinitionRegistry } from "../scripts/registry/registry.js";
import { WorldDataRepository } from "../scripts/storage/world-data-repository.js";

const calendar = {
  id: "old-world-calendar",
  label: { value: "Old" },
  time: { secondsPerMinute: 60, minutesPerHour: 60, hoursPerDay: 24 },
  week: { days: [{ id: "day" }] },
  months: [{ id: "month", days: 30 }],
  leapYear: { type: "none" }
};

globalThis.game = {
  settings: {
    get: () => ({ calendars: [calendar], regions: [], anchors: {} }),
    set: async () => {}
  }
};
globalThis.Hooks = { callAll() {} };

test("0.2.x world data loads with empty 0.3 arrays", async () => {
  const calendars = new DefinitionRegistry("calendar");
  const regions = new DefinitionRegistry("region");
  const seasons = new DefinitionRegistry("season");
  const moons = new DefinitionRegistry("moon");
  const astronomy = new DefinitionRegistry("astronomy");
  const repo = new WorldDataRepository({ calendarRegistry: calendars, regionRegistry: regions, seasonRegistry: seasons, moonRegistry: moons, astronomyRegistry: astronomy });
  await repo.load();
  assert.equal(calendars.has("old-world-calendar"), true);
  assert.deepEqual(repo.data.seasonProfiles, []);
  assert.deepEqual(repo.data.moonProfiles, []);
  assert.deepEqual(repo.data.astronomyEvents, []);
});
