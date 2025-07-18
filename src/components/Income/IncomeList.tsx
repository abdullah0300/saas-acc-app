import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Client } from '../../types';
import { getClients } from '../../services/database';
import { useData } from '../../contexts/DataContext';

import { SkeletonTable } from '../Common/Loading';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  FileText,
  ChevronDown,
  Check,
  X,
  MoreVertical,
  ArrowUpDown
} from 'lucide-react';
import { getIncomes, deleteIncome, getCategories } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext'; // Added useSettings import
import { format, startOfMonth, endOfMonth, subMonths, parseISO, startOfWeek, endOfWeek, startOfYear, endOfYear, subYears } from 'date-fns';
import { Income, Category } from '../../types';

export const IncomeList: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useSettings(); // Added formatCurrency
// Remove local incomes state - we'll use cached data instead
const { businessData, businessDataLoading, refreshBusinessData } = useData();
const { incomes } = businessData;  const [filteredIncomes, setFilteredIncomes] = useState<Income[]>([]);
const { categories: allCategories } = businessData;
const categories = allCategories.income; // Use income categories from DataContext
const loading = businessDataLoading;
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('this-month');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [clientFilter, setClientFilter] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
const [clientSearch, setClientSearch] = useState('');
// Custom date range states
const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
const [customStartDate, setCustomStartDate] = useState('');
const [customEndDate, setCustomEndDate] = useState('');
// Pagination states
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage] = useState(50); // 50 items per page
// Bulk selection states
const [selectedItems, setSelectedItems] = useState<string[]>([]);
const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
  // Data is already loaded by DataContext, just filter when dateRange changes
  filterAndSortIncomes();
}, [user, dateRange, incomes, customStartDate, customEndDate]); // Added custom date dependencies // Added incomes dependency

  useEffect(() => {
  filterAndSortIncomes();
}, [searchTerm, selectedCategory, sortBy, sortOrder, incomes, clientFilter, clientSearch]); // ADD clientFilter, clientSearch

  const loadClients = async () => {
  if (!user) return;
  
  try {
    const data = await getClients(user.id);
    setClients(data);
  } catch (err: any) {
    console.error('Error loading clients:', err);
  }
};  


// ADD THIS FUNCTION:
const handleBulkDelete = async () => {
  if (selectedItems.length === 0) return;
  
  const confirmed = window.confirm(
    `Are you sure you want to delete ${selectedItems.length} income record(s)? This action cannot be undone.`
  );
  
  if (!confirmed) return;
  
  try {
    // Delete each selected item
    await Promise.all(
      selectedItems.map(id => deleteIncome(id))
    );
    
    // Refresh data and clear selections
    await refreshBusinessData();
    clearSelections();
    
    alert(`Successfully deleted ${selectedItems.length} income record(s)`);
  } catch (error) {
    console.error('Error deleting incomes:', error);
    alert('Error deleting some records. Please try again.');
  }
};



