"use server";

import { createServerClient as createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type EvaluationCriterion = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  max_score: number;
  weight: number;
  sort_order: number;
};

export async function fetchRubricsAction(eventId: string): Promise<EvaluationCriterion[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evaluation_criteria")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    console.error("Failed to fetch rubrics:", error);
    return [];
  }

  return data as EvaluationCriterion[];
}

export async function upsertRubricCriterionAction(
  eventId: string,
  criterion: Partial<EvaluationCriterion>,
) {
  const supabase = await createClient();

  // Validate the user has Organizer role
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: member } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member || (member.role !== "Organizer" && member.role !== "Admin")) {
    return { success: false, error: "Forbidden: Only Organizers can manage rubrics" };
  }

  // Ensure event is not in "Judging" or "Completed"
  const { data: event } = await supabase.from("events").select("state").eq("id", eventId).single();

  if (
    event &&
    (event.state === "Judging" || event.state === "Completed" || event.state === "Archived")
  ) {
    return { success: false, error: "Cannot modify rubrics while event is Judging or Completed" };
  }

  const { error } = await supabase.from("evaluation_criteria").upsert({
    ...criterion,
    event_id: eventId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/events/${eventId}/judging`);
  return { success: true };
}

export async function deleteRubricCriterionAction(eventId: string, criterionId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: member } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member || (member.role !== "Organizer" && member.role !== "Admin")) {
    return { success: false, error: "Forbidden: Only Organizers can manage rubrics" };
  }

  const { data: event } = await supabase.from("events").select("state").eq("id", eventId).single();

  if (
    event &&
    (event.state === "Judging" || event.state === "Completed" || event.state === "Archived")
  ) {
    return { success: false, error: "Cannot modify rubrics while event is Judging or Completed" };
  }

  const { error } = await supabase
    .from("evaluation_criteria")
    .delete()
    .eq("id", criterionId)
    .eq("event_id", eventId); // safety check

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/events/${eventId}/judging`);
  return { success: true };
}
