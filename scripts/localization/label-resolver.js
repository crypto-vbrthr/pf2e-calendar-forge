export function resolveLabel(label, fallback = "") {
  if (label == null) return fallback;
  if (typeof label === "string") return label;
  if (typeof label.value === "string") return label.value;
  if (typeof label.i18n === "string") {
    const localized = game.i18n.localize(label.i18n);
    return localized === label.i18n && label.fallback ? label.fallback : localized;
  }
  return fallback;
}

export function interpolateFormat(format, values) {
  return String(format).replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => values[key] ?? "");
}
