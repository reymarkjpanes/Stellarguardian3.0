import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function testUpsert() {
  const { data: teamData } = await supabase.from("teams").select("id").limit(1).single();
  const { data: eventData } = await supabase.from("events").select("id").limit(1).single();

  if (!teamData || !eventData) {
    console.log("No team or event found to test with");
    return;
  }

  const payload = {
    team_id: teamData.id,
    event_id: eventData.id,
    status: "DRAFT",
    title: "Test Project",
    updated_at: new Date().toISOString(),
  };

  console.log("Attempting upsert with:", payload);
  const { error } = await supabase
    .from("submissions")
    .upsert(payload, { onConflict: "team_id,event_id" });

  console.log("Error:", error);
}

testUpsert();
