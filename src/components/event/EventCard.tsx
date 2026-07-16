import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Trophy, Users, ShieldAlert, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '../ui';

export type EventStatus = 'Draft' | 'Funded' | 'Published' | 'Registration Open' | 'Registration Closed' | 'In Progress' | 'Judging' | 'Completed' | 'Archived' | 'Cancelled';

export interface EventCardData {
  id: number;
  title: string;
  description?: string;
  category: string;
  state: EventStatus | string;
  prizeTotal: number;
  startDate: string;
  endDate: string;
  registrationDeadline?: string;
  tags?: string;
  role?: string;
  status?: string;
  fundingTxRef?: string;
}

interface EventCardProps {
  event: EventCardData;
  variant?: 'dashboard' | 'public';
}

const getBadgeVariant = (state: string) => {
  if (['Draft', 'Archived', 'Cancelled'].includes(state)) return 'neutral';
  if (['Funded', 'Published'].includes(state)) return 'default';
  if (['Registration Open', 'In Progress'].includes(state)) return 'success';
  if (['Completed'].includes(state)) return 'default';
  return 'warning';
};

export function EventCard({ event, variant = 'dashboard' }: EventCardProps) {
  const isPublic = variant === 'public';
  const displayState = event.state as EventStatus;

  return (
    <Link 
      to={`/events/${event.id}`} 
      id={`event-card-${event.id}`}
      className="block group h-full"
    >
      <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-md transition-all h-full flex flex-col justify-between">
        <div>
          {/* Header Area */}
          <div className="flex justify-between items-start mb-3 gap-2">
            {isPublic ? (
              <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                <Badge variant="neutral" id={`event-card-category-${event.id}`} className="uppercase tracking-wide text-[10px] shrink-0 font-bold bg-slate-100 text-slate-700">
                  {event.category}
                </Badge>
                {event.fundingTxRef ? (
                  <Badge variant="success" id={`event-card-escrow-${event.id}`} className="uppercase text-[10px] shrink-0 flex items-center gap-1 font-semibold">
                    <BadgeCheck className="w-3 h-3 text-emerald-600" />
                    Verified Escrow
                  </Badge>
                ) : (
                  <Badge variant="warning" id={`event-card-escrow-${event.id}`} className="uppercase text-[10px] shrink-0 flex items-center gap-1 font-semibold">
                    <ShieldAlert className="w-3 h-3 text-amber-600" />
                    Unfunded
                  </Badge>
                )}
              </div>
            ) : (
              <>
                <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors line-clamp-1 flex-1">
                  {event.title}
                </h3>
                <Badge variant={getBadgeVariant(displayState)} id={`event-card-state-${event.id}`} className="uppercase tracking-wide text-[10px] shrink-0">
                  {displayState}
                </Badge>
              </>
            )}
          </div>

          {/* Tags */}
          {event.tags && (
            <div className="flex flex-wrap gap-1 mb-4">
              {event.tags.split(',').map((tag: string) => {
                const cleanTag = tag.trim();
                if (!cleanTag) return null;
                return (
                  <Badge 
                    key={cleanTag} 
                    id={`event-card-tag-${event.id}-${cleanTag}`}
                    variant="neutral" 
                    className="bg-slate-50 text-slate-600 border border-slate-100 normal-case font-medium text-[10px] py-0.5 px-1.5 shrink-0"
                  >
                    #{cleanTag}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Title & Description for public view */}
          {isPublic && (
            <div className="mt-2">
              <h3 className="font-semibold text-lg text-slate-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                {event.title}
              </h3>
              {event.description && (
                <p className="text-sm text-slate-500 line-clamp-3 mb-6 leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex flex-wrap gap-y-3 gap-x-5 text-sm text-slate-500 mt-4 pt-4 border-t border-slate-100 justify-between items-center">
          <div className="flex items-center gap-2 font-medium text-slate-900">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="font-mono">{event.prizeTotal} XLM</span>
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>
              {isPublic && event.registrationDeadline ? (
                `Due ${format(new Date(event.registrationDeadline), 'MMM d, yyyy')}`
              ) : (
                format(new Date(event.startDate), 'MMM d, yyyy')
              )}
            </span>
          </div>

          {!isPublic && event.role && (
            <div className="flex items-center gap-2 w-full pt-2 mt-2 border-t border-slate-100">
              <Users className="w-4 h-4 text-indigo-500" />
              <span className="font-medium text-slate-700">
                {event.role} <span className="text-slate-400 font-normal ml-1">({event.status})</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
