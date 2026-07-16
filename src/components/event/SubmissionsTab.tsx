import React, { useState } from 'react';
import { Button, Input, Textarea, EmptyState, Badge } from '../ui';
import { FileText, Send, Link as LinkIcon, Edit2 } from 'lucide-react';
import { Event, Submission } from '../../types';
import { EventStatus } from '../../lib/eventStatus';
import { fetchApi } from '../../lib/api';
import { toast } from 'sonner';

interface SubmissionsTabProps {
  event: Event;
  user: any;
  onUpdate: () => void;
}

export function SubmissionsTab({ event, user, onUpdate }: SubmissionsTabProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const isParticipant = event.myMembership?.role === 'Participant' && event.myMembership.status === 'accepted';
  const isInProgress = EventStatus.isInProgress(event.state);
  const isJudging = EventStatus.isJudging(event.state);
  const isCompleted = EventStatus.isCompleted(event.state);
  
  const mySubmissions = event.submissions.filter(s => s.userId === user?.id);
  const otherSubmissions = event.submissions.filter(s => s.userId !== user?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim() || !description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      if (editingId) {
        await fetchApi(`/events/${event.id}/submissions/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ title, description, url })
        });
        toast.success('Submission updated successfully!');
      } else {
        await fetchApi(`/events/${event.id}/submissions`, {
          method: 'POST',
          body: JSON.stringify({ title, description, url })
        });
        toast.success('Project submitted successfully!');
      }
      setEditingId(null);
      setTitle('');
      setUrl('');
      setDescription('');
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (sub: Submission) => {
    setEditingId(sub.id);
    setTitle(sub.title);
    setDescription(sub.description);
    setUrl(sub.url);
  };

  return (
    <div className="space-y-8">
      {isParticipant && isInProgress && (
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-500" />
            {editingId ? 'Edit Submission' : 'Submit Project'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Project Title"
              placeholder="e.g. HealthTracker App"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <Input
              label="Project URL (GitHub, Figma, Demo)"
              placeholder="https://..."
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
            <Textarea
              label="Description"
              placeholder="Briefly describe what you built..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {editingId ? 'Save Changes' : 'Submit Project'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => {
                  setEditingId(null);
                  setTitle('');
                  setDescription('');
                  setUrl('');
                }}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </div>
      )}

      {isParticipant && mySubmissions.length > 0 && (
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">My Submissions</h3>
          <div className="space-y-4">
            {mySubmissions.map(sub => (
              <div key={sub.id} className="p-4 border border-indigo-100 bg-indigo-50/50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-slate-900 text-lg">{sub.title}</h4>
                  {isInProgress && (
                    <Button variant="outline" size="sm" onClick={() => startEdit(sub)}>
                      <Edit2 className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  )}
                </div>
                <a href={sub.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm hover:underline flex items-center gap-1 mb-3">
                  <LinkIcon className="w-3 h-3" /> {sub.url}
                </a>
                <p className="text-sm text-slate-600">{sub.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(isJudging || isCompleted) && event.submissions.length > 0 && (
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            All Submissions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {event.submissions.map(sub => (
              <div key={sub.id} className="p-4 border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-slate-900">{sub.title}</h4>
                  {sub.teamName && (
                    <Badge variant="neutral" className="text-xs">{sub.teamName}</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-2">By: {sub.submitterName}</p>
                <a href={sub.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-sm hover:underline flex items-center gap-1 mb-3">
                  <LinkIcon className="w-3 h-3" /> View Project
                </a>
                <p className="text-sm text-slate-600 line-clamp-3 mb-3">{sub.description}</p>
                {(isJudging || isCompleted) && sub.evaluationCount !== undefined && (
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Evaluations</span>
                      <span className="text-sm font-semibold text-slate-700">{sub.evaluationCount}</span>
                    </div>
                    {sub.evaluationCount > 0 && sub.averageScore !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Avg Score</span>
                        <span className="text-sm font-semibold text-amber-600">{Number(sub.averageScore).toFixed(1)} / 100</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {event.submissions.length === 0 && !isParticipant && (
        <EmptyState
          icon={FileText}
          title="No Submissions Yet"
          description="Participants haven't submitted any projects."
        />
      )}
    </div>
  );
}
