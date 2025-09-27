import { supabase } from '../supabaseClient';
import { StripeConnectProvider } from './StripeConnectProvider';
import { PaymentProvider } from './PaymentProvider.interface';

class PaymentService {
  private providers: Map<string, PaymentProvider> = new Map();

  constructor() {
    // Register providers
    this.registerProvider(new StripeConnectProvider());
  }

  private registerProvider(provider: PaymentProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Payment provider ${name} not found`);
    }
    return provider;
  }

  async getUserPaymentAccounts(userId: string) {
    const { data, error } = await supabase
      .from('user_payment_accounts')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data;
  }

  async createPaymentAccount(userId: string, providerName: string, data: any) {
    const provider = this.getProvider(providerName);

    // Create account with provider
    const result = await provider.createConnectedAccount(userId, data);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Save to database
    const { error } = await supabase
      .from('user_payment_accounts')
      .insert({
        user_id: userId,
        provider: providerName,
        provider_account_id: result.accountId,
        country: data.country,
        default_currency: data.defaultCurrency,
        supported_currencies: provider.getSupportedCurrencies(data.country),
        business_type: data.businessType,
        business_name: data.businessName,
      });

    if (error) throw error;

    return result;
  }

  async enableInvoicePayments(invoiceId: string, providers: string[], currencies: string[]) {
    const { error } = await supabase
      .from('invoice_payment_settings')
      .upsert({
        invoice_id: invoiceId,
        payment_enabled: true,
        payment_providers: providers,
        accepted_currencies: currencies,
      });

    if (error) throw error;
  }

  async createPaymentSession(invoiceId: string, providerName: string) {
    try {
      // Use the backend API endpoint for creating payment sessions
      const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

      const response = await fetch(`${apiBaseUrl}/stripe-connect/invoices/${invoiceId}/payment-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerName,
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
}

export const paymentService = new PaymentService();