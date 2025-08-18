// src/components/Invoice/PublicInvoiceView.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Invoice } from '../../types';
import { countries } from '../../data/countries';
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
  EyeOff,
  Calendar,
  DollarSign,
  Hash,
  Building2,
  AlertCircle,
  Download,
  Printer
} from 'lucide-react';
import QRCode from 'qrcode';

export const PublicInvoiceView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState<string>('');

  // Get user country and tax features
  const userCountry = countries.find(c => c.code === userSettings?.country);
  const taxFeatures = userCountry?.taxFeatures;
  const taxLabel = userCountry?.taxName || 'Tax';
  const baseCurrency = userSettings?.base_currency || 'USD';

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
        .select('invoice_id, expires_at')
        .eq('token', token)
        .eq('invoice_id', id)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('This link has expired or is invalid');
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        throw new Error('This link has expired. Please request a new one.');
      }

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

      // Fetch user settings for country and currency
      const { data: userSettingsData } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', invoiceData.user_id)
        .single();

      setInvoice(invoiceData);
      setProfile(profileData);
      setInvoiceSettings(settings);
      setUserSettings(userSettingsData);
      
      // Set tax registration number
      if (userSettingsData?.tax_registration_number) {
        setTaxRegistrationNumber(userSettingsData.tax_registration_number);
      }

      // Generate QR code with correct URL
      const currentUrl = window.location.href;
      const qrDataUrl = await QRCode.toDataURL(currentUrl, {
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    // You can implement PDF download here
    alert('PDF download feature coming soon');
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
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
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Invoice</h2>
          <p className="text-gray-600 mb-6">{error || 'Invoice not found'}</p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  const daysUntilDue = differenceInDays(parseISO(invoice.due_date), new Date());
  const isOverdue = daysUntilDue < 0 && invoice.status !== 'paid';
  const primaryColor = invoiceSettings?.invoice_color || '#4F46E5';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Action Bar */}
        <div className="mb-6 flex justify-between items-center no-print">
          <h1 className="text-2xl font-bold text-gray-900">Invoice {invoice.invoice_number}</h1>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Invoice Document */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header Section */}
          <div className="p-8 border-b border-gray-200">
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
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
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
                </div>
              </div>

              {/* Invoice Status */}
              <div className="text-right">
                <h2 className="text-3xl font-light text-gray-800 mb-2">INVOICE</h2>
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

          {/* Client and Invoice Details */}
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Bill To */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
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

            {/* Invoice Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
                Invoice Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice Date:</span>
                  <span className="font-medium">{format(parseISO(invoice.date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Due Date:</span>
                  <span className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                    {format(parseISO(invoice.due_date), 'MMM dd, yyyy')}
                  </span>
                </div>
                {isOverdue && (
                  <p className="text-red-600 text-sm font-medium">
                    {Math.abs(daysUntilDue)} days overdue
                  </p>
                )}
                
                {/* Currency Information */}
                {invoice.currency && invoice.currency !== baseCurrency && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Currency:</span>
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

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="mt-6 flex flex-col items-end">
                  <p className="text-xs text-gray-500 mb-2">Scan to view online</p>
                  <img src={qrCodeUrl} alt="Invoice QR Code" className="w-24 h-24" />
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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Rate
                    </th>
                    
                    {/* VAT columns for UK/EU */}
                    {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown && (
                      <>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Net Amount
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          {taxLabel} %
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          {taxLabel}
                        </th>
                      </>
                    )}
                    
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown ? 'Gross Amount' : 'Amount'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.items?.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {formatCurrency(item.rate, invoice.currency || baseCurrency)}
                      </td>
                      
                      {/* VAT details for UK/EU */}
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
            {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown && invoice.items && (
              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">{taxLabel} Summary</h4>
                <div className="space-y-2">
                  {(() => {
                    // Group items by tax rate
                    const taxGroups = invoice.items.reduce((acc, item) => {
                      const rate = item.tax_rate || 0;
                      if (!acc[rate]) {
                        acc[rate] = { net: 0, tax: 0 };
                      }
                      acc[rate].net += item.net_amount || item.amount;
                      acc[rate].tax += item.tax_amount || 0;
                      return acc;
                    }, {} as Record<number, { net: number; tax: number }>);

                    return Object.entries(taxGroups).map(([rate, amounts]) => (
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

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">
                    {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown ? 'Net Total' : 'Subtotal'}
                  </span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal, invoice.currency || baseCurrency)}</span>
                </div>
                
                {invoice.tax_rate > 0 && (
                  <div className="flex justify-between py-2 border-t border-gray-200">
                    <span className="text-gray-600">{taxLabel} ({invoice.tax_rate}%)</span>
                    <span className="font-medium">{formatCurrency(invoice.tax_amount, invoice.currency || baseCurrency)}</span>
                  </div>
                )}
                
                <div className="flex justify-between py-3 border-t-2 border-gray-900">
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

          {/* Payment Information */}
          {(invoiceSettings?.bank_name || invoiceSettings?.paypal_email) && (
            <div className="px-8 pb-8">
              <button
                onClick={() => setShowPaymentInfo(!showPaymentInfo)}
                className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2 hover:text-gray-900"
              >
                <Banknote className="h-4 w-4" />
                Payment Information
                {showPaymentInfo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              
              {showPaymentInfo && (
                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  {invoiceSettings.bank_name && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Bank Transfer</h4>
                      <div className="text-sm space-y-1">
                        <p><span className="text-gray-600">Bank:</span> {invoiceSettings.bank_name}</p>
                        {invoiceSettings.account_number && (
                          <p><span className="text-gray-600">Account:</span> {invoiceSettings.account_number}</p>
                        )}
                        {invoiceSettings.routing_number && (
                          <p><span className="text-gray-600">Routing:</span> {invoiceSettings.routing_number}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {invoiceSettings.paypal_email && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">PayPal</h4>
                      <p className="text-sm">
                        <span className="text-gray-600">Email:</span> {invoiceSettings.paypal_email}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {invoiceSettings?.payment_instructions && showPaymentInfo && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Instructions:</strong> {invoiceSettings.payment_instructions}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes & Footer */}
          {(invoice.notes || invoiceSettings?.invoice_footer) && (
            <div className="px-8 py-6 border-t border-gray-200">
              {invoice.notes && (
                <div className="mb-4">
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

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>Invoice ID: {invoice.id}</span>
              </div>
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                <span>Reference: {invoice.invoice_number}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          @page {
            size: A4;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};