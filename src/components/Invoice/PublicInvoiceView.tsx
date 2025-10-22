// src/components/Invoice/PublicInvoiceView.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Invoice } from '../../types';
import { countries } from '../../data/countries';
import { PublicInvoicePayButton } from './PublicInvoicePayButton';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Building2,
  Calendar,
  AlertCircle,
  Download,
  CheckCircle,
  ChevronDown,
  Sparkles,
  ArrowRight,
  CreditCard,
  FileText,
  TrendingUp,
  Zap,
  Shield
} from 'lucide-react';
import QRCode from 'qrcode';

export const PublicInvoiceView: React.FC = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState<string>('');
  const [downloading, setDownloading] = useState(false);

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

      const { data: tokenData, error: tokenError } = await supabase
        .from('invoice_access_tokens')
        .select('invoice_id, expires_at')
        .eq('token', token)
        .eq('invoice_id', id)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('This link has expired or is invalid');
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        throw new Error('This link has expired. Please request a new one.');
      }

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

      const { data: userSettingsData} = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', invoiceData.user_id)
        .single();

      setInvoice(invoiceData);
      setProfile(profileData);
      setInvoiceSettings(settings);
      setUserSettings(userSettingsData);

      if (userSettingsData?.tax_registration_number) {
        setTaxRegistrationNumber(userSettingsData.tax_registration_number);
      }

      const currentUrl = window.location.href;
      const qrDataUrl = await QRCode.toDataURL(currentUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: '#4F46E5',
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

  const handleDownloadPDF = async () => {
    if (!invoice || downloading || !id) return;

    setDownloading(true);
    try {
      // Get the access token from URL
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token) {
        throw new Error('Access token not found');
      }

      // Call the edge function to generate PDF with the public access token
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/generate-invoice-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`, // Supabase anon key for auth
            'X-Invoice-Token': token, // Pass the public access token
          },
          body: JSON.stringify({ invoiceId: id }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF generation failed:', response.status, errorText);
        let errorMessage = 'Failed to generate PDF';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Get the PDF blob
      const blob = await response.blob();

      // Download the PDF
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert('Error generating PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'paid':
        return {
          gradient: 'from-emerald-500 to-teal-600',
          text: 'text-white',
          label: 'Paid',
          icon: CheckCircle,
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          textColor: 'text-emerald-700'
        };
      case 'sent':
        return {
          gradient: 'from-blue-500 to-indigo-600',
          text: 'text-white',
          label: 'Sent',
          icon: Mail,
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          textColor: 'text-blue-700'
        };
      case 'overdue':
        return {
          gradient: 'from-red-500 to-rose-600',
          text: 'text-white',
          label: 'Overdue',
          icon: AlertCircle,
          bg: 'bg-red-50',
          border: 'border-red-200',
          textColor: 'text-red-700'
        };
      case 'canceled':
        return {
          gradient: 'from-gray-400 to-gray-500',
          text: 'text-white',
          label: 'Canceled',
          icon: AlertCircle,
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          textColor: 'text-gray-600'
        };
      default:
        return {
          gradient: 'from-amber-500 to-orange-600',
          text: 'text-white',
          label: 'Draft',
          icon: Clock,
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          textColor: 'text-amber-700'
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 sm:h-8 sm:w-8 text-indigo-600 animate-pulse" />
          </div>
          <p className="mt-4 sm:mt-6 text-gray-700 font-semibold text-base sm:text-lg">Loading invoice...</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Powered by SmartCFO</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-6 sm:p-8 text-center border border-gray-100">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 text-red-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">Invoice Not Available</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8 leading-relaxed">{error || 'This invoice could not be found or has been removed.'}</p>
            <button
              onClick={() => window.close()}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm sm:text-base font-semibold rounded-xl hover:shadow-lg hover:shadow-indigo-500/50 transition-all transform hover:scale-105"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    );
  }

  const daysUntilDue = differenceInDays(parseISO(invoice.due_date), new Date());
  const isOverdue = daysUntilDue < 0 && invoice.status !== 'paid';
  const statusConfig = getStatusConfig(invoice.status);
  const StatusIcon = statusConfig.icon;
  const companyName = profile?.company_name || invoiceSettings?.company_name || 'Company';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Smart Action Bar */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-gray-200/50 shadow-sm no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 leading-none">Invoice</p>
                  <p className="text-sm font-bold text-gray-900">#{invoice.invoice_number}</p>
                </div>
              </div>
              <span className="sm:hidden text-sm font-bold text-gray-900">#{invoice.invoice_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span className="hidden sm:inline">Generating...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Download PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SmartCFO Top Brand Bar */}
      <div className="bg-gradient-to-r from-white via-indigo-50/30 to-purple-50/30 border-b border-indigo-100/50 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 sm:py-3.5 gap-2 sm:gap-4">
            {/* Left - Branding */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg blur-sm opacity-30"></div>
                  
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 font-medium">Powered by</span>
                    <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 bg-clip-text text-transparent tracking-tight">
                      SmartCFO
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Trust Indicators */}
            <div className="flex items-center gap-3 sm:gap-4 pl-10 sm:pl-0">
              <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200/50">
                <Shield className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs font-semibold text-green-700">Secure Payment</span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200/50">
                <Zap className="h-3.5 w-3.5 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-700">Smart Invoicing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse shadow-sm shadow-green-500/50"></div>
                <span className="text-xs font-medium text-gray-600 hidden lg:inline">Professional</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">

        {/* Smart Status Alert */}
        {isOverdue && (
          <div className="mb-4 sm:mb-6 animate-slideDown">
            <div className="relative overflow-hidden bg-gradient-to-r from-red-500 via-red-600 to-rose-600 rounded-xl sm:rounded-2xl shadow-xl">
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="relative p-4 sm:p-5 lg:p-6 flex items-start gap-3 sm:gap-4 text-white">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-base sm:text-lg">Payment Overdue</h3>
                    <span className="px-2 py-0.5 bg-white/20 rounded-md text-xs font-semibold">
                      {Math.abs(daysUntilDue)} days
                    </span>
                  </div>
                  <p className="text-white/90 text-xs sm:text-sm">
                    This invoice is past its due date. Please arrange payment to avoid late fees.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Invoice Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl border border-gray-200/50 overflow-hidden">

          {/* Company Header */}
          <div className="px-6 sm:px-8 lg:px-12 py-8 sm:py-10 lg:py-12 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">

              {/* Company Branding */}
              <div className="flex-1">
                {profile?.company_logo || invoiceSettings?.company_logo ? (
                  <img
                    src={profile?.company_logo || invoiceSettings?.company_logo}
                    alt={companyName}
                    className="h-8 sm:h-10 lg:h-12 mb-4 sm:mb-6 object-contain max-w-full"
                  />
                ) : (
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 sm:mb-6 tracking-tight break-words">{companyName}</h1>
                )}

                <div className="space-y-1.5 text-sm text-gray-600">
                  {(profile?.company_address || invoiceSettings?.company_address) && (
                    <p className="whitespace-pre-line leading-relaxed">
                      {profile?.company_address || invoiceSettings?.company_address}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    {(profile?.email || invoiceSettings?.company_email) && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                        <span>{profile?.email || invoiceSettings?.company_email}</span>
                      </div>
                    )}
                    {(profile?.phone || invoiceSettings?.company_phone) && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        <span>{profile?.phone || invoiceSettings?.company_phone}</span>
                      </div>
                    )}
                  </div>
                  {taxRegistrationNumber && taxFeatures?.requiresRegistrationNumber && (
                    <p className="pt-1 text-xs text-gray-500">
                      {taxFeatures.registrationNumberLabel}: {taxRegistrationNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Invoice Details Card */}
              <div className="lg:min-w-[320px]">
                <div className="bg-gradient-to-br from-gray-50 to-indigo-50/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-gray-200/50 space-y-4 sm:space-y-5">

                  {/* Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</span>
                    <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r ${statusConfig.gradient} ${statusConfig.text} shadow-lg font-semibold text-xs sm:text-sm`}>
                      <StatusIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      {statusConfig.label}
                    </div>
                  </div>

                  {/* Invoice Number */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Invoice Number</p>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 break-all">{invoice.invoice_number}</p>
                  </div>

                  {/* Dates Grid */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <p className="text-xs text-gray-500 font-medium">Issued</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {format(parseISO(invoice.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <p className="text-xs text-gray-500 font-medium">Due</p>
                      </div>
                      <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                        {format(parseISO(invoice.due_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>

                  {/* Days Until Due */}
                  {!isOverdue && invoice.status !== 'paid' && daysUntilDue >= 0 && (
                    <div className="pt-2">
                      <div className="bg-white rounded-lg p-3 border border-indigo-200">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Due in</span>
                          <span className="font-bold text-indigo-600">{daysUntilDue} days</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bill To & Amount Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 px-6 sm:px-8 lg:px-12 py-8 sm:py-10 bg-gradient-to-br from-gray-50/30 to-transparent">

            {/* Bill To Card */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide">Bill To</h3>
              </div>
              {invoice.client ? (
                <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-gray-200 shadow-sm">
                  <p className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 mb-2 break-words">{invoice.client.name}</p>
                  {invoice.client.company_name && (
                    <p className="text-sm text-gray-600 font-medium mb-3">{invoice.client.company_name}</p>
                  )}
                  <div className="space-y-1.5 text-sm text-gray-600 pt-3 border-t border-gray-100">
                    {invoice.client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="break-all">{invoice.client.email}</span>
                      </div>
                    )}
                    {invoice.client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span>{invoice.client.phone}</span>
                      </div>
                    )}
                    {invoice.client.address && (
                      <div className="flex items-start gap-2 pt-2">
                        <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="whitespace-pre-line">{invoice.client.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No client information</p>
              )}
            </div>

            {/* Amount Due Card */}
            <div>
              <div className="flex items-center gap-2 mb-4 lg:justify-end">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide">Amount Due</h3>
              </div>
              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8 shadow-xl sm:shadow-2xl border border-indigo-500/20">
                <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-white/5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-32 sm:h-32 bg-purple-500/20 rounded-full blur-2xl"></div>
                <div className="relative">
                  <p className="text-indigo-200 text-xs sm:text-sm font-medium mb-2">Total Amount</p>
                  <p className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-2 sm:mb-3 tracking-tight break-words">
                    {formatCurrency(invoice.total, invoice.currency || baseCurrency)}
                  </p>
                  {invoice.currency && invoice.currency !== baseCurrency && invoice.base_amount && (
                    <p className="text-indigo-200 text-xs sm:text-sm">
                      ≈ {formatCurrency(invoice.base_amount, baseCurrency)} {baseCurrency}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="px-6 sm:px-8 lg:px-12 py-8 sm:py-10">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide">Items & Services</h3>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Rate
                    </th>
                    {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown && (
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {taxLabel}
                      </th>
                    )}
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {invoice.items?.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {item.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">
                        {formatCurrency(item.rate, invoice.currency || baseCurrency)}
                      </td>
                      {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown && (
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">
                          {item.tax_rate || 0}%
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-900 font-bold text-right">
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

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {invoice.items?.map((item, index) => (
                <div key={item.id || index} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <p className="font-bold text-gray-900 mb-3 text-base">{item.description}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 block text-xs mb-1">Quantity</span>
                      <span className="font-semibold text-gray-900">{item.quantity}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 block text-xs mb-1">Rate</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(item.rate, invoice.currency || baseCurrency)}
                      </span>
                    </div>
                    {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown && (
                      <div>
                        <span className="text-gray-500 block text-xs mb-1">{taxLabel}</span>
                        <span className="font-semibold text-gray-900">{item.tax_rate || 0}%</span>
                      </div>
                    )}
                    <div className={`text-right ${userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown ? '' : 'col-span-2 pt-2 border-t border-gray-200'}`}>
                      <span className="text-gray-500 block text-xs mb-1">Amount</span>
                      <span className="font-bold text-gray-900 text-base">
                        {formatCurrency(
                          userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown
                            ? (item.gross_amount || item.amount)
                            : item.amount,
                          invoice.currency || baseCurrency
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 sm:mt-8 flex justify-end">
              <div className="w-full sm:w-96 bg-gradient-to-br from-gray-50 to-indigo-50/30 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-gray-200 shadow-sm space-y-2.5 sm:space-y-3">
                <div className="flex justify-between items-center gap-4 text-xs sm:text-sm">
                  <span className="text-gray-600 font-medium">
                    {userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown ? 'Net total' : 'Subtotal'}
                  </span>
                  <span className="font-semibold text-gray-900 break-words text-right">
                    {formatCurrency(invoice.subtotal, invoice.currency || baseCurrency)}
                  </span>
                </div>

                {invoice.tax_rate > 0 && (
                  <div className="flex justify-between items-center gap-4 text-xs sm:text-sm">
                    <span className="text-gray-600 font-medium">{taxLabel} ({invoice.tax_rate}%)</span>
                    <span className="font-semibold text-gray-900 break-words text-right">
                      {formatCurrency(invoice.tax_amount, invoice.currency || baseCurrency)}
                    </span>
                  </div>
                )}

                <div className="pt-2 sm:pt-3 border-t-2 border-gray-300 flex justify-between items-baseline gap-4">
                  <span className="text-sm sm:text-base font-bold text-gray-900">Total Due</span>
                  <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent break-words text-right">
                    {formatCurrency(invoice.total, invoice.currency || baseCurrency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          {invoice.status !== 'paid' && (
            <div className="px-6 sm:px-8 lg:px-12 py-6 sm:py-8 lg:py-10 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-transparent border-t border-gray-200">
              <div className="max-w-2xl mx-auto">
                <PublicInvoicePayButton invoice={invoice} />

                {(invoiceSettings?.bank_name || invoiceSettings?.paypal_email) && (
                  <div className="mt-4 sm:mt-6">
                    <button
                      onClick={() => setShowPaymentInfo(!showPaymentInfo)}
                      className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors group"
                    >
                      <span>Alternative payment methods</span>
                      <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-all duration-300 ${showPaymentInfo ? 'rotate-180' : ''}`} />
                      <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    </button>

                    {showPaymentInfo && (
                      <div className="mt-3 sm:mt-4 bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm space-y-3 sm:space-y-4 text-xs sm:text-sm animate-slideDown">
                        {invoiceSettings.bank_name && (
                          <div>
                            <p className="font-bold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600" />
                              Bank Transfer
                            </p>
                            <div className="space-y-2 text-gray-600 pl-5 sm:pl-6">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-1.5 border-b border-gray-100">
                                <span className="text-gray-500">Bank name</span>
                                <span className="font-semibold text-gray-900 break-words">{invoiceSettings.bank_name}</span>
                              </div>
                              {invoiceSettings.account_number && (
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-1.5 border-b border-gray-100">
                                  <span className="text-gray-500">Account</span>
                                  <span className="font-semibold text-gray-900 font-mono text-xs break-all">{invoiceSettings.account_number}</span>
                                </div>
                              )}
                              {invoiceSettings.routing_number && (
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-1.5">
                                  <span className="text-gray-500">Routing</span>
                                  <span className="font-semibold text-gray-900 font-mono text-xs break-all">{invoiceSettings.routing_number}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {invoiceSettings.paypal_email && (
                          <div className={invoiceSettings.bank_name ? 'pt-3 sm:pt-4 border-t border-gray-200' : ''}>
                            <p className="font-bold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600" />
                              PayPal
                            </p>
                            <p className="text-gray-600 pl-5 sm:pl-6 font-mono text-xs break-all">{invoiceSettings.paypal_email}</p>
                          </div>
                        )}

                        {invoiceSettings?.payment_instructions && (
                          <div className="pt-3 sm:pt-4 border-t border-gray-200">
                            <p className="text-gray-600 leading-relaxed break-words">{invoiceSettings.payment_instructions}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="px-6 sm:px-8 lg:px-12 py-6 sm:py-8 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide">Notes</h3>
              </div>
              <div className="bg-blue-50/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-blue-200/50">
                <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-line leading-relaxed break-words">{invoice.notes}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 sm:px-8 lg:px-12 py-4 sm:py-6 bg-gradient-to-r from-gray-50 to-gray-100/50 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <p className="text-xs text-gray-600 break-words">{invoiceSettings?.invoice_footer || 'Thank you for your business!'}</p>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-500 font-mono break-all">ID: {invoice.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Simple Footer */}
        <div className="mt-8 sm:mt-12 text-center no-print">
          <div className="inline-flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-xs text-gray-500 py-4 px-6">
            {qrCodeUrl && (
              <div className="inline-block">
                <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-gray-200" />
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <span>Invoice generated by SmartCFO</span>
              <div className="hidden sm:block w-px h-3 bg-gray-300"></div>
              <span className="text-gray-400">Secure & Professional</span>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 15mm; }
          body { margin: 0; padding: 0; }
          .hidden.md\\:block { display: block !important; }
          .md\\:hidden { display: none !important; }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};
