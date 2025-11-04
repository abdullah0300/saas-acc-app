import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import {
  createProject,
  updateProject,
  getProject,
  deleteProject,
  checkProjectNameExists,
  getClients
} from '../../services/database';

export const ProjectForm: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { baseCurrency, userSettings } = useSettings();
  const enabledCurrencies = userSettings?.enabled_currencies || [baseCurrency];
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: '',
    status: 'active' as 'active' | 'completed' | 'on_hold' | 'cancelled',
    start_date: '',
    end_date: '',
    budget_amount: '',
    budget_currency: baseCurrency,
    color: '#6366F1'
  });

  useEffect(() => {
    loadData();
  }, [projectId, user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const clientsData = await getClients(user.id);
      setClients(clientsData);

      if (projectId) {
        const project = await getProject(projectId);
        setFormData({
          name: project.name,
          description: project.description || '',
          client_id: project.client_id || '',
          status: project.status,
          start_date: project.start_date || '',
          end_date: project.end_date || '',
          budget_amount: project.budget_amount?.toString() || '',
          budget_currency: project.budget_currency || baseCurrency,
          color: project.color || '#6366F1'
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const validate = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (user) {
      const exists = await checkProjectNameExists(user.id, formData.name, projectId);
      if (exists) {
        newErrors.name = 'A project with this name already exists';
      }
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.start_date) > new Date(formData.end_date)) {
        newErrors.end_date = 'End date must be after start date';
      }
    }

    if (formData.budget_amount && parseFloat(formData.budget_amount) < 0) {
      newErrors.budget_amount = 'Budget must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !(await validate())) return;

    try {
      setSaving(true);

      const projectData = {
        user_id: user.id,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        client_id: formData.client_id || undefined,
        status: formData.status,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : undefined,
        budget_currency: formData.budget_currency,
        color: formData.color
      };

      if (projectId) {
        await updateProject(projectId, projectData);
      } else {
        await createProject(projectData as any);
      }

      navigate('/projects');
    } catch (error) {
      console.error('Error saving project:', error);
      setErrors({ submit: 'Failed to save project. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId || !window.confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      await deleteProject(projectId);
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      setErrors({ submit: 'Failed to delete project. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const colorOptions = [
    { value: '#6366F1', label: 'Indigo', class: 'project-color-btn-indigo' },
    { value: '#8B5CF6', label: 'Purple', class: 'project-color-btn-purple' },
    { value: '#EC4899', label: 'Pink', class: 'project-color-btn-pink' },
    { value: '#10B981', label: 'Green', class: 'project-color-btn-green' },
    { value: '#F59E0B', label: 'Amber', class: 'project-color-btn-amber' },
    { value: '#EF4444', label: 'Red', class: 'project-color-btn-red' },
    { value: '#3B82F6', label: 'Blue', class: 'project-color-btn-blue' },
    { value: '#14B8A6', label: 'Teal', class: 'project-color-btn-teal' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/projects')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-6 w-6 text-gray-600" />
              </button>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                {projectId ? 'Edit Project' : 'New Project'}
              </h1>
            </div>

            {projectId && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 className="h-5 w-5" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">Basic Information</h2>

            <div className="space-y-4">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.name ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="e.g., Sarah's Wedding Photography"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Brief description of the project..."
                />
              </div>

              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client
                </label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No client linked</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Color
                </label>
                <div className="flex gap-3 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-12 h-12 rounded-xl transition-all ${color.class} ${
                        formData.color === color.value
                          ? 'ring-4 ring-purple-300 scale-110'
                          : 'hover:scale-105'
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">Timeline</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.end_date ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
                {errors.end_date && <p className="mt-1 text-sm text-red-600">{errors.end_date}</p>}
              </div>
            </div>
          </div>

          {/* Budget */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">Budget</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.budget_amount}
                  onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.budget_amount ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="0.00"
                />
                {errors.budget_amount && <p className="mt-1 text-sm text-red-600">{errors.budget_amount}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={formData.budget_currency}
                  onChange={(e) => setFormData({ ...formData, budget_currency: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {enabledCurrencies.map((currency: string) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  {projectId ? 'Update Project' : 'Create Project'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
