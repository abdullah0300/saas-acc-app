// src/components/Invoice/InvoiceForm.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Settings, Save, X } from 'lucide-react';
import { Plus, Trash2, RefreshCw, FileText } from 'lucide-react';
import { InvoiceSettings } from './InvoiceSettings';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { UsageLimitGate } from '../Subscription/FeatureGate';
import { 
  createInvoice, 
  updateInvoice, 
  getClients, 
  createClient, 
  getInvoice,
  getNextInvoiceNumber,
  getInvoiceTemplates,
  createInvoiceTemplate,
  deleteInvoiceTemplate,
  getCategories
} from '../../services/database';
import { Invoice, InvoiceItem, Client } from '../../types';
import { format, addDays, parseISO, addWeeks, addMonths } from 'date-fns';
import { supabase } from '../../services/supabaseClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Create a simplified type for form items that doesn't include database-specific fields
type FormInvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

const InvoiceFormHeader = () => {
  const { usage, limits, getUsagePercentage } = useSubscription();
  const usagePercentage = getUsagePercentage('invoices');
  
  if (limits.monthlyInvoices === -1) return null;
  
  return (
    <div className="mb-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-blue-800">
            Monthly Invoices: {usage.monthlyInvoices} / {limits.monthlyInvoices}
          </span>
          <div className="w-32 bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const InvoiceForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    invoice_number: '',
    client_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    tax_rate: '0',
    notes: '',
    is_recurring: false,
    frequency: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly',
    recurring_end_date: '',
    payment_terms: 30,
    income_category_id: '' // Add this for income category
  });

  // Use FormInvoiceItem type for local state
  const [items, setItems] = useState<FormInvoiceItem[]>([
    { id: Date.now().toString(), description: '', quantity: 1, rate: 0, amount: 0 }
  ]);

  const [showClientModal, setShowClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [isAddingClient, setIsAddingClient] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = (subtotal * parseFloat(formData.tax_rate || '0')) / 100;
  const total = subtotal + taxAmount;

  // Fetch next invoice number
  const { data: nextInvoiceNumber } = useQuery({
    queryKey: ['nextInvoiceNumber', user?.id],
    queryFn: async () => {
      if (!user) return '';
      return await getNextInvoiceNumber(user.id);
    },
    enabled: !!user && !isEdit
  });

  useEffect(() => {
    if (nextInvoiceNumber && !isEdit && !formData.invoice_number) {
      setFormData(prev => ({ ...prev, invoice_number: nextInvoiceNumber }));
    }
  }, [nextInvoiceNumber, isEdit, formData.invoice_number]);

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await getClients(user.id);
    },
    enabled: !!user
  });

  // Fetch income categories
  const { data: incomeCategories = [] } = useQuery({
    queryKey: ['categories', user?.id, 'income'],
    queryFn: async () => {
      if (!user) return [];
      return await getCategories(user.id, 'income');
    },
    enabled: !!user
  });

  // Debug log to check if categories are loading
  useEffect(() => {
    console.log('Income categories loaded:', incomeCategories);
  }, [incomeCategories]);

  // Fetch invoice data if editing
  const { data: invoiceData } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      if (!id || !user) return null;
      
      const invoice = await getInvoice(id);
      
      // Check if it's recurring
      const { data: recurringData } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('invoice_id', id)
        .single();
      
      return { invoice, recurringData };
    },
    enabled: isEdit && !!id && !!user
  });

  // Load templates
  useEffect(() => {
    if (user && !isEdit) {
      loadTemplates();
    }
  }, [user, isEdit]);

  const loadTemplates = async () => {
    if (!user) return;
    
    try {
      const data = await getInvoiceTemplates(user.id);
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    if (!templateId) return;
    
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const templateData = template.template_data;
    
    // Load template data into form
    setFormData(prev => ({
      ...prev,
      tax_rate: templateData.tax_rate?.toString() || '0',
      notes: templateData.notes || '',
      payment_terms: templateData.payment_terms || 30,
      // Don't override client, date, due_date, invoice_number
    }));
    
    // Load items
    if (templateData.items && Array.isArray(templateData.items)) {
      setItems(templateData.items.map((item: any) => ({
        id: (Date.now() + Math.random()).toString(), // Generate string IDs
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount
      })));
    }
    
    setSelectedTemplate(templateId);
  };

  // Save as template
  const handleSaveAsTemplate = async () => {
    if (!user || !templateName.trim()) return;
    
    setSavingTemplate(true);
    
    try {
      const templateData = {
        items: items.map(({ id, ...item }) => item), // Remove id before storing
        tax_rate: parseFloat(formData.tax_rate) || 0,
        notes: formData.notes,
        payment_terms: formData.payment_terms || 30,
      };
      
      await createInvoiceTemplate({
        user_id: user.id,
        name: templateName.trim(),
        template_data: templateData
      });
      
      // Refresh templates list
      await loadTemplates();
      
      // Close dialog and reset
      setShowSaveTemplateDialog(false);
      setTemplateName('');
      
      // Show success message
      alert('Template saved successfully!');
    } catch (err: any) {
      alert('Error saving template: ' + err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;
    
    if (window.confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      try {
        await deleteInvoiceTemplate(selectedTemplate);
        
        // Refresh templates list
        await loadTemplates();
        
        // Reset selection
        setSelectedTemplate('');
        
        // Show success message
        alert('Template deleted successfully!');
      } catch (err: any) {
        alert('Error deleting template: ' + err.message);
      }
    }
  };

  // Handle client creation
  const handleCreateClient = async () => {
    if (!user || !newClientData.name.trim()) return;
    
    setIsAddingClient(true);
    
    try {
      const client = await createClient({
        user_id: user.id,
        name: newClientData.name.trim(),
        email: newClientData.email || undefined,
        phone: newClientData.phone || undefined,
        address: newClientData.address || undefined
      });
      
      // Refresh clients list
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      
      // Select the new client
      setFormData(prev => ({ ...prev, client_id: client.id }));
      
      // Close modal and reset
      setShowClientModal(false);
      setNewClientData({ name: '', email: '', phone: '', address: '' });
    } catch (err: any) {
      alert('Error creating client: ' + err.message);
    } finally {
      setIsAddingClient(false);
    }
  };

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceData, items }: { invoiceData: any, items: FormInvoiceItem[] }) => {
      if (!user) throw new Error('User not authenticated');
      
      // Remove the local 'id' field before sending to database
      const itemsForDb = items.map(({ id, ...item }) => item);
      
      try {
        return await createInvoice(user.id, invoiceData, itemsForDb);
      } catch (error: any) {
        // If the error is about discount fields, try a direct insert
        if (error.message && error.message.includes('discount_type')) {
          console.log('Falling back to direct invoice creation');
          
          // Direct insert to bypass the RPC function
          const { data: newInvoice, error: insertError } = await supabase
            .from('invoices')
            .insert({
              ...invoiceData,
              user_id: user.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (insertError) throw insertError;
          
          // Add invoice items
          if (itemsForDb.length > 0) {
            const invoiceItems = itemsForDb.map(item => ({
              ...item,
              invoice_id: newInvoice.id
            }));
            
            const { error: itemsError } = await supabase
              .from('invoice_items')
              .insert(invoiceItems);
            
            if (itemsError) throw itemsError;
          }
          
          // Update invoice settings for next invoice number
          const { data: settings } = await supabase
            .from('invoice_settings')
            .select('next_number')
            .eq('user_id', user.id)
            .single();
          
          if (settings) {
            await supabase
              .from('invoice_settings')
              .update({ next_number: (settings.next_number || 1) + 1 })
              .eq('user_id', user.id);
          }
          
          return newInvoice;
        }
        
        throw error;
      }
    },
    onSuccess: async (newInvoice) => {
      // Handle recurring invoice if needed
      if (formData.is_recurring) {
        const templateInvoiceData = {
          invoice_number: formData.invoice_number,
          client_id: formData.client_id || null,
          date: formData.date,
          due_date: formData.due_date,
          subtotal,
          tax_rate: parseFloat(formData.tax_rate) || 0,
          tax_amount: taxAmount,
          total,
          notes: formData.notes || null,
          status: 'draft' as const,
          currency: 'USD',
          exchange_rate: 1
        };
        
        const recurringData = {
          user_id: user!.id,
          invoice_id: newInvoice.id,
          template_data: {
            ...templateInvoiceData,
            items: items.map(({ id, ...item }) => item) // Remove id before storing
          },
          frequency: formData.frequency,
          next_date: getNextInvoiceDate().toISOString().split('T')[0],
          end_date: formData.recurring_end_date || null,
          is_active: true
        };

        await supabase
          .from('recurring_invoices')
          .insert([recurringData]);
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
      
      navigate('/invoices');
    },
    onError: (error: any) => {
      alert('Error creating invoice: ' + error.message);
    }
  });

  const [showSettings, setShowSettings] = useState(false);

  // Update invoice mutation
  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ id, invoiceData, items }: { id: string, invoiceData: any, items: FormInvoiceItem[] }) => {
      // Remove the local 'id' field before sending to database
      const itemsForDb = items.map(({ id, ...item }) => item);
      return await updateInvoice(id, invoiceData, itemsForDb);
    },
    onSuccess: async () => {
      // Handle recurring invoice update
      if (formData.is_recurring) {
        const templateInvoiceData = {
          invoice_number: formData.invoice_number,
          client_id: formData.client_id || null,
          date: formData.date,
          due_date: formData.due_date,
          subtotal,
          tax_rate: parseFloat(formData.tax_rate) || 0,
          tax_amount: taxAmount,
          total,
          notes: formData.notes || null,
          status: 'draft' as const,
          currency: 'USD',
          exchange_rate: 1
        };
        
        const recurringData = {
          template_data: {
            ...templateInvoiceData,
            items: items.map(({ id, ...item }) => item) // Remove id before storing
          },
          frequency: formData.frequency,
          next_date: getNextInvoiceDate().toISOString().split('T')[0],
          end_date: formData.recurring_end_date || null,
          is_active: true
        };

        await supabase
          .from('recurring_invoices')
          .update(recurringData)
          .eq('invoice_id', id);
      } else if (isEdit) {
        // Remove recurring if it was previously set
        await supabase
          .from('recurring_invoices')
          .delete()
          .eq('invoice_id', id);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      
      navigate('/invoices');
    },
    onError: (error: any) => {
      alert('Error updating invoice: ' + error.message);
    }
  });

  // Load invoice data into form when editing
  useEffect(() => {
    if (invoiceData?.invoice) {
      const { invoice, recurringData } = invoiceData;
      
      setFormData({
        invoice_number: invoice.invoice_number,
        client_id: invoice.client_id || '',
        date: invoice.date,
        due_date: invoice.due_date,
        tax_rate: invoice.tax_rate.toString(),
        notes: invoice.notes || '',
        is_recurring: !!recurringData,
        frequency: recurringData?.frequency || 'monthly',
        recurring_end_date: recurringData?.end_date || '',
        payment_terms: 30,
        income_category_id: invoice.income_category_id || ''
      });
      
      // Convert InvoiceItem[] to FormInvoiceItem[]
      setItems(invoice.items?.map((item: InvoiceItem) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount
      })) || []);
    }
  }, [invoiceData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    // Create clean invoice data without any discount fields
    const cleanInvoiceData = {
      invoice_number: formData.invoice_number,
      client_id: formData.client_id || null,
      date: formData.date,
      due_date: formData.due_date,
      subtotal: Number(subtotal.toFixed(2)),
      tax_rate: Number(parseFloat(formData.tax_rate) || 0),
      tax_amount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2)),
      notes: formData.notes || null,
      status: 'draft' as const,
      currency: 'USD',
      income_category_id: formData.income_category_id || null
    };
    
    if (isEdit && id) {
      updateInvoiceMutation.mutate({ id, invoiceData: cleanInvoiceData, items });
    } else {
      createInvoiceMutation.mutate({ invoiceData: cleanInvoiceData, items });
    }
  };
  

  const addItem = () => {
    setItems([...items, { 
      id: Date.now().toString(), 
      description: '', 
      quantity: 1, 
      rate: 0, 
      amount: 0 
    }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof FormInvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // Recalculate amount if quantity or rate changes
        if (field === 'quantity' || field === 'rate') {
          updated.amount = updated.quantity * updated.rate;
        }
        
        return updated;
      }
      return item;
    }));
  };

  const getNextInvoiceDate = () => {
    const today = new Date();
    switch (formData.frequency) {
      case 'weekly': return addWeeks(today, 1);
      case 'biweekly': return addWeeks(today, 2);
      case 'monthly': return addMonths(today, 1);
      case 'quarterly': return addMonths(today, 3);
      case 'yearly': return addMonths(today, 12);
      default: return addMonths(today, 1);
    }
  };

  const isSubmitting = createInvoiceMutation.isPending || updateInvoiceMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
  <div className="mb-8">
  <div className="flex justify-between items-center">
    <h1 className="text-2xl font-bold text-gray-900">
      {id ? 'Edit Invoice' : 'Create New Invoice'}
    </h1>
    <button
      type="button"
      onClick={() => setShowSettings(true)}
      className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
    >
      <Settings className="h-4 w-4 mr-2" />
      Invoice Settings
    </button>
  </div>
