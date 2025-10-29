import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Calendar,
  Users,
  Edit,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getProject, getProjectTransactions, updateProject, type Project } from '../../services/database';
import { ProjectMilestones } from './ProjectMilestones';
import { ProjectGoals } from './ProjectGoals';
import { ProjectTimeTracking } from './ProjectTimeTracking';
import { ProjectFiles } from './ProjectFiles';
import { ProjectNotes } from './ProjectNotes';

type TabType = 'overview' | 'milestones' | 'goals' | 'time' | 'files' | 'notes' | 'income' | 'expenses' | 'invoices';

// Budget Progress Component
const BudgetProgress: React.FC<{
  project: Project;
  stats: any;
  baseCurrency: string;
  exchangeRates: any;
  formatCurrency: (amount: number, currency: string) => string;
}> = ({ project, stats, baseCurrency, exchangeRates, formatCurrency }) => {
  // Convert budget to base currency for proper comparison
  const budgetCurrency = project.budget_currency || baseCurrency;
  const budgetAmount = project.budget_amount || 0;
  let budgetInBaseCurrency = budgetAmount;

  if (budgetCurrency !== baseCurrency && exchangeRates?.[budgetCurrency]) {
    // Convert budget from its currency to base currency
    budgetInBaseCurrency = budgetAmount / exchangeRates[budgetCurrency];
  }

  const percentageUsed = budgetInBaseCurrency > 0 ? (stats.total_expenses / budgetInBaseCurrency) * 100 : 0;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Usage</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Expenses</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(stats.total_expenses, baseCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Budget</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(budgetAmount, budgetCurrency)}
          </span>
        </div>
        {budgetCurrency !== baseCurrency && (
          <div className="text-xs text-gray-500 text-right">
            ({percentageUsed.toFixed(1)}% used)
          </div>
        )}
        <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              percentageUsed > 90
                ? 'bg-gradient-to-r from-red-500 to-red-600'
                : percentageUsed > 75
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                : 'bg-gradient-to-r from-green-500 to-emerald-600'
            }`}
            style={{
              width: `${Math.min(100, percentageUsed)}%`
            }}
          />
        </div>
        {percentageUsed > 90 && (
          <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-800">Budget limit exceeded or nearly reached</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency, baseCurrency, exchangeRates } = useSettings();

  const [project, setProject] = useState<Project | null>(null);
  const [transactions, setTransactions] = useState<{
    incomes: any[];
    expenses: any[];
    invoices: any[];
  }>({ incomes: [], expenses: [], invoices: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProjectData();
    }
  }, [projectId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (statusDropdownOpen) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [statusDropdownOpen]);

  const loadProjectData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const [projectData, transactionsData] = await Promise.all([
        getProject(projectId),
        getProjectTransactions(projectId)
      ]);
      setProject(projectData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'completed' | 'on_hold' | 'cancelled') => {
    if (!projectId) return;

    try {
      await updateProject(projectId, { status: newStatus });
      setStatusDropdownOpen(false);
      await loadProjectData();
    } catch (error) {
      console.error('Error updating project status:', error);
      alert('Failed to update project status');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'from-green-500 to-emerald-600',
      completed: 'from-blue-500 to-indigo-600',
      on_hold: 'from-yellow-500 to-orange-600',
      cancelled: 'from-gray-500 to-slate-600'
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  const getStatusBadgeColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      on_hold: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  const getProfitColor = (margin: number) => {
    if (margin >= 50) return 'text-green-600';
    if (margin >= 25) return 'text-blue-600';
    if (margin >= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Project not found</h3>
            <p className="text-gray-500 mb-6">The project you're looking for doesn't exist</p>
            <button
              onClick={() => navigate('/projects')}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Projects
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stats = project.stats || {
    total_income: 0,
    total_expenses: 0,
    profit: 0,
    profit_margin_percentage: 0,
    invoice_total: 0,
    income_count: 0,
    expense_count: 0,
    invoice_count: 0,
    paid_invoice_count: 0
  };

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'milestones', label: 'Milestones' },
    { id: 'goals', label: 'Goals' },
    { id: 'time', label: 'Time Tracking' },
    { id: 'files', label: 'Files' },
    { id: 'notes', label: 'Activity Log' },
    { id: 'income', label: 'Income', count: transactions.incomes.length },
    { id: 'expenses', label: 'Expenses', count: transactions.expenses.length },
    { id: 'invoices', label: 'Invoices', count: transactions.invoices.length }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Project Header with Gradient */}
          <div
            className={`p-8 bg-gradient-to-r ${getStatusColor(project.status)} text-white relative overflow-hidden`}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-2xl"></div>
            </div>

            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <button
                  onClick={() => navigate('/projects')}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors mr-4"
                >
                  <ArrowLeft className="h-6 w-6 text-white" />
                </button>

                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
                  {project.client && (
                    <div className="flex items-center gap-2 text-white/90">
                      <Users className="h-5 w-5" />
                      <span className="text-lg">{project.client.name}</span>
                    </div>
                  )}
                  {project.description && (
                    <p className="text-white/80 mt-2">{project.description}</p>
                  )}
                  {(project.start_date || project.end_date) && (
                    <div className="flex items-center gap-2 text-white/80 mt-3">
                      <Calendar className="h-5 w-5" />
                      <span>
                        {project.start_date && new Date(project.start_date).toLocaleDateString()}
                        {project.start_date && project.end_date && ' - '}
                        {project.end_date && new Date(project.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusDropdownOpen(!statusDropdownOpen);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${getStatusBadgeColor(project.status)} hover:opacity-80 transition-opacity`}
                    >
                      {project.status.replace('_', ' ')}
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    {statusDropdownOpen && (
                      <div
                        className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(['active', 'completed', 'on_hold', 'cancelled'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(status);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                              project.status === status ? 'bg-gray-50 font-semibold' : ''
                            }`}
                          >
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${getStatusBadgeColor(status)}`}>
                              {status.replace('_', ' ')}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit Button */}
                  <Link
                    to={`/projects/${projectId}/edit`}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <Edit className="h-6 w-6 text-white" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Profit */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Net Profit</span>
                  {stats.profit >= 0 ? (
                    <TrendingUp className={`h-5 w-5 ${getProfitColor(stats.profit_margin_percentage)}`} />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(stats.profit, baseCurrency)}
                </div>
                <div className={`text-sm font-semibold mt-1 ${getProfitColor(stats.profit_margin_percentage)}`}>
                  {stats.profit_margin_percentage.toFixed(1)}% margin
                </div>
              </div>

              {/* Revenue */}
              <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-600">Revenue</span>
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(stats.total_income, baseCurrency)}
                </div>
                <div className="text-sm text-green-600 mt-1">
                  {stats.income_count} transaction{stats.income_count !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Expenses */}
              <div className="bg-red-50 rounded-xl p-6 border border-red-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-red-600">Expenses</span>
                  <DollarSign className="h-5 w-5 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-red-700">
                  {formatCurrency(stats.total_expenses, baseCurrency)}
                </div>
                <div className="text-sm text-red-600 mt-1">
                  {stats.expense_count} transaction{stats.expense_count !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Invoices */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-600">Invoices</span>
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrency(stats.invoice_total, baseCurrency)}
                </div>
                <div className="text-sm text-blue-600 mt-1">
                  {stats.paid_invoice_count} of {stats.invoice_count} paid
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors relative ${
                    activeTab === tab.id
                      ? 'text-purple-600 bg-purple-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                        activeTab === tab.id
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Project Details */}
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Details</h3>
                    <div className="space-y-3">
                      {project.client && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Client</span>
                          <span className="font-medium text-gray-900">{project.client.name}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeColor(project.status)}`}>
                          {project.status.replace('_', ' ')}
                        </span>
                      </div>
                      {project.start_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start Date</span>
                          <span className="font-medium text-gray-900">
                            {new Date(project.start_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {project.end_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">End Date</span>
                          <span className="font-medium text-gray-900">
                            {new Date(project.end_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {project.budget_amount && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Budget</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(project.budget_amount, project.budget_currency || baseCurrency)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Budget Progress (if budget exists) */}
                  {project.budget_amount && project.budget_amount > 0 && (
                    <BudgetProgress
                      project={project}
                      stats={stats}
                      baseCurrency={baseCurrency}
                      exchangeRates={exchangeRates}
                      formatCurrency={formatCurrency}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Milestones Tab */}
            {activeTab === 'milestones' && projectId && (
              <ProjectMilestones
                projectId={projectId}
                projectCurrency={project.budget_currency}
              />
            )}

            {/* Goals Tab */}
            {activeTab === 'goals' && projectId && (
              <ProjectGoals projectId={projectId} />
            )}

            {/* Time Tracking Tab */}
            {activeTab === 'time' && projectId && (
              <ProjectTimeTracking projectId={projectId} />
            )}

            {/* Files Tab */}
            {activeTab === 'files' && projectId && (
              <ProjectFiles projectId={projectId} />
            )}

            {/* Notes/Activity Tab */}
            {activeTab === 'notes' && projectId && (
              <ProjectNotes projectId={projectId} />
            )}

            {/* Income Tab */}
            {activeTab === 'income' && (
              <div className="space-y-4">
                {transactions.incomes.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No income transactions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {transactions.incomes.map((income) => (
                          <tr key={income.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(income.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{income.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {income.category?.name || 'Uncategorized'}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-green-600 text-right">
                              {formatCurrency(income.amount, income.currency || baseCurrency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Expenses Tab */}
            {activeTab === 'expenses' && (
              <div className="space-y-4">
                {transactions.expenses.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No expense transactions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {transactions.expenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(expense.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{expense.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {expense.category?.name || 'Uncategorized'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {expense.vendor_detail?.name || expense.vendor || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-red-600 text-right">
                              {formatCurrency(expense.amount, expense.currency || baseCurrency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Invoices Tab */}
            {activeTab === 'invoices' && (
              <div className="space-y-4">
                {transactions.invoices.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No invoices yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {transactions.invoices.map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              <Link to={`/invoices/${invoice.id}`} className="text-purple-600 hover:text-purple-700">
                                {invoice.invoice_number}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(invoice.invoice_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {invoice.client?.name || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  invoice.status === 'paid'
                                    ? 'bg-green-100 text-green-800'
                                    : invoice.status === 'sent'
                                    ? 'bg-blue-100 text-blue-800'
                                    : invoice.status === 'overdue'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {invoice.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              {formatCurrency(invoice.total, invoice.currency || baseCurrency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
