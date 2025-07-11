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
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { Income, Category } from '../../types';

export const IncomeList: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useSettings(); // Added formatCurrency
// Remove local incomes state - we'll use cached data instead
const { businessData, businessDataLoading, refreshBusinessData } = useData();
const { incomes } = businessData;  const [filteredIncomes, setFilteredIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

  useEffect(() => {
  // Data is already loaded by DataContext, just filter when dateRange changes
  filterAndSortIncomes();
}, [user, dateRange, incomes]); // Added incomes dependency

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




  

  const filterAndSortIncomes = () => {
  let filtered = [...incomes];
  
  // Search filter
  if (searchTerm) {
    filtered = filtered.filter(income =>
      income.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.category?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) // ADD THIS LINE
    );
  }
  
  // Category filter
  if (selectedCategory !== 'all') {
    filtered = filtered.filter(income => income.category_id === selectedCategory);
  }
  
  // ADD CLIENT FILTERING
  if (clientFilter) {
    if (clientFilter === 'no-client') {
      filtered = filtered.filter(income => !income.client_id);
    } else {
      filtered = filtered.filter(income => income.client_id === clientFilter);
    }
  }
  
  // ADD CLIENT SEARCH
  if (clientSearch) {
    filtered = filtered.filter(income => 
      income.client?.name.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }
  
  // Sort (existing code stays the same)
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
};

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
                placeholder="Search by description, category, or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
    {/* Date Range */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
      <select
        value={dateRange}
        onChange={(e) => setDateRange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="today">Today</option>
        <option value="this-week">This Week</option>
        <option value="this-month">This Month</option>
        <option value="last-month">Last Month</option>
        <option value="this-year">This Year</option>
      </select>
    </div>
    
    {/* Category */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>

    {/* Client */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
      <select
        value={clientFilter}
        onChange={(e) => setClientFilter(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Clients</option>
        <option value="no-client">No Client</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
    </div>
    
    {/* Sort */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
      <div className="flex gap-2">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="date">Date</option>
          <option value="amount">Amount</option>
        </select>
        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
        >
          <ArrowUpDown className="h-4 w-4 text-gray-600" />
        </button>
      </div>
    </div>
  </div>
)}
        </div>
      </div>

      {/* Income Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
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
              {filteredIncomes.length > 0 ? (
                filteredIncomes.map((income) => (
                  <tr key={income.id} className="hover:bg-gray-50 transition-colors">
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
    </div>
  );
};