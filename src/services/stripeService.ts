// src/services/stripeService.ts

import { supabase } from './supabaseClient';
import { STRIPE_PRICE_IDS, PlanType } from '../config/subscriptionConfig';

export interface CheckoutSessionData {
  priceId: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}

class StripeService {
  private getAppUrl(): string {
    return process.env.REACT_APP_APP_URL || window.location.origin;
  }

  // Create a checkout session via Supabase Edge Function
  async createCheckoutSession(
    plan: PlanType,
    interval: 'monthly' | 'yearly',
    userId: string,
    userEmail: string
  ) {
    try {
      const priceId = STRIPE_PRICE_IDS[plan][interval];
      
      console.log('Creating checkout session with:', {
        plan,
        interval,
        priceId,
        userId,
        userEmail
      });
      
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          priceId,
          userId,
          userEmail,
          successUrl: `${this.getAppUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${this.getAppUrl()}/settings/subscription`
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        // Try to get the actual error message from the response
        if (error instanceof Error && 'context' in error) {
          const context = (error as any).context;
          console.error('Error context:', context);
          if (context?.body) {
            try {
              const errorBody = JSON.parse(context.body);
              throw new Error(errorBody.error || errorBody.message || 'Unknown error from edge function');
            } catch (e) {
              throw error;
            }
          }
        }
        throw error;
      }
      
      if (!data || !data.url) {
        throw new Error('No checkout URL returned from edge function');
      }
      
      return data;
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      throw new Error(error.message || 'Failed to create checkout session');
    }
  }

  // Create a customer portal session for managing subscription
  async createPortalSession(customerId: string) {
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-portal', {
        body: {
          customerId,
          returnUrl: `${this.getAppUrl()}/settings/subscription`
        }
      });

      if (error) throw error;
      
      return data;
    } catch (error: any) {
      console.error('Error creating portal session:', error);
      throw new Error(error.message || 'Failed to create portal session');
    }
  }

  // Verify a successful payment
  async verifyPayment(sessionId: string) {
    try {
      const { data, error } = await supabase.functions.invoke('verify-stripe-payment', {
        body: { sessionId }
      });

      if (error) throw error;
      
      return data;
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      throw new Error(error.message || 'Failed to verify payment');
    }
  }

  // Cancel subscription at period end
  async cancelSubscription(subscriptionId: string) {
    try {
      const { data, error } = await supabase.functions.invoke('cancel-stripe-subscription', {
        body: { subscriptionId }
      });

      if (error) throw error;
      
      return data;
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      throw new Error(error.message || 'Failed to cancel subscription');
    }
  }

  // Resume a canceled subscription
  async resumeSubscription(subscriptionId: string) {
    try {
      const { data, error } = await supabase.functions.invoke('resume-stripe-subscription', {
        body: { subscriptionId }
      });

      if (error) throw error;
      
      return data;
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      throw new Error(error.message || 'Failed to resume subscription');
    }
  }

  // Get upcoming invoice preview when changing plans
  async getUpcomingInvoice(customerId: string, newPriceId: string) {
    try {
      const { data, error } = await supabase.functions.invoke('preview-stripe-invoice', {
        body: { customerId, newPriceId }
      });

      if (error) throw error;
      
      return data;
    } catch (error: any) {
      console.error('Error getting invoice preview:', error);
      throw new Error(error.message || 'Failed to get invoice preview');
    }
  }

  // Check if user has payment method
  async hasPaymentMethod(customerId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('check-payment-method', {
        body: { customerId }
      });

      if (error) throw error;
      
      return data.hasPaymentMethod || false;
    } catch (error: any) {
      console.error('Error checking payment method:', error);
      return false;
    }
  }
}

export const stripeService = new StripeService();