// Backend API endpoint for Stripe Connect account operations
// This should be deployed as a serverless function or Express.js API route

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabase } from '../../services/supabaseClient';

// Initialize Stripe with secret key on backend only
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export interface ConnectedAccountData {
  email: string;
  country: string;
  businessType: 'individual' | 'company';
  businessName?: string;
  defaultCurrency: string;
  requestedCapabilities: string[];
}

// POST /api/stripe-connect/accounts
export const createConnectedAccount = async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, accountData }: { userId: string; accountData: ConnectedAccountData } = req.body;

    if (!userId || !accountData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('Creating Stripe account with data:', {
      country: accountData.country,
      email: accountData.email,
      businessType: accountData.businessType,
      businessName: accountData.businessName
    });

    // Create account with minimal required parameters first
    const stripeAccountData: any = {
      type: 'express',
      country: accountData.country,
      email: accountData.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        userId,
        platform: 'SmartCFO',
      },
    };

    // Only add business_type and company info if provided and valid
    if (accountData.businessType && ['individual', 'company'].includes(accountData.businessType)) {
      stripeAccountData.business_type = accountData.businessType;

      if (accountData.businessType === 'company' && accountData.businessName) {
        stripeAccountData.company = {
          name: accountData.businessName,
        };
      }
    }

    const account = await stripe.accounts.create(stripeAccountData);

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.SITE_URL}/settings/payment-accounts?refresh=true`,
      return_url: `${process.env.SITE_URL}/settings/payment-accounts?success=true`,
      type: 'account_onboarding',
    });

    // Save to database
    const { error: dbError } = await supabase
      .from('user_payment_accounts')
      .insert({
        user_id: userId,
        provider: 'stripe_connect',
        provider_account_id: account.id,
        country: accountData.country,
        default_currency: accountData.defaultCurrency,
        supported_currencies: getSupportedCurrencies(accountData.country),
        business_type: accountData.businessType,
        business_name: accountData.businessName,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Failed to save account to database' });
    }

    res.status(200).json({
      accountId: account.id,
      onboardingUrl: accountLink.url,
      success: true,
    });

  } catch (error: any) {
    console.error('Stripe account creation error:', error);

    // Get detailed error information from Stripe
    let errorMessage = 'Failed to create account';
    if (error.type === 'StripeInvalidRequestError') {
      errorMessage = `Stripe Error: ${error.message}`;
      if (error.param) {
        errorMessage += ` (Parameter: ${error.param})`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(400).json({
      accountId: '',
      onboardingUrl: '',
      success: false,
      error: errorMessage,
    });
  }
};

// GET /api/stripe-connect/accounts/:accountId/status
export const getAccountStatus = async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const account = await stripe.accounts.retrieve(accountId);

    res.status(200).json({
      accountId: account.id,
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
      requiresAction: !account.details_submitted || false,
      requiredActions: account.requirements?.currently_due || [],
    });

  } catch (error: any) {
    console.error('Error getting account status:', error);
    res.status(500).json({ error: 'Failed to get account status' });
  }
};

// POST /api/stripe-connect/accounts/:accountId/login-link
export const getAccountLoginLink = async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const loginLink = await stripe.accounts.createLoginLink(accountId);

    res.status(200).json({
      url: loginLink.url
    });

  } catch (error: any) {
    console.error('Error creating login link:', error);
    res.status(500).json({ error: 'Failed to create login link' });
  }
};

function getSupportedCurrencies(country: string): string[] {
  // Stripe Connect supported countries and their currencies (2024-2025)
  const currencyMap: Record<string, string[]> = {
    // North America
    'US': ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
    'CA': ['CAD', 'USD', 'EUR', 'GBP'],
    'MX': ['MXN', 'USD', 'EUR'],

    // Europe
    'GB': ['GBP', 'EUR', 'USD'],
    'DE': ['EUR', 'USD', 'GBP', 'CHF'],
    'FR': ['EUR', 'USD', 'GBP', 'CHF'],
    'ES': ['EUR', 'USD', 'GBP'],
    'IT': ['EUR', 'USD', 'GBP'],
    'NL': ['EUR', 'USD', 'GBP'],
    'BE': ['EUR', 'USD', 'GBP'],
    'AT': ['EUR', 'USD', 'GBP', 'CHF'],
    'CH': ['CHF', 'EUR', 'USD', 'GBP'],
    'SE': ['SEK', 'EUR', 'USD', 'GBP'],
    'NO': ['NOK', 'EUR', 'USD', 'GBP'],
    'DK': ['DKK', 'EUR', 'USD', 'GBP'],
    'FI': ['EUR', 'USD', 'GBP'],
    'IE': ['EUR', 'USD', 'GBP'],
    'PT': ['EUR', 'USD', 'GBP'],
    'PL': ['PLN', 'EUR', 'USD'],
    'CZ': ['CZK', 'EUR', 'USD'],
    'HU': ['HUF', 'EUR', 'USD'],
    'BG': ['BGN', 'EUR', 'USD'],
    'RO': ['RON', 'EUR', 'USD'],
    'HR': ['EUR', 'USD'],
    'SI': ['EUR', 'USD'],
    'SK': ['EUR', 'USD'],
    'EE': ['EUR', 'USD'],
    'LV': ['EUR', 'USD'],
    'LT': ['EUR', 'USD'],
    'LU': ['EUR', 'USD'],
    'MT': ['EUR', 'USD'],
    'CY': ['EUR', 'USD'],
    'GR': ['EUR', 'USD'],

    // Asia-Pacific
    'AU': ['AUD', 'USD', 'EUR', 'GBP', 'NZD'],
    'NZ': ['NZD', 'USD', 'EUR', 'AUD'],
    'SG': ['SGD', 'USD', 'EUR', 'GBP'],
    'HK': ['HKD', 'USD', 'EUR', 'GBP'],
    'JP': ['JPY', 'USD', 'EUR', 'GBP'],
    'IN': ['INR', 'USD', 'EUR', 'GBP'],
    'TH': ['THB', 'USD', 'EUR'],
    'AE': ['AED', 'USD', 'EUR'],
    'MY': ['MYR', 'USD', 'EUR'],

    // Latin America
    'BR': ['BRL', 'USD', 'EUR'],
    'CL': ['CLP', 'USD', 'EUR'],
    'UY': ['UYU', 'USD', 'EUR'],
  };

  return currencyMap[country] || ['USD', 'EUR', 'GBP'];
}