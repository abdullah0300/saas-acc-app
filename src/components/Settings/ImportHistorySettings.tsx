import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Upload, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileText, 
  Users, 
  Receipt,
  Calendar,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';

interface ImportRecord {
  id: string;
  import_session_id: string;
  import_date: string;
  file_name: string;
  import_type: string;
  import_summary: {
    total_records: number;
    invoices_created: number;
    expenses_created: number;
    categories_created: number;
    clients_created: number;
    vendors_created: number;
    errors: string[];
  };
  can_undo_until: string;
  is_undone: boolean;
  undone_at?: string;
  undo_results?: any;
  created_at: string;
}

// Helper function to format dates
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper function to get relative time
const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    return 'Less than an hour ago';
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hours ago`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }
};

export const ImportHistorySettings: React.FC = () => {
  const { user } = useAuth();
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadImportHistory();
    }
  }, [user]);

  const loadImportHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('import_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setImports(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUndoImport = async (importRecord: ImportRecord) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    const canUndo = new Date() < new Date(importRecord.can_undo_until);
    
    if (!canUndo) {
      setError('This import can no longer be undone (48-hour limit exceeded)');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to undo this import?\n\n` +
      `This will remove:\n` +
      `• ${importRecord.import_summary.invoices_created} invoices\n` +
      `• ${importRecord.import_summary.expenses_created} expense records\n` +
      `• ${importRecord.import_summary.clients_created} clients (if not used elsewhere)\n` +
      `• ${importRecord.import_summary.categories_created} categories (if not used elsewhere)\n\n` +
      `This action cannot be reversed.`
    );

    if (!confirmed) return;

    try {
      setUndoingId(importRecord.id);
      setError('');
      setSuccess('');

      const { data, error: undoError } = await supabase.functions.invoke('undo-import', {
        body: {
          userId: user.id,
          importSessionId: importRecord.import_session_id
        }
      });

      if (undoError || !data.success) {
        throw new Error(data?.error || undoError?.message || 'Undo failed');
      }

      setSuccess(data.message || 'Import successfully undone');
      await loadImportHistory(); // Refresh the list

    } catch (err: any) {
      setError(err.message);
    } finally {
      setUndoingId(null);
    }
  };

  const getStatusBadge = (importRecord: ImportRecord) => {
    if (importRecord.is_undone) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <RotateCcw className="w-3 h-3 mr-1" />
          Undone
        </span>
      );
    }

    const canUndo = new Date() < new Date(importRecord.can_undo_until);
    if (canUndo) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3 mr-1" />
        Expired
      </span>
    );
  };

  const canUndoImport = (importRecord: ImportRecord) => {
    return !importRecord.is_undone && new Date() < new Date(importRecord.can_undo_until);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Import History</h2>
        <p className="text-gray-600 mt-1">
          View and manage your data imports. You can undo imports within 48 hours.
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-900">Error</h4>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-900">Success</h4>
            <p className="text-green-700 text-sm mt-1">{success}</p>
          </div>
        </div>
      )}

      {/* Import History List */}
      {imports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No imports yet</h3>
          <p className="text-gray-500">
            When you import data using our AI Import wizard, you'll see the history here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {imports.map((importRecord) => (
            <div
              key={importRecord.id}
              className="bg-white rounded-lg shadow border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {importRecord.file_name || 'Unknown file'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Imported {getRelativeTime(importRecord.import_date)}
                      </p>
                    </div>
                  </div>

                  {/* Import Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-600">
                        {importRecord.import_summary.invoices_created} invoices
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-gray-600">
                        {importRecord.import_summary.expenses_created} expenses
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-600">
                        {importRecord.import_summary.clients_created} clients
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-gray-600">
                        {importRecord.import_summary.categories_created} categories
                      </span>
                    </div>
                  </div>

                  {/* Errors if any */}
                  {importRecord.import_summary.errors && importRecord.import_summary.errors.length > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-amber-900">
                            {importRecord.import_summary.errors.length} issues during import
                          </h4>
                          <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
                            {importRecord.import_summary.errors.slice(0, 3).map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                            {importRecord.import_summary.errors.length > 3 && (
                              <li>... and {importRecord.import_summary.errors.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Undo Information */}
                  {!importRecord.is_undone && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {canUndoImport(importRecord) ? (
                        <span>
                          Can undo until {formatDate(importRecord.can_undo_until)}
                        </span>
                      ) : (
                        <span>Undo period expired</span>
                      )}
                    </div>
                  )}

                  {/* Undo Results */}
                  {importRecord.is_undone && importRecord.undo_results && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Undone on:</strong> {formatDate(importRecord.undone_at!)}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
                        <span>{importRecord.undo_results.invoicesDeleted} invoices removed</span>
                        <span>{importRecord.undo_results.expensesDeleted} expenses removed</span>
                        <span>{importRecord.undo_results.clientsDeleted} clients removed</span>
                        <span>{importRecord.undo_results.categoriesDeleted} categories removed</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 ml-4">
                  {getStatusBadge(importRecord)}
                  
                  {canUndoImport(importRecord) && (
                    <button
                      onClick={() => handleUndoImport(importRecord)}
                      disabled={undoingId === importRecord.id}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {undoingId === importRecord.id ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border border-red-600 border-t-transparent mr-2"></div>
                          Undoing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3 h-3 mr-1" />
                          Undo Import
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 mb-2">About Import History</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• You can undo any import within 48 hours of importing</p>
          <p>• Undoing an import will only remove data that isn't used by other records</p>
          <p>• For example, if you manually added expenses to a category created during import, that category won't be deleted</p>
          <p>• Import history is kept for your records, even after the undo period expires</p>
        </div>
      </div>
    </div>
  );
};