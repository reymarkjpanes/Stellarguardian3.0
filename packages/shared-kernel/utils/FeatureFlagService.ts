export interface FeatureFlagProvider {
  isEnabled(flag: string, context?: any): Promise<boolean>;
}

export class FeatureFlagService {
  constructor(private provider: FeatureFlagProvider) {}

  async isEnabled(flag: string, context?: any): Promise<boolean> {
    return this.provider.isEnabled(flag, context);
  }
}

// In-memory provider for now
export class MemoryFeatureFlagProvider implements FeatureFlagProvider {
  private flags = new Map<string, boolean>();

  setFlag(flag: string, enabled: boolean) {
    this.flags.set(flag, enabled);
  }

  async isEnabled(flag: string, context?: any): Promise<boolean> {
    return this.flags.get(flag) ?? false;
  }
}

export const defaultFeatureFlagService = new FeatureFlagService(new MemoryFeatureFlagProvider());
