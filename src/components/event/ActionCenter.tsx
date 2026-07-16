import React from 'react';
import { Event } from '../../types';
import { EventStatus } from '../../lib/eventStatus';
import { AlertCircle, ArrowRight, Clock, Users, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ActionCenter({ event, user, onActionClick }: { event: Event, user: any, onActionClick: (action: string) => void }) {
  const isHost = user?.id === event.hostUserId;
  if (!isHost) return null;

  const tasks = [];

  const pendingCount = event.members?.filter(m => m.status === 'pending').length || 0;
  if (pendingCount > 0) {
    tasks.push({
      id: 'pending-users',
      icon: Users,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      title: `${pendingCount} Pending Applications`,
      desc: 'Review participant applications before registration closes.',
      action: 'View Applications',
      actionKey: 'admin'
    });
  }

  if (EventStatus.isDraft(event.state) && !event.trustChecklist?.prizeFunded) {
    tasks.push({
      id: 'fund',
      icon: Trophy,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      title: 'Fund Prize Pool',
      desc: `Deposit ${event.prizeTotal} XLM to unlock publishing.`,
      action: 'Fund Now',
      actionKey: 'fund'
    });
  }

  if (EventStatus.isInProgress(event.state)) {
    tasks.push({
      id: 'submissions-closing',
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      title: 'Event in Progress',
      desc: 'Monitor submissions and team activity.',
      action: 'View Submissions',
      actionKey: 'submissions'
    });
  }

  if (EventStatus.isJudging(event.state)) {
    const unassignedCount = event.submissions?.filter(s => (s.evaluationCount || 0) === 0).length || 0;
    if (unassignedCount > 0) {
      tasks.push({
        id: 'judging',
        icon: AlertCircle,
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        title: `${unassignedCount} Ungraded Submissions`,
        desc: 'Ensure all submissions receive a score from judges.',
        action: 'Manage Judging',
        actionKey: 'judging'
      });
    }
  }

  if (tasks.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        Command Center
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.id} className={`p-4 rounded-xl border ${t.bg} ${t.border} flex flex-col justify-between shadow-sm`}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-5 h-5 ${t.color}`} />
                  <h4 className={`font-bold ${t.color}`}>{t.title}</h4>
                </div>
                <p className="text-sm text-slate-700 mb-4">{t.desc}</p>
              </div>
              <button 
                onClick={() => onActionClick(t.actionKey)}
                className={`flex items-center gap-1 text-sm font-semibold ${t.color} hover:opacity-80 transition-opacity w-fit`}
              >
                {t.action} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
