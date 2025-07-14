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
  PiggyBank,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  
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
  ResponsiveContainer,
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
  const recentClients = clients.slice(0, 5);
  const recentInvoices = invoices.slice(0, 5);
  const loading = businessDataLoading;

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
      <>
        {/* Desktop Loading - Keep Original */}
        <div className="hidden lg:block p-4 md:p-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen">
          <div className="mb-8">
            <div className="w-48 h-8 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="w-64 h-4 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Array(4).fill(0).map((_, i) => (
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
          </div>
        </div>

        {/* Mobile Loading */}
        <div className="lg:hidden px-4 pt-4">
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-20 bg-gray-200 rounded-xl"></div>
              </div>
            ))}
          </div>
        </div>
      </>
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
      {/* Desktop View - Keep Exactly as Original */}
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

          {/* Keep all other desktop sections... */}
          <UsageSummaryCard />
        </div>
      </div>

      {/* Mobile View - Complete New Design */}
      <div className="lg:hidden">
        {/* Mobile Quick Stats Overview */}
        <div className="px-4 -mt-3 relative z-10">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-xl p-5 border border-white/20">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl mb-2">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(stats?.netProfit || 0)}
                </p>
                <p className="text-xs text-gray-500">Net Profit</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl mb-2">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {stats?.pendingInvoices || 0}
                </p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/income/new"
                className="flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3 px-4 rounded-xl font-medium shadow-lg active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Income</span>
              </Link>
              <Link
                to="/expenses/new"
                className="flex items-center justify-center space-x-2 bg-gradient-to-r from-red-500 to-pink-600 text-white py-3 px-4 rounded-xl font-medium shadow-lg active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Expense</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Financial Overview Cards */}
        <div className="px-4 mt-6 space-y-4">
          {/* Income & Expense Combined Card */}
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-6 -translate-x-6"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Monthly Overview</h3>
                <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
                  {format(new Date(), 'MMM yyyy')}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-white/80">Income</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(stats?.totalIncome || 0)}</p>
                  <p className="text-xs text-white/70">
                    {growth.income > 0 ? '+' : ''}{growth.income.toFixed(1)}% vs last month
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                      <TrendingDown className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-white/80">Expenses</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(stats?.totalExpenses || 0)}</p>
                  <p className="text-xs text-white/70">
                    {stats?.totalIncome > 0 ? `${((stats.totalExpenses / stats.totalIncome) * 100).toFixed(1)}%` : '0%'} of income
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
              <Link to="/dashboard" className="text-indigo-600 text-sm font-medium">
                View All
              </Link>
            </div>
            
            <div className="space-y-3">
              {stats.recentTransactions.length > 0 ? (
                stats.recentTransactions.slice(0, 3).map((transaction: any) => (
                  <div key={transaction.id} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl">
                    <div className={`p-2 rounded-xl ${
                      transaction.type === 'income' 
                        ? 'bg-gradient-to-br from-emerald-500 to-green-600' 
                        : 'bg-gradient-to-br from-red-500 to-pink-600'
                    }`}>
                      {transaction.type === 'income' ? (
                        <ArrowUpRight className="h-4 w-4 text-white" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-white" />
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
                    <span className={`text-sm font-bold ${
                      transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Status Card */}
          {stats?.pendingInvoices > 0 && (
            <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl shadow-xl p-5 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Receipt className="h-5 w-5" />
                  <h3 className="font-bold">Invoice Status</h3>
                </div>
                <Link to="/invoices" className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-medium">
                  View All
                </Link>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/90">Pending Amount</span>
                  <span className="font-bold">{formatCurrency(stats?.totalPending || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/90">Total Pending</span>
                  <span className="font-bold">{stats?.pendingInvoices}</span>
                </div>
                {stats?.overdueInvoices > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/90">Overdue</span>
                    <span className="font-bold bg-red-600 px-2 py-1 rounded-full text-xs">
                      {stats.overdueInvoices}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions Grid */}
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/invoices/new"
                className="flex flex-col items-center space-y-2 p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white active:scale-95 transition-all shadow-lg"
              >
                <FileText className="h-6 w-6" />
                <span className="text-sm font-medium">New Invoice</span>
              </Link>
              <Link
                to="/clients/new"
                className="flex flex-col items-center space-y-2 p-4 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl text-white active:scale-95 transition-all shadow-lg"
              >
                <Users className="h-6 w-6" />
                <span className="text-sm font-medium">Add Client</span>
              </Link>
              <Link
                to="/reports"
                className="flex flex-col items-center space-y-2 p-4 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl text-white active:scale-95 transition-all shadow-lg"
              >
                <Activity className="h-6 w-6" />
                <span className="text-sm font-medium">Reports</span>
              </Link>
              <FeatureGate feature="budget_tracking">
                <Link
                  to="/budget"
                  className="flex flex-col items-center space-y-2 p-4 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl text-white active:scale-95 transition-all shadow-lg"
                >
                  <PiggyBank className="h-6 w-6" />
                  <span className="text-sm font-medium">Budget</span>
                </Link>
              </FeatureGate>
            </div>
          </div>

          {/* Recent Clients & Invoices */}
          {(recentClients.length > 0 || recentInvoices.length > 0) && (
            <div className="bg-white rounded-2xl shadow-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Items</h3>
              </div>
              
              <div className="space-y-4">
                {/* Recent Invoices */}
                {recentInvoices.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">Latest Invoices</h4>
                      <Link to="/invoices" className="text-indigo-600 text-xs font-medium">
                        View All
                      </Link>
                    </div>
                    <div className="space-y-2">
                      {recentInvoices.slice(0, 3).map((invoice: Invoice) => (
                        <div key={invoice.id} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
                          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
                            <Receipt className="h-4 w-4 text-white" />
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
                            <p className="text-sm font-bold text-gray-900">
                              {formatCurrency(invoice.total)}
                            </p>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(invoice.status)}`}>
                              {invoice.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Clients */}
                {recentClients.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">Top Clients</h4>
                      <Link to="/clients" className="text-indigo-600 text-xs font-medium">
                        View All
                      </Link>
                    </div>
                    <div className="space-y-2">
                      {recentClients.slice(0, 3).map((client: Client) => (
                        <div key={client.id} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
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
                            <p className="text-sm font-bold text-gray-900">
                              {formatCurrency(getClientTotalRevenue(client.id))}
                            </p>
                            <p className="text-xs text-gray-500">Revenue</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Monthly Performance Chart */}
          <div className="bg-gradient-to-br from-slate-800 via-gray-800 to-slate-900 rounded-2xl shadow-xl p-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Monthly Trend</h3>
                <p className="text-white/70 text-sm">Last 6 months performance</p>
              </div>
              <div className="p-2 bg-white/10 backdrop-blur-sm rounded-lg">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            
            <div className="h-40 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="mobileProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="#ffffff" 
                    strokeWidth={2}
                    fill="url(#mobileProfit)"
                  />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#ffffff' }} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }}
                    formatter={(value: any) => [formatCurrency(value), 'Profit']}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="text-center">
              <p className="text-white/80 text-sm">
                {growth.profit >= 0 ? '📈' : '📉'} 
                {growth.profit >= 0 ? ' Growing ' : ' Declining '}
                <span className="font-bold">{Math.abs(growth.profit).toFixed(1)}%</span> this month
              </p>
            </div>
          </div>

          {/* Plan Usage - Mobile Optimized */}
          <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-4 -translate-x-4"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Plan Usage</h3>
                  <p className="text-white/70 text-sm">Current subscription limits</p>
                </div>
                <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
                  <Crown className="h-5 w-5 text-white" />
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white/15 backdrop-blur-sm rounded-xl">
                  <span className="text-white font-medium text-sm">Monthly Invoices</span>
                  <span className="text-white font-bold">
                    {usage.monthlyInvoices} / {limits.monthlyInvoices === -1 ? '∞' : limits.monthlyInvoices}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/15 backdrop-blur-sm rounded-xl">
                  <span className="text-white font-medium text-sm">Team Members</span>
                  <span className="text-white font-bold">
                    {usage.users} / {limits.users === -1 ? '∞' : limits.users}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/15 backdrop-blur-sm rounded-xl">
                  <span className="text-white font-medium text-sm">Total Clients</span>
                  <span className="text-white font-bold">
                    {usage.totalClients} / {limits.totalClients === -1 ? '∞' : limits.totalClients}
                  </span>
                </div>
              </div>
              
              <Link 
                to="/settings/subscription"
                className="mt-4 block text-center bg-white/20 backdrop-blur-sm text-white font-medium py-3 rounded-xl border border-white/20 active:scale-95 transition-all"
              >
                Manage Plan →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};