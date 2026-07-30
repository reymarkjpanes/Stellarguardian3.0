import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";

async function main() {
  const sql = fs.readFileSync(path.join(process.cwd(), "../supabase/migrations/20260730_standardize_submissions.sql"), "utf8");
  
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    console.log("✅ Success");
  } else {
    console.error("❌ Failed", await res.json());
  }
}
main();
