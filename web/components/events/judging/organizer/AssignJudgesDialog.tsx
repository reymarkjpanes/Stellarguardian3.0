"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { fetchAssignmentDataAction, assignJudgeAction } from "@/app/actions/judging.actions";
import { Users, AlertCircle, CheckCircle2 } from "lucide-react";

interface AssignJudgesDialogProps {
  eventId: string;
}

export function AssignJudgesDialog({ eventId }: AssignJudgesDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [judges, setJudges] = useState<{id: string, name: string}[]>([]);
  const [submissions, setSubmissions] = useState<{id: string, title: string}[]>([]);
  
  const [selectedJudge, setSelectedJudge] = useState<string>("");
  const [selectedSubmission, setSelectedSubmission] = useState<string>("");
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    let mounted = true;
    if (isOpen) {
      setLoading(true);
      fetchAssignmentDataAction(eventId).then((data) => {
        if (!mounted) return;
        setJudges(data.judges);
        setSubmissions(data.submissions);
        setLoading(false);
      });
    } else {
      setMessage(null);
      setSelectedJudge("");
      setSelectedSubmission("");
    }
    return () => {
      mounted = false;
    };
  }, [isOpen, eventId]);

  const handleAssign = async () => {
    if (!selectedJudge || !selectedSubmission) {
      setMessage({ type: 'error', text: 'Please select both a judge and a submission.'});
      return;
    }
    setSubmitting(true);
    const res = await assignJudgeAction(eventId, selectedSubmission, selectedJudge);
    setSubmitting(false);
    
    if (res.success) {
      setMessage({ type: 'success', text: 'Judge assigned successfully!' });
      setSelectedJudge("");
      setSelectedSubmission("");
    } else {
      setMessage({ type: 'error', text: res.error || 'Failed to assign judge.' });
    }
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)}>
        <Users className="w-4 h-4 mr-2" />
        Assign Judges
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-background border rounded-md shadow-lg p-4 z-50">
          <h3 className="font-semibold mb-3">Assign Judge</h3>
          
          {loading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Loading...</div>
          ) : (
            <div className="space-y-3">
              {message && (
                <div className={`p-2 text-sm rounded flex items-start gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {message.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 mt-0.5" />}
                  <span>{message.text}</span>
                </div>
              )}
              
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">Select Judge</label>
                <select 
                  className="w-full text-sm p-2 border rounded-md"
                  value={selectedJudge}
                  onChange={(e) => setSelectedJudge(e.target.value)}
                >
                  <option value="">-- Choose Judge --</option>
                  {judges.map(j => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">Select Submission</label>
                <select 
                  className="w-full text-sm p-2 border rounded-md"
                  value={selectedSubmission}
                  onChange={(e) => setSelectedSubmission(e.target.value)}
                >
                  <option value="">-- Choose Submission --</option>
                  {submissions.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <Button className="w-full" size="sm" onClick={handleAssign} disabled={submitting}>
                  {submitting ? 'Assigning...' : 'Assign'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
