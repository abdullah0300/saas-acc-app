import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  FileText,
  Download,
  Filter
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
  ResponsiveContainer 
} from 'recharts';
import { getIncomes, getExpenses, getInvoices } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export const ReportsOverview: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState('6months');
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [totals, setTotals] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    invoicesPaid: 0,
    invoicesPending: 0
  });

  useEffect(() => {
    loadReportData();
  }, [user, period]);

  const loadReportData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Calculate date range based on period
      const endDate = new Date();
      let startDate;
      
      switch (period) {
        case '1month':
          startDate = subMonths(endDate, 1);
          break;
        case '3months':
          startDate = subMonths(endDate, 3);
          break;
        case '6months':
          startDate = subMonths(endDate, 6);
          break;
        case '1year':
          startDate = subMonths(endDate, 12);
          break;
        default:
          startDate = subMonths(endDate, 6);
      }

      // Fetch data
      const [incomes, expenses, invoices] = await Promise.all([
        getIncomes(user.id, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')),
        getExpenses(user.id, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')),
        getInvoices(user.id)
      ]);

      // Process monthly data
      const monthlyMap = new Map();
      
      // Initialize months
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const monthKey = format(currentDate, 'yyyy-MM');
        monthlyMap.set(monthKey, {
          month: format(currentDate, 'MMM yyyy'),
          income: 0,
          expenses: 0,
          profit: 0
        });
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      }

      // Aggregate income
      incomes.forEach(income => {
        const monthKey = format(new Date(income.date), 'yyyy-MM');
        if (monthlyMap.has(monthKey)) {
          monthlyMap.get(monthKey).income += income.amount;
        }
      });

      // Aggregate expenses
      expenses.forEach(expense => {
        const monthKey = format(new Date(expense.date), 'yyyy-MM');
        if (monthlyMap.has(monthKey)) {
          monthlyMap.get(monthKey).expenses += expense.amount;
        }
      });

      // Calculate profit
      monthlyMap.forEach(data => {
        data.profit = data.income - data.expenses;
      });

      setMonthlyData(Array.from(monthlyMap.values()));

      // Process category data
      const incomeByCategory = new Map();
      const expenseByCategory = new Map();

      incomes.forEach(income => {
        const category = income.category?.name || 'Uncategorized';
        incomeByCategory.set(category, (incomeByCategory.get(category) || 0) + income.amount);
      });

      expenses.forEach(expense => {
        const category = expense.category?.name || 'Uncategorized';
        expenseByCategory.set(category, (expenseByCategory.get(category) || 0) + expense.amount);
      });

      const incomeCategoryData = Array.from(incomeByCategory.entries()).map(([name, value]) => ({
        name,
        value,
        type: 'income'
      }));

      const expenseCategoryData = Array.from(expenseByCategory.entries()).map(([name, value]) => ({
        name,
        value,
        type: 'expense'
      }));

      setCategoryData([...incomeCategoryData, ...expenseCategoryData]);

      // Calculate totals
      const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
      const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
      const invoicesPaid = invoices.filter(inv => inv.status === 'paid').length;
      const invoicesPending = invoices.filter(inv => 
        inv.status === 'sent' || inv.status === 'overdue'
      ).length;

      setTotals({
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        invoicesPaid,
        invoicesPending
      });

    } catch (err: any) {
      console.error('Error loading report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <div className="flex items-center space-x-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1month">Last Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="1year">Last Year</option>
          </select>
          <Link
            to="/reports/profit-loss"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            P&L Report
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-green-600">
                ${totals.totalIncome.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                ${totals.totalExpenses.toFixed(2)}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Net Profit</p>
              <p className={`text-2xl font-bold ${totals.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${totals.netProfit.toFixed(2)}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paid Invoices</p>
              <p className="text-2xl font-bold text-gray-900">
                {totals.invoicesPaid}
              </p>
            </div>
            <FileText className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Invoices</p>
              <p className="text-2xl font-bold text-gray-900">
                {totals.invoicesPending}
              </p>
            </div>
            <FileText className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Income vs Expenses</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#10B981" 
                  name="Income"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#EF4444" 
                  name="Expenses"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit Trend Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profit Trend</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar 
                  dataKey="profit" 
                  fill="#3B82F6"
                  name="Net Profit"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income by Category */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Income by Category</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData.filter(c => c.type === 'income')}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData
                    .filter(c => c.type === 'income')
                    .map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData.filter(c => c.type === 'expense')}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData
                    .filter(c => c.type === 'expense')
                    .map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};