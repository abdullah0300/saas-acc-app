import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
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
import { format, startOfMonth, endOfMonth, subMonths, parseISO, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { Expense, Category } from '../../types';

export const ExpenseList: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useSettings(); // Added formatCurrency
const { businessData, businessDataLoading, refreshBusinessData } = useData();
const { expenses } = businessData;  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
const { categories: allCategories } = businessData;
const categories = allCategories.expense; // Use expense categories from DataContext
const loading = businessDataLoading;
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('this-month');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
// Pagination states
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage] = useState(50); // 50 items per page

// Bulk selection states
const [selectedItems, setSelectedItems] = useState<string[]>([]);
const [selectAll, setSelectAll] = useState(false);


  useEffect(() => {
  filterAndSortExpenses();
}, [user, dateRange, expenses]);

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
      expense.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
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
      selectedItems.map(id => deleteExpense(id))
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
  
  const headers = ['Date', 'Description', 'Category', 'Vendor', 'Amount', 'Receipt'];
  const csvData = selectedExpenses.map(expense => [
    format(parseISO(expense.date), 'yyyy-MM-dd'),
    expense.description,
    expense.category?.name || 'Uncategorized',
    expense.vendor || 'No vendor',
    expense.amount.toString(),
    expense.receipt_url ? 'Yes' : 'No'
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


  const handleDelete = async (id: string) => {
  if (!window.confirm('Are you sure you want to delete this expense record?')) return;
  
  try {
    await deleteExpense(id);
    await refreshBusinessData(); // ✅ Refresh cache instead
  } catch (err: any) {
    alert('Error deleting expense: ' + err.message);
  }
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

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600 mt-1">Track and manage your business expenses</p>
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
      to="/vendors"
      className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
    >
      <Building2 className="h-5 w-5 mr-2" />
      Manage Vendors
    </Link>
          <Link
            to="/expenses/new"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all transform hover:scale-105 shadow-lg shadow-red-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
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
            {formatCurrency(totalExpenses)}
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
            {formatCurrency(Math.round(averageExpense))}
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
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by description, vendor, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all"
            >
              <Filter className="h-5 w-5 mr-2" />
              Filters
              <ChevronDown className={`h-4 w-4 ml-2 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {/* Advanced Filters */}
          {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 pb-32 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="today">Today</option>
                  <option value="this-week">This Week</option>
                  <option value="this-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="this-year">This Year</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                  >
                    <ArrowUpDown className="h-5 w-5 text-gray-600" />
                  </button>
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
                      {expense.vendor || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        {expense.category?.name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right">
                      <span className="text-red-600">
                        {formatCurrency(expense.amount)}
                      </span>
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
    </div>
  );
};