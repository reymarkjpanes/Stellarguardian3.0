import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface RankingSnapshot {
  id: string;
  submission_id: string;
  submissions: { title: string };
  total_score: number;
  normalized_score: number;
  judge_count: number;
  ranking: number;
  tie_breaker_reason: string | null;
  strategy: string;
}

export function FinalizedScoreboard({ 
  snapshots, 
  onSelect 
}: { 
  snapshots: RankingSnapshot[];
  onSelect: (snapshot: RankingSnapshot) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900 rounded-md p-4">
        <h3 className="text-green-800 dark:text-green-400 font-medium">Event Finalized</h3>
        <p className="text-sm text-green-700 dark:text-green-500 mt-1">
          Judging is complete and rankings have been immutably frozen.
        </p>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Submission</TableHead>
              <TableHead className="text-right">Judges</TableHead>
              <TableHead className="text-right">Final Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshots.map((s) => (
              <TableRow 
                key={s.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect(s)}
              >
                <TableCell className="font-medium text-center text-lg">
                  {s.ranking === 1 ? '🥇 ' : s.ranking === 2 ? '🥈 ' : s.ranking === 3 ? '🥉 ' : ''}
                  {s.ranking}
                </TableCell>
                <TableCell>
                  {s.submissions.title}
                  {s.tie_breaker_reason && s.tie_breaker_reason.includes('Unresolved') && (
                    <span className="ml-2 inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                      Tie
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">{s.judge_count}</TableCell>
                <TableCell className="text-right font-bold text-primary">
                  {Number(s.total_score).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
