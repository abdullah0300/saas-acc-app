import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Add this import with your other imports
import { pdfService } from '../../services/pdfService';
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
  Banknote
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
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);

  useEffect(() => {
    if (id && user) {
      loadInvoiceData();
    }
  }, [id, user]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = () => setShowActions(false);
    if (showActions) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showActions]);

 const loadInvoiceData = async () => {
  // Check for token-based access (for PDF generation)
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token && !user) {
    // Token-based access - validate and load without user auth
    try {
      setLoading(true);
      
      // Validate token
      const { data: tokenData } = await supabase
        .from('invoice_access_tokens')
        .select('invoice_id')
        .eq('token', token)
        .eq('invoice_id', id)
        .gte('expires_at', new Date().toISOString())
        .single();
      
      if (!tokenData) throw new Error('Invalid or expired token');
      
      // Load invoice data directly
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select(`*, client:clients(*), items:invoice_items(*)`)
        .eq('id', id)
        .single();
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', invoiceData.user_id)
        .single();
      
      const { data: settings } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('user_id', invoiceData.user_id)
        .single();
      
      setInvoice(invoiceData);
      setProfile(profileData);
      setInvoiceSettings(settings);
      
      // Generate QR code
      const invoiceUrl = `${window.location.origin}/invoices/view/${id}`;
      const qrDataUrl = await QRCode.toDataURL(invoiceUrl, {
        width: 150,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataUrl);
      
      setLoading(false);
      return; // Exit early for token-based access
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return;
    }
  }
  
  // Normal user-based access (your existing code)
  if (!id || !user) return;

  try {
    setLoading(true);
    const [invoiceData, profileData] = await Promise.all([
      getInvoice(id),
      getProfile(user.id)
    ]);
    
    // Load invoice settings
    const { data: settings } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    setInvoice(invoiceData);
    setProfile(profileData);
    setInvoiceSettings(settings);
    
    // Generate QR code for invoice URL
    const invoiceUrl = `${window.location.origin}/invoices/view/${id}`;
    const qrDataUrl = await QRCode.toDataURL(invoiceUrl, {
      width: 150,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    setQrCodeUrl(qrDataUrl);
    
    // Track invoice view
    await trackActivity('viewed');
    
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  const trackActivity = async (action: string, details?: any) => {
    if (!user || !id) return;
    
    try {
      await supabase.from('invoice_activities').insert([{
        invoice_id: id,
        user_id: user.id,
        action,
        details: details || {}
      }]);
    } catch (err) {
      console.error('Error tracking activity:', err);
    }
  };

  const handleStatusChange = async (status: 'sent' | 'paid') => {
    if (!invoice || !id) return;

    try {
      await updateInvoice(id, { status });
      await trackActivity('status_changed', { from: invoice.status, to: status });
      await loadInvoiceData();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
    trackActivity('printed');
  };

  const generatePDF = async () => {
  if (!invoice || !invoiceRef.current) return;
  
  setDownloading(true);
  try {
    console.log('Generating PDF via edge function...');
    
    // Call edge function to generate PDF
    const pdfBlob = await pdfService.generateInvoicePDF(invoice.id);
    
    // Download the PDF
    pdfService.downloadBlob(pdfBlob, `invoice-${invoice.invoice_number}.pdf`);
    
    // Track the activity
    await trackActivity('downloaded_pdf');
    
    console.log('PDF generated successfully');
    
  } catch (err: any) {
    console.error('Error generating PDF:', err);
    alert('Error generating PDF from server. Trying local generation...');
    
    // If edge function fails, fall back to existing client-side generation
    console.log('Falling back to client-side PDF generation...');
    await generatePDFClientSide();
  } finally {
    setDownloading(false);
  }
};

const generatePDFClientSide = async () => {
    if (!invoiceRef.current) return;
    
    setDownloading(true);
    try {
      // Hide action buttons during PDF generation
      const actionsElement = document.querySelector('.invoice-actions');
      if (actionsElement) {
        (actionsElement as HTMLElement).style.display = 'none';
      }
      
      // Create canvas from invoice element with better options
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: invoiceRef.current.scrollWidth,
        windowHeight: invoiceRef.current.scrollHeight,
        onclone: (clonedDoc) => {
          // Fix any color issues in cloned document
          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            const style = window.getComputedStyle(el);
            
            // Replace any problematic color values
            if (style.color && style.color.includes('oklch')) {
              el.style.color = '#000000';
            }
            if (style.backgroundColor && style.backgroundColor.includes('oklch')) {
              el.style.backgroundColor = '#ffffff';
            }
          }
        }
      });
      
      // Restore action buttons
      if (actionsElement) {
        (actionsElement as HTMLElement).style.display = '';
      }
      
      // Rest of the PDF generation code...
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Handle multiple pages if needed
      let heightLeft = imgHeight;
      let position = 0;
      
      while (heightLeft > pageHeight) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`invoice-${invoice?.invoice_number || 'document'}.pdf`);
      
      await trackActivity('downloaded_pdf');
    } catch (err: any) {
      alert('Error generating PDF: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const sendInvoice = async (method: 'email' | 'whatsapp') => {
    if (!invoice) return;
    
    setSending(true);
    try {
      if (method === 'email') {
        const { error } = await supabase.functions.invoke('send-invoice-email', {
          body: {
            invoiceId: invoice.id,
            recipientEmail: invoice.client?.email,
            invoiceUrl: `${window.location.origin}/invoices/view/${invoice.id}`
          }
        });
        
        if (error) throw error;
        alert('Invoice sent via email successfully!');
      } else {
        const message = encodeURIComponent(
          `*Invoice ${invoice.invoice_number}*\n\n` +
          `Amount: *$${invoice.total.toFixed(2)}*\n` +
          `Due Date: ${format(parseISO(invoice.due_date), 'MMM dd, yyyy')}\n\n` +
          `View Invoice: ${window.location.origin}/invoices/view/${invoice.id}`
        );
        
        window.open(`https://wa.me/${invoice.client?.phone}?text=${message}`, '_blank');
      }
      
      if (invoice.status === 'draft') {
        await handleStatusChange('sent');
      }
      
      await trackActivity(`sent_via_${method}`);
    } catch (err: any) {
      alert('Error sending invoice: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const copyInvoiceLink = async () => {
    const invoiceUrl = `${window.location.origin}/invoices/view/${id}`;
    await navigator.clipboard.writeText(invoiceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    await trackActivity('link_copied');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'paid': return 'bg-green-100 text-green-800 border-green-300';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-300';
      case 'canceled': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getDaysUntilDue = () => {
    if (!invoice) return 0;
    return differenceInDays(parseISO(invoice.due_date), new Date());
  };

  const daysUntilDue = getDaysUntilDue();
  const isOverdue = daysUntilDue < 0 && invoice?.status !== 'paid';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-red-600 mb-4">{error || 'Invoice not found'}</p>
        <button
          onClick={() => navigate('/invoices')}
          className="text-blue-600 hover:text-blue-700"
        >
          Back to Invoices
        </button>
      </div>
    );
  }

  const primaryColor = invoiceSettings?.invoice_color || '#4F46E5';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Actions Bar - Hidden during print */}
      <div className="invoice-actions bg-white shadow-sm border-b sticky top-0 z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/invoices')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span className="hidden sm:inline">Back to Invoices</span>
            </button>

            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Status Actions */}
              {invoice.status === 'draft' && (
                <button
                  onClick={() => handleStatusChange('sent')}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Mark Sent</span>
                </button>
              )}
              
              {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                <button
                  onClick={() => handleStatusChange('paid')}
                  className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Mark Paid</span>
                </button>
              )}

              {/* Share Options */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowActions(!showActions);
                  }}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Share2 className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Share</span>
                </button>
                
                {showActions && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                    <button
                      onClick={() => {
                        sendInvoice('email');
                        setShowActions(false);
                      }}
                      disabled={!invoice.client?.email}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mail className="h-4 w-4 mr-3 text-gray-500" />
                      Send via Email
                    </button>
                    
                    <button
                      onClick={() => {
                        sendInvoice('whatsapp');
                        setShowActions(false);
                      }}
                      disabled={!invoice.client?.phone}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MessageCircle className="h-4 w-4 mr-3 text-gray-500" />
                      Send via WhatsApp
                    </button>
                    
                    <button
                      onClick={() => {
                        copyInvoiceLink();
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                    >
                      <Copy className="h-4 w-4 mr-3 text-gray-500" />
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                )}
              </div>

              {/* Print/Download */}
              <button
                onClick={handlePrint}
                className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors sm:hidden"
                title="Print"
              >
                <Printer className="h-5 w-5" />
              </button>
              
              <button
                onClick={handlePrint}
                className="hidden sm:inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Print
              </button>
              
              <button
                onClick={generatePDF}
                disabled={downloading}
                className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-1.5" />
                {downloading ? 'Generating...' : 'PDF'}
              </button>

              {/* Edit */}
              <button
                onClick={() => navigate(`/invoices/edit/${id}`)}
                className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                title="Edit"
              >
                <Edit className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
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
                  <h2 
                    className="text-4xl font-bold mb-2"
                    style={{ color: primaryColor }}
                  >
                    INVOICE
                  </h2>
                  <p className="text-xl font-semibold text-gray-700 mb-3">
                    {invoice.invoice_number}
                  </p>
                  <span className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-full border ${getStatusColor(invoice.status)}`}>
                    {invoice.status.toUpperCase()}
                  </span>
                  
                  {isOverdue && invoice.status !== 'paid' && (
                    <div className="mt-3 text-red-600 text-sm font-medium">
                      <Clock className="inline h-4 w-4 mr-1" />
                      {Math.abs(daysUntilDue)} days overdue
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Billing Details Section */}
          <div className="px-8 py-6 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Bill To */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Bill To
                </h3>
                {invoice.client ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900 text-lg">{invoice.client.name}</p>
                    {invoice.client.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-3.5 w-3.5" />
                        {invoice.client.email}
                      </div>
                    )}
                    {invoice.client.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-3.5 w-3.5" />
                        {invoice.client.phone}
                      </div>
                    )}
                    {invoice.client.address && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="h-3.5 w-3.5 mt-0.5" />
                        <span className="whitespace-pre-line">{invoice.client.address}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No client selected</p>
                )}
              </div>

              {/* Invoice Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Invoice Details
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Invoice Date:</span>
                    <span className="font-medium">{format(parseISO(invoice.date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Due Date:</span>
                    <span className="font-medium">{format(parseISO(invoice.due_date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Payment Terms:</span>
                    <span className="font-medium">
                      {differenceInDays(parseISO(invoice.due_date), parseISO(invoice.date))} days
                    </span>
                  </div>
                  {invoice.status === 'paid' && invoice.paid_date && (
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Paid Date:</span>
        <span className="font-medium">{format(parseISO(invoice.paid_date), 'MMM dd, yyyy')}</span>
      </div>
    )}

                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center md:items-end">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Quick Access
                </h3>
                {qrCodeUrl && (
                  <div className="bg-white p-2 border-2 border-gray-200 rounded-lg">
                    <img src={qrCodeUrl} alt="Invoice QR Code" className="w-32 h-32" />
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2 text-center">Scan to view online</p>
              </div>
            </div>
          </div>

          {/* Invoice Items Table */}
          <div className="px-8 py-6">
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Amount
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
                        ${item.rate.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                        ${item.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Section */}
            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-900">${invoice.subtotal.toFixed(2)}</span>
                </div>
                
                {invoice.tax_rate > 0 && (
                  <div className="flex justify-between py-2 text-sm border-b border-gray-200">
                    <span className="text-gray-600">Tax ({invoice.tax_rate}%):</span>
                    <span className="font-medium text-gray-900">${invoice.tax_amount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between py-3 text-lg font-bold">
                  <span>Total Due:</span>
                  <span style={{ color: primaryColor }}>${invoice.total.toFixed(2)}</span>
                </div>
                
                {invoice.status === 'paid' && (
                  <div className="flex items-center justify-end gap-2 text-green-600 text-sm font-medium pt-2">
                    <Check className="h-5 w-5" />
                    <span>Payment Received</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payment Information */}
          {invoice.status !== 'paid' && (invoiceSettings?.bank_name || invoiceSettings?.paypal_email) && (
            <div className="px-8 py-6 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowPaymentInfo(!showPaymentInfo)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 hover:text-gray-900 transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                Payment Information
                {showPaymentInfo ? <EyeOff className="h-4 w-4 ml-1" /> : <Eye className="h-4 w-4 ml-1" />}
              </button>
              
              {showPaymentInfo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {invoiceSettings?.bank_name && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Bank Transfer
                      </h4>
                      <div className="bg-white rounded-lg p-4 text-sm space-y-1 border border-gray-200">
                        <p><span className="text-gray-600">Bank:</span> <span className="font-medium">{invoiceSettings.bank_name}</span></p>
                        <p><span className="text-gray-600">Account:</span> <span className="font-medium">{invoiceSettings.account_number}</span></p>
                        {invoiceSettings.routing_number && (
                          <p><span className="text-gray-600">Routing:</span> <span className="font-medium">{invoiceSettings.routing_number}</span></p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {invoiceSettings?.paypal_email && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        PayPal
                      </h4>
                      <div className="bg-white rounded-lg p-4 text-sm border border-gray-200">
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
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Secure Invoice</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Generated: {format(new Date(), 'MMM dd, yyyy')}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                <span>ID: {invoice.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5in;
          }
          
          * {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          body {
            margin: 0;
            padding: 0;
            background: white !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          .invoice-actions {
            display: none !important;
          }
          
          /* Reset max-width for print */
          .max-w-4xl {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Ensure invoice fills the page */
          .bg-white.rounded-lg {
            margin: 0 !important;
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
