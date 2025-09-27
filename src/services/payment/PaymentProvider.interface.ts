// DO NOT IMPORT OR MODIFY ANY EXISTING SERVICES

export interface PaymentProvider {
  name: string;

  // Account management
  createConnectedAccount(userId: string, data: ConnectedAccountData): Promise<ConnectedAccountResult>;
  getAccountStatus(accountId: string): Promise<AccountStatus>;
  getAccountLoginLink(accountId: string): Promise<string>;

  // Payment processing
  createPaymentSession(invoice: PaymentInvoice, account: ConnectedAccount): Promise<PaymentSession>;
  getPaymentStatus(sessionId: string): Promise<PaymentStatus>;

  // Webhooks
  verifyWebhookSignature(payload: any, signature: string): boolean;
  handleWebhookEvent(event: any): Promise<void>;

  // Multi-currency
  getSupportedCurrencies(country: string): string[];
  getExchangeRate(from: string, to: string): Promise<number>;
}

export interface ConnectedAccountData {
  email: string;
  country: string;
  businessType: 'individual' | 'company';
  businessName?: string;
  defaultCurrency: string;
  requestedCapabilities: string[];
}

export interface ConnectedAccountResult {
  accountId: string;
  onboardingUrl: string;
  success: boolean;
  error?: string;
}

export interface AccountStatus {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requiresAction: boolean;
  requiredActions: string[];
}

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

export interface PaymentSession {
  sessionId: string;
  paymentUrl: string;
  expiresAt: Date;
}

export interface PaymentStatus {
  sessionId: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  paymentIntentId?: string;
  failureReason?: string;
}