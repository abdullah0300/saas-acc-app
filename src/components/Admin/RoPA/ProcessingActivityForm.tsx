// src/components/Admin/RoPA/ProcessingActivityForm.tsx

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  createProcessingActivity,
  updateProcessingActivity,
  ProcessingActivity,
} from '../../../services/ropaService';

interface Props {
  activity: ProcessingActivity | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProcessingActivityForm: React.FC<Props> = ({ activity, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<ProcessingActivity>>({
    name: '',
    purpose: '',
    legal_basis: 'contract',
    data_categories: [],
    data_subjects: [],
    recipients: [],
    retention_period: '',
    security_measures: '',
    international_transfers: false,
    transfer_safeguards: '',
  });

  useEffect(() => {
    if (activity) {
      setFormData(activity);
    }
  }, [activity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activity?.id) {
        const { error } = await updateProcessingActivity(activity.id, formData);
        if (error) throw error;
      } else {
        const { error } = await createProcessingActivity({
          ...formData as Omit<ProcessingActivity, 'id' | 'created_at' | 'updated_at'>,
          user_id: user!.id,
        });
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleArrayInput = (field: keyof ProcessingActivity, value: string) => {
    const values = value.split(',').map(v => v.trim()).filter(v => v);
    setFormData({ ...formData, [field]: values });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{activity ? 'Edit' : 'Add'} Processing Activity</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
            <textarea
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Legal Basis *</label>
            <select
              value={formData.legal_basis}
              onChange={(e) => setFormData({ ...formData, legal_basis: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="consent">Consent</option>
              <option value="contract">Contract Performance</option>
              <option value="legal_obligation">Legal Obligation</option>
              <option value="vital_interests">Vital Interests</option>
              <option value="public_task">Public Task</option>
              <option value="legitimate_interests">Legitimate Interests</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Categories * (comma-separated)</label>
            <input
              type="text"
              value={formData.data_categories?.join(', ')}
              onChange={(e) => handleArrayInput('data_categories', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g., Personal Identification, Financial Data, Contact Info"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Subjects * (comma-separated)</label>
            <input
              type="text"
              value={formData.data_subjects?.join(', ')}
              onChange={(e) => handleArrayInput('data_subjects', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g., Customers, Employees, Vendors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipients (comma-separated)</label>
            <input
              type="text"
              value={formData.recipients?.join(', ')}
              onChange={(e) => handleArrayInput('recipients', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g., Payment Processors, Email Providers"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Retention Period *</label>
            <input
              type="text"
              value={formData.retention_period}
              onChange={(e) => setFormData({ ...formData, retention_period: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g., 6 years, Until account deletion"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Security Measures</label>
            <textarea
              value={formData.security_measures}
              onChange={(e) => setFormData({ ...formData, security_measures: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g., Encryption, access controls, audit logging"
            />
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.international_transfers}
                onChange={(e) => setFormData({ ...formData, international_transfers: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">International Data Transfers</span>
            </label>
          </div>

          {formData.international_transfers && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Safeguards</label>
              <input
                type="text"
                value={formData.transfer_safeguards}
                onChange={(e) => setFormData({ ...formData, transfer_safeguards: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Standard Contractual Clauses, Adequacy Decision"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {activity ? 'Update' : 'Create'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
