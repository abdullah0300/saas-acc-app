// src/components/CreditNote/CreditNoteForm.tsx
// COMPLETE SOLUTION WITH UUID FIX
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
 ArrowLeft, 
 Save, 
 AlertCircle, 
 CheckSquare, 
 Square,
 Calculator,
 Globe,
 FileText,
 Mail,
 Percent,
 X
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

interface FormCreditNoteItem extends Partial<CreditNoteItem> {
 tempId: string;  // For UI tracking only
 selected?: boolean;
 maxQuantity?: number;
 originalInvoiceItem?: any;
}

interface VATBreakdown {
 [rate: string]: {
   net: number;
   vat: number;
   items: number;
 };
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
 
 // Feature states
 const [partialMode, setPartialMode] = useState(false);
 const [showVATBreakdown, setShowVATBreakdown] = useState(false);
 const [showEmailDialog, setShowEmailDialog] = useState(false);
 const [emailData, setEmailData] = useState({
   to: '',
   cc: '',
   message: ''
 });

 // Form data with complete fields
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
 const [vatBreakdown, setVatBreakdown] = useState<VATBreakdown>({});
 const [inheritedCategory, setInheritedCategory] = useState<{ id: string; name: string } | null>(null);

 // Computed values
 const userCountry = countries.find(c => c.code === userSettings?.country);
 const isUK = userSettings?.country === 'GB' || formData.currency === 'GBP';
 const isEU = ['DE', 'FR', 'ES', 'IT', 'NL'].includes(userSettings?.country || '');
 const requiresVATBreakdown = userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown || isUK;
 const taxLabel = userCountry?.taxName || 'Tax';

 // Check if over credit limit
 const remainingCredit = invoice ? 
   invoice.total - (invoice.total_credited || 0) : 
   Number.MAX_SAFE_INTEGER;
 const isOverLimit = formData.total > remainingCredit;

 useEffect(() => {
   if (user) {
     loadInitialData();
   }
 }, [user, id, invoiceId]);

 useEffect(() => {
   // Auto-calculate VAT breakdown when items change
   if (requiresVATBreakdown) {
     calculateVATBreakdown();
   }
 }, [items, requiresVATBreakdown]);

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
  
  // Get fresh invoice data with credit tracking
  const { data: invoiceData } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('id', invoiceId)
    .single();

  // ✅ UPDATED: Safe credit tracking check
  // Get credit tracking - handle if it doesn't exist
  let alreadyCredited = 0;
  if (invoiceData) {
    // First try the invoice field
    alreadyCredited = invoiceData.total_credited || 0;
    
    // Then try the tracking table if needed
    if (alreadyCredited === 0) {
      try {
        const { data: tracking } = await supabase
          .from('invoice_credit_tracking')
          .select('total_credited')
          .eq('invoice_id', invoiceId)
          .maybeSingle();
        
        if (tracking) {
          alreadyCredited = tracking.total_credited;
        }
      } catch (error) {
        console.log('Credit tracking not found, using default');
      }
    }
  }

  if (!invoiceData) throw new Error('Invoice not found');
  setInvoice({ ...invoiceData, total_credited: alreadyCredited });
  
  if (alreadyCredited >= invoiceData.total) {
    throw new Error('This invoice has been fully credited');
  }
  
  // Set form data from invoice
  setFormData(prev => ({
    ...prev,
    invoice_id: invoiceId,
    client_id: invoiceData.client_id || '',
    currency: invoiceData.currency || baseCurrency,
    exchange_rate: invoiceData.exchange_rate || 1,
    tax_rate: invoiceData.tax_rate || 0,
  }));

  // Get the credit notes category that will be used
  if (user) {
    const categoryId = await getOrCreateCreditNotesCategory(user.id);
    if (categoryId) {
      setInheritedCategory({ 
        id: categoryId, 
        name: 'Credit Notes & Refunds'
      });
    }
  }

  // ✅ SIMPLIFIED: Removed category logic for invoice items (they don't have categories)
  // Invoice items don't have category_id, so we just use the Credit Notes category

  // Set email if client has one
  if (invoiceData.client?.email) {
    setEmailData(prev => ({ ...prev, to: invoiceData.client?.email || '' }));
  }

