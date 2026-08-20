import { resolveLabel } from "../localization/label-resolver.js";

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export class MoonService {
  constructor(moonRegistry) {
    this.registry = moonRegistry;
  }

  getStates(worldTime, calendar, profileIds = []) {
    const secondsPerDay = (calendar.time?.secondsPerMinute ?? 60)
      * (calendar.time?.minutesPerHour ?? 60)
      * (calendar.time?.hoursPerDay ?? 24);

    return profileIds
      .map((id) => this.registry.get(id))
      .filter((profile) => profile && (!profile.calendarId || profile.calendarId === calendar.id))
      .map((profile) => {
      const cycleSeconds = Number(profile.cycleLengthDays) * secondsPerDay;
      const elapsed = Number(worldTime) - Number(profile.referenceWorldTime ?? 0);
      const progress = mod(Number(profile.referenceProgress ?? 0) + elapsed / cycleSeconds, 1);
      const phases = [...(profile.phases ?? [])].sort((a, b) => Number(a.start) - Number(b.start));
      let active = phases[0] ?? { id: "unknown", start: 0 };
      for (const phase of phases) {
        if (progress >= Number(phase.start)) active = phase;
      }
      const illumination = (1 - Math.cos(progress * Math.PI * 2)) / 2;
      return {
        id: profile.id,
        label: resolveLabel(profile.label, profile.id),
        phase: active.id,
        phaseLabel: resolveLabel(active.label, active.id),
        icon: active.icon ?? "fa-moon",
        progress,
        illumination
      };
    });
  }
}
