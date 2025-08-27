import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
// Add this import with your other imports
import { pdfService } from '../../services/pdfService';
import { SendEmailDialog } from './SendEmailDialog'; // ADD THIS IMPORT
import { emailService } from '../../services/emailService'; // ADD THIS IMPORT
import { useSettings } from '../../contexts/SettingsContext'; // ADD THIS IMPORT
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
  Eye,
  EyeOff,
  QrCode,
  DollarSign,
  User as UserIcon,  // Renamed to avoid conflict
  Hash,
  Banknote,
  Building2,
  FileX 
} from 'lucide-react';
import { getInvoice, updateInvoice, getProfile } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Invoice, User } from '../../types';  // Now User type won't conflict
import { supabase } from '../../services/supabaseClient';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export const InvoiceView: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { formatCurrency, baseCurrency, exchangeRates } = useSettings();
  const { refreshBusinessData } = useData();
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
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false); // ADD THIS STATE
  const { userSettings } = useSettings();
  const userCountry = countries.find(c => c.code === userSettings?.country);
  const taxFeatures = userCountry?.taxFeatures;
  const taxLabel = userCountry?.taxName || 'Tax';
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState<string>('');

  useEffect(() => {
    if (user && id) {
      loadInvoice();
    }
  }, [user, id]);

  useEffect(() => {
    if (invoice) {
      generateQRCode();
    }
  }, [invoice]);

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
    
    // Load user profile
    const profileData = await getProfile(user.id);
    setProfile(profileData);
    
    // Load invoice settings
    const { data: settings } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', user.id)
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
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

// Complete handleStatusChange function for InvoiceView.tsx
// REPLACE your entire handleStatusChange function with this:

