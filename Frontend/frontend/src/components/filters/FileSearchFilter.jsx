import React, { useState } from 'react';
import { Search, Filter, X, Calendar, FileType, Tag } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const FileSearchFilter = ({ onSearch, onFilter, totalFiles }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    fileType: 'all',
    minSize: '',
    maxSize: '',
    tags: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  const handleSearch = (value) => {
    setSearchTerm(value);
    onSearch(value);
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const clearFilters = () => {
    const defaultFilters = {
      dateFrom: '',
      dateTo: '',
      fileType: 'all',
      minSize: '',
      maxSize: '',
      tags: '',
      sortBy: 'date',
      sortOrder: 'desc'
    };
    setFilters(defaultFilters);
    setSearchTerm('');
    onSearch('');
    onFilter(defaultFilters);
  };

  const activeFilterCount = Object.values(filters).filter(v => 
    v && v !== 'all' && v !== 'date' && v !== 'desc'
  ).length;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Caută fișiere după nume, descriere sau tag-uri..."
            className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 relative ${
            showFilters 
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' 
              : 'bg-dark-800 border border-dark-600 text-gray-300 hover:bg-dark-700'
          }`}
        >
          <Filter className="w-5 h-5" />
          Filtre
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          {totalFiles} fișier{totalFiles !== 1 ? 'e' : ''} găsit{totalFiles !== 1 ? 'e' : ''}
        </span>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-primary-400 hover:text-primary-300 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Șterge filtre
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-4">
          <h3 className="text-white font-medium flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtre Avansate
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                De la dată
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Până la dată
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* File Type */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                <FileType className="w-4 h-4" />
                Tip fișier
              </label>
              <select
                value={filters.fileType}
                onChange={(e) => handleFilterChange('fileType', e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">Toate</option>
                <option value="image">Imagini</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="document">Documente</option>
                <option value="archive">Arhive</option>
                <option value="other">Altele</option>
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tag-uri (separare virgulă)
              </label>
              <input
                type="text"
                value={filters.tags}
                onChange={(e) => handleFilterChange('tags', e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Sortare</label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="date">Dată</option>
                <option value="name">Nume</option>
                <option value="size">Dimensiune</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Ordine</label>
              <select
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="desc">Descrescător</option>
                <option value="asc">Crescător</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileSearchFilter;


