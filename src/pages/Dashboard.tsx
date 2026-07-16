import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { Button, Badge, Skeleton, EmptyState } from '../components/ui';
import { Calendar, Trophy, Users, Search, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { GlobalActionCenter } from '../components/event/GlobalActionCenter';

type EventStatus = 'Draft' | 'Funded' | 'Published' | 'Registration Open' | 'Registration Closed' | 'In Progress' | 'Judging' | 'Completed' | 'Archived' | 'Cancelled';

interface EventData {
  id: number;
  title: string;
  category: string;
  state: EventStatus;
  prizeTotal: number;
  startDate: string;
  endDate: string;
  tags?: string;
  role?: string;
  status?: string;
}

const getBadgeVariant = (state: EventStatus) => {
  if (['Draft', 'Archived', 'Cancelled'].includes(state)) return 'neutral';
  if (['Funded', 'Published'].includes(state)) return 'default';
  if (['Registration Open', 'In Progress'].includes(state)) return 'success';
  if (['Completed'].includes(state)) return 'default';
  return 'warning';
};

const EventCard: React.FC<{ event: EventData }> = ({ event }) => {
  return (
    <Link to={`/events/${event.id}`} className="block group">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-md transition-all h-full flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-2 gap-2">
            <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors line-clamp-1 flex-1">{event.title}</h3>
            <Badge variant={getBadgeVariant(event.state)} className="uppercase tracking-wide text-[10px] shrink-0">
              {event.state}
            </Badge>
          </div>
          
          {/* Render tags */}
          {event.tags && (
            <div className="flex flex-wrap gap-1 mb-4">
              {event.tags.split(',').map((tag: string) => {
                const cleanTag = tag.trim();
                if (!cleanTag) return null;
                return (
                  <Badge key={cleanTag} variant="neutral" className="bg-slate-50 text-slate-600 border border-slate-100 normal-case font-medium text-[10px] py-0.5 px-1.5 shrink-0">
                    #{cleanTag}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-y-3 gap-x-5 text-sm text-slate-500 mb-2 mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="font-mono text-slate-700">{event.prizeTotal} XLM</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{format(new Date(event.startDate), 'MMM d, yyyy')}</span>
          </div>
          {event.role && (
            <div className="flex items-center gap-2 w-full pt-2 mt-2 border-t border-slate-100">
              <Users className="w-4 h-4 text-indigo-500" />
              <span className="font-medium text-slate-700">{event.role} <span className="text-slate-400 font-normal ml-1">({event.status})</span></span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'My Events' | 'Hosting' | 'Participating' | 'Judging'>('My Events');
  const [data, setData] = useState<{ hosted: EventData[], participating: EventData[], judging: EventData[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    fetchApi('/events')
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  const hostedList = data?.hosted || [];
  const participatingList = data?.participating || [];
  const combinedMyEvents: EventData[] = [];
  const seenIds = new Set<number>();

  for (const item of hostedList) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      combinedMyEvents.push(item);
    }
  }
  for (const item of participatingList) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      combinedMyEvents.push(item);
    }
  }

  const currentList = activeTab === 'My Events' ? combinedMyEvents :
                      activeTab === 'Hosting' ? data?.hosted : 
                      activeTab === 'Participating' ? data?.participating : 
                      data?.judging || [];

  // Reset selected tags when changing tabs to prevent state mismatch
  const handleTabChange = (tab: 'My Events' | 'Hosting' | 'Participating' | 'Judging') => {
    setActiveTab(tab);
    setSelectedTags([]);
  };

  // Get tags available inside current active tab list
  const availableTags = Array.from(
    new Set(
      (currentList || []).flatMap(e => 
        e.tags 
          ? e.tags.split(',').map((t: string) => t.trim()).filter(Boolean) 
          : []
      )
    )
  );

  const filteredList = (currentList || []).filter(event => {
    if (selectedTags.length === 0) return true;
    const eventTags = event.tags 
      ? event.tags.split(',').map((t: string) => t.trim().toLowerCase()) 
      : [];
    return selectedTags.every(tag => eventTags.includes(tag.toLowerCase()));
  });

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">My Events</h1>
          <p className="text-slate-500 mt-1">Manage and track your competitions on Stellar.</p>
        </div>
        <Link to="/events/create">
          <Button className="shadow-sm">Create Event</Button>
        </Link>
      </div>

      {hostedList.length > 0 && <GlobalActionCenter hostedEvents={hostedList} />}

      <div className="border-b border-slate-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {(['My Events', 'Hosting', 'Participating', 'Judging'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
              `}
            >
              {tab} {data && (
                <span className="ml-2 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">
                  {tab === 'My Events' ? combinedMyEvents.length : tab === 'Hosting' ? data.hosted.length : tab === 'Participating' ? data.participating.length : data.judging.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tags quick filter pills if any exist for this tab */}
      {availableTags.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-8 shadow-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Filter by Tag:</span>
            {availableTags.map(tag => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
            
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors ml-auto cursor-pointer"
              >
                Clear Tag Filter
              </button>
            )}
          </div>
        </div>
      )}

      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 h-full">
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="space-y-3 mt-6">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentList?.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No events found"
                  description={`You are not ${activeTab === 'My Events' ? 'hosting or participating in' : activeTab.toLowerCase()} any events yet. When you do, they will appear here.`}
                  action={
                    activeTab === 'My Events' ? (
                      <div className="flex flex-wrap gap-4 justify-center">
                        <Link to="/events/create">
                          <Button>Create an event</Button>
                        </Link>
                        <Link to="/public">
                          <Button variant="outline">Browse public events</Button>
                        </Link>
                      </div>
                    ) : activeTab === 'Hosting' ? (
                      <Link to="/events/create">
                        <Button>Create your first event</Button>
                      </Link>
                    ) : activeTab === 'Participating' ? (
                      <Link to="/public">
                        <Button>Browse public events</Button>
                      </Link>
                    ) : null
                  }
                  className="max-w-2xl mx-auto py-20"
                />
              ) : filteredList.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No events match tag filter"
                  description="Try clearing your selected tag filters to see all events under this tab."
                  action={
                    <Button onClick={() => setSelectedTags([])}>Clear Tag Filters</Button>
                  }
                  className="max-w-2xl mx-auto py-20"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredList.map((event, i) => (
                    <motion.div 
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <EventCard event={event} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
