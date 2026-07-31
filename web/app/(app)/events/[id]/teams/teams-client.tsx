"use client";
/**
 * TeamsClient — Complete bidirectional team management.
 *
 * WHO can do WHAT:
 *  Unteamed Participant  → Create team | Browse & request to join | View/respond to invitations
 *  Team Member (any)     → Invite unteamed participants (live search) | View sent invites | Leave
 *  Captain               → All of the above + Accept/Reject incoming join requests
 */
import React, { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  user_id: string;
  display_name: string;
}
interface Team {
  id: string;
  name: string;
  captain_id: string;
  members: TeamMember[];
}

interface JoinRequest {
  id: string;
  user_id: string;
  display_name: string;
  message: string;
  created_at: string;
}
interface SentInvite {
  id: string;
  invitee_user_id: string;
  invitee_display_name: string;
  inviter_display_name: string;
  inviter_role: string;
  message: string;
  status: string;
  created_at: string;
}
interface InboundInvite {
  id: string;
  team_id: string;
  team_name: string;
  inviter_display_name: string;
  inviter_role: string;
  message: string;
  created_at: string;
}
interface Participant {
  user_id: string;
  display_name: string;
}

interface Props {
  eventId: string;
  eventState: string;
  teams: Team[];
  userId: string | null;
  userRole: string | null;
}

// ─── Primitive UI atoms ───────────────────────────────────────────────────────

