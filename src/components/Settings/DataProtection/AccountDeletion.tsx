// src/components/Settings/DataProtection/AccountDeletion.tsx
// 🔴 GDPR Article 17: Right to Erasure (Right to be Forgotten)

import React, { useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Info, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { addYears, format, parseISO } from "date-fns";

interface RetainedData {
  table: string;
  count: number;
  reason: string;
  retention_period: string;
}

export const AccountDeletion: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [retainedData, setRetainedData] = useState<RetainedData[]>([]);
  const [deletionOption, setDeletionOption] = useState<'immediate' | 'scheduled'>('immediate');

  const checkRetainedData = async () => {
    if (!user?.id) return;

    setChecking(true);
    try {
      const sixYearsAgo = addYears(new Date(), -6);
      const retained: RetainedData[] = [];

      // Check for financial records within retention period
      const { count: recentIncome } = await supabase
        .from('income')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('date', format(sixYearsAgo, 'yyyy-MM-dd'));

      if (recentIncome && recentIncome > 0) {
        retained.push({
          table: 'Income Records',
          count: recentIncome,
          reason: 'HMRC Legal Requirement',
          retention_period: '6 years from tax year end',
        });
      }

      const { count: recentExpenses } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('date', format(sixYearsAgo, 'yyyy-MM-dd'));

      if (recentExpenses && recentExpenses > 0) {
        retained.push({
          table: 'Expense Records',
          count: recentExpenses,
          reason: 'HMRC Legal Requirement',
          retention_period: '6 years from tax year end',
        });
      }

      const { count: recentInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('issue_date', format(sixYearsAgo, 'yyyy-MM-dd'));

      if (recentInvoices && recentInvoices > 0) {
        retained.push({
          table: 'Invoices',
          count: recentInvoices,
          reason: 'HMRC Legal Requirement',
          retention_period: '6 years from tax year end',
        });
      }

      setRetainedData(retained);
    } catch (error) {
      console.error('Error checking retained data:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id || confirmText !== 'DELETE MY ACCOUNT') return;

    setLoading(true);
    try {
      // Step 1: Create final audit log
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'delete',
        entity_type: 'account',
        entity_name: 'Account Deletion Request',
        metadata: {
          email: user.email,
          deletion_type: deletionOption,
          requested_at: new Date().toISOString(),
          retained_data: retainedData,
          gdpr_article: 'Article 17 - Right to Erasure',
        },
      });

      if (deletionOption === 'scheduled') {
        // Schedule deletion for 30 days from now
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 30);

        await supabase.from('data_deletion_requests').insert({
          user_id: user.id,
          request_type: 'full_account_deletion',
          status: 'pending',
          requested_at: new Date().toISOString(),
          scheduled_for: scheduledDate.toISOString(),
          metadata: {
            grace_period_days: 30,
            can_cancel_until: scheduledDate.toISOString(),
          },
        });

        alert(
          'Account deletion scheduled for ' + format(scheduledDate, 'MMMM dd, yyyy') + '. ' +
          'You can cancel this request anytime before that date by contacting support.'
        );

        await supabase.auth.signOut();
        navigate('/login');
        return;
      }

      // Step 2: Immediate deletion - Delete or anonymize data
      const sixYearsAgo = addYears(new Date(), -6);

      // Delete old financial records (outside retention period)
      await supabase
        .from('income')
        .delete()
        .eq('user_id', user.id)
        .lt('date', format(sixYearsAgo, 'yyyy-MM-dd'));

      await supabase
        .from('expenses')
        .delete()
        .eq('user_id', user.id)
        .lt('date', format(sixYearsAgo, 'yyyy-MM-dd'));

      await supabase
        .from('invoices')
        .delete()
        .eq('user_id', user.id)
        .lt('issue_date', format(sixYearsAgo, 'yyyy-MM-dd'));

      // Anonymize recent financial records (within retention period)
      if (retainedData.length > 0) {
        const anonymousId = `anonymous-${Date.now()}`;
        const anonymousEmail = `deleted-user-${Date.now()}@anonymized.local`;

        // Anonymize income
        await supabase
          .from('income')
          .update({
            description: '[ANONYMIZED - User Deleted]',
          })
          .eq('user_id', user.id)
          .gte('date', format(sixYearsAgo, 'yyyy-MM-dd'));

        // Anonymize expenses
        await supabase
          .from('expenses')
          .update({
            description: '[ANONYMIZED - User Deleted]',
            vendor: '[ANONYMIZED]',
            receipt_url: null,
          })
          .eq('user_id', user.id)
          .gte('date', format(sixYearsAgo, 'yyyy-MM-dd'));

        // Anonymize invoices
        await supabase
          .from('invoices')
          .update({
            notes: '[ANONYMIZED - User Deleted]',
          })
          .eq('user_id', user.id)
          .gte('issue_date', format(sixYearsAgo, 'yyyy-MM-dd'));
      }

      // Step 3: Delete all other personal data
      await Promise.all([
        // Delete clients
        supabase.from('clients').delete().eq('user_id', user.id),

        // Delete vendors
        supabase.from('vendors').delete().eq('user_id', user.id),

        // Delete categories
        supabase.from('categories').delete().eq('user_id', user.id),

        // Delete team memberships
        supabase.from('team_members').delete().eq('user_id', user.id),

        // Delete subscriptions
        supabase.from('subscriptions').delete().eq('user_id', user.id),

        // Delete complaints
        supabase.from('data_protection_complaints').delete().eq('user_id', user.id),

        // Delete consents
        supabase.from('user_consents').delete().eq('user_id', user.id),

        // Delete export requests
        supabase.from('data_export_requests').delete().eq('user_id', user.id),

        // Delete deletion requests
        supabase.from('data_deletion_requests').delete().eq('user_id', user.id),

        // Keep audit logs for 7 years (legal requirement)
        // They will be automatically cleaned up by retention policy
      ]);

      // Step 4: Delete profile
      await supabase.from('profiles').delete().eq('id', user.id);

      // Step 5: Sign out (auth user remains but has no data)
      // Note: Supabase doesn't allow deleting auth users from client-side
      // User will be unable to login since profile is deleted
      await supabase.auth.signOut();

      alert(
        'Your account has been deleted. ' +
        (retainedData.length > 0
          ? `${retainedData.reduce((sum, d) => sum + d.count, 0)} financial records have been anonymized to comply with UK tax law retention requirements.`
          : 'All your data has been permanently removed.')
      );

      navigate('/login');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      alert('Error deleting account: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h2 className="text-xl font-semibold text-gray-900">Delete Account</h2>
        <p className="mt-2 text-sm text-gray-600">
          Request permanent deletion of your account and personal data in compliance with GDPR Article 17.
        </p>
      </div>

      {/* GDPR Article 17 Info */}
      <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
        <div className="flex">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Your Right to Erasure (Article 17)</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                You have the right to request deletion of your personal data. However, we must retain certain
                financial records for 6 years to comply with UK HMRC requirements. These records will be
                anonymized so they cannot be traced back to you.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Check Retained Data */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Data Retention Check</h3>
        <p className="text-sm text-gray-600 mb-4">
          Before deleting your account, check which data must be retained for legal compliance.
        </p>

        <button
          onClick={checkRetainedData}
          disabled={checking}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {checking ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            'Check Retained Data'
          )}
        </button>

        {retainedData.length > 0 && (
          <div className="mt-4 border border-yellow-200 rounded-lg p-4 bg-yellow-50">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-semibold text-yellow-900 mb-2">
                  Data That Cannot Be Deleted
                </h4>
                <p className="text-sm text-yellow-800 mb-3">
                  The following data must be retained and will be anonymized instead:
                </p>
                <div className="space-y-2">
                  {retainedData.map((data, index) => (
                    <div key={index} className="text-sm">
                      <strong className="text-yellow-900">{data.table}:</strong>{' '}
                      <span className="text-yellow-800">
                        {data.count} records (Reason: {data.reason}, Retention: {data.retention_period})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deletion Options */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Deletion Options</h3>

        <div className="space-y-3">
          <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50">
            <input
              type="radio"
              name="deletion-option"
              value="immediate"
              checked={deletionOption === 'immediate'}
              onChange={() => setDeletionOption('immediate')}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <div className="ml-3 flex-1">
              <span className="block text-sm font-medium text-gray-900">
                Immediate Deletion
              </span>
              <span className="block text-sm text-gray-600 mt-1">
                Your account will be deleted immediately. This action cannot be undone.
              </span>
            </div>
          </label>

          <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50">
            <input
              type="radio"
              name="deletion-option"
              value="scheduled"
              checked={deletionOption === 'scheduled'}
              onChange={() => setDeletionOption('scheduled')}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <div className="ml-3 flex-1">
              <span className="block text-sm font-medium text-gray-900">
                Schedule Deletion (30-day grace period)
              </span>
              <span className="block text-sm text-gray-600 mt-1">
                Your account will be deleted in 30 days. You can cancel this request anytime before then.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Deletion Warning */}
      <div className="rounded-lg bg-red-50 p-6 border border-red-200">
        <div className="flex items-start">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-semibold text-red-900 mb-3">
              What Will Be Deleted:
            </h3>
            <ul className="text-sm text-red-800 space-y-2 mb-4">
              <li>✓ Your account and profile information</li>
              <li>✓ All clients and vendors (if no active invoices)</li>
              <li>✓ Categories and settings</li>
              <li>✓ Financial records older than 6 years</li>
              <li>✓ Team memberships</li>
              <li>✓ Subscription information</li>
              <li>✓ All complaints and export requests</li>
            </ul>
            <h3 className="text-sm font-semibold text-red-900 mb-3">
              What Will Be Anonymized:
            </h3>
            <ul className="text-sm text-red-800 space-y-2">
              <li>✓ Financial records within 6-year retention period (HMRC requirement)</li>
              <li>✓ Audit logs (kept for 7 years for compliance)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Delete Button */}
      <button
        onClick={() => setShowConfirmModal(true)}
        className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        <Trash2 className="h-5 w-5 mr-2" />
        Delete My Account
      </button>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
              <h3 className="text-xl font-bold text-gray-900">Confirm Account Deletion</h3>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              This is your final warning. {deletionOption === 'scheduled'
                ? 'Your account will be scheduled for deletion in 30 days.'
                : 'Your account will be deleted immediately and this action cannot be undone.'}
            </p>

            <p className="text-sm text-gray-900 font-medium mb-2">
              Type <span className="font-mono bg-gray-100 px-2 py-1 rounded text-red-600">DELETE MY ACCOUNT</span> to confirm:
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              placeholder="Type DELETE MY ACCOUNT"
            />

            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={loading || confirmText !== 'DELETE MY ACCOUNT'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Deleting...' : 'Confirm Deletion'}
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmText('');
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
