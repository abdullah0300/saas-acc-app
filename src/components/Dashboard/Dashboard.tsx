// Mobile-Optimized Dashboard Component
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { SkeletonCard } from '../Common/Loading';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Activity,
  Calendar,
  Clock,
  Eye,
  Send,
  UserPlus,
  Receipt,
  Crown,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Bell,
  Zap,
  PiggyBank
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  BarChart, 
  Bar, 
  PieChart as RePieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { getDashboardStats, getIncomes, getExpenses, getInvoices, getClients } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { FeatureGate } from '../Subscription/FeatureGate';
import { supabase } from '../../services/supabaseClient';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { Income, Expense, Invoice, Client } from '../../types';

const UsageSummaryCard = () => {
  const { usage, limits, plan } = useSubscription();
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Usage</h3>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Team Members</span>
            <span className="font-medium">
              {usage.users} / {limits.users === -1 ? '∞' : limits.users}
            </span>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Monthly Invoices</span>
            <span className="font-medium">
              {usage.monthlyInvoices} / {limits.monthlyInvoices === -1 ? '∞' : limits.monthlyInvoices}
            </span>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Clients</span>
            <span className="font-medium">
              {usage.totalClients} / {limits.totalClients === -1 ? '∞' : limits.totalClients}
            </span>
          </div>
        </div>
      </div>
      <Link 
        to="/settings/subscription"
        className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-800"
      >
        View Plan Details →
      </Link>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, loading: settingsLoading } = useSettings();
  const { limits, usage } = useSubscription();
  
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState('');
  const { businessData, businessDataLoading } = useData();
  const { incomes, expenses, invoices, clients } = businessData;

  // Filter for current month data for dashboard stats
  const currentDate = new Date();
  const currentMonthStart = startOfMonth(currentDate);
  const currentMonthEnd = endOfMonth(currentDate);

  const currentMonthIncomes = incomes.filter(income => {
    const incomeDate = parseISO(income.date);
    return incomeDate >= currentMonthStart && incomeDate <= currentMonthEnd;
  });

  const currentMonthExpenses = expenses.filter(expense => {
    const expenseDate = parseISO(expense.date);
    return expenseDate >= currentMonthStart && expenseDate <= currentMonthEnd;
  });

  // Calculate stats from current month data
  const stats = {
    totalIncome: currentMonthIncomes.reduce((sum, income) => sum + income.amount, 0),
    totalExpenses: currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    netProfit: currentMonthIncomes.reduce((sum, income) => sum + income.amount, 0) - currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    pendingInvoices: invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').length,
    totalPending: invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').reduce((sum, inv) => sum + inv.total, 0),
    overdueInvoices: invoices.filter(inv => inv.status === 'overdue').length,
    recentTransactions: [
      ...currentMonthIncomes.slice(0, 3).map(income => ({ ...income, type: 'income' })),
      ...currentMonthExpenses.slice(0, 3).map(expense => ({ ...expense, type: 'expense' }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  };

  // Generate actual monthly data from the last 6 months
  const generateMonthlyData = () => {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const monthIncomes = incomes.filter(income => {
        const incomeDate = parseISO(income.date);
        return incomeDate >= monthStart && incomeDate <= monthEnd;
      });
      
      const monthExpenses = expenses.filter(expense => {
        const expenseDate = parseISO(expense.date);
        return expenseDate >= monthStart && expenseDate <= monthEnd;
      });
      
      const income = monthIncomes.reduce((sum, inc) => sum + inc.amount, 0);
      const expenseTotal = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      months.push({
        month: format(monthDate, 'MMM'),
        income,
        expenses: expenseTotal,
        profit: income - expenseTotal
      });
    }
    
    return months;
  };

  const monthlyData = generateMonthlyData();

  const categoryData: any = { 
    income: incomes.slice(0, 5).map(income => ({
      name: income.category?.name || 'Uncategorized',
      value: income.amount
    })), 
    expense: expenses.slice(0, 5).map(expense => ({
      name: expense.category?.name || 'Uncategorized', 
      value: expense.amount
    }))
  };

  // Create recent activity with proper type field
  const recentActivity = [
    ...currentMonthIncomes.slice(0, 3).map(income => ({ 
      ...income, 
      type: 'income' 
    })),
    ...currentMonthExpenses.slice(0, 3).map(expense => ({ 
      ...expense, 
      type: 'expense' 
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const recentClients = clients.slice(0, 5);
  const recentInvoices = invoices.slice(0, 5);
  const loading = businessDataLoading;

  const SkeletonCard = ({ count = 1 }: { count?: number }) => {
    return (
      <>
        {Array(count).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
            </div>
            <div className="w-24 h-4 bg-gray-200 rounded mb-2"></div>
            <div className="w-32 h-8 bg-gray-200 rounded mb-2"></div>
            <div className="w-20 h-3 bg-gray-200 rounded"></div>
          </div>
        ))}
      </>
    );
  };

  const calculateGrowth = () => {
    if (monthlyData.length < 2) return { income: 0, expenses: 0, profit: 0 };
    
    const current = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];
    
    return {
      income: previous.income === 0 ? 0 : ((current.income - previous.income) / previous.income) * 100,
      expenses: previous.expenses === 0 ? 0 : ((current.expenses - previous.expenses) / previous.expenses) * 100,
      profit: previous.profit === 0 ? 0 : ((current.profit - previous.profit) / previous.profit) * 100,
    };
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getClientTotalRevenue = (clientId: string) => {
    return stats?.recentTransactions
      ?.filter((t: any) => t.type === 'income' && t.client_id === clientId)
      ?.reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
  };

  if (loading || settingsLoading) {
    return (
      <div className="p-4 md:p-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen">
        {/* Desktop Loading - Keep Original */}
        <div className="hidden lg:block">
          <div className="mb-8">
            <div className="w-48 h-8 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="w-64 h-4 bg-gray-200 rounded animate-pulse" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <SkeletonCard count={4} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="w-32 h-6 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-64 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="w-28 h-6 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-64 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Mobile Loading */}
        <div className="lg:hidden">
          <div className="mb-6">
            <div className="w-32 h-6 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="w-48 h-4 bg-gray-200 rounded animate-pulse" />
          </div>
          
          <div className="space-y-4 mb-6">
            <SkeletonCard count={4} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-red-600">Error loading dashboard: {error}</div>
      </div>
    );
  }

  const growth = calculateGrowth();
  const profitMargin = stats?.totalIncome > 0 
    ? ((stats.netProfit / stats.totalIncome) * 100).toFixed(1) 
    : '0';

  return (
    <>
      {/* Desktop View - Keep Original Layout */}
      <div className="hidden lg:block min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header with Quick Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-gray-600 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            
            <div className="flex gap-3">
              <Link
                to="/income/new"
                className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Income
              </Link>
              <Link
                to="/expenses/new"
                className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all transform hover:scale-105 shadow-lg shadow-purple-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Link>
            </div>
          </div>

          {/* Stats Cards - Desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl shadow-xl shadow-emerald-100 p-6 border border-emerald-100 transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                  {growth.income > 0 ? '+' : ''}{growth.income.toFixed(1)}%
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats?.totalIncome || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-2">This month</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl shadow-red-100 p-6 border border-red-100 transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-red-400 to-red-600 rounded-xl">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                  {stats?.totalIncome > 0 ? `${((stats.totalExpenses / stats.totalIncome) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats?.totalExpenses || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-2">This month</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-semibold bg-white/20 backdrop-blur px-3 py-1 rounded-full">
                  {profitMargin}% margin
                </span>
              </div>
              <p className="text-sm font-medium text-indigo-100">Net Profit</p>
              <p className="text-3xl font-bold mt-1">
                {formatCurrency(stats?.netProfit || 0)}
              </p>
              <p className="text-sm text-indigo-100 mt-2">
                {stats?.netProfit >= 0 ? 'Profit' : 'Loss'} this period
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl shadow-amber-100 p-6 border border-amber-100 transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                {stats?.overdueInvoices > 0 && (
                  <span className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full animate-pulse">
                    {stats.overdueInvoices} overdue
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-600">Pending Invoices</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats?.pendingInvoices || 0}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {formatCurrency(stats?.totalPending || 0)} outstanding
              </p>
            </div>
          </div>

          {/* Rest of desktop content - Charts, Recent Activity, etc. */}
          {/* Keep your existing desktop layout here */}
        </div>
      </div>

      {/* Mobile View - Complete Redesign */}
      <div className="lg:hidden min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 pt-12 pb-8 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-20 -translate-y-20"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full translate-x-16 translate-y-16"></div>
          </div>

          {/* Header Content */}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}!
                </h1>
                <p className="text-indigo-100 text-sm mt-1">
                  {format(new Date(), 'EEEE, MMMM d')}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Bell className="h-6 w-6 text-white" />
                  {stats?.overdueInvoices > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Quick Stats Banner */}
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 border border-white/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(stats?.netProfit || 0)}
                  </p>
                  <p className="text-indigo-100 text-xs">Net Profit</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {stats?.pendingInvoices || 0}
                  </p>
                  <p className="text-indigo-100 text-xs">Pending</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Quick Actions */}
        <div className="px-4 -mt-4 relative z-20 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/income/new"
                className="flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 px-4 rounded-xl font-medium active:scale-95 transition-all"
              >
                <Plus className="h-5 w-5" />
                <span>Add Income</span>
              </Link>
              <Link
                to="/expenses/new"
                className="flex items-center justify-center space-x-2 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-4 rounded-xl font-medium active:scale-95 transition-all"
              >
                <Plus className="h-5 w-5" />
                <span>Add Expense</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Stats Grid */}
        <div className="px-4 space-y-4 mb-6">
          {/* Income Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/90 text-sm">Total Income</p>
                    <p className="text-white text-xl font-bold">
                      {formatCurrency(stats?.totalIncome || 0)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                    {growth.income > 0 ? '+' : ''}{growth.income.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4">
              <p className="text-gray-500 text-sm">This month</p>
            </div>
          </div>

          {/* Expenses Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <TrendingDown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/90 text-sm">Total Expenses</p>
                    <p className="text-white text-xl font-bold">
                      {formatCurrency(stats?.totalExpenses || 0)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                    {stats?.totalIncome > 0 ? `${((stats.totalExpenses / stats.totalIncome) * 100).toFixed(1)}%` : '0%'}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4">
              <p className="text-gray-500 text-sm">This month</p>
            </div>
          </div>

          {/* Pending Invoices Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/90 text-sm">Pending Invoices</p>
                    <p className="text-white text-xl font-bold">
                      {stats?.pendingInvoices || 0}
                    </p>
                  </div>
                </div>
                {stats?.overdueInvoices > 0 && (
                  <div className="text-right">
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                      {stats.overdueInvoices} overdue
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4">
              <p className="text-gray-500 text-sm">
                {formatCurrency(stats?.totalPending || 0)} outstanding
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Chart Section */}
        <div className="px-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Monthly Trend</h3>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    fill="url(#profitGradient)"
                  />
                  <XAxis dataKey="month" hide />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Mobile Recent Activity */}
        <div className="px-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
              <Link to="/dashboard" className="text-indigo-600 text-sm font-medium">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.slice(0, 3).map((transaction: any) => (
                  <div key={transaction.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      transaction.type === 'income' 
                        ? 'bg-emerald-100' 
                        : 'bg-red-100'
                    }`}>
                      {transaction.type === 'income' ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(parseISO(transaction.date), 'MMM dd')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${
                        transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8 text-sm">No recent activity</p>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Recent Invoices */}
        <div className="px-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recent Invoices</h3>
              <Link to="/invoices" className="text-indigo-600 text-sm font-medium">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentInvoices.length > 0 ? (
                recentInvoices.slice(0, 3).map((invoice: Invoice) => (
                  <div key={invoice.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                    <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                      <Receipt className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {invoice.invoice_number}
                      </p>
                      <p className="text-xs text-gray-500">
                        {invoice.client?.name || 'No client'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(invoice.total)}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8 text-sm">No invoices yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Recent Clients */}
        <div className="px-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recent Clients</h3>
              <Link to="/clients" className="text-indigo-600 text-sm font-medium">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentClients.length > 0 ? (
                recentClients.slice(0, 3).map((client: Client) => (
                  <div key={client.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {client.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {client.email || 'No email'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(getClientTotalRevenue(client.id))}
                      </p>
                      <p className="text-xs text-gray-500">Revenue</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8 text-sm">No clients yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Quick Links */}
        <div className="px-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/invoices/new"
                className="flex items-center space-x-3 p-3 bg-indigo-50 rounded-xl active:scale-95 transition-all"
              >
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileText className="h-4 w-4 text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-indigo-700">New Invoice</span>
              </Link>
              <Link
                to="/clients/new"
                className="flex items-center space-x-3 p-3 bg-purple-50 rounded-xl active:scale-95 transition-all"
              >
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-purple-700">Add Client</span>
              </Link>
              <Link
                to="/reports"
                className="flex items-center space-x-3 p-3 bg-emerald-50 rounded-xl active:scale-95 transition-all"
              >
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Activity className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-emerald-700">View Reports</span>
              </Link>
              <FeatureGate feature="budget_tracking">
                <Link
                  to="/budget"
                  className="flex items-center space-x-3 p-3 bg-amber-50 rounded-xl active:scale-95 transition-all"
                >
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <PiggyBank className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-sm font-medium text-amber-700">Budget</span>
                </Link>
              </FeatureGate>
            </div>
          </div>
        </div>

        {/* Mobile Usage Summary */}
        <div className="px-4 mb-20">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-sm p-4 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Plan Usage</h3>
              <Crown className="h-5 w-5 text-amber-300" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-white/80 text-sm">Monthly Invoices</span>
                <span className="font-medium">
                  {usage.monthlyInvoices} / {limits.monthlyInvoices === -1 ? '∞' : limits.monthlyInvoices}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/80 text-sm">Team Members</span>
                <span className="font-medium">
                  {usage.users} / {limits.users === -1 ? '∞' : limits.users}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/80 text-sm">Total Clients</span>
                <span className="font-medium">
                  {usage.totalClients} / {limits.totalClients === -1 ? '∞' : limits.totalClients}
                </span>
              </div>
            </div>
            <Link 
              to="/settings/subscription"
              className="mt-4 block text-center text-sm text-white/90 underline"
            >
              Manage Plan →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};