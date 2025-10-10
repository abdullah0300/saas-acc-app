import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Simple HTML sanitization function for PDFs
function sanitizeHTMLForPDF(html) {
  if (!html || typeof html !== 'string') return html;
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>/gi, '')
    .replace(/<object\b[^>]*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<form\b[^>]*>/gi, '')
    .replace(/<input\b[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/\0/g, '')
    .replace(/[\r\n\0\x08\x0B\x0C]/g, ' ');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log('PDF Generation Started - Enhanced Invoice Template v2 (with Payment Methods)');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { invoiceId } = await req.json();
    console.log('Invoice ID:', invoiceId);

    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    // Get environment variables
    const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('Initializing Supabase client...');

    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      SUPABASE_URL || '',
      SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Fetching invoice data...');

    // Fetch invoice with all related data
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select(`
        *,
        client:clients(*),
        items:invoice_items(*)
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      console.error('Invoice fetch error:', invoiceError);
      throw new Error('Invoice not found');
    }

    console.log('Invoice fetched:', invoice.invoice_number);

    // Fetch user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', invoice.user_id)
      .single();

    console.log('Profile fetched');

    // Fetch invoice settings
    const { data: settings } = await supabaseClient
      .from('invoice_settings')
      .select('*')
      .eq('user_id', invoice.user_id)
      .single();

    console.log('Invoice settings fetched');

    // Fetch user settings for country, currency, and tax config
    const { data: userSettings } = await supabaseClient
      .from('user_settings')
      .select('*')
      .eq('user_id', invoice.user_id)
      .single();

    console.log('User settings fetched');

    // 🆕 Fetch payment methods (NEW SYSTEM)
    const { data: paymentMethods } = await supabaseClient
      .from('payment_methods')
      .select('*')
      .eq('user_id', invoice.user_id)
      .eq('is_enabled', true)
      .order('display_order', { ascending: true });

    console.log('Payment methods fetched:', paymentMethods?.length || 0);

    // Generate HTML with all settings including new payment methods
    const rawHtml = generateInvoiceHTML(
      invoice,
      profile,
      settings,
      userSettings,
      paymentMethods || []
    );

    // Sanitize HTML
    const html = sanitizeHTMLForPDF(rawHtml);
    console.log('HTML generated, length:', html.length);

    // Browserless URL
    const browserlessUrl = BROWSERLESS_API_KEY
      ? `https://production-sfo.browserless.io/pdf?token=${BROWSERLESS_API_KEY}`
      : 'https://production-sfo.browserless.io/pdf';

    console.log('Calling Browserless...');

    // Convert HTML to PDF
    const pdfResponse = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        html: html,
        options: {
          displayHeaderFooter: false,
          printBackground: true,
          format: 'A4',
          margin: {
            top: '0.4in',
            bottom: '0.4in',
            left: '0.4in',
            right: '0.4in'
          }
        }
      })
    });

    console.log('Browserless response status:', pdfResponse.status);

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('Browserless error:', errorText);
      throw new Error(`Failed to generate PDF: ${errorText}`);
    }

    const pdfData = await pdfResponse.arrayBuffer();
    console.log('PDF generated successfully, size:', pdfData.byteLength);

    return new Response(pdfData, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`
      }
    });
  } catch (error) {
    console.error('Error in PDF generation:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

function generateInvoiceHTML(invoice, profile, settings, userSettings, paymentMethods) {
  // Configuration and settings
  const primaryColor = settings?.invoice_color || '#4F46E5';
  const companyName = profile?.company_name || settings?.company_name || 'Your Company';
  const companyLogo = profile?.company_logo || settings?.company_logo || '';
  const companyAddress = profile?.company_address || settings?.company_address || '';
  const companyPhone = profile?.phone || settings?.company_phone || '';
  const companyEmail = profile?.email || settings?.company_email || '';
  const companyWebsite = settings?.company_website || '';

  // Country and tax configuration
  const country = userSettings?.country || 'US';
  const baseCurrency = userSettings?.base_currency || 'USD';
  const isUK = country === 'GB';
  const isEU = ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE'].includes(country);
  const requiresVATBreakdown = isUK || isEU;

  // Tax registration number
  const taxNumber = settings?.tax_number || userSettings?.tax_registration_number || '';

  // Determine tax label based on country
  const getTaxLabel = () => {
    switch (country) {
      case 'GB': return 'VAT';
      case 'CA': return 'GST/HST';
      case 'AU': return 'GST';
      case 'IN': return 'GST';
      case 'NZ': return 'GST';
      default: return 'Tax';
    }
  };
  const taxLabel = getTaxLabel();

  // Payment method icons/emojis
  const paymentIcons = {
    us_bank: '🇺🇸',
    uk_bank: '🇬🇧',
    sepa: '🇪🇺',
    international_wire: '🌍',
    canada_bank: '🇨🇦',
    australia_bank: '🇦🇺',
    india_bank: '🇮🇳',
    pakistan_bank: '🇵🇰',
    paypal: '💳',
    crypto: '₿',
    custom: '⚙️',
    local_bank: '🏦',
    ach: '🇺🇸',
    other: '💰'
  };

  // Currency formatting with proper symbols
  const formatMoney = (amount, currency = invoice.currency || 'USD') => {
    const num = parseFloat(amount) || 0;
    const symbols = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CNY': '¥',
      'INR': '₹', 'CAD': 'C$', 'AUD': 'A$', 'NZD': 'NZ$', 'CHF': 'CHF',
      'SEK': 'kr', 'NOK': 'kr', 'DKK': 'kr', 'PKR': 'Rs', 'AED': 'AED', 'SAR': 'SAR'
    };
    const symbol = symbols[currency] || currency + ' ';

    if (['EUR', 'SEK', 'NOK', 'DKK'].includes(currency)) {
      return `${num.toFixed(2)} ${symbol}`;
    } else if (currency === 'JPY') {
      return `${symbol}${Math.round(num).toLocaleString()}`;
    } else {
      return `${symbol}${num.toFixed(2)}`;
    }
  };

  // Format dates
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Get invoice status badge
  const getStatusBadge = (status) => {
    const statusStyles = {
      draft: { bg: '#f3f4f6', color: '#6b7280', text: 'DRAFT' },
      sent: { bg: '#dbeafe', color: '#3b82f6', text: 'SENT' },
      paid: { bg: '#d1fae5', color: '#10b981', text: 'PAID' },
      overdue: { bg: '#fee2e2', color: '#ef4444', text: 'OVERDUE' },
      canceled: { bg: '#fef3c7', color: '#f59e0b', text: 'CANCELED' }
    };
    const style = statusStyles[status] || statusStyles.draft;
    return `
      <span style="
        display: inline-block;
        padding: 6px 12px;
        background-color: ${style.bg};
        color: ${style.color};
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      ">${style.text}</span>
    `;
  };

  // SVG Icons
  const icons = {
    mapPin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    phone: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    mail: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
    globe: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    user: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
  };

  // Calculate totals and VAT breakdown
  let subtotal = 0;
  let totalTaxAmount = 0;
  let taxBreakdown = {};

  // Build items HTML
  let itemsHTML = '';
  if (invoice.items && invoice.items.length > 0) {
    invoice.items.forEach((item) => {
      if (requiresVATBreakdown && item.tax_rate !== undefined) {
        const netAmount = item.net_amount || item.amount || 0;
        const itemTaxRate = item.tax_rate || 0;
        const itemTaxAmount = item.tax_amount || (netAmount * itemTaxRate / 100);
        const grossAmount = item.gross_amount || (netAmount + itemTaxAmount);

        subtotal += netAmount;
        totalTaxAmount += itemTaxAmount;

        if (itemTaxRate > 0) {
          if (!taxBreakdown[itemTaxRate]) {
            taxBreakdown[itemTaxRate] = { net: 0, tax: 0 };
          }
          taxBreakdown[itemTaxRate].net += netAmount;
          taxBreakdown[itemTaxRate].tax += itemTaxAmount;
        }

        itemsHTML += `
          <tr>
            <td class="description-cell">${item.description || ''}</td>
            <td class="quantity-cell">${item.quantity || 0}</td>
            <td class="rate-cell">${formatMoney(item.rate)}</td>
            <td class="net-cell">${formatMoney(netAmount)}</td>
            <td class="vat-rate-cell">${itemTaxRate}%</td>
            <td class="vat-amount-cell">${formatMoney(itemTaxAmount)}</td>
            <td class="amount-cell">${formatMoney(grossAmount)}</td>
          </tr>
        `;
      } else {
        const amount = item.amount || (item.quantity * item.rate);
        subtotal += amount;
        itemsHTML += `
          <tr>
            <td class="description-cell">${item.description || ''}</td>
            <td class="quantity-cell">${item.quantity || 0}</td>
            <td class="rate-cell">${formatMoney(item.rate)}</td>
            <td class="amount-cell">${formatMoney(amount)}</td>
          </tr>
        `;
      }
    });
  }

  if (subtotal === 0) subtotal = invoice.subtotal || 0;
  if (totalTaxAmount === 0) totalTaxAmount = invoice.tax_amount || 0;
  const total = invoice.total || (subtotal + totalTaxAmount);

  // Build VAT summary HTML
  let vatSummaryHTML = '';
  if (requiresVATBreakdown && Object.keys(taxBreakdown).length > 0) {
    vatSummaryHTML = `
      <div class="vat-summary">
        <h3 class="vat-summary-title">${taxLabel} Summary</h3>
        <table class="vat-summary-table">
          ${Object.entries(taxBreakdown).map(([rate, amounts]) => `
            <tr>
              <td class="vat-desc">${taxLabel} @ ${rate}% on ${formatMoney(amounts.net)}</td>
              <td class="vat-amount">${formatMoney(amounts.tax)}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  }

  // 🆕 Payment information HTML - NEW SYSTEM with backward compatibility
  let paymentInfoHTML = '';

  if (paymentMethods && paymentMethods.length > 0) {
    // NEW PAYMENT METHODS SYSTEM - Only show PRIMARY method for clients
    const primaryMethod = paymentMethods.find(m => m.is_primary) || paymentMethods[0];

    paymentInfoHTML = `
      <div class="payment-info">
        <h3 class="section-title">PAYMENT INFORMATION</h3>
        <div class="payment-method primary-method">
          <div class="method-details">
            ${Object.entries(primaryMethod.fields || {}).map(([key, value]) => `
              <div class="method-field">
                <span class="field-label">${key.replace(/_/g, ' ').toUpperCase()}</span>
                <span class="field-value">${value}</span>
              </div>
            `).join('')}
          </div>
          ${primaryMethod.instructions ? `
            <div class="method-instructions">
              ${primaryMethod.instructions}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (settings?.bank_name || settings?.paypal_email || settings?.payment_instructions) {
    // FALLBACK TO OLD SYSTEM
    paymentInfoHTML = `
      <div class="payment-info">
        <h3 class="section-title">PAYMENT INFORMATION</h3>
        <div class="payment-details">
          ${settings?.bank_name ? `<div><strong>Bank:</strong> ${settings.bank_name}</div>` : ''}
          ${settings?.account_number ? `<div><strong>Account Number:</strong> ${settings.account_number}</div>` : ''}
          ${settings?.routing_number ? `<div><strong>Routing Number:</strong> ${settings.routing_number}</div>` : ''}
          ${settings?.paypal_email ? `<div><strong>PayPal Email:</strong> ${settings.paypal_email}</div>` : ''}
          ${settings?.payment_instructions ? `<div style="margin-top: 8px;">${settings.payment_instructions}</div>` : ''}
        </div>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #111827;
      background: white;
      line-height: 1.5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }

    /* Header Styles */
    .header-section {
      background: white;
      overflow: hidden;
      border-bottom: 2px solid ${primaryColor};
    }
    .header-content {
      position: relative;
      padding: 32px 32px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-info { flex: 1; }
    .company-logo {
      height: 64px;
      margin-bottom: 16px;
      object-fit: contain;
    }
    .company-details {
      margin-top: 8px;
      font-size: 14px;
      color: #6b7280;
    }
    .detail-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    /* Invoice Header */
    .invoice-header { text-align: right; }
    .invoice-title {
      font-size: 36px;
      font-weight: 300;
      color: #111827;
      margin-bottom: 8px;
    }
    .invoice-number {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 8px;
    }

    /* Client and Date Section */
    .invoice-details {
      display: flex;
      padding: 32px;
      gap: 48px;
    }
    .bill-to { flex: 1; }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 16px;
    }
    .client-info {
      background-color: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .client-name {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 8px;
    }

    /* Items Table */
    .items-section {
      padding: 0 32px 32px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .items-table thead {
      background-color: #f9fafb;
    }
    .items-table th {
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      border-bottom: 2px solid #e5e7eb;
    }
    .items-table td {
      padding: 16px;
      font-size: 14px;
      color: #111827;
      border-bottom: 1px solid #f3f4f6;
    }
    .quantity-cell, .vat-rate-cell { text-align: center; }
    .rate-cell, .net-cell, .vat-amount-cell, .amount-cell { text-align: right; }

    /* Totals Section */
    .totals-section {
      padding: 0 32px 32px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-box { width: 320px; }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 16px;
      font-size: 14px;
      border-radius: 6px;
      margin-bottom: 4px;
    }
    .total-row.grand-total {
      background-color: ${primaryColor};
      color: white;
      font-size: 18px;
      font-weight: 600;
      margin-top: 8px;
    }

    /* 🆕 NEW PAYMENT METHODS STYLES */
    .payment-info {
      margin: 24px 32px;
      padding: 24px;
      background: linear-gradient(135deg, ${primaryColor}08 0%, ${primaryColor}15 100%);
      border-radius: 8px;
      border-left: 4px solid ${primaryColor};
    }
    .payment-method {
      margin-bottom: 12px;
      padding: 0;
    }
    .payment-method:last-child {
      margin-bottom: 0;
    }
    .payment-method.primary-method .method-details {
      background-color: white;
      padding: 16px;
      border-radius: 6px;
      border: 1px solid ${primaryColor}40;
    }
    .method-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .method-field {
      display: flex;
      flex-direction: column;
    }
    .field-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .field-value {
      font-size: 14px;
      font-weight: 600;
      font-family: 'Courier New', monospace;
      color: #111827;
      background-color: white;
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    .method-instructions {
      margin-top: 12px;
      padding: 12px;
      background-color: white;
      border-left: 3px solid ${primaryColor};
      border-radius: 4px;
      font-size: 13px;
      color: #374151;
      line-height: 1.6;
    }

    /* OLD SYSTEM FALLBACK */
    .payment-details {
      font-size: 14px;
      line-height: 2;
      color: #111827;
    }
    .payment-details strong {
      display: inline-block;
      width: 140px;
      color: #6b7280;
      font-size: 12px;
      font-weight: 600;
    }
    .payment-details > div {
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .payment-details > div:last-child {
      border-bottom: none;
    }

    /* Footer */
    .footer {
      padding: 16px 32px;
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header Section -->
    <div class="header-section">
      <div class="header-content">
        <div class="company-info">
          ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" class="company-logo" />` : ''}
          <div class="company-details">
            ${companyAddress ? `<div class="detail-row">${icons.mapPin}<span>${companyAddress.replace(/\n/g, '<br>')}</span></div>` : ''}
            ${companyPhone ? `<div class="detail-row">${icons.phone}<span>${companyPhone}</span></div>` : ''}
            ${companyEmail ? `<div class="detail-row">${icons.mail}<span>${companyEmail}</span></div>` : ''}
          </div>
        </div>

        <div class="invoice-header">
          ${isUK ? '<div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">VAT INVOICE</div>' : ''}
          <h1 class="invoice-title">INVOICE</h1>
          <h2 class="invoice-number">${invoice.invoice_number}</h2>
          ${getStatusBadge(invoice.status)}
        </div>
      </div>
    </div>

    <!-- Invoice Details -->
    <div class="invoice-details">
      <div class="bill-to">
        <h3 class="section-title">BILL TO</h3>
        <div class="client-info">
          ${invoice.client ? `
            <div class="client-name">${invoice.client.name}</div>
            ${invoice.client.email || ''}
          ` : 'No client'}
        </div>
      </div>

      <div>
        <h3 class="section-title">INVOICE DETAILS</h3>
        <div>Date: ${formatDate(invoice.date)}</div>
        <div>Due: ${formatDate(invoice.due_date)}</div>
      </div>
    </div>

    <!-- Items -->
    <div class="items-section">
      <h3 class="section-title">INVOICE ITEMS</h3>
      <table class="items-table">
        <thead>
          <tr>
            <th>DESCRIPTION</th>
            <th>QTY</th>
            <th>RATE</th>
            ${requiresVATBreakdown ? `
              <th>NET</th>
              <th>${taxLabel} %</th>
              <th>${taxLabel}</th>
              <th>GROSS</th>
            ` : '<th>AMOUNT</th>'}
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </div>

    ${vatSummaryHTML}

    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-box">
        <div class="total-row" style="background: #f9fafb;">
          <span>Subtotal</span>
          <span>${formatMoney(subtotal)}</span>
        </div>
        ${totalTaxAmount > 0 ? `
          <div class="total-row" style="background: #fef3c7;">
            <span>${taxLabel}</span>
            <span>${formatMoney(totalTaxAmount)}</span>
          </div>
        ` : ''}
        <div class="total-row grand-total">
          <span>Total Due</span>
          <span>${formatMoney(total)}</span>
        </div>
      </div>
    </div>

    ${paymentInfoHTML}

    ${invoice.notes ? `
      <div style="padding: 24px 32px; border-top: 1px solid #e5e7eb;">
        <h3 class="section-title">NOTES</h3>
        <div style="font-size: 14px; color: #6b7280;">${invoice.notes.replace(/\n/g, '<br>')}</div>
      </div>
    ` : ''}

    <div class="footer">
      Thank you for your business!
    </div>
  </div>
</body>
</html>
  `;
}
