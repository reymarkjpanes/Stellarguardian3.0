/**
 * Feature Flags — per-workspace feature gating (L6).
 *
 * Flags are stored as a JSONB column on the workspaces table.
 * This provides a simple, database-backed flag system without
 * requiring an external service (LaunchDarkly, etc.).
 *
 * Usage:
 *   const enabled = await isFeatureEnabled("workspace-id", "advanced-judging");
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/** All known feature flags with their default values. */
export const FEATURE_FLAGS = {
  "advanced-judging": false,      // Configurable rubrics per event
  "team-matching": false,         // AI-powered team matching
  "sponsor-logos": true,          // Show sponsor branding on event pages
  "export-csv": true,             // Allow CSV data export
  "dispute-escalation": false,    // Multi-level dispute escalation
  "realtime-notifications": true, // Push notifications via Supabase realtime
  "submission-versions": false,   // Multi-version submission tracking
  "email-announcements": false,   // Organizer → participant email blasts
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature is enabled for a workspace.
 * Falls back to the global default if the workspace has no override.
 */
export async function isFeatureEnabled(
  workspaceId: string,
  flag: FeatureFlag,
): Promise<boolean> {
  const supabase = createServiceClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("feature_flags")
    .eq("id", workspaceId)
    .single();

  const flags = (workspace?.feature_flags ?? {}) as Record<string, boolean>;

  // Workspace override takes precedence
  if (flag in flags) {
    return flags[flag] ?? FEATURE_FLAGS[flag];
  }

  // Fall back to global default
  return FEATURE_FLAGS[flag];
}

/**
 * Get all flags for a workspace (merged with defaults).
 */
export async function getFeatureFlags(
  workspaceId: string,
): Promise<Record<FeatureFlag, boolean>> {
  const supabase = createServiceClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("feature_flags")
    .eq("id", workspaceId)
    .single();

  const overrides = (workspace?.feature_flags ?? {}) as Record<string, boolean>;

  const result = { ...FEATURE_FLAGS } as Record<FeatureFlag, boolean>;
  for (const [key, value] of Object.entries(overrides)) {
    if (key in result) {
      (result as Record<string, boolean>)[key] = value;
    }
  }

  return result;
}

/**
 * Set a feature flag for a workspace.
 */
export async function setFeatureFlag(
  workspaceId: string,
  flag: FeatureFlag,
  enabled: boolean,
): Promise<void> {
  const supabase = createServiceClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("feature_flags")
    .eq("id", workspaceId)
    .single();

  const currentFlags = (workspace?.feature_flags ?? {}) as Record<string, boolean>;
  currentFlags[flag] = enabled;

  await supabase
    .from("workspaces")
    .update({ feature_flags: currentFlags })
    .eq("id", workspaceId);
}
