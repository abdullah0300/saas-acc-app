import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { InvoiceSettings } from './InvoiceSettings';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  X, 
  RefreshCw, 
  Calendar,
  Info,
  Settings
} from 'lucide-react';
import { 
  createInvoice, 
  updateInvoice, 
  getInvoice,
  getClients,
  createClient 
} from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext'; // Added useSettings import
import { supabase } from '../../services/supabaseClient';
import { Client, InvoiceItem } from '../../types';
import { addDays, addWeeks, addMonths } from 'date-fns';

export const InvoiceForm: React.FC = () => {
  const { user } = useAuth();
  const { taxRates, defaultTaxRate, formatCurrency, userSettings } = useSettings(); // Added settings
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
const [showSettings, setShowSettings] = useState(false);

  const [formData, setFormData] = useState({
    invoice_number: '',
    client_id: '',
    date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tax_rate: '0',
    notes: '',
    // Recurring fields
    is_recurring: false,
    frequency: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly',
    recurring_end_date: ''
  });

  const [items, setItems] = useState<Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[]>([
    { description: '', quantity: 1, rate: 0, amount: 0 }
  ]);

  const [clients, setClients] = useState<Client[]>([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);

  useEffect(() => {
    loadInitialData();
  }, [id, isEdit]);

  const loadInitialData = async () => {
    if (!user) return;
    
    try {
      // Load invoice settings
   // First try to get existing settings
const { data: existingSettings } = await supabase
  .from('invoice_settings')
  .select('*')
  .eq('user_id', user.id)
  .single();

// If no settings exist, create them
if (!existingSettings) {
  const { data: settings } = await supabase
    .from('invoice_settings')
    .insert([{
      user_id: user.id,
      invoice_prefix: 'INV-',
      payment_terms: 30
    }])
    .select()
    .single();
    
  setInvoiceSettings(settings);
} else {
  setInvoiceSettings(existingSettings);
}

      // Load clients
      await loadClients();
      
      if (isEdit && id) {
        await loadInvoice();
      } else {
        generateInvoiceNumber();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const generateInvoiceNumber = () => {
    const prefix = invoiceSettings?.invoice_prefix || 'INV-';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setFormData(prev => ({ ...prev, invoice_number: `${prefix}${year}${month}-${random}` }));
  };

  const loadClients = async () => {
    if (!user) return;
    
    try {
      const data = await getClients(user.id);
      setClients(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadInvoice = async () => {
    if (!user || !id) return;
    
    try {
      const invoice = await getInvoice(id);
      
      // Check if it's recurring
      const { data: recurringData } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('invoice_id', id)
        .single();
      
      setFormData({
        invoice_number: invoice.invoice_number,
        client_id: invoice.client_id || '',
        date: invoice.date,
        due_date: invoice.due_date,
        tax_rate: invoice.tax_rate.toString(),
        notes: invoice.notes || '',
        is_recurring: !!recurringData,
        frequency: recurringData?.frequency || 'monthly',
        recurring_end_date: recurringData?.end_date || ''
      });

      if (invoice.items) {
        setItems(invoice.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount
        })));
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClientSubmit = async () => {
    if (!user || !newClient.name) return;

    try {
      const client = await createClient({
        user_id: user.id,
        name: newClient.name,
        email: newClient.email || undefined,
        phone: newClient.phone || undefined,
        address: newClient.address || undefined
      });

      await loadClients();
      setFormData({ ...formData, client_id: client.id });
      setShowClientForm(false);
      setNewClient({ name: '', email: '', phone: '', address: '' });
    } catch (err: any) {
      alert('Error creating client: ' + err.message);
    }
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    // Calculate amount if quantity or rate changes
    if (field === 'quantity' || field === 'rate') {
      updatedItems[index].amount = updatedItems[index].quantity * updatedItems[index].rate;
    }

    setItems(updatedItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = parseFloat(formData.tax_rate) / 100;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total };
  };

  const getNextInvoiceDate = () => {
    const currentDate = new Date(formData.date);
    
    switch (formData.frequency) {
      case 'weekly':
        return addWeeks(currentDate, 1);
      case 'biweekly':
        return addWeeks(currentDate, 2);
      case 'monthly':
        return addMonths(currentDate, 1);
      case 'quarterly':
        return addMonths(currentDate, 3);
      case 'yearly':
        return addMonths(currentDate, 12);
      default:
        return currentDate;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate items
    const validItems = items.filter(item => item.description && item.amount > 0);
    if (validItems.length === 0) {
      setError('Please add at least one item to the invoice');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const { subtotal, taxAmount, total } = calculateTotals();
      
      const invoiceData = {
        user_id: user.id,
        invoice_number: formData.invoice_number,
        client_id: formData.client_id || undefined,
        date: formData.date,
        due_date: formData.due_date,
        status: 'draft' as const,
        subtotal,
        tax_rate: parseFloat(formData.tax_rate),
        tax_amount: taxAmount,
        total,
        notes: formData.notes || undefined
      };

      let invoiceId: string;

      if (isEdit && id) {
        await updateInvoice(id, invoiceData, validItems);
        invoiceId = id;
      } else {
        const newInvoice = await createInvoice(invoiceData, validItems);
        invoiceId = newInvoice.id;
      }

      // Handle recurring invoice
      if (formData.is_recurring) {
        const recurringData = {
          user_id: user.id,
          invoice_id: invoiceId,
          template_data: {
            ...invoiceData,
            items: validItems
          },
          frequency: formData.frequency,
          next_date: getNextInvoiceDate().toISOString().split('T')[0],
          end_date: formData.recurring_end_date || null,
          is_active: true
        };

        if (isEdit) {
          // Update existing recurring invoice
          await supabase
            .from('recurring_invoices')
            .update(recurringData)
            .eq('invoice_id', invoiceId);
        } else {
          // Create new recurring invoice
          await supabase
            .from('recurring_invoices')
            .insert([recurringData]);
        }
      } else if (isEdit) {
        // Remove recurring if it was previously set
        await supabase
          .from('recurring_invoices')
          .delete()
          .eq('invoice_id', invoiceId);
      }

      navigate('/invoices');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </button>
        
        <button
  type="button"
  onClick={() => setShowSettings(true)}
  className="inline-flex items-center text-gray-600 hover:text-gray-900"
>
  <Settings className="h-4 w-4 mr-2" />
  Invoice Settings
</button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEdit ? 'Edit Invoice' : 'Create Invoice'}
        </h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invoice Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Number *
              </label>
              <input
                type="text"
                required
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client
              </label>
              <div className="flex space-x-2">
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowClientForm(true)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
                    <option value="biweekly">Every 2 Weeks</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.recurring_end_date}
                    onChange={(e) => setFormData({ ...formData, recurring_end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
            
            {formData.is_recurring && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-start">
                <Info className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Next invoice will be generated on: {getNextInvoiceDate().toLocaleDateString()}</p>
                  <p className="mt-1">Invoices will be automatically created based on your selected frequency. You'll receive notifications when each invoice is generated.</p>
                </div>
              </div>
            )}
          </div>

          {/* Invoice Items */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Items</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-700">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-2">Rate</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-1"></div>
              </div>
              
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="col-span-5 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Item description"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                    className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                  <div className="col-span-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                    {formatCurrency(item.amount)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="col-span-1 text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                onClick={addItem}
                className="mt-2 inline-flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center space-x-2">
                  <span>Tax</span>
                  <select
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                    className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="0">No Tax (0%)</option>
                    {taxRates.map((tax) => (
                      <option key={tax.id} value={tax.rate}>
                        {tax.name} ({tax.rate}%)
                      </option>
                    ))}
                  </select>
                </div>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </form>
      </div>

      {/* Add Client Modal */}
      {showClientForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add New Client</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Client Name *"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="email"
                placeholder="Email"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="tel"
                placeholder="Phone (with country code for WhatsApp)"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <textarea
                placeholder="Address"
                value={newClient.address}
                onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowClientForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClientSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Client
              </button>
            </div>
          </div>
        </div>
        
      )}
      {showSettings && (
  <InvoiceSettings onClose={() => setShowSettings(false)} />
)}
    </div>
  );
};