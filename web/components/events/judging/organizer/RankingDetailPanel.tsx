"use client";

import React, { useEffect, useState } from "react";
import { RankingSnapshot } from "./FinalizedScoreboard";
import { X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchSubmissionEvaluationsDetails,
  SubmissionEvaluationDetail,
} from "@/app/actions/judging-analytics.actions";

export function RankingDetailPanel({
  snapshot,
  onClose,
}: {
  snapshot: RankingSnapshot | null;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<SubmissionEvaluationDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadDetails(submissionId: string) {
      setLoading(true);
      const data = await fetchSubmissionEvaluationsDetails(submissionId);
      setDetails(data);
      setLoading(false);
    }

    if (snapshot?.submission_id) {
      loadDetails(snapshot.submission_id);
    }
  }, [snapshot?.submission_id]);

  if (!snapshot) return null;

  return (
    <div className="w-96 border-l bg-background h-full overflow-y-auto flex flex-col shrink-0 animate-in slide-in-from-right">
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <h3 className="font-semibold truncate pr-4">{snapshot.submissions.title}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Core Stats */}
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-4 border-b">
            <span className="text-muted-foreground font-medium">Rank</span>
            <span className="text-2xl font-bold">#{snapshot.ranking}</span>
          </div>

          <div className="flex justify-between items-center pb-4 border-b">
            <span className="text-muted-foreground font-medium">Final Score</span>
            <span className="text-2xl font-bold text-primary">
              {Number(snapshot.total_score).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center pb-4 border-b">
            <span className="text-muted-foreground font-medium">Judges</span>
            <span className="font-medium">{snapshot.judge_count}</span>
          </div>

          <div className="flex justify-between items-center pb-4 border-b">
            <span className="text-muted-foreground font-medium">Strategy</span>
            <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
              {snapshot.strategy}
            </span>
          </div>
        </div>

        {/* Tie Breaker Info */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Tie Break Status
          </h4>
          <div
            className={`p-3 rounded-md text-sm border ${
              snapshot.tie_breaker_reason
                ? snapshot.tie_breaker_reason.includes("Unresolved")
                  ? "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/50 dark:border-orange-900/50 dark:text-orange-300"
                  : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/50 dark:border-blue-900/50 dark:text-blue-300"
                : "bg-muted/50 border-border text-muted-foreground"
            }`}
          >
            {snapshot.tie_breaker_reason || "Not Applied"}
          </div>
        </div>

        {/* Detailed Criterion Breakdown */}
        <div className="pt-4 border-t flex-1 overflow-hidden flex flex-col">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Judge Evaluations
          </h4>

          <div className="flex-1 overflow-y-auto pr-4 -mr-4">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading details...</p>
            ) : details.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No evaluations found.
              </p>
            ) : (
              <div className="space-y-4 pb-4">
                {details.map((evalDetail) => (
                  <div key={evalDetail.id} className="p-4 border rounded-lg bg-muted/20 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-1.5 rounded-full">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{evalDetail.judge_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Status: {evalDetail.status}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {evalDetail.total_score !== null
                            ? evalDetail.total_score.toFixed(2)
                            : "-"}
                        </p>
                        {evalDetail.conflict_of_interest && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                            COI Flagged
                          </span>
                        )}
                      </div>
                    </div>

                    {evalDetail.scores && Object.keys(evalDetail.scores).length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                          Scores
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          {Object.entries(evalDetail.scores).map(([criterionId, score]) => (
                            <div key={criterionId} className="flex justify-between text-sm">
                              <span
                                className="text-muted-foreground truncate pr-2"
                                title={criterionId}
                              >
                                {criterionId}
                              </span>
                              <span className="font-medium font-mono">
                                {Number(score).toFixed(1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {evalDetail.feedback && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                          Feedback
                        </p>
                        <p className="text-sm text-muted-foreground italic bg-background p-2 rounded border line-clamp-3 hover:line-clamp-none transition-all">
                          &quot;{evalDetail.feedback}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
