import React from 'react';
import { cn, Badge } from './ui';

interface TrustChecklistProps {
  data: {
    prizeFunded: boolean;
    organizerVerified: boolean;
    judgesAssigned: boolean;
    rulesPublished: boolean;
    timelineConfirmed: boolean;
  };
  prizeTotal?: number;
  className?: string;
}

export function TrustChecklist({ data, prizeTotal, className }: TrustChecklistProps) {
  const items = [
    {
      id: 'prize',
      title: 'Prize Funded',
      desc: data.prizeFunded ? `Tx: verified • ${prizeTotal} XLM` : 'Pending funding',
      status: data.prizeFunded ? 'success' : 'pending',
    },
    {
      id: 'organizer',
      title: 'Organizer Verified',
      desc: data.organizerVerified ? 'Email verified • Wallet match confirmed' : 'Pending verification',
      status: data.organizerVerified ? 'success' : 'pending',
    },
    {
      id: 'judges',
      title: 'Judges Assigned',
      desc: data.judgesAssigned ? 'Judges are active' : 'Awaiting judges',
      status: data.judgesAssigned ? 'success' : 'pending',
    },
    {
      id: 'rules',
      title: 'Rules Published',
      desc: data.rulesPublished ? 'Self-reported by organizer' : 'Pending rules',
      status: data.rulesPublished ? 'warning' : 'pending',
    },
    {
      id: 'timeline',
      title: 'Timeline Confirmed',
      desc: data.timelineConfirmed ? 'Self-reported by organizer' : 'Pending dates',
      status: data.timelineConfirmed ? 'warning' : 'pending',
    },
  ];

  return (
    <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm p-6", className)}>
      <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase">
        <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        TRUST CHECKLIST
      </h3>
      <div className="space-y-3">
        {items.map((item) => {
          if (item.status === 'success') {
            return (
              <div key={item.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                  <div>
                    <p className="text-sm font-bold text-green-900">{item.title}</p>
                    <p className="text-[10px] text-green-700 uppercase font-medium">{item.desc}</p>
                  </div>
                </div>
                <Badge variant="success" className="text-[10px] font-bold uppercase tracking-wider py-0.5">Verified</Badge>
              </div>
            );
          }
          if (item.status === 'warning') {
            return (
              <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs">!</div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">{item.title}</p>
                    <p className="text-[10px] text-amber-700 uppercase font-medium">{item.desc}</p>
                  </div>
                </div>
                <Badge variant="warning" className="text-[10px] font-bold uppercase tracking-wider py-0.5">Unverified</Badge>
              </div>
            );
          }
          return (
            <div key={item.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-slate-200 rounded-full"></div>
                <div>
                  <p className="text-sm font-bold text-slate-700">{item.title}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">{item.desc}</p>
                </div>
              </div>
              <Badge variant="neutral" className="text-[10px] font-bold uppercase tracking-wider py-0.5">Pending</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
