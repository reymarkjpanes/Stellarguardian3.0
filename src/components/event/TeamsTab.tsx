import React, { useState } from 'react';
import { Button, Input, EmptyState } from '../ui';
import { Users, UserPlus } from 'lucide-react';
import { Event } from '../../types';
import { fetchApi } from '../../lib/api';
import { toast } from 'sonner';

interface TeamsTabProps {
  event: Event;
  user: any;
  onUpdate: () => void;
}

export function TeamsTab({ event, user, onUpdate }: TeamsTabProps) {
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);

  const isParticipant = event.myMembership?.role === 'Participant' && event.myMembership.status === 'accepted';
  const hasTeam = event.teams.some(t => {
    // Need to check if user is in team, but for now we only know teams overall
    // Actually, backend didn't return team_members in the GET /api/events/:id.
    // We should probably just let anyone create a team for now, or check via an API.
    return false;
  });

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setLoading(true);
    try {
      await fetchApi(`/events/${event.id}/teams`, {
        method: 'POST',
        body: JSON.stringify({ name: teamName })
      });
      toast.success('Team created successfully!');
      setTeamName('');
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {isParticipant && (
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Create a Team</h3>
          <form onSubmit={handleCreateTeam} className="flex gap-4 items-end">
            <div className="flex-1">
              <Input
                label="Team Name"
                placeholder="Awesome Hackers"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading || !teamName.trim()}>
              <UserPlus className="w-4 h-4 mr-2" />
              Create Team
            </Button>
          </form>
        </div>
      )}

      <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Registered Teams
        </h3>
        
        {event.teams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Teams Yet"
            description="Participants haven't formed any teams for this event yet."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {event.teams.map(team => (
              <div key={team.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between">
                <div className="w-full">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-slate-900">{team.name}</h4>
                    <p className="text-xs text-slate-500">{new Date(team.createdAt).toLocaleDateString()}</p>
                  </div>
                  {(team as any).members && (team as any).members.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/60">
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Members</p>
                      <ul className="space-y-1">
                        {(team as any).members.map((m: any) => (
                          <li key={m.id} className="text-sm text-slate-700 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            {m.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
