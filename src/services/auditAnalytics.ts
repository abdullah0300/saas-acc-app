// src/services/auditAnalytics.ts
// 🔴 GDPR Article 30: Audit Trail Analytics & Reporting

import { supabase } from './supabaseClient';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  metadata: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ActivityStats {
  total_events: number;
  by_action: Record<string, number>;
  by_entity: Record<string, number>;
  by_user: Record<string, number>;
  by_day: Array<{ date: string; count: number }>;
}

export interface SuspiciousActivity {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  user_id: string | null;
  timestamp: string;
  details: any;
}

/**
 * Get audit logs for a specific date range
 */
export async function getAuditLogs(
  startDate: Date,
  endDate: Date,
  filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
  }
): Promise<{ data: AuditLog[] | null; error: any }> {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { data: null, error };
  }
}

/**
 * Get activity statistics for a date range
 */
export async function getActivityStats(
  startDate: Date,
  endDate: Date
): Promise<{ data: ActivityStats | null; error: any }> {
  try {
    const { data: logs, error } = await getAuditLogs(startDate, endDate);

    if (error) throw error;
    if (!logs) return { data: null, error: 'No logs found' };

    // Calculate statistics
    const byAction: Record<string, number> = {};
    const byEntity: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    logs.forEach((log) => {
      // By action
      byAction[log.action] = (byAction[log.action] || 0) + 1;

      // By entity type
      byEntity[log.entity_type] = (byEntity[log.entity_type] || 0) + 1;

      // By user
      if (log.user_id) {
        byUser[log.user_id] = (byUser[log.user_id] || 0) + 1;
      }

      // By day
      const day = format(new Date(log.created_at), 'yyyy-MM-dd');
      byDay[day] = (byDay[day] || 0) + 1;
    });

    // Convert byDay to array
    const byDayArray = Object.entries(byDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const stats: ActivityStats = {
      total_events: logs.length,
      by_action: byAction,
      by_entity: byEntity,
      by_user: byUser,
      by_day: byDayArray,
    };

    return { data: stats, error: null };
  } catch (error) {
    console.error('Error calculating activity stats:', error);
    return { data: null, error };
  }
}

/**
 * Detect suspicious activities
 */
export async function detectSuspiciousActivity(
  startDate: Date,
  endDate: Date
): Promise<{ data: SuspiciousActivity[] | null; error: any }> {
  try {
    const { data: logs, error } = await getAuditLogs(startDate, endDate);

    if (error) throw error;
    if (!logs) return { data: [], error: null };

    const suspicious: SuspiciousActivity[] = [];

    // Group logs by user
    const userActivities = logs.reduce((acc, log) => {
      if (!log.user_id) return acc;
      if (!acc[log.user_id]) acc[log.user_id] = [];
      acc[log.user_id].push(log);
      return acc;
    }, {} as Record<string, AuditLog[]>);

    // Detect suspicious patterns
    Object.entries(userActivities).forEach(([userId, userLogs]) => {
      // 1. Multiple failed actions
      const failedActions = userLogs.filter(
        (log) => log.metadata?.success === false || log.metadata?.error
      );
      if (failedActions.length > 10) {
        suspicious.push({
          type: 'multiple_failed_actions',
          severity: 'medium',
          description: `User has ${failedActions.length} failed actions in the period`,
          user_id: userId,
          timestamp: failedActions[0].created_at,
          details: { failed_count: failedActions.length },
        });
      }

      // 2. Bulk deletions
      const deletions = userLogs.filter((log) => log.action === 'delete');
      if (deletions.length > 20) {
        suspicious.push({
          type: 'bulk_deletions',
          severity: 'high',
          description: `User deleted ${deletions.length} items in the period`,
          user_id: userId,
          timestamp: deletions[0].created_at,
          details: {
            deletion_count: deletions.length,
            entity_types: [...new Set(deletions.map((d) => d.entity_type))],
          },
        });
      }

      // 3. High activity volume
      if (userLogs.length > 500) {
        suspicious.push({
          type: 'high_activity_volume',
          severity: 'low',
          description: `User has ${userLogs.length} actions in the period`,
          user_id: userId,
          timestamp: userLogs[0].created_at,
          details: { action_count: userLogs.length },
        });
      }

      // 4. Data export attempts
      const exports = userLogs.filter((log) => log.entity_type === 'data_export');
      if (exports.length > 3) {
        suspicious.push({
          type: 'multiple_data_exports',
          severity: 'medium',
          description: `User requested ${exports.length} data exports`,
          user_id: userId,
          timestamp: exports[0].created_at,
          details: { export_count: exports.length },
        });
      }

      // 5. After-hours activity (between 11 PM and 5 AM)
      const afterHours = userLogs.filter((log) => {
        const hour = new Date(log.created_at).getHours();
        return hour >= 23 || hour < 5;
      });
      if (afterHours.length > 50) {
        suspicious.push({
          type: 'after_hours_activity',
          severity: 'medium',
          description: `User has ${afterHours.length} actions during unusual hours`,
          user_id: userId,
          timestamp: afterHours[0].created_at,
          details: { after_hours_count: afterHours.length },
        });
      }
    });

    return { data: suspicious.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }), error: null };
  } catch (error) {
    console.error('Error detecting suspicious activity:', error);
    return { data: null, error };
  }
}

