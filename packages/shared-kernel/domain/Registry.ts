export class Registry<T> {
  private readonly items = new Map<string, T>();

  public register(name: string, item: T): void {
    if (this.items.has(name)) {
      console.warn(`[Registry] Overwriting existing item: ${name}`);
    }
    this.items.set(name, item);
  }

  public get(name: string): T {
    const item = this.items.get(name);
    if (!item) {
      throw new Error(`[Registry] Item not found: ${name}`);
    }
    return item;
  }

  public getAll(): Map<string, T> {
    return new Map(this.items);
  }
}
