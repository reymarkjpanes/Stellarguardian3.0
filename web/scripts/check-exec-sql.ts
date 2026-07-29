import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function main() {
  const { data, error } = await supabase.rpc('exec_sql', { query: "SELECT 1" });
  console.log("exec_sql:", error ? error.message : "Success");
}

main().catch(console.error);
