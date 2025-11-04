// src/components/Invoice/InvoiceForm.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Settings, Save, X, AlertCircle } from 'lucide-react';
import { Plus, Trash2, RefreshCw, FileText } from 'lucide-react';
import { InvoiceSettings } from './InvoiceSettings';
import { InvoicePaymentSettings } from './InvoicePaymentSettings';
import { paymentService } from '../../services/payment/PaymentService';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useSettings } from '../../contexts/SettingsContext';
import { UsageLimitGate } from '../Subscription/FeatureGate';
import { useData } from '../../contexts/DataContext';
import { COUNTRY_CODES } from '../../utils/phoneUtils';
import { checkInvoiceNumberExists } from '../../services/database';
import { countries } from '../../data/countries';
import { calculateVATFromNet, aggregateVATByRate } from '../../utils/vatCalculations';
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
  getCategories,
  getInvoicePayments,
  calculateInvoiceBalance,
  getProjects
} from '../../services/database';
import { Invoice, InvoiceItem, Client, InvoicePayment } from '../../types';
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
  tax_rate?: number;
  tax_amount?: number;
  net_amount?: number;
  gross_amount?: number;
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

interface InvoiceFormProps {
  recurringTemplateId?: string;
  recurringTemplateData?: any;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ recurringTemplateId, recurringTemplateData }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const isRecurringTemplateMode = !!recurringTemplateId;
  const queryClient = useQueryClient();
  const { addClientToCache, addInvoiceToCache, effectiveUserId } = useData();
  const location = useLocation();
  const templateIdFromState = (location.state as any)?.templateId;
  const { formatCurrency, taxRates, baseCurrency, exchangeRates, convertCurrency, getCurrencySymbol, userSettings, isUserSettingsReady } = useSettings();
  const [showRateWarning, setShowRateWarning] = useState(false);
  const [originalRate, setOriginalRate] = useState<number | null>(null);
  const [useHistoricalRate, setUseHistoricalRate] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const userCountry = countries.find(c => c.code === userSettings?.country);
  const taxLabel = userCountry?.taxName || 'Tax';
  const requiresLineItemVAT = userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown || false;
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

// Add this useEffect after your formData useState
useEffect(() => {
  // Update currency when baseCurrency loads and form currency is still default
  if (isUserSettingsReady && baseCurrency && formData.currency !== baseCurrency) {
    setFormData(prev => ({
      ...prev,
      currency: baseCurrency
    }));
  }
}, [isUserSettingsReady, baseCurrency]);
// Monitor online status
useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);
  // Form state
  const [formData, setFormData] = useState({
    invoice_number: '',
    client_id: '',
    project_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    tax_rate: '0',
    notes: '',
    currency: baseCurrency,
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
    company_name: '',
    email: '',
    phone: '',
    phone_country_code: '+1',
    address: ''
  });
  const [isAddingClient, setIsAddingClient] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Payment tracking state for locked invoices
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);
  const [paymentBalance, setPaymentBalance] = useState<{ total_paid: number; balance_due: number; invoice_total: number } | null>(null);
  const [originalInvoiceTotal, setOriginalInvoiceTotal] = useState<number>(0);

  // Payment settings state - for capturing settings before invoice is created
  const [pendingPaymentSettings, setPendingPaymentSettings] = useState<any>(null);

  const calculateTotals = () => {
  if (requiresLineItemVAT) {
    // For UK/EU - Use proper VAT calculation
    const itemsWithVAT = items.map(item => {
      const vatCalc = calculateVATFromNet(
        item.quantity * item.rate, 
        item.tax_rate || 0
      );
      return {
        ...item,
        net_amount: vatCalc.net,
        tax_amount: vatCalc.vat,
        gross_amount: vatCalc.gross
      };
    });
    
    // Aggregate by VAT rate for proper HMRC reporting
    const vatBreakdown = aggregateVATByRate(itemsWithVAT);
    
    // Calculate totals from aggregated data
    let netTotal = 0;
    let taxTotal = 0;
    let grossTotal = 0;
    
    Object.values(vatBreakdown).forEach(group => {
      netTotal += group.net;
      taxTotal += group.vat;
      grossTotal += group.gross;
    });
    
    return {
      subtotal: netTotal,
      taxAmount: taxTotal,
      total: grossTotal,
      vatBreakdown // Include breakdown for metadata
    };
  } else {
    // For other countries - simple calculation
    const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const taxAmount = (subtotal * parseFloat(formData.tax_rate || '0')) / 100;
    const total = subtotal + taxAmount;
    
    return {
      subtotal,
      taxAmount,
      total,
      vatBreakdown: null
    };
  }
};

  // Calculate totals
    const totals = calculateTotals();
const subtotal = totals.subtotal;
const taxAmount = totals.taxAmount;
const total = totals.total;
const vatBreakdown = totals.vatBreakdown; // Add this to capture breakdown

  // Fetch next invoice number
  const { data: nextInvoiceNumber } = useQuery({
    queryKey: ['nextInvoiceNumber', user?.id],
    queryFn: async () => {
      if (!user) return '';
      return await getNextInvoiceNumber(user.id);
    },
    enabled: !!user && !isEdit,
     staleTime: 0, // ADD THIS - Always consider data stale
      gcTime: 0 // ADD THIS - Don't cache the result
  });

  useEffect(() => {
    if (nextInvoiceNumber && !isEdit && !formData.invoice_number) {
      setFormData(prev => ({ ...prev, invoice_number: nextInvoiceNumber }));
    }
  }, [nextInvoiceNumber, isEdit, formData.invoice_number]);

  // Recalculate totals when items change
