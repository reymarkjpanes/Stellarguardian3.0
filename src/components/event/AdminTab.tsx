import React, { useState } from 'react';
import { Button, Input, Select, Badge, ConfirmDialog } from '../ui';
import { Users, Send, UserCheck, UserX, Trash2, Edit, RefreshCw } from 'lucide-react';
import { Event } from '../../types';
import { fetchApi } from '../../lib/api';
import { toast } from 'sonner';
import { EscrowManager } from './EscrowManager';

interface AdminTabProps {
  event: Event;
  user: any;
  onUpdate: () => void;
  onNavigate: (path: string) => void;
}

export function AdminTab({ event, user, onUpdate, onNavigate }: AdminTabProps) {
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteRole, setInviteRole] = useState('Participant');
  const [inviteSubject, setInviteSubject] = useState(`Invitation to join ${event.title}`);
  const [inviteMessage, setInviteMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);


  const handleApproveMembership = async (membershipId: number) => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${event.id}/memberships/${membershipId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'accepted' })
      });
      toast.success("Membership application approved!");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectMembership = async (membershipId: number) => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${event.id}/memberships/${membershipId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'rejected' })
      });
      toast.success("Membership application declined.");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeMembership = async (membershipId: number) => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${event.id}/memberships/${membershipId}`, {
        method: 'DELETE'
      });
      toast.success("Membership successfully revoked.");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelInvite = async (inviteId: number) => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${event.id}/invites/${inviteId}`, {
        method: 'DELETE'
      });
      toast.success("Invitation cancelled successfully.");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inviteEmails.trim()) return;
    
    const emails = inviteEmails.split(',').map(e => e.trim()).filter(e => e);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      toast.error(`Invalid email format: ${invalidEmails.join(', ')}`);
      return;
    }
    
    setActionLoading(true);
    try {
      // First, register invites in database
      await fetchApi('/invites', {
        method: 'POST',
        body: JSON.stringify({
          eventId: event.id,
          emails,
          role: inviteRole,
          message: inviteMessage
        })
      });

      toast.success(`Successfully sent ${emails.length} invitation email(s) (simulated log generated)!`);
      
      setInviteEmails('');
      setInviteSubject(`Invitation to join ${event.title}`);
      setInviteMessage('');
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelEvent = async () => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${event.id}/cancel`, { method: 'POST' });
      toast.success("Event cancelled.");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveEvent = async () => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${event.id}/archive`, { method: 'POST' });
      toast.success("Event archived.");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm text-center">
          <p className="text-sm text-slate-500 mb-1">Participants</p>
          <p className="text-3xl font-black text-slate-900">{event.stats?.participantsCount || 0}</p>
        </div>
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm text-center">
          <p className="text-sm text-slate-500 mb-1">Judges</p>
          <p className="text-3xl font-black text-slate-900">{event.stats?.judgesCount || 0}</p>
        </div>
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm text-center">
          <p className="text-sm text-slate-500 mb-1">Teams</p>
          <p className="text-3xl font-black text-slate-900">{event.teams?.length || 0}</p>
        </div>
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm text-center">
          <p className="text-sm text-slate-500 mb-1">Submissions</p>
          <p className="text-3xl font-black text-slate-900">{event.submissions?.length || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex justify-between items-center">
          <span className="text-indigo-800 font-semibold">Going (RSVP)</span>
          <span className="text-2xl font-black text-indigo-900">{event.stats?.rsvps?.going || 0}</span>
        </div>
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex justify-between items-center">
          <span className="text-amber-800 font-semibold">Maybe (RSVP)</span>
          <span className="text-2xl font-black text-amber-900">{event.stats?.rsvps?.maybe || 0}</span>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center">
          <span className="text-slate-600 font-semibold">Not Going (RSVP)</span>
          <span className="text-2xl font-black text-slate-900">{event.stats?.rsvps?.notGoing || 0}</span>
        </div>
      </div>


      {/* Edit Event Action */}
      <div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Edit Event Details</h3>
          <p className="text-sm text-slate-500">Update event information, dates, and configuration.</p>
        </div>
        <Button onClick={() => onNavigate(`/events/${event.id}/edit`)} variant="outline">
          <Edit className="w-4 h-4 mr-2" />
          Edit Event
        </Button>
      </div>

      <div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-500" />
          Invite People
        </h2>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input 
                label="Email Addresses (comma separated)" 
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="alice@example.com, bob@example.com"
              />
            </div>
            <div>
              <Select
                label="Role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="Participant">Participant</option>
                <option value="Judge">Judge</option>
                <option value="Mentor">Mentor</option>
              </Select>
            </div>
          </div>
          <Input 
            label="Email Subject" 
            value={inviteSubject}
            onChange={(e) => setInviteSubject(e.target.value)}
            placeholder={`Invitation to join ${event.title}`}
          />
          <Input 
            label="Optional Message / Body" 
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            placeholder="Join my upcoming event!"
          />
          <div className="flex items-center gap-3">
            <ConfirmDialog
              title="Send Invitations"
              description={
                inviteEmails.trim()
                  ? `Are you sure you want to send invitation emails to ${inviteEmails.split(',').map(em => em.trim()).filter(em => em).length} recipient(s)?`
                  : 'Are you sure you want to send invitation emails to the specified guests?'
              }
              confirmText="Send Invites"
              onConfirm={() => handleInvite()}
            >
              <Button type="button" disabled={actionLoading || !inviteEmails.trim()}>
                <Send className="w-4 h-4 mr-2" />
                Send Invites
              </Button>
            </ConfirmDialog>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Event link copied to clipboard!');
              }}
            >
              Copy Public Link
            </Button>
          </div>
        </form>
      </div>


      {/* Sent Invitations */}
      {event.invitations && event.invitations.length > 0 && (
        <div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Sent Invitations</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {event.invitations.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{inv.email}</td>
                    <td className="px-4 py-3"><Badge variant="neutral" className="text-xs">{inv.kind}</Badge></td>
                    <td className="px-4 py-3">
                      <Badge variant={inv.status === 'pending' ? 'warning' : 'neutral'} className="text-xs capitalize">{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {inv.status === 'pending' && (
                        <ConfirmDialog
                          title="Revoke Invitation"
                          description={`Are you sure you want to revoke the invitation for ${inv.email}?`}
                          onConfirm={async () => {
                            setActionLoading(true);
                            try {
                              await fetchApi(`/events/${event.id}/invites/${inv.id}`, { method: 'DELETE' });
                              toast.success('Invitation revoked');
                              onUpdate();
                            } catch (e: any) {
                              toast.error(e.message);
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                        >
                          <Button size="sm" variant="outline" disabled={actionLoading} title="Revoke">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </ConfirmDialog>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Member Management */}
      <div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Manage Memberships</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {event.members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No members yet</td>
                </tr>
              ) : (
                event.members.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{m.name}</div>
                      <div className="text-xs text-slate-500">{m.email}</div>
                      {m.rsvpStatus && (
                        <div className="mt-1 text-xs">
                          <span className="font-semibold text-slate-600">RSVP:</span>{' '}
                          <span className={
                            m.rsvpStatus === 'Going' ? 'text-indigo-600' :
                            m.rsvpStatus === 'Maybe' ? 'text-amber-600' :
                            'text-slate-500'
                          }>{m.rsvpStatus}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral" className="text-xs">{m.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge 
                        variant={m.status === 'accepted' ? 'success' : m.status === 'pending' ? 'warning' : 'error'} 
                        className="text-xs capitalize"
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {m.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleApproveMembership(m.id)} disabled={actionLoading} title="Approve">
                            <UserCheck className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectMembership(m.id)} disabled={actionLoading} title="Reject">
                            <UserX className="w-4 h-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      {m.status === 'accepted' && (
                        <ConfirmDialog
                          title="Revoke Membership"
                          description={`Are you sure you want to revoke access for ${m.name}?`}
                          onConfirm={() => handleRevokeMembership(m.id)}
                        >
                          <Button size="sm" variant="outline" disabled={actionLoading} title="Revoke">
                            <UserX className="w-4 h-4 text-red-600" />
                          </Button>
                        </ConfirmDialog>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stellar Escrow Management */}
      <EscrowManager event={event} user={user} onUpdate={onUpdate} />

      {/* Danger Zone */}
      <div className="bg-red-50 p-8 border border-red-100 rounded-xl">
        <h3 className="text-lg font-bold text-red-900 mb-2">Danger Zone</h3>
        <p className="text-sm text-red-700 mb-6">These actions are irreversible.</p>
        <div className="flex flex-wrap gap-4">
          <ConfirmDialog
            title="Cancel Event"
            description="Are you sure you want to cancel this event? This will stop all activity."
            onConfirm={handleCancelEvent}
          >
            <Button variant="outline" className="text-red-700 border-red-200 hover:bg-red-100">
              <Trash2 className="w-4 h-4 mr-2" />
              Cancel Event
            </Button>
          </ConfirmDialog>
          
          <ConfirmDialog
            title="Archive Event"
            description="Are you sure you want to archive this event? It will be hidden from active lists."
            onConfirm={handleArchiveEvent}
          >
            <Button variant="outline" className="text-slate-700 border-slate-300 hover:bg-slate-200">
              Archive Event
            </Button>
          </ConfirmDialog>
        </div>
      </div>
    </div>
  );
}
