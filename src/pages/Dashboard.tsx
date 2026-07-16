import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { Button } from '../components/ui';
import { FolderOpen } from 'lucide-react';
import { GlobalActionCenter } from '../components/event/GlobalActionCenter';
import { EventFilters } from '../components/event/EventFilters';
import { EventGrid } from '../components/event/EventGrid';
import { EventCardData } from '../components/event/EventCard';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'My Events' | 'Hosting' | 'Participating' | 'Judging'>('My Events');
  const [data, setData] = useState<{ hosted: EventCardData[], participating: EventCardData[], judging: EventCardData[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    fetchApi('/events')
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  const hostedList = data?.hosted || [];
  const participatingList = data?.participating || [];
  const combinedMyEvents: EventCardData[] = [];
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
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer
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

      {/* Reusable filters component */}
      <EventFilters
        availableTags={availableTags}
        selectedTags={selectedTags}
        onTagToggle={(tag) => {
          setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
          );
        }}
        onClearAll={() => setSelectedTags([])}
      />

      {/* Reusable Grid & Loader Component */}
      <EventGrid
        events={filteredList}
        isLoading={isLoading}
        variant="dashboard"
        isFilteredByTag={selectedTags.length > 0}
        onClearTagFilter={() => setSelectedTags([])}
        emptyStateIcon={FolderOpen}
        emptyStateTitle="No events found"
        emptyStateDescription={`You are not ${activeTab === 'My Events' ? 'hosting or participating in' : activeTab.toLowerCase()} any events yet. When you do, they will appear here.`}
        emptyStateAction={
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
      />
    </div>
  );
}