/**
 * Get top users by activity
 */
export async function getTopUsers(
  startDate: Date,
  endDate: Date,
  limit: number = 10
): Promise<{ data: Array<{ user_id: string; count: number }> | null; error: any }> {
  try {
    const { data: logs, error } = await getAuditLogs(startDate, endDate);

    if (error) throw error;
    if (!logs) return { data: [], error: null };

    const userCounts: Record<string, number> = {};

    logs.forEach((log) => {
      if (log.user_id) {
        userCounts[log.user_id] = (userCounts[log.user_id] || 0) + 1;
      }
    });

    const topUsers = Object.entries(userCounts)
      .map(([user_id, count]) => ({ user_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return { data: topUsers, error: null };
  } catch (error) {
    console.error('Error getting top users:', error);
    return { data: null, error };
  }
}

/**
 * Export audit logs to CSV
 */
export function exportAuditLogsToCSV(logs: AuditLog[]): string {
  const headers = [
    'Timestamp',
    'User ID',
    'Action',
    'Entity Type',
    'Entity ID',
    'Entity Name',
    'IP Address',
    'User Agent',
  ];

  const rows = logs.map((log) => [
    format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
    log.user_id || 'N/A',
    log.action,
    log.entity_type,
    log.entity_id || 'N/A',
    log.entity_name || 'N/A',
    log.ip_address || 'N/A',
    log.user_agent || 'N/A',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
}

/**
 * Download audit logs as CSV file
 */
export function downloadAuditLogsCSV(logs: AuditLog[], filename: string = 'audit-logs.csv'): void {
  const csvContent = exportAuditLogsToCSV(logs);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Get compliance metrics
 */
export async function getComplianceMetrics(
  startDate: Date,
  endDate: Date
): Promise<{
  data: {
    total_audited_events: number;
    data_access_requests: number;
    data_deletion_requests: number;
    consent_changes: number;
    security_events: number;
    compliance_score: number;
  } | null;
  error: any;
}> {
  try {
    const { data: logs, error } = await getAuditLogs(startDate, endDate);

    if (error) throw error;
    if (!logs) {
      return {
        data: {
          total_audited_events: 0,
          data_access_requests: 0,
          data_deletion_requests: 0,
          consent_changes: 0,
          security_events: 0,
          compliance_score: 100,
        },
        error: null,
      };
    }

    const dataAccessRequests = logs.filter((log) => log.entity_type === 'data_export').length;
    const dataDeletionRequests = logs.filter(
      (log) => log.entity_type === 'account_deletion'
    ).length;
    const consentChanges = logs.filter((log) => log.entity_type === 'consent').length;
    const securityEvents = logs.filter(
      (log) => log.entity_type === 'security_event' || log.action === 'failed_login'
    ).length;

    // Simple compliance score calculation (can be made more sophisticated)
    let complianceScore = 100;
    if (securityEvents > 100) complianceScore -= 10;
    if (dataDeletionRequests > 50) complianceScore -= 5;
    complianceScore = Math.max(0, complianceScore);

    return {
      data: {
        total_audited_events: logs.length,
        data_access_requests: dataAccessRequests,
        data_deletion_requests: dataDeletionRequests,
        consent_changes: consentChanges,
        security_events: securityEvents,
        compliance_score: complianceScore,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error calculating compliance metrics:', error);
    return { data: null, error };
  }
}
