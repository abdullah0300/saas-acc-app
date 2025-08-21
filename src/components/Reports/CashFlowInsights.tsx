// src/components/Reports/CashFlowInsights.tsx
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  DollarSign,
  Calendar,
  Clock,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  PieChart,
  Target,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart as RePieChart,
  Pie,
  Legend
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getInvoices, getIncomes, getExpenses, getCreditNotes } from '../../services/database';
import { format, addDays, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';

interface ReceivableAging {
  range: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
}

interface CashForecast {
  date: string;
  projected: number;
  optimistic: number;
  pessimistic: number;
  confirmed: number;
}

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  amount: number;
  days_overdue: number;
  due_date: string;
}

export const CashFlowInsights: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [receivablesAging, setReceivablesAging] = useState<ReceivableAging[]>([]);
  const [cashForecast, setCashForecast] = useState<CashForecast[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [metrics, setMetrics] = useState({
    totalReceivables: 0,
    overdueAmount: 0,
    averageDaysToPayment: 0,
    cashIn30Days: 0,
    expectedInflowThisMonth: 0,
    expectedOutflowThisMonth: 0,
    projectedBalance30Days: 0
  });

  useEffect(() => {
    if (user) {
      loadCashFlowData();
    }
  }, [user]);

  const loadCashFlowData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load all necessary data
      const [invoices, incomes, expenses, creditNotes] = await Promise.all([
        getInvoices(user.id),
        getIncomes(user.id),
        getExpenses(user.id),
        getCreditNotes(user.id)
      ]);
      
      // Process receivables aging
      processReceivablesAging(invoices);
      
      // Generate cash forecast
      generateCashForecast(invoices, incomes, expenses);
      
      // Process overdue invoices
      processOverdueInvoices(invoices);
      
      // Calculate metrics
      calculateMetrics(invoices, incomes, expenses);
      
    } catch (error) {
      console.error('Error loading cash flow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processReceivablesAging = (invoices: any[]) => {
    const unpaidInvoices = invoices.filter(inv => 
      inv.status === 'sent' || inv.status === 'overdue'
    );
    
    const agingBuckets = [
      { range: '0-30 days', min: 0, max: 30, color: '#10B981' },
      { range: '31-60 days', min: 31, max: 60, color: '#F59E0B' },
      { range: '61-90 days', min: 61, max: 90, color: '#EF4444' },
      { range: '90+ days', min: 91, max: Infinity, color: '#991B1B' }
    ];
    
    const aging = agingBuckets.map(bucket => {
      const invoicesInBucket = unpaidInvoices.filter(inv => {
        const daysSinceDue = differenceInDays(new Date(), new Date(inv.due_date));
        return daysSinceDue >= bucket.min && daysSinceDue <= bucket.max;
      });
      
      const amount = invoicesInBucket.reduce((sum, inv) => sum + (inv.base_amount || inv.total), 0);
      
      return {
        range: bucket.range,
        amount,
        count: invoicesInBucket.length,
        percentage: 0, // Will calculate after
        color: bucket.color
      };
    });
    
    const totalAmount = aging.reduce((sum, bucket) => sum + bucket.amount, 0);
    
    // Calculate percentages
    aging.forEach(bucket => {
      bucket.percentage = totalAmount > 0 ? (bucket.amount / totalAmount) * 100 : 0;
    });
    
    setReceivablesAging(aging);
  };

  const generateCashForecast = (invoices: any[], incomes: any[], expenses: any[]) => {
    const forecast: CashForecast[] = [];
    const today = new Date();
    
    // Get current balance (sum of all past incomes minus expenses)
   const currentBalance = incomes
  .filter(inc => new Date(inc.date) <= today)
  .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0) -
  expenses
    .filter(exp => new Date(exp.date) <= today)
    .reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);
    
    // Generate 30-day forecast
    for (let i = 0; i < 30; i++) {
      const forecastDate = addDays(today, i);
      const dateStr = format(forecastDate, 'yyyy-MM-dd');
      
      // Get confirmed income for this date (paid invoices)
      const confirmedIncome = incomes
      .filter(inc => inc.date === dateStr)
      .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);
      
      // Get expected income from unpaid invoices due on this date
      const expectedIncome = invoices
      .filter(inv => inv.due_date === dateStr && inv.status !== 'paid')
      .reduce((sum, inv) => sum + (inv.base_amount || inv.total), 0);
      
      // Estimate daily expenses based on last 30 days average
      const last30DaysExpenses = expenses
        .filter(exp => {
          const expDate = new Date(exp.date);
          return expDate >= addDays(today, -30) && expDate <= today;
        })
        .reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);
      
      const dailyExpenseAvg = last30DaysExpenses / 30;
      
      // Calculate projections
      const projected = expectedIncome - dailyExpenseAvg;
      const optimistic = expectedIncome * 1.2 - dailyExpenseAvg * 0.8; // 20% more income, 20% less expenses
      const pessimistic = expectedIncome * 0.5 - dailyExpenseAvg * 1.2; // 50% of income, 20% more expenses
      
      forecast.push({
        date: dateStr,
        projected: currentBalance + projected * (i + 1),
        optimistic: currentBalance + optimistic * (i + 1),
        pessimistic: currentBalance + pessimistic * (i + 1),
        confirmed: confirmedIncome
      });
    }
    
    setCashForecast(forecast);
  };

  const processOverdueInvoices = (invoices: any[]) => {
    const today = new Date();
    
    const overdue = invoices
      .filter(inv => {
        const dueDate = new Date(inv.due_date);
        return inv.status !== 'paid' && dueDate < today;
      })
      .map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        client_name: inv.client?.name || 'Unknown Client',
        amount: inv.base_amount || inv.total,
        days_overdue: differenceInDays(today, new Date(inv.due_date)),
        due_date: inv.due_date
      }))
      .sort((a, b) => b.days_overdue - a.days_overdue)
      .slice(0, 5); // Top 5 most overdue
    
    setOverdueInvoices(overdue);
  };

  const calculateMetrics = (invoices: any[], incomes: any[], expenses: any[]) => {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    
    // Total receivables
    // Calculate receivables accounting for credit notes
    const totalReceivables = invoices
      .filter(inv => inv.status !== 'paid' && inv.status !== 'canceled')
      .reduce((sum, inv) => {
        const invoiceTotal = inv.base_amount || inv.total;
        const creditedAmount = inv.total_credited || 0;
        return sum + Math.max(0, invoiceTotal - creditedAmount);
      }, 0);
    
    // Overdue amount
    const overdueAmount = invoices
      .filter(inv => {
        const dueDate = new Date(inv.due_date);
        return inv.status !== 'paid' && dueDate < today;
      })
      .reduce((sum, inv) => sum + (inv.base_amount || inv.total), 0);
    
    // Average days to payment
    const paidInvoices = invoices.filter(inv => inv.status === 'paid' && inv.paid_date);
    const avgDaysToPayment = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, inv) => {
          const days = differenceInDays(new Date(inv.paid_date!), new Date(inv.date));
          return sum + days;
        }, 0) / paidInvoices.length
      : 0;
    
    // Expected cash in next 30 days
    const cashIn30Days = invoices
      .filter(inv => {
        const dueDate = new Date(inv.due_date);
        return inv.status !== 'paid' && dueDate <= thirtyDaysFromNow;
      })
      .reduce((sum, inv) => sum + (inv.base_amount || inv.total), 0);
    
    // Expected inflow this month
      const expectedInflowThisMonth = invoices
        .filter(inv => {
          const dueDate = new Date(inv.due_date);
          return inv.status !== 'paid' && dueDate >= monthStart && dueDate <= monthEnd;
        })
        .reduce((sum, inv) => sum + (inv.base_amount || inv.total), 0);
    
    // Expected outflow this month (based on average)
        const lastMonthExpenses = expenses
        .filter(exp => {
          const expDate = new Date(exp.date);
          return expDate >= addDays(monthStart, -30) && expDate < monthStart;
        })
        .reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);
    
    const expectedOutflowThisMonth = lastMonthExpenses;
    
    // Current balance
    const currentBalance = incomes
      .filter(inc => new Date(inc.date) <= today)
      .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0) -
      expenses
        .filter(exp => new Date(exp.date) <= today)
        .reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);
    
    // Projected balance in 30 days
    const projectedBalance30Days = currentBalance + cashIn30Days - (expectedOutflowThisMonth / 30 * 30);
    
    setMetrics({
      totalReceivables,
      overdueAmount,
      averageDaysToPayment: avgDaysToPayment,
      cashIn30Days,
      expectedInflowThisMonth,
      expectedOutflowThisMonth,
      projectedBalance30Days
    });
  };

  const getHealthStatus = () => {
    const overduePercentage = metrics.totalReceivables > 0 
      ? (metrics.overdueAmount / metrics.totalReceivables) * 100 
      : 0;
    
    if (overduePercentage > 30) return { status: 'critical', color: 'text-red-600', icon: XCircle };
    if (overduePercentage > 15) return { status: 'warning', color: 'text-yellow-600', icon: AlertCircle };
    return { status: 'healthy', color: 'text-green-600', icon: CheckCircle };
  };

  const healthStatus = getHealthStatus();
  const HealthIcon = healthStatus.icon;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Health Status */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Cash Flow Insights</h2>
          <div className={`flex items-center ${healthStatus.color}`}>
            <HealthIcon className="h-5 w-5 mr-2" />
            <span className="font-medium capitalize">
              Cash Flow {healthStatus.status}
            </span>
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <span className="text-xs text-blue-600 font-medium">Receivables</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">
             {formatCurrency(metrics.totalReceivables, baseCurrency)}
            </p>
            <p className="text-xs text-blue-600 mt-1">Outstanding invoices</p>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-xs text-red-600 font-medium">Overdue</span>
            </div>
            <p className="text-2xl font-bold text-red-700">
              {formatCurrency(metrics.overdueAmount, baseCurrency)}
            </p>
            <p className="text-xs text-red-600 mt-1">
              {metrics.totalReceivables > 0 
                ? `${((metrics.overdueAmount / metrics.totalReceivables) * 100).toFixed(0)}% of receivables`
                : 'No receivables'}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-xs text-green-600 font-medium">30-Day Forecast</span>
            </div>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(metrics.projectedBalance30Days, baseCurrency)}
            </p>
            <p className="text-xs text-green-600 mt-1">Projected balance</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <span className="text-xs text-purple-600 font-medium">Avg Payment</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">
              {Math.round(metrics.averageDaysToPayment)} days
            </p>
            <p className="text-xs text-purple-600 mt-1">Time to collect</p>
          </div>
        </div>
      </div>

      {/* Receivables Aging Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Receivables Aging</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={receivablesAging}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value, baseCurrency)}
                  labelFormatter={(label) => `Age: ${label}`}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {receivablesAging.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Aging Summary */}
          <div className="space-y-3">
            {receivablesAging.map((bucket) => (
              <div key={bucket.range} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: bucket.color }}
                  />
                  <div>
                    <p className="font-medium text-gray-900">{bucket.range}</p>
                    <p className="text-sm text-gray-500">{bucket.count} invoices</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{formatCurrency(bucket.amount, baseCurrency)}</p>
                  <p className="text-sm text-gray-500">{bucket.percentage.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 30-Day Cash Forecast */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">30-Day Cash Flow Forecast</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cashForecast}>
              <defs>
                <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorOptimistic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorPessimistic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => format(new Date(date), 'MMM dd')}
              />
              <YAxis 
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                formatter={(value: any) => formatCurrency(value, baseCurrency)}
              />
              <Area
                type="monotone"
                dataKey="optimistic"
                stroke="#10B981"
                fill="url(#colorOptimistic)"
                strokeWidth={1}
                strokeDasharray="5 5"
                name="Best Case"
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="#3B82F6"
                fill="url(#colorProjected)"
                strokeWidth={2}
                name="Expected"
              />
              <Area
                type="monotone"
                dataKey="pessimistic"
                stroke="#EF4444"
                fill="url(#colorPessimistic)"
                strokeWidth={1}
                strokeDasharray="5 5"
                name="Worst Case"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Forecast Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Expected in 30 days</span>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(metrics.cashIn30Days, baseCurrency)}
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Monthly Inflow</span>
              <ArrowDown className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(metrics.expectedInflowThisMonth, baseCurrency)}
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Monthly Outflow</span>
              <ArrowUp className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">
             {formatCurrency(metrics.expectedOutflowThisMonth, baseCurrency)}
            </p>
          </div>
        </div>
      </div>

      {/* Overdue Invoices Alert */}
      {overdueInvoices.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 mb-3">
                Action Required: Overdue Invoices
              </h3>
              <div className="space-y-2">
                {overdueInvoices.map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {invoice.invoice_number} - {invoice.client_name}
                      </p>
                      <p className="text-sm text-red-600">
                        {invoice.days_overdue} days overdue (Due: {format(new Date(invoice.due_date), 'MMM dd, yyyy')})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatCurrency(invoice.amount, baseCurrency)}</p>
                      <a 
                        href={`/invoices/${invoice.id}/view`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        View Invoice →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};