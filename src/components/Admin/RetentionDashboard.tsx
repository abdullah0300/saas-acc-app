// src/components/Admin/RetentionDashboard.tsx
// 🔴 GDPR Article 5.1(e): Admin Dashboard for Data Retention Management

import React, { useState, useEffect } from 'react';
import {
  Database,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Calendar,
  TrendingDown,
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO, addYears, formatDistanceToNow } from 'date-fns';
import { notifyRetentionCleanupCompleted, notifyRetentionCleanupFailed } from '../../services/gdprNotifications';

interface TableStats {
  table: string;
  total: number;
  expired: number;
  oldest_date: string | null;
  retention_years: number;
}

interface CleanupJob {
  id: string;
  executed_at: string;
  records_deleted: number;
  records_anonymized: number;
  status: string;
  metadata: any;
}

export const RetentionDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TableStats[]>([]);
  const [jobHistory, setJobHistory] = useState<CleanupJob[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [user?.id]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch statistics for all tables
      const tableConfigs = [
        { name: 'income', retentionYears: 6, dateField: 'date' },
        { name: 'expenses', retentionYears: 6, dateField: 'date' },
        { name: 'invoices', retentionYears: 6, dateField: 'date' },
        { name: 'credit_notes', retentionYears: 6, dateField: 'date' },
        { name: 'audit_logs', retentionYears: 7, dateField: 'created_at' },
      ];

      const statsPromises = tableConfigs.map(config =>
        getTableStats(config.name, config.retentionYears, config.dateField)
      );

      const statsResults = await Promise.all(statsPromises);
      setStats(statsResults.filter((s): s is TableStats => s !== null));

      // Fetch cleanup job history (admin can see all jobs, not filtered by user)
      const { data: jobs, error: jobsError } = await supabase
        .from('data_retention_jobs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(10);

      if (jobsError) throw jobsError;
      setJobHistory(jobs || []);

    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTableStats = async (
    tableName: string,
    retentionYears: number,
    dateField: string
  ): Promise<TableStats | null> => {
    try {
      const cutoffDate = addYears(new Date(), -retentionYears);
      const cutoffDateStr = format(cutoffDate, 'yyyy-MM-dd');

      // Get total count
      const { count: total, error: totalError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Get expired count (older than cutoff)
      const { count: expired, error: expiredError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .lt(dateField, cutoffDateStr);

      if (expiredError) throw expiredError;

      // Get oldest record date
      const { data: oldestRecord, error: oldestError } = await supabase
        .from(tableName)
        .select(dateField)
        .order(dateField, { ascending: true })
        .limit(1)
        .single();

      if (oldestError && oldestError.code !== 'PGRST116') {
        // PGRST116 = no rows, which is fine
        throw oldestError;
      }

      return {
        table: tableName,
        total: total || 0,
        expired: expired || 0,
        oldest_date: oldestRecord ? (oldestRecord as any)[dateField] : null,
        retention_years: retentionYears,
      };
    } catch (error) {
      console.error(`Error getting stats for ${tableName}:`, error);
      return null;
    }
  };

  const handleRunCleanup = async () => {
    if (!window.confirm('Are you sure you want to run the data retention cleanup? This will permanently delete expired records.')) {
      return;
    }

    setRunning(true);
    setError(null);

    try {
      const startTime = new Date();

      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('data-retention-cleanup');

      if (error) throw error;

      const endTime = new Date();
      const executionTime = formatDistanceToNow(startTime, { addSuffix: false });

      console.log('Cleanup result:', data);

      // Send success notification to platform admins
      try {
        await notifyRetentionCleanupCompleted({
          records_deleted: data.total_deleted || 0,
          records_anonymized: data.total_anonymized || 0,
          execution_time: executionTime,
          executed_at: startTime.toISOString(),
        });
      } catch (notifError) {
        console.error('Failed to send cleanup notification:', notifError);
        // Don't fail the operation if notification fails
      }

      alert(`✅ Cleanup completed successfully!\n\nDeleted: ${data.total_deleted} records\nAnonymized: ${data.total_anonymized} records\nErrors: ${data.total_errors}`);

      // Reload dashboard data
      await loadDashboardData();
    } catch (err: any) {
      console.error('Error running cleanup:', err);
      setError(err.message);

      // Send failure notification to platform admins
      try {
        await notifyRetentionCleanupFailed({
          error_message: err.message || 'Unknown error',
          failed_at: new Date().toISOString(),
        });
      } catch (notifError) {
        console.error('Failed to send failure notification:', notifError);
      }

      alert(`❌ Cleanup failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const getTotalExpired = () => stats.reduce((sum, s) => sum + s.expired, 0);

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
            <Database className="h-7 w-7 mr-3 text-blue-600" />
            Data Retention Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor and manage automated data cleanup (GDPR Article 5.1(e))
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleRunCleanup}
            disabled={running || getTotalExpired() === 0}
            className={`flex items-center px-6 py-2 rounded-lg font-medium transition-colors ${
              getTotalExpired() === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : running
                ? 'bg-blue-400 text-white cursor-wait'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {running ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Cleanup Now
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats.reduce((sum, s) => sum + s.total, 0).toLocaleString()}
              </p>
            </div>
            <Database className="h-12 w-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expired Records</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {getTotalExpired().toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Ready for deletion</p>
            </div>
            <TrendingDown className="h-12 w-12 text-red-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Last Cleanup</p>
              <p className="text-lg font-bold text-gray-900 mt-2">
                {jobHistory.length > 0
                  ? format(parseISO(jobHistory[0].executed_at), 'MMM dd, yyyy')
                  : 'Never'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {jobHistory.length > 0
                  ? `Deleted ${jobHistory[0].records_deleted} records`
                  : 'No cleanup jobs yet'}
              </p>
            </div>
            <CheckCircle className="h-12 w-12 text-green-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Table Statistics */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Database className="h-5 w-5 mr-2 text-blue-600" />
            Table Statistics
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Table
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retention Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Records
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expired Records
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Oldest Record
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.map((stat) => (
                <tr key={stat.table} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 capitalize">
                      {stat.table.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2 text-gray-400" />
                      {stat.retention_years} years
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {stat.total.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div
                      className={`text-sm font-semibold ${
                        stat.expired > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {stat.expired.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {stat.oldest_date
                        ? format(parseISO(stat.oldest_date), 'MMM dd, yyyy')
                        : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {stat.expired > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <Trash2 className="h-3 w-3 mr-1" />
                        Cleanup Needed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Clean
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cleanup Job History */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            Cleanup Job History
          </h2>
        </div>

        <div className="overflow-x-auto">
          {jobHistory.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <Clock className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-sm">No cleanup jobs have been run yet</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Executed At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Records Deleted
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Records Anonymized
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobHistory.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {format(parseISO(job.executed_at), 'MMM dd, yyyy HH:mm:ss')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-red-600">
                        {job.records_deleted.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-orange-600">
                        {job.records_anonymized.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {job.status === 'success' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {job.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">
          📋 Data Retention Policy (GDPR Article 5.1(e))
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>Financial Records (Income, Expenses, Invoices, Credit Notes):</strong> Retained
            for 6 years as required by UK HMRC regulations.
          </p>
          <p>
            <strong>Audit Logs:</strong> Retained for 7 years as required by GDPR Article 30
            (Records of Processing Activities).
          </p>
          <p>
            <strong>Automated Cleanup:</strong> The cleanup job runs daily at 2:00 AM UTC to
            automatically delete expired records.
          </p>
          <p>
            <strong>Manual Cleanup:</strong> Use the "Run Cleanup Now" button to trigger an
            immediate cleanup if needed.
          </p>
        </div>
      </div>
    </div>
  );
};
