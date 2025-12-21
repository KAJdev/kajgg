export type Listener<Args extends unknown[]> = (...args: Args) => void;

export class TypedEmitter<Events extends Record<string, unknown[]>> {
  private listeners: Map<keyof Events & string, Set<Listener<any>>> = new Map();

  on<K extends keyof Events & string>(event: K, listener: Listener<Events[K]>): this {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as Listener<any>);
    this.listeners.set(event, set);
    return this;
  }

  once<K extends keyof Events & string>(event: K, listener: Listener<Events[K]>): this {
    const wrapped: Listener<Events[K]> = ((...args: Events[K]) => {
      this.off(event, wrapped);
      listener(...args);
    }) as Listener<Events[K]>;
    return this.on(event, wrapped);
  }

  off<K extends keyof Events & string>(event: K, listener: Listener<Events[K]>): this {
    const set = this.listeners.get(event);
    if (set) set.delete(listener as Listener<any>);
    return this;
  }

  emit<K extends keyof Events & string>(event: K, ...args: Events[K]): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const l of [...set]) {
      try {
        (l as Listener<any>)(...args);
      } catch {
        // ignore handler exceptions so one bad listener doesn't brick the client
      }
    }
    return true;
  }
}


