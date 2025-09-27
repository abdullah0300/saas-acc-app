// Secure backend webhook handler for Stripe Connect events
// This should ONLY run on your backend server, never in the frontend

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../../services/supabaseClient';

// Initialize Stripe with secret key - BACKEND ONLY
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

// Middleware to parse raw body for webhook signature verification
// This is critical for webhook security
export const parseRawBody = (req: Request, res: Response, next: Function) => {
  if (req.originalUrl.includes('/webhooks/stripe')) {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      req.body = data;
      next();
    });
  } else {
    next();
  }
};

export const stripeWebhookHandler = async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  // CRITICAL: Verify webhook signature to ensure it's from Stripe
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log(`✅ Verified webhook event: ${event.type}`);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Log webhook for audit trail
  try {
    await supabase
      .from('payment_webhooks')
      .insert({
        provider: 'stripe_connect',
        event_type: event.type,
        event_id: event.id,
        payload: event,
        created_at: new Date().toISOString(),
      });
  } catch (logError) {
    console.error('Failed to log webhook:', logError);
    // Continue processing even if logging fails
  }

  // Handle events
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('Processing checkout.session.completed event');
        const session = event.data.object as Stripe.Checkout.Session;

        // Update payment transaction
        const { error: transactionError } = await supabase
          .from('payment_transactions')
          .update({
            status: 'succeeded',
            provider_payment_id: session.payment_intent as string,
            completed_at: new Date().toISOString(),
          })
          .eq('provider_session_id', session.id);

        if (transactionError) {
          console.error('Failed to update payment transaction:', transactionError);
        }

        // Update invoice status
        const invoiceId = session.metadata?.invoiceId;
        if (invoiceId) {
          const { error: invoiceError } = await supabase
            .from('invoices')
            .update({
              status: 'paid',
              paid_date: new Date().toISOString(),
            })
            .eq('id', invoiceId);

          if (invoiceError) {
            console.error('Failed to update invoice status:', invoiceError);
          } else {
            console.log(`✅ Invoice ${invoiceId} marked as paid`);
          }
        }
        break;
      }

      case 'account.updated': {
        console.log('Processing account.updated event');
        const account = event.data.object as Stripe.Account;

        // Update account status
        const { error: accountError } = await supabase
          .from('user_payment_accounts')
          .update({
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            onboarding_completed: account.details_submitted,
            capabilities: account.capabilities,
            requirements: account.requirements,
            updated_at: new Date().toISOString(),
          })
          .eq('provider_account_id', account.id);

        if (accountError) {
          console.error('Failed to update account status:', accountError);
        } else {
          console.log(`✅ Account ${account.id} status updated`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        console.log('Processing payment_intent.payment_failed event');
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const { error: failureError } = await supabase
          .from('payment_transactions')
          .update({
            status: 'failed',
            failure_reason: paymentIntent.last_payment_error?.message,
            updated_at: new Date().toISOString(),
          })
          .eq('provider_payment_id', paymentIntent.id);

        if (failureError) {
          console.error('Failed to update payment failure:', failureError);
        } else {
          console.log(`✅ Payment ${paymentIntent.id} marked as failed`);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        console.log('Processing payment_intent.succeeded event');
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const { error: successError } = await supabase
          .from('payment_transactions')
          .update({
            status: 'succeeded',
            provider_payment_id: paymentIntent.id,
            completed_at: new Date().toISOString(),
          })
          .eq('provider_payment_id', paymentIntent.id);

        if (successError) {
          console.error('Failed to update payment success:', successError);
        } else {
          console.log(`✅ Payment ${paymentIntent.id} marked as succeeded`);
        }
        break;
      }

      case 'account.application.deauthorized': {
        console.log('Processing account.application.deauthorized event');
        const application = event.data.object as Stripe.Application;

        // Extract account ID from the event account property
        const accountId = (event as any).account;

        if (accountId) {
          // Mark account as deauthorized
          const { error: deauthError } = await supabase
            .from('user_payment_accounts')
            .update({
              status: 'deauthorized',
              updated_at: new Date().toISOString(),
            })
            .eq('provider_account_id', accountId);

          if (deauthError) {
            console.error('Failed to mark account as deauthorized:', deauthError);
          } else {
            console.log(`✅ Account ${accountId} marked as deauthorized`);
          }
        } else {
          console.error('No account ID found in deauthorization event');
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    console.log(`✅ Successfully processed webhook: ${event.type}`);
    res.status(200).json({ received: true, eventType: event.type });
  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    // Return 500 so Stripe will retry the webhook
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// Example usage in Express app:
/*
import express from 'express';
import { stripeWebhookHandler, parseRawBody } from './api/webhooks/stripe';

const app = express();

// Apply raw body parser for webhook endpoint
app.use('/api/webhooks/stripe', parseRawBody);

// Webhook endpoint
app.post('/api/webhooks/stripe', stripeWebhookHandler);
*/