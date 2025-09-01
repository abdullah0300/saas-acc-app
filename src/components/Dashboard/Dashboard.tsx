import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { SkeletonCard } from '../Common/Loading';
import { AIInsightsService, Insight } from '../../services/aiInsightsService';
import { Brain, RefreshCw } from 'lucide-react';
import { ContextCollectionModal } from '../AI/ContextCollectionModal';
import { Link, useNavigate } from 'react-router-dom';
import MonthlyGreetingBanner from './MonthlyGreetingBanner';

import { 
  Building ,
  TrendingUp,
  Lock, 
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
  Upload,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AIImportWizard } from '../Import/AIImportWizard';
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
  const { formatCurrency, baseCurrency, loading: settingsLoading } = useSettings();
  const { limits, usage, subscription } = useSubscription();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const { businessData, businessDataLoading } = useData();
const { incomes, expenses, invoices, clients } = businessData;
const [showImportWizard, setShowImportWizard] = useState(false);
const [showMonthlyBanner, setShowMonthlyBanner] = useState(false);
const [lastMonthStats, setLastMonthStats] = useState<any>(null);
// ADD these state variables after line 64
const [insights, setInsights] = useState<Insight[]>([]);
const [loadingInsights, setLoadingInsights] = useState(true);
const [refreshingInsights, setRefreshingInsights] = useState(false);
const [lastInsightUpdate, setLastInsightUpdate] = useState<string>('');
const [needsContext, setNeedsContext] = useState(false);
const [missingFields, setMissingFields] = useState<any[]>([]); // Use any[] instead of string[]
const [showContextModal, setShowContextModal] = useState(false);

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

// ADD this function after your useState declarations
const formatInsightCurrency = (amount: number) => {
  return formatCurrency(amount); // Uses your existing formatCurrency from useSettings
};

// Calculate stats from current month data - GROSS METHOD
const stats = {
  // Calculate gross income (excluding credit note entries)
  grossIncome: currentMonthIncomes
    .filter(income => !income.credit_note_id)
    .reduce((sum, income) => sum + (income.base_amount || income.amount), 0),
  
  // Calculate credit note amounts
  creditNoteAmount: Math.abs(currentMonthIncomes
    .filter(income => income.credit_note_id)
    .reduce((sum, income) => sum + (income.base_amount || income.amount), 0)),
  
  // Net income (gross - credits)
  get totalIncome() {
    return this.grossIncome - this.creditNoteAmount;
  },
  
  totalExpenses: currentMonthExpenses.reduce((sum, expense) => sum + (expense.base_amount || expense.amount), 0),
  
  get netProfit() {
    return this.totalIncome - this.totalExpenses;
  },
  pendingInvoices: invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').length,
  totalPending: invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue')
                       .reduce((sum, inv) => sum + (inv.base_amount || inv.total), 0),
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
    
    // Calculate GROSS income (exclude credit note entries)
    const grossIncome = monthIncomes
      .filter(inc => !inc.credit_note_id)
      .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);
    
    // Calculate credit notes
    const creditAmount = Math.abs(monthIncomes
      .filter(inc => inc.credit_note_id)
      .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0));
    
    // Net income
    const income = grossIncome - creditAmount;
    const expenseTotal = monthExpenses.reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);
    months.push({
      month: format(monthDate, 'MMM'),
      income,
      expenses: expenseTotal,
      profit: income - expenseTotal
    });
  }
  
  return months;
};


// REPLACE your loadInsights function with this corrected version:
const loadInsights = async () => {
  try {
    setLoadingInsights(true);
    
    // ✅ Use the subscription that's already available from line 93
    // No need to call useSubscription() again
    
    // Only Plus users get insights
    if (subscription?.plan !== 'plus') {
      setInsights([]);
      setNeedsContext(false);
      setMissingFields([]);
      return;
    }
    
    // Get cached insights from today's 3 AM generation
    const response = await AIInsightsService.getCachedInsights();
    
    if (response && response.insights) {
      setInsights(response.insights);
      setLastInsightUpdate(response.generated_at);
      setNeedsContext(false);
      setMissingFields([]);
    } else {
      // No insights generated yet (new user or first day)
      setInsights([]);
      setNeedsContext(false);
      setMissingFields([]);
    }
    
  } catch (error) {
    console.error('Error loading insights:', error);
    setInsights([]);
    setNeedsContext(false);
    setMissingFields([]);
  } finally {
    setLoadingInsights(false);
  }
};
// const handleRefreshInsights = async () => {
//   try {
//     setRefreshingInsights(true);
//     const response = await AIInsightsService.regenerateInsights();
//     setInsights(response.insights);
//     setLastInsightUpdate(response.generated_at);
//   } catch (error) {
//     console.error('Error refreshing insights:', error);
//   } finally {
//     setRefreshingInsights(false);
//   }
// };

