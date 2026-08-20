export class DefinitionRegistry {
  #items = new Map();

  constructor(kind) {
    this.kind = kind;
  }

  register(definition, { replace = false } = {}) {
    if (!definition?.id) throw new TypeError(`${this.kind} definition requires an id`);
    if (this.#items.has(definition.id) && !replace) {
      throw new Error(`${this.kind} '${definition.id}' is already registered`);
    }
    const frozen = Object.freeze(structuredClone(definition));
    this.#items.set(definition.id, frozen);
    return frozen;
  }

  unregister(id) {
    return this.#items.delete(id);
  }

  get(id) {
    return this.#items.get(id) ?? null;
  }

  has(id) {
    return this.#items.has(id);
  }

  list() {
    return [...this.#items.values()];
  }
}
