import { sql } from "@/src/shared/kernel/database";

export interface IdempotencyRecord {
  key: string;
  userId: string;
  route: string;
  requestHash: string;
  response: unknown;
  statusCode: number;
}

export class IdempotencyService {
  async getRecord(key: string, userId: string): Promise<IdempotencyRecord | null> {
    const rows = await sql`
      SELECT key, user_id, route, request_hash, response, status_code
      FROM idempotency_keys
      WHERE key = ${key} AND user_id = ${userId} AND expires_at > NOW()
    `;

    if (rows.length === 0) return null;

    const row = rows[0];
    if (!row) return null;
    return {
      key: row.key,
      userId: row.user_id,
      route: row.route,
      requestHash: row.request_hash,
      response: row.response,
      statusCode: row.status_code,
    };
  }

  async saveRecord(record: IdempotencyRecord, ttlSeconds: number = 86400): Promise<void> {
    await sql`
      INSERT INTO idempotency_keys (
        key, user_id, route, request_hash, response, status_code, expires_at
      ) VALUES (
        ${record.key}, 
        ${record.userId}, 
        ${record.route}, 
        ${record.requestHash}, 
        ${record.response}, 
        ${record.statusCode}, 
        NOW() + ${`${ttlSeconds} seconds`}::INTERVAL
      )
      ON CONFLICT (key, user_id) 
      DO UPDATE SET
        response = EXCLUDED.response,
        status_code = EXCLUDED.status_code,
        expires_at = EXCLUDED.expires_at,
        request_hash = EXCLUDED.request_hash,
        route = EXCLUDED.route
    `;
  }
}
