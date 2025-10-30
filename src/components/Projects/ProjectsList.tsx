import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Briefcase, TrendingUp, TrendingDown, Calendar, Users, X, ChevronDown, Copy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getProjects, updateProject, duplicateProject } from '../../services/database';
import type { Project } from '../../services/database';

// Budget Progress Component for Project Cards
const BudgetProgressBar: React.FC<{
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

  const percentageUsed = (stats.total_expenses / budgetInBaseCurrency) * 100;

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-gray-600">Budget Usage</span>
        <span className="font-semibold text-gray-900 flex flex-col items-end gap-0.5">
          <span>
            {formatCurrency(stats.total_expenses, baseCurrency)} / {formatCurrency(budgetAmount, project.budget_currency || baseCurrency)}
          </span>
          {budgetCurrency !== baseCurrency && (
            <span className="text-xs text-gray-500">
              ({percentageUsed.toFixed(1)}% used)
            </span>
          )}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
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
    </div>
  );
};

export const ProjectsList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { formatCurrency, baseCurrency, exchangeRates } = useSettings();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold' | 'cancelled'>('active');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [projectToDuplicate, setProjectToDuplicate] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadProjects();
  }, [user, statusFilter]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (statusDropdownOpen) {
        setStatusDropdownOpen(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [statusDropdownOpen]);

  const loadProjects = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getProjects(user.id, statusFilter);
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleStatusChange = async (projectId: string, newStatus: 'active' | 'completed' | 'on_hold' | 'cancelled') => {
    try {
      await updateProject(projectId, { status: newStatus });
      setStatusDropdownOpen(null);
      // Reload projects to reflect the change
      await loadProjects();
    } catch (error) {
      console.error('Error updating project status:', error);
      alert('Failed to update project status');
    }
  };

  const handleDuplicate = (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDuplicate({ id: projectId, name: projectName });
    setDuplicateModalOpen(true);
  };

  const confirmDuplicate = async () => {
    if (!user || !projectToDuplicate) return;

    try {
      const newProject = await duplicateProject(projectToDuplicate.id, user.id);
      setDuplicateModalOpen(false);
      setProjectToDuplicate(null);
      await loadProjects();
      // Navigate to the new project
      navigate(`/projects/${newProject.id}`);
    } catch (error) {
      console.error('Error duplicating project:', error);
      alert('Failed to duplicate project');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-start space-x-4">
              <div className="p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg">
                <Briefcase className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Projects
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  Track profitability across all your projects
                </p>
              </div>
            </div>

            <Link
              to="/projects/new"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Project
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects, clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'active', 'completed', 'on_hold', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    statusFilter === status
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
            <Briefcase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No projects found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm ? 'Try adjusting your search' : 'Get started by creating your first project'}
            </p>
            {!searchTerm && (
              <Link
                to="/projects/new"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Project
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const stats = project.stats || {
                total_income: 0,
                total_expenses: 0,
                profit: 0,
                profit_margin_percentage: 0,
                invoice_total: 0,
                income_count: 0,
                expense_count: 0,
                invoice_count: 0
              };

              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="group"
                >
                  <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-purple-200 transform hover:scale-[1.02]">
                    {/* Card Header with Gradient */}
                    <div
                      className={`p-6 bg-gradient-to-r ${getStatusColor(project.status)} text-white relative overflow-hidden`}
                    >
                      {/* Background Pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-2xl"></div>
                      </div>

                      <div className="relative">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold mb-2 truncate">
                              {project.name}
                            </h3>
                            {project.client && (
                              <div className="flex items-center gap-2 text-white/90">
                                <Users className="h-4 w-4 flex-shrink-0" />
                                <span className="text-sm truncate">{project.client.name}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
                            {/* Duplicate Button */}
                            <button
                              onClick={(e) => handleDuplicate(e, project.id, project.name)}
                              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                              title="Duplicate project"
                            >
                              <Copy className="h-4 w-4" />
                            </button>

                            {/* Quick Status Dropdown */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setStatusDropdownOpen(statusDropdownOpen === project.id ? null : project.id);
                              }}
                              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusBadgeColor(project.status)} hover:opacity-80 transition-opacity`}
                            >
                              {project.status}
                              <ChevronDown className="h-3 w-3" />
                            </button>

                            {statusDropdownOpen === project.id && (
                              <div
                                className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                {(['active', 'completed', 'on_hold', 'cancelled'] as const).map((status) => (
                                  <button
                                    key={status}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleStatusChange(project.id, status);
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
                        </div>

                        {/* Project Timeline */}
                        {(project.start_date || project.end_date) && (
                          <div className="flex items-center gap-2 text-white/80 text-sm">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {project.start_date && new Date(project.start_date).toLocaleDateString()}
                              {project.start_date && project.end_date && ' - '}
                              {project.end_date && new Date(project.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-6 space-y-4">
                      {/* Profit Display */}
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Net Profit</span>
                          <span className={`text-xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(stats.profit, baseCurrency)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {stats.profit >= 0 ? (
                            <TrendingUp className={`h-4 w-4 ${getProfitColor(stats.profit_margin_percentage)}`} />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={`text-sm font-semibold ${getProfitColor(stats.profit_margin_percentage)}`}>
                            {stats.profit_margin_percentage.toFixed(1)}% margin
                          </span>
                        </div>
                      </div>

                      {/* Revenue & Expenses */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                          <div className="text-xs text-green-600 font-medium mb-1">Revenue</div>
                          <div className="text-lg font-bold text-green-700">
                            {formatCurrency(stats.total_income, baseCurrency)}
                          </div>
                          <div className="text-xs text-green-600 mt-1">
                            {stats.income_count} transaction{stats.income_count !== 1 ? 's' : ''}
                          </div>
                        </div>

                        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                          <div className="text-xs text-red-600 font-medium mb-1">Expenses</div>
                          <div className="text-lg font-bold text-red-700">
                            {formatCurrency(stats.total_expenses, baseCurrency)}
                          </div>
                          <div className="text-xs text-red-600 mt-1">
                            {stats.expense_count} transaction{stats.expense_count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      {/* Budget Progress (if budget exists) */}
                      {project.budget_amount && project.budget_amount > 0 && (
                        <BudgetProgressBar
                          project={project}
                          stats={stats}
                          baseCurrency={baseCurrency}
                          exchangeRates={exchangeRates}
                          formatCurrency={formatCurrency}
                        />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Duplicate Confirmation Modal */}
        {duplicateModalOpen && projectToDuplicate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Copy className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Duplicate Project</h3>
                  <p className="text-sm text-gray-500">Create a copy of this project</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  "{projectToDuplicate.name}"
                </p>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-green-600 text-xs">✓</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Will be copied:</p>
                      <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                        <li>• Project info (name, description, client, budget)</li>
                        <li>• Milestones (status reset to pending)</li>
                        <li>• Goals (status reset to todo)</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 mt-3">
                    <div className="mt-0.5">
                      <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="text-red-600 text-xs">✗</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Will NOT be copied:</p>
                      <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                        <li>• Time entries</li>
                        <li>• Files & attachments</li>
                        <li>• Activity log & notes</li>
                        <li>• Income, expenses, invoices</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setDuplicateModalOpen(false);
                    setProjectToDuplicate(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDuplicate}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium shadow-lg"
                >
                  Duplicate Project
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
