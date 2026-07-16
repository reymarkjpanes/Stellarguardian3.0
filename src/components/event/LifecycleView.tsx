import React from 'react';
import { Event } from '../../types';
import { Check, Circle, AlertCircle } from 'lucide-react';

export function LifecycleView({ event, user }: { event: Event, user: any }) {
  const isHost = user?.id === event.hostUserId;
  
  if (!isHost) return null; // Only organizers see the full structural lifecycle

  const stages = [
    { key: 'Draft', label: 'Draft' },
    { key: 'Funded', label: 'Funded' },
    { key: 'Published', label: 'Published' },
    { key: 'Registration Open', label: 'Registration' },
    { key: 'Registration Closed', label: 'Team Prep' },
    { key: 'In Progress', label: 'Active' },
    { key: 'Judging', label: 'Judging' },
    { key: 'Completed', label: 'Completed' }
  ];

  const currentIndex = stages.findIndex(s => s.key === event.state);

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 mb-8 shadow-sm">
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6">Event Lifecycle</h3>
      <div className="relative">
        <div className="absolute left-0 top-3 w-full h-0.5 bg-slate-100 -z-10"></div>
        <div 
          className="absolute left-0 top-3 h-0.5 bg-indigo-600 -z-10 transition-all duration-500"
          style={{ width: `${Math.max(0, (currentIndex / (stages.length - 1)) * 100)}%` }}
        ></div>
        
        <div className="flex justify-between">
          {stages.map((stage, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            
            return (
              <div key={stage.key} className="flex flex-col items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  isCompleted ? 'bg-indigo-600 text-white' : 
                  isCurrent ? 'bg-white border-2 border-indigo-600 text-indigo-600' : 
                  'bg-slate-100 text-slate-400'
                }`}>
                  {isCompleted ? <Check className="w-3 h-3" /> : <Circle className="w-2 h-2 fill-current" />}
                </div>
                <span className={`text-xs font-semibold ${isCurrent ? 'text-indigo-900' : 'text-slate-500'}`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