// Load insights only once when subscription is loaded
React.useEffect(() => {
  if (user && subscription) {
    loadInsights();
  }
}, [user, subscription?.plan]); // Only depend on user and plan

const [showAllInsights, setShowAllInsights] = useState(false);


React.useEffect(() => {
  if (user && incomes && expenses && invoices) {
    // Check for monthly banner
    const today = new Date();
    const isFirstOfMonth = true; // Change to true for testing
    const bannerKey = `monthlyBanner_${user.id}_${today.getFullYear()}_${today.getMonth()}`;
    const hasSeenBanner = localStorage.getItem(bannerKey);

    if (isFirstOfMonth && !hasSeenBanner) {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      
      const lastMonthIncomes = incomes.filter(inc => {
        const incDate = new Date(inc.date);
        return incDate >= lastMonth && incDate <= lastMonthEnd;
      });
      
      const lastMonthExpenses = expenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= lastMonth && expDate <= lastMonthEnd;
      });
      
      const revenue = lastMonthIncomes.reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);
      const expenseTotal = lastMonthExpenses.reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);
      
      setLastMonthStats({
        revenue,
        expenses: expenseTotal,
        profit: revenue - expenseTotal,
        invoiceCount: invoices.filter(inv => {
          const invDate = new Date(inv.date);
          return invDate >= lastMonth && invDate <= lastMonthEnd;
        }).length
      });
      
      setShowMonthlyBanner(true);
    }
  }
}, [user, incomes, expenses, invoices]);

const monthlyData = generateMonthlyData();

const categoryData: any = (() => {
  // Group income by category and sum amounts (using base_amount)
  const incomeByCategory = incomes.reduce((acc: any, income) => {
    const categoryName = income.category?.name || 'Uncategorized';
    acc[categoryName] = (acc[categoryName] || 0) + (income.base_amount || income.amount);
    return acc;
  }, {});

  // Group expenses by category and sum amounts (using base_amount)
  const expenseByCategory = expenses.reduce((acc: any, expense) => {
    const categoryName = expense.category?.name || 'Uncategorized';
    acc[categoryName] = (acc[categoryName] || 0) + (expense.base_amount || expense.amount);
    return acc;
  }, {});

  return {
    income: Object.entries(incomeByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5), // Top 5 income categories
    expense: Object.entries(expenseByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5)  // Top 5 expense categories
  };
})();
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
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());const recentClients = clients.slice(0, 5);
const recentInvoices = invoices.slice(0, 5);
const loading = businessDataLoading;


  const calculateGrowth = () => {
  if (monthlyData.length < 2) return 0;
  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData[monthlyData.length - 2];
  
  // Use net income for growth calculation
  if (!previousMonth?.income || previousMonth.income === 0) return 0;
  const growthPercentage = ((currentMonth.income - previousMonth.income) / previousMonth.income * 100);
  return Math.round(growthPercentage * 10) / 10;
};

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'bg-gray-100 text-gray-800';
      case 'basic': return 'bg-blue-100 text-blue-800';
      case 'professional': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const COLORS = {
    primary: '#4F46E5',
    secondary: '#7C3AED',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
    dark: '#1E293B',
    light: '#F8FAFC'
  };

  const CHART_COLORS = ['#4F46E5', '#7C3AED', '#06B6D4', '#10B981', '#F59E0B'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100">
          <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm flex justify-between gap-4">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-medium">{formatCurrency(entry.value)}</span>
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
  return incomes
    .filter(income => income.client_id === clientId)
    .reduce((sum, income) => sum + (income.base_amount || income.amount), 0);
};


