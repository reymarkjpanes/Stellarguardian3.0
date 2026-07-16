import React from 'react';
import { Event } from '../../types';
import { Calendar, Clock, MapPin, Users, Info } from 'lucide-react';

export function OverviewTab({ event }: { event: Event }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-2 space-y-8">
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-600" />
            About This Event
          </h2>
          <div className="prose prose-slate max-w-none bg-slate-50 p-6 rounded-xl border border-slate-100">
            <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{event.description}</p>
          </div>
        </section>

        {event.tags && (
          <section>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Tags & Focus</h3>
            <div className="flex flex-wrap gap-2">
              {event.tags.split(',').map((t, i) => (
                <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-full border border-indigo-100">
                  {t.trim()}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4">Event Details</h3>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Dates</p>
                <p className="text-sm text-slate-600">{event.startDate} — {event.endDate}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Registration Deadline</p>
                <p className="text-sm text-slate-600">{event.registrationDeadline}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Format</p>
                <p className="text-sm text-slate-600">{event.format}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Team Size</p>
                <p className="text-sm text-slate-600">Max {event.teamSizeMax || 4} members</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl p-6 text-white shadow-md">
          <h3 className="text-indigo-100 text-sm font-bold uppercase tracking-wider mb-1">Prize Pool</h3>
          <div className="text-3xl font-black mb-4">{event.prizeTotal} XLM</div>
          
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-sm font-medium text-indigo-50 mb-1">Prize Breakdown:</p>
            <p className="text-sm text-indigo-100">{event.prizeBreakdown}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
