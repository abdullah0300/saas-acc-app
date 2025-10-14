// src/components/Settings/DataProtection/DataRetention.tsx
// 🔴 GDPR Article 5.1(e): Storage Limitation - Data Retention Policy

import React, { useState, useEffect } from "react";
import { AlertCircle, Calendar, CheckCircle, Clock, Database, Info, Trash2, FileText } from "lucide-react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../contexts/AuthContext";
import { format, parseISO, addYears, differenceInDays } from "date-fns";

interface RetentionStats {
  income_records: {
    total: number;
    expired: number;
    oldest_date: string | null;
  };
  expense_records: {
    total: number;
    expired: number;
    oldest_date: string | null;
  };
  audit_logs: {
    total: number;
    expired: number;
    oldest_date: string | null;
  };
}

interface RetentionRecord {
  id: string;
  table_name: string;
  record_date: string;
  description: string;
  retention_expires: string;
  days_until_deletion: number;
}

export const DataRetention: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [expiringRecords, setExpiringRecords] = useState<RetentionRecord[]>([]);
  const [cleaning, setCleaning] = useState(false);
  const [lastCleanup, setLastCleanup] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadRetentionData();
    }
  }, [user?.id]);

  const loadRetentionData = async () => {
    setLoading(true);
    try {
      // Get retention statistics for each table
      const [incomeData, expenseData, auditData] = await Promise.all([
        getTableStats('income', 6), // 6 years retention
        getTableStats('expenses', 6), // 6 years retention
        getAuditLogStats(7), // 7 years retention
      ]);

      setStats({
        income_records: incomeData,
        expense_records: expenseData,
        audit_logs: auditData,
      });

      // Get records expiring soon (within 90 days)
      await loadExpiringRecords();

      // Get last cleanup timestamp
      await loadLastCleanup();
    } catch (error) {
      console.error('Error loading retention data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTableStats = async (tableName: string, retentionYears: number) => {
    const cutoffDate = addYears(new Date(), -retentionYears);

    // Get total count
    const { count: total } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id);

    // Get expired count (records older than retention period)
    const { count: expired } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id)
      .lt('date', format(cutoffDate, 'yyyy-MM-dd'));

    // Get oldest record
    const { data: oldestRecord } = await supabase
      .from(tableName)
      .select('date')
      .eq('user_id', user?.id)
      .order('date', { ascending: true })
      .limit(1)
      .single();

    return {
      total: total || 0,
      expired: expired || 0,
      oldest_date: oldestRecord?.date || null,
    };
  };

  const getAuditLogStats = async (retentionYears: number) => {
    const cutoffDate = addYears(new Date(), -retentionYears);

    // Get total count
    const { count: total } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id);

    // Get expired count
    const { count: expired } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id)
      .lt('created_at', cutoffDate.toISOString());

    // Get oldest record
    const { data: oldestRecord } = await supabase
      .from('audit_logs')
      .select('created_at')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    return {
      total: total || 0,
      expired: expired || 0,
      oldest_date: oldestRecord?.created_at || null,
    };
  };

  const loadExpiringRecords = async () => {
    const records: RetentionRecord[] = [];
    const now = new Date();
    const warnWindow = addYears(now, -6); // 6 years ago
    const warnWindowEnd = addYears(now, -6);
    warnWindowEnd.setDate(warnWindowEnd.getDate() + 90); // Next 90 days

    // Get income records expiring soon
    const { data: incomeRecords } = await supabase
      .from('income')
      .select('id, date, description')
      .eq('user_id', user?.id)
      .gte('date', format(addYears(now, -6), 'yyyy-MM-dd'))
      .lt('date', format(addYears(now, -6).setDate(addYears(now, -6).getDate() + 90), 'yyyy-MM-dd'))
      .order('date', { ascending: true })
      .limit(10);

    if (incomeRecords) {
      incomeRecords.forEach(record => {
        const expiresDate = addYears(parseISO(record.date), 6);
        const daysUntil = differenceInDays(expiresDate, now);

        records.push({
          id: record.id,
          table_name: 'income',
          record_date: record.date,
          description: record.description,
          retention_expires: expiresDate.toISOString(),
          days_until_deletion: daysUntil,
        });
      });
    }

    // Get expense records expiring soon
    const { data: expenseRecords } = await supabase
      .from('expenses')
      .select('id, date, description')
      .eq('user_id', user?.id)
      .gte('date', format(addYears(now, -6), 'yyyy-MM-dd'))
      .lt('date', format(addYears(now, -6).setDate(addYears(now, -6).getDate() + 90), 'yyyy-MM-dd'))
      .order('date', { ascending: true })
      .limit(10);

    if (expenseRecords) {
      expenseRecords.forEach(record => {
        const expiresDate = addYears(parseISO(record.date), 6);
        const daysUntil = differenceInDays(expiresDate, now);

        records.push({
          id: record.id,
          table_name: 'expenses',
          record_date: record.date,
          description: record.description,
          retention_expires: expiresDate.toISOString(),
          days_until_deletion: daysUntil,
        });
      });
    }

    // Sort by days until deletion
    records.sort((a, b) => a.days_until_deletion - b.days_until_deletion);
    setExpiringRecords(records);
  };

  const loadLastCleanup = async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('created_at')
      .eq('user_id', user?.id)
      .eq('action', 'cleanup')
      .eq('entity_type', 'data_retention')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setLastCleanup(data.created_at);
    }
  };

  const handleCleanupExpiredData = async () => {
    const confirmed = window.confirm(
      'This will permanently delete financial records older than 6 years and audit logs older than 7 years. ' +
      'This action cannot be undone. Are you sure you want to continue?'
    );

    if (!confirmed) return;

    setCleaning(true);
    try {
      const cutoffDate = addYears(new Date(), -6);
      const auditCutoffDate = addYears(new Date(), -7);

      let totalDeleted = 0;

      // Delete expired income records
      const { data: expiredIncome, error: incomeError } = await supabase
        .from('income')
        .delete()
        .eq('user_id', user?.id)
        .lt('date', format(cutoffDate, 'yyyy-MM-dd'))
        .select();

      if (incomeError) throw incomeError;
      totalDeleted += expiredIncome?.length || 0;

      // Delete expired expense records
      const { data: expiredExpenses, error: expenseError } = await supabase
        .from('expenses')
        .delete()
        .eq('user_id', user?.id)
        .lt('date', format(cutoffDate, 'yyyy-MM-dd'))
        .select();

      if (expenseError) throw expenseError;
      totalDeleted += expiredExpenses?.length || 0;

      // Delete expired audit logs
      const { data: expiredAudit, error: auditError } = await supabase
        .from('audit_logs')
        .delete()
        .eq('user_id', user?.id)
        .lt('created_at', auditCutoffDate.toISOString())
        .select();

      if (auditError) throw auditError;
      totalDeleted += expiredAudit?.length || 0;

      // Log the cleanup action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'cleanup',
        entity_type: 'data_retention',
        entity_name: 'Automated Data Retention Cleanup',
        metadata: {
          records_deleted: totalDeleted,
          income_deleted: expiredIncome?.length || 0,
          expenses_deleted: expiredExpenses?.length || 0,
          audit_logs_deleted: expiredAudit?.length || 0,
          cutoff_date: format(cutoffDate, 'yyyy-MM-dd'),
          audit_cutoff_date: auditCutoffDate.toISOString(),
          executed_at: new Date().toISOString(),
        },
      });

      alert(`Successfully deleted ${totalDeleted} expired records.`);

      // Reload data
      await loadRetentionData();
    } catch (error: any) {
      console.error('Error cleaning up data:', error);
      alert('Error cleaning up data: ' + error.message);
    } finally {
      setCleaning(false);
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h2 className="text-xl font-semibold text-gray-900">Data Retention Policy</h2>
        <p className="mt-2 text-sm text-gray-600">
          Manage how long your data is stored in compliance with UK GDPR and HMRC requirements.
        </p>
      </div>

      {/* UK Legal Requirements */}
      <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
        <div className="flex">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">UK Legal Requirements</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Financial Records:</strong> Must be kept for 6 years after the tax year end (HMRC requirement)</li>
                <li><strong>Audit Logs:</strong> 7 years retention recommended (GDPR Article 30 compliance)</li>
                <li><strong>Personal Data:</strong> Only kept as long as necessary (GDPR Article 5.1(e))</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Retention Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income Records */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">Income Records</h3>
            <Database className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Records:</span>
              <span className="font-semibold text-gray-900">{stats?.income_records.total || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Expired (6+ years):</span>
              <span className="font-semibold text-red-600">{stats?.income_records.expired || 0}</span>
            </div>
            {stats?.income_records.oldest_date && (
              <div className="text-xs text-gray-500 mt-2">
                Oldest: {format(parseISO(stats.income_records.oldest_date), 'MMM dd, yyyy')}
              </div>
            )}
          </div>
        </div>

        {/* Expense Records */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">Expense Records</h3>
            <Database className="h-5 w-5 text-red-600" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Records:</span>
              <span className="font-semibold text-gray-900">{stats?.expense_records.total || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Expired (6+ years):</span>
              <span className="font-semibold text-red-600">{stats?.expense_records.expired || 0}</span>
            </div>
            {stats?.expense_records.oldest_date && (
              <div className="text-xs text-gray-500 mt-2">
                Oldest: {format(parseISO(stats.expense_records.oldest_date), 'MMM dd, yyyy')}
              </div>
            )}
          </div>
        </div>

        {/* Audit Logs */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">Audit Logs</h3>
            <FileText className="h-5 w-5 text-purple-600" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Logs:</span>
              <span className="font-semibold text-gray-900">{stats?.audit_logs.total || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Expired (7+ years):</span>
              <span className="font-semibold text-red-600">{stats?.audit_logs.expired || 0}</span>
            </div>
            {stats?.audit_logs.oldest_date && (
              <div className="text-xs text-gray-500 mt-2">
                Oldest: {format(parseISO(stats.audit_logs.oldest_date), 'MMM dd, yyyy HH:mm')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cleanup Action */}
      {(stats?.income_records.expired || 0) + (stats?.expense_records.expired || 0) + (stats?.audit_logs.expired || 0) > 0 && (
        <div className="rounded-lg bg-red-50 p-6 border border-red-200">
          <div className="flex items-start">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Expired Records Found</h3>
              <p className="text-sm text-red-700 mb-4">
                You have {(stats?.income_records.expired || 0) + (stats?.expense_records.expired || 0) + (stats?.audit_logs.expired || 0)} records
                that have exceeded their retention period. You can safely delete these records to comply with GDPR storage limitation requirements.
              </p>
              <button
                onClick={handleCleanupExpiredData}
                disabled={cleaning}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cleaning ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Cleaning Up...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Expired Records
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Cleanup Info */}
      {lastCleanup && (
        <div className="text-sm text-gray-600">
          <CheckCircle className="h-4 w-4 inline mr-1 text-green-600" />
          Last cleanup: {format(parseISO(lastCleanup), 'MMM dd, yyyy HH:mm')}
        </div>
      )}

      {/* Records Expiring Soon */}
      {expiringRecords.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Records Expiring Soon</h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Record Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires In
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expiringRecords.map((record) => (
                  <tr key={`${record.table_name}-${record.id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        record.table_name === 'income'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {record.table_name === 'income' ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {record.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(parseISO(record.record_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`font-medium ${
                        record.days_until_deletion < 30 ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {record.days_until_deletion} days
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Retention Policy Details */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">How Data Retention Works</h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start">
            <Calendar className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Automatic Expiration:</strong> Financial records (income and expenses) automatically expire 6 years after their transaction date, as required by HMRC.
            </div>
          </div>
          <div className="flex items-start">
            <Trash2 className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Manual Cleanup:</strong> Expired records are not automatically deleted. You must manually trigger cleanup to permanently remove them.
            </div>
          </div>
          <div className="flex items-start">
            <FileText className="h-5 w-5 text-purple-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Audit Trail:</strong> All cleanup actions are logged in the audit trail for compliance purposes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
