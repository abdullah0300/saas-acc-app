// src/components/Admin/AuditAnalytics.tsx
// 🔴 GDPR Article 30: Audit Trail Analytics Dashboard

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Download,
  AlertTriangle,
  TrendingUp,
  Shield,
  RefreshCw,
  Calendar,
  BarChart3,
  PieChart,
} from 'lucide-react';
import {
  getActivityStats,
  detectSuspiciousActivity,
  getTopUsers,
  getComplianceMetrics,
  downloadAuditLogsCSV,
  getAuditLogs,
  ActivityStats,
  SuspiciousActivity,
} from '../../services/auditAnalytics';
import { subDays, format } from 'date-fns';

export const AuditAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [suspicious, setSuspicious] = useState<SuspiciousActivity[]>([]);
  const [complianceMetrics, setComplianceMetrics] = useState<any>(null);
  const [dateRange, setDateRange] = useState(30); // Days
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = subDays(endDate, dateRange);

      // Load all analytics data in parallel
      const [statsResult, suspiciousResult, complianceResult] = await Promise.all([
        getActivityStats(startDate, endDate),
        detectSuspiciousActivity(startDate, endDate),
        getComplianceMetrics(startDate, endDate),
      ]);

      if (statsResult.error) throw statsResult.error;
      if (suspiciousResult.error) throw suspiciousResult.error;
      if (complianceResult.error) throw complianceResult.error;

      setStats(statsResult.data);
      setSuspicious(suspiciousResult.data || []);
      setComplianceMetrics(complianceResult.data);
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, dateRange);
      const { data: logs, error } = await getAuditLogs(startDate, endDate);

      if (error) throw error;
      if (!logs) throw new Error('No audit logs to export');

      downloadAuditLogsCSV(
        logs,
        `audit-logs-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.csv`
      );
    } catch (err: any) {
      console.error('Error exporting CSV:', err);
      alert(`Failed to export: ${err.message}`);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

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
            <Activity className="h-7 w-7 mr-3 text-blue-600" />
            Audit Trail Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            GDPR Article 30: Monitor and analyze data processing activities
          </p>
        </div>

        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>

          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.total_events.toLocaleString() || 0}
              </p>
            </div>
            <Activity className="h-12 w-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Suspicious Activities</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{suspicious.length}</p>
            </div>
            <AlertTriangle className="h-12 w-12 text-orange-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Compliance Score</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {complianceMetrics?.compliance_score || 0}%
              </p>
            </div>
            <Shield className="h-12 w-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white border border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Security Events</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {complianceMetrics?.security_events || 0}
              </p>
            </div>
            <Shield className="h-12 w-12 text-purple-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actions Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <PieChart className="h-5 w-5 mr-2 text-blue-600" />
            Actions Distribution
          </h2>
          <div className="space-y-3">
            {stats &&
              Object.entries(stats.by_action)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([action, count]) => {
                  const percentage = ((count / stats.total_events) * 100).toFixed(1);
                  const colors: Record<string, string> = {
                    create: 'bg-green-500',
                    read: 'bg-blue-500',
                    update: 'bg-yellow-500',
                    delete: 'bg-red-500',
                  };
                  return (
                    <div key={action}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 capitalize">{action}</span>
                        <span className="text-gray-600">
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${colors[action] || 'bg-gray-500'}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Entity Types */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
            Most Active Entity Types
          </h2>
          <div className="space-y-3">
            {stats &&
              Object.entries(stats.by_entity)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([entity, count]) => {
                  const percentage = ((count / stats.total_events) * 100).toFixed(1);
                  return (
                    <div key={entity}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 capitalize">
                          {entity.replace(/_/g, ' ')}
                        </span>
                        <span className="text-gray-600">
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-purple-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-blue-600" />
          Activity Timeline
        </h2>
        <div className="h-64 flex items-end justify-between gap-2">
          {stats?.by_day.map((day) => {
            const maxCount = Math.max(...stats.by_day.map((d) => d.count));
            const heightPercentage = (day.count / maxCount) * 100;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                  style={{ height: `${heightPercentage}%` }}
                  title={`${day.count} events`}
                ></div>
                <span className="text-xs text-gray-600 mt-2 rotate-45 origin-left">
                  {format(new Date(day.date), 'MMM dd')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suspicious Activities */}
      {suspicious.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-orange-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
              Suspicious Activity Detected
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {suspicious.map((activity, idx) => (
              <div key={idx} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(activity.severity)}`}
                      >
                        {activity.severity.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {activity.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mb-2">{activity.description}</p>

                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>User ID: {activity.user_id || 'Unknown'}</span>
                      <span>
                        Time: {format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>

                    {activity.details && (
                      <div className="mt-3 p-3 bg-gray-100 rounded text-xs">
                        <strong>Details:</strong> {JSON.stringify(activity.details)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Metrics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Shield className="h-5 w-5 mr-2 text-green-600" />
          GDPR Compliance Metrics
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600 mb-2">Data Access Requests</p>
            <p className="text-3xl font-bold text-blue-600">
              {complianceMetrics?.data_access_requests || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Article 15 & 20</p>
          </div>

          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600 mb-2">Deletion Requests</p>
            <p className="text-3xl font-bold text-purple-600">
              {complianceMetrics?.data_deletion_requests || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Article 17</p>
          </div>

          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600 mb-2">Consent Changes</p>
            <p className="text-3xl font-bold text-green-600">
              {complianceMetrics?.consent_changes || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Article 6 & 7</p>
          </div>
        </div>
      </div>
    </div>
  );
};
