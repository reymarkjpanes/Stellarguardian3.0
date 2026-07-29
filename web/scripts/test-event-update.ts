import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("id, state, version")
    .limit(1)
    .single();

  if (fetchError || !event) {
    console.error("Fetch Error:", fetchError);
    return;
  }

  console.log("Current Event:", event);

  const { data: updated, error: updateError } = await supabase
    .from("events")
    .update({ state: "RegistrationClosed", version: event.version + 1, updated_at: new Date().toISOString() })
    .eq("id", event.id)
    .eq("version", event.version)
    .select()
    .single();

  if (updateError) {
    console.error("Update Error:", updateError);
  } else {
    console.log("Update Success:", updated);
  }
}

main().catch(console.error);
