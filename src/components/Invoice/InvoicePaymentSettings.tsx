// NEW COMPONENT - DO NOT MODIFY InvoiceForm.tsx
import React, { useState, useEffect } from 'react';
import { CreditCard, Globe, AlertCircle } from 'lucide-react';
import { paymentService } from '../../services/payment/PaymentService';
import { useAuth } from '../../contexts/AuthContext';

interface InvoicePaymentSettingsProps {
  invoiceId?: string;
  currency: string;
  onUpdate?: (settings: any) => void;
}

export const InvoicePaymentSettings: React.FC<InvoicePaymentSettingsProps> = ({
  invoiceId,
  currency,
  onUpdate,
}) => {
  const { user } = useAuth();
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [acceptedCurrencies, setAcceptedCurrencies] = useState<string[]>([currency]);

  useEffect(() => {
    loadPaymentAccounts();
  }, [user]);

  const loadPaymentAccounts = async () => {
    if (!user) return;

    try {
      const accounts = await paymentService.getUserPaymentAccounts(user.id);
      const activeAccounts = accounts?.filter(a => a.onboarding_completed) || [];
      setAvailableAccounts(activeAccounts);

      if (activeAccounts.length > 0) {
        setSelectedProviders(activeAccounts.map(a => a.provider));
      }
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    }
  };

  const handleTogglePayment = async () => {
    const newValue = !paymentEnabled;
    setPaymentEnabled(newValue);

    if (invoiceId && newValue) {
      try {
        await paymentService.enableInvoicePayments(
          invoiceId,
          selectedProviders,
          acceptedCurrencies
        );
      } catch (error) {
        console.error('Error enabling payments:', error);
      }
    }

    if (onUpdate) {
      onUpdate({
        paymentEnabled: newValue,
        providers: selectedProviders,
        currencies: acceptedCurrencies,
      });
    }
  };

  const handleCurrencyToggle = (curr: string) => {
    setAcceptedCurrencies(prev => {
      if (prev.includes(curr)) {
        return prev.filter(c => c !== curr);
      }
      return [...prev, curr];
    });
  };

  if (availableAccounts.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-900">Payment Account Required</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Connect a payment account in Settings to accept payments on invoices.
            </p>
            <a
              href="/settings/payment-accounts"
              className="text-sm text-yellow-900 underline hover:text-yellow-800 mt-2 inline-block"
            >
              Go to Payment Settings →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Payment Options</h3>
        </div>

        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={paymentEnabled}
            onChange={handleTogglePayment}
            className="sr-only"
          />
          <div className={`w-11 h-6 rounded-full transition-colors ${
            paymentEnabled ? 'bg-indigo-600' : 'bg-gray-300'
          }`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
              paymentEnabled ? 'translate-x-5' : 'translate-x-0.5'
            } mt-0.5`} />
          </div>
          <span className="ml-3 text-sm text-gray-700">
            Enable online payment
          </span>
        </label>
      </div>

      {paymentEnabled && (
        <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">
          {/* Available Payment Accounts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment will be processed through:
            </label>
            <div className="space-y-2">
              {availableAccounts.map((account) => (
                <div key={account.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <CreditCard className="h-4 w-4 text-gray-600" />
                  <span className="text-sm text-gray-700">
                    {account.provider === 'stripe_connect' ? 'Stripe' : account.provider}
                    {' - '}
                    {account.business_name || 'Individual Account'}
                    {' ('}
                    {account.country}
                    {')'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                  Multi-Currency Payments
                </h4>
                <div className="space-y-1 text-sm text-blue-800">
                  <p>✓ Accepts payments in <span className="font-medium">135+ currencies worldwide</span></p>
                  <p>✓ Stripe automatically converts to <span className="font-medium">{availableAccounts[0]?.default_currency?.toUpperCase() || 'USD'}</span> (your account currency)</p>
                  <p>✓ Customer pays in invoice currency, you receive in {availableAccounts[0]?.default_currency?.toUpperCase() || 'USD'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2">
            <p className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Customers will see a "Pay Now" button on the invoice</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Payment processing fees apply per your provider's rates</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Funds deposited to your Stripe account in {availableAccounts[0]?.default_currency?.toUpperCase() || 'USD'}</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Exchange rates applied automatically at time of payment</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};