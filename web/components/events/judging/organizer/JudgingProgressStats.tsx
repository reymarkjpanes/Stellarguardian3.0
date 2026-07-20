import React from 'react';

export interface ProgressData {
  total_assigned: number;
  count_draft: number;
  count_completed: number;
  count_flagged: number;
}

export function JudgingProgressStats({ data }: { data: ProgressData }) {
  const completionPercentage = data.total_assigned > 0 
    ? Math.round((data.count_completed / data.total_assigned) * 100) 
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="card p-6">
        <h4 className="text-sm font-medium text-muted-foreground">Total Assigned</h4>
        <p className="text-3xl font-bold mt-2">{data.total_assigned}</p>
      </div>
      <div className="card p-6">
        <h4 className="text-sm font-medium text-muted-foreground">Completed</h4>
        <p className="text-3xl font-bold mt-2 text-green-600 dark:text-green-400">
          {data.count_completed}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{completionPercentage}%</p>
      </div>
      <div className="card p-6">
        <h4 className="text-sm font-medium text-muted-foreground">Draft / Missing</h4>
        <p className="text-3xl font-bold mt-2 text-orange-600 dark:text-orange-400">
          {data.count_draft}
        </p>
      </div>
      <div className="card p-6">
        <h4 className="text-sm font-medium text-muted-foreground">Flagged</h4>
        <p className="text-3xl font-bold mt-2 text-red-600 dark:text-red-400">
          {data.count_flagged}
        </p>
      </div>
    </div>
  );
}
