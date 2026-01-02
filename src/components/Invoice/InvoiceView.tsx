import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { pdfService } from '../../services/pdfService';
import { SendEmailDialog } from './SendEmailDialog';
import { emailService } from '../../services/emailService';
import { useSettings } from '../../contexts/SettingsContext';
import { useQueryClient } from '@tanstack/react-query';
import { countries } from '../../data/countries';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Send,
  Edit,
  Printer,
  Mail,
  MessageCircle,
  Copy,
  Check,
  CreditCard,
  Calendar,
  Clock,
  Building,
  Phone,
  Globe,
  MapPin,
  FileText,
  Shield,
  Smartphone,
  Share2,
  QrCode,
  DollarSign,
  User as UserIcon,  // Renamed to avoid conflict
  Hash,
  Banknote,
  Building2,
  FileX
} from 'lucide-react';
import { getInvoice, updateInvoice, getProfile, recordInvoicePayment, getInvoicePayments, calculateInvoiceBalance } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Invoice, User, InvoicePayment } from '../../types';  // Now User type won't conflict
import { supabase } from '../../services/supabaseClient';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { getPaymentMethods, PaymentMethod } from '../../services/paymentMethodsService';
import { PAYMENT_METHOD_TEMPLATES } from '../../config/paymentMethodTemplates';

