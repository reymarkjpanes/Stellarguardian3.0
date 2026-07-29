import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Role gate: verify user is a PlatformAdmin
  const { data: userRecord } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!userRecord || !userRecord.is_platform_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--bg)] px-6 py-3 flex gap-6 text-sm font-medium">
        <Link href="/admin" className="text-[var(--text-muted)] hover:text-[var(--text)]">Dashboard</Link>
        <Link href="/admin/users" className="text-[var(--text-muted)] hover:text-[var(--text)]">Users</Link>
        <Link href="/admin/events" className="text-[var(--text-muted)] hover:text-[var(--text)]">Events</Link>
        <Link href="/admin/audit" className="text-[var(--text-muted)] hover:text-[var(--text)]">Audit Logs</Link>
      </header>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
