import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Simple HTML sanitization function for PDFs
function sanitizeHTMLForPDF(html) {
  if (!html || typeof html !== 'string') return html;
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<iframe\b[^>]*>/gi, '').replace(/<object\b[^>]*>/gi, '').replace(/<embed\b[^>]*>/gi, '').replace(/<form\b[^>]*>/gi, '').replace(/<input\b[^>]*>/gi, '').replace(/javascript:/gi, '').replace(/on\w+\s*=/gi, '').replace(/\0/g, '').replace(/[\r\n\0\x08\x0B\x0C]/g, ' ');
}
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-invoice-token'
};
serve(async (req)=>{
  console.log('PDF Generation Started - Enhanced Invoice Template v2 (with Payment Methods)');
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
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
    const supabaseClient = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check for public access token
    const publicToken = req.headers.get('X-Invoice-Token');
    if (publicToken) {
      console.log('Public access token detected, validating...');

      // Validate the public access token
      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('invoice_access_tokens')
        .select('invoice_id, expires_at')
        .eq('token', publicToken)
        .eq('invoice_id', invoiceId)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('Invalid or expired access token');
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        throw new Error('Access token has expired');
      }

      console.log('Public access token validated successfully');
    }
    console.log('Fetching invoice data...');
    // Fetch invoice with all related data
    const { data: invoice, error: invoiceError } = await supabaseClient.from('invoices').select(`
        *,
        client:clients(*),
        items:invoice_items(*)
      `).eq('id', invoiceId).single();
    if (invoiceError) {
      console.error('Invoice fetch error:', invoiceError);
      throw new Error('Invoice not found');
    }
    console.log('Invoice fetched:', invoice.invoice_number);
    // Fetch user profile
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', invoice.user_id).single();
    console.log('Profile fetched');
    // Fetch invoice settings
    const { data: settings } = await supabaseClient.from('invoice_settings').select('*').eq('user_id', invoice.user_id).single();
    console.log('Invoice settings fetched');
    // Fetch user settings for country, currency, and tax config
    const { data: userSettings } = await supabaseClient.from('user_settings').select('*').eq('user_id', invoice.user_id).single();
    console.log('User settings fetched');
    // 🆕 Fetch payment methods (NEW SYSTEM)
    const { data: paymentMethods } = await supabaseClient.from('payment_methods').select('*').eq('user_id', invoice.user_id).eq('is_enabled', true).order('display_order', {
      ascending: true
    });
    console.log('Payment methods fetched:', paymentMethods?.length || 0);
    // Generate HTML with all settings including new payment methods
    const rawHtml = generateInvoiceHTML(invoice, profile, settings, userSettings, paymentMethods || []);
    // Sanitize HTML
    const html = sanitizeHTMLForPDF(rawHtml);
    console.log('HTML generated, length:', html.length);
    // Browserless URL
    const browserlessUrl = BROWSERLESS_API_KEY ? `https://production-sfo.browserless.io/pdf?token=${BROWSERLESS_API_KEY}` : 'https://production-sfo.browserless.io/pdf';
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
            top: '0.5in',
            bottom: '0.5in',
            left: '0.5in',
            right: '0.5in'
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
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
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
  const isEU = [
    'GB',
    'DE',
    'FR',
    'IT',
    'ES',
    'NL',
    'BE',
    'AT',
    'IE'
  ].includes(country);
  const requiresVATBreakdown = isUK || isEU;
  // Tax registration number
  const taxNumber = settings?.tax_number || userSettings?.tax_registration_number || '';
  // Determine tax label based on country
  const getTaxLabel = ()=>{
    switch(country){
      case 'GB':
        return 'VAT';
      case 'CA':
        return 'GST/HST';
      case 'AU':
        return 'GST';
      case 'IN':
        return 'GST';
      case 'NZ':
        return 'GST';
      default:
        return 'Tax';
    }
  };
  const taxLabel = getTaxLabel();
  // Currency formatting with proper symbols - UPDATED WITH SPACE
  const formatMoney = (amount, currency = invoice.currency || 'USD')=>{
    const num = parseFloat(amount) || 0;
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'INR': '₹',
      'CAD': 'C$',
      'AUD': 'A$',
      'NZD': 'NZ$',
      'CHF': 'CHF',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr',
      'PKR': 'Rs',
      'AED': 'AED',
      'SAR': 'SAR'
    };
    const symbol = symbols[currency] || currency + ' ';
    if ([
      'EUR',
      'SEK',
      'NOK',
      'DKK'
    ].includes(currency)) {
      return `${num.toFixed(2)} ${symbol}`;
    } else if (currency === 'JPY') {
      return `${symbol} ${Math.round(num).toLocaleString()}`;
    } else {
      return `${symbol} ${num.toFixed(2)}`;
    }
  };
  // Format dates
  const formatDate = (dateStr)=>{
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
  const getStatusBadge = (status)=>{
    const statusStyles = {
      draft: {
        bg: '#f3f4f6',
        color: '#6b7280',
        text: 'DRAFT'
      },
      sent: {
        bg: '#dbeafe',
        color: '#3b82f6',
        text: 'SENT'
      },
      paid: {
        bg: '#d1fae5',
        color: '#10b981',
        text: 'PAID'
      },
      overdue: {
        bg: '#fee2e2',
        color: '#ef4444',
        text: 'OVERDUE'
      },
      canceled: {
        bg: '#fef3c7',
        color: '#f59e0b',
        text: 'CANCELED'
      }
    };
    const style = statusStyles[status] || statusStyles.draft;
    return `
      <span style="
        display: inline-block;
        padding: 5px 10px;
        background-color: ${style.bg};
        color: ${style.color};
        font-size: 11px;
        font-weight: 600;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      ">${style.text}</span>
    `;
  };
  // SVG Icons
  const icons = {
    mapPin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    phone: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    mail: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
    globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    shield: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    user: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
  };
  // Calculate totals and VAT breakdown
  let subtotal = 0;
  let totalTaxAmount = 0;
  let taxBreakdown = {};
  // Build items HTML
  let itemsHTML = '';
  if (invoice.items && invoice.items.length > 0) {
    invoice.items.forEach((item)=>{
      if (requiresVATBreakdown && item.tax_rate !== undefined) {
        const netAmount = item.net_amount || item.amount || 0;
        const itemTaxRate = item.tax_rate || 0;
        const itemTaxAmount = item.tax_amount || netAmount * itemTaxRate / 100;
        const grossAmount = item.gross_amount || netAmount + itemTaxAmount;
        subtotal += netAmount;
        totalTaxAmount += itemTaxAmount;
        if (itemTaxRate > 0) {
          if (!taxBreakdown[itemTaxRate]) {
            taxBreakdown[itemTaxRate] = {
              net: 0,
              tax: 0
            };
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
        const amount = item.amount || item.quantity * item.rate;
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
  const total = invoice.total || subtotal + totalTaxAmount;
  // Build VAT summary HTML
  let vatSummaryHTML = '';
  if (requiresVATBreakdown && Object.keys(taxBreakdown).length > 0) {
    vatSummaryHTML = `
      <div class="vat-summary">
        <h3 class="vat-summary-title">${taxLabel} Summary</h3>
        <table class="vat-summary-table">
          ${Object.entries(taxBreakdown).map(([rate, amounts])=>`
            <tr>
              <td class="vat-desc">${taxLabel} @ ${rate}% on ${formatMoney(amounts.net)}</td>
              <td class="vat-amount">${formatMoney(amounts.tax)}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  }
  // Payment schedule HTML if exists
  let paymentScheduleHTML = '';
  if (invoice.payment_schedule?.enabled && invoice.payment_schedule.splits?.length > 0) {
    const splits = invoice.payment_schedule.splits;
    paymentScheduleHTML = `
      <div class="payment-schedule">
        <h3 class="schedule-title">Payment Schedule</h3>
        <table class="schedule-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${splits.map((split, index)=>{
      const splitAmount = split.type === 'percentage' ? invoice.total * split.value / 100 : split.value;
      return `
                <tr>
                  <td>${split.description || `Installment ${index + 1}`}</td>
                  <td>${formatDate(split.due_date)}</td>
                  <td>${formatMoney(splitAmount)}</td>
                  <td><span class="status-${split.status}">${(split.status || 'pending').toUpperCase()}</span></td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  // 🆕 Payment information HTML - NEW SYSTEM with standardized bank details order
  let paymentInfoHTML = '';
  if (paymentMethods && paymentMethods.length > 0) {
    // NEW PAYMENT METHODS SYSTEM - Only show PRIMARY method for clients
    const primaryMethod = paymentMethods.find((m)=>m.is_primary) || paymentMethods[0];
    // Define standard order for bank fields
    const bankFieldOrder = [
      'bank_name',
      'account_title',
      'account_holder',
      'account_number',
      'iban',
      'swift',
      'swift_code',
      'bic',
      'routing_number',
      'sort_code',
      'branch_code',
      'ifsc',
      'ibft'
    ];
    // Function to format field label
    const formatFieldLabel = (key)=>{
      const labelMap = {
        'bank_name': 'Bank Name',
        'account_title': 'Account Title',
        'account_holder': 'Account Holder',
        'account_number': 'Account Number',
        'iban': 'IBAN',
        'swift': 'SWIFT',
        'swift_code': 'SWIFT Code',
        'bic': 'BIC',
        'routing_number': 'Routing Number',
        'sort_code': 'Sort Code',
        'branch_code': 'Branch Code',
        'ifsc': 'IFSC',
        'ibft': 'IBFT'
      };
      return labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (l)=>l.toUpperCase());
    };
    // Sort fields according to standard order
    const sortedFields = [];
    const fields = primaryMethod.fields || {};
    // First add fields in standard order
    bankFieldOrder.forEach((key)=>{
      if (fields[key]) {
        sortedFields.push([
          key,
          fields[key]
        ]);
      }
    });
    // Then add any remaining fields not in standard order
    Object.entries(fields).forEach(([key, value])=>{
      if (!bankFieldOrder.includes(key)) {
        sortedFields.push([
          key,
          value
        ]);
      }
    });
    paymentInfoHTML = `
      <div class="payment-info">
        <h3 class="section-title">PAYMENT INFORMATION</h3>
        <div class="payment-method primary-method">
          ${primaryMethod.name ? `<div class="method-name">${primaryMethod.name}</div>` : ''}
          <div class="method-details">
            ${sortedFields.map(([key, value])=>{
      const fieldLabel = formatFieldLabel(key);
      return `
                <div class="method-field">
                  <strong>${fieldLabel}:</strong> ${value}
                </div>
              `;
    }).join('')}
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
    // FALLBACK TO OLD SYSTEM with standardized order
    const oldSystemFields = [];
    // Add fields in standard order for old system
    if (settings?.bank_name) oldSystemFields.push([
      'Bank Name',
      settings.bank_name
    ]);
    if (settings?.account_title) oldSystemFields.push([
      'Account Title',
      settings.account_title
    ]);
    if (settings?.account_holder) oldSystemFields.push([
      'Account Holder',
      settings.account_holder
    ]);
    if (settings?.account_number) oldSystemFields.push([
      'Account Number',
      settings.account_number
    ]);
    if (settings?.iban) oldSystemFields.push([
      'IBAN',
      settings.iban
    ]);
    if (settings?.swift || settings?.swift_code) oldSystemFields.push([
      'SWIFT',
      settings.swift || settings.swift_code
    ]);
    if (settings?.routing_number) oldSystemFields.push([
      'Routing Number',
      settings.routing_number
    ]);
    if (settings?.ibft) oldSystemFields.push([
      'IBFT',
      settings.ibft
    ]);
    if (settings?.paypal_email) oldSystemFields.push([
      'PayPal',
      settings.paypal_email
    ]);
    paymentInfoHTML = `
      <div class="payment-info">
        <h3 class="section-title">PAYMENT INFORMATION</h3>
        <div class="payment-details">
          ${oldSystemFields.map(([label, value])=>`<div><strong>${label}:</strong> ${value}</div>`).join('')}
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
      color: #1a1a1a;
      background: white;
      line-height: 1.4;
      font-size: 13px;
    }
    .container { 
      max-width: 800px; 
      margin: 0 auto; 
      background: white;
    }
    
    /* Professional Header Styles */
    .header-section {
      background: white;
      padding: 24px 0 20px;
      border-bottom: 2px solid ${primaryColor};
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-info { 
      flex: 1;
    }
    .company-logo {
      height: 50px;
      margin-bottom: 12px;
      object-fit: contain;
    }
    .company-logo-placeholder {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .logo-circle {
      width: 40px;
      height: 40px;
      background-color: ${primaryColor};
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      font-size: 18px;
      font-weight: bold;
    }
    .company-name {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: -0.5px;
    }
    .company-details {
      margin-top: 6px;
      font-size: 12px;
      color: #6b7280;
      line-height: 1.5;
    }
    .detail-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
    }
    
    /* Professional Invoice Header */
    .invoice-header { 
      text-align: right;
    }
    .vat-invoice-label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .invoice-title {
      font-size: 28px;
      font-weight: 300;
      color: #1a1a1a;
      margin-bottom: 6px;
      letter-spacing: -1px;
    }
    .invoice-number {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    
    /* Professional Client and Date Section */
    .invoice-details {
      display: flex;
      padding: 24px 0;
      gap: 40px;
    }
    .bill-to { 
      flex: 1;
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .client-info {
      background-color: #fafafa;
      padding: 14px;
      border-radius: 6px;
      border-left: 3px solid ${primaryColor};
    }
    .client-name {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 6px;
    }
    .client-company {
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 4px;
    }
    .client-details {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.5;
    }
    .dates-info { 
      min-width: 220px;
    }
    .date-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12px;
      padding: 4px 0;
    }
    .date-label {
      color: #6b7280;
      font-weight: 500;
    }
    .date-value {
      color: #1a1a1a;
      font-weight: 600;
    }
    
    /* Professional Items Table */
    .items-section {
      padding: 0 0 20px;
    }
    .table-container {
      background-color: white;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .items-table thead {
      background-color: #f8f9fa;
    }
    .items-table th {
      padding: 10px 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      border-bottom: 2px solid #e5e7eb;
    }
    .items-table th:nth-child(2),
    .items-table th:nth-child(5) { 
      text-align: center; 
      width: 60px;
    }
    .items-table th:nth-child(3),
    .items-table th:nth-child(4),
    .items-table th:nth-child(6),
    .items-table th:last-child { 
      text-align: right;
      width: 90px;
    }
    
    .items-table td {
      padding: 12px;
      font-size: 12px;
      color: #1a1a1a;
      border-bottom: 1px solid #f3f4f6;
    }
    .items-table tbody tr:last-child td {
      border-bottom: none;
    }
    .items-table tbody tr:hover {
      background-color: #fafafa;
    }
    .description-cell {
      font-weight: 500;
    }
    .quantity-cell,
    .vat-rate-cell { 
      text-align: center; 
    }
    .rate-cell,
    .net-cell,
    .vat-amount-cell,
    .amount-cell { 
      text-align: right;
      font-weight: 500;
    }
    
    /* Compact VAT Summary */
    .vat-summary {
      margin: 12px 0;
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    .vat-summary-title {
      font-size: 11px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .vat-summary-table {
      width: 100%;
    }
    .vat-desc {
      font-size: 10px;
      color: #6b7280;
      padding: 2px 0;
    }
    .vat-amount {
      text-align: right;
      font-weight: 600;
      color: #1a1a1a;
      font-size: 11px;
    }
    
    /* Compact Payment Schedule */
    .payment-schedule {
      margin: 12px 0;
      padding: 10px;
      background-color: #fff8e1;
      border-radius: 6px;
      border: 1px solid #ffb300;
    }
    .schedule-title {
      font-size: 11px;
      font-weight: 600;
      color: #e65100;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .schedule-table {
      width: 100%;
      font-size: 10px;
    }
    .schedule-table th {
      text-align: left;
      padding: 4px 0;
      border-bottom: 1px solid #ffb300;
      color: #e65100;
      font-weight: 600;
      font-size: 10px;
    }
    .schedule-table td {
      padding: 4px 0;
      color: #5d4037;
      font-size: 10px;
    }
    .status-paid { color: #10b981; font-weight: 600; }
    .status-pending { color: #f59e0b; font-weight: 600; }
    .status-overdue { color: #ef4444; font-weight: 600; }
    
    /* Professional Totals Section */
    .totals-section {
      padding: 0 0 20px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-box {
      width: 300px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 14px;
      font-size: 13px;
      border-radius: 4px;
      margin-bottom: 3px;
    }
    .total-row.subtotal {
      background-color: #f8f9fa;
      color: #4b5563;
    }
    .total-row.tax {
      background-color: #fef3c7;
      color: #92400e;
    }
    .total-row.grand-total {
      background-color: ${primaryColor};
      color: white;
      font-size: 16px;
      font-weight: 700;
      margin-top: 6px;
      padding: 10px 14px;
    }
    .total-label { 
      font-weight: 500; 
    }
    .total-value { 
      font-weight: 600; 
    }
    
    /* Professional Payment Info */
    .payment-info {
      margin: 16px 0;
      padding: 0;
    }
    
    .payment-method {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      background: #fafafa;
    }
    
    .method-name {
      font-size: 13px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    
    .method-details {
      margin-top: 8px;
    }
    
    .method-field {
      font-size: 12px;
      padding: 4px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .method-field:last-child {
      border-bottom: none;
    }
    
    .method-field strong {
      color: #374151;
      font-weight: 600;
      display: inline-block;
      min-width: 120px;
    }
    
    .method-instructions {
      margin-top: 10px;
      padding: 8px 10px;
      background-color: white;
      border-left: 3px solid ${primaryColor};
      border-radius: 0 4px 4px 0;
      font-size: 11px;
      color: #4b5563;
      line-height: 1.5;
    }
    
    .payment-details {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      background: #fafafa;
    }
    
    .payment-details div {
      font-size: 12px;
      padding: 4px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .payment-details div:last-child {
      border-bottom: none;
    }
    
    .payment-details strong {
      color: #374151;
      font-weight: 600;
      display: inline-block;
      min-width: 120px;
    }
    
    /* Compact Notes Section */
    .notes-section {
      padding: 12px 0;
      border-top: 1px solid #e5e7eb;
    }
    .notes-title {
      font-size: 10px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .notes-text {
      font-size: 11px;
      color: #6b7280;
      white-space: pre-line;
      line-height: 1.3;
    }
    
    /* Compact Footer */
    .footer {
      padding: 8px 0;
      background-color: #f8f9fa;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #6b7280;
    }
    
    /* Print optimization */
    @media print {
      body { 
        font-size: 11px; 
      }
      .table-container {
        box-shadow: none;
      }
      .items-table tbody tr:hover {
        background-color: transparent;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Professional Header Section -->
    <div class="header-section">
      <div class="header-content">
        <!-- Company Info -->
        <div class="company-info">
          ${companyLogo ? `
            <img src="${companyLogo}" alt="${companyName}" class="company-logo" />
          ` : `
            <div class="company-logo-placeholder">
              <div class="logo-circle">${companyName.charAt(0).toUpperCase()}</div>
              <div class="company-name">${companyName}</div>
            </div>
          `}
          
          <div class="company-details">
            ${companyAddress ? `
              <div class="detail-row">
                ${icons.mapPin}
                <span>${companyAddress.replace(/\n/g, '<br>')}</span>
              </div>
            ` : ''}
            ${companyPhone ? `
              <div class="detail-row">
                ${icons.phone}
                <span>${companyPhone}</span>
              </div>
            ` : ''}
            ${companyEmail ? `
              <div class="detail-row">
                ${icons.mail}
                <span>${companyEmail}</span>
              </div>
            ` : ''}
            ${companyWebsite ? `
              <div class="detail-row">
                ${icons.globe}
                <span>${companyWebsite}</span>
              </div>
            ` : ''}
            ${taxNumber ? `
              <div class="detail-row">
                ${icons.shield}
                <span><strong>${isUK ? 'VAT Number' : isEU ? 'VAT ID' : 'Tax ID'}:</strong> ${taxNumber}</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Invoice Header -->
        <div class="invoice-header">
          ${isUK ? '<div class="vat-invoice-label">VAT INVOICE</div>' : ''}
          <h1 class="invoice-title">INVOICE</h1>
          <h2 class="invoice-number">${invoice.invoice_number}</h2>
          ${getStatusBadge(invoice.status)}
        </div>
      </div>
    </div>
    
    <!-- Professional Invoice Details -->
    <div class="invoice-details">
      <!-- Bill To -->
      <div class="bill-to">
        <h3 class="section-title">
          ${icons.user}
          BILL TO
        </h3>
        <div class="client-info">
          ${invoice.client ? `
            <div class="client-name">${invoice.client.name}</div>
            ${invoice.client.company_name ? `<div class="client-company">${invoice.client.company_name}</div>` : ''}
            <div class="client-details">
              ${invoice.client.email ? `${invoice.client.email}<br>` : ''}
              ${invoice.client.phone ? `${invoice.client.phone}<br>` : ''}
              ${invoice.client.address ? invoice.client.address.replace(/\n/g, '<br>') : ''}
            </div>
          ` : `
            <div class="client-name">No client selected</div>
          `}
        </div>
      </div>
      
      <!-- Dates and Details -->
      <div class="dates-info">
        <h3 class="section-title">
          ${icons.calendar}
          INVOICE DETAILS
        </h3>
        <div class="date-row">
          <span class="date-label">Invoice Date:</span>
          <span class="date-value">${formatDate(invoice.date)}</span>
        </div>
        <div class="date-row">
          <span class="date-label">Due Date:</span>
          <span class="date-value">${formatDate(invoice.due_date)}</span>
        </div>
        ${settings?.payment_terms ? `
          <div class="date-row">
            <span class="date-label">Payment Terms:</span>
            <span class="date-value">Net ${settings.payment_terms} days</span>
          </div>
        ` : ''}
        ${invoice.currency && invoice.currency !== baseCurrency ? `
          <div class="date-row">
            <span class="date-label">Currency:</span>
            <span class="date-value">${invoice.currency}</span>
          </div>
        ` : ''}
      </div>
    </div>
    
    <!-- Professional Items Table -->
    <div class="items-section">
      <h3 class="section-title" style="margin-bottom: 12px;">INVOICE ITEMS</h3>
      <div class="table-container">
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
    </div>
    
    ${vatSummaryHTML}
    ${paymentScheduleHTML}
    
    <!-- Professional Totals -->
    <div class="totals-section">
      <div class="totals-box">
        <div class="total-row subtotal">
          <span class="total-label">${requiresVATBreakdown ? 'Net Total' : 'Subtotal'}</span>
          <span class="total-value">${formatMoney(subtotal)}</span>
        </div>
        
        ${!requiresVATBreakdown && invoice.tax_rate > 0 ? `
          <div class="total-row tax">
            <span class="total-label">${taxLabel} (${invoice.tax_rate}%)</span>
            <span class="total-value">${formatMoney(totalTaxAmount)}</span>
          </div>
        ` : ''}
        
        ${requiresVATBreakdown && totalTaxAmount > 0 ? `
          <div class="total-row tax">
            <span class="total-label">Total ${taxLabel}</span>
            <span class="total-value">${formatMoney(totalTaxAmount)}</span>
          </div>
        ` : ''}
        
        <div class="total-row grand-total">
          <span class="total-label">Total Due</span>
          <span class="total-value">${formatMoney(total)}</span>
        </div>
        
        ${invoice.amount_paid && invoice.amount_paid > 0 ? `
          <div class="total-row" style="background-color: #d1fae5; color: #065f46;">
            <span class="total-label">Paid to Date</span>
            <span class="total-value">-${formatMoney(invoice.amount_paid)}</span>
          </div>
          <div class="total-row" style="background-color: ${invoice.balance_due > 0 ? '#fee2e2' : '#d1fae5'}; color: ${invoice.balance_due > 0 ? '#991b1b' : '#065f46'}; font-weight: 600;">
            <span class="total-label">Balance Due</span>
            <span class="total-value">${formatMoney(invoice.balance_due || 0)}</span>
          </div>
        ` : ''}
      </div>
    </div>
    
    ${paymentInfoHTML}
    
    <!-- Professional Notes & Footer -->
    ${invoice.notes || settings?.invoice_notes || settings?.invoice_footer ? `
      <div class="notes-section">
        ${invoice.notes ? `
          <div>
            <div class="notes-title">Notes</div>
            <div class="notes-text">${invoice.notes.replace(/\n/g, '<br>')}</div>
          </div>
        ` : ''}
        ${settings?.invoice_notes && !invoice.notes ? `
          <div>
            <div class="notes-title">Notes</div>
            <div class="notes-text">${settings.invoice_notes.replace(/\n/g, '<br>')}</div>
          </div>
        ` : ''}
        ${settings?.invoice_footer ? `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
            <div class="notes-text" style="text-align: center;">${settings.invoice_footer.replace(/\n/g, '<br>')}</div>
          </div>
        ` : ''}
      </div>
    ` : ''}
    
    <!-- Professional Footer -->
    <div class="footer">
      Thank you for your business!
    </div>
  </div>
</body>
</html>
  `;
}
