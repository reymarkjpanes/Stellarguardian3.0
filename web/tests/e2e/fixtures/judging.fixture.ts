/**
 * Judging fixture — seeds event, submission, and judge assignment for E2E tests.
 *
 * NOTE: This is a skeleton fixture. Actual seeding requires a running Supabase
 * test instance. Implement `setupJudgingFixture` when the test environment is ready.
 */

export interface JudgingFixtureData {
  judgeAuth: {
    email: string;
    password: string;
  };
  workspaceData: {
    eventId: string;
    submissionId: string;
  };
}

/**
 * Seeds the test database with an event in JudgingRound1 state, a submission,
 * and a judge assignment. Returns auth credentials and IDs for navigation.
 *
 * TODO: Implement with actual Supabase service-role calls once the test
 * environment is wired up.
 */
export async function setupJudgingFixture(): Promise<JudgingFixtureData> {
  // Placeholder — replace with actual DB seeding via Supabase service client
  return {
    judgeAuth: {
      email: "judge@test.example",
      password: "test-password",
    },
    workspaceData: {
      eventId: "00000000-0000-0000-0000-000000000001",
      submissionId: "00000000-0000-0000-0000-000000000002",
    },
  };
}
