// src/components/Invoice/InvoiceTemplatesPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText,Clock, Trash2, Plus, Edit, Eye, ArrowLeft, Calendar, DollarSign, Loader, Copy } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          {/* Breadcrumb & Back Button */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate('/invoices')}
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="hover:text-indigo-600 cursor-pointer" onClick={() => navigate('/invoices')}>
                Invoices
              </span>
              <span>/</span>
              <span className="text-gray-900 font-medium">Templates</span>
            </div>
          </div>

          {/* Title & Description */}
          <div className="mb-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Invoice Templates
            </h1>
            <p className="text-gray-600 text-lg">
              Create reusable templates to streamline your invoicing workflow
            </p>
          </div>

          {/* Stats & Actions Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
                  <p className="text-sm text-gray-600">Template{templates.length !== 1 ? 's' : ''} Available</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/invoices/new')}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create New Invoice
            </button>
          </div>
        </div>

        {/* Templates Grid */}
        {templates.length === 0 ? (
          <div className="bg-gradient-to-br from-white to-indigo-50 rounded-2xl shadow-xl border border-indigo-100 p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="h-10 w-10 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">No templates yet</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Create your first invoice template to streamline your workflow. Templates let you reuse line items, tax rates, payment terms, and other settings for future invoices.
              </p>
              <button
                onClick={() => navigate('/invoices/new')}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Invoice
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => {
              const total = calculateTemplateTotal(template);
              const itemCount = template.template_data.items?.length || 0;

              return (
                <div
                  key={template.id}
                  className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 overflow-hidden transform hover:-translate-y-1"
                >
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-100 bg-gradient-to-br from-indigo-50 via-purple-50 to-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full -mr-16 -mt-16"></div>
                    <div className="relative">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                            {template.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>Created {format(new Date(template.created_at), 'MMM dd, yyyy')}</span>
                          </div>
                        </div>
                        {template.template_data.is_recurring && (
                          <span className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-semibold rounded-full shadow-md">
                            Recurring
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    {/* Total Amount - Prominent */}
                    <div className="mb-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                      <p className="text-xs font-medium text-gray-600 mb-1">Estimated Total</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        {formatCurrency(total, template.template_data.currency || baseCurrency)}
                      </p>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Line Items</span>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-indigo-600" />
                          <span className="font-semibold text-gray-900">{itemCount}</span>
                        </div>
                      </div>

                      {template.template_data.payment_terms && (
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 mb-1">Payment Terms</span>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-indigo-600" />
                            <span className="font-semibold text-gray-900">{template.template_data.payment_terms} days</span>
                          </div>
                        </div>
                      )}

                      {template.template_data.tax_rate > 0 && (
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500 mb-1">Tax Rate</span>
                          <span className="font-semibold text-gray-900">{template.template_data.tax_rate}%</span>
                        </div>
                      )}

                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 mb-1">Currency</span>
                        <span className="font-semibold text-gray-900">{template.template_data.currency || baseCurrency}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => handleUseTemplate(template)}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:scale-105"
                      >
                        <Copy className="h-4 w-4" />
                        Use Template
                      </button>

                      <button
                        onClick={() => {
                          setSelectedTemplate(template);
                          setShowPreview(true);
                        }}
                        className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm hover:shadow-md"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(template.id, template.name)}
                        disabled={deleting === template.id}
                        className="px-4 py-2.5 border border-red-300 text-red-600 rounded-xl hover:bg-red-50 transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl text-gray-900 mb-1">
                      {selectedTemplate.name}
                    </h3>
                    <p className="text-sm text-gray-600">Template Preview</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPreview(false);
                      setSelectedTemplate(null);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-all"
                  >
                    <Plus className="h-6 w-6 rotate-45" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-180px)]">

              <div className="p-6 space-y-6">
                {/* Template Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Payment Terms</p>
                    <p className="text-base text-gray-900">{selectedTemplate.template_data.payment_terms || 30} days</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Type</p>
                    <p className="text-base text-gray-900">
                      {selectedTemplate.template_data.is_recurring
                        ? `Recurring`
                        : 'One-time'
                      }
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="text-sm text-gray-900 mb-3">Line Items</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs text-gray-600 uppercase">Description</th>
                          <th className="px-4 py-3 text-center text-xs text-gray-600 uppercase">Qty</th>
                          <th className="px-4 py-3 text-right text-xs text-gray-600 uppercase">Rate</th>
                          <th className="px-4 py-3 text-right text-xs text-gray-600 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {selectedTemplate.template_data.items?.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {formatCurrency(item.rate, selectedTemplate.template_data.currency || baseCurrency)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
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
                        <span className="text-gray-900">
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
                          <span className="text-gray-900">
                            {formatCurrency(
                              (selectedTemplate.template_data.items?.reduce((sum, item) =>
                                sum + (item.amount || item.quantity * item.rate || 0), 0
                              ) || 0) * (selectedTemplate.template_data.tax_rate / 100),
                              selectedTemplate.template_data.currency || baseCurrency
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                        <span className="text-gray-900">Total</span>
                        <span className="text-indigo-600">
                          {formatCurrency(calculateTemplateTotal(selectedTemplate), selectedTemplate.template_data.currency || baseCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedTemplate.template_data.notes && (
                  <div>
                    <h4 className="text-sm text-gray-900 mb-2">Notes</h4>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 whitespace-pre-line">
                        {selectedTemplate.template_data.notes}
                      </p>
                    </div>
                  </div>
                )}

              </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 mt-6 border-t border-gray-200">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowPreview(false);
                      handleUseTemplate(selectedTemplate);
                    }}
                    className="flex-1 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Use This Template
                  </button>
                  <button
                    onClick={() => {
                      setShowPreview(false);
                      setSelectedTemplate(null);
                    }}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
