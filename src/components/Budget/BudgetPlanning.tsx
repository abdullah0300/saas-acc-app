import React, { useState, useEffect } from 'react';
import { 
  PiggyBank, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Target,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext'; // Added useSettings import
import { supabase } from '../../services/supabaseClient';
import { getIncomes, getExpenses, createBudget, updateBudget, deleteBudget } from '../../services/database';
import { useData } from '../../contexts/DataContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  category?: { name: string; type: string };
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  created_at: string;
}

interface BudgetProgress {
  category: string;
  budgeted: number;
  actual: number;
  remaining: number;
  percentage: number;
}

interface ChartDataItem {
  category: string;
  percentage: number;
  budgeted: number;
  actual: number;
}

// Safe number parser
const safeParseNumber = (value: any): number => {
  const parsed = Number(value);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
};

// Safe percentage calculator
const calculatePercentage = (actual: number, budgeted: number): number => {
  if (budgeted <= 0) return 0;
  const percentage = (actual / budgeted) * 100;
  return Math.min(100, Math.max(0, Math.round(percentage)));
};

export const BudgetPlanning: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings(); // Added useSettings hook
  const { businessData, businessDataLoading, addBudgetToCache, updateBudgetInCache, removeBudgetFromCache } = useData();
const { budgets, categories } = businessData;
const allCategories = [...categories.income, ...categories.expense];
const [budgetProgress, setBudgetProgress] = useState<BudgetProgress[]>([]);
const loading = businessDataLoading;
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [error, setError] = useState('');
  const [chartError, setChartError] = useState(false);
  
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    period: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    start_date: format(startOfMonth(new Date()), 'yyyy-MM-dd')
  });

  useEffect(() => {
  if (user && budgets.length >= 0) {
    loadBudgetProgress();
  }
}, [user, budgets]); // Now depends on cached budgets

  const loadBudgetProgress = async () => {
  if (!user || !budgets.length) {
    setBudgetProgress([]);
    return;
  }
  
  try {
    await calculateBudgetProgress(budgets);
  } catch (err: any) {
    console.error('Error calculating budget progress:', err);
    setError('Failed to calculate budget progress.');
    setBudgetProgress([]);
  }
};

  const calculateBudgetProgress = async (budgetList: Budget[]) => {
    if (!user || !budgetList || budgetList.length === 0) {
      setBudgetProgress([]);
      return;
    }
    
    try {
      const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      
      const [incomes, expenses] = await Promise.all([
        getIncomes(user.id, startDate, endDate),
        getExpenses(user.id, startDate, endDate)
      ]);
      
      const progress: BudgetProgress[] = [];
      
      for (const budget of budgetList) {
        if (!budget.category?.name) continue;
        
        let actualAmount = 0;
        
        if (budget.category.type === 'income') {
          actualAmount = incomes
            .filter(inc => inc.category_id === budget.category_id)
            .reduce((sum, inc) => sum + safeParseNumber(inc.amount), 0);
        } else {
          actualAmount = expenses
            .filter(exp => exp.category_id === budget.category_id)
            .reduce((sum, exp) => sum + safeParseNumber(exp.amount), 0);
        }
        
        const budgetAmount = safeParseNumber(budget.amount);
        const remaining = budgetAmount - actualAmount;
        const percentage = calculatePercentage(actualAmount, budgetAmount);
        
        progress.push({
          category: budget.category.name,
          budgeted: Math.round(budgetAmount),
          actual: Math.round(actualAmount),
          remaining: Math.round(remaining),
          percentage: percentage
        });
      }
      
      setBudgetProgress(progress);
    } catch (err) {
      console.error('Error calculating budget progress:', err);
      setBudgetProgress([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) return;
  
  const amount = safeParseNumber(formData.amount);
  if (amount <= 0) {
    alert('Please enter a valid budget amount greater than 0');
    return;
  }
  
  try {
    const budgetData = {
      user_id: user.id,
      category_id: formData.category_id,
      amount: amount,
      period: formData.period,
      start_date: formData.start_date
    };
    
    if (editingBudget) {
      const updatedBudget = await updateBudget(editingBudget.id, budgetData);
      updateBudgetInCache(editingBudget.id, updatedBudget); // ✅ Update cache
    } else {
      const newBudget = await createBudget(budgetData);
      addBudgetToCache(newBudget); // ✅ Add to cache
    }
    
    resetForm();
  } catch (err: any) {
    alert('Error saving budget: ' + err.message);
  }
};

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      category_id: budget.category_id,
      amount: budget.amount.toString(),
      period: budget.period,
      start_date: budget.start_date
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
  if (!window.confirm('Are you sure you want to delete this budget?')) return;
  
  try {
    await deleteBudget(id);
    removeBudgetFromCache(id); // ✅ Remove from cache
  } catch (err: any) {
    alert('Error deleting budget: ' + err.message);
  }
};

  const resetForm = () => {
    setFormData({
      category_id: '',
      amount: '',
      period: 'monthly',
      start_date: format(startOfMonth(new Date()), 'yyyy-MM-dd')
    });
    setEditingBudget(null);
    setShowAddForm(false);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return '#EF4444';
    if (percentage >= 70) return '#F59E0B';
    return '#10B981';
  };

  // Calculate totals
  const totalBudgeted = budgetProgress.reduce((sum, item) => sum + item.budgeted, 0);
  const totalActual = budgetProgress.reduce((sum, item) => sum + item.actual, 0);
  const totalRemaining = totalBudgeted - totalActual;
  const overallPercentage = calculatePercentage(totalActual, totalBudgeted);

  // Prepare chart data
  const getChartData = (): ChartDataItem[] => {
    try {
      return budgetProgress.map(item => ({
        category: item.category || 'Unknown',
        percentage: item.percentage,
        budgeted: item.budgeted,
        actual: item.actual
      }));
    } catch (err) {
      console.error('Error preparing chart data:', err);
      setChartError(true);
      return [];
    }
  };

  const chartData = getChartData();

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length && payload[0].payload) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded shadow-lg border">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-sm text-gray-600">
            Budget: {formatCurrency(data.budgeted || 0)}
          </p>
          <p className="text-sm text-gray-600">
            Actual: {formatCurrency(data.actual || 0)}
          </p>
          <p className="text-sm font-medium">
            Used: {data.percentage || 0}%
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={loadBudgetProgress}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Budget Planning</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Budget
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Total Budgeted</p>
            <Target className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalBudgeted)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {budgetProgress.length} categories
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Actual Spending</p>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalActual)}
          </p>
          <p className="text-sm text-gray-500">
            {overallPercentage}% of budget
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Remaining</p>
            <PiggyBank className="h-5 w-5 text-purple-600" />
          </div>
          <p className={`text-2xl font-bold ${totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(Math.abs(totalRemaining))}
          </p>
          <p className="text-sm text-gray-500">
            {totalRemaining >= 0 ? 'Under budget' : 'Over budget'}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">At Risk</p>
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {budgetProgress.filter(b => b.percentage >= 80).length}
          </p>
          <p className="text-sm text-gray-500">
            Categories over 80%
          </p>
        </div>
      </div>

      {/* Budget Progress Visual */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Progress Overview</h2>
        
        {chartData.length > 0 && !chartError ? (
          <div className="space-y-4">
            {/* Simple Progress Bars Instead of Chart */}
            {budgetProgress.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{item.category}</span>
                  <span className="text-sm text-gray-500">
                    {formatCurrency(item.actual)} / {formatCurrency(item.budgeted)}
                  </span>
                </div>
                <div className="relative w-full bg-gray-200 rounded-full h-8">
                  <div
                    className="absolute top-0 left-0 h-full rounded-full transition-all flex items-center justify-end pr-2"
                    style={{
                      width: `${Math.min(item.percentage, 100)}%`,
                      backgroundColor: getProgressColor(item.percentage)
                    }}
                  >
                    <span className="text-xs font-medium text-white">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No budget data to display</p>
            <p className="text-sm text-gray-400 mt-1">Add budgets to see your progress</p>
          </div>
        )}
      </div>

      {/* Budget Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Details</h2>
          <div className="space-y-4">
            {budgetProgress.length > 0 ? (
              budgetProgress.map((budget, index) => {
                const originalBudget = budgets.find(b => b.category?.name === budget.category);
                
                return (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{budget.category}</h3>
                        <p className="text-sm text-gray-500">
                          {originalBudget?.period || 'monthly'} budget
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {originalBudget && (
                          <>
                            <button
                              onClick={() => handleEdit(originalBudget)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(originalBudget.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                      <div>
                        <p className="text-gray-600">Budgeted</p>
                        <p className="font-semibold">{formatCurrency(budget.budgeted)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Spent</p>
                        <p className="font-semibold">{formatCurrency(budget.actual)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Remaining</p>
                        <p className={`font-semibold ${budget.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(budget.remaining))}
                        </p>
                      </div>
                    </div>
                    
                    <div className="relative w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="absolute top-0 left-0 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(budget.percentage, 100)}%`,
                          backgroundColor: getProgressColor(budget.percentage)
                        }}
                      />
                    </div>
                    
                    {budget.percentage >= 90 && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Budget limit {budget.percentage > 100 ? 'exceeded' : 'approaching'}!</span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No budgets set yet</p>
                <p className="text-sm text-gray-400 mt-1">Click "Add Budget" to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Budget Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              {editingBudget ? 'Edit Budget' : 'Add New Budget'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
  value={formData.category_id}
  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
  required
  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="">Select category</option>
  {allCategories.map(category => (
    <option key={category.id} value={category.id}>
      {category.name} ({category.type})
    </option>
  ))}
</select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget Amount ({baseCurrency}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {baseCurrency === 'USD' ? '$' : baseCurrency === 'EUR' ? '€' : baseCurrency}
                  </span>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    min="0.01"
                    step="0.01"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Period
                </label>
                <select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingBudget ? 'Update' : 'Add'} Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};