const OPEN_STATES = new Set(["RegistrationOpen", "RegistrationClosed"]);
function ago(iso: string) {
  const m = Math.floor((Date.now() - +new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Av({ name }: { name: string }) {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[11px] font-semibold text-[var(--text-secondary)] select-none">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Pill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
        accent
          ? "bg-[var(--accent)] text-white"
          : "border border-[var(--border)] text-[var(--text-muted)]"
      }`}
    >
      {label}
    </span>
  );
}

function Err({ msg, clear }: { msg: string; clear: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3"
    >
      <p className="text-sm text-[var(--error)]">{msg}</p>
      <button onClick={clear} className="shrink-0 text-xs text-[var(--error)] hover:underline">
        ✕
      </button>
    </div>
  );
}

function Sec({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </p>
  );
}

// ─── Participant live search ──────────────────────────────────────────────────

function ParticipantSearch({
  eventId,
  onSelect,
  selected,
  onClear,
}: {
  eventId: string;
  onSelect: (p: Participant) => void;
  selected: Participant | null;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Participant[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(val: string) {
    setQ(val);
    if (timer.current) clearTimeout(timer.current);
    if (!val.trim()) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      const r = await fetch(
        `/api/events/${eventId}/participants?q=${encodeURIComponent(val)}&exclude_teamed=true`,
      );
      if (r.ok) {
        const { data } = await r.json();
        setResults(data ?? []);
      }
      setBusy(false);
    }, 280);
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[var(--accent)] bg-[var(--accent-muted)] px-3 py-2">
        <Av name={selected.display_name} />
        <span className="flex-1 text-sm text-[var(--text)]">{selected.display_name}</span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => handleInput(e.target.value)}
        placeholder="Search participant by name…"
        autoComplete="off"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
      />
      {busy && <span className="absolute right-3 top-2.5 text-xs text-[var(--text-muted)]">…</span>}
      {results.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 top-full mt-1 rounded-md border border-[var(--border)] bg-[var(--card-bg)] shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {results.map((p) => (
            <li key={p.user_id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  setQ("");
                  setResults([]);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors text-left"
              >
                <Av name={p.display_name} />
                {p.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!busy && q.length > 1 && results.length === 0 && (
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          No unteamed participants found for &ldquo;{q}&rdquo;.
        </p>
      )}
    </div>
  );
}

// ─── InviteForm — used by captain and regular members ────────────────────────

function InviteForm({
  eventId,
  teamId,
  onDone,
}: {
  eventId: string;
  teamId: string;
  onDone: () => void;
}) {
  const [target, setTarget] = useState<Participant | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/events/${eventId}/teams/${teamId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitee_user_id: target.user_id, message: msg }),
    });
    if (!r.ok) {
      const { error } = await r.json();
      setErr(error?.message ?? "Failed.");
    } else {
      setOk(true);
      setTimeout(onDone, 900);
    }
    setBusy(false);
  }

  if (ok)
    return (
      <p className="text-sm text-[var(--success)] py-2">
        ✓ Invitation sent to {target?.display_name}
      </p>
    );

  return (
    <form onSubmit={submit} className="space-y-2.5">
      {err && <p className="text-xs text-[var(--error)]">{err}</p>}
      <ParticipantSearch
        eventId={eventId}
        selected={target}
        onSelect={setTarget}
        onClear={() => setTarget(null)}
      />
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Tell them why your team is a great fit (optional, max 300 chars)"
        maxLength={300}
        rows={2}
        className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!target || busy}
          className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
        >
          {busy ? "Sending…" : "Send Invitation"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function TeamsClient({ eventId, eventState, teams: init, userId, userRole }: Props) {
  const router = useRouter();
  const open = OPEN_STATES.has(eventState);
  const isP = userRole === "Participant";
  const isOrganizer = userRole === "Organizer";
  const canAct = isP && open;

  const myTeam = userId
    ? (init.find((t) => t.members.some((m) => m.user_id === userId)) ?? null)
    : null;
  const captain = myTeam?.captain_id === userId;

  // ── error / success ──────────────────────────────────────────────────────
  const [err, setErr] = useState<string | null>(null);

  // ── create team ──────────────────────────────────────────────────────────
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function createTeam(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setErr(null);
    const r = await fetch(`/api/events/${eventId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!r.ok) {
      const { error } = await r.json();
      setErr(error?.message ?? "Failed.");
    } else {
      setNewName("");
      router.refresh();
    }
    setCreating(false);
  }

  // ── join request ─────────────────────────────────────────────────────────
  const [joinOpen, setJoinOpen] = useState<string | null>(null);
  const [joinMsg, setJoinMsg] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  async function joinRequest(teamId: string) {
    setJoining(teamId);
    setErr(null);
    const r = await fetch(`/api/events/${eventId}/teams/${teamId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: joinMsg }),
    });
    if (!r.ok) {
      const { error } = await r.json();
      setErr(error?.message ?? "Failed.");
    } else {
      setSent((p) => new Set([...p, teamId]));
      setJoinOpen(null);
      setJoinMsg("");
    }
    setJoining(null);
  }

  // ── captain: resolve join requests ──────────────────────────────────────
  const [reqs, setReqs] = useState<JoinRequest[]>([]);
  const [reqsReady, setReqsReady] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (!captain || !myTeam || reqsReady) return;
    fetch(`/api/events/${eventId}/teams/${myTeam.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setReqs(j.data?.pending_requests ?? []);
        setReqsReady(true);
      });
  }, [captain, myTeam, reqsReady, eventId]);

  async function resolve(reqId: string, action: "accept" | "reject") {
    if (!myTeam) return;
    setResolving(reqId);
    setErr(null);
    const r = await fetch(`/api/events/${eventId}/teams/${myTeam.id}/join`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: reqId, action }),
    });
    if (!r.ok) {
      const { error } = await r.json();
      setErr(error?.message ?? "Failed.");
    } else {
      setReqs((p) => p.filter((x) => x.id !== reqId));
      if (action === "accept") router.refresh();
    }
    setResolving(null);
  }

  // ── sent invitations (all members can view their own; captain sees all) ──
  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  const [sentReady, setSentReady] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    if (!myTeam || sentReady) return;
    fetch(`/api/events/${eventId}/teams/${myTeam.id}/invitations`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setSentInvites(j.data ?? []);
        setSentReady(true);
      });
  }, [myTeam, sentReady, eventId]);

  // ── inbound invitations (unteamed participant) ───────────────────────────
  const [inbox, setInbox] = useState<InboundInvite[]>([]);
  const [inboxReady, setInboxReady] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || myTeam || inboxReady || !isP) return;
    fetch(`/api/events/${eventId}/invitations`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setInbox(j.data ?? []);
        setInboxReady(true);
      });
  }, [userId, myTeam, inboxReady, isP, eventId]);

  async function respond(invId: string, action: "accept" | "decline") {
    setResponding(invId);
    setErr(null);
    const r = await fetch(`/api/events/${eventId}/invitations/${invId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!r.ok) {
      const { error } = await r.json();
      setErr(error?.message ?? "Failed.");
    } else {
      setInbox((p) => p.filter((x) => x.id !== invId));
      if (action === "accept") router.refresh();
    }
    setResponding(null);
  }

  // ── leave ────────────────────────────────────────────────────────────────
  const [leaving, setLeaving] = useState(false);

  async function leave() {
    if (!myTeam) return;
    const next =
      captain && myTeam.members.length > 1
        ? myTeam.members.find((m) => m.user_id !== userId)?.display_name
        : null;
    const msg = next
      ? `Leave "${myTeam.name}"? Captaincy transfers to ${next}.`
      : `Leave "${myTeam.name}"?`;
    if (!window.confirm(msg)) return;
    setLeaving(true);
    setErr(null);
    const r = await fetch(`/api/events/${eventId}/teams/${myTeam.id}`, { method: "DELETE" });
    if (!r.ok) {
      const { error } = await r.json();
      setErr(error?.message ?? "Failed.");
      setLeaving(false);
      return;
    }
    router.refresh();
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Teams</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {open
              ? "Team formation is open — create, request to join, or send invitations."
              : `${eventState} — team changes unavailable in this phase.`}
          </p>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          {init.length} team{init.length !== 1 && "s"}
        </span>
      </div>

      {err && <Err msg={err} clear={() => setErr(null)} />}

      {/* ── ONBOARDING BANNER (unteamed participant) ─── */}
      {isP && !myTeam && canAct && inbox.length === 0 && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-5 dark:bg-blue-900/20 dark:border-blue-800">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
            You need a team to participate
          </h3>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 max-w-lg">
            Create a new team below to compete solo or invite friends, or scroll down to request to
            join an existing team.
          </p>
        </div>
      )}

      {/* ── A. INBOUND INVITATIONS (unteamed participant) ─── */}
      {isP && !myTeam && inbox.length > 0 && (
        <section className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sec>Invitations for you</Sec>
            <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
              {inbox.length}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Accepting one invitation cancels all others and any join requests you sent.
          </p>
          {inbox.map((inv) => (
            <div
              key={inv.id}
              className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--text)]">{inv.team_name}</span>
                  <Pill
                    label={inv.inviter_role === "Captain" ? "Captain invite" : "Member invite"}
                    accent={inv.inviter_role === "Captain"}
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  From {inv.inviter_display_name} · {ago(inv.created_at)}
                </p>
                {inv.message && (
                  <p className="text-xs italic text-[var(--text-secondary)] border-l-2 border-[var(--border)] pl-2">
                    &ldquo;{inv.message}&rdquo;
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0 pt-0.5">
                <button
                  disabled={responding === inv.id}
                  onClick={() => respond(inv.id, "accept")}
                  className="rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                >
                  {responding === inv.id ? "…" : "Accept"}
                </button>
                <button
                  disabled={responding === inv.id}
                  onClick={() => respond(inv.id, "decline")}
                  className="rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── B. MY TEAM PANEL ─── */}
      {myTeam && (
        <section className="card p-4 space-y-4" style={{ borderColor: "var(--accent)" }}>
          {/* header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-[var(--text)]">{myTeam.name}</h3>
                <Pill label="Your team" accent />
                {captain && <Pill label="Captain" accent />}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {myTeam.members.length} member{myTeam.members.length !== 1 && "s"}
              </p>
            </div>
            {canAct && (
              <button
                disabled={leaving}
                onClick={leave}
                className="shrink-0 rounded-md border border-[var(--error)] px-3 py-1 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] disabled:opacity-50 transition-colors"
              >
                {leaving ? "Leaving…" : "Leave Team"}
              </button>
            )}
          </div>

          {/* roster */}
          <div className="space-y-2">
            {myTeam.members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2.5">
                <Av name={m.display_name} />
                <span className="flex-1 text-sm text-[var(--text)]">{m.display_name}</span>
                {m.user_id === myTeam.captain_id && <Pill label="Captain" accent />}
                {m.user_id === userId && (
                  <span className="text-[10px] text-[var(--text-muted)]">(you)</span>
                )}
              </div>
            ))}
          </div>

          {/* invite section — ALL members can invite */}
          {canAct && (
            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <Sec>Invite a participant</Sec>
                {!showInvite && (
                  <button
                    onClick={() => setShowInvite(true)}
                    className="rounded-md border border-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-muted)] transition-colors"
                  >
                    + Invite
                  </button>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {captain
                  ? "As captain you can invite anyone not yet on a team. Team members can invite too."
                  : "You can invite unteamed participants. Your captain will be notified."}
              </p>
              {showInvite && (
                <InviteForm
                  eventId={eventId}
                  teamId={myTeam.id}
                  onDone={() => {
                    setShowInvite(false);
                    setSentReady(false);
                  }}
                />
              )}
            </div>
          )}

          {/* sent invitations log */}
          {sentReady && (
            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              <Sec>Sent invitations</Sec>
              {sentInvites.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No invitations sent yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {sentInvites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                    >
                      <Av name={inv.invitee_display_name} />
                      <span className="flex-1 truncate">{inv.invitee_display_name}</span>
                      <span className="text-[var(--text-muted)] truncate">
                        by {inv.inviter_display_name}
                      </span>
                      <Pill label={inv.status} accent={inv.status === "accepted"} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* captain: join request inbox */}
          {captain && (
            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sec>Join requests</Sec>
                {reqs.length > 0 && (
                  <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                    {reqs.length}
                  </span>
                )}
              </div>
              {!reqsReady ? (
                <p className="text-xs text-[var(--text-muted)]">Loading…</p>
              ) : reqs.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No pending requests.</p>
              ) : (
                <div className="space-y-2">
                  {reqs.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Av name={req.display_name} />
                          <span className="text-sm font-medium text-[var(--text)]">
                            {req.display_name}
                          </span>
                        </div>
                        {req.message && (
                          <p className="text-xs italic text-[var(--text-secondary)] border-l-2 border-[var(--border)] pl-2">
                            &ldquo;{req.message}&rdquo;
                          </p>
                        )}
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {ago(req.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0 pt-0.5">
                        <button
                          disabled={resolving === req.id}
                          onClick={() => resolve(req.id, "accept")}
                          className="rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                        >
                          {resolving === req.id ? "…" : "Accept"}
                        </button>
                        <button
                          disabled={resolving === req.id}
                          onClick={() => resolve(req.id, "reject")}
                          className="rounded-md border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── C. CREATE TEAM ─── */}
      {canAct && !myTeam && (
        <section className="card p-4 space-y-2">
          <p className="text-sm font-medium text-[var(--text)]">Start your own team</p>
          <form onSubmit={createTeam} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Team name (2–50 chars)"
              required
              minLength={2}
              maxLength={50}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create Team"}
            </button>
          </form>
          <p className="text-xs text-[var(--text-muted)]">
            You become captain. Invite participants or let them request to join.
          </p>
        </section>
      )}

      {/* ── D. TEAM BROWSER ─── */}
      {init.length === 0 ? (
        <EmptyState
          title="No teams yet."
          description={
            open ? "Be the first to create one." : "Teams will appear once team formation begins."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {init.map((team) => {
            const mine = team.id === myTeam?.id;
            const alreadySent = sent.has(team.id);
            return (
              <div
                key={team.id}
                className={`card p-4 space-y-3 ${mine ? "opacity-40 pointer-events-none" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-[var(--text)]">{team.name}</h3>
                  <span className="text-xs text-[var(--text-muted)]">
                    {team.members.length} member{team.members.length !== 1 && "s"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {team.members.slice(0, 5).map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <Av name={m.display_name} />
                      <span className="text-xs text-[var(--text)]">{m.display_name}</span>
                      {m.user_id === team.captain_id && <Pill label="Captain" accent />}
                    </div>
                  ))}
                  {team.members.length > 5 && (
                    <p className="text-[10px] text-[var(--text-muted)] pl-8">
                      +{team.members.length - 5} more
                    </p>
                  )}
                </div>

                {/* Organizer controls */}
                {isOrganizer && (
                  <div className="pt-2 border-t border-[var(--border)] mt-2">
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Force disband team "${team.name}"?`)) return;
                        const r = await fetch(`/api/events/${eventId}/teams/${team.id}`, {
                          method: "DELETE",
                        });
                        if (r.ok) router.refresh();
                        else alert("Failed to disband team.");
                      }}
                      className="text-xs text-[var(--error)] hover:underline"
                    >
                      Disband Team
                    </button>
                  </div>
                )}

                {/* join request — unteamed participant only */}
                {canAct && !myTeam && (
                  <>
                    {alreadySent ? (
                      <p className="text-xs text-[var(--success)]">
                        ✓ Request sent — awaiting captain
                      </p>
                    ) : joinOpen === team.id ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          value={joinMsg}
                          onChange={(e) => setJoinMsg(e.target.value)}
                          placeholder="Introduce yourself to the captain (optional, max 300 chars)"
                          maxLength={300}
                          rows={2}
                          className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => joinRequest(team.id)}
                            disabled={joining === team.id}
                            className="flex-1 rounded-md bg-[var(--accent)] py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                          >
                            {joining === team.id ? "Sending…" : "Send Request"}
                          </button>
                          <button
                            onClick={() => {
                              setJoinOpen(null);
                              setJoinMsg("");
                            }}
                            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setJoinOpen(team.id);
                          setJoinMsg("");
                        }}
                        className="w-full rounded-md border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-muted)] transition-colors"
                      >
                        Request to Join
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* phase gate notice */}
      {!open && isP && !myTeam && (
        <p className="text-center text-xs text-[var(--text-muted)] pt-2">
          Team formation opens after registration closes.
        </p>
      )}
    </div>
  );
}
