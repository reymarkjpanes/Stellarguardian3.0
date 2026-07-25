import { Specification } from "@packages/shared-kernel/domain/SpecificationRegistry";
import { TeamSearchQuery } from "../application/queries/TeamSearchQuery";

export class TeamSearchSpecification implements Specification<Record<string, unknown>> {
  constructor(private readonly query: TeamSearchQuery) {}

  public isSatisfiedBy(team: Record<string, unknown>): boolean {
    if (this.query.eventId !== team["eventId"]) return false;
    if (this.query.visibility && team["visibility"] !== this.query.visibility) return false;
    if (this.query.recruiting && team["status"] !== "Recruiting") return false;
    return true;
  }

  public toSql(): { text: string; values: unknown[] } {
    let sqlText = `SELECT * FROM teams WHERE event_id = $1 AND archived_at IS NULL`;
    const values: unknown[] = [this.query.eventId];
    let paramIndex = 2;

    if (this.query.visibility) {
      sqlText += ` AND visibility = $${paramIndex++}`;
      values.push(this.query.visibility);
    }

    if (this.query.recruiting) {
      sqlText += ` AND status = 'Recruiting'`;
    }

    // Additional filters for skills, languages, timezone, tags would be added here

    if (this.query.cursor) {
      sqlText += ` AND id > $${paramIndex++}`;
      values.push(this.query.cursor);
    }

    sqlText += ` ORDER BY id ASC LIMIT $${paramIndex}`;
    values.push((this.query.limit || 20) + 1);

    return { text: sqlText, values };
  }
}
