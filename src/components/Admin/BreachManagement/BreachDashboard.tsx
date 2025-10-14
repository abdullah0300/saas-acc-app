// src/components/Admin/BreachManagement/BreachDashboard.tsx
// 🔴 GDPR Articles 33 & 34: Data Breach Management Dashboard

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Mail,
  FileText,
  Plus,
  RefreshCw,
  Download,
  Users,
  Shield,
  X,
} from 'lucide-react';
import {
  getAllBreachIncidents,
  getHoursUntilDeadline,
  isDeadlinePassed,
  markICONotified,
  markUsersNotified,
  generateICOReport,
  generateUserNotificationEmail,
  BreachIncident,
} from '../../../services/breachNotification';
import { IncidentForm } from './IncidentForm';
import { format, parseISO } from 'date-fns';
import { useBreachDeadlineMonitor } from '../../../hooks/useBreachDeadlineMonitor';
import { notifyCustomerBreach } from '../../../services/gdprNotifications';
import { supabase } from '../../../services/supabaseClient';

export const BreachDashboard: React.FC = () => {
  const [incidents, setIncidents] = useState<BreachIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<BreachIncident | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Monitor breach deadlines and send notifications
  useBreachDeadlineMonitor();

  useEffect(() => {
    loadIncidents();
    // Refresh every minute to update countdown timers
    const interval = setInterval(loadIncidents, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadIncidents = async () => {
    setError(null);
    try {
      const { data, error: fetchError } = await getAllBreachIncidents();
      if (fetchError) throw fetchError;
      setIncidents(data || []);
    } catch (err: any) {
      console.error('Error loading incidents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkICONotified = async (incident: BreachIncident) => {
    if (!window.confirm('Confirm that you have notified the ICO about this breach?')) {
      return;
    }

    try {
      const { error } = await markICONotified(incident.id!);
      if (error) throw error;
      await loadIncidents();
      alert('✅ ICO notification recorded');
    } catch (err: any) {
      console.error('Error marking ICO notified:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  const handleSendUserNotifications = async (incident: BreachIncident) => {
    const affectedCount = incident.affected_users?.length || 0;

    if (affectedCount === 0) {
      alert('⚠️ No affected users specified for this incident.');
      return;
    }

    if (!window.confirm(`Send breach notification to ${affectedCount} affected user(s)?\n\nThis will send email and in-app notifications to all affected users.`)) {
      return;
    }

    try {
      // Get affected user IDs
      const affectedUserIds = incident.affected_users || [];

      if (affectedUserIds.length === 0) {
        throw new Error('No affected users found');
      }

      // Get user emails to display in summary
      const { data: users } = await supabase
        .from('profiles')
        .select('email')
        .in('id', affectedUserIds);

      const userEmails = users?.map(u => u.email).join(', ') || 'users';

      // Prepare breach notification data
      const breachData = {
        incident_description: incident.description,
        data_types_affected: incident.affected_data_types?.join(', ') || 'Multiple data types',
        recommended_actions: 'Please review your account activity and consider changing your password. Monitor for suspicious activity and contact us if you notice anything unusual.',
      };

      // Send notification to each affected user
      let successCount = 0;
      let failCount = 0;

      for (const userId of affectedUserIds) {
        try {
          await notifyCustomerBreach(userId, breachData);
          successCount++;
        } catch (notifError) {
          console.error(`Failed to notify user ${userId}:`, notifError);
          failCount++;
        }
      }

      // Automatically mark as notified if all notifications sent successfully
      if (successCount > 0 && failCount === 0) {
        await markUsersNotified(incident.id!);
        await loadIncidents();
      }

      if (failCount === 0) {
        alert(`✅ Successfully sent breach notifications to ${successCount} user(s)\n\nNotified: ${userEmails}`);
      } else {
        alert(`⚠️ Partially sent notifications:\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`);
      }

      await loadIncidents();
    } catch (err: any) {
      console.error('Error sending user notifications:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  const handleMarkUsersNotified = async (incident: BreachIncident) => {
    if (!window.confirm('Confirm that you have manually notified all affected users about this breach?')) {
      return;
    }

    try {
      const { error } = await markUsersNotified(incident.id!);
      if (error) throw error;
      await loadIncidents();
      alert('✅ User notification recorded');
    } catch (err: any) {
      console.error('Error marking users notified:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  const handleDownloadICOReport = (incident: BreachIncident) => {
    const report = generateICOReport(incident);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ICO-Report-${incident.incident_id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderCountdownTimer = (incident: BreachIncident) => {
    if (incident.ico_notified_at) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          ICO Notified
        </span>
      );
    }

    const hoursRemaining = getHoursUntilDeadline(incident.detected_at);
    const deadlinePassed = isDeadlinePassed(incident.detected_at);

    if (deadlinePassed) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Deadline Passed
        </span>
      );
    }

    const hours = Math.floor(hoursRemaining);
    const minutes = Math.floor((hoursRemaining - hours) * 60);

    let colorClass = 'bg-green-100 text-green-800';
    if (hoursRemaining < 24) colorClass = 'bg-red-100 text-red-800';
    else if (hoursRemaining < 48) colorClass = 'bg-orange-100 text-orange-800';
    else if (hoursRemaining < 60) colorClass = 'bg-yellow-100 text-yellow-800';

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${colorClass}`}
      >
        <Clock className="h-3 w-3 mr-1" />
        {hours}h {minutes}m remaining
      </span>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[severity as keyof typeof colors]}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      investigating: { bg: 'bg-blue-100', text: 'text-blue-800' },
      contained: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      resolved: { bg: 'bg-green-100', text: 'text-green-800' },
    };
    const style = styles[status as keyof typeof styles] || styles.investigating;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {status}
      </span>
    );
  };

  const urgentIncidents = incidents.filter(
    (inc) => !inc.ico_notified_at && getHoursUntilDeadline(inc.detected_at) < 24
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <AlertTriangle className="h-7 w-7 mr-3 text-red-600" />
            Data Breach Management
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            GDPR Articles 33 & 34: 72-hour notification requirement
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadIncidents}
            disabled={loading}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Report New Incident
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Urgent Incidents Warning */}
      {urgentIncidents.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                ⚠️ Urgent Action Required
              </h3>
              <p className="text-sm text-red-800 mt-1">
                {urgentIncidents.length} incident{urgentIncidents.length > 1 ? 's' : ''} require
                ICO notification within 24 hours. Immediate action required!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* GDPR Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>GDPR Article 33:</strong> Data controllers must notify the ICO within{' '}
            <strong>72 hours</strong> of becoming aware of a breach. <strong>Article 34:</strong>{' '}
            Affected individuals must be notified without undue delay if the breach poses a high
            risk.
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Incidents</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{incidents.length}</p>
            </div>
            <AlertTriangle className="h-12 w-12 text-gray-400 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Urgent (&lt; 24h)</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{urgentIncidents.length}</p>
            </div>
            <Clock className="h-12 w-12 text-red-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending ICO</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                {incidents.filter((i) => !i.ico_notified_at).length}
              </p>
            </div>
            <Mail className="h-12 w-12 text-yellow-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Resolved</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {incidents.filter((i) => i.status === 'resolved').length}
              </p>
            </div>
            <CheckCircle className="h-12 w-12 text-green-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Incidents List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Breach Incidents</h2>
        </div>

        {incidents.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <Shield className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm">No breach incidents recorded</p>
            <p className="text-xs text-gray-400 mt-1">This is a good thing!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {incidents.map((incident) => (
              <div key={incident.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {incident.incident_id}
                      </h3>
                      {getSeverityBadge(incident.severity)}
                      {getStatusBadge(incident.status)}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        Detected: {format(parseISO(incident.detected_at), 'MMM dd, yyyy HH:mm')}
                      </span>
                      <span className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {incident.affected_users?.length || 0} users affected
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mb-3">{incident.description}</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {incident.affected_data_types?.map((type) => (
                        <span
                          key={type}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="ml-6">{renderCountdownTimer(incident)}</div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                  {!incident.ico_notified_at && (
                    <button
                      onClick={() => handleMarkICONotified(incident)}
                      className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Mark ICO Notified
                    </button>
                  )}

                  {!incident.users_notified_at && (
                    <>
                      <button
                        onClick={() => handleSendUserNotifications(incident)}
                        className="flex items-center px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Send User Notifications
                      </button>

                      <button
                        onClick={() => handleMarkUsersNotified(incident)}
                        className="flex items-center px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Mark Manually Notified
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => handleDownloadICOReport(incident)}
                    className="flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download ICO Report
                  </button>

                  <button
                    onClick={() => setSelectedIncident(incident)}
                    className="flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Details
                  </button>
                </div>

                {/* Notification Status */}
                {(incident.ico_notified_at || incident.users_notified_at) && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-4 text-xs text-gray-600">
                    {incident.ico_notified_at && (
                      <span className="flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                        ICO: {format(parseISO(incident.ico_notified_at), 'MMM dd, HH:mm')}
                      </span>
                    )}
                    {incident.users_notified_at && (
                      <span className="flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                        Users: {format(parseISO(incident.users_notified_at), 'MMM dd, HH:mm')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incident Form Modal */}
      {showForm && (
        <IncidentForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            loadIncidents();
          }}
        />
      )}

      {/* Details Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Incident Details</h2>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Incident ID</label>
                <p className="text-lg font-semibold text-gray-900">
                  {selectedIncident.incident_id}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Description</label>
                <p className="text-sm text-gray-800">{selectedIncident.description}</p>
              </div>
              {selectedIncident.mitigation_steps && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Mitigation Steps</label>
                  <p className="text-sm text-gray-800">{selectedIncident.mitigation_steps}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
