// src/components/Admin/BreachManagement/IncidentForm.tsx
// 🔴 GDPR Article 33: Data Breach Incident Reporting Form

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  Save,
  Shield,
  Users,
  FileText,
  CheckCircle,
  Search,
} from 'lucide-react';
import { createBreachIncident, BreachIncident } from '../../../services/breachNotification';
import { notifyBreachReported, notifyCustomerBreach } from '../../../services/gdprNotifications';
import { supabase } from '../../../services/supabaseClient';

interface IncidentFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface UserProfile {
  id: string;
  email: string;
  company_name?: string;
}

export const IncidentForm: React.FC<IncidentFormProps> = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [formData, setFormData] = useState({
    breach_type: '',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    description: '',
    affected_data_types: [] as string[],
    affected_users: [] as string[],
    mitigation_steps: '',
    status: 'investigating' as 'investigating' | 'contained' | 'resolved',
  });

  const breachTypes = [
    { value: 'unauthorized_access', label: 'Unauthorized Access' },
    { value: 'data_leak', label: 'Data Leak' },
    { value: 'ransomware', label: 'Ransomware Attack' },
    { value: 'phishing', label: 'Phishing Attack' },
    { value: 'malware', label: 'Malware Infection' },
    { value: 'insider_threat', label: 'Insider Threat' },
    { value: 'lost_device', label: 'Lost/Stolen Device' },
    { value: 'accidental_disclosure', label: 'Accidental Disclosure' },
    { value: 'other', label: 'Other' },
  ];

  const dataTypes = [
    'Personal Identification (Name, Email, Phone)',
    'Financial Information (Bank Details, Invoices)',
    'Tax Information (VAT, Tax Returns)',
    'Business Data (Clients, Vendors)',
    'Authentication Data (Passwords, Tokens)',
    'Usage Data (Logs, Analytics)',
    'Other Sensitive Data',
  ];

  // Load all users on component mount
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, company_name')
          .order('email');

        if (error) throw error;
        setAllUsers(data || []);
      } catch (err) {
        console.error('Error loading users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, []);

  const handleDataTypeToggle = (dataType: string) => {
    setFormData((prev) => {
      const newTypes = prev.affected_data_types.includes(dataType)
        ? prev.affected_data_types.filter((t) => t !== dataType)
        : [...prev.affected_data_types, dataType];
      return { ...prev, affected_data_types: newTypes };
    });
  };

  const handleUserToggle = (userId: string) => {
    setFormData((prev) => {
      const newUsers = prev.affected_users.includes(userId)
        ? prev.affected_users.filter((u) => u !== userId)
        : [...prev.affected_users, userId];
      return { ...prev, affected_users: newUsers };
    });
  };

  // Filter users based on search
  const filteredUsers = allUsers.filter((user) =>
    user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (user.company_name?.toLowerCase().includes(userSearch.toLowerCase()) || false)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.breach_type) {
      setError('Please select a breach type');
      return;
    }
    if (!formData.description.trim()) {
      setError('Please provide a description');
      return;
    }
    if (formData.affected_data_types.length === 0) {
      setError('Please select at least one affected data type');
      return;
    }

    setLoading(true);

    try {
      const incident: Omit<BreachIncident, 'id' | 'incident_id'> = {
        detected_at: new Date().toISOString(),
        breach_type: formData.breach_type,
        severity: formData.severity,
        description: formData.description,
        affected_data_types: formData.affected_data_types,
        affected_users: formData.affected_users,
        mitigation_steps: formData.mitigation_steps,
        status: formData.status,
      };

      const { data, error: createError } = await createBreachIncident(incident);

      if (createError) throw createError;

      // Send notifications to platform admins
      if (data && data.incident_id) {
        try {
          await notifyBreachReported({
            incident_id: data.incident_id,
            breach_type: formData.breach_type,
            severity: formData.severity,
            affected_users_count: formData.affected_users.length,
            detected_at: data.detected_at,
          });
        } catch (notifError) {
          console.error('Failed to send breach notification:', notifError);
          // Don't fail the entire operation if notification fails
        }

        // Send notifications to affected users if any are selected
        if (formData.affected_users.length > 0) {
          const breachData = {
            incident_description: formData.description,
            data_types_affected: formData.affected_data_types.join(', '),
            recommended_actions: 'Please review your account activity and consider changing your password. Contact support if you notice any suspicious activity.',
          };

          // Send to each affected user
          for (const userId of formData.affected_users) {
            try {
              await notifyCustomerBreach(userId, breachData);
            } catch (notifError) {
              console.error(`Failed to send breach notification to user ${userId}:`, notifError);
              // Continue sending to other users even if one fails
            }
          }

          // Mark users as notified
          try {
            await supabase
              .from('data_breach_logs')
              .update({ users_notified_at: new Date().toISOString() })
              .eq('id', data.id);
          } catch (updateError) {
            console.error('Failed to mark users as notified:', updateError);
          }
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error creating incident:', err);
      setError(err.message || 'Failed to create incident');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
            <h2 className="text-xl font-bold text-gray-900">Report Data Breach Incident</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* GDPR Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Shield className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>GDPR Article 33 & 34:</strong> Data breaches must be reported to the ICO
                within 72 hours of detection. Affected users must also be notified without undue
                delay if the breach poses a high risk to their rights and freedoms.
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {/* Breach Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Breach Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.breach_type}
              onChange={(e) => setFormData({ ...formData, breach_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select breach type...</option>
              {breachTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Severity Level <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
                { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
                { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
                { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
              ].map((severity) => (
                <button
                  key={severity.value}
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      severity: severity.value as any,
                    })
                  }
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    formData.severity === severity.value
                      ? `${severity.color} ring-2 ring-offset-2 ring-blue-500`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {severity.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline h-4 w-4 mr-1" />
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe what happened, how it was discovered, and the potential impact..."
              required
            />
          </div>

          {/* Affected Data Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Affected Data Types <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {dataTypes.map((dataType) => (
                <label
                  key={dataType}
                  className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.affected_data_types.includes(dataType)}
                    onChange={() => handleDataTypeToggle(dataType)}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">{dataType}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Affected Users */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="inline h-4 w-4 mr-1" />
              Affected Users (Optional)
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Select users who were affected by this breach to send them notifications.
            </p>

            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by email or company..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {loadingUsers ? (
              <div className="text-center py-4 text-gray-600">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mx-auto mb-2"></div>
                Loading users...
              </div>
            ) : (
              <>
                <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.affected_users.includes(user.id)}
                          onChange={() => handleUserToggle(user.id)}
                          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="ml-3 flex-1">
                          <span className="text-sm text-gray-900">{user.email}</span>
                          {user.company_name && (
                            <span className="text-xs text-gray-500 ml-2">({user.company_name})</span>
                          )}
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      {userSearch ? 'No users found matching your search.' : 'No users available.'}
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {formData.affected_users.length} user(s) selected
                  </span>
                  {formData.affected_users.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, affected_users: [] })}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-800">
                  <strong>Note:</strong> Selected users will receive breach notification emails
                  automatically after you create this incident. You can also select users later
                  from the dashboard.
                </div>
              </div>
            </div>
          </div>

          {/* Mitigation Steps */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CheckCircle className="inline h-4 w-4 mr-1" />
              Mitigation Steps Taken
            </label>
            <textarea
              value={formData.mitigation_steps}
              onChange={(e) => setFormData({ ...formData, mitigation_steps: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe the immediate steps taken to contain the breach and prevent further damage..."
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="investigating">Investigating</option>
              <option value="contained">Contained</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Incident Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
