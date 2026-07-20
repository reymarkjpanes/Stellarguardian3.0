import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface LiveRankingData {
  submission_id: string;
  title: string;
  judge_count: number;
  average_score: number | null;
}

export function RankingPreviewTable({ 
  rankings, 
  onSelect 
}: { 
  rankings: LiveRankingData[];
  onSelect: (submissionId: string) => void;
}) {
  return (
    <div className="rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Submission</TableHead>
            <TableHead className="text-right">Judges</TableHead>
            <TableHead className="text-right">Avg Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rankings.map((r, index) => {
            const isTied = index > 0 && rankings[index - 1]?.average_score === r.average_score;
            
            return (
              <TableRow 
                key={r.submission_id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect(r.submission_id)}
              >
                <TableCell className="font-medium text-center">
                  {index + 1}
                </TableCell>
                <TableCell>
                  {r.title}
                  {isTied && (
                    <span className="ml-2 inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                      Unresolved Tie
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">{r.judge_count}</TableCell>
                <TableCell className="text-right font-bold">
                  {r.average_score !== null ? Number(r.average_score).toFixed(2) : '-'}
                </TableCell>
              </TableRow>
            );
          })}
          {rankings.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                No submitted evaluations yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
