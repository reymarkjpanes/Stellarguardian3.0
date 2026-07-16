import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { Search } from 'lucide-react';
import { EventFilters } from '../components/event/EventFilters';
import { EventGrid } from '../components/event/EventGrid';
import { EventCardData } from '../components/event/EventCard';

export default function PublicEvents() {
  const [events, setEvents] = useState<EventCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    fetchApi('/events/public')
      .then(data => setEvents(data.events))
      .finally(() => setIsLoading(false));
  }, []);

  const availableTags = Array.from(
    new Set([
      'Workshop', 'Networking', 'Social', 'Hackathon', 'Design', 'Bounty',
      ...events.flatMap(event => 
        event.tags 
          ? event.tags.split(',').map((t: string) => t.trim()).filter(Boolean) 
          : []
      )
    ])
  );

  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !selectedCategory || event.category === selectedCategory;

    const eventTags = event.tags 
      ? event.tags.split(',').map((t: string) => t.trim().toLowerCase()) 
      : [];
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.every(tag => eventTags.includes(tag.toLowerCase()));

    return matchesSearch && matchesCategory && matchesTags;
  });

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900 mb-2 tracking-tight">Public Competitions</h1>
        <p className="text-slate-500">Browse verified events with trusted prize pools.</p>
      </div>

      {/* Reusable filters component */}
      <EventFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        availableTags={availableTags}
        selectedTags={selectedTags}
        onTagToggle={(tag) => {
          setSelectedTags(prev => 
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
          );
        }}
        onClearAll={() => {
          setSearchQuery('');
          setSelectedCategory('');
          setSelectedTags([]);
        }}
        showSearch
        showCategoryFilter
      />

      {/* Reusable Grid & Loader Component */}
      <EventGrid
        events={filteredEvents}
        isLoading={isLoading}
        variant="public"
        isFilteredByTag={selectedTags.length > 0 || searchQuery !== '' || selectedCategory !== ''}
        onClearTagFilter={() => {
          setSearchQuery('');
          setSelectedCategory('');
          setSelectedTags([]);
        }}
        emptyStateIcon={Search}
        emptyStateTitle="No events found"
        emptyStateDescription="Try adjusting your keywords, categories, or tag filters to find what you are looking for!"
      />
    </div>
  );
}

