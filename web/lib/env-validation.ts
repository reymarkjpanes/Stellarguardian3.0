/**
 * Environment variable validation — runs at startup to catch misconfigs early.
 * Import this from the root layout or middleware to ensure all required vars exist.
 */
import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  STELLAR_HORIZON_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  KMS_KEY_ARN: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

let validated: Env | null = null;

export function getValidatedEnv(): Env {
  if (validated) return validated;

  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const missing = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
      .join("\n");
    console.error(`❌ Environment validation failed:\n${missing}`);

    // In production, throw to prevent startup with bad config
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variables:\n${missing}`);
    }
  }

  validated = result.success ? result.data : (process.env as unknown as Env);
  return validated;
}
