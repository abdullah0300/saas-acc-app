import { PaymentProvider, ConnectedAccountData, ConnectedAccountResult, AccountStatus, PaymentInvoice, ConnectedAccount, PaymentSession, PaymentStatus } from './PaymentProvider.interface';

export class StripeConnectProvider implements PaymentProvider {
  public name = 'stripe_connect';
  private apiBaseUrl: string;

  constructor() {
    // Use your backend API URL - this should be configured in environment variables
    this.apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  }

  async createConnectedAccount(userId: string, data: ConnectedAccountData): Promise<ConnectedAccountResult> {
    try {
      console.log('Creating Stripe account with data:', {
        country: data.country,
        email: data.email,
        businessType: data.businessType,
        businessName: data.businessName
      });

      const response = await fetch(`${this.apiBaseUrl}/stripe-connect/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${this.apiBaseUrl}/stripe-connect/accounts/${accountId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${this.apiBaseUrl}/stripe-connect/accounts/${accountId}/login-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${this.apiBaseUrl}/stripe-connect/payment-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const url = new URL(`${this.apiBaseUrl}/stripe-connect/payment-sessions/${sessionId}/status`);
      if (stripeAccount) {
        url.searchParams.append('stripeAccount', stripeAccount);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get payment status');
      }

      return result;
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
    // Official Stripe Connect Express supported countries (2025)
    // Based on: https://docs.stripe.com/connect/express-accounts
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

      // Latin America
      'BR': ['BRL', 'USD', 'EUR'],

      // Countries with restrictions (require manual setup)
      // Note: These require contacting Stripe support for Express accounts
      'IN': ['INR', 'USD', 'EUR', 'GBP'], // India - has restrictions
      'TH': ['THB', 'USD', 'EUR'],        // Thailand - has restrictions
      'AE': ['AED', 'USD', 'EUR'],        // UAE - has restrictions
    };

    // Return empty array for unsupported countries (like Pakistan)
    return currencyMap[country] || [];
  }

  async getExchangeRate(from: string, to: string): Promise<number> {
    // For production, integrate with a real exchange rate API
    // This is a placeholder
    const rates: Record<string, number> = {
      'USD_EUR': 0.92,
      'USD_GBP': 0.79,
      'EUR_USD': 1.09,
      'EUR_GBP': 0.86,
      'GBP_USD': 1.27,
      'GBP_EUR': 1.16,
    };

    const key = `${from}_${to}`;
    return rates[key] || 1;
  }
}