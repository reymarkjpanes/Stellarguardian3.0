"use client";

/**
 * Create event page (Req 6, 23, 24.6).
 */
import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

interface Workspace {
  workspace_id: string;
  role: string;
  name: string;
}

export default function CreateEventPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("hackathon");
  const [format, setFormat] = useState("online");
  const [teamSizeMin, setTeamSizeMin] = useState("1");
  const [teamSizeMax, setTeamSizeMax] = useState("5");
  const [prizePool, setPrizePool] = useState("");
  const [networkMode, setNetworkMode] = useState("testnet");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadWorkspaces() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .in("role", ["Owner", "Admin"]);

      if (!memberships || memberships.length === 0) {
        setWorkspaces([]);
        return;
      }

      const ids = memberships.map((m) => m.workspace_id);
      const { data: wsData } = await supabase
        .from("workspaces")
        .select("id, name")
        .in("id", ids);

      const combined = memberships.map((m) => {
        const ws = wsData?.find((w) => w.id === m.workspace_id);
        return { workspace_id: m.workspace_id, role: m.role, name: ws?.name ?? "" };
      });

      setWorkspaces(combined);
      if (combined.length > 0 && combined[0]) {
        setSelectedWorkspace(combined[0].workspace_id);
      }
    }
    loadWorkspaces();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!selectedWorkspace) {
      setError("You need to create a workspace first before creating an event.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: selectedWorkspace,
          title,
          description,
          category,
          format,
          team_size_min: Number(teamSizeMin),
          team_size_max: Number(teamSizeMax),
          prize_pool_target: prizePool ? Number(prizePool) : null,
          network_mode: networkMode,
        }),
      });

      if (!res.ok) {
        const { error: apiError } = await res.json();
        setError(apiError?.message ?? "Failed to create event.");
        return;
      }

      const { data } = await res.json();
      window.location.href = `/events/${data.id}`;
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create an event</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Set up a hackathon, challenge, or bounty with escrow-backed prizes.
          </p>
        </div>

        {workspaces.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            <p className="font-medium">No workspace found</p>
            <p className="mt-1">You need to create a workspace before creating events.</p>
            <a
              href="/workspaces/new"
              className="mt-3 inline-block rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-200"
            >
              Create a workspace first
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="workspace" className="block text-sm font-medium">Workspace</label>
              <select
                id="workspace"
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              >
                {workspaces.map((ws) => (
                  <option key={ws.workspace_id} value={ws.workspace_id}>
                    {ws.name} ({ws.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium">Event title</label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                placeholder="Stellar DeFi Hackathon 2026"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="block text-sm font-medium">Description</label>
              <textarea
                id="description"
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                placeholder="Describe your event, rules, and prizes…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="category" className="block text-sm font-medium">Category</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="hackathon">Hackathon</option>
                  <option value="challenge">Challenge</option>
                  <option value="bounty">Bounty</option>
                  <option value="competition">Competition</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="format" className="block text-sm font-medium">Format</label>
                <select
                  id="format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="online">Online</option>
                  <option value="in-person">In-person</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="teamMin" className="block text-sm font-medium">Min team size</label>
                <input
                  id="teamMin"
                  type="number"
                  min="1"
                  max="20"
                  value={teamSizeMin}
                  onChange={(e) => setTeamSizeMin(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="teamMax" className="block text-sm font-medium">Max team size</label>
                <input
                  id="teamMax"
                  type="number"
                  min="1"
                  max="20"
                  value={teamSizeMax}
                  onChange={(e) => setTeamSizeMax(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="prizePool" className="block text-sm font-medium">
                  Prize pool (XLM) <span className="text-neutral-400">(optional)</span>
                </label>
                <input
                  id="prizePool"
                  type="number"
                  min="0"
                  step="0.01"
                  value={prizePool}
                  onChange={(e) => setPrizePool(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  placeholder="10000"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="network" className="block text-sm font-medium">Network</label>
                <select
                  id="network"
                  value={networkMode}
                  onChange={(e) => setNetworkMode(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="testnet">Testnet</option>
                  <option value="mainnet">Mainnet</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating…" : "Create event"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
