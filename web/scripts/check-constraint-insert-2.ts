import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing keys");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const organizerId = (await supabase.from('users').select('id').limit(1).single()).data?.id;
  const workspaceId = (await supabase.from('workspaces').select('id').limit(1).single()).data?.id;

  const { data: d2, error: e2 } = await supabase.from('events').insert({
    title: 'Test Constraint Event Judging',
    state: 'Judging',
    organizer_id: organizerId,
    workspace_id: workspaceId,
    team_size_min: 1,
    team_size_max: 5,
    registration_deadline: new Date().toISOString()
  });
  console.log("Insert 'Judging':", e2 ? e2.message : "Success!");

  const { data: d3, error: e3 } = await supabase.from('events').insert({
    title: 'Test Constraint Event Locked',
    state: 'TeamFormationLocked', 
    organizer_id: organizerId,
    workspace_id: workspaceId,
    team_size_min: 1,
    team_size_max: 5,
    registration_deadline: new Date().toISOString()
  });
  console.log("Insert 'TeamFormationLocked':", e3 ? e3.message : "Success!");
  
  const { data: d4, error: e4 } = await supabase.from('events').insert({
    title: 'Test Constraint Event Active',
    state: 'Active', 
    organizer_id: organizerId,
    workspace_id: workspaceId,
    team_size_min: 1,
    team_size_max: 5,
    registration_deadline: new Date().toISOString()
  });
  console.log("Insert 'Active':", e4 ? e4.message : "Success!");
}

main().catch(console.error);
