import "server-only";
import postgres from "postgres";

export const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export interface UnitOfWork {
  /**
   * Executes the provided callback within a database transaction.
   * If the callback throws an error, the transaction is rolled back.
   * Otherwise, it is committed.
   */
  execute<T>(callback: (tx: postgres.Sql) => Promise<T>): Promise<T>;
}

export class PostgresUnitOfWork implements UnitOfWork {
  async execute<T>(callback: (tx: postgres.Sql) => Promise<T>): Promise<T> {
    const maxRetries = 3;
    let attempt = 0;

    while (true) {
      attempt++;
      try {
        return await sql.begin(async (tx) => {
          return await callback(tx as unknown as postgres.Sql);
        }) as Promise<T>;
      } catch (error: any) {
        // 40001: serialization_failure
        // 40P01: deadlock_detected
        // 08...: connection exception classes
        const isTransient = error.code === '40001' || error.code === '40P01' || (error.code && error.code.startsWith('08'));
        
        if (!isTransient || attempt >= maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(100 * Math.pow(2, attempt), 1000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
