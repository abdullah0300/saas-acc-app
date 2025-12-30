// src/components/CreditNote/CreditNoteForm.tsx
// REDESIGNED: 3-Type Card Selection System
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Package,
  DollarSign,
  Percent,
  FileText,
  Mail,
  X,
  Check,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import {
  createCreditNote,
  updateCreditNote,
  getCreditNote,
  getInvoice,
  getNextCreditNoteNumber,
  getOrCreateCreditNotesCategory
} from '../../services/database';
import { supabase } from '../../services/supabaseClient';
import { CreditNote, CreditNoteItem, CreditNoteReason, CreditNoteStatus, Invoice } from '../../types';
import { format } from 'date-fns';
import { countries } from '../../data/countries';

// Credit type for the card selection
type CreditType = 'full' | 'partial' | 'adjustment';

interface FormCreditNoteItem extends Partial<CreditNoteItem> {
  tempId: string;
  selected?: boolean;
  maxQuantity?: number;
  originalInvoiceItem?: any;
}

export const CreditNoteForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id, invoiceId } = useParams();
  const { formatCurrency, baseCurrency, userSettings } = useSettings();
  const isEdit = !!id;

  // Core states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // NEW: Credit type selection
  const [creditType, setCreditType] = useState<CreditType>('full');
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Type selection, Step 2: Details

  // Email dialog
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailData, setEmailData] = useState({ to: '', cc: '', message: '' });

  // Form data
  const [formData, setFormData] = useState<{
    credit_note_number: string;
    invoice_id: string;
    client_id: string;
    date: string;
    reason: CreditNoteReason;
    reason_description: string;
    notes: string;
    status: CreditNoteStatus;
    currency: string;
    exchange_rate: number;
    subtotal: number;
    tax_amount: number;
    tax_rate: number;
    total: number;
    base_amount: number;
    tax_metadata?: any;
  }>({
    credit_note_number: '',
    invoice_id: invoiceId || '',
    client_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    reason: 'adjustment',
    reason_description: '',
    notes: '',
    status: 'draft',
    currency: baseCurrency,
    exchange_rate: 1,
    subtotal: 0,
    tax_amount: 0,
    tax_rate: 0,
    total: 0,
    base_amount: 0,
  });

  const [items, setItems] = useState<FormCreditNoteItem[]>([]);

  // Computed values
  const userCountry = countries.find(c => c.code === userSettings?.country);
  const isUK = userSettings?.country === 'GB' || formData.currency === 'GBP';
  const isEU = ['DE', 'FR', 'ES', 'IT', 'NL'].includes(userSettings?.country || '');
  const taxLabel = userCountry?.taxName || 'Tax';

  // Available credit
  const remainingCredit = invoice
    ? invoice.total - (invoice.total_credited || 0)
    : Number.MAX_SAFE_INTEGER;

  // Calculate credit amount based on type
  const getCreditAmount = (): number => {
    if (creditType === 'full') {
      return remainingCredit;
    } else if (creditType === 'adjustment') {
      return customAmount;
    } else {
      // Partial - sum selected items
      return items.filter(i => i.selected).reduce((sum, i) => sum + (i.gross_amount || i.amount || 0), 0);
    }
  };

  const creditAmount = getCreditAmount();
  const isOverLimit = creditAmount > remainingCredit;

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user, id, invoiceId]);

  const loadInitialData = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      if (isEdit && id) {
        await loadExistingCreditNote();
      } else if (invoiceId) {
        await loadInvoiceForCredit();
      } else {
        await generateCreditNoteNumber();
      }
    } catch (err: any) {
      setError(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const generateCreditNoteNumber = async () => {
    if (!user) return;
    const nextNumber = await getNextCreditNoteNumber(user.id);
    setFormData(prev => ({ ...prev, credit_note_number: nextNumber }));
  };

  const loadInvoiceForCredit = async () => {
    if (!invoiceId || !user) return;

    const { data: invoiceData } = await supabase
      .from('invoices')
      .select(`*, client:clients(*), items:invoice_items(*)`)
      .eq('id', invoiceId)
      .single();

    if (!invoiceData) throw new Error('Invoice not found');

    // Get credit tracking
    let alreadyCredited = invoiceData.total_credited || 0;
    if (alreadyCredited === 0) {
      const { data: tracking } = await supabase
        .from('invoice_credit_tracking')
        .select('total_credited')
        .eq('invoice_id', invoiceId)
        .maybeSingle();
      if (tracking) alreadyCredited = tracking.total_credited;
    }

    // Check invoice status
    if (invoiceData.status === 'canceled') {
      throw new Error('Cannot create credit notes for canceled invoices.');
    }

    if (invoiceData.status === 'paid') {
      const confirmed = window.confirm(
        '⚠️ REFUND NOTICE: This invoice is already paid.\n\n' +
        'Creating a credit note will create a NEGATIVE income entry to record the refund.\n\n' +
        'This is the proper accounting workflow for refunds.\n\nContinue?'
      );
      if (!confirmed) {
        navigate('/credit-notes');
        return;
      }
    }

    setInvoice({ ...invoiceData, total_credited: alreadyCredited });

    if (alreadyCredited >= invoiceData.total) {
      throw new Error('This invoice has been fully credited');
    }

    // Set form data
    setFormData(prev => ({
      ...prev,
      invoice_id: invoiceId,
      client_id: invoiceData.client_id || '',
      currency: invoiceData.currency || baseCurrency,
      exchange_rate: invoiceData.exchange_rate || 1,
      tax_rate: invoiceData.tax_rate || 0,
    }));

    // Set email if client has one
    if (invoiceData.client?.email) {
      setEmailData(prev => ({ ...prev, to: invoiceData.client?.email || '' }));
    }

    // Load items for partial return option
    if (invoiceData.items && invoiceData.items.length > 0) {
      const creditItems: FormCreditNoteItem[] = invoiceData.items.map((item: any, index: number) => ({
        tempId: `item-${Date.now()}-${index}`,
        invoice_item_id: item.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        tax_rate: item.tax_rate || invoiceData.tax_rate || 0,
        tax_amount: item.tax_amount || 0,
        net_amount: item.net_amount || item.amount,
        gross_amount: item.gross_amount || (item.amount + (item.tax_amount || 0)),
        selected: false,
        maxQuantity: item.quantity,
        originalInvoiceItem: item
      }));
      setItems(creditItems);
    }

    await generateCreditNoteNumber();
  };

  const loadExistingCreditNote = async () => {
    if (!id || !user) return;
    const creditNoteData = await getCreditNote(id);

    // Determine credit type from existing data
    if (creditNoteData.reason === 'adjustment') {
      setCreditType('adjustment');
      setCustomAmount(creditNoteData.total);
    } else if (creditNoteData.items && creditNoteData.items.length === 1 &&
      creditNoteData.total === creditNoteData.invoice?.total) {
      setCreditType('full');
    } else {
      setCreditType('partial');
    }

    setFormData({
      credit_note_number: creditNoteData.credit_note_number,
      invoice_id: creditNoteData.invoice_id,
      client_id: creditNoteData.client_id || '',
      date: creditNoteData.date,
      reason: creditNoteData.reason,
      reason_description: creditNoteData.reason_description || '',
      notes: creditNoteData.notes || '',
      status: creditNoteData.status,
      currency: creditNoteData.currency || baseCurrency,
      exchange_rate: creditNoteData.exchange_rate || 1,
      subtotal: creditNoteData.subtotal,
      tax_amount: creditNoteData.tax_amount || 0,
      tax_rate: creditNoteData.tax_rate || 0,
      total: creditNoteData.total,
      base_amount: creditNoteData.base_amount || creditNoteData.total,
      tax_metadata: creditNoteData.tax_metadata
    });

    if (creditNoteData.items) {
      setItems(creditNoteData.items.map((item: CreditNoteItem, index: number) => ({
        ...item,
        tempId: `existing-${item.id || index}`,
        selected: true
      })));
    }

    if (creditNoteData.invoice_id) {
      const invoiceData = await getInvoice(creditNoteData.invoice_id);
      setInvoice(invoiceData);
      if (invoiceData.client?.email) {
        setEmailData(prev => ({ ...prev, to: invoiceData.client?.email || '' }));
      }
    }

    setStep(2); // Go directly to details for edit
  };

  const toggleItemSelection = (tempId: string) => {
    setItems(items.map(item =>
      item.tempId === tempId ? { ...item, selected: !item.selected } : item
    ));
  };

  const updateItemQuantity = (tempId: string, newQuantity: number) => {
    setItems(items.map(item => {
      if (item.tempId === tempId) {
        const quantity = Math.max(0, Math.min(newQuantity, item.maxQuantity || item.quantity || 1));
        const rate = item.rate || 0;
        const amount = quantity * rate;
        const taxRate = item.tax_rate || formData.tax_rate || 0;
        const taxAmount = (amount * taxRate) / 100;
        return {
          ...item,
          quantity,
          amount,
          net_amount: amount,
          tax_amount: taxAmount,
          gross_amount: amount + taxAmount,
          selected: quantity > 0
        };
      }
      return item;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (creditAmount <= 0) {
      setError('Credit amount must be greater than zero');
      return;
    }
    if (isOverLimit) {
      setError(`Cannot credit more than available: ${formatCurrency(remainingCredit, formData.currency)}`);
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Prepare items based on credit type
      let itemsToSave: Partial<CreditNoteItem>[] = [];
      let finalReason: CreditNoteReason = 'adjustment';
      let finalTotal = creditAmount;
      let finalSubtotal = creditAmount;
      let finalTaxAmount = 0;

      if (creditType === 'full') {
        // Full refund - all items
        finalReason = 'return';
        if (items.length > 0) {
          itemsToSave = items.map(({ tempId, selected, maxQuantity, originalInvoiceItem, id, ...item }) => ({
            ...item,
            selected: undefined
          }));
          finalSubtotal = items.reduce((sum, i) => sum + (i.net_amount || i.amount || 0), 0);
          finalTaxAmount = items.reduce((sum, i) => sum + (i.tax_amount || 0), 0);
        } else {
          // Single item for simple invoices
          itemsToSave = [{
            description: `Full Refund for Invoice #${invoice?.invoice_number}`,
            quantity: 1,
            rate: remainingCredit,
            amount: remainingCredit,
            net_amount: remainingCredit,
            gross_amount: remainingCredit,
          }];
        }
        finalTotal = remainingCredit;

      } else if (creditType === 'partial') {
        // Partial return - selected items only
        finalReason = 'return';
        const selectedItems = items.filter(i => i.selected);
        itemsToSave = selectedItems.map(({ tempId, selected, maxQuantity, originalInvoiceItem, id, ...item }) => item);
        finalSubtotal = selectedItems.reduce((sum, i) => sum + (i.net_amount || i.amount || 0), 0);
        finalTaxAmount = selectedItems.reduce((sum, i) => sum + (i.tax_amount || 0), 0);
        finalTotal = finalSubtotal + finalTaxAmount;

      } else {
        // Price adjustment - custom amount, single line item
        finalReason = 'adjustment';
        itemsToSave = [{
          description: formData.reason_description || `Price Adjustment for Invoice #${invoice?.invoice_number}`,
          quantity: 1,
          rate: customAmount,
          amount: customAmount,
          net_amount: customAmount,
          gross_amount: customAmount,
          tax_rate: 0,
          tax_amount: 0,
        }];
        finalTotal = customAmount;
        finalSubtotal = customAmount;
        finalTaxAmount = 0;
      }

      const creditNoteData = {
        ...formData,
        reason: finalReason,
        subtotal: finalSubtotal,
        tax_amount: finalTaxAmount,
        total: finalTotal,
        base_amount: finalTotal / (formData.exchange_rate || 1),
      };

      if (isEdit && id) {
        await updateCreditNote(id, creditNoteData, itemsToSave);
        setSuccess('Credit note updated successfully');
      } else {
        await createCreditNote(user.id, creditNoteData, itemsToSave);
        setSuccess('Credit note created successfully');
        if (invoice?.client?.email) {
          setShowEmailDialog(true);
        }
      }

      if (!showEmailDialog) {
        setTimeout(() => navigate('/credit-notes'), 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Error saving credit note');
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!formData.credit_note_number) return;
    setSendingEmail(true);
    setError('');

    try {
      const { error } = await supabase.functions.invoke('send-credit-note-email', {
        body: {
          creditNoteId: id || formData.credit_note_number,
          recipientEmail: emailData.to,
          ccEmails: emailData.cc ? emailData.cc.split(',').map(e => e.trim()) : [],
          message: emailData.message
        }
      });
      if (error) throw error;
      setSuccess('Email sent successfully');
      setShowEmailDialog(false);
      setTimeout(() => navigate('/credit-notes'), 1000);
    } catch (err: any) {
      setError(err.message || 'Error sending email');
    } finally {
      setSendingEmail(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Edit Credit Note' : 'Issue Credit Note'}
            </h1>
            {invoice && (
              <p className="text-gray-500 mt-1">
                For Invoice <span className="font-mono font-semibold">#{invoice.invoice_number}</span>
                {' • '}{invoice.client?.name}
              </p>
            )}
          </div>
          {invoice && (
            <div className="text-right">
              <p className="text-sm text-gray-500">Available to Credit</p>
              <p className={`text-2xl font-bold ${remainingCredit <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(remainingCredit, invoice.currency || baseCurrency)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Step Indicator */}
      <div className="mb-8 flex items-center justify-center">
        <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            {step > 1 ? <Check className="h-5 w-5" /> : '1'}
          </div>
          <span className="ml-2 font-medium">Credit Type</span>
        </div>
        <ChevronRight className="h-5 w-5 mx-4 text-gray-300" />
        <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            2
          </div>
          <span className="ml-2 font-medium">Details & Confirm</span>
        </div>
      </div>

      {/* Step 1: Credit Type Selection */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-900">What type of credit are you issuing?</h2>
            <p className="text-gray-500 mt-2">Choose the option that best describes your situation</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Full Refund Card */}
            <button
              type="button"
              onClick={() => setCreditType('full')}
              className={`p-6 rounded-2xl border-2 text-left transition-all hover:shadow-lg ${creditType === 'full'
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${creditType === 'full' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                <Package className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Full Refund</h3>
              <p className="text-sm text-gray-500 mb-4">
                Customer returns everything and gets a complete refund
              </p>
              <div className={`text-lg font-bold ${creditType === 'full' ? 'text-blue-600' : 'text-gray-700'}`}>
                {formatCurrency(remainingCredit, formData.currency)}
              </div>
            </button>

            {/* Partial Return Card */}
            <button
              type="button"
              onClick={() => setCreditType('partial')}
              disabled={items.length === 0}
              className={`p-6 rounded-2xl border-2 text-left transition-all hover:shadow-lg ${creditType === 'partial'
                ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200'
                : 'border-gray-200 hover:border-gray-300'
                } ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${creditType === 'partial' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                <Package className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Partial Return</h3>
              <p className="text-sm text-gray-500 mb-4">
                Customer returns some items only, keep the rest
              </p>
              <div className={`text-sm ${creditType === 'partial' ? 'text-orange-600' : 'text-gray-500'}`}>
                {items.length > 0 ? `${items.length} items to choose from` : 'No items available'}
              </div>
            </button>

            {/* Price Adjustment Card */}
            <button
              type="button"
              onClick={() => setCreditType('adjustment')}
              className={`p-6 rounded-2xl border-2 text-left transition-all hover:shadow-lg ${creditType === 'adjustment'
                ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${creditType === 'adjustment' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Price Adjustment</h3>
              <p className="text-sm text-gray-500 mb-4">
                Give discount or credit, customer keeps items
              </p>
              <div className={`text-sm ${creditType === 'adjustment' ? 'text-green-600' : 'text-gray-500'}`}>
                Enter any custom amount
              </div>
            </button>
          </div>

          {/* Continue Button */}
          <div className="flex justify-center pt-6">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              Continue
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Details Form */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Badge */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ← Change Type
            </button>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${creditType === 'full' ? 'bg-blue-100 text-blue-700' :
              creditType === 'partial' ? 'bg-orange-100 text-orange-700' :
                'bg-green-100 text-green-700'
              }`}>
              {creditType === 'full' ? '📦 Full Refund' :
                creditType === 'partial' ? '📦 Partial Return' :
                  '💰 Price Adjustment'}
            </div>
          </div>

          {/* Credit Amount Section - Different for each type */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Credit Amount</h3>
            </div>
            <div className="p-6">
              {creditType === 'full' && (
                <div className="text-center py-4">
                  <p className="text-gray-500 mb-2">Full invoice amount will be credited</p>
                  <p className="text-4xl font-bold text-blue-600">
                    {formatCurrency(remainingCredit, formData.currency)}
                  </p>
                </div>
              )}

              {creditType === 'partial' && (
                <div className="space-y-4">
                  <p className="text-gray-600 mb-4">Select items being returned:</p>
                  {items.map((item, index) => (
                    <div
                      key={item.tempId}
                      className={`p-4 border rounded-xl transition-all ${item.selected ? 'border-orange-400 bg-orange-50' : 'border-gray-200'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleItemSelection(item.tempId)}
                            className={`w-6 h-6 rounded-md flex items-center justify-center ${item.selected ? 'bg-orange-500 text-white' : 'border-2 border-gray-300'
                              }`}
                          >
                            {item.selected && <Check className="h-4 w-4" />}
                          </button>
                          <div>
                            <p className="font-medium text-gray-900">{item.description}</p>
                            <p className="text-sm text-gray-500">
                              {item.maxQuantity} × {formatCurrency(item.rate || 0, formData.currency)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {item.selected && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">Qty:</span>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(item.tempId, parseFloat(e.target.value) || 0)}
                                min="0"
                                max={item.maxQuantity}
                                step="1"
                                className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center"
                              />
                              <span className="text-sm text-gray-400">of {item.maxQuantity}</span>
                            </div>
                          )}
                          <p className={`font-semibold ${item.selected ? 'text-orange-600' : 'text-gray-400'}`}>
                            {formatCurrency(item.gross_amount || item.amount || 0, formData.currency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-gray-200 text-right">
                    <p className="text-gray-500">Total Credit</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(creditAmount, formData.currency)}
                    </p>
                  </div>
                </div>
              )}

              {creditType === 'adjustment' && (
                <div className="max-w-md mx-auto">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter credit amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                      {formData.currency}
                    </span>
                    <input
                      type="number"
                      value={customAmount || ''}
                      onChange={(e) => setCustomAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      min="0"
                      max={remainingCredit}
                      step="0.01"
                      className="w-full pl-16 pr-4 py-4 text-2xl font-bold text-center border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    Maximum: {formatCurrency(remainingCredit, formData.currency)}
                  </p>
                  {isOverLimit && (
                    <p className="text-sm text-red-600 mt-2 text-center flex items-center justify-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Amount exceeds available credit
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Reason & Notes Section */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Details</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Credit Note #
                  </label>
                  <input
                    type="text"
                    value={formData.credit_note_number}
                    onChange={(e) => setFormData({ ...formData, credit_note_number: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono"
                    required
                    readOnly={isEdit}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as CreditNoteStatus })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="draft">📝 Draft</option>
                    <option value="issued">✅ Issued</option>
                    <option value="applied">💰 Applied</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason / Description
                </label>
                <input
                  type="text"
                  value={formData.reason_description}
                  onChange={(e) => setFormData({ ...formData, reason_description: e.target.value })}
                  placeholder={
                    creditType === 'full' ? 'e.g., Customer returned product' :
                      creditType === 'partial' ? 'e.g., Partial return - damaged items' :
                        'e.g., Goodwill discount for customer complaint'
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Internal Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Notes for your records..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg resize-none"
                />
              </div>
            </div>
          </div>

          {/* Summary & Actions */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-500 text-sm">Credit Amount</p>
                <p className={`text-3xl font-bold ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatCurrency(creditAmount, formData.currency)}
                </p>
              </div>
              <div className="flex gap-3">
                {invoice?.client?.email && (
                  <button
                    type="button"
                    onClick={() => setShowEmailDialog(true)}
                    className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-white transition-colors flex items-center gap-2"
                  >
                    <Mail className="h-5 w-5" />
                    Email
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || isOverLimit || creditAmount <= 0}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Save className="h-5 w-5" />
                  {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'} Credit Note
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Email Dialog */}
      {showEmailDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Email Credit Note</h3>
              <button onClick={() => setShowEmailDialog(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
                <input
                  type="email"
                  value={emailData.to}
                  onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CC:</label>
                <input
                  type="text"
                  value={emailData.cc}
                  onChange={(e) => setEmailData({ ...emailData, cc: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
                <textarea
                  value={emailData.message}
                  onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Optional message..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowEmailDialog(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailData.to}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};