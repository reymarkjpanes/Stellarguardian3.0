import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import Link from "next/link";

const PAGE_SIZE = 50;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const serviceClient = createServiceClient();
  const { q = "", page = "1" } = await searchParams;
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  let query = serviceClient
    .from("users")
    .select("id, display_name, email, deactivated_at, is_platform_admin, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: users, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  async function toggleDeactivate(formData: FormData) {
    "use server";
    const userId = formData.get("userId") as string;
    const currentStatus = formData.get("currentStatus") as string;

    const sClient = createServiceClient();
    const isDeactivated = currentStatus === "true";

    await sClient
      .from("users")
      .update({ deactivated_at: isDeactivated ? null : new Date().toISOString() })
      .eq("id", userId);

    revalidatePath("/admin/users");
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Manage Users</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">View and manage platform users.</p>
        </div>
        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search users..."
            className="input text-sm px-3 py-1.5"
          />
          <button type="submit" className="btn btn-primary text-sm px-4">
            Search
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">User</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Email</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Role</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-3 font-medium text-[var(--text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => {
              const isDeactivated = !!u.deactivated_at;
              return (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{u.display_name}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.is_platform_admin ? (
                      <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs text-[var(--accent)] font-medium">
                        Admin
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">User</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isDeactivated ? (
                      <span className="rounded-full bg-[var(--destructive)]/10 px-2 py-0.5 text-xs text-[var(--destructive)] font-medium">
                        Deactivated
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 font-medium dark:text-green-400">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={toggleDeactivate}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="currentStatus" value={String(isDeactivated)} />
                      {!u.is_platform_admin && (
                        <button
                          type="submit"
                          className="text-xs font-medium hover:underline text-[var(--text)]"
                        >
                          {isDeactivated ? "Reactivate" : "Deactivate"}
                        </button>
                      )}
                    </form>
                  </td>
                </tr>
              );
            })}
            {(!users || users.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            Page {currentPage} of {totalPages} · {count ?? 0} total users
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(currentPage - 1) })}`}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
              >
                ← Previous
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(currentPage + 1) })}`}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
