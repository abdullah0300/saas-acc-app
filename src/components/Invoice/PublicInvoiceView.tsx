// src/components/Invoice/PublicInvoiceView.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Invoice } from '../../types';
import {
  FileText,
  Mail,
  Phone,
  MapPin,
  Globe,
  Shield,
  Clock,
  Building,
  Banknote,
  Eye,
  EyeOff
} from 'lucide-react';
import QRCode from 'qrcode';

export const PublicInvoiceView: React.FC = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);

  useEffect(() => {
    if (id) {
      loadInvoice();
    }
  }, [id]);

  const loadInvoice = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token || !id) {
        throw new Error('Invalid access link');
      }

      // Validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from('invoice_access_tokens')
        .select('invoice_id')
        .eq('token', token)
        .eq('invoice_id', id)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        throw new Error('This link has expired or is invalid');
      }

      // Fetch invoice data
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

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', invoiceData.user_id)
        .single();

      // Fetch invoice settings
      const { data: settings } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('user_id', invoiceData.user_id)
        .single();

      setInvoice(invoiceData);
      setProfile(profileData);
      setInvoiceSettings(settings);

      // Generate QR code
      const invoiceUrl = `${window.location.origin}/public/invoice/${id}?token=${token}`;
      const qrDataUrl = await QRCode.toDataURL(invoiceUrl, {
        width: 150,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataUrl);

    } catch (err: any) {
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'sent':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'canceled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
      </div>
    );
  }

  const primaryColor = invoiceSettings?.invoice_color || '#4F46E5';

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Invoice Document */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 print:p-0">
        <div className="bg-white rounded-lg shadow-xl print:shadow-none print:rounded-none overflow-hidden">
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
                      style={{ maxWidth: '200px' }}
                      onError={(e) => {
                        console.error('Logo failed to load:', e);
                        // Hide the broken image
                        e.currentTarget.style.display = 'none';
                      }}
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
              <div className="w-full max-w-xs">
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-base text-gray-600">Subtotal</span>
                    <span className="text-base font-medium text-gray-900">${invoice.subtotal.toFixed(2)}</span>
                  </div>
                  
                  {invoice.tax_rate > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-base text-gray-600">Tax ({invoice.tax_rate}%)</span>
                      <span className="text-base font-medium text-gray-900">${invoice.tax_amount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-3 border-t-2 border-gray-900">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                      ${invoice.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          {(invoiceSettings?.bank_name || invoiceSettings?.paypal_email) && (
            <div className="px-8 py-6 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowPaymentInfo(!showPaymentInfo)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4 hover:text-gray-900"
              >
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
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Secure Invoice ID: {invoice.id}</span>
              </div>
              <div className="text-center">
                Generated on {format(new Date(), 'MMM dd, yyyy')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          /* Hide everything except invoice */
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