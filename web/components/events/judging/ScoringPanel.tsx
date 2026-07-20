'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Save, Send } from 'lucide-react';
import { saveEvaluationDraftAction, submitEvaluationAction, declareConflictAction } from '@/app/actions/judging.actions';
import { EvaluationScores, CriterionScore } from '@/src/domains/judging/domain/EvaluationAggregate';
import { ScoreCalculator } from '@/src/domains/judging/domain/ScoreCalculator';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface ScoringPanelProps {
  evaluationId: string;
  eventId: string;
  submissionId: string;
  initialScores: EvaluationScores;
  expectedVersion: number;
  rubric: {
    id: string;
    name: string;
    maxScore: number;
    weight: number;
    required: boolean;
  }[];
  isReadOnly?: boolean;
}

export function ScoringPanel({
  evaluationId,
  eventId,
  submissionId,
  initialScores,
  expectedVersion: initialVersion,
  rubric,
  isReadOnly = false,
}: ScoringPanelProps) {
  const router = useRouter();
  
  const [scores, setScores] = useState<CriterionScore[]>(initialScores.criteria || []);
  const [draftNotes, setDraftNotes] = useState<string>('');
  
  const [version, setVersion] = useState(initialVersion);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [conflictError, setConflictError] = useState<string | null>(null);
  
  const [validationResult, setValidationResult] = useState(() => 
    ScoreCalculator.validateScores(initialScores.criteria || [], rubric.filter(r => r.required).map(r => r.id))
  );

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  // Debounced Save
  const triggerAutosave = useCallback(() => {
    if (isReadOnly || conflictError) return;
    
    setSaveState('saving');
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(async () => {
      const payload: EvaluationScores = { criteria: scores };
      const res = await saveEvaluationDraftAction(
        evaluationId,
        payload,
        draftNotes,
        version,
        eventId,
        submissionId
      );
      
      if (res.success) {
        setSaveState('saved');
        setVersion(v => v + 1);
        setTimeout(() => setSaveState('idle'), 2000);
      } else if (res.conflict) {
        setSaveState('error');
        setConflictError(res.error || 'Draft is out of date.');
      } else {
        setSaveState('error');
      }
    }, 2000);
  }, [scores, draftNotes, version, evaluationId, eventId, submissionId, isReadOnly, conflictError]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // Validate on change
    const requiredIds = rubric.filter(r => r.required).map(r => r.id);
    setValidationResult(ScoreCalculator.validateScores(scores, requiredIds));
    
    triggerAutosave();
  }, [scores, draftNotes, triggerAutosave, rubric]);

  // Cleanup on unmount (best effort save could go here using beacon/fetch keepalive, but simple unmount timeout clear for now)
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleScoreChange = (criterionId: string, value: string, maxScore: number, weight: number) => {
    if (isReadOnly) return;
    
    const numValue = value === '' ? NaN : Number(value);
    setScores(prev => {
      const existing = prev.find(p => p.criterionId === criterionId);
      if (existing) {
        return prev.map(p => p.criterionId === criterionId ? { ...p, score: numValue } : p);
      } else {
        return [...prev, { criterionId, score: numValue, maxScore, weight }];
      }
    });
  };

  const handleCommentChange = (criterionId: string, comment: string) => {
    if (isReadOnly) return;
    
    setScores(prev => {
      const existing = prev.find(p => p.criterionId === criterionId);
      if (existing) {
        return prev.map(p => p.criterionId === criterionId ? { ...p, comment } : p);
      } else {
        // Technically shouldn't have comment without score in typical UI flow, but allowed in state
        return prev;
      }
    });
  };

  const handleSubmit = async () => {
    if (isReadOnly || !validationResult.isValid) return;
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    setSaveState('saving');
    const payload: EvaluationScores = { criteria: scores };
    
    const res = await submitEvaluationAction(
      evaluationId,
      payload,
      undefined, // Participant feedback (omitted for now)
      draftNotes, // We map draftNotes to organizerNotes upon submission as an example
      validationResult.totalScore,
      version,
      eventId,
      submissionId
    );

    if (res.success) {
      setSaveState('saved');
      // Router refresh is handled by server action redirect/revalidate
      // But we can force a local refresh to get the new status
      router.refresh();
    } else if (res.conflict) {
      setSaveState('error');
      setConflictError(res.error || 'Draft is out of date.');
    } else {
      setSaveState('error');
      alert(`Submit failed: ${res.error}`);
    }
  };

  const refreshDraft = () => {
    router.refresh();
    setConflictError(null);
  };

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="p-4 border-b shadow-sm flex items-center justify-between sticky top-0 bg-background z-10">
        <div>
          <h2 className="font-semibold text-lg">Evaluation Rubric</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <span className="font-medium text-foreground">Total: {validationResult.totalScore.toFixed(2)}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              {saveState === 'saving' && <span className="animate-pulse">Saving...</span>}
              {saveState === 'saved' && <><CheckCircle2 className="w-3 h-3 text-green-500" /> <span className="text-green-600">Saved just now</span></>}
              {saveState === 'idle' && <span>Draft</span>}
              {saveState === 'error' && <span className="text-red-500">Save failed</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {conflictError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Conflict Detected</AlertTitle>
            <AlertDescription>
              {conflictError} <br/>
              <Button variant="outline" size="sm" className="mt-2 text-foreground" onClick={refreshDraft}>
                Refresh Draft
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {rubric.map(crit => {
          const scoreEntry = scores.find(s => s.criterionId === crit.id);
          const currentScore = scoreEntry?.score;
          const currentComment = scoreEntry?.comment || '';
          
          const isError = currentScore !== undefined && !isNaN(currentScore) && (currentScore < 0 || currentScore > crit.maxScore);

          return (
            <Card key={crit.id} className={`p-4 ${isError ? 'border-red-500' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <Label className="text-base font-semibold">
                    {crit.name} {crit.required && <span className="text-red-500">*</span>}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">Weight: {crit.weight}x • Max: {crit.maxScore}</p>
                </div>
                <div className="w-24">
                  <Input 
                    type="number" 
                    min={0} 
                    max={crit.maxScore} 
                    step={0.1}
                    value={currentScore === undefined || isNaN(currentScore) ? '' : currentScore}
                    onChange={(e) => handleScoreChange(crit.id, e.target.value, crit.maxScore, crit.weight)}
                    placeholder="0.0"
                    disabled={isReadOnly}
                    className={`text-right ${isError ? 'border-red-500' : ''}`}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Textarea 
                  placeholder="Private notes for this criterion..." 
                  className="min-h-[60px] text-sm resize-y"
                  value={currentComment}
                  onChange={(e) => handleCommentChange(crit.id, e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </Card>
          );
        })}

        <div className="pt-4 border-t">
          <Label className="mb-2 block font-semibold">Overall Private Notes</Label>
          <Textarea 
            placeholder="Notes visible only to organizers..." 
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            disabled={isReadOnly}
            className="min-h-[100px]"
          />
        </div>
      </div>

      <div className="p-4 border-t bg-muted/30">
        {!validationResult.isValid && !isReadOnly && (
          <div className="mb-3 text-sm text-red-500 bg-red-500/10 p-2 rounded flex flex-col gap-1">
            <span className="font-semibold flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Validation Errors:</span>
            <ul className="list-disc pl-5">
              {validationResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="flex gap-2">
          {!isReadOnly && (
            <Button 
              className="flex-1" 
              onClick={handleSubmit} 
              disabled={!validationResult.isValid || saveState === 'saving' || !!conflictError}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Evaluation
            </Button>
          )}
          {isReadOnly && (
            <Button className="flex-1" disabled variant="secondary">
              Evaluation Submitted
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
