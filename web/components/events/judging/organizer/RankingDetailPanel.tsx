import React from 'react';
import { RankingSnapshot } from './FinalizedScoreboard';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RankingDetailPanel({ 
  snapshot, 
  onClose 
}: { 
  snapshot: RankingSnapshot | null;
  onClose: () => void;
}) {
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
          <div className={`p-3 rounded-md text-sm border ${
            snapshot.tie_breaker_reason 
              ? snapshot.tie_breaker_reason.includes('Unresolved')
                ? 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/50 dark:border-orange-900/50 dark:text-orange-300'
                : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/50 dark:border-blue-900/50 dark:text-blue-300'
              : 'bg-muted/50 border-border text-muted-foreground'
          }`}>
            {snapshot.tie_breaker_reason || 'Not Applied'}
          </div>
        </div>

        {/* Placeholder for future detailed criterion breakdown */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Detailed criterion breakdowns per judge are stored securely. 
            (Available in future expansion)
          </p>
        </div>
      </div>
    </div>
  );
}
