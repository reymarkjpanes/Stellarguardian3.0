import React, { useState } from 'react';
import { Button, Input, Textarea, Badge, EmptyState } from '../ui';
import { CheckCircle2, Trophy, Award } from 'lucide-react';
import { Event, Submission } from '../../types';
import { EventStatus } from '../../lib/eventStatus';
import { fetchApi } from '../../lib/api';
import { toast } from 'sonner';

interface JudgingTabProps {
  event: Event;
  user: any;
  onUpdate: () => void;
}

export function JudgingTab({ event, user, onUpdate }: JudgingTabProps) {
  const [scores, setScores] = useState<Record<number, { score: number, feedback: string }>>({});
  const [loading, setLoading] = useState(false);
  
  // Winner picking state
  const [winners, setWinners] = useState<Record<number, { rank: number, prizeAmount: number }>>({});

  const isJudge = event.myMembership?.role === 'Judge' && event.myMembership.status === 'accepted';
  const isHost = event.hostUserId === user?.id;
  const isJudging = EventStatus.isJudging(event.state);
  
  const handleScoreChange = (subId: number, field: 'score' | 'feedback', value: string) => {
    setScores(prev => ({
      ...prev,
      [subId]: {
        ...prev[subId],
        [field]: field === 'score' ? parseInt(value) || 0 : value
      }
    }));
  };

  const submitScore = async (subId: number) => {
    const data = scores[subId];
    if (!data?.score || data.score < 1 || data.score > 10) {
      toast.error('Please enter a valid score between 1 and 10');
      return;
    }
    
    setLoading(true);
    try {
      await fetchApi(`/events/${event.id}/submissions/${subId}/score`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      toast.success('Score submitted successfully!');
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWinnerChange = (subId: number, field: 'rank' | 'prizeAmount', value: string) => {
    setWinners(prev => ({
      ...prev,
      [subId]: {
        ...prev[subId],
        [field]: parseInt(value) || 0
      }
    }));
  };

  const finalizeWinners = async () => {
    const winnersList = Object.entries(winners)
      .filter(([_, data]) => data.rank > 0)
      .map(([subId, data]) => ({
        submissionId: parseInt(subId),
        rank: data.rank,
        prizeAmount: data.prizeAmount
      }));

    if (winnersList.length === 0) {
      toast.error('Please assign at least one winner before completing the event.');
      return;
    }

    setLoading(true);
    try {
      await fetchApi(`/events/${event.id}/winners`, {
        method: 'POST',
        body: JSON.stringify({ winners: winnersList })
      });
      toast.success('Winners finalized! Event is now completed.');
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to find my score for a submission
  const getMyEval = (subId: number) => event.evaluations?.find(e => e.submissionId === subId && e.judgeId === user?.id);

  if (!EventStatus.isJudging(event.state) && !EventStatus.isCompleted(event.state)) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Judging Not Started"
        description="The judging phase has not started yet."
      />
    );
  }

  return (
    <div className="space-y-8">
      {isJudge && isJudging && (
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Rate Submissions</h3>
          {event.submissions.length === 0 ? (
            <p className="text-slate-500 text-sm">No submissions to rate.</p>
          ) : (
            <div className="space-y-6">
              {event.submissions.map(sub => {
                const myEval = getMyEval(sub.id);
                return (
                  <div key={sub.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-slate-900">{sub.title}</h4>
                        <a href={sub.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm hover:underline">View Project</a>
                      </div>
                      {myEval && <Badge variant="success">Scored: {myEval.score}/10</Badge>}
                    </div>
                    <p className="text-sm text-slate-600 mb-4">{sub.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="md:col-span-1">
                        <Input
                          type="number"
                          label="Score (1-10)"
                          min="1"
                          max="10"
                          defaultValue={myEval?.score || ''}
                          onChange={e => handleScoreChange(sub.id, 'score', e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          label="Feedback"
                          placeholder="Optional comments..."
                          defaultValue={myEval?.feedback || ''}
                          onChange={e => handleScoreChange(sub.id, 'feedback', e.target.value)}
                        />
                      </div>
                      <div>
                        <Button className="w-full" onClick={() => submitScore(sub.id)} disabled={loading}>
                          {myEval ? 'Update Score' : 'Submit Score'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isHost && isJudging && (
        <div className="bg-white p-6 border border-amber-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Finalize Winners
          </h3>
          <p className="text-sm text-slate-600 mb-6">Review scores and select the winners to complete the event.</p>
          
          <div className="space-y-6 mb-6">
            {event.submissions.map(sub => {
              const evals = event.evaluations?.filter(e => e.submissionId === sub.id) || [];
              const avgScore = evals.length > 0 ? evals.reduce((acc, curr) => acc + curr.score, 0) / evals.length : 0;
              
              return (
                <div key={sub.id} className="p-4 border border-slate-200 rounded-lg">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-full">
                      <h4 className="font-bold text-slate-900">{sub.title}</h4>
                      <p className="text-sm text-slate-500 mb-3">Avg Score: <strong className="text-slate-900">{avgScore.toFixed(1)}</strong> ({evals.length} ratings)</p>
                      
                      {evals.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 space-y-2">
                          {evals.map(e => (
                            <div key={e.id} className="text-sm flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/60 pb-2 last:border-0 last:pb-0">
                              <div className="flex items-center gap-2 mb-1 sm:mb-0">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                  {e.judgeName?.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-700">{e.judgeName}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-amber-600 font-bold">{e.score}/10</span>
                                {e.feedback && <span className="text-slate-500 italic truncate max-w-[200px]" title={e.feedback}>"{e.feedback}"</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-4 items-end bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                    <div className="w-24">
                      <Input
                        type="number"
                        label="Rank (1 = 1st)"
                        min="1"
                        onChange={e => handleWinnerChange(sub.id, 'rank', e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        type="number"
                        label="Prize Amount (XLM)"
                        min="0"
                        onChange={e => handleWinnerChange(sub.id, 'prizeAmount', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <Button onClick={finalizeWinners} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
            <Award className="w-4 h-4 mr-2" />
            Complete Event & Set Winners
          </Button>
        </div>
      )}
      
      {EventStatus.isCompleted(event.state) && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-8 rounded-xl shadow-md text-white">
          <Trophy className="w-12 h-12 mb-4 opacity-90" />
          <h2 className="text-2xl font-black mb-6">Official Winners</h2>
          
          <div className="space-y-4">
            {event.winners?.map(w => (
              <div key={w.id} className="bg-white/10 p-4 rounded-lg flex items-center justify-between backdrop-blur-sm border border-white/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-400 text-yellow-900 font-black flex items-center justify-center text-xl">
                    {w.rank}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{w.submissionTitle}</h4>
                    <p className="text-emerald-100 text-sm">By {w.teamName || w.submitterName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-xl">{w.prizeAmount} XLM</div>
                  <div className="text-xs text-emerald-200 font-medium uppercase tracking-wider">Prize</div>
                </div>
              </div>
            ))}
            
            {event.winners?.length === 0 && (
              <p className="text-emerald-100">No winners were selected for this event.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