export const InvoiceView: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { formatCurrency, baseCurrency, exchangeRates } = useSettings();
  const { refreshBusinessData, effectiveUserId } = useData();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const { userSettings } = useSettings();
  const userCountry = countries.find(c => c.code === userSettings?.country);
  const taxFeatures = userCountry?.taxFeatures;
  const taxLabel = userCountry?.taxName || 'Tax';
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);
  const [paymentBalance, setPaymentBalance] = useState<{ total_paid: number; balance_due: number } | null>(null);
  const [showPartialPayment, setShowPartialPayment] = useState(false);
  const [partialPaymentData, setPartialPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer' as 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'other',
    reference_number: '',
    notes: ''
  });
  const [paymentError, setPaymentError] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<Invoice['status'] | null>(null);
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const [incomeCategoryName, setIncomeCategoryName] = useState<string | null>(null);

  useEffect(() => {
    if (user && id) {
      loadInvoice();
    }
  }, [user, id]);

  useEffect(() => {
    if (invoice && !qrCodeGenerated) {
      generateQRCode();
      setQrCodeGenerated(true);
    }
  }, [invoice, qrCodeGenerated]);

  const loadInvoice = async () => {
    if (!user || !id) return;

    try {
      // Fetch invoice with all related data
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
        *,
        client:clients(*),
        items:invoice_items(*)
      `)
        .eq('id', id)
        .single();

      if (invoiceError) throw invoiceError;

      // Separately fetch credit tracking to ensure we get it
      const { data: creditTracking } = await supabase
        .from('invoice_credit_tracking')
        .select('*')
        .eq('invoice_id', id)
        .single();

      // Merge credit tracking into invoice data
      if (invoiceData) {
        invoiceData.credit_tracking = creditTracking ? [creditTracking] : [];

        // Also ensure total_credited is set from tracking if not on invoice
        if (!invoiceData.total_credited && creditTracking) {
          invoiceData.total_credited = creditTracking.total_credited;
        }

        // If still no credited amount but has credit notes flag, fetch from credit notes
        if (!invoiceData.total_credited && invoiceData.has_credit_notes) {
          const { data: creditNotes } = await supabase
            .from('credit_notes')
            .select('total')
            .eq('invoice_id', id)
            .in('status', ['issued', 'applied']);

          if (creditNotes && creditNotes.length > 0) {
            invoiceData.total_credited = creditNotes.reduce((sum, cn) => sum + (cn.total || 0), 0);
          }
        }
      }

      if (!invoiceData) {
        setError('Invoice not found');
        return;
      }

      setInvoice(invoiceData);

      // Fetch income category name if exists
      if (invoiceData.income_category_id) {
        const { data: categoryData } = await supabase
          .from('categories')
          .select('name')
          .eq('id', invoiceData.income_category_id)
          .single();

        if (categoryData) {
          setIncomeCategoryName(categoryData.name);
        }
      }

      // Load user profile
      const profileData = await getProfile(user.id);
      setProfile(profileData);

      // Load invoice settings (use effectiveUserId for team members)
      const { data: settings } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('user_id', effectiveUserId || user.id)
        .single();

      setInvoiceSettings(settings);

      // Load tax registration number from user_settings
      const { data: userSettingsData } = await supabase
        .from('user_settings')
        .select('tax_registration_number')
        .eq('user_id', user.id)
        .single();

      if (userSettingsData?.tax_registration_number) {
        setTaxRegistrationNumber(userSettingsData.tax_registration_number);
      }

      // Set default phone number for WhatsApp
      if (invoiceData.client?.phone) {
        setPhoneNumber(invoiceData.client.phone);
      }

      // Load new payment methods
      try {
        const methods = await getPaymentMethods(effectiveUserId || user.id);
        setPaymentMethods(methods);
      } catch (err) {
        console.error('Error loading payment methods:', err);
      }

      // Load payment history if invoice is paid or partially_paid
      if (invoiceData.status === 'paid' || invoiceData.status === 'partially_paid') {
        try {
          const payments = await getInvoicePayments(id);
          setInvoicePayments(payments);

          const balance = await calculateInvoiceBalance(id);
          setPaymentBalance(balance);
        } catch (err) {
          console.error('Error loading payment history:', err);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler for status dropdown - shows confirmation for critical changes
  const requestStatusChange = (newStatus: Invoice['status']) => {
    if (!invoice) return;

    // Require confirmation for marking as Paid (creates income) or Canceled
    if ((newStatus === 'paid' && invoice.status !== 'paid') || newStatus === 'canceled') {
      setPendingStatus(newStatus);
      setShowStatusConfirm(true);
    } else {
      handleStatusChange(newStatus);
    }
  };

  const handleStatusChange = async (newStatus: Invoice['status']) => {
    if (!invoice || !user) return;

    try {
      // Update the invoice status
      await updateInvoice(invoice.id, { status: newStatus });

      // If marking as paid, create income entry AND payment record
      if (newStatus === 'paid' && invoice.status !== 'paid') {
        // Check if income already exists
        const { data: existingIncome } = await supabase
          .from('income')
          .select('id')
          .eq('reference_number', invoice.invoice_number)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!existingIncome) {
          // Get invoice items for tax breakdown  
          const { data: items } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoice.id);

          // Initialize totals and breakdown
          let totalNetAmount = 0;
          let totalTaxAmount = 0;
          let taxBreakdown: Record<string, any> = {};

          // Check if UK user (with line-item VAT)
          // Only UK uses GBP and has line-item VAT
          const isUK = invoice.currency === 'GBP' &&
            items && items.length > 0 &&
            items.some(item => item.tax_rate !== undefined && item.tax_rate > 0);


          if (isUK && items && items.length > 0) {
            // UK LOGIC - Calculate from line items
            items.forEach(item => {
              const rate = (item.tax_rate || 0).toString();
              const netAmount = item.net_amount || item.amount || 0;
              const taxAmount = item.tax_amount || 0;

              if (!taxBreakdown[rate]) {
                taxBreakdown[rate] = {
                  net_amount: 0,
                  tax_amount: 0,
                  gross_amount: 0
                };
              }

              taxBreakdown[rate].net_amount += netAmount;
              taxBreakdown[rate].tax_amount += taxAmount;
              taxBreakdown[rate].gross_amount += netAmount + taxAmount;

              totalNetAmount += netAmount;
              totalTaxAmount += taxAmount;
            });
          } else {
            // USA/OTHER COUNTRIES - Use invoice totals directly
            totalNetAmount = invoice.subtotal;
            totalTaxAmount = invoice.tax_amount || 0;

            if (invoice.tax_rate > 0) {
              taxBreakdown[invoice.tax_rate.toString()] = {
                net_amount: invoice.subtotal,
                tax_amount: invoice.tax_amount,
                gross_amount: invoice.total
              };
            }
          }

          // 🔴 FIX: Convert to base currency for consistent income reporting
          // Calculate base amounts (convert from invoice currency to base currency)
          const baseNetAmount = totalNetAmount / (invoice.exchange_rate || 1);
          const baseTaxAmount = totalTaxAmount / (invoice.exchange_rate || 1);

          // Create income entry with CORRECT data - always in BASE CURRENCY
          const { error: incomeError } = await supabase
            .from('income')
            .insert([{
              user_id: user.id,
              amount: baseNetAmount, // 🔴 FIX: Store in BASE currency (e.g., 30000 PKR, not 220 USD)
              description: `Payment for Invoice #${invoice.invoice_number}${invoice.currency !== baseCurrency ? ` (${formatCurrency(totalNetAmount, invoice.currency)})` : ''}`,
              date: new Date().toISOString().split('T')[0],
              client_id: invoice.client_id || null,
              category_id: invoice.income_category_id || null,
              project_id: (invoice as any).project_id || null, // 🔴 FIX: Copy project_id from invoice
              reference_number: invoice.invoice_number,
              currency: baseCurrency, // 🔴 FIX: Always use BASE currency for income entries
              exchange_rate: 1, // 🔴 FIX: Rate is 1 since we're already in base currency
              base_amount: baseNetAmount, // Same as amount since it's already in base currency
              tax_rate: invoice.tax_rate || 0,
              tax_amount: baseTaxAmount, // 🔴 FIX: Tax amount also in base currency
              // Don't include total_with_tax - it's a generated column
              tax_metadata: {
                tax_breakdown: taxBreakdown,
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                created_from_invoice: true,
                is_uk_vat: isUK,
                invoice_date: invoice.date,
                invoice_total: invoice.total,
                original_currency: invoice.currency, // Track original currency
                original_amount: totalNetAmount, // Track original amount before conversion
                original_exchange_rate: invoice.exchange_rate // Track exchange rate used
              }
            }]);

          if (incomeError) {
            console.error('Error creating income:', incomeError);
            throw incomeError;
          }

          // Record payment in invoice_payments table
          try {
            await recordInvoicePayment(
              invoice.id,
              {
                amount: invoice.total,
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: 'bank_transfer', // Default payment method
                reference_number: invoice.invoice_number,
                notes: 'Payment recorded when invoice marked as paid'
              },
              user.id
            );

            // Set payment_locked_at for compliance
            if (!invoice.payment_locked_at) {
              await supabase
                .from('invoices')
                .update({ payment_locked_at: new Date().toISOString() })
                .eq('id', invoice.id);
            }
          } catch (paymentError: any) {
            console.error('Error recording payment:', paymentError);
            // Don't throw - income was created successfully, payment record is supplementary
          }
        }
      }

      // Update local state and refresh
      setInvoice({ ...invoice, status: newStatus });
      await queryClient.invalidateQueries({ queryKey: ['invoices', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['income'] });
      await refreshBusinessData();

    } catch (err: any) {
      console.error('Full error:', err);
      alert('Error updating status: ' + err.message);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice || generatingPdf) return;

    setGeneratingPdf(true);
    try {
      const blob = await pdfService.generateInvoicePDF(invoice.id);
      pdfService.downloadBlob(blob, `invoice-${invoice.invoice_number}.pdf`);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert('Error generating PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePartialPayment = async () => {
    if (!invoice || !user || processingPayment) return;

    setPaymentError('');
    setProcessingPayment(true);

    // Validate payment amount
    const paymentAmount = parseFloat(partialPaymentData.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setPaymentError('Payment amount must be greater than 0');
      setProcessingPayment(false);
      return;
    }

    // Calculate remaining balance
    const currentBalance = paymentBalance?.balance_due ?? invoice.total;
    if (paymentAmount > currentBalance) {
      setPaymentError(`Payment amount cannot exceed remaining balance of ${formatCurrency(currentBalance, invoice.currency || baseCurrency)}`);
      setProcessingPayment(false);
      return;
    }

    try {
      // Record payment in invoice_payments table
      await recordInvoicePayment(
        invoice.id,
        {
          amount: paymentAmount,
          payment_date: partialPaymentData.payment_date,
          payment_method: partialPaymentData.payment_method,
          reference_number: partialPaymentData.reference_number || undefined,
          notes: partialPaymentData.notes || undefined
        },
        user.id
      );

      // 🔴 FIX: Convert partial payment to base currency
      const basePaymentAmount = paymentAmount / (invoice.exchange_rate || 1);

      // Create proportional income entry
      const { error: incomeError } = await supabase
        .from('income')
        .insert([{
          user_id: user.id,
          amount: basePaymentAmount, // 🔴 FIX: Store in BASE currency (e.g., PKR, not USD)
          description: `Partial payment for Invoice #${invoice.invoice_number}${invoice.currency !== baseCurrency ? ` (${formatCurrency(paymentAmount, invoice.currency)})` : ''}`,
          date: partialPaymentData.payment_date,
          client_id: invoice.client_id || null,
          category_id: invoice.income_category_id || null,
          project_id: (invoice as any).project_id || null, // 🔴 FIX: Copy project_id from invoice
          reference_number: invoice.invoice_number,
          currency: baseCurrency, // 🔴 FIX: Always use BASE currency for income entries
          exchange_rate: 1, // 🔴 FIX: Rate is 1 since we're already in base currency
          base_amount: basePaymentAmount, // Same as amount since it's already in base currency
          tax_rate: invoice.tax_rate || 0,
          tax_amount: 0, // Partial payments don't split tax
          tax_metadata: {
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            payment_type: 'partial',
            original_currency: invoice.currency,
            original_amount: paymentAmount,
            original_exchange_rate: invoice.exchange_rate
          }
        }]);

      if (incomeError) throw incomeError;

      // Recalculate balance
      const newBalance = await calculateInvoiceBalance(invoice.id);
      setPaymentBalance(newBalance);

      // Update invoice status based on balance
      let newStatus: Invoice['status'] = 'partially_paid';
      if (newBalance.balance_due <= 0) {
        newStatus = 'paid';
      }

      // Set payment_locked_at if this is the first payment
      const updates: any = { status: newStatus };
      if (!invoice.payment_locked_at) {
        updates.payment_locked_at = new Date().toISOString();
      }

      await updateInvoice(invoice.id, updates);

      // Reload invoice data
      await loadInvoice();

      // Reset form and close modal
      setPartialPaymentData({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'bank_transfer',
        reference_number: '',
        notes: ''
      });
      setShowPartialPayment(false);

      // Refresh queries
      await queryClient.invalidateQueries({ queryKey: ['invoices', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['income'] });
      await refreshBusinessData();

    } catch (err: any) {
      console.error('Error recording partial payment:', err);
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const generatePublicLink = async () => {
    if (!invoice || !user) return '';

    try {
      // Generate a secure token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Store the token
      const { error } = await supabase
        .from('invoice_access_tokens')
        .insert({
          token,
          invoice_id: invoice.id,
          expires_at: expiresAt.toISOString()
        });

      if (error) throw error;

      // Return the public link
      const baseUrl = window.location.origin;
      return `${baseUrl}/invoice/public/${invoice.id}?token=${token}`;
    } catch (err: any) {
      console.error('Error generating public link:', err);
      return '';
    }
  };

  const handleCopyLink = async () => {
    const link = await generatePublicLink();
    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateQRCode = async () => {
    if (!invoice) return;

    try {
      const link = await generatePublicLink();
      if (link) {
        const qr = await QRCode.toDataURL(link, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCode(qr);
      }
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!phoneNumber || !invoice) return;

    try {
      // Generate public link first
      const link = await generatePublicLink();
      if (!link) {
        alert('Error generating invoice link');
        return;
      }

      // Try sending via WhatsApp Cloud API first
      const { data: whatsappData, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-invoice', {
        body: {
          invoiceId: invoice.id,
          clientPhone: phoneNumber,
          clientCountryCode: invoice.client?.phone_country_code, // Pass country code for multi-country support
          clientName: invoice.client?.name || 'Customer',
          invoiceNumber: invoice.invoice_number,
          companyName: profile?.company_name || invoiceSettings?.company_name || 'Your Company',
          amount: formatCurrency(invoice.total, invoice.currency || baseCurrency),
          dueDate: format(parseISO(invoice.due_date), 'MMM dd, yyyy'),
          invoiceUrl: link
        }
      });

      if (whatsappError) {
        console.error('WhatsApp API error, falling back to wa.me:', whatsappError);

        // Fallback to wa.me link

        // Ensure link is a full URL for WhatsApp to make it clickable
        let fullLink = link;
        if (!fullLink.startsWith('http://') && !fullLink.startsWith('https://')) {
          fullLink = `https://${fullLink.replace(/^\/+/, '')}`;
        }
        const clientName = invoice?.client?.name || 'there';

        // Build message - link must be on its own line for WhatsApp to make it clickable
        // Note: WhatsApp requires links to be on separate lines without formatting to make them clickable
        const message = encodeURIComponent(
          `Hello *${clientName}*,\n\n` +
          `You have a new invoice from ${profile?.company_name || invoiceSettings?.company_name || 'our company'}.\n\n` +
          `*Invoice Number:* ${invoice?.invoice_number}\n` +
          `*Amount Due:* ${formatCurrency(invoice?.total || 0, invoice?.currency || baseCurrency)}\n` +
          `*Due Date:* ${invoice?.due_date ? format(parseISO(invoice.due_date), 'MMM dd, yyyy') : 'N/A'}\n\n` +
          `Thank you for your business!\n\n` +
          `*Please view your invoice online:*\n\n` +
          `${fullLink}\n\n` +
          `Powered by SmartCFO`
        );

        const whatsappUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${message}`;
        window.open(whatsappUrl, '_blank');
      } else {
        alert('✅ WhatsApp message sent successfully!');
      }

      setShowWhatsApp(false);
    } catch (error: any) {
      console.error('WhatsApp error:', error);
      alert('Error sending WhatsApp message: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || 'Invoice not found'}</p>
        <button
          onClick={() => navigate('/invoices')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Return to Invoices
        </button>
      </div>
    );
  }

  const daysUntilDue = differenceInDays(parseISO(invoice.due_date), new Date());
  const isOverdue = daysUntilDue < 0 && invoice.status !== 'paid';
  const primaryColor = invoiceSettings?.invoice_color || '#4F46E5';

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'partially_paid':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'canceled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 no-print">
        <div className="bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/invoices')}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">
                    Invoice {invoice.invoice_number}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${getStatusColor(invoice.status)}`}>
                    {invoice.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Created on {format(parseISO(invoice.created_at), 'MMMM dd, yyyy')} • {invoice.client?.name || 'No Client'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Credit Note Button - Show prominently for fully locked invoices */}
              {invoice.status === 'paid' && (
                <Link
                  to={`/credit-notes/new/${invoice.id}`}
                  className="flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <FileX className="h-5 w-5 mr-2" />
                  Create Credit Note
                </Link>
              )}

              {/* Show credit notes info if any exist */}
              {invoice.has_credit_notes && invoice.total_credited && invoice.total_credited > 0 && (
                <div className="px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                  <span className="text-sm text-purple-800 font-medium">
                    Credited: {formatCurrency(invoice.total_credited, invoice.currency || baseCurrency)}
                  </span>
                </div>
              )}

              {/* Credit Note Button for partially paid or sent invoices */}
              {(invoice.status === 'sent' || invoice.status === 'partially_paid') && (
                <Link
                  to={`/credit-notes/new/${invoice.id}`}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <FileX className="h-4 w-4" />
                  Issue Credit Note
                </Link>
              )}
              {/* Record Partial Payment Button */}
              {(invoice.status === 'sent' || invoice.status === 'partially_paid' || invoice.status === 'overdue') && (
                <button
                  onClick={() => setShowPartialPayment(true)}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Banknote className="h-4 w-4" />
                  Record Payment
                </button>
              )}

              {/* Status Dropdown */}
              <select
                value={invoice.status}
                onChange={(e) => requestStatusChange(e.target.value as Invoice['status'])}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusColor(invoice.status)} border-0 cursor-pointer focus:ring-2 focus:ring-offset-1`}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="overdue">Overdue</option>
                <option value="canceled">Canceled</option>
              </select>


              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-4">
                {/* Download */}
                <button
                  onClick={handleDownloadPDF}
                  disabled={generatingPdf}
                  className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                  title="Download PDF"
                >
                  {generatingPdf ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                </button>

                {/* Print - Commented out */}

                {/* Share Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowActions(!showActions)}
                    className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                    title="Share"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>

                  {showActions && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                      <button
                        onClick={() => {
                          setShowActions(false);
                          setShowEmailDialog(true);
                        }}
                        disabled={!invoice.client?.email}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Mail className="h-4 w-4 text-gray-600" />
                        <span className="text-sm text-gray-700">Send via Email</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowActions(false);
                          setShowWhatsApp(true);
                        }}
                        disabled={!invoice.client?.phone}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <MessageCircle className="h-4 w-4 text-gray-600" />
                        <span className="text-sm text-gray-700">Send via WhatsApp</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowActions(false);
                          handleCopyLink();
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-t border-gray-100"
                      >
                        <Copy className="h-4 w-4 text-gray-600" />
                        <span className="text-sm text-gray-700">
                          {copied ? 'Copied!' : 'Copy Link'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* PDF Status */}
                <div className="flex items-center gap-2 text-sm">
                  {generatingPdf ? (
                    <span className="text-gray-500">Generating PDF...</span>
                  ) : downloading ? (
                    <span className="text-blue-600">Downloading...</span>
                  ) : sending ? (
                    <span className="text-green-600">Sending...</span>
                  ) : null}
                </div>

                {/* Edit */}
                {(() => {
                  const isFullyPaid = invoice.status === 'paid';
                  const isCanceled = invoice.status === 'canceled';
                  const hasPayments = invoice.payment_locked_at !== null;
                  const balanceDue = paymentBalance?.balance_due || 0;
                  const isPartiallyPaid = hasPayments && balanceDue > 0;

                  // Fully locked - no editing allowed
                  if (isFullyPaid || isCanceled) {
                    return (
                      <button
                        disabled
                        className="p-1.5 text-gray-400 cursor-not-allowed"
                        title="Locked for compliance - Use Credit Note for adjustments"
                      >
                        <Shield className="h-4 w-4" />
                      </button>
                    );
                  }

                  // Partially locked - limited editing allowed
                  if (isPartiallyPaid) {
                    return (
                      <button
                        onClick={() => navigate(`/invoices/${id}/edit`)}
                        className="p-1.5 text-yellow-600 hover:text-yellow-700 transition-colors"
                        title="Limited editing - Invoice has received payments"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                    );
                  }

                  // No lock - full editing allowed
                  return (
                    <button
                      onClick={() => navigate(`/invoices/${id}/edit`)}
                      className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Document */}
      <div ref={invoiceRef} className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/50 overflow-hidden print:shadow-none print:rounded-none print:ring-0">
        {/* Header Section */}
        <div className="relative overflow-hidden">
          {/* Background Pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${encodeURIComponent(primaryColor)}' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative p-8 pb-6">
            <div className="flex justify-between items-start">
              {/* Company Info */}
              <div className="flex-1">
                {profile?.company_logo || invoiceSettings?.company_logo ? (
                  <img
                    src={profile?.company_logo || invoiceSettings?.company_logo}
                    alt={profile?.company_name || 'Company'}
                    className="h-16 mb-4 object-contain"
                  />
                ) : (
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {(profile?.company_name || invoiceSettings?.company_name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {profile?.company_name || invoiceSettings?.company_name || 'Your Company'}
                    </h1>
                  </div>
                )}

                <div className="space-y-1 text-sm text-gray-600">
                  {(profile?.company_address || invoiceSettings?.company_address) && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-gray-400" />
                      <p className="whitespace-pre-line">{profile?.company_address || invoiceSettings?.company_address}</p>
                    </div>
                  )}
                  {/* VAT Registration Number for applicable countries */}
                  {taxRegistrationNumber && taxFeatures?.requiresRegistrationNumber && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 className="h-4 w-4" />
                      <p>{taxFeatures.registrationNumberLabel}: {taxRegistrationNumber}</p>
                    </div>
                  )}
                  {(profile?.phone || invoiceSettings?.company_phone) && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <p>{profile?.phone || invoiceSettings?.company_phone}</p>
                    </div>
                  )}

                  {(profile?.email || invoiceSettings?.company_email) && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <p>{profile?.email || invoiceSettings?.company_email}</p>
                    </div>
                  )}
                  {invoiceSettings?.company_website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <p>{invoiceSettings.company_website}</p>
                    </div>
                  )}
                  {invoiceSettings?.tax_number && (
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gray-400" />
                      <p>Tax ID: {invoiceSettings.tax_number}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Title & Number */}
              <div className="text-right">
                <h2 className="text-4xl font-extralight tracking-tight text-slate-800 mb-1">INVOICE</h2>
                <p className="text-2xl font-bold tracking-tight" style={{ color: primaryColor }}>
                  {invoice.invoice_number}
                </p>
                {isOverdue && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    {Math.abs(daysUntilDue)} days overdue
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-200"></div>

        {/* Invoice Details */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Bill To */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserIcon className="h-3.5 w-3.5" />
              Bill To
            </h3>
            {invoice.client ? (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-5 border border-slate-200/60">
                <p className="font-semibold text-slate-900 text-lg">{invoice.client.name}</p>
                {invoice.client.company_name && (
                  <p className="text-slate-700 font-medium">{invoice.client.company_name}</p>
                )}
                {invoice.client.email && (
                  <p className="text-slate-600 text-sm mt-2">{invoice.client.email}</p>
                )}
                {invoice.client.phone && (
                  <p className="text-slate-600 text-sm">{invoice.client.phone}</p>
                )}
                {invoice.client.address && (
                  <p className="text-slate-600 text-sm mt-2 whitespace-pre-line">{invoice.client.address}</p>
                )}
              </div>
            ) : (
              <p className="text-slate-400 italic">No client information</p>
            )}
          </div>

          {/* Invoice Info & QR Code */}
          <div className="space-y-6">
            {/* Dates */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Invoice Details
              </h3>
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-5 border border-slate-200/60 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    Invoice Date:
                  </span>
                  <span className="font-medium">{format(parseISO(invoice.date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    Due Date:
                  </span>
                  <span className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                    {format(parseISO(invoice.due_date), 'MMM dd, yyyy')}
                  </span>
                </div>
                {isOverdue && (
                  <p className="text-red-600 text-sm font-medium">
                    {Math.abs(daysUntilDue)} days overdue
                  </p>
                )}
                {invoice.currency && invoice.currency !== baseCurrency && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      Currency:
                    </span>
                    <span className="font-medium">
                      {invoice.currency}
                      {invoice.exchange_rate && invoice.exchange_rate !== 1 && (
                        <span className="text-sm text-gray-500 ml-2">
                          (1 {baseCurrency} = {invoice.exchange_rate} {invoice.currency})
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {incomeCategoryName && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      Income Category:
                    </span>
                    <span className="font-medium text-indigo-600">{incomeCategoryName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* QR Code for Mobile Payment/Viewing */}
            {qrCode && (
              <div className="flex flex-col items-center md:items-end">
                <p className="text-xs text-gray-500 mb-2">Scan to view invoice</p>
                <img src={qrCode} alt="Invoice QR Code" className="w-24 h-24" />
              </div>
            )}
          </div>
        </div>



        {/* Items Table */}
        <div className="px-8 pb-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Invoice Items
          </h3>
          <div className="overflow-hidden bg-white rounded-xl shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Rate
                  </th>
                  {/* Add VAT columns for UK/EU */}
                  {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown && (
                    <>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Net Amount
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        {taxLabel} %
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        {taxLabel}
                      </th>
                    </>
                  )}
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown ? 'Gross Amount' : 'Amount'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoice.items?.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.description}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-center">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(item.rate, invoice.currency || baseCurrency)}
                    </td>
                    {/* Add VAT details for UK/EU */}
                    {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown && (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">
                          {formatCurrency(item.net_amount || item.amount, invoice.currency || baseCurrency)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-center">
                          {item.tax_rate || 0}%
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">
                          {formatCurrency(item.tax_amount || 0, invoice.currency || baseCurrency)}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(
                        userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown
                          ? (item.gross_amount || item.amount)
                          : item.amount,
                        invoice.currency || baseCurrency
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>



          {/* VAT Summary for UK/EU */}
          {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown && (
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">{taxLabel} Summary</h4>
              <div className="space-y-2">
                {(() => {
                  // Group items by tax rate
                  const taxGroups = invoice.items?.reduce((acc, item) => {
                    const rate = item.tax_rate || 0;
                    if (!acc[rate]) {
                      acc[rate] = { net: 0, tax: 0 };
                    }
                    acc[rate].net += item.net_amount || item.amount;
                    acc[rate].tax += item.tax_amount || 0;
                    return acc;
                  }, {} as Record<number, { net: number; tax: number }>);

                  return Object.entries(taxGroups || {}).map(([rate, amounts]) => (
                    <div key={rate} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {taxLabel} @ {rate}% on {formatCurrency(amounts.net, invoice.currency || baseCurrency)}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(amounts.tax, invoice.currency || baseCurrency)}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Totals Section */}
          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">
                  {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown ? 'Net Total' : 'Subtotal'}
                </span>
                <span className="font-medium">{formatCurrency(invoice.subtotal, invoice.currency || baseCurrency)}</span>
              </div>

              {invoice.tax_rate > 0 && (
                <div className="flex justify-between items-center py-2 border-t border-gray-200">
                  <span className="text-gray-600">{taxLabel} ({invoice.tax_rate}%)</span>
                  <span className="font-medium">{formatCurrency(invoice.tax_amount, invoice.currency || baseCurrency)}</span>
                </div>
              )}

              <div className="flex justify-between items-center py-3 border-t-2 border-gray-900">
                <span className="text-lg font-semibold">Total</span>
                <div className="text-right">
                  <span className="text-lg font-bold" style={{ color: primaryColor }}>
                    {formatCurrency(invoice.total, invoice.currency || baseCurrency)}
                  </span>
                  {invoice.currency && invoice.currency !== baseCurrency && invoice.base_amount && (
                    <div className="text-sm text-gray-500">
                      ({formatCurrency(invoice.base_amount, baseCurrency)})
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History Section - Above Payment Information with light colors */}
        {(invoice.status === 'paid' || invoice.status === 'partially_paid') && invoicePayments.length > 0 && (
          <div className="px-8 pb-6 no-print">
            <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
              {/* Section Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Banknote className="h-4 w-4" style={{ color: primaryColor }} />
                  Payment History
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  {invoicePayments.length} payment{invoicePayments.length > 1 ? 's' : ''} recorded
                </p>
              </div>

              <div className="p-6">
                <div className="overflow-hidden bg-white rounded-xl ring-1 ring-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Method
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Reference
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoicePayments.map((payment, index) => (
                        <tr key={payment.id || index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {format(parseISO(payment.payment_date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                            {formatCurrency(payment.amount, invoice.currency || baseCurrency)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {payment.payment_method.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {payment.reference_number || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {payment.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Payment Summary */}
                {paymentBalance && (
                  <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Invoice Total</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(invoice.total, invoice.currency || baseCurrency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Total Paid</span>
                      <span className="text-sm font-bold text-green-600">
                        {formatCurrency(paymentBalance.total_paid, invoice.currency || baseCurrency)}
                      </span>
                    </div>
                    {paymentBalance.balance_due > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-700">Balance Due</span>
                        <span className="text-sm font-bold text-red-600">
                          {formatCurrency(paymentBalance.balance_due, invoice.currency || baseCurrency)}
                        </span>
                      </div>
                    )}
                    {paymentBalance.balance_due <= 0 && (
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-sm font-semibold text-slate-700">Status</span>
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-green-600">
                          <Check className="h-4 w-4" />
                          Fully Paid
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Information - Always Visible */}
        {(paymentMethods.length > 0 || invoiceSettings?.bank_name || invoiceSettings?.paypal_email) && (
          <div className="px-8 pb-8">
            <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
              {/* Section Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="h-4 w-4" style={{ color: primaryColor }} />
                  Payment Information
                </h3>
              </div>

              <div className="p-6">
                {/* NEW PAYMENT METHODS SYSTEM */}
                {paymentMethods.length > 0 ? (
                  <div className="grid gap-4">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`relative rounded-xl p-5 transition-all ${method.is_primary
                          ? 'bg-white shadow-sm border-2'
                          : 'bg-slate-50/50 border border-slate-200'
                          }`}
                        style={{
                          borderColor: method.is_primary ? primaryColor : undefined
                        }}
                      >
                        {/* Primary Badge */}
                        {method.is_primary && (
                          <div
                            className="absolute -top-px -right-px px-3 py-1 text-xs font-bold text-white rounded-bl-lg rounded-tr-xl"
                            style={{ backgroundColor: primaryColor }}
                          >
                            PREFERRED
                          </div>
                        )}

                        {/* Method Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                            style={{
                              backgroundColor: method.is_primary ? `${primaryColor}15` : '#f1f5f9'
                            }}
                          >
                            {PAYMENT_METHOD_TEMPLATES[method.type]?.icon || '💳'}
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">{method.display_name}</h4>
                            <p className="text-xs text-slate-500">{PAYMENT_METHOD_TEMPLATES[method.type]?.description}</p>
                          </div>
                        </div>

                        {/* Payment Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {method.fields && Object.entries(method.fields)
                            .filter(([key, value]) => key && value)
                            .map(([key, value]) => (
                              <div key={key} className="bg-white rounded-lg px-4 py-3 border border-slate-200">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                                  {String(key).replace(/_/g, ' ')}
                                </p>
                                <p className="font-mono text-sm font-semibold text-slate-900">{String(value)}</p>
                              </div>
                            ))}
                        </div>

                        {/* Instructions */}
                        {method.instructions && (
                          <div
                            className="mt-4 px-4 py-3 rounded-lg text-sm"
                            style={{ backgroundColor: `${primaryColor}08`, color: primaryColor }}
                          >
                            💡 {method.instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* OLD SYSTEM - FALLBACK for backward compatibility */
                  <div className="grid gap-4">
                    {invoiceSettings?.bank_name && (
                      <div className="bg-white rounded-xl p-5 ring-1 ring-slate-200">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-xl">
                            🏦
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">Bank Transfer</h4>
                            <p className="text-xs text-slate-500">Direct bank deposit</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Bank Name</p>
                            <p className="font-mono text-sm font-semibold text-slate-900">{invoiceSettings.bank_name}</p>
                          </div>
                          {invoiceSettings.account_number && (
                            <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Account Number</p>
                              <p className="font-mono text-sm font-semibold text-slate-900">{invoiceSettings.account_number}</p>
                            </div>
                          )}
                          {invoiceSettings.routing_number && (
                            <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Routing / Sort Code</p>
                              <p className="font-mono text-sm font-semibold text-slate-900">{invoiceSettings.routing_number}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {invoiceSettings?.paypal_email && (
                      <div className="bg-white rounded-xl p-5 ring-1 ring-slate-200">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-xl">
                            💳
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">PayPal</h4>
                            <p className="text-xs text-slate-500">Fast & secure online payment</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">PayPal Email</p>
                          <p className="font-mono text-sm font-semibold text-slate-900">{invoiceSettings.paypal_email}</p>
                        </div>
                      </div>
                    )}

                    {invoiceSettings?.payment_instructions && (
                      <div
                        className="px-4 py-3 rounded-lg text-sm"
                        style={{ backgroundColor: `${primaryColor}08`, color: primaryColor }}
                      >
                        💡 {invoiceSettings.payment_instructions}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes & Footer */}
        {(invoice.notes || invoiceSettings?.invoice_notes || invoiceSettings?.invoice_footer) && (
          <div className="px-8 py-6 border-t border-gray-200 space-y-4">
            {invoice.notes && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}

            {!invoice.notes && invoiceSettings?.invoice_notes && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">{invoiceSettings.invoice_notes}</p>
              </div>
            )}

            {invoiceSettings?.invoice_footer && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 text-center whitespace-pre-line">{invoiceSettings.invoice_footer}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer with Security */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              <span>Invoice ID: {invoice.id}</span>
            </div>
            <div className="text-center">
              Generated on {format(new Date(), 'MMM dd, yyyy \'at\' h:mm a')}
            </div>
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              <span>Reference: {invoice.invoice_number}</span>
            </div>
          </div>
        </div>
      </div>


      {/* Status Change Confirmation Modal */}
      {showStatusConfirm && pendingStatus && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${pendingStatus === 'paid' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                {pendingStatus === 'paid' ? (
                  <Check className="h-6 w-6 text-green-600" />
                ) : (
                  <FileX className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {pendingStatus === 'paid' ? 'Mark as Paid?' : 'Cancel Invoice?'}
                </h3>
                <p className="text-sm text-gray-500">This action requires confirmation</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              {pendingStatus === 'paid' && invoice?.status === 'partially_paid' && paymentBalance ? (
                // Partially paid invoice - block direct "Mark as Paid"
                <div className="space-y-2">
                  <p className="text-sm text-amber-700 font-medium">
                    ⚠️ This invoice has a remaining balance
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Invoice Total:</span>
                    <span className="font-medium">{formatCurrency(invoice?.total || 0, invoice?.currency || baseCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Already Paid:</span>
                    <span className="text-green-600 font-medium">{formatCurrency(paymentBalance.total_paid, invoice?.currency || baseCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2 mt-2">
                    <span className="text-gray-900 font-semibold">Remaining Balance:</span>
                    <span className="text-amber-600 font-bold">{formatCurrency(paymentBalance.balance_due, invoice?.currency || baseCurrency)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    Please record the remaining payment to maintain accurate financial records.
                  </p>
                </div>
              ) : pendingStatus === 'paid' ? (
                <p className="text-sm text-gray-700">
                  This will record <strong>{formatCurrency(invoice?.total || 0, invoice?.currency || baseCurrency)}</strong> as income and mark the invoice as fully paid. This action cannot be easily undone.
                </p>
              ) : (
                <p className="text-sm text-gray-700">
                  Canceling this invoice will prevent further payments and mark it as void. You may need to create a credit note for accounting purposes.
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowStatusConfirm(false);
                  setPendingStatus(null);
                }}
                className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium transition-colors"
              >
                Cancel
              </button>
              {pendingStatus === 'paid' && invoice?.status === 'partially_paid' && paymentBalance && paymentBalance.balance_due > 0 ? (
                // Show "Record Remaining Payment" button instead of "Mark as Paid"
                <button
                  onClick={() => {
                    setShowStatusConfirm(false);
                    setPendingStatus(null);
                    // Pre-fill the remaining amount in the payment modal
                    setPartialPaymentData(prev => ({
                      ...prev,
                      amount: paymentBalance.balance_due.toString()
                    }));
                    setShowPartialPayment(true);
                  }}
                  className="px-4 py-2.5 text-white rounded-xl font-medium transition-colors flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Banknote className="h-4 w-4" />
                  Record Remaining Payment
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleStatusChange(pendingStatus);
                    setShowStatusConfirm(false);
                    setPendingStatus(null);
                  }}
                  className={`px-4 py-2.5 text-white rounded-xl font-medium transition-colors flex items-center gap-2 ${pendingStatus === 'paid'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                    }`}
                >
                  <Check className="h-4 w-4" />
                  {pendingStatus === 'paid' ? 'Mark as Paid' : 'Cancel Invoice'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showWhatsApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Send Invoice via WhatsApp</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number (with country code)
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowWhatsApp(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWhatsAppShare}
                  disabled={!phoneNumber}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {showPartialPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/20">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Record Partial Payment
            </h3>

            {paymentError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {paymentError}
              </div>
            )}

            {/* Display remaining balance */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-900 font-medium">Invoice Total:</span>
                <span className="text-sm font-bold text-blue-900">
                  {formatCurrency(invoice?.total || 0, invoice?.currency || baseCurrency)}
                </span>
              </div>
              {paymentBalance && paymentBalance.total_paid > 0 && (
                <>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-blue-700">Total Paid:</span>
                    <span className="text-sm text-blue-700">
                      {formatCurrency(paymentBalance.total_paid, invoice?.currency || baseCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-blue-200">
                    <span className="text-sm font-semibold text-blue-900">Balance Due:</span>
                    <span className="text-sm font-bold text-blue-900">
                      {formatCurrency(paymentBalance.balance_due, invoice?.currency || baseCurrency)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={partialPaymentData.amount}
                  onChange={(e) => setPartialPaymentData({ ...partialPaymentData, amount: e.target.value })}
                  placeholder={`Max: ${formatCurrency(paymentBalance?.balance_due ?? invoice?.total ?? 0, invoice?.currency || baseCurrency)}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={partialPaymentData.payment_date}
                  onChange={(e) => setPartialPaymentData({ ...partialPaymentData, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={partialPaymentData.payment_method}
                  onChange={(e) => setPartialPaymentData({ ...partialPaymentData, payment_method: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={partialPaymentData.reference_number}
                  onChange={(e) => setPartialPaymentData({ ...partialPaymentData, reference_number: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={partialPaymentData.notes}
                  onChange={(e) => setPartialPaymentData({ ...partialPaymentData, notes: e.target.value })}
                  placeholder="Optional payment notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowPartialPayment(false);
                  setPaymentError('');
                }}
                disabled={processingPayment}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePartialPayment}
                disabled={processingPayment || !partialPaymentData.amount}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Record Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD EMAIL DIALOG HERE */}
      {showEmailDialog && invoice && (
        <SendEmailDialog
          invoice={invoice}
          onClose={() => setShowEmailDialog(false)}
          onSuccess={() => {
            loadInvoice(); // Reload invoice to update status
            setShowEmailDialog(false);
          }}
        />
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          
          /* Hide everything except the invoice */
          body * {
            visibility: hidden;
          }
          
          .bg-white.rounded-lg.shadow-xl, .bg-white.rounded-lg.shadow-xl * {
            visibility: visible;
          }
          
          /* Position invoice at top left */
          .bg-white.rounded-lg.shadow-xl {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
            border-radius: 0 !important;
            page-break-inside: avoid;
          }
          
          /* Adjust spacing */
          .p-8, .px-8, .py-8 {
            padding: 1.5rem !important;
          }
          
          .p-6, .px-6, .py-6 {
            padding: 1rem !important;
          }
          
          /* Ensure tables don't break */
          table {
            page-break-inside: avoid;
          }
          
          /* Fix text sizes */
          .text-4xl {
            font-size: 2rem !important;
          }
          
          .text-2xl {
            font-size: 1.5rem !important;
          }
          
          .text-xl {
            font-size: 1.25rem !important;
          }
          
          /* Ensure backgrounds print */
          .bg-gray-50 {
            background-color: #f9fafb !important;
          }
          
          .bg-gray-100 {
            background-color: #f3f4f6 !important;
          }
          
          /* Hide QR code section if you don't want it in print */
          /* .flex.flex-col.items-center.md\\:items-end {
            display: none !important;
          } */
          
          /* Ensure proper page breaks */
          .page-break-avoid {
            page-break-inside: avoid !important;
          }
          
          /* Fix button/link visibility */
          button, a {
            text-decoration: none !important;
          }
          
          /* Ensure invoice number is prominent */
          h2 {
            color: #1a202c !important;
            font-weight: bold !important;
          }
        }
      `}</style>
    </div>
  );
};