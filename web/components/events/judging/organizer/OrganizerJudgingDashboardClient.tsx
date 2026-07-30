"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  fetchJudgingAnalytics,
  finalizeEventAction,
  fetchJudgeAssignments,
  type JudgeAssignmentData,
} from "@/app/actions/judging-analytics.actions";
import { JudgingProgressStats, ProgressData } from "./JudgingProgressStats";
import { RankingPreviewTable, LiveRankingData } from "./RankingPreviewTable";
import { FinalizationActionBox } from "./FinalizationActionBox";
import { FinalizedScoreboard, RankingSnapshot } from "./FinalizedScoreboard";
import { RankingDetailPanel } from "./RankingDetailPanel";
import { JudgeAssignmentsTable } from "./JudgeAssignmentsTable";
import { AssignJudgesDialog } from "./AssignJudgesDialog";
import { RubricConfigDialog } from "./RubricConfigDialog";

interface Props {
  eventId: string;
  expectedVersion: number;
  isCompleted: boolean;
  initialData: {
    progress: ProgressData;
    liveRankings: LiveRankingData[];
    snapshots: RankingSnapshot[];
    refreshedAt: string;
    assignments: JudgeAssignmentData[];
  };
}

export function OrganizerJudgingDashboardClient({
  eventId,
  expectedVersion,
  isCompleted,
  initialData,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [selectedSnapshot, setSelectedSnapshot] = useState<RankingSnapshot | null>(null);

  const handleRefresh = async () => {
    startTransition(async () => {
      try {
        const [newData, newAssignments] = await Promise.all([
          fetchJudgingAnalytics(eventId),
          fetchJudgeAssignments(eventId),
        ]);
        setData({ ...newData, assignments: newAssignments });
      } catch (err) {
        console.error("Failed to refresh analytics", err);
      }
    });
  };

  // Optional: Auto-refresh every 60 seconds if judging is active
  useEffect(() => {
    if (isCompleted) return;
    const interval = setInterval(() => {
      handleRefresh();
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted]);

  const handleFinalize = async () => {
    try {
      await finalizeEventAction(eventId, expectedVersion);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Finalization failed: ${msg}`);
    }
  };

  const hasTies = data.liveRankings.some(
    (r, i, arr) => i > 0 && r.average_score === arr[i - 1]?.average_score,
  );
  const isFinalizationDisabled = data.progress.count_draft > 0 || data.progress.count_flagged > 0;

  let warningMessage = "";
  if (isFinalizationDisabled) {
    warningMessage = "You cannot finalize while there are Draft or Flagged evaluations.";
  } else if (hasTies) {
    warningMessage =
      "There are unresolved ties. The Ranking Engine will attempt to break them using weights and judge counts.";
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-6 space-y-8 max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Judging Dashboard</h2>
              <p className="text-muted-foreground mt-1">
                Monitor evaluation progress and finalize rankings.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Last updated: {new Date(data.refreshedAt).toLocaleTimeString()}
              </span>
              {!isCompleted && (
                <>
                  <RubricConfigDialog eventId={eventId} isCompleted={isCompleted} />
                  <AssignJudgesDialog eventId={eventId} />
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isPending}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
                    Refresh Data
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Body */}
          {isCompleted ? (
            <FinalizedScoreboard snapshots={data.snapshots} onSelect={setSelectedSnapshot} />
          ) : (
            <>
              <JudgingProgressStats data={data.progress} />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Judge Workload & Assignments</h3>
                <JudgeAssignmentsTable
                  eventId={eventId}
                  assignments={data.assignments || []}
                  isCompleted={isCompleted}
                />
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-semibold">Live Ranking Preview</h3>
                <RankingPreviewTable
                  rankings={data.liveRankings}
                  onSelect={(subId) => {
                    const r = data.liveRankings.find((x) => x.submission_id === subId);
                    if (r) {
                      setSelectedSnapshot({
                        submission_id: r.submission_id,
                        ranking: data.liveRankings.indexOf(r) + 1,
                        total_score: r.average_score || 0,
                        judge_count: r.judge_count,
                        strategy: "Average",
                        tie_breaker_reason: null,
                        submissions: { title: r.title },
                      } as unknown as import("./FinalizedScoreboard").RankingSnapshot);
                    }
                  }}
                />
              </div>

              <div className="pt-8">
                <FinalizationActionBox
                  onFinalize={handleFinalize}
                  disabled={isFinalizationDisabled}
                  warningMessage={warningMessage}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <RankingDetailPanel snapshot={selectedSnapshot} onClose={() => setSelectedSnapshot(null)} />
    </div>
  );
}
