import type { ComponentMap } from './components';

export type Entity = number;
export type ComponentKey = keyof ComponentMap;

/** Component tuple matching a key tuple: ['transform', 'health'] -> [TransformComponent, HealthComponent]. */
type Components<K extends readonly ComponentKey[]> = {
  [I in keyof K]: ComponentMap[K[I] & ComponentKey];
};

/**
 * Sparse set: dense arrays for cache-friendly iteration, sparse index for O(1) lookup,
 * swap-remove for O(1) delete.
 */
export class SparseStore<T> {
  readonly entities: Entity[] = [];
  readonly values: T[] = [];
  private readonly sparse: number[] = [];
  onRemove?: (entity: Entity, value: T) => void;

  get size(): number {
    return this.entities.length;
  }

  has(entity: Entity): boolean {
    const i = this.sparse[entity];
    return i !== undefined && this.entities[i] === entity;
  }

  get(entity: Entity): T | undefined {
    return this.has(entity) ? this.values[this.sparse[entity]] : undefined;
  }

  set(entity: Entity, value: T): void {
    if (this.has(entity)) {
      this.values[this.sparse[entity]] = value;
      return;
    }
    this.sparse[entity] = this.entities.length;
    this.entities.push(entity);
    this.values.push(value);
  }

  delete(entity: Entity): boolean {
    if (!this.has(entity)) return false;
    const i = this.sparse[entity];
    const last = this.entities.length - 1;
    const removed = this.values[i];
    if (i !== last) {
      const moved = this.entities[last];
      this.entities[i] = moved;
      this.values[i] = this.values[last];
      this.sparse[moved] = i;
    }
    this.entities.pop();
    this.values.pop();
    this.onRemove?.(entity, removed);
    return true;
  }
}

export class World {
  private nextId = 0;
  private readonly free: Entity[] = [];
  private readonly alive = new Set<Entity>();
  private readonly doomed: Entity[] = [];
  private readonly stores = new Map<ComponentKey, SparseStore<unknown>>();

  get entityCount(): number {
    return this.alive.size;
  }

  /** Snapshot of every live entity id. */
  entities(): Entity[] {
    return [...this.alive];
  }

  create(): Entity {
    const entity = this.free.pop() ?? this.nextId++;
    this.alive.add(entity);
    return entity;
  }

  /** Deferred: the entity stays valid until `flush()`, so systems can destroy mid-iteration. */
  destroy(entity: Entity): void {
    this.doomed.push(entity);
  }

  /** Applies pending destroys. The game loop calls this after every fixed step. */
  flush(): void {
    for (const entity of this.doomed) {
      if (!this.alive.delete(entity)) continue;
      for (const store of this.stores.values()) store.delete(entity);
      this.free.push(entity);
    }
    this.doomed.length = 0;
  }

  store<K extends ComponentKey>(key: K): SparseStore<ComponentMap[K]> {
    let store = this.stores.get(key);
    if (!store) {
      store = new SparseStore<unknown>();
      this.stores.set(key, store);
    }
    return store as SparseStore<ComponentMap[K]>;
  }

  add<K extends ComponentKey>(entity: Entity, key: K, value: ComponentMap[K]): this {
    this.store(key).set(entity, value);
    return this;
  }

  get<K extends ComponentKey>(entity: Entity, key: K): ComponentMap[K] | undefined {
    return this.store(key).get(entity);
  }

  has(entity: Entity, key: ComponentKey): boolean {
    return this.store(key).has(entity);
  }

  remove(entity: Entity, key: ComponentKey): void {
    this.store(key).delete(entity);
  }

  /**
   * Calls `fn` for every entity that has all `keys`, iterating the smallest store.
   * Backwards iteration makes removing the current entity's components safe.
   */
  // ponytail: allocates two small arrays per call; cache the store list per system if GC shows up in profiles.
  each<const K extends readonly ComponentKey[]>(
    keys: K,
    fn: (entity: Entity, ...components: Components<K>) => void,
  ): void {
    const stores = keys.map((k) => this.store(k));
    let lead = stores[0];
    for (const s of stores) if (s.size < lead.size) lead = s;

    const comps: unknown[] = new Array(stores.length);
    for (let i = lead.size; i-- > 0; ) {
      if (i >= lead.size) continue; // fn removed more than the current entry
      const entity = lead.entities[i];
      let match = true;
      for (let j = 0; j < stores.length; j++) {
        const c = stores[j].get(entity);
        if (c === undefined) {
          match = false;
          break;
        }
        comps[j] = c;
      }
      if (match) fn(entity, ...(comps as unknown as Components<K>));
    }
  }
}
