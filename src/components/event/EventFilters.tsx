import React from 'react';
import { Search } from 'lucide-react';

interface EventFiltersProps {
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  selectedCategory?: string;
  onCategoryChange?: (val: string) => void;
  categories?: string[];
  availableTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
  showSearch?: boolean;
  showCategoryFilter?: boolean;
}

export function EventFilters({
  searchQuery = '',
  onSearchChange,
  selectedCategory = '',
  onCategoryChange,
  categories = ['Hackathon', 'Bounty', 'Grant', 'Design'],
  availableTags,
  selectedTags,
  onTagToggle,
  onClearAll,
  showSearch = false,
  showCategoryFilter = false,
}: EventFiltersProps) {
  const hasActiveFilters = searchQuery || selectedCategory || selectedTags.length > 0;

  return (
    <div id="event-filters-container" className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm space-y-6">
      {(showSearch || showCategoryFilter) && (
        <div className="flex flex-col md:flex-row gap-4">
          {showSearch && onSearchChange && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="filter-search-input"
                type="text"
                placeholder="Search by title, description..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 bg-white"
              />
            </div>
          )}
          {showCategoryFilter && onCategoryChange && (
            <div className="w-full md:w-48">
              <select
                id="filter-category-select"
                value={selectedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700 bg-white"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Tags quick filter pills */}
      {availableTags.length > 0 && (
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
            Filter by Tags
          </span>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  id={`filter-tag-pill-${tag}`}
                  type="button"
                  onClick={() => onTagToggle(tag)}
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
      )}

      {/* Active Filters as Chips */}
      {hasActiveFilters && (
        <div id="active-filters-chips" className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
          <span className="text-xs font-medium text-slate-500 mr-1">Active filters:</span>

          {searchQuery && onSearchChange && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              Search: "{searchQuery}"
              <button
                id="clear-search-chip"
                onClick={() => onSearchChange('')}
                className="hover:text-indigo-900 font-bold ml-1 cursor-pointer"
              >
                &times;
              </button>
            </span>
          )}

          {selectedCategory && onCategoryChange && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              Category: {selectedCategory}
              <button
                id="clear-category-chip"
                onClick={() => onCategoryChange('')}
                className="hover:text-indigo-900 font-bold ml-1 cursor-pointer"
              >
                &times;
              </button>
            </span>
          )}

          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
            >
              Tag: {tag}
              <button
                id={`clear-tag-chip-${tag}`}
                onClick={() => onTagToggle(tag)}
                className="hover:text-indigo-900 font-bold ml-1 cursor-pointer"
              >
                &times;
              </button>
            </span>
          ))}

          <button
            id="clear-all-filters-btn"
            onClick={onClearAll}
            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors ml-auto cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}
