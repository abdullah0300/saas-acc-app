// src/components/Budget/BudgetPlanning.tsx
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Target, 
  TrendingUp, 
  PiggyBank, 
  AlertTriangle, 
  BarChart3, 
  DollarSign,
  Edit,
  Trash2,
  X,
  Calendar,
  Save
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useData } from '../../contexts/DataContext';
import { 
  createBudget, 
  updateBudget, 
  deleteBudget, 
  getIncomes, 
  getExpenses 
} from '../../services/database';

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
  const { formatCurrency, baseCurrency } = useSettings();
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
  }, [user, budgets]);

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
      const endDate = format(new Date(), 'yyyy-MM-dd');
      
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
        updateBudgetInCache(editingBudget.id, updatedBudget);
      } else {
        const newBudget = await createBudget(budgetData);
        addBudgetToCache(newBudget);
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
      removeBudgetFromCache(id);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Budget Planning
            </h1>
            <p className="text-gray-600 mt-2">Track and manage your financial goals</p>
          </div>
          
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
          >
            <Plus className="h-5 w-5" />
            Add Budget
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-blue-100/50 border border-white/60 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl shadow-lg">
                <Target className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Target
              </span>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Total Budgeted</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {formatCurrency(totalBudgeted)}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {budgetProgress.length} categories
            </p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-emerald-100/50 border border-white/60 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl shadow-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                {overallPercentage}%
              </span>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Actual Spending</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {formatCurrency(totalActual)}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {overallPercentage}% of budget
            </p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-purple-100/50 border border-white/60 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl shadow-lg">
                <PiggyBank className="h-6 w-6 text-white" />
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                totalRemaining >= 0 
                  ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
                  : 'text-red-600 bg-red-50 border-red-100'
              }`}>
                {totalRemaining >= 0 ? '✓' : '!'}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Remaining</p>
            <p className={`text-2xl sm:text-3xl font-bold ${totalRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(totalRemaining))}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {totalRemaining >= 0 ? 'Under budget' : 'Over budget'}
            </p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-orange-100/50 border border-white/60 p-6 transform hover:scale-105 transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl shadow-lg">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                Alert
              </span>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">At Risk</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {budgetProgress.filter(b => b.percentage >= 80).length}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Categories over 80%
            </p>
          </div>
        </div>

        {/* Budget Progress Visual */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-gray-100/50 border border-white/60 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Budget Progress Overview
            </h2>
          </div>
          
          {chartData.length > 0 && !chartError ? (
            <div className="space-y-6">
              {budgetProgress.map((item, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm sm:text-base font-semibold text-gray-800">{item.category}</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        item.percentage >= 90 ? 'bg-red-100 text-red-700 border border-red-200' :
                        item.percentage >= 70 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                        'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {item.percentage}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="hidden sm:inline">
                        {formatCurrency(item.actual)} / {formatCurrency(item.budgeted)}
                      </span>
                      <span className="sm:hidden">
                        {formatCurrency(item.actual)} / {formatCurrency(item.budgeted)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="relative w-full bg-gray-200 rounded-full h-4 sm:h-6 overflow-hidden shadow-inner">
                    <div
                      className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 sm:pr-3"
                      style={{
                        width: `${Math.min(item.percentage, 100)}%`,
                        background: `linear-gradient(90deg, ${getProgressColor(item.percentage)}, ${getProgressColor(item.percentage)}dd)`
                      }}
                    >
                      <span className="text-xs font-bold text-white drop-shadow-sm">
                        {item.percentage > 15 ? `${item.percentage}%` : ''}
                      </span>
                    </div>
                  </div>
                  
                  {item.percentage >= 90 && (
                    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200/50">
                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-red-700">
                        Budget limit {item.percentage > 100 ? 'exceeded' : 'approaching'}!
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 sm:py-16">
              <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-medium">No budget data to display</p>
              <p className="text-sm text-gray-400 mt-2">Add budgets to see your progress</p>
            </div>
          )}
        </div>

        {/* Budget Details */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-gray-100/50 border border-white/60">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Budget Details
              </h2>
            </div>
            
            <div className="space-y-4">
              {budgetProgress.length > 0 ? (
                budgetProgress.map((budget, index) => {
                  const correspondingBudget = budgets.find(b => b.category?.name === budget.category);
                  return (
                    <div key={index} className="p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200/50 hover:shadow-md transition-all duration-200">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">{budget.category}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              correspondingBudget?.period === 'yearly' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                              correspondingBudget?.period === 'quarterly' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                              'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                              {correspondingBudget?.period || 'monthly'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Budgeted:</span>
                              <p className="font-semibold text-gray-900">{formatCurrency(budget.budgeted)}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Actual:</span>
                              <p className="font-semibold text-gray-900">{formatCurrency(budget.actual)}</p>
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600 text-sm">Remaining:</span>
                            <p className={`font-bold ${budget.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency(Math.abs(budget.remaining))}
                            </p>
                          </div>
                        </div>
                        
                        {correspondingBudget && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(correspondingBudget)}
                              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                              title="Edit Budget"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(correspondingBudget.id)}
                              className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                              title="Delete Budget"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="relative w-full bg-gray-200 rounded-full h-3 mt-4 overflow-hidden shadow-inner">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(budget.percentage, 100)}%`,
                            backgroundColor: getProgressColor(budget.percentage)
                          }}
                        />
                      </div>
                      
                      {budget.percentage >= 90 && (
                        <div className="flex items-center gap-2 mt-3 p-2 bg-red-50 rounded-lg border border-red-200">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-700">
                            Budget limit {budget.percentage > 100 ? 'exceeded' : 'approaching'}!
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 sm:py-16">
                  <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <DollarSign className="h-10 w-10 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-lg font-medium">No budgets set yet</p>
                  <p className="text-sm text-gray-400 mt-2">Click "Add Budget" to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add/Edit Budget Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-white/60">
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {editingBudget ? 'Edit Budget' : 'Add New Budget'}
                  </h3>
                  <button
                    onClick={resetForm}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Category *
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-200/50 focus:border-indigo-400 transition-all duration-200 bg-white/80 backdrop-blur-sm"
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
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Budget Amount ({baseCurrency}) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                        {baseCurrency === 'USD' ? '$' : baseCurrency === 'EUR' ? '€' : baseCurrency}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-200/50 focus:border-indigo-400 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Period *
                    </label>
                    <select
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value as 'monthly' | 'quarterly' | 'yearly' })}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-200/50 focus:border-indigo-400 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Start Date *
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-indigo-200/50 focus:border-indigo-400 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
                    >
                      <Save className="h-4 w-4" />
                      {editingBudget ? 'Update Budget' : 'Create Budget'}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};