</div>
</div>
      
      <InvoiceFormHeader />

      <UsageLimitGate type="invoices">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Selection - Only show when creating new invoice */}
        {!isEdit && templates.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start from a template (optional)
            </label>
            <div className="flex gap-2">
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select a template --</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <button
                  type="button"
                  onClick={handleDeleteTemplate}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2"
                  title="Delete selected template"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          {/* Invoice Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Number
              </label>
              <input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a client (optional)</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowClientModal(true)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Income Category Field - Added here */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Income Category (Internal Use)
            </label>
            <select
              value={formData.income_category_id}
              onChange={(e) => setFormData({ ...formData, income_category_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a category (optional)</option>
              {incomeCategories && incomeCategories.length > 0 ? (
                incomeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))
              ) : (
                <option disabled>No income categories found - Please create categories first</option>
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              This category will be used when the invoice is marked as paid. Not visible to clients.
            </p>
          </div>

          {/* Recurring Invoice Options */}
          <div className="bg-gray-50 rounded-lg p-6">
            <label className="flex items-center mb-4">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-3 font-medium text-gray-700">
                <RefreshCw className="inline h-4 w-4 mr-1" />
                Make this a recurring invoice
              </span>
            </label>

            {formData.is_recurring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Frequency
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    Next invoice: {format(getNextInvoiceDate(), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.recurring_end_date}
                    onChange={(e) => setFormData({ ...formData, recurring_end_date: e.target.value })}
                    min={formData.date}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Leave empty for indefinite recurring
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Invoice Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Invoice Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </button>
            </div>

            {/* Table Headers */}
            <div className="flex gap-2 items-center mb-2 px-2 text-sm font-medium text-gray-700">
              <div className="flex-1">Description</div>
              <div className="w-24 text-center">Qty</div>
              <div className="w-32 text-right">Rate</div>
              <div className="w-32 text-right">Amount</div>
              <div className="w-10"></div>
            </div>

            {/* Items */}
            {items.map((item) => (
              <div key={item.id} className="flex gap-2 items-start mb-3">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder="Item description"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  required
                />
                <input
                  type="number"
                  value={item.rate}
                  onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                  required
                />
                <div className="w-32 px-3 py-2 bg-gray-100 rounded-lg text-right font-medium">
                  ${item.amount.toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-red-600 hover:text-red-700"
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tax</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-right"
                    />
                    <span>%</span>
                    <span className="font-medium w-20 text-right">${taxAmount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Payment terms, bank details, thank you message..."
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : (isEdit ? 'Update Invoice' : 'Create Invoice')}
            </button>
            
            {/* Save as Template button - only show when creating new invoice */}
            {!isEdit && (
              <button
                type="button"
                onClick={() => setShowSaveTemplateDialog(true)}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Save as Template
              </button>
            )}
            
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
      </UsageLimitGate>

      {/* Template Save Dialog */}
      {showSaveTemplateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Save Invoice Template</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Monthly Retainer, Web Development"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowSaveTemplateDialog(false);
                  setTemplateName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
        
      )}
      {/* Invoice Settings Modal - ADD THIS HERE */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <InvoiceSettings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
      
      {/* Client Creation Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Add New Client</h3>
                <button
                  onClick={() => {
                    setShowClientModal(false);
                    setNewClientData({ name: '', email: '', phone: '', address: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={newClientData.name}
                    onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter client name"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="client@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={newClientData.address}
                    onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Street address..."
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowClientModal(false);
                  setNewClientData({ name: '', email: '', phone: '', address: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateClient}
                disabled={!newClientData.name.trim() || isAddingClient}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isAddingClient ? 'Creating...' : 'Create Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};