const handleBannerClose = () => {
  if (!user) return;
  const today = new Date();
  const bannerKey = `monthlyBanner_${user.id}_${today.getFullYear()}_${today.getMonth()}`;
  localStorage.setItem(bannerKey, 'true');
  setShowMonthlyBanner(false);
};

  if (loading || settingsLoading) {
  return (
    <div className="p-4 md:p-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen">
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
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
    {showMonthlyBanner && (
      <div className="max-w-7xl mx-auto mb-6">
        <MonthlyGreetingBanner
          user={user}
          lastMonthStats={lastMonthStats}
          onClose={handleBannerClose}
          formatCurrency={formatCurrency}
          baseCurrency={baseCurrency}
        />
      </div>
    )}
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
  {/* ADD THIS NEW IMPORT BUTTON */}
  {/* <button
    onClick={() => setShowImportWizard(true)}
    className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all transform hover:scale-105 shadow-lg shadow-purple-200"
  >
    <Upload className="h-4 w-4 mr-2" />
    Import Data
  </button> */}
  
  <Link
    to="/income/new"
    className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
  >
    <Plus className="h-4 w-4 mr-2" />
    Add Income
  </Link>
            <Link
              to="/expenses/new"
              className="inline-flex items-center px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all transform hover:scale-105 shadow-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Expense
            </Link>
          </div>
        </div>

        {/* Key Metrics - Modern Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl shadow-xl shadow-indigo-100 p-6 border border-indigo-100 transform hover:scale-105 transition-all">
  <div className="flex items-center justify-between mb-4">
    <div className="p-3 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl">
      <TrendingUp className="h-6 w-6 text-white" />
    </div>
    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
      {growth > 0 ? '+' : ''}{growth}%
    </span>
  </div>
  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
  
  {/* Show breakdown if there are credit notes */}
  {stats?.creditNoteAmount > 0 ? (
    <div>
      <p className="text-3xl font-bold text-gray-900 mt-1">
        {formatCurrency(stats?.totalIncome || 0)}
      </p>
      <div className="mt-2 space-y-1">
        <div className="text-xs text-gray-500">
          Gross: {formatCurrency(stats?.grossIncome || 0)}
        </div>
        <div className="text-xs text-red-600">
          Credits: -{formatCurrency(stats?.creditNoteAmount || 0)}
        </div>
      </div>
    </div>
  ) : (
    <p className="text-3xl font-bold text-gray-900 mt-1">
      {formatCurrency(stats?.totalIncome || 0)}
    </p>
  )}
  
  <p className="text-sm text-gray-500 mt-2">This month ({baseCurrency})</p>
</div>

          <div className="bg-white rounded-2xl shadow-xl shadow-red-100 p-6 border border-red-100 transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-red-400 to-red-600 rounded-xl">
                <TrendingDown className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                {stats?.totalExpenses > 0 ? `${((stats.totalExpenses / stats.totalIncome) * 100).toFixed(1)}%` : '0%'}
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


        {/* AI CFO Insights Section */}
<div className="bg-white rounded-2xl shadow-xl p-6">
  {/* Show locked state for Simple Start users */}
  {subscription?.plan === 'simple_start' ? (
    <div className="text-center py-12">
      <div className="relative inline-block">
        <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Lock className="w-8 h-8 text-gray-500" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">AI CFO Insights</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        Get personalized financial insights and recommendations powered by AI. 
        Understand your cash flow, spot trends, and make smarter business decisions.
      </p>
      <button
        onClick={() => navigate('/settings/subscription')}
        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
      >
        <Crown className="w-5 h-5 mr-2" />
        Upgrade to Plus
      </button>
    </div>
  ) : (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl">
            <Brain className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">AI CFO Insights</h2>
            <p className="text-sm text-gray-500">Your personalized financial advisor</p>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      {lastInsightUpdate && (
        <div className="text-xs text-gray-500 mb-4">
          Generated daily at 3 AM your time • Last update: {format(new Date(lastInsightUpdate), 'MMM d, yyyy')}
        </div>
      )}

      {/* Loading State */}
      {loadingInsights ? (
        <div className="space-y-3">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
          </div>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      ) : (
        /* Insights Display */
        <div className="space-y-3">
          {insights.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Insights will appear here after 3 AM</p>
              <p className="text-sm">Your AI CFO analyzes your data daily</p>
            </div>
          ) : (
            <>
              {/* Show insights */}
              {insights
                .sort((a, b) => a.priority - b.priority)
                .slice(0, showAllInsights ? insights.length : 2)
                .map((insight) => {
                  const getInsightIcon = (type: string) => {
                    switch (type) {
                      case 'urgent': return '🚨';
                      case 'warning': return '⚠️';
                      case 'success': return '💰';
                      default: return '💡';
                    }
                  };

                  const getInsightStyle = (type: string) => {
                    switch (type) {
                      case 'urgent': 
                        return 'border-l-4 border-red-500 bg-gradient-to-r from-red-50 to-white';
                      case 'warning': 
                        return 'border-l-4 border-yellow-500 bg-gradient-to-r from-yellow-50 to-white';
                      case 'success': 
                        return 'border-l-4 border-green-500 bg-gradient-to-r from-green-50 to-white';
                      default: 
                        return 'border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-white';
                    }
                  };

                  return (
                    <div
                      key={insight.id}
                      className={`rounded-lg p-4 ${getInsightStyle(insight.type)}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg flex-shrink-0">
                          {getInsightIcon(insight.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {insight.title}
                          </h3>
                          <p className="text-gray-700 text-sm mb-2 leading-relaxed">
                            {insight.message}
                          </p>
                          {insight.action && (
                            <Link
                              to={insight.action.link}
                              className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              {insight.action.label}
                              <ArrowRight className="w-4 h-4 ml-1" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Show More/Less Button */}
              {insights.length > 2 && (
                <div className="pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setShowAllInsights(!showAllInsights)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    {showAllInsights ? (
                      <>
                        Show Less
                        <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Show {insights.length - 2} More Insights
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )}
</div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FeatureGate feature="cash_flow_analysis" className="h-full">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Cash Flow</h3>
                <Link
                  to="/reports/cash-flow"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View Details →
                </Link>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="month" stroke="#6B7280" fontSize={12} tickLine={false} />
                    <YAxis stroke="#6B7280" fontSize={12} tickLine={false} tickFormatter={(value) => `${formatCurrency(value/1000)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="income" 
                      stroke="#4F46E5" 
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      strokeWidth={3}
                      name="Revenue"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="expenses" 
                      stroke="#EF4444" 
                      fillOpacity={1}
                      fill="url(#colorExpense)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Expenses"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FeatureGate>

          <FeatureGate feature="budget_tracking" className="h-full">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Overview</h3>
              <div className="h-72 flex flex-col">
  {categoryData.expense.length > 0 ? (
    <>
      {/* Chart Container - Fixed Height */}
      <div className="flex-shrink-0" style={{ height: '200px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RePieChart>
            <Pie
              data={categoryData.expense}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {categoryData.expense.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => formatCurrency(value)} />
          </RePieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend Container - Scrollable if needed */}
      <div className="flex-1 mt-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2 max-h-full">
          {categoryData.expense.map((cat: any, index: number) => (
            <div key={cat.name} className="flex items-center gap-2 min-h-0">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{cat.name}</p>
                <p className="text-xs text-gray-500">{formatCurrency(cat.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  ) : (
    <div className="h-full flex items-center justify-center text-gray-500">
      No expense data available
    </div>
  )}
</div>
            </div>
          </FeatureGate>
        </div>

        {/* Recent Clients and Invoices Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-4">
    <div className="flex justify-between items-center mb-6 sm:mb-4">
      <h2 className="text-xl font-bold text-gray-900 sm:text-lg">Recent Clients</h2>
      <Link
        to="/clients"
        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 sm:text-xs"
      >
        View all
        <ArrowUpRight className="h-4 w-4 sm:h-3 sm:w-3" />
      </Link>
    </div>
    <div className="space-y-4 sm:space-y-3">
      {recentClients.length > 0 ? (
        recentClients.map((client: Client) => (
          <div key={client.id} className="flex items-center justify-between p-4 sm:p-3 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl hover:from-indigo-50 hover:to-purple-50 transition-all">
            <div className="flex items-center gap-4 sm:gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-xl flex items-center justify-center text-white font-bold sm:text-sm flex-shrink-0">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 sm:text-sm truncate">{client.name}</p>
                <p className="text-sm text-gray-500 sm:text-xs truncate">{client.email || 'No email'}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="text-sm font-semibold text-gray-900 sm:text-xs">
                {formatCurrency(getClientTotalRevenue(client.id))}
              </p>
              <p className="text-xs text-gray-500 sm:text-[10px]">Total revenue</p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-center text-gray-500 py-8 sm:py-6 sm:text-sm">No clients yet</p>
      )}
    </div>
  </div>

  <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-4">
    <div className="flex justify-between items-center mb-6 sm:mb-4">
      <h2 className="text-xl font-bold text-gray-900 sm:text-lg">Recent Invoices</h2>
      <Link
        to="/invoices"
        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 sm:text-xs"
      >
        View all
        <ArrowUpRight className="h-4 w-4 sm:h-3 sm:w-3" />
      </Link>
    </div>
    <div className="space-y-4 sm:space-y-3">
      {recentInvoices.length > 0 ? (
        recentInvoices.map((invoice: Invoice) => (
          <div key={invoice.id} className="flex items-center justify-between p-4 sm:p-3 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl hover:from-indigo-50 hover:to-purple-50 transition-all">
            <div className="flex items-center gap-4 sm:gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-400 to-orange-400 rounded-xl flex items-center justify-center flex-shrink-0">
                <Receipt className="h-6 w-6 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 sm:text-sm truncate">{invoice.invoice_number}</p>
                <p className="text-sm text-gray-500 sm:text-xs truncate">{invoice.client?.name || 'No client'}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="text-sm font-semibold text-gray-900 sm:text-xs">
                {formatCurrency(invoice.base_amount || invoice.total, baseCurrency)}
              </p>
              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(invoice.status)} sm:text-[10px] sm:px-1.5 sm:py-0.5`}>
                {invoice.status}
              </span>
            </div>
          </div>
        ))
      ) : (
        <p className="text-center text-gray-500 py-8 sm:py-6 sm:text-sm">No invoices yet</p>
      )}
    </div>
  </div>
</div>

        

        {/* Monthly Performance and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Monthly Performance</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="month" stroke="#6B7280" fontSize={12} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={12} tickLine={false} tickFormatter={(value) => `${formatCurrency(value/1000)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="profit" 
                    fill="#4F46E5"
                    radius={[8, 8, 0, 0]}
                    name="Net Profit"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Activity Feed</h2>
              <Activity className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((transaction: any) => (
                  <div key={transaction.id} className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      transaction.type === 'income' 
                        ? 'bg-gradient-to-br from-emerald-100 to-emerald-200' 
                        : 'bg-gradient-to-br from-red-100 to-red-200'
                    }`}>
                      {transaction.type === 'income' ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-700" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{transaction.description}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500">
                          {format(parseISO(transaction.date), 'MMM dd, yyyy')}
                        </p>
                        <span className={`text-sm font-semibold ${
                          transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(transaction.base_amount || transaction.amount, baseCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* ADD THIS IMPORT MODAL */}
      {showImportWizard && (
        <AIImportWizard
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => {
            // Refresh the dashboard data after successful import
            window.location.reload(); // Simple refresh for now
          }}
        />
      )}
      {/* Context Collection Modal - UPDATE this */}

{showContextModal && subscription?.plan === 'plus' && (
  <ContextCollectionModal
    isOpen={showContextModal}
    onClose={() => {
      setShowContextModal(false);
      setNeedsContext(false);
      setMissingFields([]);
    }}
    missingFields={missingFields}
    onComplete={() => {
      // Close modal immediately
      setShowContextModal(false);
      setNeedsContext(false);
      setMissingFields([]);
      
      // Show loading and regenerate insights after a delay
      setLoadingInsights(true);
      setTimeout(async () => {
        try {
          const response = await AIInsightsService.regenerateInsights();
          setInsights(response.insights);
          setLastInsightUpdate(response.generated_at);
        } catch (error) {
          console.error('Error loading insights:', error);
        } finally {
          setLoadingInsights(false);
        }
      }, 1000);
    }}
  />
)}
    </div>
  );
};