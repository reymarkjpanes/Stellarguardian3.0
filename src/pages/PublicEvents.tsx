import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { Trophy, Calendar, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Badge, Skeleton, EmptyState } from '../components/ui';
import { motion } from 'motion/react';

export default function PublicEvents() {
  const [events, setEvents] = useState<any[]>([]);
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
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    
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

      {/* Funnel Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
            />
          </div>
          <div className="w-full md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700 bg-white"
            >
              <option value="">All Categories</option>
              <option value="Hackathon">Hackathon</option>
              <option value="Bounty">Bounty</option>
              <option value="Grant">Grant</option>
              <option value="Design">Design</option>
            </select>
          </div>
        </div>

        {/* Tags quick filter pills */}
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Filter by Tags</span>
          <div className="flex flex-wrap gap-2">
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
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filters as Chips */}
        {(searchQuery || selectedCategory || selectedTags.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-500 mr-1">Active filters:</span>
            
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-indigo-900 font-bold ml-1">&times;</button>
              </span>
            )}
            
            {selectedCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                Category: {selectedCategory}
                <button onClick={() => setSelectedCategory('')} className="hover:text-indigo-900 font-bold ml-1">&times;</button>
              </span>
            )}

            {selectedTags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                Tag: {tag}
                <button onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))} className="hover:text-indigo-900 font-bold ml-1">&times;</button>
              </span>
            ))}

            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('');
                setSelectedTags([]);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors ml-auto"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 h-full flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mb-6" />
                <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No events found"
            description="Try adjusting your keywords, categories, or tag filters to find what you are looking for!"
            className="max-w-2xl mx-auto py-20"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="h-full"
              >
                <Link to={`/events/${event.id}`} className="block bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col h-full group">
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                      <Badge variant="neutral" className="uppercase shrink-0">{event.category}</Badge>
                      {event.tags && event.tags.split(',').map((tag: string) => {
                        const cleanTag = tag.trim();
                        if (!cleanTag) return null;
                        return (
                          <Badge key={cleanTag} variant="neutral" className="bg-slate-50 text-slate-600 border border-slate-100 normal-case font-medium text-[10px] py-0.5 px-1.5 shrink-0">
                            #{cleanTag}
                          </Badge>
                        );
                      })}
                    </div>
                    {event.fundingTxRef ? (
                      <Badge variant="success" className="uppercase text-[10px] shrink-0">Verified Escrow</Badge>
                    ) : (
                      <Badge variant="warning" className="uppercase text-[10px] shrink-0">Unfunded</Badge>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-lg text-slate-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">{event.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-3 mb-6 flex-1 leading-relaxed">{event.description}</p>
                  
                  <div className="mt-auto pt-4 border-t border-slate-100 flex flex-wrap gap-y-2 justify-between text-sm text-slate-600">
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span className="font-mono">{event.prizeTotal} XLM</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar className="w-4 h-4" />
                      <span>Due {format(new Date(event.registrationDeadline), 'MMM d')}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
