# Observability & Monitoring

To ensure Stellar Guardian 3.0 is operationally ready for production (Beta and beyond), the platform requires robust observability. We must know when workflows fail before our users report them.

## 1. Structured Logging
All backend services (Next.js API Routes, Server Actions, Background Jobs) must emit logs in a structured JSON format to allow indexing and querying.
- **Format:** JSON.
- **Required Fields:** `timestamp`, `level` (INFO, WARN, ERROR), `message`, `context`.
- **Correlation IDs:** Every incoming API request generates a unique `x-correlation-id`. This ID must be attached to all logs generated during that request's lifecycle, allowing traces across services.

## 2. Distributed Tracing & Metrics
- **Tools:** OpenTelemetry or Vercel Analytics / DataDog.
- **Metrics to Track:**
  - API Request Latency (p50, p90, p99).
  - Database Query execution times.
  - Rate limit exhaustion events.
  - Escrow transaction success/failure rates.
  - 4xx and 5xx error rates per endpoint.
- **N+1 Detection:** APM tools must alert if specific endpoints trigger excessive database queries.

## 3. Error Monitoring (Sentry)
- **Frontend & Backend Integration:** Sentry (or equivalent) will capture all unhandled exceptions.
- **Context:** Errors must include the User ID (if authenticated), Workspace ID, Request URL, and Correlation ID.
- **Alerting:** Critical errors (e.g., KMS decryption failures, Database connection drops) must trigger immediate alerts (Slack/PagerDuty).

## 4. Health Endpoints
- **Liveness Probe (`/api/health`):** Returns 200 OK if the Next.js server is running. Used by Vercel/Load balancers.
- **Readiness Probe (`/api/health/ready`):** Returns 200 OK only if the application can successfully connect to Supabase, Redis, and AWS KMS. Used to prevent routing traffic to degraded instances.

## 5. Audit Dashboards (Business Observability)
Technical logs are insufficient for Organizer and Admin support. The platform must provide:
- **Workspace Audit Trail:** A UI for organizers to see exactly who changed event states, joined teams, or modified settings. (Powered by the `audit_records` append-only table).
- **Admin Dashboard:** A high-level overview of platform health, total escrow locked, failed transactions, and active disputes.

## 6. Disaster Recovery & Backups
- **Database Backups:** Supabase Point-in-Time Recovery (PITR) must be enabled for production, allowing restoration to any specific minute.
- **Secret Recovery:** AWS KMS keys have strict rotation and backup policies managed via AWS IAM. Escrow recovery requires multi-signature admin overrides if automated disbursements fail permanently.