// ADD THIS FUNCTION:
const handleBulkExport = () => {
  if (selectedItems.length === 0) {
    alert('Please select items to export');
    return;
  }
  
  const selectedIncomes = filteredIncomes.filter(income => 
    selectedItems.includes(income.id)
  );
  
  const headers = ['Date', 'Description', 'Category', 'Client', 'Amount', 'Reference'];
  const csvData = selectedIncomes.map(income => [
    format(parseISO(income.date), 'yyyy-MM-dd'),
    income.description,
    income.category?.name || 'Uncategorized',
    income.client?.name || 'No client',
    income.amount.toString(),
    income.reference_number || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `selected-income-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  
  alert(`Exported ${selectedItems.length} income record(s)`);
};

// Handle custom date range
const handleCustomDateRange = () => {
  if (!customStartDate || !customEndDate) {
    alert('Please select both start and end dates');
    return;
  }
  
  if (new Date(customStartDate) > new Date(customEndDate)) {
    alert('Start date cannot be after end date');
    return;
  }
  
  setDateRange('custom');
  setShowCustomDatePicker(false);
};

// Reset custom date picker
const resetCustomDatePicker = () => {
  setCustomStartDate('');
  setCustomEndDate('');
  setShowCustomDatePicker(false);
};  

// Helper function to get user-friendly date range names
const getDateRangeDisplayName = (range: string) => {
  const currentYear = new Date().getFullYear();
  
  switch (range) {
    case 'today':
      return 'Today';
    case 'this-week':
      return 'This Week';
    case 'this-month':
      return 'This Month';
    case 'last-month':
      return 'Last Month';
    case 'this-year':
      return `This Year (${currentYear})`;
    case 'last-year':
      return `Last Year (${currentYear - 1})`;
  
    case 'custom':
      if (customStartDate && customEndDate) {
        return `${format(parseISO(customStartDate), 'MMM dd, yyyy')} - ${format(parseISO(customEndDate), 'MMM dd, yyyy')}`;
      }
      return 'Custom Range';
    case 'all':
      return 'All Time';
    default:
      return 'Selected Period';
  }
};

// Function to search all time when user wants to expand
const searchAllTime = () => {
  setDateRange('all');
  // The useEffect will automatically re-run the search with new date range
};

// Helper function to get search results count message
const getSearchResultsMessage = () => {
  const totalIncomes = incomes.length;
  const filteredCount = filteredIncomes.length;
  const isSearching = searchTerm.length > 0;
  const scopeName = getDateRangeDisplayName(dateRange);
  
  if (isSearching) {
    return {
      primary: `Found ${filteredCount} result${filteredCount !== 1 ? 's' : ''}`,
      secondary: `Searching in: ${scopeName}`,
      showExpandOption: filteredCount < 5 && dateRange !== 'all' && totalIncomes > filteredCount
    };
  }
  
  return {
    primary: `Showing ${filteredCount} record${filteredCount !== 1 ? 's' : ''}`,
    secondary: `From: ${scopeName}`,
    showExpandOption: false
  };
};

 const filterAndSortIncomes = () => {
  let filtered = [...incomes];
  
  // Date Range Filter - FIXED VERSION
  if (dateRange !== 'all') {
    const now = new Date();
    filtered = filtered.filter(income => {
      const incomeDate = parseISO(income.date);
      
      switch (dateRange) {
        case 'today':
          return format(incomeDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
        
        case 'this-week':
          const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
          const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
          return incomeDate >= weekStart && incomeDate <= weekEnd;
        
        case 'this-month':
          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);
          return incomeDate >= monthStart && incomeDate <= monthEnd;
        
        case 'last-month':
          const lastMonth = subMonths(now, 1);
          const lastMonthStart = startOfMonth(lastMonth);
          const lastMonthEnd = endOfMonth(lastMonth);
          return incomeDate >= lastMonthStart && incomeDate <= lastMonthEnd;
        
        case 'this-year':
          const yearStart = startOfYear(now);
          const yearEnd = endOfYear(now);
          return incomeDate >= yearStart && incomeDate <= yearEnd;
          case 'last-year':
          const lastYear = subYears(now, 1);
          const lastYearStart = startOfYear(lastYear);
          const lastYearEnd = endOfYear(lastYear);
          return incomeDate >= lastYearStart && incomeDate <= lastYearEnd;
        
       
        
        case 'custom':
          if (customStartDate && customEndDate) {
            const customStart = parseISO(customStartDate);
            const customEnd = parseISO(customEndDate);
            return incomeDate >= customStart && incomeDate <= customEnd;
          }
          return true;
        
        default:
          return true;
      }
    });
  }
  
  // Search filter
  if (searchTerm) {
    filtered = filtered.filter(income =>
      income.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.category?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.client?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  // Category filter
  if (selectedCategory !== 'all') {
    filtered = filtered.filter(income => income.category_id === selectedCategory);
  }
  
  // Client filtering
  if (clientFilter) {
    if (clientFilter === 'no-client') {
      filtered = filtered.filter(income => !income.client_id);
    } else {
      filtered = filtered.filter(income => income.client_id === clientFilter);
    }
  }
  
  // Client search
  if (clientSearch) {
    filtered = filtered.filter(income => 
      income.client?.name.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }
  
  // Sort
  filtered.sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    } else {
      return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
  });
  
  setFilteredIncomes(filtered);
    setCurrentPage(1);

};

// ADD THIS ENTIRE FUNCTION:
const getPaginatedIncomes = () => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return filteredIncomes.slice(startIndex, endIndex);
};

// ADD THESE FUNCTIONS:
const handleSelectAll = (checked: boolean) => {
  setSelectAll(checked);
  if (checked) {
    const currentPageIds = paginatedIncomes.map(income => income.id);
    setSelectedItems(currentPageIds);
  } else {
    setSelectedItems([]);
  }
};

const handleSelectItem = (incomeId: string, checked: boolean) => {
  if (checked) {
    setSelectedItems(prev => [...prev, incomeId]);
  } else {
    setSelectedItems(prev => prev.filter(id => id !== incomeId));
    setSelectAll(false);
  }
};

const clearSelections = () => {
  setSelectedItems([]);
  setSelectAll(false);
};

const totalPages = Math.ceil(filteredIncomes.length / itemsPerPage);
const paginatedIncomes = getPaginatedIncomes();

  const handleDelete = async (id: string) => {
  if (!window.confirm('Are you sure you want to delete this income record?')) return;
  
  try {
    await deleteIncome(id);
    await refreshBusinessData(); // ✅ Refresh cache instead
  } catch (err: any) {
    alert('Error deleting income: ' + err.message);
  }
};

  const exportToCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Reference'];
    const data = filteredIncomes.map(income => [
      format(parseISO(income.date), 'yyyy-MM-dd'),
      income.description,
      income.category?.name || 'Uncategorized',
      income.client?.name || 'No client',
      income.amount.toString(),
      income.reference_number || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `income-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const totalIncome = filteredIncomes.reduce((sum, income) => sum + income.amount, 0);
  const averageIncome = filteredIncomes.length > 0 ? totalIncome / filteredIncomes.length : 0;

  if (loading) return <SkeletonTable rows={10} columns={6} hasActions={true} />;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Income</h1>
          <p className="text-gray-600 mt-1">Manage and track your revenue streams</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
          >
            <Download className="h-4 w-4 mr-2 text-gray-600" />
            Export
          </button>
          <Link
            to="/income/new"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Income
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Total Income</p>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalIncome)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {filteredIncomes.length} transactions
          </p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Average Income</p>
            <div className="p-2 bg-indigo-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(Math.round(averageIncome))}
          </p>
          <p className="text-sm text-gray-500 mt-1">Per transaction</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Categories</p>
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {categories.length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Active categories</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
      <input
        type="text"
        placeholder={`Search income records in ${getDateRangeDisplayName(dateRange)}...`}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
      
      
      {/* Search Scope Badge */}
      {searchTerm && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm font-medium border border-indigo-200">
            <Calendar className="h-3 w-3" />
            <span className="hidden sm:inline">{getDateRangeDisplayName(dateRange)}</span>
            <span className="sm:hidden">Period</span>
          </div>
        </div>
      )}
      
    </div>
    {/* Search Results Indicator */}
  {(searchTerm || filteredIncomes.length !== incomes.length) && (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200/50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-indigo-700">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
          <span className="font-semibold text-sm">
            {getSearchResultsMessage().primary}
          </span>
        </div>
        <div className="text-sm text-indigo-600">
          {getSearchResultsMessage().secondary}
        </div>
      </div>
      
      {/* Expand Search Option */}
      {getSearchResultsMessage().showExpandOption && (
        <button
          onClick={searchAllTime}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm text-indigo-600 rounded-lg hover:bg-white transition-all text-sm font-medium shadow-sm hover:shadow-md border border-indigo-200/50"
        >
          <Search className="h-3 w-3" />
          <span>Search All Time</span>
        </button>
      )}
    </div>
    
  )}
{/* Filter Controls */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      {/* Active Filters Indicator */}
      {(dateRange !== 'this-month' || selectedCategory !== 'all' || clientFilter) && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          <div className="flex gap-1">
            {dateRange !== 'this-month' && (
              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium">
                📅 {getDateRangeDisplayName(dateRange)}
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-medium">
                📁 {categories.find(cat => cat.id === selectedCategory)?.name || 'Category'}
              </span>
            )}
            {clientFilter && (
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium">
                👤 {clientFilter === 'no-client' ? 'No Client' : clients.find(client => client.id === clientFilter)?.name || 'Client'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
            <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  showFilters 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg transform scale-105' 
                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white   hover:bg-white border border-indigo-200/50 shadow-sm hover:shadow-md hover:scale-105'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
              </button>
          </div>
          
          {/* Advanced Filters */}
            {showFilters && (
              <div className="pt-6 pb-8">
                <div className="bg-gradient-to-br from-slate-50/80 via-white/90 to-indigo-50/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-indigo-100/50 border border-white/60 p-6">
                  
                  {/* Filter Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                      <Filter className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Advanced Filters
                    </h3>
                  </div>

                  {/* Modern Filter Grid */}
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${dateRange === 'custom' || showCustomDatePicker ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
                    
                    {/* Date Range Filter */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-500" />
                        Date Range
                      </label>
                      <div className="relative">
                        <select
                          value={dateRange}
                          onChange={(e) => setDateRange(e.target.value)}
                          className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-indigo-200 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-200/50 focus:border-indigo-400 transition-all duration-200 text-gray-700 font-medium shadow-sm hover:shadow-md appearance-none cursor-pointer"
                        >
                          <option value="today">Today</option>
                          <option value="this-week">This Week</option>
                          <option value="this-month">This Month</option>
                          <option value="last-month">Last Month</option>
                          <option value="this-year">This Year ({new Date().getFullYear()})</option>
                          <option value="last-year">Last Year ({new Date().getFullYear() - 1})</option>
                        
                          <option value="custom">🎯 Custom Date Range</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-indigo-400 pointer-events-none" />
                      </div>
                    </div>
                    
                    {/* Category Filter */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-500" />
                        Category
                      </label>
                      <div className="relative">
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-purple-200 rounded-xl focus:outline-none focus:ring-3 focus:ring-purple-200/50 focus:border-purple-400 transition-all duration-200 text-gray-700 font-medium shadow-sm hover:shadow-md appearance-none cursor-pointer"
                        >
                          <option value="all">All Categories</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Client Filter */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        Client
                      </label>
                      <div className="relative">
                        <select
                          value={clientFilter}
                          onChange={(e) => setClientFilter(e.target.value)}
                          className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-emerald-200 rounded-xl focus:outline-none focus:ring-3 focus:ring-emerald-200/50 focus:border-emerald-400 transition-all duration-200 text-gray-700 font-medium shadow-sm hover:shadow-md appearance-none cursor-pointer"
                        >
                          <option value="">All Clients</option>
                          <option value="no-client">🚫 No Client</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              👤 {client.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-emerald-400 pointer-events-none" />
                      </div>
                    </div>
                    
                    {/* Sort Options */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <ArrowUpDown className="h-4 w-4 text-blue-500" />
                        Sort By
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
                            className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-blue-200 rounded-xl focus:outline-none focus:ring-3 focus:ring-blue-200/50 focus:border-blue-400 transition-all duration-200 text-gray-700 font-medium shadow-sm hover:shadow-md appearance-none cursor-pointer"
                          >
                            <option value="date">📅 Date</option>
                            <option value="amount">💰 Amount</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400 pointer-events-none" />
                        </div>
                        <button
                          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                          className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center"
                          title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                        >
                          <ArrowUpDown className={`h-4 w-4 transition-transform duration-200 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Date Picker Section */}
                  {(dateRange === 'custom' || showCustomDatePicker) && (
                    <div className="mt-6 p-6 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 backdrop-blur-sm rounded-2xl border border-indigo-200/50 shadow-inner">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg">
                          <Calendar className="h-4 w-4 text-white" />
                        </div>
                        <h4 className="text-md font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          Custom Date Range
                        </h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-600">Start Date</label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full px-4 py-3 bg-white/90 backdrop-blur-sm border border-indigo-200 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-200/50 focus:border-indigo-400 transition-all duration-200 text-gray-700 font-medium shadow-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-600">End Date</label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full px-4 py-3 bg-white/90 backdrop-blur-sm border border-indigo-200 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-200/50 focus:border-indigo-400 transition-all duration-200 text-gray-700 font-medium shadow-sm"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={handleCustomDateRange}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
                        >
                          <Calendar className="h-4 w-4" />
                          Apply Range
                        </button>
                        <button
                          onClick={resetCustomDatePicker}
                          className="px-6 py-3 bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Filter Pills */}
                  <div className="mt-6 pt-6 border-t border-gray-200/50">
                    <p className="text-sm font-medium text-gray-600 mb-3">Quick Filters:</p>
                    <div className="flex flex-wrap gap-2">
                      {['today', 'this-week', 'this-month', 'this-year'].map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setDateRange(filter)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            dateRange === filter
                              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                              : 'bg-white/60 text-gray-600 hover:bg-white/80 border border-gray-200/50'
                          }`}
                        >
                          {filter.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Income Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {/* ADD THIS BULK ACTION TOOLBAR: */}
        {selectedItems.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-indigo-700 font-medium">
                  {selectedItems.length} item(s) selected
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleBulkExport}
                  className="inline-flex items-center px-3 py-2 border border-indigo-300 shadow-sm text-sm leading-4 font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </button>
                <button
                  onClick={clearSelections}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th scope="col" className="relative w-12 px-6 sm:w-16 sm:px-8">
                    <input
                      type="checkbox"
                      className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedIncomes.length > 0 ? (
  paginatedIncomes.map((income: Income) => (
                  <tr key={income.id} className="hover:bg-gray-50 transition-colors">
                    <td className="relative w-12 px-6 sm:w-16 sm:px-8">
      <input
        type="checkbox"
        className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
        checked={selectedItems.includes(income.id)}
        onChange={(e) => handleSelectItem(income.id, e.target.checked)}
      />
    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        {format(parseISO(income.date), 'MMM dd, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate">{income.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">
                        {income.category?.name || 'Uncategorized'}
                      </span>
                    </td>
                    {/* Client Column - ADD THIS */}
<td className="px-6 py-4 whitespace-nowrap">
  {income.client ? (
    <div className="flex items-center">
      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white text-xs font-medium mr-3">
        {income.client.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <div className="text-sm font-medium text-gray-900">{income.client.name}</div>
        {income.client.email && (
          <div className="text-xs text-gray-500">{income.client.email}</div>
        )}
      </div>
    </div>
  ) : (
    <span className="text-sm text-gray-400 italic">No client</span>
  )}
</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {income.reference_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right">
                      <span className="text-emerald-600">
                        {formatCurrency(income.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          to={`/income/edit/${income.id}`}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(income.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <DollarSign className="h-12 w-12 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg">No income records found</p>
                      <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or add a new income record</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* ADD THIS ENTIRE PAGINATION SECTION: */}
{filteredIncomes.length > itemsPerPage && (
  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-6">
    <div className="flex flex-1 justify-between sm:hidden">
      <button
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
      >
        Previous
      </button>
      <button
        onClick={() => {
  setCurrentPage(Math.min(totalPages, currentPage + 1));
  clearSelections(); // ADD THIS LINE
}}
        disabled={currentPage === totalPages}
        className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
      >
        Next
      </button>
    </div>
    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-gray-700">
          Showing{' '}
          <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
          <span className="font-medium">
            {Math.min(currentPage * itemsPerPage, filteredIncomes.length)}
          </span> of{' '}
          <span className="font-medium">{filteredIncomes.length}</span> results
        </p>
      </div>
      <div>
        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:bg-gray-100"
          >
            <span className="sr-only">Previous</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
            </svg>
          </button>
          
          {/* Page Numbers */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNumber: number;
            if (totalPages <= 5) {
              pageNumber = i + 1;
            } else if (currentPage <= 3) {
              pageNumber = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNumber = totalPages - 4 + i;
            } else {
              pageNumber = currentPage - 2 + i;
            }
            
            return (
              <button
                key={pageNumber}
                onClick={() => {
  setCurrentPage(pageNumber);
  clearSelections(); // ADD THIS LINE
}}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                  currentPage === pageNumber
                    ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                    : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                }`}
              >
                {pageNumber}
              </button>
            );
          })}
          
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:bg-gray-100"
          >
            <span className="sr-only">Next</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  </div>
)}
    </div>
  );
};