  // Load items - handle both line items and simple invoices
  if (invoiceData.items && invoiceData.items.length > 0) {
    // Invoice has line items
    const creditItems: FormCreditNoteItem[] = invoiceData.items.map((item: any, index: number) => ({
      tempId: `item-${Date.now()}-${index}`,  // For UI tracking only
      invoice_item_id: item.id,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
      tax_rate: item.tax_rate || invoiceData.tax_rate || 0,
      tax_amount: item.tax_amount || 0,
      net_amount: item.net_amount || item.amount,
      gross_amount: item.gross_amount || (item.amount + (item.tax_amount || 0)),
      selected: true,
      maxQuantity: item.quantity,
      originalInvoiceItem: item
    }));
    setItems(creditItems);
    calculateTotals(creditItems);
  } else {
    // Simple invoice without line items - create single item
    const singleItem: FormCreditNoteItem = {
      tempId: `single-${Date.now()}`,
      description: `Credit for Invoice #${invoiceData.invoice_number}`,
      quantity: 1,
      rate: invoiceData.subtotal,
      amount: invoiceData.subtotal,
      tax_rate: invoiceData.tax_rate || 0,
      tax_amount: invoiceData.tax_amount || 0,
      net_amount: invoiceData.subtotal,
      gross_amount: invoiceData.total,
      selected: true,
      maxQuantity: 1
    };
    setItems([singleItem]);
    setFormData(prev => ({
      ...prev,
      subtotal: invoiceData.subtotal,
      tax_amount: invoiceData.tax_amount || 0,
      total: invoiceData.total,
      base_amount: invoiceData.base_amount || invoiceData.total
    }));
  }