const handleStatusChange = async (newStatus: Invoice['status']) => {
  if (!invoice || !user) return;

  try {
    // Update the invoice status
    await updateInvoice(invoice.id, { status: newStatus });
    
    // If marking as paid, create income entry
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
        
        // Create income entry with CORRECT data
        const { error: incomeError } = await supabase
          .from('income')
          .insert([{
            user_id: user.id,
            amount: totalNetAmount, // NET amount (without tax)
            description: `Payment for Invoice #${invoice.invoice_number}`,
            date: new Date().toISOString().split('T')[0],
            client_id: invoice.client_id || null,
            category_id: invoice.income_category_id || null,
            reference_number: invoice.invoice_number,
            currency: invoice.currency || 'USD',
            exchange_rate: invoice.exchange_rate || 1,
            base_amount: (totalNetAmount / (invoice.exchange_rate || 1)),
            tax_rate: invoice.tax_rate || 0,
            tax_amount: totalTaxAmount, // Correct tax amount
            // Don't include total_with_tax - it's a generated column
            tax_metadata: {
              tax_breakdown: taxBreakdown,
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              created_from_invoice: true,
              is_uk_vat: isUK,
              invoice_date: invoice.date,
              invoice_total: invoice.total
            }
          }]);
          
        if (incomeError) {
          console.error('Error creating income:', incomeError);
          throw incomeError;
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

  const handlePrint = () => {
    window.print();
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
    const link = await generatePublicLink();
    if (!link || !phoneNumber) return;
    
     const message = encodeURIComponent(
    `Hello! Here's your invoice ${invoice?.invoice_number} from ${profile?.company_name || invoiceSettings?.company_name || 'our company'}.\n\n` +
    `Amount: ${formatCurrency(invoice?.total || 0, invoice?.currency || baseCurrency)}\n` +
    `Due Date: ${invoice?.due_date ? format(parseISO(invoice.due_date), 'MMM dd, yyyy') : 'N/A'}\n\n` +
    `📱 *View Full Invoice:*\n` +
    `${link}\n\n` + // ✅ Use the public link instead of private one
    `💳 Payment methods available.\n\n` +
    `Thank you for your business!`
  );
    
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    setShowWhatsApp(false);
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
      <div className="mb-6 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/invoices')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Invoice {invoice.invoice_number}
              </h1>
              <p className="text-sm text-gray-500">
                Created on {format(parseISO(invoice.created_at), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Credit Note Button */}
            {(invoice.status === 'paid' || invoice.status === 'sent') && (
              <div className="">
                <Link
                  to={`/credit-notes/new/${invoice.id}`}
                  className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <FileX className="h-5 w-5 mr-2" />
                  Issue Credit Note
                </Link>
                
            {invoice.has_credit_notes && invoice.total_credited && invoice.total_credited > 0 && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Credit Notes Issued:</strong> {formatCurrency(invoice.total_credited || 0, invoice.currency || baseCurrency)}
                </p>
                <Link
                  to={`/credit-notes?invoice=${invoice.id}`}
                  className="text-sm text-red-600 hover:text-red-800 underline mt-1 inline-block"
                >
                  View Related Credit Notes
                </Link>
              </div>
            )}
              </div>
            )}
            {/* Status Dropdown */}
            <select
              value={invoice.status}
              onChange={(e) => handleStatusChange(e.target.value as Invoice['status'])}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusColor(invoice.status)} border-0 cursor-pointer`}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
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

              {/* Print */}
              <button
                onClick={handlePrint}
                className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                title="Print"
              >
                <Printer className="h-5 w-5" />
              </button>

              {/* Share - UPDATED THIS SECTION */}
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

              {/* Generate PDF */}
              <button
                onClick={handleDownloadPDF}
                disabled={generatingPdf}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {generatingPdf ? 'Generating...' : 'PDF'}
              </button>

              {/* Edit */}
              {invoice && invoice.status !== 'paid' && invoice.status !== 'canceled' ? (
                <button
                  onClick={() => navigate(`/invoices/${id}/edit`)}
                  className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                  title="Edit"
                >
                  <Edit className="h-5 w-5" />
                </button>
              ) : (
                <button
                  disabled
                  className="p-1.5 text-gray-400 cursor-not-allowed"
                  title="Locked for compliance"
                >
                  <Shield className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

 {/* Credit Notes Section */}
{invoice && (() => {
  const hasCredits = (invoice.credit_tracking?.[0]?.credit_note_count || 0) > 0;
  const totalCredited = invoice.credit_tracking?.[0]?.total_credited || 0;
  const creditCount = invoice.credit_tracking?.[0]?.credit_note_count || 0;
  const canCreateCredit = invoice.status === 'sent' && invoice.total > totalCredited;

  if (!hasCredits && !canCreateCredit) return null;

  return (
    <div className="mt-6">
      {hasCredits ? (
        // Show full credit note info box if credits exist
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-start">
            <CreditCard className="h-5 w-5 text-orange-600 mt-0.5 mr-3" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-900">
                    Credit Notes Applied
                  </p>
                  <p className="text-sm text-orange-700 mt-1">
                    Total Credited: {formatCurrency(totalCredited, invoice.currency || baseCurrency)}
                    {totalCredited < invoice.total && (
                      <span className="ml-2 text-orange-600">
                        ({formatCurrency(invoice.total - totalCredited, invoice.currency || baseCurrency)} remaining)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    {creditCount} credit note{creditCount > 1 ? 's' : ''} issued
                  </p>
                </div>
                <div className="flex gap-2">
                  {canCreateCredit && (
                    <Link 
                      to={`/credit-notes/new/${invoice.id}`}
                      className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                    >
                      Add Another
                    </Link>
                  )}
                  <Link 
                    to={`/credit-notes?invoice=${invoice.id}`}
                    className="px-3 py-1 text-xs border border-orange-600 text-orange-600 rounded hover:bg-orange-100"
                  >
                    View All
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Only show create button if no credits exist but invoice can have credits
        canCreateCredit && (
          <Link 
            to={`/credit-notes/new/${invoice.id}`}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Create Credit Note
          </Link>
        )
      )}
    </div>
  );
})()} 

      {/* Invoice Document */}
      <div ref={invoiceRef} className="bg-white rounded-lg shadow-xl print:shadow-none print:rounded-none">
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

              {/* Invoice Title & Status */}
              <div className="text-right">
                <h2 className="text-4xl font-light text-gray-800 mb-2">INVOICE</h2>
                <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                  {invoice.invoice_number}
                </p>
                <div className="mt-3">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                    {invoice.status.toUpperCase()}
                  </span>
                </div>
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
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Bill To
            </h3>
            {invoice.client ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-semibold text-gray-900 text-lg">{invoice.client.name}</p>
                {invoice.client.email && (
                  <p className="text-gray-600 mt-1">{invoice.client.email}</p>
                )}
                {invoice.client.phone && (
                  <p className="text-gray-600">{invoice.client.phone}</p>
                )}
                {invoice.client.address && (
                  <p className="text-gray-600 mt-2 whitespace-pre-line">{invoice.client.address}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic">No client information</p>
            )}
          </div>

          {/* Invoice Info & QR Code */}
          <div className="space-y-6">
            {/* Dates */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Invoice Details
              </h3>
              <div className="space-y-3">
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
  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
    Invoice Items
  </h3>
  <div className="overflow-hidden bg-white rounded-lg shadow-sm ring-1 ring-gray-200">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
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

        {/* Payment Info Section */}
        {(invoiceSettings?.bank_name || invoiceSettings?.paypal_email) && (
          <div className="px-8 pb-8">
            <button
              onClick={() => setShowPaymentInfo(!showPaymentInfo)}
              className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2 hover:text-gray-900"
            >
              <CreditCard className="h-4 w-4" />
              Payment Information
              {showPaymentInfo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            
            {showPaymentInfo && (
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                {invoiceSettings.bank_name && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Building className="h-5 w-5 text-gray-600" />
                      Bank Transfer
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Bank Name:</p>
                        <p className="font-medium">{invoiceSettings.bank_name}</p>
                      </div>
                      {invoiceSettings.account_number && (
                        <div>
                          <p className="text-gray-600">Account Number:</p>
                          <p className="font-medium">{invoiceSettings.account_number}</p>
                        </div>
                      )}
                      {invoiceSettings.routing_number && (
                        <div>
                          <p className="text-gray-600">Routing Number:</p>
                          <p className="font-medium">{invoiceSettings.routing_number}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {invoiceSettings.paypal_email && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-gray-600" />
                      PayPal
                    </h4>
                    <div className="text-sm">
                      <p><span className="text-gray-600">Email:</span> <span className="font-medium">{invoiceSettings.paypal_email}</span></p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {invoiceSettings?.payment_instructions && showPaymentInfo && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Payment Instructions:</strong> {invoiceSettings.payment_instructions}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Notes & Footer */}
        {(invoice.notes || invoiceSettings?.invoice_footer) && (
          <div className="px-8 py-6 border-t border-gray-200 space-y-4">
            {invoice.notes && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
            
            {invoiceSettings?.invoice_footer && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 text-center">{invoiceSettings.invoice_footer}</p>
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