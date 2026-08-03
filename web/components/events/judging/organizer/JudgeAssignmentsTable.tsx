"use client";

import React, { useState } from "react";
import { JudgeAssignmentData } from "@/app/actions/judging-analytics.actions";
import { unassignJudgeAction } from "@/app/actions/judging.actions";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Props {
  eventId: string;
  assignments: JudgeAssignmentData[];
  isCompleted: boolean;
}

export function JudgeAssignmentsTable({ eventId, assignments, isCompleted }: Props) {
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [confirmUnassignId, setConfirmUnassignId] = useState<string | null>(null);
  const [unassignError, setUnassignError] = useState<string | null>(null);

  const handleUnassign = async (evaluationId: string) => {
    setConfirmUnassignId(null);
    setUnassigningId(evaluationId);
    setUnassignError(null);
    try {
      const res = await unassignJudgeAction(evaluationId, eventId);
      if (!res.success) {
        setUnassignError("Failed to unassign judge: " + (res.error ?? "unknown error"));
      }
    } catch {
      setUnassignError("An unexpected error occurred while unassigning the judge.");
    } finally {
      setUnassigningId(null);
    }
  };

  if (assignments.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-muted-foreground border border-dashed">
        No judges have been assigned to any submissions yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {unassignError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 flex justify-between items-center text-sm text-destructive"
        >
          <span>{unassignError}</span>
          <button onClick={() => setUnassignError(null)} className="text-xs hover:underline ml-3">
            ✕
          </button>
        </div>
      )}
      <div className="card overflow-hidden border rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Judge</th>
                <th className="px-4 py-3 font-medium">Submission</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Score</th>
                {!isCompleted && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {assignments.map((assignment) => (
                <tr key={assignment.evaluation_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{assignment.judge_name}</td>
                  <td
                    className="px-4 py-3 max-w-[200px] truncate"
                    title={assignment.submission_title}
                  >
                    {assignment.submission_title}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={assignment.status}
                      conflict={assignment.conflict_of_interest}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {assignment.total_score !== null ? assignment.total_score : "-"}
                  </td>
                  {!isCompleted && (
                    <td className="px-4 py-3 text-right">
                      {confirmUnassignId === assignment.evaluation_id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleUnassign(assignment.evaluation_id)}
                            className="text-xs font-medium text-destructive hover:underline"
                          >
                            Unassign
                          </button>
                          <button
                            onClick={() => setConfirmUnassignId(null)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Unassign Judge"
                          disabled={
                            unassigningId === assignment.evaluation_id ||
                            assignment.status === "Finalized"
                          }
                          onClick={() => setConfirmUnassignId(assignment.evaluation_id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, conflict }: { status: string; conflict: boolean }) {
  if (conflict) {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-500/10 text-red-500">
        Flagged (Conflict)
      </span>
    );
  }

  const s = (status || "").toLowerCase();
  let cls = "bg-muted text-muted-foreground";

  if (s === "submitted" || s === "finalized") {
    cls = "bg-green-500/10 text-green-500";
  } else if (s === "draft") {
    cls = "bg-yellow-500/10 text-yellow-500";
  } else if (s === "assigned") {
    cls = "bg-blue-500/10 text-blue-500";
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{status}</span>
  );
}
