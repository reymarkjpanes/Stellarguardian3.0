"use server";

import { createServerClient } from "@/lib/supabase/server";
import { Database } from "@/types/supabase";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export async function getNotificationsAction(): Promise<NotificationRow[]> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }

  return data ?? [];
}

export async function markNotificationAsReadAction(id: string): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error marking notification as read:", error);
  }
}

export async function markAllNotificationsAsReadAction(): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) {
    console.error("Error marking all notifications as read:", error);
  }
}
