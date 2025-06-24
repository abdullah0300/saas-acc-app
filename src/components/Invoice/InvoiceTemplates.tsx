// Create a new file: src/components/Invoice/InvoiceTemplates.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getInvoiceTemplates, deleteInvoiceTemplate } from '../../services/database';

export const InvoiceTemplates: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (!window.confirm(`Delete template "${name}"?`)) return;
    
    try {
      await deleteInvoiceTemplate(id);
      await loadTemplates();
    } catch (err: any) {
      alert('Error deleting template: ' + err.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoice Templates</h1>
        <button
          onClick={() => navigate('/invoices/new')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No templates yet</p>
          <p className="text-sm text-gray-500">
            Create an invoice and save it as a template for future use
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-500">
                      {template.template_data.items?.length || 0} items
                      {template.template_data.tax_rate > 0 && ` • ${template.template_data.tax_rate}% tax`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigate('/invoices/new')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Use Template
                  </button>
                  <button
                    onClick={() => handleDelete(template.id, template.name)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};