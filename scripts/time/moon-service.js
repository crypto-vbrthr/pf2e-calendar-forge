import { CalendarEngine } from "../calendar/calendar-engine.js";
import { resolveLabel } from "../localization/label-resolver.js";

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function majorPhaseMarker(phase) {
  if (typeof phase.marker === "boolean") return phase.marker;
  return ["new", "first-quarter", "full", "last-quarter"].includes(phase.id);
}

export class MoonService {
  constructor(moonRegistry) {
    this.registry = moonRegistry;
  }

  #secondsPerDay(calendar) {
    return (calendar.time?.secondsPerMinute ?? 60)
      * (calendar.time?.minutesPerHour ?? 60)
      * (calendar.time?.hoursPerDay ?? 24);
  }

  #referenceWorldTime(profile, calendar, anchor = null) {
    if (profile.referenceDate && anchor) {
      return CalendarEngine.toWorldTime({
        year: Number(profile.referenceDate.year),
        monthId: profile.referenceDate.monthId,
        day: Number(profile.referenceDate.day),
        hour: Number(profile.referenceDate.hour ?? 0),
        minute: Number(profile.referenceDate.minute ?? 0),
        second: Number(profile.referenceDate.second ?? 0)
      }, calendar, anchor);
    }
    return Number(profile.referenceWorldTime ?? 0);
  }

  #profileState(profile, worldTime, calendar, anchor = null) {
    const cycleDays = Number(profile.cycleLengthDays);
    const cycleSeconds = cycleDays * this.#secondsPerDay(calendar);
    const referenceWorldTime = this.#referenceWorldTime(profile, calendar, anchor);
    const elapsed = Number(worldTime) - referenceWorldTime;
    const progress = mod(Number(profile.referenceProgress ?? 0) + elapsed / cycleSeconds, 1);
    const phases = [...(profile.phases ?? [])].sort((a, b) => Number(a.start) - Number(b.start));
    let activeIndex = 0;
    for (let index = 0; index < phases.length; index += 1) {
      if (progress >= Number(phases[index].start)) activeIndex = index;
    }
    const active = phases[activeIndex] ?? { id: "unknown", start: 0 };
    const next = phases[(activeIndex + 1) % phases.length] ?? active;
    const distance = mod(Number(next.start ?? 0) - progress, 1);
    const illumination = (1 - Math.cos(progress * Math.PI * 2)) / 2;
    return {
      id: profile.id,
      label: resolveLabel(profile.label, profile.id),
      phase: active.id,
      phaseLabel: resolveLabel(active.label, active.id),
      icon: active.icon ?? "fa-moon",
      progress,
      illumination,
      ageDays: progress * cycleDays,
      cycleLengthDays: cycleDays,
      nextPhase: next.id,
      nextPhaseLabel: resolveLabel(next.label, next.id),
      daysUntilNextPhase: distance * cycleDays
    };
  }

  getStates(worldTime, calendar, profileIds = [], { anchor = null } = {}) {
    return profileIds
      .map((id) => this.registry.get(id))
      .filter((profile) => profile && (!profile.calendarId || profile.calendarId === calendar.id))
      .map((profile) => this.#profileState(profile, worldTime, calendar, anchor));
  }

  getTransitionsBetween(startWorldTime, endWorldTime, calendar, profileIds = [], { markersOnly = false, anchor = null } = {}) {
    let start = Number(startWorldTime);
    let end = Number(endWorldTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return [];
    if (start > end) [start, end] = [end, start];

    const secondsPerDay = this.#secondsPerDay(calendar);
    const transitions = [];
    for (const id of profileIds) {
      const profile = this.registry.get(id);
      if (!profile || (profile.calendarId && profile.calendarId !== calendar.id)) continue;
      const cycleSeconds = Number(profile.cycleLengthDays) * secondsPerDay;
      if (!(cycleSeconds > 0)) continue;
      const referenceWorldTime = this.#referenceWorldTime(profile, calendar, anchor);
      const referenceProgress = Number(profile.referenceProgress ?? 0);
      const phases = [...(profile.phases ?? [])].sort((a, b) => Number(a.start) - Number(b.start));
      for (const phase of phases) {
        if (markersOnly && !majorPhaseMarker(phase)) continue;
        const offsetCycles = Number(phase.start) - referenceProgress;
        const base = referenceWorldTime + offsetCycles * cycleSeconds;
        const firstCycle = Math.ceil((start - base) / cycleSeconds);
        let occurrence = base + firstCycle * cycleSeconds;
        while (occurrence < end) {
          if (occurrence >= start) {
            transitions.push({
              type: "moon-phase",
              moonId: profile.id,
              phase: phase.id,
              label: `${resolveLabel(profile.label, profile.id)}: ${resolveLabel(phase.label, phase.id)}`,
              icon: phase.icon ?? "fa-moon",
              worldTime: occurrence,
              marker: majorPhaseMarker(phase)
            });
          }
          occurrence += cycleSeconds;
        }
      }
    }
    return transitions.sort((a, b) => a.worldTime - b.worldTime);
  }
}
