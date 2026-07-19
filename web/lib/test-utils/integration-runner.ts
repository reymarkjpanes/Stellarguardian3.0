import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Hardcode the default local supabase configuration for tests to prevent .env.local pollution
const SUPABASE_URL = "http://localhost:54321";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const getIntegrationClient = () => {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
};

export const createTestUser = async () => {
  const supabase = getIntegrationClient();
  const userId = crypto.randomUUID();

  // Directly insert into auth.users (if using service role)
  // or public.users, depending on your schema.
  // In standard Supabase, we create a user via admin API
  const { data, error } = await supabase.auth.admin.createUser({
    email: `test-${userId}@example.com`,
    password: "password123",
    email_confirm: true,
  });

  if (error) throw error;

  await supabase.from("users").insert({
    id: data.user.id,
    display_name: `Test User ${userId}`,
    email: data.user.email,
  });

  return data.user;
};

export const createTestEvent = async (organizerId: string) => {
  const supabase = getIntegrationClient();
  const eventId = crypto.randomUUID();
  // Create a dummy workspace first
  const workspaceId = crypto.randomUUID();
  await supabase.from("workspaces").insert({
    id: workspaceId,
    name: "Test Workspace",
    slug: `test-workspace-${eventId}`,
  });

  const { error } = await supabase.from("events").insert({
    id: eventId,
    workspace_id: workspaceId,
    title: `Integration Test Event ${eventId}`,
    description: "Integration Test Event Description",
    category: "Test",
    format: "Online",
    organizer_id: organizerId,
    state: "Draft",
    team_size_min: 1,
    team_size_max: 5,
    network_mode: "testnet",
  });

  if (error) throw error;
  return eventId;
};
