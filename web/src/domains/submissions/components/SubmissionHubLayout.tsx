import React from "react";
import { SubmissionHeader } from "./SubmissionHeader";
import { ProgressiveChecklist } from "./ProgressiveChecklist";
import { ValidationPanel } from "./ValidationPanel";
import { SubmissionActivityTimeline } from "./SubmissionActivityTimeline";
import { useSubmissionController } from "../hooks/useSubmissionController";

export function SubmissionHubLayout({
  eventId,
  teamId,
  teamName,
  eventName,
  deadline,
}: {
  eventId: string;
  teamId: string;
  teamName: string;
  eventName: string;
  deadline: string | null;
}) {
  const {
    hubData,
    isLoadingHub,
    validationResult,
    connectionStatus,
    isCaptain,
    activities,
    saveAsset,
    uploadAsset,
    submit,
    unsubmit,
    removeAsset,
    isSubmitting,
    isUnsubmitting,
  } = useSubmissionController(eventId, teamId);

  if (isLoadingHub) {
    return (
      <div className="card p-12 text-center text-[var(--text-muted)] text-sm">
        Loading submission…
      </div>
    );
  }

  const requirements = hubData?.requirements ?? [];
  const assets = hubData?.assets ?? [];
  const version = hubData?.submission?.version ?? 1;
  const status: string = hubData?.submission?.status ?? "NOT_STARTED";

  return (
    <div className="space-y-0 bg-[var(--bg)]">
      {/* Sticky header: team, event, save status, version, deadline */}
      <SubmissionHeader
        teamName={teamName}
        eventName={eventName}
        status={connectionStatus}
        version={version}
        deadline={deadline ? new Date(deadline) : null}
      />

      <div className="max-w-7xl w-full mx-auto px-4 py-8">
        {/* Submitted / locked confirmation banner */}
        {(status === "SUBMITTED" || status === "Submitted" || status === "LOCKED") && (
          <div className="rounded-lg border border-[var(--success)] bg-[var(--success-bg)] p-6 text-center mb-8 flex flex-col items-center gap-3">
            <div>
              <p className="text-lg font-semibold text-[var(--success)]">Project Submitted ✓</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Your project is locked and queued for review. Good luck!
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main column: requirements checklist + timeline */}
          <div className="lg:col-span-8 space-y-8">
            <div>
              <h2 className="text-base font-semibold text-[var(--text)] mb-4">
                Project Requirements
              </h2>
              {requirements.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-sm text-[var(--text-muted)]">
                    No requirements configured for this event yet. Check back soon.
                  </p>
                </div>
              ) : (
                <ProgressiveChecklist
                  requirements={requirements}
                  assets={assets}
                  onSave={saveAsset}
                  onUpload={uploadAsset}
                  onRemove={removeAsset}
                  isLocked={status === "SUBMITTED" || status === "Submitted" || status === "LOCKED"}
                />
              )}
            </div>

            {/* Activity timeline */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Activity</h3>
              <SubmissionActivityTimeline activities={activities} />
            </div>
          </div>

          {/* Sidebar: validation + submit */}
          <div className="lg:col-span-4">
            <ValidationPanel
              validationResult={validationResult}
              onSubmit={submit}
              onUnsubmit={unsubmit}
              isSubmitting={isSubmitting}
              isUnsubmitting={isUnsubmitting}
              isCaptain={isCaptain}
              status={status}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
