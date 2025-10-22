import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import {  Users, Clock, RefreshCw, Copy, DollarSign } from 'lucide-react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Download,
  Calendar,
  TrendingDown,
  Receipt,
  FileText,
  ChevronDown,
  ArrowUpDown,
  Eye,
  ShoppingCart,
  X
} from 'lucide-react';
import { getExpenses, deleteExpense, getCategories } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext'; // Added useSettings import
import { format, startOfMonth, endOfMonth, subMonths, parseISO, startOfWeek, endOfWeek, startOfYear, endOfYear, subYears } from 'date-fns';
import { Expense, Category } from '../../types';

export const ExpenseList: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();

const { businessData, businessDataLoading, refreshBusinessData } = useData();
const { expenses } = businessData;  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
const { categories: allCategories } = businessData;
const categories = allCategories.expense; // Use expense categories from DataContext
const loading = businessDataLoading;
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [error, setError] = useState('');

  // Expense detail modal state
const [showDetailModal, setShowDetailModal] = useState(false);
const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Filter states - Initialize from URL params
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'all');
  const [dateRange, setDateRange] = useState<string>(searchParams.get('date') || 'this-month');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>((searchParams.get('sort') as 'date' | 'amount') || 'date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('order') as 'asc' | 'desc') || 'desc');
  const [showFilters, setShowFilters] = useState(false);
// Pagination states
const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
const [itemsPerPage] = useState(50); // 50 items per page

// Bulk selection states
const [selectedItems, setSelectedItems] = useState<string[]>([]);
const [selectAll, setSelectAll] = useState(false);
// Custom date range states - Initialize from URL
const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
const [customStartDate, setCustomStartDate] = useState(searchParams.get('start') || '');
const [customEndDate, setCustomEndDate] = useState(searchParams.get('end') || '');

  // Sync filters to URL params
  useEffect(() => {
    const params = new URLSearchParams();

    // Only add non-default values to keep URL clean
    if (searchTerm) params.set('q', searchTerm);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (dateRange !== 'this-month') params.set('date', dateRange);
    if (sortBy !== 'date') params.set('sort', sortBy);
    if (sortOrder !== 'desc') params.set('order', sortOrder);
    if (currentPage !== 1) params.set('page', currentPage.toString());
    if (customStartDate) params.set('start', customStartDate);
    if (customEndDate) params.set('end', customEndDate);

    // Update URL without causing navigation
    setSearchParams(params, { replace: true });
  }, [searchTerm, selectedCategory, dateRange, sortBy, sortOrder, currentPage, customStartDate, customEndDate]);

  useEffect(() => {
  filterAndSortExpenses();
}, [user, dateRange, expenses, customStartDate, customEndDate]);

  useEffect(() => {
    filterAndSortExpenses();
  }, [searchTerm, selectedCategory, sortBy, sortOrder, expenses]);

 

  const filterAndSortExpenses = () => {
  let filtered = [...expenses];
  
  // Date Range Filter - FIXED VERSION
  if (dateRange !== 'all') {
    const now = new Date();
    filtered = filtered.filter(expense => {
      const expenseDate = parseISO(expense.date);
      
      switch (dateRange) {
        case 'today':
          return format(expenseDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
        
        case 'this-week':
          const weekStart = startOfWeek(now, { weekStartsOn: 1 });
          const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
          return expenseDate >= weekStart && expenseDate <= weekEnd;
        
        case 'this-month':
          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);
          return expenseDate >= monthStart && expenseDate <= monthEnd;
        
        case 'last-month':
          const lastMonth = subMonths(now, 1);
          const lastMonthStart = startOfMonth(lastMonth);
          const lastMonthEnd = endOfMonth(lastMonth);
          return expenseDate >= lastMonthStart && expenseDate <= lastMonthEnd;
        
        case 'this-year':
          const yearStart = startOfYear(now);
          const yearEnd = endOfYear(now);
          return expenseDate >= yearStart && expenseDate <= yearEnd;
        case 'last-year':
          const lastYear = subYears(now, 1);
          const lastYearStart = startOfYear(lastYear);
          const lastYearEnd = endOfYear(lastYear);
          return expenseDate >= lastYearStart && expenseDate <= lastYearEnd;
        
        case 'custom':
          if (customStartDate && customEndDate) {
            const customStart = parseISO(customStartDate);
            const customEnd = parseISO(customEndDate);
            return expenseDate >= customStart && expenseDate <= customEnd;
          }
          return true;
        default:
          return true;
      }
    });
  }
  
  // Search filter
  if (searchTerm) {
    filtered = filtered.filter(expense =>
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.reference_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  // Category filter
  if (selectedCategory !== 'all') {
    filtered = filtered.filter(expense => expense.category_id === selectedCategory);
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
  
  setFilteredExpenses(filtered);
  setCurrentPage(1);
};

// ADD ALL THESE FUNCTIONS:

// Pagination logic
const getPaginatedExpenses = () => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return filteredExpenses.slice(startIndex, endIndex);
};

const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
const paginatedExpenses = getPaginatedExpenses();

// Selection helper functions
const handleSelectAll = (checked: boolean) => {
  setSelectAll(checked);
  if (checked) {
    const currentPageIds = paginatedExpenses.map(expense => expense.id);
    setSelectedItems(currentPageIds);
  } else {
    setSelectedItems([]);
  }
};

const handleSelectItem = (expenseId: string, checked: boolean) => {
  if (checked) {
    setSelectedItems(prev => [...prev, expenseId]);
  } else {
    setSelectedItems(prev => prev.filter(id => id !== expenseId));
    setSelectAll(false);
  }
};

const clearSelections = () => {
  setSelectedItems([]);
  setSelectAll(false);
};

// Bulk delete function
const handleBulkDelete = async () => {
  if (selectedItems.length === 0) return;
  
  const confirmed = window.confirm(
    `Are you sure you want to delete ${selectedItems.length} expense record(s)? This action cannot be undone.`
  );
  
  if (!confirmed) return;
  
  try {
    // Delete each selected item
    await Promise.all(
      selectedItems.map(id => deleteExpense(id, user!.id))
    );
    
    // Refresh data and clear selections
    await refreshBusinessData();
    clearSelections();
    
    alert(`Successfully deleted ${selectedItems.length} expense record(s)`);
  } catch (error) {
    console.error('Error deleting expenses:', error);
    alert('Error deleting some records. Please try again.');
  }
};

// Bulk export function
const handleBulkExport = () => {
  if (selectedItems.length === 0) {
    alert('Please select items to export');
    return;
  }

  const selectedExpenses = filteredExpenses.filter(expense =>
    selectedItems.includes(expense.id)
  );

  const headers = ['Date', 'Description', 'Category', 'Vendor', 'Amount', 'Currency', 'Receipt'];
  const csvData = selectedExpenses.map(expense => [
    format(parseISO(expense.date), 'yyyy-MM-dd'),
    expense.description,
    expense.category?.name || 'Uncategorized',
    expense.vendor_detail?.name || expense.vendor || 'No vendor',
    expense.reference_number || '',
    expense.amount.toString(),
    expense.currency || baseCurrency,
    expense.receipt_url ? 'Yes' : 'No',
  ]);

  const csvContent = [
    headers.join(','),
    ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `selected-expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();

  alert(`Exported ${selectedItems.length} expense record(s)`);
};

// Helper function to get search results count message
const getSearchResultsMessage = () => {
  const totalExpenses = expenses.length;
  const filteredCount = filteredExpenses.length;
  const isSearching = searchTerm.length > 0;
  const scopeName = getDateRangeDisplayName(dateRange);
  
  if (isSearching) {
    return {
      primary: `Found ${filteredCount} result${filteredCount !== 1 ? 's' : ''}`,
      secondary: `Searching in: ${scopeName}`,
      showExpandOption: filteredCount < 5 && dateRange !== 'all' && totalExpenses > filteredCount
    };
  }
  
  return {
    primary: `Showing ${filteredCount} record${filteredCount !== 1 ? 's' : ''}`,
    secondary: `From: ${scopeName}`,
    showExpandOption: false
  };
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

// Function to search all time when user wants to expand
const searchAllTime = () => {
  setDateRange('all');
  // The useEffect will automatically re-run the search with new date range
};

// Clear all active filters
const clearAllFilters = () => {
  setSearchTerm('');
  setSelectedCategory('all');
  setDateRange('this-month');
  setSortBy('date');
  setSortOrder('desc');
  setCurrentPage(1);
  setCustomStartDate('');
  setCustomEndDate('');
};

// Check if any filters are active
const hasActiveFilters = () => {
  return searchTerm !== '' ||
         selectedCategory !== 'all' ||
         dateRange !== 'this-month' ||
         sortBy !== 'date' ||
         sortOrder !== 'desc' ||
         customStartDate !== '' ||
         customEndDate !== '';
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

  const handleDelete = async (id: string) => {
  if (!window.confirm('Are you sure you want to delete this expense record?')) return;

  try {
    await deleteExpense(id, user!.id);
    await refreshBusinessData(); // ✅ Refresh cache instead
  } catch (err: any) {
    alert('Error deleting expense: ' + err.message);
  }
};

const handleViewDetails = (expense: Expense) => {
  setSelectedExpense(expense);
  setShowDetailModal(true);
};

  const exportToCSV = () => {
    const headers = ['Date', 'Description', 'Vendor', 'Category', 'Amount', 'Receipt'];
    const data = filteredExpenses.map(expense => [
      format(parseISO(expense.date), 'yyyy-MM-dd'),
      expense.description,
      expense.vendor || '',
      expense.category?.name || 'Uncategorized',
      expense.amount.toString(),
      expense.receipt_url ? 'Yes' : 'No'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Use base_amount for accurate totals across currencies
  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + (expense.base_amount || expense.amount), 0);
  const averageExpense = filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0;
  const expensesWithReceipts = filteredExpenses.filter(e => e.receipt_url).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
  <div>
    <h1 className="text-3xl font-bold text-gray-900 sm:text-2xl">Expenses</h1>
    <p className="text-gray-600 mt-1 sm:text-sm">Track and manage your business expenses</p>
  </div>
         
  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
    <button
      onClick={exportToCSV}
      className="inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all sm:justify-start"
    >
      <Download className="h-4 w-4 mr-2 text-gray-600 sm:h-3 sm:w-3" />
      <span className="sm:text-sm">Export</span>
    </button>
    
    <Link
      to="/vendors"
      className="flex items-center justify-center px-4 py-2 text-white bg-gradient-to-r from-blue-600 to-indigo-600 border border-blue-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 transform hover:scale-105 sm:justify-start"
    >
      <Building2 className="h-5 w-5 mr-2 sm:h-4 sm:w-4" />
      <span className="font-medium sm:text-sm">Manage Vendors</span>
    </Link>
    
    <Link
      to="/expenses/new"
      className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all transform hover:scale-105 shadow-lg shadow-red-200 sm:justify-start"
    >
      <Plus className="h-4 w-4 mr-2 sm:h-3 sm:w-3" />
      <span className="font-medium sm:text-sm">Add Expense</span>
    </Link>
  </div>
</div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Total Expenses</p>
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalExpenses, baseCurrency)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {filteredExpenses.length} transactions
          </p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Average Expense</p>
            <div className="p-2 bg-orange-100 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(Math.round(averageExpense), baseCurrency)}
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
        
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">With Receipts</p>
            <div className="p-2 bg-green-100 rounded-lg">
              <Receipt className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {expensesWithReceipts}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {filteredExpenses.length > 0 
              ? `${Math.round((expensesWithReceipts / filteredExpenses.length) * 100)}% documented`
              : '0% documented'}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-gray-100/50 border border-gray-100/60 p-6">
  <div className="space-y-4">
    {/* Enhanced Search Bar with Scope Indicators */}
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={`Search expense records in ${getDateRangeDisplayName(dateRange)}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 w-full border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all"
          />
          
          {/* Search Scope Badge */}
          {searchTerm && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-sm font-medium border border-blue-100">
                <Calendar className="h-3 w-3" />
                <span className="hidden sm:inline">{getDateRangeDisplayName(dateRange)}</span>
                <span className="sm:hidden">Period</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Search Results Indicator */}
      {(searchTerm || filteredExpenses.length !== expenses.length) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="font-semibold text-sm">
                {getSearchResultsMessage().primary}
              </span>
            </div>
            <div className="text-sm text-blue-600">
              {getSearchResultsMessage().secondary}
            </div>
          </div>
          
          {/* Expand Search Option */}
          {getSearchResultsMessage().showExpandOption && (
            <button
              onClick={searchAllTime}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm text-blue-600 rounded-lg hover:bg-white transition-all text-sm font-medium shadow-sm hover:shadow-md border border-blue-100/50"
            >
              <Search className="h-3 w-3" />
              <span>Search All Time</span>
            </button>
          )}
        </div>
      )}

      {/* Active Filter Chips */}
      {hasActiveFilters() && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Active Filters:</span>

          {searchTerm && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium border border-indigo-200">
              <Search className="h-3 w-3" />
              <span>Search: {searchTerm}</span>
              <button
                onClick={() => setSearchTerm('')}
                className="ml-1 hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {selectedCategory !== 'all' && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium border border-purple-200">
              <Filter className="h-3 w-3" />
              <span>Category: {categories.find(cat => cat.id === selectedCategory)?.name || 'Unknown'}</span>
              <button
                onClick={() => setSelectedCategory('all')}
                className="ml-1 hover:bg-purple-200 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {dateRange !== 'this-month' && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
              <Calendar className="h-3 w-3" />
              <span>Date: {getDateRangeDisplayName(dateRange)}</span>
              <button
                onClick={() => {
                  setDateRange('this-month');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {(sortBy !== 'date' || sortOrder !== 'desc') && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium border border-green-200">
              <ArrowUpDown className="h-3 w-3" />
              <span>Sort: {sortBy === 'date' ? 'Date' : 'Amount'} ({sortOrder === 'asc' ? 'Ascending' : 'Descending'})</span>
              <button
                onClick={() => {
                  setSortBy('date');
                  setSortOrder('desc');
                }}
                className="ml-1 hover:bg-green-200 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Clear All Filters Button */}
          {hasActiveFilters() && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all"
            >
              <X className="h-4 w-4" />
              Clear All Filters
            </button>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              showFilters
                ? 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-md'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm hover:shadow-md'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters() && (
              <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-white/20 rounded-full">
                {[
                  searchTerm !== '',
                  selectedCategory !== 'all',
                  dateRange !== 'this-month',
                  sortBy !== 'date' || sortOrder !== 'desc',
                  customStartDate !== '' || customEndDate !== ''
                ].filter(Boolean).length}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </div>
    
    {/* Modern Advanced Filters */}
    {showFilters && (
      <div className="pt-6 pb-8">
        <div className="bg-gradient-to-br from-gray-50/80 via-white/90 to-blue-50/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-gray-100/50 border border-gray-100/60 p-6">
          
          {/* Filter Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl shadow-sm">
              <Filter className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Advanced Filters
            </h3>
          </div>

          {/* Modern Filter Grid */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${dateRange === 'custom' || showCustomDatePicker ? 'xl:grid-cols-2' : 'xl:grid-cols-3'}`}>
            
            {/* Date Range Filter */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Date Range
              </label>
              <div className="relative">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all duration-200 text-gray-700 font-medium shadow-sm hover:shadow-md appearance-none cursor-pointer"
                >
                  <option value="today">Today</option>
                  <option value="this-week">This Week</option>
                  <option value="this-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="this-year">This Year ({new Date().getFullYear()})</option>
                  <option value="last-year">Last Year ({new Date().getFullYear() - 1})</option>
                  <option value="custom">🎯 Custom Date Range</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400 pointer-events-none" />
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
                  className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 transition-all duration-200 text-gray-700 font-medium shadow-sm hover:shadow-md appearance-none cursor-pointer"
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
            
            {/* Sort Options */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-emerald-500" />
                Sort By
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
                    className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300 transition-all duration-200 text-gray-700 font-medium shadow-sm hover:shadow-md appearance-none cursor-pointer"
                  >
                    <option value="date">📅 Date</option>
                    <option value="amount">💰 Amount</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-emerald-400 pointer-events-none" />
                </div>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 text-white rounded-xl hover:from-emerald-500 hover:to-teal-600 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 flex items-center"
                  title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                >
                  <ArrowUpDown className={`h-4 w-4 transition-transform duration-200 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Custom Date Picker Section */}
          {(dateRange === 'custom' || showCustomDatePicker) && (
            <div className="mt-6 p-6 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 backdrop-blur-sm rounded-2xl border border-blue-100/50 shadow-inner">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-1.5 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-lg">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <h4 className="text-md font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
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
                    className="w-full px-4 py-3 bg-white/90 backdrop-blur-sm border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all duration-200 text-gray-700 font-medium shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-600">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white/90 backdrop-blur-sm border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all duration-200 text-gray-700 font-medium shadow-sm"
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleCustomDateRange}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 font-medium"
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
                      ? 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white shadow-sm'
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

      {/* Expense Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {/* ADD THIS BULK ACTION TOOLBAR: */}
{selectedItems.length > 0 && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <span className="text-sm text-red-700 font-medium">
          {selectedItems.length} item(s) selected
        </span>
      </div>
      <div className="flex items-center space-x-3">
        <button
          onClick={handleBulkExport}
          className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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
        className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
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
                  Vendor
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">
                Reference
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Receipt
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedExpenses.length > 0 ? (
                 paginatedExpenses.map((expense: Expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    {/* ADD THIS NEW COLUMN FIRST: */}
    <td className="relative w-12 px-6 sm:w-16 sm:px-8">
      <input
        type="checkbox"
        className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
        checked={selectedItems.includes(expense.id)}
        onChange={(e) => handleSelectItem(expense.id, e.target.checked)}
      />
    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        {format(parseISO(expense.date), 'MMM dd, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate">{expense.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {expense.vendor_detail?.name || expense.vendor || '-'}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600 max-w-[8rem]">
                      <div className="truncate" title={expense.reference_number || '-'}>
                        {expense.reference_number || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        {expense.category?.name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-red-600">
                        {formatCurrency(expense.amount, expense.currency || baseCurrency)}
                      </span>
                      {expense.currency && expense.currency !== baseCurrency && (
                        <span className="text-xs text-gray-500 mt-0.5">
                          {expense.currency}
                        </span>
                      )}
                    </div>
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {expense.receipt_url ? (
                        <a
                          href={expense.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(expense)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <Link
                          to={`/expenses/edit/${expense.id}`}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(expense.id)}
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
                      <ShoppingCart className="h-12 w-12 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg">No expense records found</p>
                      <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or add a new expense record</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* ADD THIS ENTIRE PAGINATION SECTION: */}
{filteredExpenses.length > itemsPerPage && (
  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-6">
    <div className="flex flex-1 justify-between sm:hidden">
      <button
        onClick={() => {
          setCurrentPage(Math.max(1, currentPage - 1));
          clearSelections();
        }}
        disabled={currentPage === 1}
        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
      >
        Previous
      </button>
      <button
        onClick={() => {
          setCurrentPage(Math.min(totalPages, currentPage + 1));
          clearSelections();
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
            {Math.min(currentPage * itemsPerPage, filteredExpenses.length)}
          </span> of{' '}
          <span className="font-medium">{filteredExpenses.length}</span> results
        </p>
      </div>
      <div>
        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
          <button
            onClick={() => {
              setCurrentPage(Math.max(1, currentPage - 1));
              clearSelections();
            }}
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
                  clearSelections();
                }}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                  currentPage === pageNumber
                    ? 'z-10 bg-red-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600'
                    : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                }`}
              >
                {pageNumber}
              </button>
            );
          })}
          
          <button
            onClick={() => {
              setCurrentPage(Math.min(totalPages, currentPage + 1));
              clearSelections();
            }}
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
      {/* Expense Detail Modal */}
{showDetailModal && selectedExpense && (
  <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      {/* Modal Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Expense Details</h3>
            <p className="text-sm text-gray-500 mt-1">
              Transaction ID: {selectedExpense.id.slice(0, 8)}...
            </p>
          </div>
          <button
            onClick={() => {
              setShowDetailModal(false);
              setSelectedExpense(null);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Modal Body */}
      <div className="p-6 space-y-6">
        {/* Basic Information */}
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-red-800 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Basic Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Date</p>
              <p className="font-medium text-gray-900">
                {format(parseISO(selectedExpense.date), 'MMMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Reference Number</p>
              <p className="font-medium text-gray-900 break-all text-xs">
                {selectedExpense.reference_number || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Receipt</p>
              <p className="font-medium text-gray-900">
                {selectedExpense.receipt_url ? (
                  <a 
                    href={selectedExpense.receipt_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Receipt className="h-4 w-4" />
                    View Receipt
                  </a>
                ) : (
                  <span className="text-gray-500">No receipt attached</span>
                )}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Description</p>
              <p className="font-medium text-gray-900">{selectedExpense.description}</p>
            </div>
          </div>
        </div>

        {/* Category & Vendor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-purple-50 rounded-xl p-6">
            <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Category
            </h4>
            <p className="font-medium text-gray-900">
              {selectedExpense.category?.name || 'Uncategorized'}
            </p>
          </div>
          
          <div className="bg-orange-50 rounded-xl p-6">
            <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Vendor
            </h4>
            {selectedExpense.vendor || selectedExpense.vendor_detail ? (
              <div>
                <p className="font-medium text-gray-900">
                  {selectedExpense.vendor_detail?.name || selectedExpense.vendor}
                </p>
                {selectedExpense.vendor_detail && (
                  <>
                    {selectedExpense.vendor_detail.email && (
                      <p className="text-sm text-gray-600 mt-1">{selectedExpense.vendor_detail.email}</p>
                    )}
                    {selectedExpense.vendor_detail.phone && (
                      <p className="text-sm text-gray-600">{selectedExpense.vendor_detail.phone}</p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic">No vendor assigned</p>
            )}
          </div>
        </div>

        {/* Financial Details */}
        <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-red-800 mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Financial Details
          </h4>
          
          <div className="space-y-4">
            {/* Original Amount */}
            <div className="flex justify-between items-center pb-3 border-b border-red-100">
              <span className="text-gray-600">Amount</span>
              <span className="font-semibold text-lg text-gray-900">
                {formatCurrency(selectedExpense.amount, selectedExpense.currency || baseCurrency)}
              </span>
            </div>

            {/* Tax Information */}
            {selectedExpense.tax_rate && selectedExpense.tax_rate > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tax Rate</span>
                  <span className="font-medium">{selectedExpense.tax_rate}%</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-red-100">
                  <span className="text-gray-600">Tax Amount</span>
                  <span className="font-medium">
                    {formatCurrency(selectedExpense.tax_amount || 0, selectedExpense.currency || baseCurrency)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-red-100">
                  <span className="text-gray-600 font-medium">Total with Tax</span>
                  <span className="font-semibold text-lg">
                    {formatCurrency(
                      (selectedExpense.total_with_tax || selectedExpense.amount), 
                      selectedExpense.currency || baseCurrency
                    )}
                  </span>
                </div>
              </>
            )}

            {/* Currency Conversion Details */}
            {selectedExpense.currency && selectedExpense.currency !== baseCurrency && (
              <div className="mt-4 pt-4 border-t-2 border-red-200">
                <h5 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Currency Conversion
                </h5>
                
                <div className="bg-white/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Original Currency</span>
                    <span className="font-medium">{selectedExpense.currency}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Exchange Rate</span>
                    <span className="font-medium">
                      1 {baseCurrency} = {selectedExpense.exchange_rate || 1} {selectedExpense.currency}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="text-gray-700 font-medium">Amount in {baseCurrency}</span>
                    <span className="font-bold text-lg text-red-700">
                      {formatCurrency(selectedExpense.base_amount || selectedExpense.amount, baseCurrency)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Record Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Created</p>
              <p className="font-medium text-gray-900">
                {format(parseISO(selectedExpense.created_at), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
            {selectedExpense.updated_at && (
              <div>
                <p className="text-gray-600">Last Updated</p>
                <p className="font-medium text-gray-900">
                  {format(parseISO(selectedExpense.updated_at), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Link
            to={`/expenses/edit/${selectedExpense.id}`}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Edit className="h-4 w-4" />
            Edit Expense
          </Link>
          
          <button
            onClick={() => {
              // Copy details to clipboard
              const details = `Expense Details
Date: ${format(parseISO(selectedExpense.date), 'MMMM dd, yyyy')}
Description: ${selectedExpense.description}
Amount: ${formatCurrency(selectedExpense.amount, selectedExpense.currency || baseCurrency)}
${selectedExpense.currency !== baseCurrency ? `Base Amount: ${formatCurrency(selectedExpense.base_amount || selectedExpense.amount, baseCurrency)}` : ''}
Category: ${selectedExpense.category?.name || 'Uncategorized'}
Vendor: ${selectedExpense.vendor_detail?.name || selectedExpense.vendor || 'No vendor'}
Receipt: ${selectedExpense.receipt_url ? 'Attached' : 'None'}`;
              
              navigator.clipboard.writeText(details);
              alert('Details copied to clipboard!');
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Copy className="h-4 w-4" />
            Copy Details
          </button>
          
          <button
            onClick={() => {
              handleDelete(selectedExpense.id);
              setShowDetailModal(false);
              setSelectedExpense(null);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
};