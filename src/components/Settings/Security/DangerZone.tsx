// src/components/Settings/Security/DangerZone.tsx
import React, { useState } from 'react';
import { AlertTriangle, Trash2, Download } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabaseClient';
import { ExportService } from '../../../services/exportService';
import { startOfYear, format } from 'date-fns';
import { useData } from '../../../contexts/DataContext';

export const DangerZone: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { teamId } = useData();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportingData, setExportingData] = useState(false);

  const handleExportData = async () => {
    if (!user) return;
    
    setExportingData(true);
    
    try {
      // Export all user data using the existing ExportService
      // Create a comprehensive export by calling multiple export types
      const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm');
      
      // Export summary data
      await ExportService.exportData('summary', user.id, { 
        dateRange: { 
          start: '2020-01-01', 
          end: format(new Date(), 'yyyy-MM-dd') 
        } 
      });
      
      // Small delay between exports to avoid overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Export detailed data
      await ExportService.exportData('detailed', user.id, { 
        dateRange: { 
          start: format(startOfYear(new Date()), 'yyyy-MM-dd'), 
          end: format(new Date(), 'yyyy-MM-dd') 
        } 
      });
      
      // Another small delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Export tax data for current year
      await ExportService.exportData('tax', user.id, {
        dateRange: { 
          start: format(startOfYear(new Date()), 'yyyy-MM-dd'), 
          end: format(new Date(), 'yyyy-MM-dd') 
        }
      });
    } catch (err: any) {
      setError('Failed to export data. Please try again.');
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmation !== 'DELETE') return;
    
    setLoading(true);
    setError('');
    
    try {
      // Check if user is a team owner
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', user.id)
        .neq('user_id', user.id) // Exclude self
        .eq('status', 'active');
      
      if (teamMembers && teamMembers.length > 0) {
        setError('You cannot delete your account while you have active team members. Please remove all team members first.');
        setLoading(false);
        return;
      }

      // Check for active subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (subscription?.stripe_subscription_id && subscription.status === 'active') {
        setError('Please cancel your subscription before deleting your account.');
        setLoading(false);
        return;
      }

      // Call edge function to delete account
      const { error: deleteError } = await supabase.functions.invoke('delete-user-account', {
        body: { userId: user.id }
      });
      
      if (deleteError) throw deleteError;
      
      // Sign out and redirect
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Failed to delete account. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
            Danger Zone
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Irreversible actions that affect your account
          </p>
        </div>

        {/* Export Data */}
        <div className="border border-gray-200 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Export Account Data</h4>
          <p className="text-sm text-gray-600 mb-3">
            Download all your data including invoices, expenses, and client information.
          </p>
          <button
            onClick={handleExportData}
            disabled={exportingData}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {exportingData ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Download className="h-5 w-5 mr-2" />
            )}
            Export All Data
          </button>
        </div>

        {/* Delete Account */}
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h4 className="text-sm font-medium text-red-900 mb-2">Delete Account</h4>
          <p className="text-sm text-red-700 mb-3">
            Once you delete your account, there is no going back. All your data will be permanently removed.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">Delete Account</h3>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <p className="text-sm text-gray-600 mb-4">
              This action cannot be undone. This will permanently delete:
            </p>
            
            <ul className="text-sm text-gray-600 mb-4 ml-4 list-disc">
              <li>All your invoices and financial records</li>
              <li>Client and vendor information</li>
              <li>Categories and settings</li>
              <li>Team memberships</li>
            </ul>

            <p className="text-sm text-gray-900 font-medium mb-2">
              Type <span className="font-mono bg-gray-100 px-2 py-1 rounded">DELETE</span> to confirm:
            </p>
            
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              placeholder="Type DELETE"
            />

            <div className="flex space-x-3">
              <button
                onClick={handleDeleteAccount}
                disabled={loading || deleteConfirmation !== 'DELETE'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : 'Delete My Account'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                  setError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};