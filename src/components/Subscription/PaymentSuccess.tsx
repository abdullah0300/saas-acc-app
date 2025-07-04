// src/components/Subscription/PaymentSuccess.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { stripeService } from "../../services/stripeService";
import { useSubscription } from "../../contexts/SubscriptionContext";

export const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { refreshSubscription } = useSubscription();

  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    } else {
      // No session ID, but user might have completed payment
      // Just refresh subscription and redirect
      handleSuccess();
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      setVerifying(true);
      const result = await stripeService.verifyPayment(sessionId!);

      if (result.success) {
        handleSuccess();
      } else {
        setError(
          "Payment verification failed. Please contact support if you were charged."
        );
      }
    } catch (err: any) {
      console.error("Error verifying payment:", err);
      // Even if verification fails, the webhook might have updated the subscription
      // So let's refresh and check
      handleSuccess();
    }
  };

  const handleSuccess = async () => {
    try {
      // Refresh subscription data
      await refreshSubscription();

      // Wait a bit for webhook to process
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (err) {
      console.error("Error refreshing subscription:", err);
      // Still navigate to dashboard
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } finally {
      setVerifying(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 text-blue-600 mx-auto mb-4 animate-spin" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Processing Your Payment...
          </h1>
          <p className="text-gray-600">
            Please wait while we confirm your subscription.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Verification Issue
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h1>
        <p className="text-lg text-gray-600 mb-2">
          Your subscription has been activated.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Thank you for choosing SmartCFO!
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
          >
            Go to Dashboard
          </button>

          <button
            onClick={() => navigate("/settings/subscription")}
            className="w-full py-3 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View Subscription Details
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          A confirmation email has been sent to your email address.
        </p>
      </div>
    </div>
  );
};
