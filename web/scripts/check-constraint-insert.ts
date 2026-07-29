import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// MUST specify correct relative path to .env.local
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing keys", supabaseUrl, supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('get_events_state_check'); // might not exist
  console.log("RPC get_events_state_check:", error ? error.message : data);

  // If no RPC, let's just create an event with state='Judging' to see if it fails.
  const { data: d2, error: e2 } = await supabase.from('events').insert({
    title: 'Test Constraint Event',
    slug: 'test-constraint-event-' + Date.now(),
    state: 'Judging', // The one that shouldn't work according to 04_events.sql
    organizer_id: (await supabase.from('users').select('id').limit(1).single()).data?.id,
    workspace_id: (await supabase.from('workspaces').select('id').limit(1).single()).data?.id,
    team_size_min: 1,
    team_size_max: 5,
    registration_deadline: new Date().toISOString()
  });
  console.log("Insert 'Judging':", e2 ? e2.message : "Success!");

  const { data: d3, error: e3 } = await supabase.from('events').insert({
    title: 'Test Constraint Event 2',
    slug: 'test-constraint-event-2-' + Date.now(),
    state: 'TeamFormationLocked', // The one that SHOULD work according to 04_events.sql
    organizer_id: (await supabase.from('users').select('id').limit(1).single()).data?.id,
    workspace_id: (await supabase.from('workspaces').select('id').limit(1).single()).data?.id,
    team_size_min: 1,
    team_size_max: 5,
    registration_deadline: new Date().toISOString()
  });
  console.log("Insert 'TeamFormationLocked':", e3 ? e3.message : "Success!");
}

main().catch(console.error);
