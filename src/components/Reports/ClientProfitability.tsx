// src/components/Reports/ClientProfitability.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  Users,
  DollarSign,
  FileText,
  Clock,
  Activity,
  Filter,
  ChevronDown,
  Eye,
  Mail,
  Phone,
  Star,
  Award,
  Target,
  Zap,
  Crown,
  Search,
  ChevronRight,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts';
import { getClients, getInvoices, getIncomes } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, differenceInDays } from 'date-fns';
import { Client, Invoice, Income } from '../../types';

interface ClientProfitData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  totalRevenue: number;
  invoiceCount: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  averageInvoiceValue: number;
  outstandingAmount: number;
  lastPaymentDate?: string;
  averagePaymentDays: number;
  revenueByMonth: { month: string; amount: number }[];
  paymentHistory: { date: string; amount: number; invoiceNumber: string }[];
}

interface SummaryMetrics {
  totalClients: number;
  activeClients: number;
  totalRevenue: number;
  averageClientValue: number;
  topClientRevenue: number;
  bottomClientRevenue: number;
}

const COLORS = ['#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#84cc16', '#06b6d4'];

export const ClientProfitability: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { formatCurrency, baseCurrency } = useSettings();
  
  // Date range state - default to last 12 months
  const [startDate, setStartDate] = useState(
    format(subMonths(new Date(), 11), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  
  // Data state
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [clientProfitData, setClientProfitData] = useState<ClientProfitData[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics>({
    totalClients: 0,
    activeClients: 0,
    totalRevenue: 0,
    averageClientValue: 0,
    topClientRevenue: 0,
    bottomClientRevenue: 0
  });
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'revenue' | 'name' | 'recent'>('revenue');
  const [filterBy, setFilterBy] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    if (user) {
      loadReportData();
    }
  }, [user, startDate, endDate]);

  const loadReportData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load all data in parallel
      const [clientsData, invoicesData, incomesData] = await Promise.all([
        getClients(user.id),
        getInvoices(user.id),
        getIncomes(user.id, startDate, endDate)
      ]);

      setClients(clientsData);
      setInvoices(invoicesData);
      setIncomes(incomesData);
      
      // Process client profitability data
      processClientProfitability(clientsData, invoicesData, incomesData);
      
    } catch (err) {
      console.error('Error loading client profitability data:', err);
    } finally {
      setLoading(false);
    }
  };

  const processClientProfitability = (
    clientsList: Client[], 
    invoicesList: Invoice[], 
    incomesList: Income[]
  ) => {
    const profitData: ClientProfitData[] = clientsList.map(client => {
      // Filter invoices for this client within date range
      const clientInvoices = invoicesList.filter(inv => 
        inv.client_id === client.id &&
        parseISO(inv.date) >= parseISO(startDate) &&
        parseISO(inv.date) <= parseISO(endDate)
      );
      
      // Filter income for this client within date range
      const clientIncomes = incomesList.filter(inc => 
        inc.client_id === client.id
      );
      
      // Calculate metrics
      const totalRevenue = clientIncomes.reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);
      const paidInvoices = clientInvoices.filter(inv => inv.status === 'paid');
      const pendingInvoices = clientInvoices.filter(inv => inv.status === 'sent');
      const overdueInvoices = clientInvoices.filter(inv => inv.status === 'overdue');
      
      // Calculate outstanding amount
      const outstandingAmount = [...pendingInvoices, ...overdueInvoices]
        .reduce((sum, inv) => sum + (inv.base_amount || inv.total), 0);
      
      // Calculate average payment days
      const paymentDays = paidInvoices
        .filter(inv => inv.paid_date)
        .map(inv => {
          const daysToPayment = differenceInDays(
            parseISO(inv.paid_date!),
            parseISO(inv.date)
          );
          return daysToPayment;
        });
      
      const averagePaymentDays = paymentDays.length > 0
        ? Math.round(paymentDays.reduce((sum, days) => sum + days, 0) / paymentDays.length)
        : 0;
      
      // Get last payment date
      const lastPayment = paidInvoices
        .filter(inv => inv.paid_date)
        .sort((a, b) => parseISO(b.paid_date!).getTime() - parseISO(a.paid_date!).getTime())[0];
      
      // Calculate revenue by month
      const revenueByMonth = calculateMonthlyRevenue(clientIncomes);
      
      // Get payment history
      const paymentHistory = paidInvoices
        .filter(inv => inv.paid_date)
        .map(inv => ({
          date: inv.paid_date!,
          amount: inv.base_amount || inv.total,
          invoiceNumber: inv.invoice_number
        }))
        .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
        .slice(0, 10); // Last 10 payments
      
      return {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        totalRevenue,
        invoiceCount: clientInvoices.length,
        paidInvoices: paidInvoices.length,
        pendingInvoices: pendingInvoices.length,
        overdueInvoices: overdueInvoices.length,
        averageInvoiceValue: clientInvoices.length > 0 ? totalRevenue / clientInvoices.length : 0,
        outstandingAmount,
        lastPaymentDate: lastPayment?.paid_date,
        averagePaymentDays,
        revenueByMonth,
        paymentHistory
      };
    });
    
    // Sort by total revenue by default
    const sortedData = profitData.sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    // Calculate summary metrics
    const activeClients = sortedData.filter(c => c.totalRevenue > 0).length;
    const totalRevenue = sortedData.reduce((sum, c) => sum + c.totalRevenue, 0);
    
    setSummaryMetrics({
      totalClients: clientsList.length,
      activeClients,
      totalRevenue,
      averageClientValue: activeClients > 0 ? totalRevenue / activeClients : 0,
      topClientRevenue: sortedData[0]?.totalRevenue || 0,
      bottomClientRevenue: sortedData[sortedData.length - 1]?.totalRevenue || 0
    });
    
    setClientProfitData(sortedData);
  };

  const calculateMonthlyRevenue = (incomes: Income[]) => {
    const monthlyData: { [key: string]: number } = {};
    
    incomes.forEach(income => {
  const monthKey = format(parseISO(income.date), 'MMM yyyy');
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (income.base_amount || income.amount);
    });
    
    return Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      });
  };

  const exportReport = () => {
    let csv = 'Client Profitability Report\n';
    csv += `Period: ${format(parseISO(startDate), 'MMM dd, yyyy')} - ${format(parseISO(endDate), 'MMM dd, yyyy')}\n`;
    csv += `Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}\n\n`;
      csv += `Currency: ${baseCurrency}\n\n`;

    
    // Summary
    csv += 'SUMMARY\n';
    csv += `Total Clients,${summaryMetrics.totalClients}\n`;
    csv += `Active Clients,${summaryMetrics.activeClients}\n`;
    csv += `Total Revenue,${summaryMetrics.totalRevenue.toFixed(2)}\n`;
    csv += `Average Client Value,${summaryMetrics.averageClientValue.toFixed(2)}\n\n`;
    
    // Client details
    csv += 'CLIENT DETAILS\n';
    csv += 'Client Name,Email,Phone,Total Revenue,Invoices,Paid,Pending,Overdue,Outstanding,Avg Payment Days\n';
    
    clientProfitData.forEach(client => {
      csv += `"${client.name}",`;
      csv += `"${client.email || ''}",`;
      csv += `"${client.phone || ''}",`;
      csv += `${client.totalRevenue.toFixed(2)},`;
      csv += `${client.invoiceCount},`;
      csv += `${client.paidInvoices},`;
      csv += `${client.pendingInvoices},`;
      csv += `${client.overdueInvoices},`;
      csv += `${client.outstandingAmount.toFixed(2)},`;
      csv += `${client.averagePaymentDays}\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-profitability-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get filtered and sorted data
  const getFilteredData = () => {
    let filtered = [...clientProfitData];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply filter
    if (filterBy === 'active') {
      filtered = filtered.filter(c => c.totalRevenue > 0);
    } else if (filterBy === 'inactive') {
      filtered = filtered.filter(c => c.totalRevenue === 0);
    }
    
    // Apply sort
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        filtered.sort((a, b) => {
          const dateA = a.lastPaymentDate ? parseISO(a.lastPaymentDate).getTime() : 0;
          const dateB = b.lastPaymentDate ? parseISO(b.lastPaymentDate).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'revenue':
      default:
        filtered.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }
    
    return filtered;
  };

  const filteredData = getFilteredData();
  const top10Clients = filteredData.slice(0, 10);
  
  // Prepare chart data
  const revenueDistributionData = top10Clients.map((client, index) => ({
    name: client.name.length > 15 ? client.name.substring(0, 15) + '...' : client.name,
    value: client.totalRevenue,
    percentage: (client.totalRevenue / summaryMetrics.totalRevenue * 100).toFixed(1)
  }));

  // Get client tier/ranking
  const getClientTier = (revenue: number) => {
    if (revenue >= summaryMetrics.topClientRevenue * 0.8) return { tier: 'Diamond', color: 'text-purple-800 bg-gradient-to-r from-purple-100 to-indigo-200 border border-purple-300', icon: Crown };
    if (revenue >= summaryMetrics.averageClientValue * 2) return { tier: 'Gold', color: 'text-amber-800 bg-gradient-to-r from-yellow-100 to-amber-200 border border-amber-300', icon: Award };
    if (revenue >= summaryMetrics.averageClientValue) return { tier: 'Silver', color: 'text-gray-800 bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300', icon: Star };
    return { tier: 'Bronze', color: 'text-orange-800 bg-gradient-to-r from-orange-100 to-red-200 border border-orange-300', icon: Target };
  };

  const getPaymentSpeedBadge = (days: number) => {
    if (days <= 7) return { label: 'Lightning', color: 'bg-gradient-to-r from-green-100 to-emerald-200 text-green-800 border border-green-300', icon: Zap };
    if (days <= 15) return { label: 'Fast', color: 'bg-gradient-to-r from-blue-100 to-indigo-200 text-blue-800 border border-blue-300', icon: TrendingUp };
    if (days <= 30) return { label: 'Normal', color: 'bg-gradient-to-r from-yellow-100 to-amber-200 text-yellow-800 border border-yellow-300', icon: Clock };
    return { label: 'Slow', color: 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-300', icon: TrendingDown };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 shadow-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  const selectedClientData = selectedClient 
    ? filteredData.find(c => c.id === selectedClient)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header - Client-focused hero section */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full blur-3xl opacity-30 -translate-y-48 translate-x-48"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full blur-3xl opacity-40 translate-y-32 -translate-x-32"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="flex items-start space-x-6">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl">
                  <Users className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    Client Performance
                  </h1>
                  <p className="text-lg text-gray-600 mb-4">
                    Deep insights into your client relationships and revenue patterns
                  </p>
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>{format(parseISO(startDate), 'MMM d, yyyy')} - {format(parseISO(endDate), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4" />
                      <span>Live data</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={exportReport}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-300 text-gray-700 rounded-xl hover:from-gray-100 hover:to-gray-200 hover:border-gray-400 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Export Report
                </button>
                
                <button
                  onClick={loadReportData}
                  disabled={loading}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-100 to-indigo-200 text-blue-800 border border-blue-300 rounded-xl hover:from-blue-200 hover:to-indigo-300 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Activity className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Data
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Date Range */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all duration-200"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all duration-200"
                />
              </div>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search Clients</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all duration-200"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex space-x-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Filter</label>
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as 'all' | 'active' | 'inactive')}
                  className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all duration-200"
                >
                  <option value="all">All Clients</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'revenue' | 'name' | 'recent')}
                  className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all duration-200"
                >
                  <option value="revenue">Revenue</option>
                  <option value="name">Name</option>
                  <option value="recent">Recent Activity</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Clients Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-xl p-6 border border-blue-200 relative overflow-hidden hover:shadow-2xl transition-all duration-300 group transform hover:scale-105">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-sm text-blue-700">Total</div>
                  <div className="text-xs text-blue-600 font-medium">{summaryMetrics.activeClients} active</div>
                </div>
              </div>
              <p className="text-3xl font-bold text-blue-900 mb-1">{summaryMetrics.totalClients}</p>
              <p className="text-sm text-blue-700">Total Clients</p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-200/30 rounded-full blur-2xl"></div>
          </div>

          {/* Total Revenue Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-2xl shadow-xl p-6 border border-emerald-200 relative overflow-hidden hover:shadow-2xl transition-all duration-300 group transform hover:scale-105">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-sm text-emerald-700">Period</div>
                  <div className="text-xs text-emerald-600 font-medium">Revenue</div>
                </div>
              </div>
              <p className="text-3xl font-bold text-emerald-900 mb-1">{formatCurrency(summaryMetrics.totalRevenue, baseCurrency)}</p>
              <p className="text-sm text-emerald-700">Total Revenue ({baseCurrency})</p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-200/30 rounded-full blur-2xl"></div>
          </div>

          {/* Average Value Card */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-100 rounded-2xl shadow-xl p-6 border border-purple-200 relative overflow-hidden hover:shadow-2xl transition-all duration-300 group transform hover:scale-105">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-sm text-purple-700">Per Client</div>
                  <div className="text-xs text-purple-600 font-medium">Average</div>
                </div>
              </div>
              <p className="text-3xl font-bold text-purple-900 mb-1">{formatCurrency(summaryMetrics.averageClientValue)}</p>
              <p className="text-sm text-purple-700">Avg Client Value</p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-purple-200/30 rounded-full blur-2xl"></div>
          </div>

          {/* Top Client Card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-2xl shadow-xl p-6 border border-amber-200 relative overflow-hidden hover:shadow-2xl transition-all duration-300 group transform hover:scale-105">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                  <Crown className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-sm text-amber-700">Best</div>
                  <div className="text-xs text-amber-600 font-medium">Client</div>
                </div>
              </div>
              <p className="text-3xl font-bold text-amber-900 mb-1">{formatCurrency(summaryMetrics.topClientRevenue)}</p>
              <p className="text-sm text-amber-700">Top Performer</p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-amber-200/30 rounded-full blur-2xl"></div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue Distribution Chart */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Top Clients by Revenue</h3>
                  <p className="text-sm text-gray-600">Your highest-value relationships</p>
                </div>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueDistributionData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                    labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[8, 8, 0, 0]}
                    fill="url(#clientGradient)"
                  />
                  <defs>
                    <linearGradient id="clientGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue Distribution Pie */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <PieChartIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Revenue Distribution</h3>
                  <p className="text-sm text-gray-600">Share of total revenue</p>
                </div>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueDistributionData.slice(0, 8)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={40}
                    paddingAngle={2}
                    label={({ percentage }) => `${percentage}%`}
                  >
                    {revenueDistributionData.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Client Portfolio</h2>
          <div className="flex items-center space-x-2 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'cards'
                  ? 'bg-gradient-to-r from-blue-100 to-indigo-200 text-blue-800 shadow-lg border border-blue-300'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cards View
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-blue-100 to-indigo-200 text-blue-800 shadow-lg border border-blue-300'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Table View
            </button>
          </div>
        </div>

        {/* Client Cards/Table */}
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredData.map((client, index) => {
              const tier = getClientTier(client.totalRevenue);
              const paymentSpeed = getPaymentSpeedBadge(client.averagePaymentDays);
              const TierIcon = tier.icon;
              const SpeedIcon = paymentSpeed.icon;
              
              return (
                <div
                  key={client.id}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 group cursor-pointer"
                  onClick={() => setSelectedClient(selectedClient === client.id ? null : client.id)}
                >
                  {/* Client Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {client.name}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${tier.color}`}>
                            <TierIcon className="h-3 w-3 mr-1" />
                            {tier.tier}
                          </span>
                          <span className="text-xs text-gray-500">#{index + 1}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${selectedClient === client.id ? 'rotate-90' : ''}`} />
                  </div>

                  {/* Revenue Display */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Total Revenue</span>
                      <span className="text-2xl font-bold text-gray-900">{formatCurrency(client.totalRevenue)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-blue-300 to-indigo-400 h-3 rounded-full transition-all duration-500 shadow-md"
                        style={{ width: `${Math.min((client.totalRevenue / summaryMetrics.topClientRevenue) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                      <div className="text-xl font-bold text-blue-700">{client.invoiceCount}</div>
                      <div className="text-xs text-blue-600">Invoices</div>
                    </div>
                    <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                      <div className="text-xl font-bold text-emerald-700">{formatCurrency(client.averageInvoiceValue)}</div>
                      <div className="text-xs text-emerald-600">Avg Invoice</div>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${paymentSpeed.color}`}>
                      <SpeedIcon className="h-3 w-3 mr-1" />
                      {paymentSpeed.label} ({client.averagePaymentDays}d)
                    </span>
                    {client.outstandingAmount > 0 && (
                      <span className="text-xs text-orange-600 font-medium">
                        {formatCurrency(client.outstandingAmount)} due
                      </span>
                    )}
                  </div>

                  {/* Contact Info */}
                  {(client.email || client.phone) && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                      {client.email && (
                        <div className="flex items-center space-x-2 text-xs text-gray-600">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center space-x-2 text-xs text-gray-600">
                          <Phone className="h-3 w-3" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expanded Details */}
                  {selectedClient === client.id && selectedClientData && (
                    <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                      {/* Mini Revenue Chart */}
                      {selectedClientData.revenueByMonth.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Revenue Trend</h4>
                          <div className="h-32">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={selectedClientData.revenueByMonth}>
                                <defs>
                                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                                <Area 
                                  type="monotone" 
                                  dataKey="amount" 
                                  stroke="#3b82f6" 
                                  fillOpacity={1} 
                                  fill="url(#revenueGradient)" 
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Detailed Stats */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                          <div className="text-lg font-bold text-green-700">{selectedClientData.paidInvoices}</div>
                          <div className="text-xs text-green-600">Paid</div>
                        </div>
                        <div className="text-center p-3 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border border-yellow-200">
                          <div className="text-lg font-bold text-yellow-700">{selectedClientData.pendingInvoices}</div>
                          <div className="text-xs text-yellow-600">Pending</div>
                        </div>
                        <div className="text-center p-3 bg-gradient-to-br from-red-50 to-red-50 rounded-xl border border-red-200">
                          <div className="text-lg font-bold text-red-700">{selectedClientData.overdueInvoices}</div>
                          <div className="text-xs text-red-600">Overdue</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Total Revenue
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Invoices
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Outstanding
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Payment Speed
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((client, index) => {
                    const tier = getClientTier(client.totalRevenue);
                    const paymentSpeed = getPaymentSpeedBadge(client.averagePaymentDays);
                    const TierIcon = tier.icon;
                    const SpeedIcon = paymentSpeed.icon;
                    
                    return (
                      <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                              {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{client.name}</div>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${tier.color}`}>
                                  <TierIcon className="h-3 w-3 mr-1" />
                                  {tier.tier}
                                </span>
                                <span className="text-xs text-gray-500">#{index + 1}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-lg font-bold text-gray-900">{formatCurrency(client.totalRevenue)}</div>
                          <div className="text-xs text-gray-500">{formatCurrency(client.averageInvoiceValue)} avg</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-bold text-gray-900">{client.invoiceCount}</div>
                          <div className="text-xs text-gray-500">{client.paidInvoices} paid</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex flex-col space-y-1">
                            {client.pendingInvoices > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-100 to-amber-200 text-yellow-800 border border-yellow-300">
                                {client.pendingInvoices} pending
                              </span>
                            )}
                            {client.overdueInvoices > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-300">
                                {client.overdueInvoices} overdue
                              </span>
                            )}
                            {client.pendingInvoices === 0 && client.overdueInvoices === 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-green-100 to-emerald-200 text-green-800 border border-green-300">
                                Up to date
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-bold text-gray-900">
                            {formatCurrency(client.outstandingAmount)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${paymentSpeed.color}`}>
                            <SpeedIcon className="h-3 w-3 mr-1" />
                            {client.averagePaymentDays} days
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};