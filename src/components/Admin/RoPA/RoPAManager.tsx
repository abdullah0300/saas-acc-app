// src/components/Admin/RoPA/RoPAManager.tsx
// 🔴 GDPR Article 30: Records of Processing Activities Manager

import React, { useState, useEffect } from 'react';
import { FileText, Plus, Download, RefreshCw, Edit, Trash2, Shield, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getAllProcessingActivities,
  createProcessingActivity,
  deleteProcessingActivity,
  getRoPATemplates,
  downloadRoPACSV,
  ProcessingActivity,
} from '../../../services/ropaService';
import { ProcessingActivityForm } from './ProcessingActivityForm';

export const RoPAManager: React.FC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ProcessingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ProcessingActivity | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadActivities();
    }
  }, [user?.id]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const { data, error } = await getAllProcessingActivities(user!.id);
      if (error) throw error;
      setActivities(data || []);
    } catch (err: any) {
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this processing activity?')) return;

    try {
      const { error } = await deleteProcessingActivity(id);
      if (error) throw error;
      await loadActivities();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleUseTemplate = async (template: ProcessingActivity) => {
    try {
      const { error } = await createProcessingActivity({ ...template, user_id: user!.id });
      if (error) throw error;
      setShowTemplates(false);
      await loadActivities();
    } catch (err: any) {
      alert(`Failed to create from template: ${err.message}`);
    }
  };

  const legalBasisColors: Record<string, string> = {
    consent: 'bg-green-100 text-green-800',
    contract: 'bg-blue-100 text-blue-800',
    legal_obligation: 'bg-purple-100 text-purple-800',
    vital_interests: 'bg-red-100 text-red-800',
    public_task: 'bg-yellow-100 text-yellow-800',
    legitimate_interests: 'bg-orange-100 text-orange-800',
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FileText className="h-7 w-7 mr-3 text-blue-600" />
            Records of Processing Activities (RoPA)
          </h1>
          <p className="mt-1 text-sm text-gray-600">GDPR Article 30: Document all data processing</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4 mr-2" />
            Use Template
          </button>
          <button
            onClick={() => downloadRoPACSV(activities)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => { setEditingActivity(null); setShowForm(true); }}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Activity
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>GDPR Article 30:</strong> Organizations must maintain records of all processing activities under their responsibility. This register must be made available to the supervisory authority (ICO) upon request.
          </div>
        </div>
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 gap-6">
        {activities.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600">No processing activities recorded yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Add your first activity
            </button>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{activity.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{activity.purpose}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${legalBasisColors[activity.legal_basis]}`}>
                  {activity.legal_basis.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Data Categories</p>
                  <div className="flex flex-wrap gap-1">
                    {activity.data_categories.slice(0, 3).map((cat, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">{cat}</span>
                    ))}
                    {activity.data_categories.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                        +{activity.data_categories.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Data Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {activity.data_subjects.map((sub, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">{sub}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-xs text-gray-600">
                  Retention: <span className="font-medium">{activity.retention_period}</span>
                  {activity.international_transfers && (
                    <span className="ml-4 text-orange-600">⚠️ International Transfers</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingActivity(activity); setShowForm(true); }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(activity.id!)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <ProcessingActivityForm
          activity={editingActivity}
          onClose={() => { setShowForm(false); setEditingActivity(null); }}
          onSuccess={() => { setShowForm(false); setEditingActivity(null); loadActivities(); }}
        />
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Choose a Template</h2>
              <button onClick={() => setShowTemplates(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {getRoPATemplates().map((template, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{template.purpose}</p>
                    </div>
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
