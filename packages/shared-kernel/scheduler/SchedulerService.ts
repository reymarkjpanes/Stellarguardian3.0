export interface ScheduledJob {
  id: string;
  type: string;
  payload: any;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  scheduledFor: Date;
  processedAt?: Date;
  error?: string;
}

export interface SchedulerService {
  scheduleJob(type: string, payload: any, scheduledFor: Date): Promise<string>;
  cancelJob(jobId: string): Promise<void>;
  
  // Handlers for the Edge Function pulling pending jobs
  getPendingJobs(limit: number): Promise<ScheduledJob[]>;
  markJobCompleted(jobId: string): Promise<void>;
  markJobFailed(jobId: string, error: string): Promise<void>;
}
