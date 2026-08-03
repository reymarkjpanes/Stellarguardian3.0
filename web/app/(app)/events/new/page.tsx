/**
 * Create Event — 4-step wizard.
 *
 * Steps:
 *   1. Basic Info — title, description, category, format, tags
 *   2. Team & Timeline — team sizes, registration deadline
 *   3. Prize & Network — prize pool, network mode (testnet/mainnet), review window
 *   4. Review & Submit — summary before API call
 *
 * Design: Left rail shows step progress. Right panel shows current step form.
 * Validation is per-step before advancing. Final submit hits POST /api/events.
 * No external animation libs — CSS transitions only.
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { clearDraft } from "@/lib/hooks/use-form-draft";
import { BackButton } from "@/components/ui/back-button";
import { useToast } from "@/components/ui/use-toast";

const DRAFT_KEY = "create-event-wizard";

interface Workspace {
  workspace_id: string;
  role: string;
  name: string;
}

interface FormData {
  workspace_id: string;
  title: string;
  description: string;
  category: string;
  format: string;
  tags: string[];
  team_size_min: string;
  team_size_max: string;
  registration_deadline: string;
  prize_pool_target: string;
  network_mode: string;
  review_window_hours: string;
  prize_split_policy: string;
}

const INITIAL: FormData = {
  workspace_id: "",
  title: "",
  description: "",
  category: "hackathon",
  format: "online",
  tags: [],
  team_size_min: "1",
  team_size_max: "5",
  registration_deadline: "",
  prize_pool_target: "",
  network_mode: "testnet",
  review_window_hours: "72",
  prize_split_policy: "captain_receives",
};

const STEPS = [
  { num: 1, label: "Basic Info", hint: "Name, category, description" },
  { num: 2, label: "Team & Timeline", hint: "Sizes, dates" },
  { num: 3, label: "Prize & Network", hint: "Pool, network, review window" },
  { num: 4, label: "Review & Save Draft", hint: "Confirm before creating" },
] as const;

const CATEGORY_OPTIONS = ["hackathon", "challenge", "bounty", "competition", "grant"];
const FORMAT_OPTIONS = ["online", "in-person", "hybrid"];
const TAG_PRESETS = ["Web3", "Soroban", "DeFi", "NFT", "AI", "Security", "Open Source", "Mobile"];

function validate(step: number, data: FormData): string | null {
  if (step === 1) {
    if (!data.title.trim()) return "Event title is required.";
    if (data.title.trim().length < 5) return "Title must be at least 5 characters.";
    if (!data.description.trim()) return "Description is required.";
    if (data.description.trim().length < 20) return "Description must be at least 20 characters.";
    if (!data.workspace_id) return "Select a workspace to continue.";
  }
  if (step === 2) {
    const min = Number(data.team_size_min);
    const max = Number(data.team_size_max);
    if (!min || min < 1) return "Minimum team size must be at least 1.";
    if (!max || max < min) return "Maximum team size must be ≥ minimum.";
    if (max > 20) return "Maximum team size cannot exceed 20.";
  }
  if (step === 3) {
    if (data.prize_pool_target && Number(data.prize_pool_target) < 0)
      return "Prize pool cannot be negative.";
    const rw = Number(data.review_window_hours);
    if (!rw || rw < 24 || rw > 168) return "Review window must be between 24 and 168 hours.";
  }
  return null;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`sg-draft:${DRAFT_KEY}`);
        return saved ? { ...INITIAL, ...JSON.parse(saved) } : INITIAL;
      } catch {
        return INITIAL;
      }
    }
    return INITIAL;
  });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Persist draft on every change
  useEffect(() => {
    try {
      localStorage.setItem(`sg-draft:${DRAFT_KEY}`, JSON.stringify(form));
    } catch {
      /* quota exceeded or private mode */
    }
  }, [form]);

  // Load workspaces
  // Load workspaces on mount — intentionally runs once

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .in("role", ["Owner", "Admin"]);
      if (!memberships?.length) return;
      const ids = memberships.map((m) => m.workspace_id);
      const { data: wsData } = await supabase.from("workspaces").select("id, name").in("id", ids);
      const combined = memberships.map((m) => {
        const ws = wsData?.find((w) => w.id === m.workspace_id);
        return { workspace_id: m.workspace_id, role: m.role, name: ws?.name ?? "" };
      });
      setWorkspaces(combined);
      if (combined.length > 0 && combined[0]) {
        setForm((f) => (f.workspace_id ? f : { ...f, workspace_id: combined[0]!.workspace_id }));
      }
    }
    load();
  }, []);

  function update(field: keyof FormData, value: string | string[]) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldError(null);
  }

  function toggleTag(tag: string) {
    const current = form.tags;
    update("tags", current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]);
  }

  function advance() {
    const error = validate(step, form);
    if (error) {
      setFieldError(error);
      return;
    }
    setFieldError(null);
    setStep((s) => Math.min(s + 1, 4));
  }

  function back() {
    setFieldError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: form.workspace_id,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          format: form.format,
          team_size_min: Number(form.team_size_min),
          team_size_max: Number(form.team_size_max),
          // Convert date-only string ("YYYY-MM-DD") from <input type="date"> to a
          // full ISO 8601 datetime that Zod's z.string().datetime() accepts.
          registration_deadline: form.registration_deadline
            ? new Date(form.registration_deadline + "T00:00:00.000Z").toISOString()
            : null,
          prize_pool_target: form.prize_pool_target ? Number(form.prize_pool_target) : null,
          network_mode: form.network_mode,
          review_window_hours: Number(form.review_window_hours),
          prize_split_policy: form.prize_split_policy,
          tags: form.tags,
        }),
      });
      if (!res.ok) {
        let msg = "Failed to create event.";
        try {
          msg = (await res.json()).error?.message ?? msg;
        } catch {
          /* empty body */
        }
        setSubmitError(msg);
        setSubmitting(false);
        toast({ title: "Error", description: msg, type: "error" });
        return;
      }
      const { data } = await res.json();
      clearDraft(DRAFT_KEY);
      localStorage.removeItem(`sg-draft:${DRAFT_KEY}`);
      toast({ title: "Success", description: "Event created successfully!", type: "success" });
      router.push(`/events/${data.id}`);
    } catch {
      const msg = "Network error. Please try again.";
      setSubmitError(msg);
      toast({ title: "Error", description: msg, type: "error" });
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--text-muted)]";
  const labelCls = "block text-sm font-medium text-[var(--text-secondary)] mb-1";

  if (workspaces.length === 0 && form.workspace_id === "") {
    // Still loading or no workspaces
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Create an event
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Set up a hackathon or competition with on-chain escrow-backed prizes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Step rail */}
        <aside className="lg:col-span-1">
          <div className="card p-4 space-y-1">
            {STEPS.map((s) => {
              const isActive = step === s.num;
              const isDone = step > s.num;
              return (
                <button
                  key={s.num}
                  onClick={() => (isDone ? setStep(s.num) : undefined)}
                  disabled={!isDone && !isActive}
                  className={`w-full text-left rounded-lg p-3 transition-colors ${
                    isActive
                      ? "bg-[var(--accent-muted)]"
                      : isDone
                        ? "hover:bg-[var(--bg-muted)] cursor-pointer"
                        : "opacity-40 cursor-default"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        isDone
                          ? "bg-[var(--success)] text-white"
                          : isActive
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                      }`}
                    >
                      {isDone ? "✓" : s.num}
                    </div>
                    <div>
                      <p
                        className={`text-xs font-semibold ${isActive ? "text-[var(--accent)]" : isDone ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}
                      >
                        {s.label}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">{s.hint}</p>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Overall progress */}
            <div className="pt-3 mt-2 border-t border-[var(--border)]">
              <div className="h-1 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                  style={{ width: `${((step - 1) / 3) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Step {step} of 4</p>
            </div>

            {/* Discard draft — inline confirm to avoid window.confirm */}
            {!confirmDiscard ? (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                className="mt-3 w-full text-xs text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
              >
                Discard draft
              </button>
            ) : (
              <div className="mt-3 rounded-md border border-[var(--error)]/40 bg-[var(--error-bg)] px-3 py-2 space-y-2">
                <p className="text-xs text-[var(--error)]">
                  Discard draft? All progress will be lost.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem(`sg-draft:${DRAFT_KEY}`);
                      setForm(INITIAL);
                      setStep(1);
                      setFieldError(null);
                      setConfirmDiscard(false);
                    }}
                    className="text-xs font-medium text-[var(--error)] hover:underline"
                  >
                    Yes, discard
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDiscard(false)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    Keep editing
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Step panel */}
        <div className="lg:col-span-3">
          <div className="card p-6">
            {/* No workspace warning */}
            {workspaces.length === 0 ? (
              <div className="rounded-md border border-[var(--warning-bg)] bg-[var(--warning-bg)] px-4 py-4 text-sm text-[var(--warning)]">
                <p className="font-medium">No workspace found</p>
                <p className="mt-1 text-xs">
                  You need to create a workspace before creating events.
                </p>
                <Link
                  href="/workspaces/new"
                  className="mt-3 inline-block text-xs font-medium text-[var(--warning)] underline"
                >
                  Create a workspace first →
                </Link>
              </div>
            ) : (
              <>
                {/* STEP 1: Basic Info */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--text)]">
                        Basic Information
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Give your event a clear name and description.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="ws" className={labelCls}>
                        Workspace
                      </label>
                      <select
                        id="ws"
                        value={form.workspace_id}
                        onChange={(e) => update("workspace_id", e.target.value)}
                        className={inputCls}
                      >
                        {workspaces.map((ws) => (
                          <option key={ws.workspace_id} value={ws.workspace_id}>
                            {ws.name} ({ws.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="title" className={labelCls}>
                        Event title <span className="text-[var(--error)]">*</span>
                      </label>
                      <input
                        id="title"
                        type="text"
                        required
                        value={form.title}
                        onChange={(e) => update("title", e.target.value)}
                        className={inputCls}
                        placeholder="Stellar DeFi Hackathon 2026"
                      />
                    </div>

                    <div>
                      <label htmlFor="desc" className={labelCls}>
                        Description <span className="text-[var(--error)]">*</span>
                      </label>
                      <textarea
                        id="desc"
                        rows={5}
                        required
                        value={form.description}
                        onChange={(e) => update("description", e.target.value)}
                        className={inputCls}
                        placeholder="Describe what participants will build, how they'll be judged, and what the prizes are…"
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {form.description.length} characters (min 20)
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="cat" className={labelCls}>
                          Category
                        </label>
                        <select
                          id="cat"
                          value={form.category}
                          onChange={(e) => update("category", e.target.value)}
                          className={inputCls}
                        >
                          {CATEGORY_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c.charAt(0).toUpperCase() + c.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="fmt" className={labelCls}>
                          Format
                        </label>
                        <select
                          id="fmt"
                          value={form.format}
                          onChange={(e) => update("format", e.target.value)}
                          className={inputCls}
                        >
                          {FORMAT_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>
                        Tags{" "}
                        <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {TAG_PRESETS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              form.tags.includes(tag)
                                ? "bg-[var(--accent)] text-white"
                                : "bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-[var(--accent-muted)]"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Team & Timeline */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--text)]">
                        Team & Timeline
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Set team constraints and registration deadline.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="tsmin" className={labelCls}>
                          Min team size <span className="text-[var(--error)]">*</span>
                        </label>
                        <input
                          id="tsmin"
                          type="number"
                          min="1"
                          max="20"
                          value={form.team_size_min}
                          onChange={(e) => update("team_size_min", e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor="tsmax" className={labelCls}>
                          Max team size <span className="text-[var(--error)]">*</span>
                        </label>
                        <input
                          id="tsmax"
                          type="number"
                          min="1"
                          max="20"
                          value={form.team_size_max}
                          onChange={(e) => update("team_size_max", e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      The state machine enforces these limits during team formation.
                    </p>

                    <div>
                      <label htmlFor="deadline" className={labelCls}>
                        Registration deadline{" "}
                        <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                      </label>
                      <input
                        id="deadline"
                        type="date"
                        value={form.registration_deadline}
                        onChange={(e) => update("registration_deadline", e.target.value)}
                        className={inputCls}
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        If set, the event automatically transitions from RegistrationOpen to
                        RegistrationClosed when this date passes.
                      </p>
                    </div>
                  </div>
                )}

                {/* STEP 3: Prize & Network */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--text)]">
                        Prize & Network
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Set the prize target and Stellar network. Mainnet uses real XLM.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="prize" className={labelCls}>
                        Prize pool target (XLM){" "}
                        <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                      </label>
                      <input
                        id="prize"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.prize_pool_target}
                        onChange={(e) => update("prize_pool_target", e.target.value)}
                        className={inputCls}
                        placeholder="e.g. 10000"
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        This is the target amount to lock in the Soroban escrow contract. Leave
                        blank to set later.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="net" className={labelCls}>
                        Stellar network <span className="text-[var(--error)]">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {(["testnet", "mainnet"] as const).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => update("network_mode", n)}
                            className={`rounded-lg border-2 p-4 text-left transition-colors ${
                              form.network_mode === n
                                ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                                : "border-[var(--border)] hover:border-[var(--text-muted)]"
                            }`}
                          >
                            <p className="text-sm font-semibold text-[var(--text)] capitalize">
                              {n}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              {n === "testnet"
                                ? "Test XLM only — safe for development"
                                : "Real XLM — irreversible transactions"}
                            </p>
                          </button>
                        ))}
                      </div>
                      {form.network_mode === "mainnet" && (
                        <div className="mt-3 rounded-md bg-[var(--warning-bg)] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-3 py-2">
                          <p className="text-xs text-[var(--warning)] font-medium">
                            ⚠ Mainnet uses real XLM. Disbursements are irreversible once confirmed
                            on-chain.
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="rw" className={labelCls}>
                        Dispute review window (hours) <span className="text-[var(--error)]">*</span>
                      </label>
                      <input
                        id="rw"
                        type="number"
                        min="24"
                        max="168"
                        value={form.review_window_hours}
                        onChange={(e) => update("review_window_hours", e.target.value)}
                        className={inputCls}
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        After judging closes, participants have this long to file disputes before
                        prize disbursement becomes available (24–168 hours).
                      </p>
                    </div>

                    <div>
                      <label htmlFor="split" className={labelCls}>
                        Team prize split policy
                      </label>
                      <select
                        id="split"
                        value={form.prize_split_policy}
                        onChange={(e) => update("prize_split_policy", e.target.value)}
                        className={inputCls}
                      >
                        <option value="captain_receives">Captain receives full amount</option>
                        <option value="equal_split">Split equally among team members</option>
                        <option value="custom">
                          Custom allocation (set during winner assignment)
                        </option>
                      </select>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Determines how prizes are distributed when a team wins.
                      </p>
                    </div>
                  </div>
                )}

                {/* STEP 4: Review */}
                {step === 4 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--text)]">
                        Review & Save Draft
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Your event will be created in Draft state. You can edit details before
                        publishing.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {[
                        {
                          label: "Workspace",
                          value:
                            workspaces.find((w) => w.workspace_id === form.workspace_id)?.name ??
                            "—",
                        },
                        { label: "Title", value: form.title },
                        { label: "Category", value: `${form.category} · ${form.format}` },
                        {
                          label: "Team size",
                          value: `${form.team_size_min}–${form.team_size_max} members`,
                        },
                        {
                          label: "Prize pool",
                          value: form.prize_pool_target
                            ? `${form.prize_pool_target} XLM`
                            : "Not set",
                        },
                        { label: "Network", value: form.network_mode },
                        { label: "Review window", value: `${form.review_window_hours} hours` },
                        {
                          label: "Prize split",
                          value:
                            form.prize_split_policy === "captain_receives"
                              ? "Captain receives"
                              : form.prize_split_policy === "equal_split"
                                ? "Equal split"
                                : "Custom",
                        },
                        {
                          label: "Tags",
                          value: form.tags.length > 0 ? form.tags.join(", ") : "None",
                        },
                        { label: "Deadline", value: form.registration_deadline || "Not set" },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="flex justify-between py-2 border-b border-[var(--border)] last:border-0"
                        >
                          <span className="text-xs text-[var(--text-muted)] font-medium">
                            {label}
                          </span>
                          <span className="text-xs text-[var(--text)] text-right max-w-xs truncate">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] p-4 text-xs text-[var(--text-secondary)]">
                      <p className="font-medium text-[var(--text)] mb-1">What happens next</p>
                      <p>
                        Your event starts in <strong>Draft</strong> state. Assign at least one
                        judge, then publish to open registration. Prize escrow funding happens after
                        winners are finalized.
                      </p>
                    </div>

                    {submitError && (
                      <div
                        className="rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3"
                        role="alert"
                      >
                        <p className="text-sm text-[var(--error)]">{submitError}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Field validation error */}
                {fieldError && (
                  <div
                    className="mt-4 rounded-md border border-[var(--error)] bg-[var(--error-bg)] px-4 py-3"
                    role="alert"
                  >
                    <p className="text-sm text-[var(--error)]">{fieldError}</p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
                  {step > 1 ? <BackButton label="Back" onClick={back} /> : <div />}

                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={advance}
                      className="btn-primary px-5 py-2 text-sm font-medium rounded-md"
                    >
                      Continue →
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="btn-primary px-6 py-2.5 text-sm font-medium rounded-md disabled:opacity-50"
                    >
                      {submitting ? "Saving Draft…" : "Save Draft & Continue"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
