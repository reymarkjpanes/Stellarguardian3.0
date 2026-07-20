export interface MetricsProvider {
  increment(metricName: string, tags?: Record<string, string>): void;
  gauge(metricName: string, value: number, tags?: Record<string, string>): void;
  timing(metricName: string, valueMs: number, tags?: Record<string, string>): void;
}

export class MetricsService {
  constructor(private provider: MetricsProvider) {}

  increment(metricName: string, tags?: Record<string, string>): void {
    this.provider.increment(metricName, tags);
  }

  gauge(metricName: string, value: number, tags?: Record<string, string>): void {
    this.provider.gauge(metricName, value, tags);
  }

  timing(metricName: string, valueMs: number, tags?: Record<string, string>): void {
    this.provider.timing(metricName, valueMs, tags);
  }
}

// Console provider for basic logging
export class ConsoleMetricsProvider implements MetricsProvider {
  increment(metricName: string, tags?: Record<string, string>): void {
    console.log(`[Metric] INCREMENT ${metricName}`, tags || {});
  }

  gauge(metricName: string, value: number, tags?: Record<string, string>): void {
    console.log(`[Metric] GAUGE ${metricName} = ${value}`, tags || {});
  }

  timing(metricName: string, valueMs: number, tags?: Record<string, string>): void {
    console.log(`[Metric] TIMING ${metricName} = ${valueMs}ms`, tags || {});
  }
}

export const defaultMetricsService = new MetricsService(new ConsoleMetricsProvider());
