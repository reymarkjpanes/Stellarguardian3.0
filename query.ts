import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "web/.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('get_event_constraints');
  console.log(data, error);
}

main().catch(console.error);
