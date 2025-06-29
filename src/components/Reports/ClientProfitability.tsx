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
  Phone
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
  Legend
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
  const { formatCurrency } = useSettings();
  
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
      const totalRevenue = clientIncomes.reduce((sum, inc) => sum + inc.amount, 0);
      const paidInvoices = clientInvoices.filter(inv => inv.status === 'paid');
      const pendingInvoices = clientInvoices.filter(inv => inv.status === 'sent');
      const overdueInvoices = clientInvoices.filter(inv => inv.status === 'overdue');
      
      // Calculate outstanding amount
      const outstandingAmount = [...pendingInvoices, ...overdueInvoices]
        .reduce((sum, inv) => sum + inv.total, 0);
      
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
          amount: inv.total,
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
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + income.amount;
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const selectedClientData = selectedClient 
    ? clientProfitData.find(c => c.id === selectedClient)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/reports')}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Client Profitability Report</h1>
              <p className="mt-1 text-sm text-gray-600">
                Analyze revenue and payment patterns by client
              </p>
            </div>
          </div>
          <button
            onClick={exportReport}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div className="flex items-center gap-4 ml-auto">
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Clients</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="revenue">Sort by Revenue</option>
              <option value="name">Sort by Name</option>
              <option value="recent">Sort by Recent Activity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <Users className="h-8 w-8 text-blue-600" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summaryMetrics.totalClients}</p>
          <p className="text-sm text-gray-600 mt-1">Total Clients</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <Activity className="h-8 w-8 text-green-600" />
            <span className="text-sm text-gray-500">Active</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summaryMetrics.activeClients}</p>
          <p className="text-sm text-gray-600 mt-1">Revenue Generating</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="h-8 w-8 text-emerald-600" />
            <span className="text-sm text-gray-500">Revenue</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(summaryMetrics.totalRevenue)}
          </p>
          <p className="text-sm text-gray-600 mt-1">Total Revenue</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="h-8 w-8 text-purple-600" />
            <span className="text-sm text-gray-500">Average</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(summaryMetrics.averageClientValue)}
          </p>
          <p className="text-sm text-gray-600 mt-1">Per Active Client</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Distribution Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top 10 Clients by Revenue
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueDistributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: any) => formatCurrency(value)}
                labelStyle={{ color: '#000' }}
              />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Revenue Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={revenueDistributionData.slice(0, 8)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ percentage }) => `${percentage}%`}
              >
                {revenueDistributionData.slice(0, 8).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Client Details Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Client Details</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoices
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Outstanding
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Days
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{client.name}</div>
                      <div className="text-sm text-gray-500">{client.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(client.totalRevenue)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-sm text-gray-900">{client.invoiceCount}</span>
                      {client.invoiceCount > 0 && (
                        <span className="text-xs text-gray-500">
                          ({client.paidInvoices} paid)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center space-x-1">
                      {client.overdueInvoices > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {client.overdueInvoices} overdue
                        </span>
                      )}
                      {client.pendingInvoices > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          {client.pendingInvoices} pending
                        </span>
                      )}
                      {client.overdueInvoices === 0 && client.pendingInvoices === 0 && client.paidInvoices > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          All paid
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`text-sm font-medium ${
                      client.outstandingAmount > 0 ? 'text-orange-600' : 'text-gray-900'
                    }`}>
                      {formatCurrency(client.outstandingAmount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm text-gray-900">
                      {client.averagePaymentDays} days
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => setSelectedClient(client.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Detail Modal */}
      {selectedClient && selectedClientData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedClientData.name}
                  </h3>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    {selectedClientData.email && (
                      <span className="flex items-center">
                        <Mail className="h-4 w-4 mr-1" />
                        {selectedClientData.email}
                      </span>
                    )}
                    {selectedClientData.phone && (
                      <span className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {selectedClientData.phone}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Client Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(selectedClientData.totalRevenue)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Avg Invoice</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(selectedClientData.averageInvoiceValue)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Outstanding</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(selectedClientData.outstandingAmount)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Payment Speed</p>
                  <p className="text-xl font-bold text-gray-900">
                    {selectedClientData.averagePaymentDays} days
                  </p>
                </div>
              </div>

              {/* Revenue Trend */}
              {selectedClientData.revenueByMonth.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={selectedClientData.revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                      <Line 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Payment History */}
              {selectedClientData.paymentHistory.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h4>
                  <div className="space-y-2">
                    {selectedClientData.paymentHistory.map((payment, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Invoice {payment.invoiceNumber}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(parseISO(payment.date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};