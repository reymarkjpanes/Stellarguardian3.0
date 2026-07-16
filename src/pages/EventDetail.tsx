import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { Event } from '../types';
import { EventStatus, isActionAllowed } from '../lib/eventStatus';
import { Badge, Button, ConfirmDialog, ConfirmationModal, Skeleton } from '../components/ui';
import { ChevronRight, Settings, Users, Trophy, FileText, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

import { LifecycleView } from '../components/event/LifecycleView';
import { ActionCenter } from '../components/event/ActionCenter';

import { OverviewTab } from '../components/event/OverviewTab';
import { TeamsTab } from '../components/event/TeamsTab';
import { SubmissionsTab } from '../components/event/SubmissionsTab';
import { JudgingTab } from '../components/event/JudgingTab';
import { AdminTab } from '../components/event/AdminTab';
import { TrustChecklist } from '../components/TrustChecklist';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState(false);

  const loadEvent = () => {
    fetchApi(`/events/${id}`)
      .then(setEvent)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvent();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto w-full p-8">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-64 w-full mb-8 rounded-xl" />
        <div className="grid grid-cols-4 gap-8">
          <Skeleton className="h-40 col-span-3 rounded-xl" />
          <Skeleton className="h-40 col-span-1 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!event) return <div className="text-center py-20">Event not found</div>;

  const isHost = user?.id === event.hostUserId;

  const handleApply = async () => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ role: 'Participant' })
      });
      toast.success('Application submitted successfully!');
      loadEvent();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmPublish = async () => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${id}/publish`, {
        method: 'POST'
      });
      toast.success('Event published successfully!');
      loadEvent();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStateChange = async (newState: string) => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ newState })
      });
      toast.success(`Event moved to ${newState}`);
      loadEvent();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleActionClick = async (actionKey: string) => {
    if (actionKey === 'fund') {
      setActionLoading(true);
      try {
        await fetchApi(`/events/${id}/fund`, {
          method: 'POST'
        });
        toast.success("Funding mock triggered successfully!");
        loadEvent();
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setActionLoading(false);
      }
    } else {
      setActiveTab(actionKey);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${id}/cancel`, {
        method: 'POST'
      });
      toast.success('Event cancelled successfully.');
      loadEvent();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${id}/archive`, {
        method: 'POST'
      });
      toast.success('Event archived successfully.');
      loadEvent();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await fetchApi(`/events/${id}`, {
        method: 'DELETE'
      });
      toast.success('Event deleted successfully.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Organizer Dashboard Layout
  if (isHost) {
    return (
      <div className="max-w-7xl mx-auto w-full pb-20 px-4 sm:px-6">
        <div className="mb-6 flex items-center justify-between text-sm text-slate-500 font-medium">
          <div className="flex items-center">
            <Link to="/dashboard" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <ChevronRight className="w-4 h-4 mx-2 text-slate-300" />
            <span className="text-slate-900 truncate max-w-[300px]">{event.title}</span>
          </div>
          <div className="flex gap-2">
             <Badge variant="default">{event.state}</Badge>
             <Badge variant="neutral">{event.visibility}</Badge>
          </div>
        </div>

        <LifecycleView event={event} user={user} />
        
        <ActionCenter event={event} user={user} onActionClick={handleActionClick} />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 px-6 pt-4 bg-slate-50">
            <div className="flex items-center gap-6 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: FileText },
                { id: 'admin', label: 'Registrations', icon: Users },
                { id: 'teams', label: 'Teams', icon: Users },
                { id: 'submissions', label: 'Submissions', icon: Trophy },
                { id: 'judging', label: 'Judging', icon: CheckCircle },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      whitespace-nowrap pb-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                      ${isActive
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-6 min-h-[500px]">
             {activeTab === 'overview' && <OverviewTab event={event} />}
             {activeTab === 'admin' && <AdminTab event={event} user={user} onUpdate={loadEvent} onNavigate={navigate} />}
             {activeTab === 'teams' && <TeamsTab event={event} user={user} onUpdate={loadEvent} />}
             {activeTab === 'submissions' && <SubmissionsTab event={event} user={user} onUpdate={loadEvent} />}
             {activeTab === 'judging' && <JudgingTab event={event} user={user} onUpdate={loadEvent} />}
             {activeTab === 'settings' && (
                <div className="space-y-8 max-w-2xl">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Event Settings</h3>
                    <p className="text-slate-500 mb-4">Configure core settings, dates, limits, and visibility.</p>
                    {isActionAllowed(event.state, 'edit') && (
                      <Link to={`/events/${event.id}/edit`}>
                         <Button variant="outline" className="w-full sm:w-auto">Edit Configuration</Button>
                      </Link>
                    )}
                  </div>
                  
                  {/* Admin State Controls */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                    <h4 className="font-semibold text-slate-900">Lifecycle Controls</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {isActionAllowed(event.state, 'fund') && <Button onClick={() => handleActionClick('fund')}>Mock Fund Event</Button>}
                      {isActionAllowed(event.state, 'publish') && <Button onClick={confirmPublish}>Publish Event</Button>}
                      {isActionAllowed(event.state, 'open_registration') && <Button onClick={() => handleStateChange('Registration Open')}>Open Registration</Button>}
                      {isActionAllowed(event.state, 'close_registration') && <Button onClick={() => handleStateChange('Registration Closed')}>Close Registration</Button>}
                      {isActionAllowed(event.state, 'start_event') && <Button onClick={() => handleStateChange('In Progress')}>Start Event</Button>}
                      {isActionAllowed(event.state, 'begin_judging') && <Button onClick={() => handleStateChange('Judging')}>Begin Judging</Button>}
                      {isActionAllowed(event.state, 'complete') && <Button onClick={() => handleStateChange('Completed')}>Complete Event</Button>}
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="bg-red-50 p-6 rounded-xl border border-red-200 space-y-4 mt-8">
                    <h4 className="font-bold text-red-700">Danger Zone</h4>
                    <p className="text-sm text-red-600 mb-4">Irreversible, destructive actions for this event.</p>
                    <div className="flex flex-wrap gap-4">
                      {isActionAllowed(event.state, 'cancel') && (
                        <ConfirmationModal
                          title="Cancel Event"
                          description="Are you sure you want to cancel this event? This action cannot be undone and will prevent any further participation or updates."
                          confirmText="Yes, Cancel Event"
                          isDangerous={true}
                          onConfirm={handleCancel}
                        >
                          <Button variant="danger">Cancel Event</Button>
                        </ConfirmationModal>
                      )}
                      {isActionAllowed(event.state, 'archive') && (
                        <ConfirmationModal
                          title="Archive Event"
                          description="Are you sure you want to archive this event? It will be hidden from public listings but remain accessible to participants."
                          confirmText="Yes, Archive Event"
                          isDangerous={true}
                          onConfirm={handleArchive}
                        >
                          <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">Archive Event</Button>
                        </ConfirmationModal>
                      )}
                      {isActionAllowed(event.state, 'delete') && (
                        <ConfirmationModal
                          title="Delete Event"
                          description="Are you sure you want to delete this event? This action is permanent and will completely delete the event and all associated records."
                          confirmText="Yes, Delete Event"
                          isDangerous={true}
                          onConfirm={handleDelete}
                        >
                          <Button variant="danger" className="bg-rose-600 hover:bg-rose-700 text-white">Delete Event</Button>
                        </ConfirmationModal>
                      )}
                    </div>
                  </div>
                </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  // Participant Dashboard Layout
  return (
    <div className="max-w-6xl mx-auto w-full pb-20 px-4 sm:px-6">
      {event.bannerUrl && (
        <div className="w-full h-64 md:h-80 rounded-2xl mb-8 overflow-hidden relative shadow-md">
          <img src={event.bannerUrl} alt="Event Banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex items-end p-8">
             <h1 className="text-4xl font-black text-white">{event.title}</h1>
          </div>
        </div>
      )}

      {!event.bannerUrl && (
        <div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge variant="default" className="text-sm rounded-md px-2.5 py-1">{event.category}</Badge>
            <Badge variant="neutral" className="text-sm rounded-md px-2.5 py-1">{event.state}</Badge>
          </div>
          <h1 className="text-3xl font-black text-slate-900 leading-tight mb-2">{event.title}</h1>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-8">
              {['overview', 'teams', 'submissions', 'judging'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors
                    ${activeTab === tab
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                  `}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
          <div className="pt-4 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            {activeTab === 'overview' && <OverviewTab event={event} />}
            {activeTab === 'teams' && <TeamsTab event={event} user={user} onUpdate={loadEvent} />}
            {activeTab === 'submissions' && <SubmissionsTab event={event} user={user} onUpdate={loadEvent} />}
            {activeTab === 'judging' && <JudgingTab event={event} user={user} onUpdate={loadEvent} />}
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm text-center">
             <h3 className="font-bold text-slate-900 mb-2">Participant Actions</h3>
             {!event.myMembership && isActionAllowed(event.state, 'apply') && (
               <Button className="w-full mt-4" onClick={handleApply} disabled={actionLoading}>
                 Apply to Participate
               </Button>
             )}
             {event.myMembership && (
               <div className="mt-4 p-4 rounded-lg bg-indigo-50 border border-indigo-100">
                 <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider mb-1">Your Status</p>
                 <div className="font-bold text-indigo-900 capitalize">{event.myMembership.role} - {event.myMembership.status}</div>
               </div>
             )}
             {!event.myMembership && !isActionAllowed(event.state, 'apply') && (
               <p className="text-sm text-slate-500 mt-4">Registration is not open.</p>
             )}
          </div>
          <TrustChecklist data={event.trustChecklist as any} prizeTotal={event.prizeTotal} />
        </div>
      </div>
    </div>
  );
}
