// Backend API endpoint for Stripe Connect payment operations
// This should be deployed as a serverless function or Express.js API route

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../../services/supabaseClient';

// Initialize Stripe with secret key on backend only
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export interface PaymentInvoice {
  id: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerName?: string;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
  metadata: Record<string, any>;
}

export interface ConnectedAccount {
  providerAccountId: string;
  country: string;
  defaultCurrency: string;
  supportedCurrencies: string[];
}

// POST /api/stripe-connect/payment-sessions
export const createPaymentSession = async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { invoice, account }: { invoice: PaymentInvoice; account: ConnectedAccount } = req.body;

    if (!invoice || !account) {
      return res.status(400).json({ error: 'Missing invoice or account data' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: invoice.lineItems.map(item => ({
        price_data: {
          currency: invoice.currency,
          product_data: {
            name: item.description,
          },
          unit_amount: Math.round(item.amount * 100), // Convert to cents
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${process.env.SITE_URL}/invoice/public/${invoice.id}?payment=success`,
      cancel_url: `${process.env.SITE_URL}/invoice/public/${invoice.id}?payment=cancelled`,
      customer_email: invoice.customerEmail,
      metadata: {
        invoiceId: invoice.id,
        ...invoice.metadata,
      },
      payment_intent_data: {
        application_fee_amount: Math.round(invoice.amount * 0.01 * 100), // 1% platform fee
        metadata: {
          invoiceId: invoice.id,
        },
      },
    }, {
      stripeAccount: account.providerAccountId,
    });

    res.status(200).json({
      sessionId: session.id,
      paymentUrl: session.url!,
      expiresAt: new Date(session.expires_at * 1000),
    });

  } catch (error: any) {
    console.error('Error creating payment session:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
};

// GET /api/stripe-connect/payment-sessions/:sessionId/status
export const getPaymentStatus = async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.params;
    const { stripeAccount } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const retrieveOptions: any = {
      expand: ['payment_intent'],
    };

    // If checking a connected account's session, include the account
    if (stripeAccount) {
      retrieveOptions.stripeAccount = stripeAccount as string;
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, retrieveOptions);
    const paymentIntent = session.payment_intent as Stripe.PaymentIntent;

    let status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' = 'pending';
    if (paymentIntent.status === 'succeeded') status = 'succeeded';
    else if (paymentIntent.status === 'processing') status = 'processing';
    else if (paymentIntent.status === 'canceled') status = 'cancelled';
    else if (paymentIntent.status === 'requires_payment_method') status = 'failed';

    res.status(200).json({
      sessionId: session.id,
      status,
      amount: session.amount_total! / 100,
      currency: session.currency!,
      paymentIntentId: paymentIntent.id,
      failureReason: paymentIntent.last_payment_error?.message,
    });

  } catch (error: any) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
};

// POST /api/stripe-connect/invoices/:invoiceId/payment-session
export const createInvoicePaymentSession = async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { invoiceId } = req.params;
    const { providerName } = req.body;

    if (!invoiceId || !providerName) {
      return res.status(400).json({ error: 'Missing invoice ID or provider name' });
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, invoice_items(*), clients(*)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      console.error('Invoice error:', invoiceError);
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get user's payment account
    const { data: account, error: accountError } = await supabase
      .from('user_payment_accounts')
      .select('*')
      .eq('user_id', invoice.user_id)
      .eq('provider', providerName)
      .single();

    if (accountError || !account) {
      console.error('Account error:', accountError);
      return res.status(404).json({ error: 'Payment account not found for this provider' });
    }

    // Safely extract customer information
    const customerEmail = invoice.clients?.email || invoice.customer_email || 'customer@example.com';
    const customerName = invoice.clients?.name || invoice.customer_name || 'Customer';

    // Create payment session
    const paymentInvoice: PaymentInvoice = {
      id: invoice.id,
      amount: invoice.total,
      currency: invoice.currency,
      description: `Invoice #${invoice.invoice_number}`,
      customerEmail,
      customerName,
      lineItems: invoice.invoice_items?.map((item: any) => ({
        description: item.description || 'Item',
        amount: item.amount || 0,
        quantity: item.quantity || 1,
      })) || [],
      metadata: {
        userId: invoice.user_id,
      },
    };

    const connectedAccount: ConnectedAccount = {
      providerAccountId: account.provider_account_id,
      country: account.country,
      defaultCurrency: account.default_currency,
      supportedCurrencies: account.supported_currencies,
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: paymentInvoice.lineItems.map(item => ({
        price_data: {
          currency: paymentInvoice.currency,
          product_data: {
            name: item.description,
          },
          unit_amount: Math.round(item.amount * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${process.env.SITE_URL}/invoice/public/${paymentInvoice.id}?payment=success`,
      cancel_url: `${process.env.SITE_URL}/invoice/public/${paymentInvoice.id}?payment=cancelled`,
      customer_email: paymentInvoice.customerEmail,
      metadata: {
        invoiceId: paymentInvoice.id,
        ...paymentInvoice.metadata,
      },
      payment_intent_data: {
        application_fee_amount: Math.round(paymentInvoice.amount * 0.01 * 100), // 1% platform fee
        metadata: {
          invoiceId: paymentInvoice.id,
        },
      },
    }, {
      stripeAccount: connectedAccount.providerAccountId,
    });

    // Save transaction record
    await supabase
      .from('payment_transactions')
      .insert({
        invoice_id: invoiceId,
        provider: providerName,
        provider_session_id: session.id,
        amount: invoice.total,
        currency: invoice.currency,
        status: 'pending',
        customer_email: customerEmail,
        customer_name: customerName,
      });

    res.status(200).json({
      sessionId: session.id,
      paymentUrl: session.url!,
      expiresAt: new Date(session.expires_at * 1000),
    });

  } catch (error: any) {
    console.error('Error creating invoice payment session:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
};