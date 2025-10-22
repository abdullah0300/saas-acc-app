import { PaymentProvider, ConnectedAccountData, ConnectedAccountResult, AccountStatus, PaymentInvoice, ConnectedAccount, PaymentSession, PaymentStatus } from './PaymentProvider.interface';
import { supabase } from '../supabaseClient';

export class StripeConnectProvider implements PaymentProvider {
  public name = 'stripe_connect';
  private apiBaseUrl: string;

  constructor() {
    // ✅ NEW: Use Supabase Edge Functions
    this.apiBaseUrl = process.env.REACT_APP_API_URL || 'https://adsbnzqorfmgnneiopcr.supabase.co/functions/v1';
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  async createConnectedAccount(userId: string, data: ConnectedAccountData): Promise<ConnectedAccountResult> {
    try {
      console.log('Creating Stripe account with data:', {
        country: data.country,
        email: data.email,
        businessType: data.businessType,
        businessName: data.businessName
      });

      // ✅ NEW: Call stripe-connect-create-account function
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.apiBaseUrl}/stripe-connect-create-account`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          accountData: data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create account');
      }

      return result;
    } catch (error: any) {
      console.error('Stripe account creation error:', error);

      return {
        accountId: '',
        onboardingUrl: '',
        success: false,
        error: error.message || 'Failed to create account',
      };
    }
  }

  async getAccountStatus(accountId: string): Promise<AccountStatus> {
    try {
      // ✅ NEW: Call stripe-connect-account-status function
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.apiBaseUrl}/stripe-connect-account-status?accountId=${accountId}`, {
        method: 'GET',
        headers,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get account status');
      }

      return result;
    } catch (error: any) {
      console.error('Error getting account status:', error);
      throw new Error(error.message || 'Failed to get account status');
    }
  }

  async getAccountLoginLink(accountId: string): Promise<string> {
    try {
      // ✅ NEW: Call stripe-connect-account-login function
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.apiBaseUrl}/stripe-connect-account-login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create login link');
      }

      return result.url;
    } catch (error: any) {
      console.error('Error creating login link:', error);
      throw new Error(error.message || 'Failed to create login link');
    }
  }

  async createPaymentSession(invoice: PaymentInvoice, account: ConnectedAccount): Promise<PaymentSession> {
    try {
      // ✅ Not used directly - see PaymentService.ts
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.apiBaseUrl}/stripe-connect-create-payment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          invoice,
          account,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create payment session');
      }

      return result;
    } catch (error: any) {
      console.error('Error creating payment session:', error);
      throw new Error(error.message || 'Failed to create payment session');
    }
  }

  async getPaymentStatus(sessionId: string, stripeAccount?: string): Promise<PaymentStatus> {
    try {
      // ✅ For now, we can poll the database directly via Supabase client
      // or create another edge function if needed
      throw new Error('Not implemented - use Supabase client to check payment_transactions table');
    } catch (error: any) {
      console.error('Error getting payment status:', error);
      throw new Error(error.message || 'Failed to get payment status');
    }
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    // Webhook verification should be done on the backend
    // This is just a placeholder for interface compliance
    console.warn('Webhook verification should be handled on the backend');
    return false;
  }

  async handleWebhookEvent(event: any): Promise<void> {
    // Webhook handling should be done on the backend
    // This is just a placeholder for interface compliance
    console.warn('Webhook handling should be done on the backend');
  }

  getSupportedCurrencies(country: string): string[] {
    const currencyMap: Record<string, string[]> = {
      'US': ['USD'],
      'GB': ['GBP', 'EUR', 'USD'],
      'CA': ['CAD', 'USD'],
      'AU': ['AUD', 'USD'],
      'DE': ['EUR', 'USD'],
      'FR': ['EUR', 'USD'],
      'IT': ['EUR', 'USD'],
      'ES': ['EUR', 'USD'],
      'NL': ['EUR', 'USD'],
      'IE': ['EUR', 'USD'],
      'SE': ['SEK', 'EUR', 'USD'],
      'DK': ['DKK', 'EUR', 'USD'],
      'NO': ['NOK', 'EUR', 'USD'],
      'CH': ['CHF', 'EUR', 'USD'],
      'PL': ['PLN', 'EUR', 'USD'],
      'AT': ['EUR', 'USD'],
      'BE': ['EUR', 'USD'],
      'FI': ['EUR', 'USD'],
      'PT': ['EUR', 'USD'],
      'GR': ['EUR', 'USD'],
      'CZ': ['CZK', 'EUR', 'USD'],
      'HU': ['HUF', 'EUR', 'USD'],
      'RO': ['RON', 'EUR', 'USD'],
      'BG': ['BGN', 'EUR', 'USD'],
      'HR': ['EUR', 'USD'],
      'SG': ['SGD', 'USD'],
      'HK': ['HKD', 'USD'],
      'JP': ['JPY', 'USD'],
      'NZ': ['NZD', 'USD'],
      'MY': ['MYR', 'USD'],
      'TH': ['THB', 'USD'],
      'MX': ['MXN', 'USD'],
      'BR': ['BRL', 'USD'],
      'IN': ['INR', 'USD'],
    };

    return currencyMap[country] || ['USD'];
  }

  async getExchangeRate(from: string, to: string): Promise<number> {
    // Implement exchange rate fetching if needed
    return 1;
  }
}