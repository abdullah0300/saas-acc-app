// NEW COMPONENT - DO NOT MODIFY PublicInvoiceView.tsx
import React, { useState, useEffect } from 'react';
import { CreditCard, Lock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { paymentService } from '../../services/payment/PaymentService';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';

interface PublicInvoicePayButtonProps {
  invoice: any;
}

export const PublicInvoicePayButton: React.FC<PublicInvoicePayButtonProps> = ({ invoice }) => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);

  useEffect(() => {
    loadPaymentSettings();
    checkPaymentStatus();
  }, [invoice.id]);

  const loadPaymentSettings = async () => {
    try {
      const { data } = await supabase
        .from('invoice_payment_settings')
        .select('*')
        .eq('invoice_id', invoice.id)
        .single();

      setPaymentSettings(data);
    } catch (error) {
      console.error('Error loading payment settings:', error);
    }
  };

  const checkPaymentStatus = () => {
    const status = searchParams.get('payment');
    if (status) {
      setPaymentStatus(status);
    }
  };

  const handlePayment = async () => {
    setLoading(true);

    try {
      // For now, using the first available provider
      const provider = paymentSettings.payment_providers[0];
      const session = await paymentService.createPaymentSession(invoice.id, provider);

      // Redirect to payment page
      window.location.href = session.paymentUrl;
    } catch (error: any) {
      alert(`Payment error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Show payment status if returning from payment
  if (paymentStatus === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-green-900 mb-1">Payment Successful!</h3>
        <p className="text-green-700">Thank you for your payment. A receipt has been sent to your email.</p>
      </div>
    );
  }

  if (paymentStatus === 'cancelled') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <XCircle className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-yellow-900 mb-1">Payment Cancelled</h3>
        <p className="text-yellow-700">Your payment was cancelled. You can try again below.</p>
        <button
          onClick={handlePayment}
          disabled={loading}
          className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Don't show button if invoice is already paid or payment not enabled
  if (invoice.status === 'paid' || !paymentSettings?.payment_enabled) {
    return null;
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Options</h3>

      <button
        onClick={handlePayment}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5" />
            <span className="font-semibold">Pay {invoice.currency} {invoice.total.toFixed(2)}</span>
          </>
        )}
      </button>

      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
        <Lock className="h-4 w-4" />
        <span>Secure payment powered by Stripe</span>
      </div>

      {paymentSettings?.accepted_currencies?.length > 1 && (
        <div className="mt-4 text-center text-sm text-gray-600">
          Also accepting: {paymentSettings.accepted_currencies.join(', ')}
        </div>
      )}
    </div>
  );
};