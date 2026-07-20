import postgres from "postgres";

export interface SkillCategory {
  id: string;
  name: string;
}

export interface Skill {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
}

export class SkillQueryService {
  constructor(private sql: postgres.Sql) {}

  async searchSkills(query: string, limit: number = 10): Promise<Skill[]> {
    // In a real implementation this searches the `skills` table 
    // e.g. SELECT * FROM skills WHERE name ILIKE $1 LIMIT $2
    return [];
  }

  async listCategories(): Promise<SkillCategory[]> {
    // e.g. SELECT * FROM skill_categories ORDER BY name ASC
    return [];
  }
}
