export interface RequestContext {
  user: {
    id: string;
    role: string;
    permissions: string[];
  };
  workspaceId?: string;
  eventId?: string;
  teamId?: string;
  
  requestId: string;
  correlationId: string;
  traceId: string;
  
  ip?: string;
  userAgent?: string;
  locale?: string;
  timezone?: string;
  
  timestamp: string; // ISO 8601
  sessionId?: string;
  deviceId?: string;
  platform?: string;
  featureFlags?: Record<string, boolean>;
}