useEffect(() => {
  const totals = calculateTotals();
  // Don't update state here to avoid infinite loop
  // The totals are calculated inline in the render
}, [items, formData.tax_rate, requiresLineItemVAT]);

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await getClients(user.id);
    },
    enabled: !!user
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', user?.id, 'active'],
    queryFn: async () => {
      if (!user) return [];
      return await getProjects(user.id, 'active');
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

  const loadInvoiceSettings = async () => {
  if (!user) return;
  
  try {
    const { data } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', effectiveUserId || user.id)
      .single();
    
    if (data && !isEdit && !settingsLoaded) {
      setInvoiceSettings(data);
      setSettingsLoaded(true);
      
      // Apply default tax rate
      if (data.default_tax_rate !== null && data.default_tax_rate !== undefined) {
        setFormData(prev => ({
          ...prev,
          tax_rate: data.default_tax_rate.toString()
        }));
      }
      
      // Apply default notes
      if (data.invoice_notes) {
        setFormData(prev => ({
          ...prev,
          notes: data.invoice_notes
        }));
      }
      
      // Apply payment terms and calculate due date
      if (data.payment_terms) {
        const invoiceDate = parseISO(formData.date);
        const dueDate = addDays(invoiceDate, parseInt(data.payment_terms));
        setFormData(prev => ({
          ...prev,
          payment_terms: data.payment_terms,
          due_date: format(dueDate, 'yyyy-MM-dd')
        }));
      }
    }
  } catch (err) {
    console.error('Error loading invoice settings:', err);
  }
};

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
      loadInvoiceSettings();
    }
  }, [user, isEdit]);

  // Auto-load template if coming from templates page
  useEffect(() => {
    if (templateIdFromState && templates.length > 0 && !isEdit) {
      handleTemplateSelect(templateIdFromState);
    }
  }, [templateIdFromState, templates, isEdit]);

  // Load recurring template data when in recurring template edit mode
  useEffect(() => {
    if (isRecurringTemplateMode && recurringTemplateData) {
      loadRecurringTemplate();
    }
  }, [isRecurringTemplateMode, recurringTemplateData]);

  const loadRecurringTemplate = () => {
    if (!recurringTemplateData || !recurringTemplateData.template_data) return;

    const template = recurringTemplateData.template_data;

    // Update form data (without items - items are separate state)
    setFormData({
      ...formData,
      client_id: recurringTemplateData.client_id || '',
      tax_rate: String(template.tax_rate || 0),
      notes: template.notes || '',
      payment_terms: template.payment_terms || 30,
      currency: template.currency || baseCurrency,
      income_category_id: template.income_category_id || '',
    });

    // Update items separately
    if (template.items && template.items.length > 0) {
      setItems(template.items.map((item: any, index: number) => ({
        id: item.id || `${Date.now()}-${index}`,
        description: item.description || '',
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: item.amount || 0,
        tax_rate: item.tax_rate || 0,
        tax_amount: item.tax_amount || 0,
        net_amount: item.net_amount || item.amount || 0,
        gross_amount: item.gross_amount || item.amount || 0
      })));
    }

    // ✅ NEW: Load payment settings from template
    if (template.payment_settings?.payment_enabled) {
      setPendingPaymentSettings({
        paymentEnabled: true,
        providers: template.payment_settings.payment_providers || [],
        currencies: template.payment_settings.accepted_currencies || []
      });
    }
  };

  const handleSaveRecurringTemplate = async () => {
    if (!user || !recurringTemplateId) return;

    setSavingTemplate(true);

    try {
      // Prepare the template data
      const updatedTemplateData = {
        items: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          tax_rate: item.tax_rate || 0,
          tax_amount: item.tax_amount || 0,
          net_amount: item.net_amount || item.amount,
          gross_amount: item.gross_amount || item.amount
        })),
        subtotal: Number(subtotal.toFixed(2)),
        tax_rate: Number(parseFloat(formData.tax_rate) || 0),
        tax_amount: Number(taxAmount.toFixed(2)),
        total: Number(total.toFixed(2)),
        notes: formData.notes || '',
        payment_terms: formData.payment_terms || 30,
        currency: formData.currency || baseCurrency,
        income_category_id: formData.income_category_id || null,

        // ✅ NEW: Include payment settings in template
        payment_settings: pendingPaymentSettings?.paymentEnabled ? {
          payment_enabled: true,
          payment_providers: pendingPaymentSettings.providers || [],
          accepted_currencies: pendingPaymentSettings.currencies || []
        } : null
      };

      // Update only the template_data field in recurring_invoices
      const { error } = await supabase
        .from('recurring_invoices')
        .update({
          template_data: updatedTemplateData,
          client_id: formData.client_id || null
        })
        .eq('id', recurringTemplateId)
        .eq('user_id', effectiveUserId || user.id);

      if (error) throw error;

      alert('✅ Recurring invoice template updated successfully!\n\nFuture invoices will use these updated details.');
      navigate(`/invoices/recurring/edit/${recurringTemplateId}`);
    } catch (err: any) {
      console.error('Error saving recurring template:', err);
      alert('Failed to save template: ' + err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  useEffect(() => {
  if (formData.currency && formData.currency !== baseCurrency) {
    fetchExchangeRate();
  }
}, [formData.currency]);

  const loadTemplates = async () => {
    if (!user) return;
    
    try {
      const data = await getInvoiceTemplates(user.id);
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const fetchExchangeRate = async () => {
  if (!formData.currency || formData.currency === baseCurrency) {
    setShowRateWarning(false);
    return;
  }
  
  try {
    const currentRate = exchangeRates[formData.currency] || 1;
    
    // Check if we're editing and rates are different
    if (isEdit && originalRate && Math.abs(currentRate - originalRate) > 0.01) {
      setShowRateWarning(true);
      
      // Don't auto-update if user prefers historical rate
      if (useHistoricalRate) {
        return;
      }
    }
  } catch (error) {
    console.error('Failed to check exchange rate:', error);
  }
};

// Handle template selection - ENHANCED VERSION with recurring support
const handleTemplateSelect = async (templateId: string) => {
  if (!templateId) return;
  
  const template = templates.find(t => t.id === templateId);
  if (!template) return;
  
  const templateData = template.template_data;
  
  // IMPORTANT: Preserve the current invoice number, or get a new one if empty
  let invoiceNumberToUse = formData.invoice_number;
  if (!invoiceNumberToUse && !isEdit && user) {
    try {
      invoiceNumberToUse = await getNextInvoiceNumber(user.id);
    } catch (error) {
      console.error('Error getting invoice number:', error);
      invoiceNumberToUse = `INV-${Date.now()}`;
    }
  }
  
  // Load template data into form
  setFormData(prev => ({
    ...prev,
    // Template fields that should be loaded
    tax_rate: templateData.tax_rate?.toString() || '0',
    notes: templateData.notes || '',
    payment_terms: templateData.payment_terms || 30,
    currency: templateData.currency || prev.currency || baseCurrency,
    income_category_id: templateData.income_category_id || prev.income_category_id || '',
    
    // Load recurring settings if template has them
    is_recurring: templateData.is_recurring || false,
    frequency: templateData.frequency || 'monthly',
    // Don't load recurring_end_date as it should be set per invoice
    
    // PRESERVE these critical fields - never override from template
    invoice_number: invoiceNumberToUse,
    client_id: prev.client_id,
    date: prev.date,
    due_date: prev.due_date,
    recurring_end_date: prev.recurring_end_date, // Keep any existing end date
  }));
  
  // Load items with all fields including VAT
  if (templateData.items && Array.isArray(templateData.items)) {
    setItems(templateData.items.map((item: any) => ({
      id: (Date.now() + Math.random()).toString(),
      description: item.description || '',
      quantity: item.quantity || 1,
      rate: item.rate || 0,
      amount: item.amount || 0,
      tax_rate: item.tax_rate || 0,
      tax_amount: item.tax_amount || 0,
      net_amount: item.net_amount || item.amount || 0,
      gross_amount: item.gross_amount || item.amount || 0
    })));
  }
  
  setSelectedTemplate(templateId);
  
  // If template has recurring settings, show a notification
  if (templateData.is_recurring) {
    console.log('Loaded recurring invoice template with frequency:', templateData.frequency);
  }
};

 // Save as template - FIXED VERSION with recurring support
const handleSaveAsTemplate = async () => {
  if (!user || !templateName.trim()) return;
  
  setSavingTemplate(true);
  
  try {
    // Build the template data
    let templateData: any = {
      // Store only reusable fields
      items: items.map(({ id, ...item }) => ({
        description: item.description || '',
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: item.amount || 0,
        tax_rate: item.tax_rate || 0,
        tax_amount: item.tax_amount || 0,
        net_amount: item.net_amount || item.amount || 0,
        gross_amount: item.gross_amount || item.amount || 0
      })),
      tax_rate: parseFloat(formData.tax_rate) || 0,
      notes: formData.notes || '',
      payment_terms: formData.payment_terms || 30,
      currency: formData.currency || baseCurrency,
      income_category_id: formData.income_category_id || null,
    };
    
    // If this is a recurring invoice, include recurring-specific data
    if (formData.is_recurring) {
      templateData = {
        ...templateData,
        // Add recurring-specific fields to template
        is_recurring: true,
        frequency: formData.frequency || 'monthly',
        // Don't save recurring_end_date as it's specific to each invoice
        
        // Include calculated totals for recurring templates
        subtotal: Number(subtotal.toFixed(2)),
        tax_amount: Number(taxAmount.toFixed(2)),
        total: Number(total.toFixed(2)),
        
        // Include VAT metadata if applicable
        tax_metadata: userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown ? {
          tax_scheme: userSettings?.uk_vat_scheme || 'standard',
          vat_breakdown: totals.vatBreakdown,
          has_line_item_vat: requiresLineItemVAT,
        } : null
      };
    }
    
    await createInvoiceTemplate({
      user_id: effectiveUserId || user.id,
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
      user_id: effectiveUserId || user.id,
      name: newClientData.name.trim(),
      company_name: newClientData.company_name || undefined,
      email: newClientData.email || undefined,
      phone: newClientData.phone || undefined,
      phone_country_code: newClientData.phone_country_code,
      address: newClientData.address || undefined
    });
    
    // Refresh React Query clients cache
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    
    // Add to DataContext cache
    addClientToCache(client); // ✅ Add this line
    
    // Select the new client
    setFormData(prev => ({ ...prev, client_id: client.id }));
    
    // Close modal and reset
    setShowClientModal(false);
    setNewClientData({ name: '', company_name: '', email: '', phone: '', phone_country_code: '+1', address: '' }); // ← UPDATE THIS LINE
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
    
    // ALWAYS use direct insert to avoid RPC issues
    console.log('Using direct invoice creation');
    
    // Direct insert to bypass the RPC function
    const { data: newInvoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        ...invoiceData,
        user_id: effectiveUserId || user.id,
        status: 'draft', // Let database handle the enum type
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
      .eq('user_id', effectiveUserId || user.id)
      .single();

    if (settings) {
      await supabase
        .from('invoice_settings')
        .update({ next_number: (settings.next_number || 1) + 1 })
        .eq('user_id', effectiveUserId || user.id);
    } else {
      // Create settings if they don't exist
      await supabase
        .from('invoice_settings')
        .insert({
          user_id: effectiveUserId || user.id,
          next_number: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }
    
    return newInvoice;
  },
  onSuccess: async (newInvoice) => {
  // Handle recurring invoice if needed
  if (formData.is_recurring) {
    // Build complete template data
    const templateInvoiceData = {
      // Client info - IMPORTANT for edge function
      client_id: formData.client_id || null,

      // Financial data
      subtotal: Number(subtotal.toFixed(2)),
      tax_rate: Number(parseFloat(formData.tax_rate) || 0),
      tax_amount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2)),

      // Currency - DON'T store exchange_rate, get fresh when generating
      currency: formData.currency || baseCurrency,
      // NO exchange_rate here - edge function will get current rate

      // Items with proper structure
      items: items.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        amount: Number(item.amount),
        // Include VAT fields
        tax_rate: item.tax_rate || 0,
        tax_amount: item.tax_amount || 0,
        net_amount: item.net_amount || item.amount,
        gross_amount: item.gross_amount || item.amount
      })),

      // Settings
      notes: formData.notes || null,
      payment_terms: formData.payment_terms || 30,
      income_category_id: formData.income_category_id || null,

      // ✅ NEW: Payment settings for Stripe integration
      payment_settings: pendingPaymentSettings?.paymentEnabled ? {
        payment_enabled: true,
        payment_providers: pendingPaymentSettings.providers || [],
        accepted_currencies: pendingPaymentSettings.currencies || []
      } : null,

      // VAT metadata for UK users
      tax_metadata: userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown ? {
        tax_scheme: userSettings?.uk_vat_scheme || 'standard',
        vat_breakdown: totals.vatBreakdown,
        has_line_item_vat: requiresLineItemVAT,
      } : null
    };
    
    const recurringData = {
      user_id: user!.id,
      invoice_id: newInvoice.id,
      client_id: formData.client_id || null, // Store at top level for edge function
      template_data: templateInvoiceData,
      frequency: formData.frequency,
      next_date: getNextInvoiceDate().toISOString().split('T')[0],
      end_date: formData.recurring_end_date || null,
      is_active: true
    };

    console.log('Creating recurring invoice:', recurringData);

    const { error: recurringError } = await supabase
      .from('recurring_invoices')
      .insert([recurringData]);
      
    if (recurringError) {
      console.error('Error creating recurring invoice:', recurringError);
      // Don't fail the whole invoice, just notify about recurring setup failure
      alert('Invoice created successfully, but recurring setup failed. Please try setting up recurring manually.');
    } else {
      console.log('Recurring invoice created successfully');
    }
  }

  // Save payment settings if they were enabled during invoice creation
  if (pendingPaymentSettings?.paymentEnabled) {
    try {
      await paymentService.enableInvoicePayments(
        newInvoice.id,
        pendingPaymentSettings.providers,
        pendingPaymentSettings.currencies
      );
    } catch (error) {
      console.error('Error saving payment settings:', error);
      // Don't fail the whole operation, just log the error
    }
  }

  queryClient.invalidateQueries({ queryKey: ['invoices'] });
  queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
  queryClient.invalidateQueries({ queryKey: ['nextInvoiceNumber'] });
  addInvoiceToCache(newInvoice);

  navigate('/invoices');
},
  onError: async (error: any) => {
    // Handle unique constraint violation (invoice number conflict)
    if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
      console.error('Invoice number conflict detected:', error);
      
      // Try to get a fresh number and retry once
      try {
        const freshNumber = await getNextInvoiceNumber(user!.id);
        const exists = await checkInvoiceNumberExists(user!.id, freshNumber);
        
        if (!exists) {
          // Update form with fresh number and show alert
          setFormData(prev => ({ ...prev, invoice_number: freshNumber }));
          alert(`Invoice number conflict detected. A new number has been assigned: ${freshNumber}. Please submit again.`);
        } else {
          alert('Invoice number conflict detected. Please refresh the page and try again.');
        }
      } catch (retryError) {
        console.error('Error getting fresh number for retry:', retryError);
        alert('Invoice number conflict detected. Please refresh the page and try again.');
      }
    } else {
      alert('Error creating invoice: ' + error.message);
    }
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
      // First check if a recurring invoice already exists
      const { data: existingRecurring } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('invoice_id', id)
        .single();
      
      const templateInvoiceData = {
        // Client info
        client_id: formData.client_id || null,

        // Financial data
        subtotal: Number(subtotal.toFixed(2)),
        tax_rate: Number(parseFloat(formData.tax_rate) || 0),
        tax_amount: Number(taxAmount.toFixed(2)),
        total: Number(total.toFixed(2)),

        // Currency only - NO exchange_rate
        currency: formData.currency || baseCurrency,

        // Items with proper structure
        items: items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          rate: Number(item.rate),
          amount: Number(item.amount),
          tax_rate: item.tax_rate || 0,
          tax_amount: item.tax_amount || 0,
          net_amount: item.net_amount || item.amount,
          gross_amount: item.gross_amount || item.amount
        })),

        // Settings
        notes: formData.notes || null,
        payment_terms: formData.payment_terms || 30,
        income_category_id: formData.income_category_id || null,

        // ✅ NEW: Payment settings for Stripe integration
        payment_settings: pendingPaymentSettings?.paymentEnabled ? {
          payment_enabled: true,
          payment_providers: pendingPaymentSettings.providers || [],
          accepted_currencies: pendingPaymentSettings.currencies || []
        } : null,

        // VAT metadata
        tax_metadata: userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown ? {
          tax_scheme: userSettings?.uk_vat_scheme || 'standard',
          vat_breakdown: totals.vatBreakdown,
          has_line_item_vat: requiresLineItemVAT,
        } : null
      };
      
      const recurringData = {
        template_data: templateInvoiceData,
        frequency: formData.frequency,
        next_date: getNextInvoiceDate().toISOString().split('T')[0],
        end_date: formData.recurring_end_date || null,
        is_active: true,
        client_id: formData.client_id || null
      };

      if (existingRecurring) {
        // Update existing recurring invoice
        const { error } = await supabase
          .from('recurring_invoices')
          .update(recurringData)
          .eq('invoice_id', id);
        
        if (error) {
          console.error('Error updating recurring invoice:', error);
          alert('Failed to update recurring settings');
        }
      } else {
        // Create new recurring invoice
        const { error } = await supabase
          .from('recurring_invoices')
          .insert({
            user_id: user!.id,
            invoice_id: id,
            ...recurringData
          });
        
        if (error) {
          console.error('Error creating recurring invoice:', error);
          alert('Failed to create recurring settings');
        }
      }
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

    if (invoice.status === 'paid' || invoice.status === 'canceled') {
      alert('This invoice is locked for compliance and cannot be edited.');
      navigate('/invoices');
      return;
    }

    // Load payment data if invoice has payments
    const loadPaymentData = async () => {
      if (invoice.payment_locked_at) {
        try {
          const payments = await getInvoicePayments(invoice.id);
          setInvoicePayments(payments);

          const balance = await calculateInvoiceBalance(invoice.id);
          setPaymentBalance(balance);
          setOriginalInvoiceTotal(invoice.total);
        } catch (err) {
          console.error('Error loading payment data:', err);
        }
      }
    };

    loadPaymentData();

    setFormData({
      invoice_number: invoice.invoice_number,
      client_id: invoice.client_id || '',
      project_id: (invoice as any).project_id || '',
      date: invoice.date,
      due_date: invoice.due_date,
      tax_rate: invoice.tax_rate.toString(),
      notes: invoice.notes || '',
      currency: invoice.currency || baseCurrency,
      is_recurring: !!recurringData,
      frequency: recurringData?.frequency || 'monthly',
      recurring_end_date: recurringData?.end_date || '',
      payment_terms: 30,
      income_category_id: invoice.income_category_id || ''
    });

    // Store original exchange rate
    if (invoice.exchange_rate && invoice.currency !== baseCurrency) {
      setOriginalRate(invoice.exchange_rate);
    }

    // FIX: Properly convert InvoiceItem[] to FormInvoiceItem[] with all required fields
    setItems(invoice.items?.map((item: InvoiceItem) => {
      const quantity = item.quantity || 1;
      const rate = item.rate || 0;
      const taxRate = item.tax_rate || 0;

      // Calculate values based on what we have
      const netAmount = item.net_amount || (quantity * rate);
      const taxAmount = item.tax_amount || ((netAmount * taxRate) / 100);
      const grossAmount = item.gross_amount || (netAmount + taxAmount);

      return {
        id: item.id,
        description: item.description,
        quantity: quantity,
        rate: rate,
        amount: item.amount || netAmount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        net_amount: netAmount,
        gross_amount: grossAmount
      };
    }) || []);
  }
}, [invoiceData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Handle recurring template mode differently
    if (isRecurringTemplateMode && recurringTemplateId) {
      await handleSaveRecurringTemplate();
      return;
    }

    // Validate partially locked invoices (has payments but not fully paid)
    if (isEdit && invoiceData?.invoice.payment_locked_at && paymentBalance) {
      const newTotal = total;

      if (newTotal < paymentBalance.total_paid) {
        alert(`Invoice total cannot be less than amount already paid (${formatCurrency(paymentBalance.total_paid, formData.currency || baseCurrency)})`);
        return;
      }

      // Check if trying to change client on partially locked invoice
      if (formData.client_id !== invoiceData.invoice.client_id) {
        alert('Cannot change client on invoice with payments');
        return;
      }
    }

    // Check if online
  if (!isOnline) {
    alert('You must be online to create invoices. Please check your internet connection.');
    return;
  }
  
  // For new invoices, get a fresh invoice number right before creating
if (!isEdit) {
  try {
    const freshInvoiceNumber = await getNextInvoiceNumber(user!.id);
    console.log('Fresh invoice number:', freshInvoiceNumber);
    
    // Double-check this number doesn't exist
    const numberExists = await checkInvoiceNumberExists(
      user!.id, 
      freshInvoiceNumber
    );
    
    if (numberExists) {
      console.warn('Invoice number already exists, getting new one:', freshInvoiceNumber);
      // Retry once to get a truly fresh number
      const retryNumber = await getNextInvoiceNumber(user!.id);
      const retryExists = await checkInvoiceNumberExists(user!.id, retryNumber);
      
      if (retryExists) {
        console.error('Retry number also exists:', retryNumber);
        alert('Invoice number generation conflict. Please refresh the page and try again.');
        return;
      }
      
      // Use the retry number
      formData.invoice_number = retryNumber;
      setFormData(prev => ({ ...prev, invoice_number: retryNumber }));
      await new Promise(resolve => setTimeout(resolve, 100));
      // Continue with retry number
    } else {
    
      // Update form data with fresh number
      formData.invoice_number = freshInvoiceNumber;
      
      // Also update the state so UI shows the new number
      setFormData(prev => ({ ...prev, invoice_number: freshInvoiceNumber }));
      
      // Small delay to ensure state update
      await new Promise(resolve => setTimeout(resolve, 100));
    }
      
    } catch (error) {
      console.error('Error getting fresh invoice number:', error);
      alert('Error generating invoice number. Please try again.');
      return;
    }
  }
 // Validate invoice number uniqueness
  if (!isEdit || (isEdit && formData.invoice_number !== invoiceData?.invoice.invoice_number)) {
    try {
      const exists = await checkInvoiceNumberExists(
        user!.id, 
        formData.invoice_number, 
        isEdit ? id : undefined
      );
      
      if (exists) {
        alert(`Invoice number ${formData.invoice_number} already exists. Please use a different number.`);
        return;
      }
    } catch (error) {
      console.error('Error checking invoice number:', error);
      alert('Error validating invoice number. Please try again.');
      return;
    }
  }

    // Calculate exchange rate
 // Calculate exchange rate
    const exchangeRate = formData.currency === baseCurrency 
      ? 1 
      : (useHistoricalRate && originalRate && isEdit ? originalRate : (exchangeRates[formData.currency] || 1));
    
  // Calculate base amount (NET amount in base currency, excluding VAT)
// CRITICAL: Use subtotal not total to avoid VAT being included in base currency calculations
const baseAmount = subtotal / exchangeRate;
const baseTaxAmount = taxAmount / exchangeRate;
    
    if (!user) return;
    
    // Create clean invoice data without any discount fields
    const cleanInvoiceData = {
      invoice_number: formData.invoice_number,
      client_id: formData.client_id || null,
      project_id: formData.project_id || null,
      date: formData.date,
      due_date: formData.due_date,
      subtotal: Number(subtotal.toFixed(2)),
      tax_rate: Number(parseFloat(formData.tax_rate) || 0),
      tax_amount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2)),
      notes: formData.notes || null,
      // status: 'draft' ,
      exchange_rate: exchangeRate,
      currency: formData.currency,
    base_amount: baseAmount,
    base_tax_amount: baseTaxAmount,
      income_category_id: formData.income_category_id || null,
      // Add VAT metadata with breakdown for UK users
