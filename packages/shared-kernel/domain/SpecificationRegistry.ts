export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  toSql?(): { text: string; values: any[] };
}

export class SpecificationRegistry {
  private static instance: SpecificationRegistry;
  private readonly registries = new Map<string, any>();

  private constructor() {}

  public static getInstance(): SpecificationRegistry {
    if (!SpecificationRegistry.instance) {
      SpecificationRegistry.instance = new SpecificationRegistry();
    }
    return SpecificationRegistry.instance;
  }

  public register(name: string, spec: any): void {
    this.registries.set(name, spec);
  }

  public get(name: string): any {
    return this.registries.get(name);
  }
}
