import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  FileText,
  Download,
  Filter,
  DollarSign,
  Users,
  Receipt,
  PieChart as PieChartIcon,
  Activity,
  Target,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  CreditCard,
  Eye,
  RefreshCw,
  Info,
  Printer,
  Calculator,
  Lock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar,
  Treemap,
  Scatter,
  ScatterChart,
  ZAxis,
  ComposedChart
} from 'recharts';
import { getIncomes, getExpenses, getInvoices, getClients, getCategories } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, eachMonthOfInterval, parseISO, isWithinInterval } from 'date-fns';
import { supabase } from '../../services/supabaseClient';

// Types
interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  profit: number;
  invoiced: number;
  collected: number;
  taxCollected: number;
  taxPaid: number;
}

interface CategoryBreakdown {
  name: string;
  value: number;
  percentage: number;
  trend: number;
  count: number;
}

interface ClientMetrics {
  id: string;
  name: string;
  revenue: number;
  invoiceCount: number;
  avgInvoiceValue: number;
  outstandingAmount: number;
  lastActivity: string;
}

interface CashFlowData {
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export const ReportsOverview: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  const [period, setPeriod] = useState('6months');
  const [compareMode, setCompareMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<{ income: CategoryBreakdown[], expense: CategoryBreakdown[] }>({ income: [], expense: [] });
  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [clientMetrics, setClientMetrics] = useState<ClientMetrics[]>([]);
  const [kpiMetrics, setKpiMetrics] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
    totalInvoiced: 0,
    totalCollected: 0,
    collectionRate: 0,
    avgDaysToPayment: 0,
    totalClients: 0,
    activeClients: 0,
    totalOutstanding: 0,
    overdueAmount: 0,
    taxCollected: 0,
    taxPaid: 0,
    revenueGrowth: 0,
    expenseGrowth: 0,
    clientGrowth: 0
  });

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadReportData();
  }, [user, period]);

  const loadReportData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      let startDate;
      let comparisonStartDate;
      
      switch (period) {
        case '1month':
          startDate = subMonths(endDate, 1);
          comparisonStartDate = subMonths(startDate, 1);
          break;
        case '3months':
          startDate = subMonths(endDate, 3);
          comparisonStartDate = subMonths(startDate, 3);
          break;
        case '6months':
          startDate = subMonths(endDate, 6);
          comparisonStartDate = subMonths(startDate, 6);
          break;
        case '1year':
          startDate = subMonths(endDate, 12);
          comparisonStartDate = subMonths(startDate, 12);
          break;
        case 'ytd':
          startDate = startOfYear(endDate);
          comparisonStartDate = startOfYear(subMonths(endDate, 12));
          break;
        default:
          startDate = subMonths(endDate, 6);
          comparisonStartDate = subMonths(startDate, 6);
      }

      // Fetch all data
      const [incomes, expenses, invoices, clients, categories] = await Promise.all([
        getIncomes(user.id, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')),
        getExpenses(user.id, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')),
        getInvoices(user.id),
        getClients(user.id),
        getCategories(user.id)
      ]);

      // Fetch comparison data for growth metrics
      const [prevIncomes, prevExpenses] = await Promise.all([
        getIncomes(user.id, format(comparisonStartDate, 'yyyy-MM-dd'), format(startDate, 'yyyy-MM-dd')),
        getExpenses(user.id, format(comparisonStartDate, 'yyyy-MM-dd'), format(startDate, 'yyyy-MM-dd'))
      ]);

      // Process all data
      processMonthlyData(incomes, expenses, invoices, startDate, endDate);
      processCategoryData(incomes, expenses, prevIncomes, prevExpenses);
      processCashFlowData(incomes, expenses, startDate, endDate);
      processClientMetrics(clients, incomes, invoices);
      processKPIMetrics(incomes, expenses, invoices, clients, prevIncomes, prevExpenses);

    } catch (err: any) {
      console.error('Error loading report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const processMonthlyData = (incomes: any[], expenses: any[], invoices: any[], startDate: Date, endDate: Date) => {
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    
    const data = months.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'MMM yyyy');
      
      // Filter data for this month
      const monthIncomes = incomes.filter(inc => 
        isWithinInterval(parseISO(inc.date), { start: monthStart, end: monthEnd })
      );
      const monthExpenses = expenses.filter(exp => 
        isWithinInterval(parseISO(exp.date), { start: monthStart, end: monthEnd })
      );
      const monthInvoices = invoices.filter(inv => 
        isWithinInterval(parseISO(inv.date), { start: monthStart, end: monthEnd })
      );
      
      // Calculate metrics
      const income = monthIncomes.reduce((sum, inc) => sum + inc.amount, 0);
      const expenseTotal = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const invoiced = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const collected = monthInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.total, 0);
      const taxCollected = monthIncomes.reduce((sum, inc) => sum + (inc.tax_amount || 0), 0);
      const taxPaid = monthExpenses.reduce((sum, exp) => sum + (exp.tax_amount || 0), 0);
      
      return {
        month: monthKey,
        income,
        expenses: expenseTotal,
        profit: income - expenseTotal,
        invoiced,
        collected,
        taxCollected,
        taxPaid
      };
    });
    
    setMonthlyData(data);
  };

  const processCategoryData = (incomes: any[], expenses: any[], prevIncomes: any[], prevExpenses: any[]) => {
    // Process income categories
    const incomeByCategory = new Map<string, { current: number, previous: number, count: number }>();
    
    incomes.forEach(income => {
      const category = income.category?.name || 'Uncategorized';
      const existing = incomeByCategory.get(category) || { current: 0, previous: 0, count: 0 };
      incomeByCategory.set(category, {
        current: existing.current + income.amount,
        previous: existing.previous,
        count: existing.count + 1
      });
    });
    
    prevIncomes.forEach(income => {
      const category = income.category?.name || 'Uncategorized';
      const existing = incomeByCategory.get(category) || { current: 0, previous: 0, count: 0 };
      existing.previous += income.amount;
    });
    
    const totalIncome = Array.from(incomeByCategory.values()).reduce((sum, cat) => sum + cat.current, 0);
    
    const incomeCategories: CategoryBreakdown[] = Array.from(incomeByCategory.entries())
      .map(([name, data]) => ({
        name,
        value: data.current,
        percentage: (data.current / totalIncome) * 100,
        trend: data.previous > 0 ? ((data.current - data.previous) / data.previous) * 100 : 0,
        count: data.count
      }))
      .sort((a, b) => b.value - a.value);
    
    // Process expense categories similarly
    const expenseByCategory = new Map<string, { current: number, previous: number, count: number }>();
    
    expenses.forEach(expense => {
      const category = expense.category?.name || 'Uncategorized';
      const existing = expenseByCategory.get(category) || { current: 0, previous: 0, count: 0 };
      expenseByCategory.set(category, {
        current: existing.current + expense.amount,
        previous: existing.previous,
        count: existing.count + 1
      });
    });
    
    prevExpenses.forEach(expense => {
      const category = expense.category?.name || 'Uncategorized';
      const existing = expenseByCategory.get(category) || { current: 0, previous: 0, count: 0 };
      existing.previous += expense.amount;
    });
    
    const totalExpense = Array.from(expenseByCategory.values()).reduce((sum, cat) => sum + cat.current, 0);
    
    const expenseCategories: CategoryBreakdown[] = Array.from(expenseByCategory.entries())
      .map(([name, data]) => ({
        name,
        value: data.current,
        percentage: (data.current / totalExpense) * 100,
        trend: data.previous > 0 ? ((data.current - data.previous) / data.previous) * 100 : 0,
        count: data.count
      }))
      .sort((a, b) => b.value - a.value);
    
    setCategoryData({ income: incomeCategories, expense: expenseCategories });
  };

  const processCashFlowData = (incomes: any[], expenses: any[], startDate: Date, endDate: Date) => {
    // Group by date and calculate running balance
    const dailyFlow = new Map<string, { inflow: number, outflow: number }>();
    
    incomes.forEach(income => {
      const date = income.date;
      const existing = dailyFlow.get(date) || { inflow: 0, outflow: 0 };
      dailyFlow.set(date, {
        inflow: existing.inflow + income.amount,
        outflow: existing.outflow
      });
    });
    
    expenses.forEach(expense => {
      const date = expense.date;
      const existing = dailyFlow.get(date) || { inflow: 0, outflow: 0 };
      dailyFlow.set(date, {
        inflow: existing.inflow,
        outflow: existing.outflow + expense.amount
      });
    });
    
    // Convert to array and calculate running balance
    const sortedDates = Array.from(dailyFlow.keys()).sort();
    let runningBalance = 0;
    
    const flowData = sortedDates.map(date => {
      const flow = dailyFlow.get(date)!;
      runningBalance += flow.inflow - flow.outflow;
      return {
        date,
        inflow: flow.inflow,
        outflow: flow.outflow,
        balance: runningBalance
      };
    });
    
    setCashFlowData(flowData);
  };

  const processClientMetrics = (clients: any[], incomes: any[], invoices: any[]) => {
    const metrics: ClientMetrics[] = clients.map(client => {
      const clientInvoices = invoices.filter(inv => inv.client_id === client.id);
      const clientIncomes = incomes.filter(inc => inc.client_id === client.id);
      
      const revenue = clientIncomes.reduce((sum, inc) => sum + inc.amount, 0);
      const outstandingAmount = clientInvoices
        .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
        .reduce((sum, inv) => sum + inv.total, 0);
      
      const lastInvoice = clientInvoices.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      
      return {
        id: client.id,
        name: client.name,
        revenue,
        invoiceCount: clientInvoices.length,
        avgInvoiceValue: clientInvoices.length > 0 ? revenue / clientInvoices.length : 0,
        outstandingAmount,
        lastActivity: lastInvoice ? lastInvoice.date : 'No activity'
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10); // Top 10 clients
    
    setClientMetrics(metrics);
  };

  const processKPIMetrics = (
    incomes: any[], 
    expenses: any[], 
    invoices: any[], 
    clients: any[],
    prevIncomes: any[],
    prevExpenses: any[]
  ) => {
    // Current period metrics
    const totalRevenue = incomes.reduce((sum, inc) => sum + inc.amount, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // Invoice metrics
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalCollected = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);
    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;
    
    // Calculate average days to payment
    const paidInvoices = invoices.filter(inv => inv.status === 'paid' && inv.paid_date);
    const avgDaysToPayment = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, inv) => {
          const days = Math.floor(
            (new Date(inv.paid_date!).getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }, 0) / paidInvoices.length
      : 0;
    
    // Outstanding amounts
    const totalOutstanding = invoices
      .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.total, 0);
    const overdueAmount = invoices
      .filter(inv => inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.total, 0);
    
    // Tax metrics
    const taxCollected = incomes.reduce((sum, inc) => sum + (inc.tax_amount || 0), 0);
    const taxPaid = expenses.reduce((sum, exp) => sum + (exp.tax_amount || 0), 0);
    
    // Growth metrics
    const prevRevenue = prevIncomes.reduce((sum, inc) => sum + inc.amount, 0);
    const prevExpenseTotal = prevExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const expenseGrowth = prevExpenseTotal > 0 ? ((totalExpenses - prevExpenseTotal) / prevExpenseTotal) * 100 : 0;
    
    // Client metrics
    const activeClients = clients.filter(client => {
      const hasRecentInvoice = invoices.some(inv => 
        inv.client_id === client.id && 
        new Date(inv.date) > subMonths(new Date(), 3)
      );
      return hasRecentInvoice;
    }).length;
    
    setKpiMetrics({
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      totalInvoiced,
      totalCollected,
      collectionRate,
      avgDaysToPayment,
      totalClients: clients.length,
      activeClients,
      totalOutstanding,
      overdueAmount,
      taxCollected,
      taxPaid,
      revenueGrowth,
      expenseGrowth,
      clientGrowth: 0 // Would need historical client data
    });
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  const exportReport = () => {
    // Generate comprehensive CSV report
    let csv = 'AccuBooks Financial Report\n';
    csv += `Period: ${period}\n`;
    csv += `Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}\n\n`;
    
    // KPI Summary
    csv += 'KEY PERFORMANCE INDICATORS\n';
    csv += `Total Revenue,${kpiMetrics.totalRevenue}\n`;
    csv += `Total Expenses,${kpiMetrics.totalExpenses}\n`;
    csv += `Net Profit,${kpiMetrics.netProfit}\n`;
    csv += `Profit Margin,${kpiMetrics.profitMargin.toFixed(2)}%\n`;
    csv += `Collection Rate,${kpiMetrics.collectionRate.toFixed(2)}%\n`;
    csv += `Average Days to Payment,${kpiMetrics.avgDaysToPayment.toFixed(0)}\n\n`;
    
    // Monthly Breakdown
    csv += 'MONTHLY BREAKDOWN\n';
    csv += 'Month,Revenue,Expenses,Profit,Invoiced,Collected\n';
    monthlyData.forEach(month => {
      csv += `${month.month},${month.income},${month.expenses},${month.profit},${month.invoiced},${month.collected}\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Custom chart components
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-2xl border border-gray-100">
          <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-600">{entry.name}:</span>
              </span>
              <span className="font-medium text-gray-900">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const COLORS = {
    primary: '#4F46E5',
    secondary: '#7C3AED',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
    purple: '#9333EA',
    pink: '#EC4899',
    indigo: '#6366F1',
    teal: '#14B8A6'
  };

  const chartColors = [
    COLORS.primary,
    COLORS.secondary,
    COLORS.success,
    COLORS.warning,
    COLORS.info,
    COLORS.purple,
    COLORS.pink,
    COLORS.indigo,
    COLORS.teal,
    COLORS.danger
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing your financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Financial Analytics</h1>
              <p className="text-gray-600 mt-1">Comprehensive insights into your business performance</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Period Selector */}
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="1month">Last Month</option>
                <option value="3months">Last 3 Months</option>
                <option value="6months">Last 6 Months</option>
                <option value="1year">Last Year</option>
                <option value="ytd">Year to Date</option>
              </select>
              
              {/* Action Buttons */}
              <button
                onClick={refreshData}
                disabled={refreshing}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={`inline-flex items-center px-4 py-2 rounded-xl transition-all ${
                  compareMode 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Activity className="h-4 w-4 mr-2" />
                Compare
              </button>
              
              <button
                onClick={exportReport}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
              
              <Link
                to="/reports/profit-loss"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
              >
                <FileText className="h-4 w-4 mr-2" />
                P&L Statement
              </Link>
              <Link
                to="/reports/cash-flow"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
              >
                <FileText className="h-4 w-4 mr-2" />
                Cash Flow
              </Link>
              <Link
                to="/reports/tax"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
              >
                <FileText className="h-4 w-4 mr-2" />
                Tax Reports
              </Link>
             
            </div>
          </div>
        </div>

        {/* KPI Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue Card */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <TrendingUp className="h-6 w-6" />
                </div>
                {kpiMetrics.revenueGrowth !== 0 && (
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                    kpiMetrics.revenueGrowth > 0 
                      ? 'bg-white/20 text-white' 
                      : 'bg-red-500/20 text-red-100'
                  }`}>
                    {kpiMetrics.revenueGrowth > 0 ? '+' : ''}{kpiMetrics.revenueGrowth.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(kpiMetrics.totalRevenue)}</p>
              <p className="text-emerald-100 text-sm mt-2">
                {kpiMetrics.totalInvoiced > 0 && (
                  <span>{kpiMetrics.collectionRate.toFixed(0)}% collected</span>
                )}
              </p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          {/* Expenses Card */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <TrendingDown className="h-6 w-6" />
                </div>
                {kpiMetrics.expenseGrowth !== 0 && (
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                    kpiMetrics.expenseGrowth < 0 
                      ? 'bg-white/20 text-white' 
                      : 'bg-red-600/20 text-red-100'
                  }`}>
                    {kpiMetrics.expenseGrowth > 0 ? '+' : ''}{kpiMetrics.expenseGrowth.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-red-100 text-sm font-medium">Total Expenses</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(kpiMetrics.totalExpenses)}</p>
              <p className="text-red-100 text-sm mt-2">
                {categoryData.expense.length} categories
              </p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          {/* Profit Card */}
          <div className={`bg-gradient-to-br ${
            kpiMetrics.netProfit >= 0 
              ? 'from-indigo-500 to-indigo-600' 
              : 'from-gray-500 to-gray-600'
          } rounded-2xl p-6 text-white relative overflow-hidden`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <DollarSign className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium px-3 py-1 rounded-full bg-white/20">
                  {kpiMetrics.profitMargin.toFixed(1)}% margin
                </span>
              </div>
              <p className="text-indigo-100 text-sm font-medium">Net Profit</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(kpiMetrics.netProfit)}</p>
              <p className="text-indigo-100 text-sm mt-2">
                {kpiMetrics.netProfit >= 0 ? 'Profitable' : 'Loss'}
              </p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          {/* Outstanding Card */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <Receipt className="h-6 w-6" />
                </div>
                {kpiMetrics.overdueAmount > 0 && (
                  <span className="text-sm font-medium px-3 py-1 rounded-full bg-red-500/20 text-red-100 animate-pulse">
                    Overdue
                  </span>
                )}
              </div>
              <p className="text-amber-100 text-sm font-medium">Outstanding</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(kpiMetrics.totalOutstanding)}</p>
              <p className="text-amber-100 text-sm mt-2">
                {kpiMetrics.avgDaysToPayment.toFixed(0)} days avg payment
              </p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>
        </div>

         {/* Insights Panel */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold">Key Insights & Recommendations</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {kpiMetrics.profitMargin < 20 && (
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="font-semibold mb-2">Low Profit Margin</p>
                <p className="text-sm text-white/80">
                  Your profit margin is {kpiMetrics.profitMargin.toFixed(1)}%. Consider reducing expenses or increasing prices to improve profitability.
                </p>
              </div>
            )}
            
            {kpiMetrics.collectionRate < 80 && (
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="font-semibold mb-2">Collection Rate Alert</p>
                <p className="text-sm text-white/80">
                  Only {kpiMetrics.collectionRate.toFixed(0)}% of invoices are collected. Follow up on outstanding invoices to improve cash flow.
                </p>
              </div>
            )}
            
            {kpiMetrics.avgDaysToPayment > 30 && (
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="font-semibold mb-2">Slow Payment Cycle</p>
                <p className="text-sm text-white/80">
                  Clients take {kpiMetrics.avgDaysToPayment.toFixed(0)} days to pay on average. Consider offering early payment discounts.
                </p>
              </div>
            )}
            
            {kpiMetrics.expenseGrowth > kpiMetrics.revenueGrowth && (
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="font-semibold mb-2">Expense Growth Warning</p>
                <p className="text-sm text-white/80">
                  Expenses growing faster than revenue. Review spending in top categories to control costs.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue & Expense Trend */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Revenue & Expense Trend</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <Info className="h-4 w-4" />
                  Details
                </button>
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="circle"
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    fill="url(#revenueGradient)"
                    stroke={COLORS.success}
                    strokeWidth={2}
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    fill="url(#expenseGradient)"
                    stroke={COLORS.danger}
                    strokeWidth={2}
                    name="Expenses"
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke={COLORS.primary}
                    strokeWidth={3}
                    dot={{ fill: COLORS.primary, r: 4 }}
                    name="Profit"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            
            {showDetails && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Avg Monthly Revenue</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(monthlyData.reduce((sum, m) => sum + m.income, 0) / monthlyData.length)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Avg Monthly Expenses</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(monthlyData.reduce((sum, m) => sum + m.expenses, 0) / monthlyData.length)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Avg Monthly Profit</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(monthlyData.reduce((sum, m) => sum + m.profit, 0) / monthlyData.length)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Category Performance */}
<div className="bg-white rounded-2xl shadow-lg p-6">
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-xl font-bold text-gray-900">Category Performance</h2>
    <div className="flex items-center gap-2">
      <button className="text-sm px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-medium">
        Income
      </button>
      <button className="text-sm px-3 py-1 bg-gray-100 text-gray-600 rounded-lg">
        Expenses
      </button>
    </div>
  </div>
  
  <div className="h-80">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={categoryData.income}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
            const RADIAN = Math.PI / 180;
            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);

            return (
              <text 
                x={x} 
                y={y} 
                fill="white" 
                textAnchor={x > cx ? 'start' : 'end'} 
                dominantBaseline="central"
                fontSize={12}
                fontWeight="bold"
              >
                {`${(percent * 100).toFixed(0)}%`}
              </text>
            );
          }}
        >
          {categoryData.income.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: any) => formatCurrency(value)} />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          formatter={(value, entry: any) => `${value}: ${formatCurrency(entry.payload.value)}`}
        />
      </PieChart>
    </ResponsiveContainer>
  </div>
</div>
        </div>

        {/* Cash Flow & Client Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cash Flow Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Cash Flow Analysis</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData.slice(-30)}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    labelFormatter={(date) => format(parseISO(date), 'MMM dd, yyyy')}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke={COLORS.primary}
                    fill="url(#balanceGradient)"
                    strokeWidth={2}
                    name="Balance"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(cashFlowData[cashFlowData.length - 1]?.balance || 0)}
                </p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-sm text-emerald-600">Total Inflow</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatCurrency(cashFlowData.reduce((sum, d) => sum + d.inflow, 0))}
                </p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm text-red-600">Total Outflow</p>
                <p className="text-xl font-bold text-red-700">
                  {formatCurrency(cashFlowData.reduce((sum, d) => sum + d.outflow, 0))}
                </p>
              </div>
            </div>
          </div>

          {/* Top Clients */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Top Clients</h2>
              <Link 
                to="/clients"
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                View all →
              </Link>
            </div>
            
            <div className="space-y-4">
              {clientMetrics.slice(0, 5).map((client, index) => (
                <div key={client.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm`}
                         style={{ backgroundColor: chartColors[index % chartColors.length] }}>
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-xs text-gray-500">{client.invoiceCount} invoices</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(client.revenue)}
                    </p>
                    {client.outstandingAmount > 0 && (
                      <p className="text-xs text-orange-600">
                        {formatCurrency(client.outstandingAmount)} due
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>



        {/* Tax Analysis */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Tax Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                <span className="text-xs text-blue-600 font-medium">Collected</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(kpiMetrics.taxCollected)}
              </p>
              <p className="text-xs text-blue-600 mt-1">From sales</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <CreditCard className="h-5 w-5 text-purple-600" />
                <span className="text-xs text-purple-600 font-medium">Paid</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">
                {formatCurrency(kpiMetrics.taxPaid)}
              </p>
              <p className="text-xs text-purple-600 mt-1">On expenses</p>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-5 w-5 text-emerald-600" />
                <span className="text-xs text-emerald-600 font-medium">Net Tax</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">
                {formatCurrency(kpiMetrics.taxCollected - kpiMetrics.taxPaid)}
              </p>
              <p className="text-xs text-emerald-600 mt-1">To remit</p>
            </div>
            
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="h-5 w-5 text-amber-600" />
                <span className="text-xs text-amber-600 font-medium">Avg Rate</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">
                {kpiMetrics.totalRevenue > 0 
                  ? ((kpiMetrics.taxCollected / kpiMetrics.totalRevenue) * 100).toFixed(1)
                  : '0'
                }%
              </p>
              <p className="text-xs text-amber-600 mt-1">Effective rate</p>
            </div>
          </div>
        </div>

       
      </div>
    </div>
  );
};