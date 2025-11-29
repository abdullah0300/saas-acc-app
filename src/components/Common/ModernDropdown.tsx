import React, { useState, useRef, useEffect } from 'react';
import { Search, Check, Plus, Sparkles, X } from 'lucide-react';

interface ModernDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    id: string;
    name: string;
    count?: number;
  }>;
  placeholder?: string;
  aiSuggested?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
  className?: string;
  required?: boolean;
}

export const ModernDropdown: React.FC<ModernDropdownProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  aiSuggested = false,
  onAddNew,
  addNewLabel = 'Add new...',
  className = '',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get selected option
  const selectedOption = options.find(opt => opt.id === value);

  // Filter options based on search
  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].id);
          setIsOpen(false);
          setSearchQuery('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        break;
    }
  };

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(0);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Label with AI Badge */}
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {aiSuggested && (
          <span className="flex items-center gap-1 text-xs text-purple-600">
            <Sparkles className="h-3 w-3" />
            AI Suggested
          </span>
        )}
      </div>

      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`
          w-full px-4 py-2.5 text-left
          border rounded-lg
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${aiSuggested
            ? 'border-purple-300 bg-purple-50/30'
            : 'border-gray-300 bg-white'
          }
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
          hover:border-gray-400
          flex items-center justify-between
          group
        `}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <div className="flex items-center gap-2">
          {selectedOption && !isOpen && (
            <X
              className="h-4 w-4 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleClear}
            />
          )}
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              <div className="py-1">
                {filteredOptions.map((option, index) => {
                  const isSelected = option.id === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelect(option.id)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`
                        w-full px-4 py-2.5 text-left
                        flex items-center justify-between
                        transition-all duration-150
                        ${isSelected
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : isHighlighted
                          ? 'bg-gradient-to-r from-gray-50 to-blue-50/50'
                          : 'hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {isSelected && (
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        )}
                        <span className={`${isSelected ? '' : 'ml-7'}`}>
                          {option.name}
                        </span>
                      </div>
                      {option.count !== undefined && (
                        <span className="text-xs text-gray-400 ml-2">
                          ({option.count})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No results found for "{searchQuery}"
              </div>
            )}
          </div>

          {/* Add New Option */}
          {onAddNew && (
            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  onAddNew();
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className="w-full px-4 py-3 text-left flex items-center gap-2 text-blue-600 hover:bg-blue-50 transition-colors duration-150 font-medium"
              >
                <Plus className="h-4 w-4" />
                {addNewLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModernDropdown;
