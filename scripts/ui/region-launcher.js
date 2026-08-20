/**
 * Register the Calendar Forge launcher in Foundry VTT 14's Scene Regions
 * control palette. The Regions layer is the intended entry point for the
 * calendar UI; Calendar Forge itself continues to run as a background service
 * while the application window is closed.
 */
export function installRegionLauncher(openCalendar) {
  Hooks.on("getSceneControlButtons", (controls) => {
    const regionControl = findRegionControl(controls);
    if (!regionControl?.tools) return;
    if (regionControl.tools.calendarForge) return;

    const orders = Object.values(regionControl.tools)
      .map((tool) => Number(tool?.order))
      .filter(Number.isFinite);

    regionControl.tools.calendarForge = {
      name: "calendarForge",
      title: "CALENDAR_FORGE.Actions.Open",
      icon: "fa-solid fa-calendar-days",
      order: (orders.length ? Math.max(...orders) : 0) + 1,
      button: true,
      visible: true,
      onChange: () => openCalendar()
    };
  });
}

/**
 * Resolve the Regions SceneControl defensively. Core currently exposes it as
 * controls.regions, but checking the configured name/layer makes the launcher
 * resilient to derived control collections.
 */
export function findRegionControl(controls) {
  if (!controls || typeof controls !== "object") return null;
  if (controls.regions) return controls.regions;

  return Object.values(controls).find((control) => {
    if (!control || typeof control !== "object") return false;
    const name = String(control.name ?? "").toLowerCase();
    const layer = String(control.layer ?? "").toLowerCase();
    return name === "regions"
      || layer === "regions"
      || layer === "regionlayer"
      || layer.endsWith(".regionlayer");
  }) ?? null;
}
