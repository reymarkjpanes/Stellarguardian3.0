import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FolderOpen, Search, LucideIcon } from 'lucide-react';
import { Skeleton, EmptyState, Button } from '../ui';
import { EventCard, EventCardData } from './EventCard';

interface EventGridProps {
  events: EventCardData[];
  isLoading: boolean;
  variant?: 'dashboard' | 'public';
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateIcon?: LucideIcon;
  emptyStateAction?: React.ReactNode;
  
  // Tag mismatch state
  isFilteredByTag?: boolean;
  onClearTagFilter?: () => void;
}

export function EventGrid({
  events,
  isLoading,
  variant = 'dashboard',
  emptyStateTitle = 'No events found',
  emptyStateDescription = 'There are no events to display in this list.',
  emptyStateIcon = FolderOpen,
  emptyStateAction,
  isFilteredByTag = false,
  onClearTagFilter,
}: EventGridProps) {
  if (isLoading) {
    return (
      <div id="events-grid-skeleton" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4 gap-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-2 mt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-[350px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={events.length}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {events.length === 0 ? (
            isFilteredByTag && onClearTagFilter ? (
              <EmptyState
                icon={Search}
                title="No events match tag filters"
                description="Try clearing your selected tag filters to see all events under this list."
                action={
                  <Button onClick={onClearTagFilter}>Clear Tag Filters</Button>
                }
                className="max-w-2xl mx-auto py-20"
              />
            ) : (
              <EmptyState
                icon={emptyStateIcon}
                title={emptyStateTitle}
                description={emptyStateDescription}
                action={emptyStateAction}
                className="max-w-2xl mx-auto py-20"
              />
            )
          ) : (
            <div id="events-list-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="h-full"
                >
                  <EventCard event={event} variant={variant} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
