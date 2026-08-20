import test from "node:test";
import assert from "node:assert/strict";
import { findRegionControl, installRegionLauncher } from "../scripts/ui/region-launcher.js";

test("findRegionControl resolves the canonical regions control", () => {
  const regions = { name: "regions", tools: {} };
  assert.equal(findRegionControl({ regions }), regions);
});

test("launcher is added to the Scene Regions tool palette", () => {
  const listeners = new Map();
  globalThis.Hooks = {
    on(name, callback) {
      listeners.set(name, callback);
    }
  };

  let opened = 0;
  installRegionLauncher(() => { opened += 1; });

  const callback = listeners.get("getSceneControlButtons");
  assert.equal(typeof callback, "function");

  const controls = {
    tokens: { name: "tokens", tools: {} },
    regions: {
      name: "regions",
      layer: "regions",
      tools: {
        select: { name: "select", order: 10 },
        rectangle: { name: "rectangle", order: 20 }
      }
    }
  };

  callback(controls);
  const tool = controls.regions.tools.calendarForge;
  assert.ok(tool);
  assert.equal(tool.button, true);
  assert.equal(tool.visible, true);
  assert.equal(tool.order, 21);
  assert.equal(tool.title, "CALENDAR_FORGE.Actions.Open");

  tool.onChange();
  assert.equal(opened, 1);

  // Re-running control preparation must not duplicate or replace the tool.
  const original = tool;
  callback(controls);
  assert.equal(controls.regions.tools.calendarForge, original);
});
