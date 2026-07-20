import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface FinalizationActionBoxProps {
  onFinalize: () => Promise<void>;
  disabled: boolean;
  warningMessage?: string;
}

export function FinalizationActionBox({ onFinalize, disabled, warningMessage }: FinalizationActionBoxProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    if (confirmText !== 'FINALIZE') return;
    setIsSubmitting(true);
    try {
      await onFinalize();
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card p-6 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">Finalize Judging & Generate Rankings</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            This action will permanently lock all submitted evaluations, generate the final ranking snapshots, and transition the event out of the Judging phase. 
            This action cannot be undone.
          </p>
          {warningMessage && (
            <div className="flex items-center gap-2 mt-3 text-orange-600 dark:text-orange-400 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              {warningMessage}
            </div>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" disabled={disabled}>
              Finalize Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This will lock all evaluations and freeze the rankings permanently. 
                Draft and Flagged evaluations will be ignored.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Type <strong>FINALIZE</strong> to confirm:
                </label>
                <Input 
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="FINALIZE"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirm}
                disabled={confirmText !== 'FINALIZE' || isSubmitting}
              >
                {isSubmitting ? 'Finalizing...' : 'Confirm Finalization'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
