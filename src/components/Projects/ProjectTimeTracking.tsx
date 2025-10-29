import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Clock, DollarSign, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useData } from '../../contexts/DataContext';
import {
  getProjectTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getProjectTimeStats,
  type TimeEntry
} from '../../services/database';

interface ProjectTimeTrackingProps {
  projectId: string;
}

export const ProjectTimeTracking: React.FC<ProjectTimeTrackingProps> = ({ projectId }) => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  const { effectiveUserId } = useData();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [stats, setStats] = useState({
    totalHours: 0,
    billableHours: 0,
    nonBillableHours: 0,
    totalAmount: 0,
    entryCount: 0
  });

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: '',
    billable: true,
    hourly_rate: ''
  });

  useEffect(() => {
    loadTimeEntries();
  }, [projectId]);

  const loadTimeEntries = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [entriesData, statsData] = await Promise.all([
        getProjectTimeEntries(projectId),
        getProjectTimeStats(projectId)
      ]);
      setEntries(entriesData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading time entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !effectiveUserId) return;

    try {
      const hours = parseFloat(formData.hours);
      if (isNaN(hours) || hours <= 0) {
        alert('Please enter valid hours');
        return;
      }

      const hourly_rate = formData.hourly_rate ? parseFloat(formData.hourly_rate) : undefined;

      if (editingEntry) {
        await updateTimeEntry(editingEntry.id, {
          date: formData.date,
          hours,
          description: formData.description || undefined,
          billable: formData.billable,
          hourly_rate
        });
      } else {
        await createTimeEntry({
          project_id: projectId,
          user_id: effectiveUserId,
          date: formData.date,
          hours,
          description: formData.description || undefined,
          billable: formData.billable,
          hourly_rate
        });
      }

      resetForm();
      await loadTimeEntries();
    } catch (error) {
      console.error('Error saving time entry:', error);
      alert('Failed to save time entry');
    }
  };

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date,
      hours: entry.hours.toString(),
      description: entry.description || '',
      billable: entry.billable,
      hourly_rate: entry.hourly_rate?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this time entry?')) return;

    try {
      await deleteTimeEntry(id);
      await loadTimeEntries();
    } catch (error) {
      console.error('Error deleting time entry:', error);
      alert('Failed to delete time entry');
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      hours: '',
      description: '',
      billable: true,
      hourly_rate: ''
    });
    setEditingEntry(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading time entries...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Hours</span>
            <Clock className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalHours.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.entryCount} entries</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Billable Hours</span>
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.billableHours.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.totalHours > 0 ? ((stats.billableHours / stats.totalHours) * 100).toFixed(0) : 0}% of total
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Non-Billable</span>
            <Clock className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.nonBillableHours.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.totalHours > 0 ? ((stats.nonBillableHours / stats.totalHours) * 100).toFixed(0) : 0}% of total
          </p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Amount</span>
            <DollarSign className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount, baseCurrency)}</p>
          <p className="text-xs text-gray-500 mt-1">From billable hours</p>
        </div>
      </div>

      {/* Add Time Entry Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Time Entries</h3>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Log Time
        </button>
      </div>

      {/* Time Entry Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-semibold mb-4">
            {editingEntry ? 'Edit Time Entry' : 'Log Time'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hours *
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
              </div>

              {/* Billable Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.billable}
                      onChange={() => setFormData({ ...formData, billable: true })}
                      className="mr-2"
                    />
                    <span className="text-sm">Billable</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!formData.billable}
                      onChange={() => setFormData({ ...formData, billable: false })}
                      className="mr-2"
                    />
                    <span className="text-sm">Non-Billable</span>
                  </label>
                </div>
              </div>

              {/* Hourly Rate */}
              {formData.billable && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hourly Rate (optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0.00"
                  />
                </div>
              )}
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
                placeholder="What did you work on?"
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
                {editingEntry ? 'Update' : 'Log'} Time
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Time Entries Table */}
      {entries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No time entries yet</p>
          <p className="text-sm text-gray-400">Start tracking your time on this project</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {new Date(entry.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entry.hours}h
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {entry.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      entry.billable
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {entry.billable ? 'Billable' : 'Non-Billable'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.hourly_rate ? formatCurrency(entry.hourly_rate, baseCurrency) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entry.amount ? formatCurrency(entry.amount, baseCurrency) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-1 text-gray-600 hover:text-purple-600 transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
