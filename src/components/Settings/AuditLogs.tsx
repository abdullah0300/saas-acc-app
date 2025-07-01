// src/components/Settings/AuditLogs.tsx
import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  Filter, 
  Download, 
  User, 
  Calendar,
  Activity,
  FileText,
  Eye,
  Edit,
  Trash,
  Plus,
  LogIn,
  LogOut,
  AlertCircle,
  ChevronDown,
  Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTeamPermissions } from '../../hooks/useTeamPermissions';
import { auditService, AuditAction, EntityType } from '../../services/auditService';
import { supabase } from '../../services/supabaseClient';
import { format, subDays } from 'date-fns';

interface AuditLog {
  id: string;
  user_id: string;
  team_id?: string;
  action: AuditAction;
  entity_type?: EntityType;
  entity_id?: string;
  entity_name?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
  user?: {
    email: string;
    full_name?: string;
  };
}

export const AuditLogs: React.FC = () => {
  const { user } = useAuth();
  const { teamId, canManageTeam, isOwner } = useTeamPermissions();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    userId: '',
    dateRange: '7', // days
    searchTerm: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    loadAuditLogs();
  }, [filters, teamId]);

  const loadAuditLogs = async () => {
    if (!user || !teamId) return;
    
    try {
      setLoading(true);
      
      const startDate = filters.dateRange === 'all' 
        ? undefined 
        : subDays(new Date(), parseInt(filters.dateRange)).toISOString();
      
      const auditLogs = await auditService.getAuditLogs({
        teamId: isOwner || canManageTeam ? teamId : user.id,
        action: filters.action as AuditAction || undefined,
        entityType: filters.entityType as EntityType || undefined,
        userId: filters.userId || undefined,
        startDate,
        limit: 100
      });
      
      // Fetch user details for each log
      const userIds = Array.from(new Set(auditLogs.map(log => log.user_id)));
      const { data: users } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);
      
      const usersMap = new Map(users?.map((u: any) => [u.id, u]) || []);
      
      const logsWithUsers = auditLogs.map(log => ({
        ...log,
        user: usersMap.get(log.user_id) as { email: string; full_name?: string } | undefined
      }));
      
      // Apply search filter
      const filtered = filters.searchTerm 
        ? logsWithUsers.filter(log => 
            log.entity_name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            log.user?.email.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            log.user?.full_name?.toLowerCase().includes(filters.searchTerm.toLowerCase())
          )
        : logsWithUsers;
      
      setLogs(filtered);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: AuditAction) => {
    const icons: Partial<Record<AuditAction, any>> = {
      login: LogIn,
      logout: LogOut,
      login_failed: AlertCircle,
      create: Plus,
      update: Edit,
      delete: Trash,
      view: Eye,
      export: Download,
      settings_updated: Activity
    };
    const Icon = icons[action] || Activity;
    return <Icon className="h-4 w-4" />;
  };

  const getActionColor = (action: AuditAction) => {
    const colors: Partial<Record<AuditAction, string>> = {
      login: 'text-green-600 bg-green-50',
      logout: 'text-gray-600 bg-gray-50',
      login_failed: 'text-red-600 bg-red-50',
      create: 'text-blue-600 bg-blue-50',
      update: 'text-yellow-600 bg-yellow-50',
      delete: 'text-red-600 bg-red-50',
      view: 'text-purple-600 bg-purple-50',
      export: 'text-indigo-600 bg-indigo-50',
      settings_updated: 'text-orange-600 bg-orange-50'
    };
    return colors[action] || 'text-gray-600 bg-gray-50';
  };

  const formatChanges = (changes: Record<string, any>) => {
    return Object.entries(changes).map(([key, value]) => (
      <div key={key} className="text-sm">
        <span className="font-medium">{key}:</span>{' '}
        <span className="text-red-600 line-through">{value.from}</span>{' '}
        <span className="text-gray-500">→</span>{' '}
        <span className="text-green-600">{value.to}</span>
      </div>
    ));
  };

  const exportAuditLogs = () => {
    const csv = [
      ['Date', 'User', 'Action', 'Entity Type', 'Entity', 'Changes'].join(','),
      ...logs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.user?.email || log.user_id,
        log.action,
        log.entity_type || '',
        log.entity_name || '',
        JSON.stringify(log.changes || {})
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    
    // Log the export
    auditService.logExport('report', { type: 'audit_logs', count: logs.length });
  };

  if (!isOwner && !canManageTeam) {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">You don't have permission to view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Trail</h2>
          <p className="text-gray-600 mt-1">Track all activities and changes in your account</p>
        </div>
        <button
          onClick={exportAuditLogs}
          disabled={logs.length === 0}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center flex-1 mr-4">
            <Search className="h-5 w-5 text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search by user or entity..."
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              className="flex-1 outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="view">View</option>
                <option value="export">Export</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
              <select
                value={filters.entityType}
                onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="invoice">Invoices</option>
                <option value="client">Clients</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
                <option value="team_member">Team</option>
                <option value="settings">Settings</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilters({
                  action: '',
                  entityType: '',
                  userId: '',
                  dateRange: '7',
                  searchTerm: ''
                })}
                className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No audit logs found for the selected filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.map((log) => (
              <div
                key={log.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`p-2 rounded-lg ${getActionColor(log.action)}`}>
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900">
                            {log.user?.full_name || log.user?.email || 'Unknown User'}
                          </p>
                          <span className="text-gray-500">•</span>
                          <p className="text-gray-600">
                            {log.action.replace('_', ' ')}
                            {log.entity_type && ` ${log.entity_type}`}
                            {log.entity_name && ` "${log.entity_name}"`}
                          </p>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                          </div>
                          {log.metadata?.ip_address && (
                            <span>IP: {log.metadata.ip_address}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronDown 
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        expandedLog === log.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                {expandedLog === log.id && (
                  <div className="px-4 pb-4 border-t bg-gray-50">
                    <div className="mt-4 space-y-3">
                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Changes</h4>
                          <div className="bg-white rounded p-3 space-y-1">
                            {formatChanges(log.changes)}
                          </div>
                        </div>
                      )}
                      
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Details</h4>
                          <div className="bg-white rounded p-3">
                            <pre className="text-xs text-gray-600 overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};