  await generateCreditNoteNumber();
};

 const loadExistingCreditNote = async () => {
   if (!id || !user) return;
   
   const creditNoteData = await getCreditNote(id);
   
   // Load form data
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

   // Load items with tempIds for UI
   if (creditNoteData.items) {
     setItems(creditNoteData.items.map((item: CreditNoteItem, index: number) => ({
       ...item,
       tempId: `existing-${item.id || index}`,
       selected: true
     })));
   }

   // Load related invoice
   if (creditNoteData.invoice_id) {
     const invoiceData = await getInvoice(creditNoteData.invoice_id);
     setInvoice(invoiceData);
     if (invoiceData.client?.email) {
       setEmailData(prev => ({ ...prev, to: invoiceData.client?.email || '' }));
     }
   }
 };

 const togglePartialMode = () => {
   setPartialMode(!partialMode);
   
   if (!partialMode) {
     // Switching to partial mode - deselect all
     setItems(items.map(item => ({ ...item, selected: false })));
     setFormData(prev => ({ ...prev, subtotal: 0, tax_amount: 0, total: 0, base_amount: 0 }));
   } else {
     // Switching to full mode - select all with full quantities
     const updatedItems = items.map(item => ({
       ...item,
       selected: true,
       quantity: item.maxQuantity || item.quantity
     }));
     setItems(updatedItems);
     calculateTotals(updatedItems);
   }
 };

 const toggleItemSelection = (tempId: string) => {
   const updatedItems = items.map(item => 
     item.tempId === tempId ? { ...item, selected: !item.selected } : item
   );
   setItems(updatedItems);
   calculateTotals(updatedItems);
 };

 const updateItemQuantity = (tempId: string, newQuantity: number) => {
   const updatedItems = items.map(item => {
     if (item.tempId === tempId) {
       const quantity = Math.max(0, Math.min(newQuantity, item.maxQuantity || item.quantity || 1));
       const amount = quantity * (item.rate || 0);
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
   });
   
   setItems(updatedItems);
   calculateTotals(updatedItems);
 };

 const calculateTotals = (creditItems: FormCreditNoteItem[]) => {
   const selectedItems = creditItems.filter(item => item.selected);
   
   let subtotal = 0;
   let totalTax = 0;
   
   selectedItems.forEach(item => {
     subtotal += item.net_amount || item.amount || 0;
     totalTax += item.tax_amount || 0;
   });
   
   const total = subtotal + totalTax;
   const baseAmount = total / (formData.exchange_rate || 1);
   
   setFormData(prev => ({
     ...prev,
     subtotal,
     tax_amount: totalTax,
     total,
     base_amount: baseAmount
   }));

   // Calculate VAT breakdown if needed
   if (requiresVATBreakdown) {
     calculateVATBreakdown();
   }
 };

 const calculateVATBreakdown = () => {
   const breakdown: VATBreakdown = {};
   const selectedItems = items.filter(item => item.selected);
   
   selectedItems.forEach(item => {
     const rate = (item.tax_rate || 0).toString();
     if (!breakdown[rate]) {
       breakdown[rate] = { net: 0, vat: 0, items: 0 };
     }
     breakdown[rate].net += item.net_amount || item.amount || 0;
     breakdown[rate].vat += item.tax_amount || 0;
     breakdown[rate].items += 1;
   });
   
   setVatBreakdown(breakdown);
 };

 const validateForm = (): boolean => {
   const selectedItems = items.filter(item => item.selected);
   
   if (selectedItems.length === 0) {
     setError('Please select at least one item to credit');
     return false;
   }
   
   if (formData.total <= 0) {
     setError('Credit amount must be greater than zero');
     return false;
   }
   
   if (isOverLimit) {
     setError(`Cannot credit more than remaining amount: ${formatCurrency(remainingCredit, formData.currency)}`);
     return false;
   }
   
   if (!formData.credit_note_number) {
     setError('Credit note number is required');
     return false;
   }
   
   return true;
 };

 const handleSubmit = async (e: React.FormEvent) => {
   e.preventDefault();
   if (!user || !validateForm()) return;

   setSaving(true);
   setError('');

   try {
     const selectedItems = items.filter(item => item.selected);
     
     // Prepare VAT metadata for UK/EU
     const taxMetadata = requiresVATBreakdown ? {
       vat_breakdown: vatBreakdown,
       is_uk_vat: isUK,
       is_eu_vat: isEU,
       tax_scheme: userCountry?.taxFeatures?.taxSchemes?.[0] || 'standard'
     } : null;

     // Prepare credit note data
     const creditNoteData = {
       ...formData,
       tax_metadata: taxMetadata
     };

     // Clean items for saving - remove UI-only fields and id field
     const itemsToSave = selectedItems.map(({ tempId, selected, maxQuantity, originalInvoiceItem, id, ...item }) => item);

     if (isEdit && id) {
       await updateCreditNote(id, creditNoteData, itemsToSave);
       setSuccess('Credit note updated successfully');
     } else {
       const newCreditNote = await createCreditNote(user.id, creditNoteData, itemsToSave);
       setSuccess('Credit note created successfully');
       
       // Ask if user wants to send email
       if (invoice?.client?.email) {
         setShowEmailDialog(true);
       }
     }

     // Navigate after short delay to show success
     if (!showEmailDialog) {
       setTimeout(() => navigate('/credit-notes'), 1500);
     }
   } catch (err: any) {
     setError(err.message || 'Error saving credit note');
     setSaving(false);
   }
 };

 const handleSendEmail = async () => {
   if (!formData.credit_note_number) return;
   
   setSendingEmail(true);
   setError('');
   
   try {
     const { data, error } = await supabase.functions.invoke('send-credit-note-email', {
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

 const selectedTotal = items
   .filter(item => item.selected)
   .reduce((sum, item) => sum + (item.gross_amount || item.amount || 0), 0);

 if (loading) {
   return (
     <div className="flex justify-center items-center h-screen">
       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
     </div>
   );
 }

 return (
   <div className="max-w-5xl mx-auto p-6">
     {/* Header */}
     <div className="mb-6 flex items-center justify-between">
       <button
         onClick={() => navigate(-1)}
         className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
       >
         <ArrowLeft className="h-5 w-5 mr-2" />
         Back
       </button>
       <h1 className="text-2xl font-bold text-gray-900">
         {isEdit ? 'Edit' : 'New'} Credit Note
       </h1>
     </div>

     {/* Invoice Alert */}
     {invoice && (
       <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
         <div className="flex items-start">
           <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
           <div className="flex-1">
             <p className="text-sm font-medium text-blue-900 mb-2">
               Credit Note for Invoice #{invoice.invoice_number}
             </p>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-blue-700">
               <div>
                 <span className="font-medium">Client:</span> {invoice.client?.name || 'N/A'}
               </div>
               <div>
                 <span className="font-medium">Original:</span> {formatCurrency(invoice.total, invoice.currency || baseCurrency)}
               </div>
               <div>
                 <span className="font-medium">Already Credited:</span> {formatCurrency(invoice.total_credited || 0, invoice.currency || baseCurrency)}
               </div>
               <div>
                 <span className="font-medium">Date:</span> {format(new Date(invoice.date), 'MMM dd, yyyy')}
               </div>
               <div>
                 <span className="font-medium">Currency:</span> {invoice.currency || baseCurrency}
                 {invoice.exchange_rate && invoice.exchange_rate !== 1 && (
                   <span className="ml-1">(@{invoice.exchange_rate})</span>
                 )}
               </div>
               <div className={`font-medium ${remainingCredit <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                 <span>Available:</span> {formatCurrency(remainingCredit, invoice.currency || baseCurrency)}
               </div>
             </div>
           </div>
         </div>
       </div>
     )}
      
       {/* Category Info */}
     {inheritedCategory && (
       <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
         <div className="flex items-center">
           <FileText className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" />
           <div>
             <p className="text-sm font-medium text-blue-800">
               Income Category
             </p>
             <p className="text-sm text-blue-700 mt-1">
               This credit note will be recorded under: <span className="font-semibold">{inheritedCategory.name}</span>
               <span className="text-xs ml-2 text-blue-600">(standard category for all refunds)</span>
             </p>
           </div>
         </div>
       </div>
     )}
     
     {/* Error/Success Messages */}
     {error && (
       <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start">
         <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
         {error}
       </div>
     )}
     
     {success && (
       <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg">
         {success}
       </div>
     )}

     <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
       {/* Basic Info */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
         <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">
             Credit Note Number
           </label>
           <div className="flex items-center">
             <FileText className="h-5 w-5 text-gray-400 mr-2" />
             <input
               type="text"
               value={formData.credit_note_number}
               onChange={(e) => setFormData({ ...formData, credit_note_number: e.target.value })}
               className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
               required
               readOnly={isEdit}
             />
           </div>
         </div>

         <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">
             Date
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
             Status
           </label>
           <select
             value={formData.status}
             onChange={(e) => setFormData({ ...formData, status: e.target.value as CreditNoteStatus })}
             className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
           >
             <option value="draft">Draft</option>
             <option value="issued">Issued</option>
             {isEdit && <option value="applied">Applied</option>}
           </select>
         </div>
       </div>

       {/* Reason */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
         <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">
             Reason
           </label>
           <select
             value={formData.reason}
             onChange={(e) => setFormData({ ...formData, reason: e.target.value as CreditNoteReason })}
             className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
             required
           >
             <option value="return">Product Return</option>
             <option value="adjustment">Price Adjustment</option>
             <option value="cancellation">Order Cancellation</option>
             <option value="other">Other</option>
           </select>
         </div>

         <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">
             Reason Description
           </label>
           <input
             type="text"
             value={formData.reason_description}
             onChange={(e) => setFormData({ ...formData, reason_description: e.target.value })}
             placeholder="Provide more details..."
             className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
           />
         </div>
       </div>

       {/* Items Section */}
       <div className="mb-6">
         <div className="flex items-center justify-between mb-4">
           <h3 className="text-lg font-semibold text-gray-900">Items to Credit</h3>
           {items.length > 1 && (
             <button
               type="button"
               onClick={togglePartialMode}
               className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center ${
                 partialMode 
                   ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                   : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
               }`}
             >
               <Calculator className="h-4 w-4 mr-2" />
               {partialMode ? 'Partial Credit Mode' : 'Full Credit Mode'}
             </button>
           )}
         </div>
         
         {items.length > 0 ? (
           <div className="space-y-3">
             {items.map((item, index) => (
               <div
                 key={item.tempId || `item-${index}`}
                 className={`p-4 border rounded-lg transition-all ${
                   item.selected 
                     ? 'border-blue-500 bg-blue-50 shadow-sm' 
                     : 'border-gray-300 bg-white'
                 }`}
               >
                 <div className="flex items-start">
                   <button
                     type="button"
                     onClick={() => toggleItemSelection(item.tempId)}
                     className="mt-1 mr-3 transition-transform hover:scale-110"
                   >
                     {item.selected ? (
                       <CheckSquare className="h-5 w-5 text-blue-600" />
                     ) : (
                       <Square className="h-5 w-5 text-gray-400" />
                     )}
                   </button>
                   
                   <div className="flex-1">
                     <div className="flex justify-between">
                       <div className="flex-1">
                         <p className="font-medium text-gray-900">{item.description}</p>
                         <div className="mt-2 flex items-center gap-4">
                           <div className="flex items-center gap-2">
                             <label className="text-sm text-gray-600">Qty:</label>
                             <input
                               type="number"
                               value={item.quantity}
                               onChange={(e) => updateItemQuantity(item.tempId, parseFloat(e.target.value))}
                               min="0"
                               max={item.maxQuantity || item.quantity}
                               step="0.01"
                               disabled={!item.selected || !partialMode}
                               className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                             />
                             {item.maxQuantity && (
                               <span className="text-xs text-gray-500">
                                 of {item.maxQuantity}
                               </span>
                             )}
                           </div>
                           <span className="text-sm text-gray-600">
                             <Globe className="h-3 w-3 inline mr-1" />
                             Rate: {formatCurrency(item.rate || 0, formData.currency)}
                           </span>
                           {(item.tax_rate || 0) > 0 && (
                             <span className="text-sm text-gray-600">
                               <Percent className="h-3 w-3 inline mr-1" />
                               {taxLabel}: {item.tax_rate}%
                             </span>
                           )}
                         </div>
                       </div>
                       <div className="text-right ml-4">
                         <p className="font-semibold text-gray-900">
                           {formatCurrency(item.gross_amount || item.amount || 0, formData.currency)}
                         </p>
                         {(item.tax_amount || 0) > 0 && (
                           <p className="text-sm text-gray-600">
                             (incl. {taxLabel}: {formatCurrency(item.tax_amount || 0, formData.currency)})
                           </p>
                         )}
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             ))}
           </div>
         ) : (
           <p className="text-gray-500 text-center py-8">No items available to credit</p>
         )}
       </div>

       {/* VAT/Tax Breakdown for UK/EU */}
       {requiresVATBreakdown && Object.keys(vatBreakdown).length > 0 && (
         <div className="mb-6">
           <button
             type="button"
             onClick={() => setShowVATBreakdown(!showVATBreakdown)}
             className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 mb-3"
           >
             <Percent className="h-4 w-4 mr-2" />
             {taxLabel} Breakdown
             <span className="ml-2 text-gray-400">
               {showVATBreakdown ? '▼' : '▶'}
             </span>
           </button>
           
           {showVATBreakdown && (
             <div className="bg-gray-50 rounded-lg p-4">
               <table className="w-full text-sm">
                 <thead>
                   <tr className="border-b border-gray-200">
                     <th className="text-left py-2">Rate</th>
                     <th className="text-right py-2">Net Amount</th>
                     <th className="text-right py-2">{taxLabel}</th>
                     <th className="text-right py-2">Gross</th>
                     <th className="text-right py-2">Items</th>
                   </tr>
                 </thead>
                 <tbody>
                   {Object.entries(vatBreakdown).map(([rate, data]) => (
                     <tr key={rate} className="border-b border-gray-100">
                       <td className="py-2">{rate}%</td>
                       <td className="text-right py-2">
                         {formatCurrency(data.net, formData.currency)}
                       </td>
                       <td className="text-right py-2">
                         {formatCurrency(data.vat, formData.currency)}
                       </td>
                       <td className="text-right py-2">
                         {formatCurrency(data.net + data.vat, formData.currency)}
                       </td>
                       <td className="text-right py-2">{data.items}</td>
                     </tr>
                   ))}
                 </tbody>
                 <tfoot>
                   <tr className="font-semibold border-t-2 border-gray-300">
                     <td className="py-2">Total</td>
                     <td className="text-right py-2">
                       {formatCurrency(formData.subtotal, formData.currency)}
                     </td>
                     <td className="text-right py-2">
                       {formatCurrency(formData.tax_amount, formData.currency)}
                     </td>
                     <td className="text-right py-2">
                       {formatCurrency(formData.total, formData.currency)}
                     </td>
                     <td className="text-right py-2">
                       {items.filter(i => i.selected).length}
                     </td>
                   </tr>
                 </tfoot>
               </table>
               
               {isUK && (
                 <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
                   <strong>HMRC Note:</strong> This credit note will adjust Box 1 (Output VAT) and Box 6 (Total Sales) in your VAT return.
                 </div>
               )}
             </div>
           )}
         </div>
       )}

       {/* Notes */}
       <div className="mb-6">
         <label className="block text-sm font-medium text-gray-700 mb-2">
           Notes (optional)
         </label>
         <textarea
           value={formData.notes}
           onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
           rows={3}
           className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
           placeholder="Additional notes about this credit note..."
         />
       </div>

       {/* Totals Summary */}
       <div className="mb-6 p-4 bg-gray-50 rounded-lg">
         <div className="space-y-2">
           <div className="flex justify-between text-sm">
             <span className="text-gray-600">Subtotal:</span>
             <span className="font-medium">{formatCurrency(formData.subtotal, formData.currency)}</span>
           </div>
           {formData.tax_amount > 0 && (
             <div className="flex justify-between text-sm">
               <span className="text-gray-600">{taxLabel}:</span>
               <span className="font-medium">{formatCurrency(formData.tax_amount, formData.currency)}</span>
             </div>
           )}
           <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-300">
             <span>Total Credit:</span>
             <span className={`${isOverLimit ? 'text-red-600' : 'text-blue-600'}`}>
               {formatCurrency(formData.total, formData.currency)}
             </span>
           </div>
           {formData.exchange_rate !== 1 && (
             <div className="flex justify-between text-sm text-gray-600">
               <span>Base Amount ({baseCurrency}):</span>
               <span>{formatCurrency(formData.base_amount, baseCurrency)}</span>
             </div>
           )}
           {isOverLimit && (
             <div className="text-red-600 text-sm mt-2">
               <AlertCircle className="h-4 w-4 inline mr-1" />
               Exceeds available credit by {formatCurrency(formData.total - remainingCredit, formData.currency)}
             </div>
           )}
         </div>
       </div>

       {/* Actions */}
       <div className="flex justify-between">
         <button
           type="button"
           onClick={() => navigate(-1)}
           className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
         >
           Cancel
         </button>
         
         <div className="flex gap-3">
           {invoice?.client?.email && (
             <button
               type="button"
               onClick={() => setShowEmailDialog(true)}
               className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors flex items-center"
             >
               <Mail className="h-5 w-5 mr-2" />
               Email Settings
             </button>
           )}
           
           <button
             type="submit"
             disabled={saving || isOverLimit || selectedTotal === 0}
             className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
           >
             <Save className="h-5 w-5 mr-2" />
             {saving ? 'Saving...' : (isEdit ? 'Update' : 'Create')} Credit Note
           </button>
         </div>
       </div>
     </form>

     {/* Email Dialog */}
     {showEmailDialog && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-lg max-w-md w-full p-6">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-semibold">Email Credit Note</h3>
             <button
               onClick={() => setShowEmailDialog(false)}
               className="text-gray-400 hover:text-gray-600"
             >
               <X className="h-5 w-5" />
             </button>
           </div>
           
           <div className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 To:
               </label>
               <input
                 type="email"
                 value={emailData.to}
                 onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                 required
               />
             </div>
             
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 CC (comma-separated):
               </label>
               <input
                 type="text"
                 value={emailData.cc}
                 onChange={(e) => setEmailData({ ...emailData, cc: e.target.value })}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                 placeholder="email1@example.com, email2@example.com"
               />
             </div>
             
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Message:
               </label>
               <textarea
                 value={emailData.message}
                 onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                 rows={3}
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                 placeholder="Optional message to include..."
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