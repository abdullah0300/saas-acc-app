// supabase/functions/send-whatsapp-invoice/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Currency formatting helper
function formatCurrency(amount: number, currency = 'USD'): string {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    INR: '₹',
    PKR: 'Rs',
  };

  const symbol = currencySymbols[currency] || currency;

  switch (currency) {
    case 'EUR':
      return `${amount.toFixed(2)} ${symbol}`;
    case 'JPY':
      return `${symbol}${Math.round(amount).toLocaleString()}`;
    case 'INR':
    case 'PKR':
      return `${symbol} ${amount.toFixed(2)}`;
    default:
      return `${symbol}${amount.toFixed(2)}`;
  }
}

// Format phone number for WhatsApp (remove + and spaces)
function formatPhoneForWhatsApp(phone: string, countryCode?: string): string {
  let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

  if (cleanPhone.startsWith('+')) {
    return cleanPhone.substring(1);
  }

  if (countryCode) {
    const cleanCode = countryCode.replace('+', '');
    return `${cleanCode}${cleanPhone}`;
  }

  return cleanPhone;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:3000';

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error('WhatsApp credentials not configured');
    }

    // Parse request body
    const { invoiceId, recipientPhone, recipientCountryCode, templateName } = await req.json();

    if (!invoiceId || !recipientPhone) {
      throw new Error('Missing required fields: invoiceId and recipientPhone');
    }

    console.log('Processing WhatsApp message for invoice:', invoiceId);

    // Initialize Supabase client
    const supabase = createClient(
      SUPABASE_URL || '',
      SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Fetch invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    // Fetch client
    let client = null;
    if (invoice.client_id) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', invoice.client_id)
        .single();
      client = data;
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', invoice.user_id)
      .single();

    // Fetch invoice settings
    const { data: settings } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', invoice.user_id)
      .single();

    // Fetch user settings for currency
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('base_currency')
      .eq('user_id', invoice.user_id)
      .single();

    // Determine currency and company name
    const currency = invoice.currency || userSettings?.base_currency || 'USD';
    const companyName = profile?.company_name || settings?.company_name || 'SmartCFO';

    // Format amount
    const formattedAmount = formatCurrency(invoice.total, currency);

    // Format due date
    const dueDate = new Date(invoice.due_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Generate access token for public viewing
    const accessToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    // Store access token
    await supabase.from('invoice_access_tokens').insert({
      token: accessToken,
      invoice_id: invoiceId,
      expires_at: expiresAt.toISOString(),
    });

    // Generate public invoice URL
    const invoiceUrl = `${APP_URL}/invoice/public/${invoiceId}?token=${accessToken}`;

    // Format phone number
    const formattedPhone = formatPhoneForWhatsApp(
      recipientPhone,
      recipientCountryCode || client?.phone_country_code
    );

    console.log('Sending WhatsApp to:', formattedPhone);

    // Prepare template parameters
    const templateParams = [
      { type: 'text', text: client?.name || 'there' },           // {{1}} - Client name
      { type: 'text', text: invoice.invoice_number },            // {{2}} - Invoice number
      { type: 'text', text: companyName },                       // {{3}} - Company name
      { type: 'text', text: formattedAmount },                   // {{4}} - Amount
      { type: 'text', text: dueDate },                           // {{5}} - Due date
      { type: 'text', text: invoiceUrl },                        // {{6}} - Invoice URL
    ];

    // Send WhatsApp message using Cloud API
    const whatsappApiUrl = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const messagePayload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName || 'invoice_notification',  // Use your approved template name
        language: {
          code: 'en',  // Language code (en, es, fr, etc.)
        },
        components: [
          {
            type: 'body',
            parameters: templateParams,
          },
        ],
      },
    };

    console.log('Sending to WhatsApp API:', messagePayload);

    // Call WhatsApp Cloud API
    const whatsappResponse = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const whatsappData = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      console.error('WhatsApp API error:', whatsappData);
      throw new Error(whatsappData.error?.message || 'Failed to send WhatsApp message');
    }

    console.log('WhatsApp message sent successfully:', whatsappData);

    // Log WhatsApp send in database
    await supabase.from('whatsapp_logs').insert({
      invoice_id: invoiceId,
      recipient_phone: formattedPhone,
      message_id: whatsappData.messages?.[0]?.id,
      status: 'sent',
      template_name: templateName || 'invoice_notification',
      metadata: {
        currency,
        amount: invoice.total,
        whatsapp_response: whatsappData,
      },
    });

    // Update invoice
    await supabase
      .from('invoices')
      .update({
        last_sent_at: new Date().toISOString(),
        status: invoice.status === 'draft' ? 'sent' : invoice.status,
        sent_date: invoice.sent_date || new Date().toISOString(),
      })
      .eq('id', invoiceId);

    // Log activity
    await supabase.from('invoice_activities').insert({
      invoice_id: invoiceId,
      user_id: invoice.user_id,
      action: 'whatsapp_sent',
      details: {
        recipient_phone: formattedPhone,
        message_id: whatsappData.messages?.[0]?.id,
        currency,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: whatsappData,
        message: 'WhatsApp message sent successfully',
        invoice_url: invoiceUrl,
        message_id: whatsappData.messages?.[0]?.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
