export interface Logger {
  info(event: string, context: Record<string, unknown>): void;
  error(event: string, error: Error, context?: Record<string, unknown>): void;
  warn(event: string, context: Record<string, unknown>): void;
  debug(event: string, context: Record<string, unknown>): void;
}

export interface Metrics {
  increment(metricName: string, value?: number, tags?: Record<string, string>): void;
  gauge(metricName: string, value: number, tags?: Record<string, string>): void;
  histogram(metricName: string, value: number, tags?: Record<string, string>): void;
}

export interface AuditLog {
  action: string;
  actorId: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export interface Auditor {
  log(auditLog: AuditLog): Promise<void>;
}

export interface Tracer {
  startSpan(name: string, tags?: Record<string, string>): { end: () => void, addTag: (key: string, value: string) => void };
}
