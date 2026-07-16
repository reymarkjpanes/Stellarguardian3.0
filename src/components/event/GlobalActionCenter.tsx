import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { EventStatus } from '../../lib/eventStatus';

interface Task {
  id: string;
  eventId: number;
  eventTitle: string;
  description: string;
  actionText: string;
}

export function GlobalActionCenter({ hostedEvents }: { hostedEvents: any[] }) {
  const tasks: Task[] = [];
  
  hostedEvents.forEach(event => {
    if (event.pendingApprovals > 0) {
      tasks.push({
        id: `pending-${event.id}`,
        eventId: event.id,
        eventTitle: event.title,
        description: `${event.pendingApprovals} pending applications.`,
        actionText: 'Review Applications'
      });
    }
    if (EventStatus.isDraft(event.state) && (!event.trustChecklist || !event.trustChecklist.prizeFunded)) {
      tasks.push({
        id: `draft-${event.id}`,
        eventId: event.id,
        eventTitle: event.title,
        description: `Prize pool needs funding.`,
        actionText: 'Fund Event'
      });
    }
    if (EventStatus.isJudging(event.state)) {
      tasks.push({
        id: `judging-${event.id}`,
        eventId: event.id,
        eventTitle: event.title,
        description: `Winners need to be selected.`,
        actionText: 'Select Winners'
      });
    }
  });

  if (tasks.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8 shadow-sm">
      <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        Tasks Requiring Attention
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks.map(task => (
          <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-amber-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 truncate max-w-[200px]">{task.eventTitle}</p>
              <p className="text-sm text-slate-800 font-medium">{task.description}</p>
            </div>
            <Link to={`/events/${task.eventId}`} className="shrink-0 ml-4 flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
              {task.actionText} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
