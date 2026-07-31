"use client";

import React from "react";
import {
  ProjectDetailView,
  ProjectSummary,
} from "@/src/domains/submissions/components/ProjectDetailView";
import { ScoringPanel, ScoringPanelProps } from "./ScoringPanel";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EvaluationWorkspaceClientProps {
  submission: ProjectSummary;
  scoring: ScoringPanelProps;
  navigation: {
    prevSubmissionId: string | null;
    nextSubmissionId: string | null;
    currentIndex: number;
    totalAssigned: number;
  };
  eventId: string;
}

export function EvaluationWorkspaceClient({
  submission,
  scoring,
  navigation,
  eventId,
}: EvaluationWorkspaceClientProps) {
  const router = useRouter();

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      if (e.key === "ArrowLeft" && navigation.prevSubmissionId) {
        router.push(`/events/${eventId}/judge/workspace/${navigation.prevSubmissionId}`);
      } else if (e.key === "ArrowRight" && navigation.nextSubmissionId) {
        router.push(`/events/${eventId}/judge/workspace/${navigation.nextSubmissionId}`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [eventId, navigation, router]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 shrink-0 z-10 relative">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/events/${eventId}/judging`}>
              <X className="w-4 h-4" />
            </Link>
          </Button>
          <div className="text-sm font-medium">Evaluation Workspace</div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Submission {navigation.currentIndex} of {navigation.totalAssigned}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={!navigation.prevSubmissionId} asChild>
              {navigation.prevSubmissionId ? (
                <Link href={`/events/${eventId}/judge/workspace/${navigation.prevSubmissionId}`}>
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              ) : (
                <button disabled>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
            </Button>
            <Button variant="outline" size="icon" disabled={!navigation.nextSubmissionId} asChild>
              {navigation.nextSubmissionId ? (
                <Link href={`/events/${eventId}/judge/workspace/${navigation.nextSubmissionId}`}>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <button disabled>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Split Pane */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Pane: Submission Context */}
        <div className="w-full lg:w-2/3 h-1/2 lg:h-full overflow-hidden border-b lg:border-b-0 lg:border-r bg-background overflow-y-auto">
          <ProjectDetailView project={submission} hideBackButton={true} />
        </div>

        {/* Right Pane: Scoring */}
        <div className="w-full lg:w-1/3 h-1/2 lg:h-full overflow-hidden bg-background">
          <ScoringPanel {...scoring} />
        </div>
      </div>
    </div>
  );
}
