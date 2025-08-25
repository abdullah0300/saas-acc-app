import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ExportService } from '../../services/exportService';
import { Crown } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { SkeletonReport } from '../Common/Loading';
import { useData } from '../../contexts/DataContext';

import { 
  ChevronRight,
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
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, eachMonthOfInterval, parseISO, isWithinInterval, differenceInDays } from 'date-fns';
import { supabase } from '../../services/supabaseClient';
import { InsightsEngine, Insight } from '../../services/insightsService';
import { InsightsPanel } from './InsightsPanel';
import { ExportDropdown } from './ExportDropdown';


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

interface VendorSpending {
  id: string;
  name: string;
  totalSpent: number;
  expenseCount: number;
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
  const { hasFeature, showAnticipationModal } = useSubscription();
const navigate = useNavigate();
  const { formatCurrency, baseCurrency } = useSettings();
  const { getProcessedReport, setProcessedReport } = useData();
  const [period, setPeriod] = useState('6months');
  const [compareMode, setCompareMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(true);
const [dismissedInsights, setDismissedInsights] = useState<string[]>(() => {
  // Load dismissed insights from localStorage on component mount
  const saved = localStorage.getItem('dismissedInsights');
  return saved ? JSON.parse(saved) : [];
});
const [showAllInsights, setShowAllInsights] = useState(false);
const { userSettings } = useSettings();

  // Data states
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<{ income: CategoryBreakdown[], expense: CategoryBreakdown[] }>({ income: [], expense: [] });
  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [clientMetrics, setClientMetrics] = useState<ClientMetrics[]>([]);
  const [kpiMetrics, setKpiMetrics] = useState({
  grossRevenue: 0,        // ADD THIS
  creditNoteAmount: 0,    // ADD THIS
  totalRevenue: 0,        // This becomes NET revenue
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
  const [categoryView, setCategoryView] = useState<'income' | 'expense'>('income');

 useEffect(() => {
  clearOldDismissedInsights();
  loadReportData();
}, [user, period]);

// Set the currency formatter for insights
useEffect(() => {
  InsightsEngine.setCurrencyFormatter(formatCurrency);
}, [formatCurrency]);

const [topVendors, setTopVendors] = useState<VendorSpending[]>([]);


  const loadReportData = async () => {
  if (!user) return;

  try {
    // Check cache first
    const cachedReport = getProcessedReport(period);
    if (cachedReport) {
      // Use cached data instantly
      setKpiMetrics(cachedReport.kpiMetrics);
      setMonthlyData(cachedReport.monthlyData);
      setCategoryData(cachedReport.categoryData);
      setCashFlowData(cachedReport.cashFlowData);
      setClientMetrics(cachedReport.clientMetrics);
      setTopVendors(cachedReport.topVendors);
      
      // Don't show loading for cached data
      return;
    }
    
    // If no cache, show loading
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

    // Call edge function instead of multiple queries
    const { data: reportData, error } = await supabase.functions.invoke('generate-report-data', {
      body: {
        userId: user.id,
        period,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        comparisonStartDate: format(comparisonStartDate, 'yyyy-MM-dd')
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    if (!reportData?.data) {
      throw new Error('No data returned from edge function');
    }

    // Set all state with processed data from edge function
    const { data } = reportData;
    
    // Cache the processed data
    setProcessedReport(period, data);
    
    // Set all state
    setKpiMetrics(data.kpiMetrics);
    setMonthlyData(data.monthlyData);
    setCategoryData(data.categoryData);
    setCashFlowData(data.cashFlowData);
    setClientMetrics(data.clientMetrics);
    setTopVendors(data.topVendors);

  } catch (err: any) {
    console.error('Error loading report data:', err);
  } finally {
    setLoading(false);
  }
};



  const handleDismissInsight = (insightId: string) => {
  const newDismissed = [...dismissedInsights, insightId];
  setDismissedInsights(newDismissed);
  setInsights(prev => prev.filter(insight => insight.id !== insightId));
  
  // Save to localStorage
  localStorage.setItem('dismissedInsights', JSON.stringify(newDismissed));
  
  // Optional: Clear old dismissed insights after 30 days
  const dismissalData = {
    insights: newDismissed,
    timestamp: new Date().toISOString()
  };
  localStorage.setItem('dismissedInsightsData', JSON.stringify(dismissalData));
};

const clearOldDismissedInsights = () => {
  const savedData = localStorage.getItem('dismissedInsightsData');
  if (savedData) {
    const { insights, timestamp } = JSON.parse(savedData);
    const daysSinceDismissal = differenceInDays(new Date(), new Date(timestamp));
    
    // Clear dismissed insights older than 30 days
    if (daysSinceDismissal > 30) {
      setDismissedInsights([]);
      localStorage.removeItem('dismissedInsights');
      localStorage.removeItem('dismissedInsightsData');
    }
  }
};

  const refreshData = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  const exportReport = async () => {
  if (!user) return;
  const dateRange = getDateRangeForPeriod();
  await ExportService.exportData('summary', user.id, { dateRange, baseCurrency });
};

const getDateRangeForPeriod = () => {
  const now = new Date();
  switch (period) {
    case '1month':
      return {
        start: format(subMonths(now, 30), 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd')
      };
    case '3months':
      return {
        start: format(subMonths(now, 90), 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd')
      };
    case '6months':
      return {
        start: format(subMonths(now, 180), 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd')
      };
    case '1year':
      return {
        start: format(subMonths(now, 365), 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd')
      };
    default:
      return {
        start: format(subMonths(now, 180), 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd')
      };
  }
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
  return <SkeletonReport />;
}

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100/80 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h1 className="text-lg font-medium text-gray-900">Financial Analytics</h1>
              <p className="text-sm text-gray-500 mt-0.5">Comprehensive insights into your business performance</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Period Selector */}
            <div className="flex items-center gap-1 bg-gray-50/80 rounded-xl p-1">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-3 py-1.5 text-sm font-medium bg-transparent border-none outline-none cursor-pointer text-gray-700 rounded-lg hover:bg-white/60"
              >
                <option value="1month">Last Month</option>
                <option value="3months">Last 3 Months</option>
                <option value="6months">Last 6 Months</option>
                <option value="1year">Last Year</option>
                <option value="ytd">Year to Date</option>
              </select>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={refreshData}
                disabled={refreshing}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={exportReport}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <Download className="w-3.5 h-3.5" />
                Export View
              </button>
              
              {/* Simple Advanced Export Button */}
              {user && (
                <ExportDropdown 
                  userId={user.id}
                  clients={clientMetrics}
                  currentPeriod={period}
                />
              )}
            </div>
          </div>
        </div>
      </div>

{/* Report Cards Section - Updated Styling */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* P&L Statement Card */}
  <div 
    onClick={() => {
      if (hasFeature('profit_loss_statements')) {
        navigate('/reports/profit-loss');
      } else {
        showAnticipationModal('feature', { 
          featureName: 'Profit & Loss Statements',
          fallbackPath: '/reports'
        });
      }
    }}
    className="group cursor-pointer p-4 rounded-xl bg-blue-50/40 border border-blue-100/60 hover:border-blue-200/80 hover:bg-blue-50/70 transition-all duration-300"
  >
    <div className="flex items-center justify-between mb-3">
      <div className="w-8 h-8 rounded-lg bg-blue-100/70 flex items-center justify-center">
        <TrendingUp className="w-4 h-4 text-blue-600" />
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" />
    </div>
    <h3 className="text-sm font-medium text-gray-900 mb-1">P&L Statement</h3>
    <p className="text-xs text-gray-500 leading-relaxed">Detailed profit and loss analysis</p>
  </div>

  {/* Cash Flow Card */}
  <div 
    onClick={() => {
      if (hasFeature('cash_flow_analysis')) {
        navigate('/reports/cash-flow');
      } else {
        showAnticipationModal('feature', { 
          featureName: 'Cash Flow Analysis',
          fallbackPath: '/reports'
        });
      }
    }}
    className="group cursor-pointer p-4 rounded-xl bg-emerald-50/40 border border-emerald-100/60 hover:border-emerald-200/80 hover:bg-emerald-50/70 transition-all duration-300"
  >
    <div className="flex items-center justify-between mb-3">
      <div className="w-8 h-8 rounded-lg bg-emerald-100/70 flex items-center justify-center">
        <DollarSign className="w-4 h-4 text-emerald-600" />
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-500 transition-colors" />
    </div>
    <h3 className="text-sm font-medium text-gray-900 mb-1">Cash Flow</h3>
    <p className="text-xs text-gray-500 leading-relaxed">Track money flow and forecasting</p>
  </div>

  {/* Tax Reports Card */}
  <div 
    onClick={() => {
      if (hasFeature('advanced_tax_reports')) {
        navigate('/reports/tax');
      } else {
        showAnticipationModal('feature', { 
          featureName: 'Advanced Tax Reports',
          fallbackPath: '/reports'
        });
      }
    }}
    className="group cursor-pointer p-4 rounded-xl bg-amber-50/40 border border-amber-100/60 hover:border-amber-200/80 hover:bg-amber-50/70 transition-all duration-300"
  >
    <div className="flex items-center justify-between mb-3">
      <div className="w-8 h-8 rounded-lg bg-amber-100/70 flex items-center justify-center">
        <Receipt className="w-4 h-4 text-amber-600" />
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-500 transition-colors" />
    </div>
    <h3 className="text-sm font-medium text-gray-900 mb-1">Tax Reports</h3>
    <p className="text-xs text-gray-500 leading-relaxed">Tax calculations and compliance</p>
  </div>

  {/* Client Profitability Card */}
  <div 
    onClick={() => {
      if (hasFeature('advanced_reports')) {
        navigate('/reports/client-profitability');
      } else {
        showAnticipationModal('feature', { 
          featureName: 'Client Profitability Analysis',
          fallbackPath: '/reports'
        });
      }
    }}
    className="group cursor-pointer p-4 rounded-xl bg-purple-50/40 border border-purple-100/60 hover:border-purple-200/80 hover:bg-purple-50/70 transition-all duration-300"
  >
    <div className="flex items-center justify-between mb-3">
      <div className="w-8 h-8 rounded-lg bg-purple-100/70 flex items-center justify-center">
        <Users className="w-4 h-4 text-purple-600" />
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-500 transition-colors" />
    </div>
    <h3 className="text-sm font-medium text-gray-900 mb-1">Client Profitability</h3>
    <p className="text-xs text-gray-500 leading-relaxed">Revenue analysis by client</p>
  </div>
  {/* VAT Report - Only show for applicable countries */}
{['GB', 'DE', 'FR', 'ES', 'IT', 'NL'].includes(userSettings?.country || '') && (
  <Link
    to="/reports/vat"
    className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
  >
    <div className="flex items-center justify-between mb-4">
      <FileText className="h-8 w-8 text-purple-600" />
      <span className="text-sm text-gray-500">Tax Report</span>
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      {userSettings?.country === 'GB' ? 'VAT Analysis Report' : 'Tax Report'}
    </h3>
    <p className="text-sm text-gray-600">
      View your tax summary, input/output breakdown, and prepare returns
    </p>
  </Link>
)}
</div>



        {/* KPI Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue Card */}
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
    
    {/* Add credit note breakdown if exists */}
    {kpiMetrics.creditNoteAmount > 0 && (
      <div className="mt-2 pt-2 border-t border-emerald-400/30">
        <div className="text-xs text-emerald-100 space-y-1">
          <div>Gross: {formatCurrency(kpiMetrics.grossRevenue)}</div>
          <div className="text-emerald-200">Credits: -{formatCurrency(kpiMetrics.creditNoteAmount)}</div>
        </div>
      </div>
    )}
    
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

        {/* Smart Insights Panel no need more we dump this  */}
        {/* <InsightsPanel 
          insights={insights} 
          onDismiss={handleDismissInsight}
          loading={loadingInsights}
        /> */}

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
<div className="bg-white rounded-2xl shadow-lg p-6 sm:p-4">
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-2 mb-6 sm:mb-4">
    <div>
      <h2 className="text-xl font-bold text-gray-900 sm:text-lg">Category Breakdown</h2>
      <p className="text-sm text-gray-600 mt-1 sm:text-xs">Where your money comes from and goes</p>
    </div>
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <button
        onClick={() => setCategoryView('income')}
        className={`text-sm px-4 py-2 rounded-lg font-medium transition-all flex-1 sm:flex-none sm:text-xs sm:px-3 sm:py-1.5 ${
          categoryView === 'income'
            ? 'bg-emerald-100 text-emerald-700 shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <div className="flex items-center justify-center gap-2 sm:gap-1">
          <TrendingUp className="h-4 w-4 sm:h-3 sm:w-3" />
          <span>Income</span>
        </div>
      </button>
      <button
        onClick={() => setCategoryView('expense')}
        className={`text-sm px-4 py-2 rounded-lg font-medium transition-all flex-1 sm:flex-none sm:text-xs sm:px-3 sm:py-1.5 ${
          categoryView === 'expense'
            ? 'bg-red-100 text-red-700 shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <div className="flex items-center justify-center gap-2 sm:gap-1">
          <TrendingDown className="h-4 w-4 sm:h-3 sm:w-3" />
          <span>Expenses</span>
        </div>
      </button>
    </div>
  </div>
  
  {/* Summary Stats */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3 mb-6 sm:mb-4">
    <div className={`p-4 sm:p-3 rounded-xl ${
      categoryView === 'income' 
        ? 'bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200' 
        : 'bg-gradient-to-br from-red-50 to-pink-50 border border-red-200'
    }`}>
      <p className={`text-sm font-medium sm:text-xs ${
        categoryView === 'income' ? 'text-emerald-700' : 'text-red-700'
      }`}>
        Total {categoryView === 'income' ? 'Income' : 'Expenses'}
      </p>
      <p className={`text-2xl font-bold mt-1 sm:text-xl ${
        categoryView === 'income' ? 'text-emerald-900' : 'text-red-900'
      }`}>
        {formatCurrency(
          categoryView === 'income'
            ? categoryData.income.reduce((sum, cat) => sum + cat.value, 0)
            : categoryData.expense.reduce((sum, cat) => sum + cat.value, 0)
        )}
      </p>
    </div>
    <div className="p-4 sm:p-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
      <p className="text-sm font-medium text-gray-700 sm:text-xs">Categories</p>
      <p className="text-2xl font-bold text-gray-900 mt-1 sm:text-xl">
        {categoryView === 'income' ? categoryData.income.length : categoryData.expense.length}
      </p>
    </div>
  </div>

  {/* Chart and Details Container */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-4">
    {/* Pie Chart */}
    <div className="h-64 sm:h-48 relative">
      {(categoryView === 'income' ? categoryData.income : categoryData.expense).length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryView === 'income' ? categoryData.income : categoryData.expense}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {(categoryView === 'income' ? categoryData.income : categoryData.expense)
                .map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={chartColors[index % chartColors.length]} 
                  />
                ))}
            </Pie>
            <Tooltip 
              formatter={(value: any) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <PieChartIcon className="h-10 w-10 sm:h-8 sm:w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 sm:text-sm">No {categoryView} data yet</p>
          </div>
        </div>
      )}
    </div>

    {/* Category List */}
    <div className="space-y-3 sm:space-y-2 max-h-64 sm:max-h-48 overflow-y-auto custom-scrollbar">
      {(categoryView === 'income' ? categoryData.income : categoryData.expense)
        .slice(0, 6)
        .map((category, index) => {
          const isPositiveTrend = category.trend > 0;
          return (
            <div
              key={category.name}
              className="flex items-center justify-between p-3 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 sm:gap-2 flex-1 min-w-0">
                <div
                  className="w-4 h-4 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: chartColors[index % chartColors.length] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate sm:text-sm">{category.name}</p>
                  <p className="text-xs text-gray-500 sm:text-[10px]">
                    {category.count} transaction{category.count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-2 flex-shrink-0">
                <div className="text-right">
                  <p className="font-semibold text-gray-900 sm:text-sm">
                    {formatCurrency(category.value)}
                  </p>
                  <p className="text-xs text-gray-600 sm:text-[10px]">
                    {category.percentage.toFixed(1)}%
                  </p>
                </div>
                {category.trend !== 0 && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium sm:text-[10px] sm:px-1.5 sm:py-0.5 ${
                    isPositiveTrend
                      ? categoryView === 'income' 
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                      : categoryView === 'income'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isPositiveTrend ? (
                      <ArrowUpRight className="h-3 w-3 sm:h-2 sm:w-2" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 sm:h-2 sm:w-2" />
                    )}
                    <span>{Math.abs(category.trend).toFixed(0)}%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      
      {(categoryView === 'income' ? categoryData.income : categoryData.expense).length > 6 && (
        <button className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium py-2 sm:text-xs sm:py-1">
          View all {(categoryView === 'income' ? categoryData.income : categoryData.expense).length} categories →
        </button>
      )}
    </div>
  </div>

  {/* Insights for categories */}
  {categoryView === 'expense' && categoryData.expense.length > 0 && (
    <div className="mt-6 sm:mt-4 p-4 sm:p-3 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="flex items-start gap-3 sm:gap-2">
        <AlertCircle className="h-5 w-5 sm:h-4 sm:w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900 sm:text-xs">
            Top spending category: {categoryData.expense[0].name}
          </p>
          <p className="text-sm text-amber-700 mt-1 sm:text-xs">
            Represents {categoryData.expense[0].percentage.toFixed(1)}% of total expenses. 
            {categoryData.expense[0].trend > 20 && ' Spending increased by ' + categoryData.expense[0].trend.toFixed(0) + '% from last period.'}
          </p>
        </div>
      </div>
    </div>
  )}
</div>
</div>
        {/* Cash Flow & Client Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-4">
  {/* Cash Flow Chart */}
  <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6 sm:p-4">
    <h2 className="text-xl font-bold text-gray-900 mb-6 sm:text-lg sm:mb-4">Cash Flow Analysis</h2>
    <div className="h-80 sm:h-64">
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
    
    <div className="mt-4 sm:mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-2">
      <div className="bg-gray-50 rounded-xl p-4 sm:p-3">
        <p className="text-sm text-gray-600 sm:text-xs">Current Balance</p>
        <p className="text-xl font-bold text-gray-900 sm:text-lg">
          {formatCurrency(cashFlowData[cashFlowData.length - 1]?.balance || 0)}
        </p>
      </div>
      <div className="bg-emerald-50 rounded-xl p-4 sm:p-3">
        <p className="text-sm text-emerald-600 sm:text-xs">Total Inflow</p>
        <p className="text-xl font-bold text-emerald-700 sm:text-lg">
          {formatCurrency(cashFlowData.reduce((sum, d) => sum + d.inflow, 0))}
        </p>
      </div>
      <div className="bg-red-50 rounded-xl p-4 sm:p-3">
        <p className="text-sm text-red-600 sm:text-xs">Total Outflow</p>
        <p className="text-xl font-bold text-red-700 sm:text-lg">
          {formatCurrency(cashFlowData.reduce((sum, d) => sum + d.outflow, 0))}
        </p>
      </div>
    </div>
  </div>

  {/* Top Clients */}
  <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-4">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-4 gap-2 sm:gap-0">
      <h2 className="text-xl font-bold text-gray-900 sm:text-lg">Top Clients</h2>
      <Link 
        to="/clients"
        className="text-sm text-indigo-600 hover:text-indigo-700 sm:text-xs"
      >
        View all →
      </Link>
    </div>
    
    <div className="space-y-4 sm:space-y-3">
      {clientMetrics.slice(0, 5).map((client, index) => (
        <div key={client.id} className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-2 flex-1 min-w-0">
            <div className={`w-10 h-10 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-xs flex-shrink-0`}
                 style={{ backgroundColor: chartColors[index % chartColors.length] }}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 sm:text-sm truncate">{client.name}</p>
              <p className="text-xs text-gray-500 sm:text-[10px]">{client.invoiceCount} invoices</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <p className="font-semibold text-gray-900 sm:text-sm">
              {formatCurrency(client.revenue)}
            </p>
            {client.outstandingAmount > 0 && (
              <p className="text-xs text-orange-600 sm:text-[10px]">
                {formatCurrency(client.outstandingAmount)} due
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
</div>

{/* Top Vendors */}
{topVendors.length > 0 && (
  <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 rounded-2xl shadow-lg p-6 sm:p-4 border border-purple-100">
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-4 gap-3 sm:gap-0">
    <div className="flex items-center gap-3 sm:gap-2">
      <div className="p-3 sm:p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
        <Briefcase className="h-6 w-6 sm:h-5 sm:w-5 text-white" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 sm:text-lg">Top Vendors</h2>
        <p className="text-sm text-gray-600 sm:text-xs">Highest spending by vendor</p>
      </div>
    </div>
    <Link 
      to="/vendors" 
      className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 transition-colors hover:bg-purple-50 px-3 py-1 rounded-lg sm:text-xs sm:px-2"
    >
      View all
      <ArrowRight className="h-4 w-4 sm:h-3 sm:w-3" />
    </Link>
  </div>
  
  <div className="space-y-3 sm:space-y-2">
    {topVendors.map((vendor, index) => {
      const progressWidth = (vendor.totalSpent / topVendors[0].totalSpent) * 100;
      const gradients = [
        'from-purple-500 to-purple-600',
        'from-indigo-500 to-indigo-600',
        'from-violet-500 to-violet-600',
        'from-blue-500 to-blue-600',
        'from-cyan-500 to-cyan-600'
      ];
      
      return (
        <div key={vendor.id} className="bg-white/70 backdrop-blur rounded-xl p-4 sm:p-3 relative overflow-hidden border border-purple-100/50 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3 sm:gap-2 flex-1 min-w-0">
              <div className={`w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${gradients[index]} flex items-center justify-center text-white font-bold text-sm sm:text-xs shadow-md flex-shrink-0`}>
                #{index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 sm:text-sm truncate">{vendor.name}</p>
                <p className="text-xs text-gray-600 sm:text-[10px]">{vendor.expenseCount} transactions</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="font-semibold text-gray-900 sm:text-sm">
                {formatCurrency(vendor.totalSpent)}
              </p>
              <p className="text-xs text-purple-600 font-medium sm:text-[10px]">
                {((vendor.totalSpent / topVendors.reduce((sum, v) => sum + v.totalSpent, 0)) * 100).toFixed(1)}% of total
              </p>
            </div>
          </div>
          
          {/* Background progress indicator */}
          <div 
            className={`absolute inset-0 bg-gradient-to-r ${gradients[index]} opacity-10`}
            style={{ width: `${progressWidth}%` }}
          ></div>
        </div>
      );
    })}
  </div>
  
  {/* Summary Stats */}
  <div className="mt-6 sm:mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-2">
    <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl p-3 sm:p-2 text-center border border-purple-200">
      <p className="text-xs text-purple-700 font-medium sm:text-[10px]">Total Vendors</p>
      <p className="text-xl font-bold text-purple-900 sm:text-lg">{topVendors.length}</p>
    </div>
    <div className="bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-xl p-3 sm:p-2 text-center border border-indigo-200">
      <p className="text-xs text-indigo-700 font-medium sm:text-[10px]">Total Spent</p>
      <p className="text-xl font-bold text-indigo-900 sm:text-lg">
        {formatCurrency(topVendors.reduce((sum, v) => sum + v.totalSpent, 0))}
      </p>
    </div>
    <div className="bg-gradient-to-br from-violet-100 to-violet-50 rounded-xl p-3 sm:p-2 text-center border border-violet-200">
      <p className="text-xs text-violet-700 font-medium sm:text-[10px]">Avg/Vendor</p>
      <p className="text-xl font-bold text-violet-900 sm:text-lg">
        {formatCurrency(topVendors.reduce((sum, v) => sum + v.totalSpent, 0) / topVendors.length)}
      </p>
    </div>
  </div>
  
  {/* Subtle decorative element */}
  <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-gradient-to-br from-purple-200/20 to-indigo-200/20 rounded-full blur-3xl sm:w-24 sm:h-24"></div>
</div>
)}


        {/* Credit Notes Card */}
  <div 
    onClick={() => navigate('/credit-notes')}
    className="group cursor-pointer p-4 rounded-xl bg-orange-50/40 border border-orange-100/60 hover:border-orange-200/80 hover:bg-orange-50/70 transition-all duration-300"
  >
    <div className="flex items-center justify-between mb-3">
      <div className="w-8 h-8 rounded-lg bg-orange-100/70 flex items-center justify-center">
        <CreditCard className="w-4 h-4 text-orange-600" />
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-500 transition-colors" />
    </div>
    <h3 className="text-sm font-medium text-gray-900 mb-1">Credit Notes</h3>
    <p className="text-xs text-gray-500 leading-relaxed">Manage returns & adjustments</p>
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