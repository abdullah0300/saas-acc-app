import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, Circle, Clock, DollarSign, Calendar, FileText } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useData } from '../../contexts/DataContext';
import {
  getProjectMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  type ProjectMilestone
} from '../../services/database';

interface ProjectMilestonesProps {
  projectId: string;
  projectCurrency?: string;
}

export const ProjectMilestones: React.FC<ProjectMilestonesProps> = ({ projectId, projectCurrency }) => {
  const { formatCurrency, baseCurrency } = useSettings();
  const { effectiveUserId } = useData();
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    due_date: '',
    target_amount: '',
    currency: projectCurrency || baseCurrency,
    status: 'pending' as ProjectMilestone['status']
  });

  useEffect(() => {
    loadMilestones();
  }, [projectId]);

  const loadMilestones = async () => {
    try {
      setLoading(true);
      const data = await getProjectMilestones(projectId);
      setMilestones(data);
    } catch (error) {
      console.error('Error loading milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) return;

    try {
      if (editingMilestone) {
        await updateMilestone(editingMilestone.id, {
          name: formData.name,
          description: formData.description || undefined,
          due_date: formData.due_date || undefined,
          target_amount: formData.target_amount ? parseFloat(formData.target_amount) : undefined,
          currency: formData.currency,
          status: formData.status
        });
      } else {
        await createMilestone({
          project_id: projectId,
          user_id: effectiveUserId,
          name: formData.name,
          description: formData.description || undefined,
          due_date: formData.due_date || undefined,
          target_amount: formData.target_amount ? parseFloat(formData.target_amount) : undefined,
          currency: formData.currency,
          status: formData.status
        });
      }

      resetForm();
      await loadMilestones();
    } catch (error) {
      console.error('Error saving milestone:', error);
      alert('Failed to save milestone');
    }
  };

  const handleEdit = (milestone: ProjectMilestone) => {
    setEditingMilestone(milestone);
    setFormData({
      name: milestone.name,
      description: milestone.description || '',
      due_date: milestone.due_date || '',
      target_amount: milestone.target_amount?.toString() || '',
      currency: milestone.currency || projectCurrency || baseCurrency,
      status: milestone.status
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;

    try {
      await deleteMilestone(id);
      await loadMilestones();
    } catch (error) {
      console.error('Error deleting milestone:', error);
      alert('Failed to delete milestone');
    }
  };

  const handleStatusChange = async (milestone: ProjectMilestone, newStatus: ProjectMilestone['status']) => {
    try {
      const updates: Partial<ProjectMilestone> = { status: newStatus };

      // If marking as completed, set completion date
      if (newStatus === 'completed' && !milestone.completion_date) {
        updates.completion_date = new Date().toISOString().split('T')[0];
      }

      await updateMilestone(milestone.id, updates);
      await loadMilestones();
    } catch (error) {
      console.error('Error updating milestone status:', error);
      alert('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      due_date: '',
      target_amount: '',
      currency: projectCurrency || baseCurrency,
      status: 'pending'
    });
    setEditingMilestone(null);
    setShowForm(false);
  };

  const getStatusColor = (status: ProjectMilestone['status']) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      paid: 'bg-purple-100 text-purple-700'
    };
    return colors[status];
  };

  const getStatusIcon = (status: ProjectMilestone['status']) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return <Check className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

  // Calculate milestone statistics
  const stats = milestones.reduce((acc, m) => {
    acc.total++;
    if (m.status === 'completed' || m.status === 'paid') acc.completed++;
    if (m.status === 'paid') acc.paid++;
    if (m.target_amount) {
      acc.totalAmount += m.target_amount;
      if (m.status === 'paid') acc.paidAmount += m.target_amount;
    }
    return acc;
  }, { total: 0, completed: 0, paid: 0, totalAmount: 0, paidAmount: 0 });

  if (loading) {
    return <div className="text-center py-8">Loading milestones...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Milestones</h3>
          {milestones.length > 0 && (
            <p className="text-sm text-gray-500">
              {stats.completed} of {stats.total} completed
              {stats.totalAmount > 0 && ` • ${formatCurrency(stats.paidAmount, projectCurrency || baseCurrency)} / ${formatCurrency(stats.totalAmount, projectCurrency || baseCurrency)} paid`}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Milestone
        </button>
      </div>

      {/* Progress bar */}
      {milestones.length > 0 && (
        <div className="bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(stats.completed / stats.total) * 100}%` }}
          />
        </div>
      )}

      {/* Milestone form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-semibold mb-4">
            {editingMilestone ? 'Edit Milestone' : 'New Milestone'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Milestone Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Phase 1 - Design"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectMilestone['status'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Target Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                  <option value="CNY">CNY - Chinese Yuan</option>
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="PKR">PKR - Pakistani Rupee</option>
                  <option value="BDT">BDT - Bangladeshi Taka</option>
                  <option value="NGN">NGN - Nigerian Naira</option>
                  <option value="ZAR">ZAR - South African Rand</option>
                  <option value="BRL">BRL - Brazilian Real</option>
                  <option value="MXN">MXN - Mexican Peso</option>
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="SAR">SAR - Saudi Riyal</option>
                  <option value="SGD">SGD - Singapore Dollar</option>
                  <option value="HKD">HKD - Hong Kong Dollar</option>
                  <option value="NZD">NZD - New Zealand Dollar</option>
                  <option value="SEK">SEK - Swedish Krona</option>
                  <option value="NOK">NOK - Norwegian Krone</option>
                  <option value="DKK">DKK - Danish Krone</option>
                  <option value="CHF">CHF - Swiss Franc</option>
                  <option value="PLN">PLN - Polish Złoty</option>
                  <option value="RUB">RUB - Russian Ruble</option>
                  <option value="TRY">TRY - Turkish Lira</option>
                  <option value="KRW">KRW - South Korean Won</option>
                  <option value="THB">THB - Thai Baht</option>
                  <option value="MYR">MYR - Malaysian Ringgit</option>
                  <option value="IDR">IDR - Indonesian Rupiah</option>
                  <option value="PHP">PHP - Philippine Peso</option>
                  <option value="VND">VND - Vietnamese Dong</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Milestone details..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {editingMilestone ? 'Update' : 'Create'} Milestone
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Milestones list */}
      {milestones.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No milestones yet</p>
          <p className="text-sm text-gray-400">Add milestones to track project phases and payments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((milestone, index) => (
            <div
              key={milestone.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-purple-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 font-medium">{index + 1}.</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{milestone.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(milestone.status)} flex items-center gap-1`}>
                          {getStatusIcon(milestone.status)}
                          {milestone.status.replace('_', ' ')}
                        </span>
                      </div>
                      {milestone.description && (
                        <p className="text-sm text-gray-600 mb-2">{milestone.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        {milestone.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Due: {new Date(milestone.due_date).toLocaleDateString()}
                          </div>
                        )}
                        {milestone.target_amount && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {formatCurrency(milestone.target_amount, milestone.currency || projectCurrency || baseCurrency)}
                          </div>
                        )}
                        {milestone.invoice && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            Invoice #{milestone.invoice.invoice_number}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Quick status change */}
                  {milestone.status !== 'paid' && (
                    <select
                      value={milestone.status}
                      onChange={(e) => handleStatusChange(milestone, e.target.value as ProjectMilestone['status'])}
                      className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="paid">Paid</option>
                    </select>
                  )}
                  <button
                    onClick={() => handleEdit(milestone)}
                    className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(milestone.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
