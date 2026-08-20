import { resolveLabel } from "../localization/label-resolver.js";

export class RegionService {
  constructor({ regionRegistry, settings }) {
    this.registry = regionRegistry;
    this.settings = settings;
  }

  resolve(options = {}) {
    const explicitlySpecified = Object.prototype.hasOwnProperty.call(options, "regionId");
    const requestedId = explicitlySpecified ? options.regionId : this.settings.defaultRegionId();
    if (requestedId == null || requestedId === "") return null;
    return this.registry.get(requestedId) ?? null;
  }

  decorate(region) {
    if (!region) return null;
    return {
      ...region,
      label: resolveLabel(region.label, region.id),
      timeOffsetSeconds: Number(region.timeOffsetSeconds ?? 0),
      moonProfileIds: [...(region.moonProfileIds ?? [])]
    };
  }

  listDecorated() {
    return this.registry.list().map((region) => this.decorate(region));
  }
}
