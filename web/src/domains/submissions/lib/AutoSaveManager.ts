type SaveTask = {
  requirementId: string;
  assetData: Record<string, unknown>;
};

export class AutoSaveManager {
  private queue: Map<string, SaveTask> = new Map();
  private timeoutId: NodeJS.Timeout | null = null;
  private isSaving = false;
  private saveCallback: (tasks: SaveTask[]) => Promise<void>;
  private debounceMs: number;

  constructor(saveCallback: (tasks: SaveTask[]) => Promise<void>, debounceMs = 1000) {
    this.saveCallback = saveCallback;
    this.debounceMs = debounceMs;
  }

  enqueue(requirementId: string, assetData: Record<string, unknown>) {
    // Overwrite any existing task for this requirement to only save the latest
    this.queue.set(requirementId, { requirementId, assetData });

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => this.processQueue(), this.debounceMs);
  }

  private async processQueue() {
    if (this.queue.size === 0 || this.isSaving) return;

    this.isSaving = true;
    const tasksToProcess = Array.from(this.queue.values());
    this.queue.clear();

    try {
      await this.saveCallback(tasksToProcess);
    } catch (error) {
      console.error("AutoSave failed, requeuing", error);
      // Requeue failed tasks if they haven't been overwritten
      tasksToProcess.forEach((task) => {
        if (!this.queue.has(task.requirementId)) {
          this.queue.set(task.requirementId, task);
        }
      });
      // Optionally trigger a backoff retry here
    } finally {
      this.isSaving = false;
      if (this.queue.size > 0) {
        this.processQueue();
      }
    }
  }

  flush() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    return this.processQueue();
  }
}