tax_metadata: userCountry?.code === 'GB' ? {
  tax_scheme: userSettings?.uk_vat_scheme || 'standard',
  is_reverse_charge: false, // TODO: Add UI for this
  intra_eu_supply: false, // TODO: Add UI for this
  vat_breakdown: totals.vatBreakdown, // Include the VAT breakdown
  has_line_item_vat: requiresLineItemVAT,
} : null,
    };
    
    if (isEdit && id) {
      updateInvoiceMutation.mutate({ id, invoiceData: cleanInvoiceData, items });
    } else {
      createInvoiceMutation.mutate({ invoiceData: cleanInvoiceData, items });
    }
  };
  

  const addItem = () => {
  const defaultTaxRate = requiresLineItemVAT 
    ? 20 // Default to standard VAT rate for UK
    : parseFloat(formData.tax_rate) || 0;
    
  const newItem: FormInvoiceItem = {
    id: Date.now().toString(),
    description: '',
    quantity: 1,
    rate: 0,
    amount: 0,
    tax_rate: defaultTaxRate,
    tax_amount: 0,
    net_amount: 0,
    gross_amount: 0
  };
  setItems([...items, newItem]);
};

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof FormInvoiceItem, value: any) => {
  setItems(items.map(item => {
    if (item.id === id) {
      const updatedItem = { ...item, [field]: value };
      
      // Recalculate amounts when quantity, rate, or tax changes
      if (field === 'quantity' || field === 'rate' || field === 'tax_rate') {
        const quantity = field === 'quantity' ? Number(value) : item.quantity;
        const rate = field === 'rate' ? Number(value) : item.rate;
        const taxRate = field === 'tax_rate' ? Number(value) : (item.tax_rate || 0);
        
        if (requiresLineItemVAT) {
          // Use proper VAT calculation for UK/EU
          const vatCalc = calculateVATFromNet(quantity * rate, taxRate);
          updatedItem.net_amount = vatCalc.net;
          updatedItem.tax_amount = vatCalc.vat;
          updatedItem.gross_amount = vatCalc.gross;
          updatedItem.amount = vatCalc.gross;
        } else {
          // Simple calculation for other countries
          const netAmount = quantity * rate;
          const taxAmount = (netAmount * taxRate) / 100;
          const grossAmount = netAmount + taxAmount;
          
          updatedItem.net_amount = netAmount;
          updatedItem.tax_amount = taxAmount;
          updatedItem.gross_amount = grossAmount;
          updatedItem.amount = netAmount;
        }
      }
      
      return updatedItem;
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
if (!isUserSettingsReady) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-600">Loading your settings...</p>
        </div>
      </div>
    </div>
  );
}
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
  <div className="mb-8">
  <div className="flex justify-between items-center">
    <h1 className="text-2xl font-bold text-gray-900">
      {isRecurringTemplateMode ? 'Edit Recurring Invoice Template' : (id ? 'Edit Invoice' : 'Create New Invoice')}
    </h1>
    {!isOnline && (
  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
    <div className="flex items-center">
      <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
      <p className="text-sm text-yellow-800">
        You are offline. Internet connection is required to create invoices.
      </p>
    </div>
  </div>
)}
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

      {/* Recurring Template Mode Warning */}
      {isRecurringTemplateMode && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3 mb-4">
          <AlertCircle className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-indigo-900">Editing Recurring Invoice Template</p>
            <p className="text-sm text-indigo-700 mt-1">
              You're editing the template for future recurring invoices. Changes will only affect invoices generated after you save.
            </p>
          </div>
        </div>
      )}

      {/* Partially Locked Invoice Warning */}
      {isEdit && invoiceData?.invoice.payment_locked_at && paymentBalance && paymentBalance.balance_due > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3 mb-4">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900">This invoice has received payments - Limited editing allowed</p>
            <p className="text-sm text-yellow-700 mt-1">
              <strong>Total Paid:</strong> {formatCurrency(paymentBalance.total_paid, formData.currency || baseCurrency)} | <strong>Balance Due:</strong> {formatCurrency(paymentBalance.balance_due, formData.currency || baseCurrency)}
            </p>
            <p className="text-sm text-yellow-700 mt-2">
              <strong>Allowed:</strong> Adding items, increasing quantities, extending due date, adding notes<br/>
              <strong>Not Allowed:</strong> Changing client, invoice date, reducing total below paid amount, deleting existing items
            </p>
          </div>
        </div>
      )}

      <UsageLimitGate type="invoices">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Selection - Enhanced with recurring indicator */}
{!isEdit && !isRecurringTemplateMode && templates.length > 0 && (
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
            {template.template_data?.is_recurring && ' 🔄 (Recurring)'}
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
    {selectedTemplate && templates.find(t => t.id === selectedTemplate)?.template_data?.is_recurring && (
      <p className="mt-2 text-sm text-blue-600">
        <RefreshCw className="inline h-3 w-3 mr-1" />
        This template includes recurring invoice settings
      </p>
    )}
  </div>
)}

        <div className="bg-white rounded-lg shadow p-6">
          {/* Invoice Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Hide Invoice Number in recurring template mode */}
            {!isRecurringTemplateMode && (
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
                disabled={!isEdit && !formData.invoice_number}
              />
              {!isEdit && !formData.invoice_number && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client
                {isRecurringTemplateMode && (
                  <span className="ml-2 text-xs text-gray-500">(Locked)</span>
                )}
              </label>
              {isRecurringTemplateMode ? (
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg flex items-center gap-2">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-gray-700">
                    {clients.find(c => c.id === formData.client_id)?.name || 'No client selected'}
                  </span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={isEdit && !!invoiceData?.invoice.payment_locked_at}
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
              )}
              {isRecurringTemplateMode && (
                <p className="mt-1 text-xs text-gray-500">
                  To change the client, create a new recurring invoice
                </p>
              )}
            </div>

            {/* Project Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project (Optional)
              </label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No project</option>
                {projects
                  .filter((p: any) => !formData.client_id || p.client_id === formData.client_id)
                  .map((project: any) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
              {formData.client_id && (
                <p className="text-xs text-gray-500 mt-1">
                  {projects.filter((p: any) => p.client_id === formData.client_id).length > 0
                    ? 'Showing projects for selected client'
                    : 'No projects found for this client'}
                </p>
              )}
            </div>

            {/* Hide Invoice Date in recurring template mode */}
            {!isRecurringTemplateMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isEdit && !!invoiceData?.invoice.payment_locked_at}
                required
              />
            </div>
            )}

            {/* Hide Due Date in recurring template mode */}
            {!isRecurringTemplateMode && (
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
            )}
          </div>
          {/* Add Currency Selection HERE */}
<div className="mb-6">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Invoice Currency
    {isRecurringTemplateMode && (
      <span className="ml-2 text-xs text-gray-500">(Locked)</span>
    )}
  </label>
  {isRecurringTemplateMode ? (
    <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg flex items-center gap-2">
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span className="text-gray-700">
        {formData.currency} - {getCurrencySymbol(formData.currency)}
      </span>
    </div>
  ) : (
    <select
      value={formData.currency}
      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {userSettings?.enabled_currencies?.map(currency => (
        <option key={currency} value={currency}>
          {currency} - {getCurrencySymbol(currency)}
        </option>
      ))}
    </select>
  )}
  {!isRecurringTemplateMode && formData.currency !== baseCurrency && exchangeRates[formData.currency] && (
    <p className="text-xs text-gray-500 mt-1">
      Rate: 1 {baseCurrency} = {exchangeRates[formData.currency].toFixed(4)} {formData.currency}
    </p>
  )}
  {isRecurringTemplateMode && (
    <p className="mt-1 text-xs text-gray-500">
      To change currency, create a new recurring invoice
    </p>
  )}
</div>

{/* Exchange Rate Warning */}
{showRateWarning && isEdit && originalRate && (
  <div className="mt-4">
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">
            Exchange Rate Changed
          </h4>
          <p className="text-sm text-yellow-700 mb-3">
            The exchange rate has changed since this invoice was created:
          </p>
          <div className="text-sm space-y-1 mb-3">
            <div>Original rate: <span className="font-medium">1 {baseCurrency} = {originalRate.toFixed(4)} {formData.currency}</span></div>
            <div>Current rate: <span className="font-medium">1 {baseCurrency} = {exchangeRates[formData.currency]?.toFixed(4) || 'N/A'} {formData.currency}</span></div>
          </div>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                checked={useHistoricalRate}
                onChange={() => setUseHistoricalRate(true)}
                className="mr-2"
              />
              <span className="text-sm text-yellow-700">Use original rate (historical)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={!useHistoricalRate}
                onChange={() => setUseHistoricalRate(false)}
                className="mr-2"
              />
              <span className="text-sm text-yellow-700">Use current rate</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

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

          {/* Recurring Invoice Options - Hide in recurring template mode */}
          {!isRecurringTemplateMode && (
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
          )}

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
            {requiresLineItemVAT && (
              <>
                <div className="w-24 text-center">{taxLabel} %</div>
                <div className="w-32 text-right">{taxLabel}</div>
              </>
            )}
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
      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
      min="0"
      step="any"
      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
      required
    />
    <input
      type="number"
      value={item.rate}
      onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
      min="0"
      step="0.01"
      placeholder="0.00"
      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
      required
    />
    {requiresLineItemVAT && (
      <>
        <select
          value={item.tax_rate || 0}
          onChange={(e) => updateItem(item.id, 'tax_rate', e.target.value)}
          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
        >
          <option value="0">0%</option>
          {taxRates.map((tax) => (
            <option key={tax.id} value={tax.rate}>
              {tax.rate}%
            </option>
          ))}
        </select>
        <div className="w-32 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-right text-gray-600">
          {formatCurrency(item.tax_amount || 0, formData.currency)}
        </div>
      </>
    )}
    <div className="w-32 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-right font-medium">
      {formatCurrency(requiresLineItemVAT ? (item.gross_amount || 0) : (item.amount || 0), formData.currency)}
    </div>
    <button
      type="button"
      onClick={() => removeItem(item.id)}
      className="p-2 text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
      disabled={isEdit && !!invoiceData?.invoice.payment_locked_at}
      title={isEdit && !!invoiceData?.invoice.payment_locked_at ? "Cannot delete items from invoices with payments" : "Delete item"}
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
        <span className="font-medium">{formatCurrency(subtotal, formData.currency)}</span>
      </div>
      
      {/* Show tax differently based on VAT type */}
      {!requiresLineItemVAT ? (
        // For countries without line item VAT - show dropdown
        <div className="flex justify-between items-center">
          <span className="text-gray-600">{taxLabel}</span>
          <div className="flex items-center gap-2">
            <select
              value={formData.tax_rate}
              onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
              className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
            >
              <option value="0">0%</option>
              {taxRates.map((tax) => (
                <option key={tax.id} value={tax.rate}>
                  {tax.rate}%
                </option>
              ))}
            </select>
            <span className="font-medium w-20 text-right">{formatCurrency(taxAmount, formData.currency)}</span>
          </div>
        </div>
      ) : (
        // For UK/EU - just show the calculated tax
        <div className="flex justify-between">
          <span className="text-gray-600">{taxLabel}</span>
          <span className="font-medium">{formatCurrency(taxAmount, formData.currency)}</span>
        </div>
      )}
      
      <div className="flex justify-between text-lg font-bold pt-2 border-t">
        <span>Total</span>
        <div className="text-right">
          <div>{formatCurrency(total, formData.currency)}</div>
          {formData.currency !== baseCurrency && (
            <div className="text-sm font-normal text-gray-500">
              ({formatCurrency(total / (exchangeRates[formData.currency] || 1), baseCurrency)})
            </div>
          )}
        </div>
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

          {/* Payment Settings - NEW SECTION */}
          <div className="mt-6">
            <InvoicePaymentSettings
              invoiceId={id}
              currency={formData.currency}
              onUpdate={(settings) => {
                // Store settings for new invoices to save after creation
                if (!id) {
                  setPendingPaymentSettings(settings);
                }
              }}
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting || savingTemplate}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {(isSubmitting || savingTemplate) ? 'Saving...' : (isRecurringTemplateMode ? 'Save Template Changes' : (isEdit ? 'Update Invoice' : 'Create Invoice'))}
            </button>
            
            {/* Save as Template button - only show when creating new invoice and not in recurring template mode */}
            {!isEdit && !isRecurringTemplateMode && (
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
        <InvoiceSettings onClose={() => setShowSettings(false)} />
      )}
      
      {/* Client Creation Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            onClick={() => {
              setShowClientModal(false);
              setNewClientData({ name: '', company_name: '', email: '', phone: '', phone_country_code: '+1', address: '' });
            }} 
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative transform overflow-hidden rounded-2xl bg-white/95 backdrop-blur-lg max-w-md w-full shadow-2xl border border-white/60 transition-all">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Add New Client</h3>
                <button
                  onClick={() => {
                    setShowClientModal(false);
                    setNewClientData({ name: '', company_name: '', email: '', phone: '', phone_country_code: '+1', address: '' });
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
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={newClientData.company_name}
                    onChange={(e) => setNewClientData({ ...newClientData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Company name (optional)"
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
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Country Code
    </label>
    <select
      value={newClientData.phone_country_code}
      onChange={(e) => setNewClientData({ ...newClientData, phone_country_code: e.target.value })}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {COUNTRY_CODES.map((country) => (
        <option key={country.code} value={country.code}>
          {country.flag} {country.code}
        </option>
      ))}
    </select>
  </div>
  <div className="md:col-span-3">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Phone
    </label>
    <input
      type="tel"
      value={newClientData.phone}
      onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="1234567890 (without country code)"
    />
  </div>
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
                  setNewClientData({ name: '', company_name: '', email: '', phone: '', phone_country_code: '+1', address: '' });
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
        </div>
      )}
    </div>
  );
};