// src/components/Invoice/RecurringInvoiceEdit.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { ArrowLeft, Save, Edit, AlertCircle, FileText, DollarSign } from 'lucide-react';

export const RecurringInvoiceEdit: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  const navigate = useNavigate();
  const [recurring, setRecurring] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Load recurring invoice
  useEffect(() => {
    loadRecurring();
  }, [id]);
  
  const loadRecurring = async () => {
    if (!id || !user) return;

    const { data, error } = await supabase
      .from('recurring_invoices')
      .select(`
        *,
        client:clients(name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error loading recurring invoice:', error);
      alert('Failed to load recurring invoice');
      navigate('/invoices/recurring');
      return;
    }

    if (data) setRecurring(data);
    setLoading(false);
  };
  
  const handleSave = async () => {
    if (!id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('recurring_invoices')
        .update({
          frequency: recurring.frequency,
          next_date: recurring.next_date,
          is_active: recurring.is_active,
          end_date: recurring.end_date || null
        })
        .eq('id', id);

      if (error) throw error;

      alert('Recurring invoice updated successfully!');
      navigate('/invoices/recurring');
    } catch (err: any) {
      console.error('Error updating recurring invoice:', err);
      alert('Failed to update: ' + err.message);
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!recurring) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Recurring invoice not found</p>
        <button
          onClick={() => navigate('/invoices/recurring')}
          className="mt-4 text-indigo-600 hover:text-indigo-700"
        >
          Back to Recurring Invoices
        </button>
      </div>
    );
  }

  const templateData = recurring.template_data || {};
  const itemCount = templateData.items?.length || 0;
  const currency = templateData.currency || baseCurrency;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/invoices/recurring')}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Recurring Invoice</h1>
            <p className="text-gray-600 mt-1">
              {recurring.client?.name || 'No client'} • {recurring.frequency}
            </p>
          </div>
        </div>

        {/* Warning Alert */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900">Changes apply to future invoices only</p>
            <p className="text-sm text-yellow-700 mt-1">
              Any modifications will affect invoices generated after saving. Already created invoices remain unchanged.
            </p>
          </div>
        </div>

        {/* Schedule Settings Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Schedule Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequency
              </label>
              <select
                value={recurring.frequency}
                onChange={(e) => setRecurring({...recurring, frequency: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Next Invoice Date
              </label>
              <input
                type="date"
                value={recurring.next_date}
                onChange={(e) => setRecurring({...recurring, next_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={recurring.end_date || ''}
                onChange={(e) => setRecurring({...recurring, end_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite recurring</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={recurring.is_active}
                  onChange={(e) => setRecurring({...recurring, is_active: e.target.checked})}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">
                  {recurring.is_active ? 'Active - Auto-generating invoices' : 'Paused - Not generating invoices'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Invoice Template Preview & Edit Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Invoice Template</h2>
              <p className="text-sm text-gray-600 mt-1">
                Current template used for generating invoices
              </p>
            </div>
            <button
              onClick={() => navigate(`/invoices/recurring/template/${id}`)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Template
            </button>
          </div>

          {/* Template Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Line Items</p>
                <p className="text-lg font-semibold text-gray-900">{itemCount}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Invoice Amount</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(templateData.total || 0, currency)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Tax Rate</p>
                <p className="text-lg font-semibold text-gray-900">
                  {templateData.tax_rate || 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Preview Items */}
          {itemCount > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview Items:</p>
              <div className="space-y-2">
                {templateData.items.slice(0, 3).map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                    <span className="text-gray-900">{item.description}</span>
                    <span className="text-gray-600">
                      {item.quantity} × {formatCurrency(item.rate, currency)}
                    </span>
                  </div>
                ))}
                {itemCount > 3 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{itemCount - 3} more item{itemCount - 3 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Schedule Changes'}
          </button>
          <button
            onClick={() => navigate('/invoices/recurring')}
            disabled={saving}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};