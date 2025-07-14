// src/components/Dashboard/DashboardMobile.tsx - Optimized Light & Elegant Version
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useData } from '../../contexts/DataContext';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { Income, Expense, Invoice, Client } from '../../types';

export const DashboardMobile: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, loading: settingsLoading } = useSettings();
  const { limits, usage } = useSubscription();
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
      ...currentMonthIncomes.slice(0, 8).map(income => ({ ...income, type: 'income' })),
      ...currentMonthExpenses.slice(0, 7).map(expense => ({ ...expense, type: 'expense' }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15)
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

  const growth = calculateGrowth();

  if (loading || settingsLoading) {
    return (
      <div className="px-4 pt-4">
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="h-20 bg-gray-200 rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Enhanced Net Profit & Pending Invoice Section */}
      <div className="px-4 -mt-3 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Net Profit - Enhanced */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-100 to-green-200 rounded-2xl mb-3 shadow-sm">
                <DollarSign className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats?.netProfit || 0)}
                </p>
                <p className="text-sm text-gray-500 font-medium">Net Profit</p>
                <div className="flex items-center justify-center space-x-1">
                  {growth.profit >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={`text-xs font-semibold ${growth.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {growth.profit >= 0 ? '+' : ''}{growth.profit.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Pending Invoices - Enhanced */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-2xl mb-3 shadow-sm">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.pendingInvoices || 0}
                </p>
                <p className="text-sm text-gray-500 font-medium">Pending</p>
                <div className="flex items-center justify-center">
                  <span className="text-xs text-gray-600 font-medium">
                    {formatCurrency(stats?.totalPending || 0)}
                  </span>
                </div>
                {stats?.overdueInvoices > 0 && (
                  <div className="inline-flex items-center px-2 py-1 bg-red-100 rounded-full">
                    <span className="text-xs text-red-700 font-semibold">
                      {stats.overdueInvoices} overdue
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick Actions - Simplified */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/income/new"
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white py-3 px-4 rounded-2xl font-medium shadow-md active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">Add Income</span>
            </Link>
            <Link
              to="/expenses/new"
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white py-3 px-4 rounded-2xl font-medium shadow-md active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">Add Expense</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Light Financial Overview Cards */}
      <div className="px-4 mt-6 space-y-5">
        {/* Income & Expense Combined Card - Light Version */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl shadow-lg p-6 border border-blue-200/50">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-gray-800">Monthly Overview</h3>
            <span className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-gray-600 border border-white/50">
              {format(new Date(), 'MMM yyyy')}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-white/60 rounded-xl shadow-sm">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-sm text-gray-700 font-medium">Income</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{formatCurrency(stats?.totalIncome || 0)}</p>
              <p className="text-xs text-gray-600">
                {growth.income > 0 ? '+' : ''}{growth.income.toFixed(1)}% vs last month
              </p>
            </div>
            
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-white/60 rounded-xl shadow-sm">
                  <TrendingDown className="h-5 w-5 text-rose-600" />
                </div>
                <span className="text-sm text-gray-700 font-medium">Expenses</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{formatCurrency(stats?.totalExpenses || 0)}</p>
              <p className="text-xs text-gray-600">
                {stats?.totalIncome > 0 ? `${((stats.totalExpenses / stats.totalIncome) * 100).toFixed(1)}%` : '0%'} of income
              </p>
            </div>
          </div>
        </div>

        {/* 15 Recent Transactions */}
        <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-gray-800">Recent Transactions</h3>
            <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold text-gray-600">
              Last {stats.recentTransactions.length}
            </span>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {stats.recentTransactions.length > 0 ? (
              stats.recentTransactions.map((transaction: any) => (
                <div key={transaction.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                  <div className={`p-2.5 rounded-xl shadow-sm ${
                    transaction.type === 'income' 
                      ? 'bg-gradient-to-br from-emerald-100 to-green-200' 
                      : 'bg-gradient-to-br from-rose-100 to-pink-200'
                  }`}>
                    {transaction.type === 'income' ? (
                      <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-rose-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(parseISO(transaction.date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${
                      transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </span>
                    {transaction.category && (
                      <p className="text-xs text-gray-500 truncate max-w-20">
                        {transaction.category.name}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No transactions yet</p>
                <p className="text-sm text-gray-400 mt-1">Start by adding your first income or expense</p>
              </div>
            )}
          </div>
          
          {stats.recentTransactions.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <Link 
                to="/dashboard" 
                className="block text-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                View All Transactions →
              </Link>
            </div>
          )}
        </div>

        {/* Monthly Performance Chart - Light Version */}
        <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-3xl shadow-lg p-6 border border-gray-200/50">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Monthly Trend</h3>
              <p className="text-sm text-gray-600">Last 6 months performance</p>
            </div>
            <div className="p-2 bg-white/80 rounded-xl shadow-sm">
              <Activity className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          
          <div className="h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="lightProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fill="url(#lightProfit)"
                />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#6b7280' }} 
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    fontSize: '14px'
                  }}
                  formatter={(value: any) => [formatCurrency(value), 'Profit']}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="text-center bg-white/60 rounded-2xl p-4">
            <p className="text-sm text-gray-700">
              {growth.profit >= 0 ? '📈' : '📉'} 
              {growth.profit >= 0 ? ' Growing ' : ' Declining '}
              <span className="font-bold text-gray-800">{Math.abs(growth.profit).toFixed(1)}%</span> this month
            </p>
          </div>
        </div>

        {/* Bottom Spacing for Navigation */}
        <div className="h-6"></div>
      </div>
    </div>
  );
};