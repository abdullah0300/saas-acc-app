// src/components/Invoice/InvoiceTemplatesPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, Plus, Edit, Eye, ArrowLeft, Calendar, DollarSign, Loader, Copy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getInvoiceTemplates, deleteInvoiceTemplate } from '../../services/database';
import { format } from 'date-fns';

interface InvoiceTemplate {
  id: string;
  name: string;
  template_data: {
    items: any[];
    tax_rate: number;
    notes: string;
    payment_terms: number;
    currency: string;
    income_category_id?: string;
    is_recurring?: boolean;
    frequency?: string;
  };
  created_at: string;
  updated_at: string;
}

export const InvoiceTemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user]);

  const loadTemplates = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getInvoiceTemplates(user.id);
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete template "${name}"?`)) return;

    try {
      setDeleting(id);
      await deleteInvoiceTemplate(id);
      await loadTemplates();
    } catch (err: any) {
      alert('Error deleting template: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleUseTemplate = (template: InvoiceTemplate) => {
    // Navigate to invoice form - the form will handle loading the template
    navigate('/invoices/new', { state: { templateId: template.id } });
  };

  const calculateTemplateTotal = (template: InvoiceTemplate) => {
    const subtotal = template.template_data.items?.reduce((sum, item) =>
      sum + (item.amount || item.quantity * item.rate || 0), 0
    ) || 0;

    const taxAmount = (subtotal * (template.template_data.tax_rate || 0)) / 100;
    return subtotal + taxAmount;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/invoices')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invoice Templates</h1>
              <p className="text-gray-600 mt-1">
                Manage your reusable invoice templates
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="h-4 w-4" />
              <span>{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => navigate('/invoices/new')}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Invoice
            </button>
          </div>
        </div>

        {/* Templates Grid */}
        {templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create an invoice and save it as a template to reuse line items, tax rates, and other settings for future invoices.
            </p>
            <button
              onClick={() => navigate('/invoices/new')}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Invoice
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => {
              const total = calculateTemplateTotal(template);
              const itemCount = template.template_data.items?.length || 0;

              return (
                <div
                  key={template.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all border border-gray-200 overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {template.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Created {format(new Date(template.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      {template.template_data.is_recurring && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          Recurring
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Items
                        </span>
                        <span className="font-medium text-gray-900">{itemCount}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Estimated Total
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(total, template.template_data.currency || baseCurrency)}
                        </span>
                      </div>

                      {template.template_data.tax_rate > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Tax Rate</span>
                          <span className="font-medium text-gray-900">
                            {template.template_data.tax_rate}%
                          </span>
                        </div>
                      )}

                      {template.template_data.payment_terms && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Payment Terms
                          </span>
                          <span className="font-medium text-gray-900">
                            {template.template_data.payment_terms} days
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUseTemplate(template)}
                        className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Use Template
                      </button>

                      <button
                        onClick={() => {
                          setSelectedTemplate(template);
                          setShowPreview(true);
                        }}
                        className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(template.id, template.name)}
                        disabled={deleting === template.id}
                        className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === template.id ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Preview Modal */}
        {showPreview && selectedTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  Template Preview: {selectedTemplate.name}
                </h3>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setSelectedTemplate(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Plus className="h-6 w-6 rotate-45" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Template Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Currency</p>
                    <p className="font-medium">{selectedTemplate.template_data.currency || baseCurrency}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tax Rate</p>
                    <p className="font-medium">{selectedTemplate.template_data.tax_rate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment Terms</p>
                    <p className="font-medium">{selectedTemplate.template_data.payment_terms || 30} days</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-medium">
                      {selectedTemplate.template_data.is_recurring
                        ? `Recurring (${selectedTemplate.template_data.frequency})`
                        : 'One-time'
                      }
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Line Items</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Description</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Qty</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Rate</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedTemplate.template_data.items?.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {formatCurrency(item.rate, selectedTemplate.template_data.currency || baseCurrency)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(item.amount || item.quantity * item.rate, selectedTemplate.template_data.currency || baseCurrency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="mt-4 flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">
                          {formatCurrency(
                            selectedTemplate.template_data.items?.reduce((sum, item) =>
                              sum + (item.amount || item.quantity * item.rate || 0), 0
                            ) || 0,
                            selectedTemplate.template_data.currency || baseCurrency
                          )}
                        </span>
                      </div>
                      {selectedTemplate.template_data.tax_rate > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Tax ({selectedTemplate.template_data.tax_rate}%)</span>
                          <span className="font-medium">
                            {formatCurrency(
                              (selectedTemplate.template_data.items?.reduce((sum, item) =>
                                sum + (item.amount || item.quantity * item.rate || 0), 0
                              ) || 0) * (selectedTemplate.template_data.tax_rate / 100),
                              selectedTemplate.template_data.currency || baseCurrency
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-semibold pt-2 border-t">
                        <span>Total</span>
                        <span>{formatCurrency(calculateTemplateTotal(selectedTemplate), selectedTemplate.template_data.currency || baseCurrency)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedTemplate.template_data.notes && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-line bg-gray-50 p-4 rounded-lg">
                      {selectedTemplate.template_data.notes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowPreview(false);
                      handleUseTemplate(selectedTemplate);
                    }}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    Use This Template
                  </button>
                  <button
                    onClick={() => {
                      setShowPreview(false);
                      setSelectedTemplate(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
