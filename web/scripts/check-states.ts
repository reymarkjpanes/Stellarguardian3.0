import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function main() {
  const organizerId = (await supabase.from('users').select('id').limit(1).single()).data?.id;
  const workspaceId = (await supabase.from('workspaces').select('id').limit(1).single()).data?.id;

  const base = {
    organizer_id: organizerId,
    workspace_id: workspaceId,
    title: "Test",
    description: "test",
    tags: ["test"],
    category: "hackathon",
    format: "online",
    team_size_min: 1,
    team_size_max: 5,
    registration_deadline: new Date().toISOString(),
    network_mode: "testnet"
  };

  const states = [
    'Draft', 'Review', 'Published', 'RegistrationOpen', 'RegistrationClosed', 
    'TeamFormationLocked', 'SubmissionOpen', 'SubmissionClosed', 
    'JudgingRound1', 'JudgingRound2', 'WinnerVerification', 'DisputeWindow', 
    'PrizeApproved', 'EscrowRelease', 'Completed', 'Cancelled', 'Suspended', 
    'Archived', 'Judging', 'Active', 'Setup', 'Registration', 'Team Building', 'Submission'
  ];

  for (const st of states) {
    const { data, error } = await supabase.from('events').insert({
      state: st,
      ...base,
      title: "Test " + st
    });
    console.log(`State '${st}':`, error ? "FAILED" : "SUCCESS");
  }
}

main().catch(console.error);
