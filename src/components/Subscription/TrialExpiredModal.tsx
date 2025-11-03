// src/components/Subscription/TrialExpiredModal.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CreditCard, X } from "lucide-react";

interface TrialExpiredModalProps {
  isOpen: boolean;
  planName: string;
}

export const TrialExpiredModal: React.FC<TrialExpiredModalProps> = ({
  isOpen,
  planName,
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-white/95 backdrop-blur-lg px-4 pb-4 pt-5 text-left shadow-2xl border border-white/60 transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          {/* Warning Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>

          {/* Content */}
          <div className="mt-5 text-center">
            <h3 className="text-2xl font-semibold leading-6 text-gray-900">
              Your Free Trial Has Expired
            </h3>

            <div className="mt-4">
              <p className="text-lg text-gray-600">
                Your 60-day free trial of SmartCFO has ended.
              </p>
              <p className="mt-2 text-gray-600">
                You selected the{" "}
                <span className="font-semibold">{planName}</span> plan during
                registration.
              </p>
              <p className="mt-2 text-gray-600">
                To continue using SmartCFO and access your data, please complete
                your subscription.
              </p>
            </div>

            {/* Features reminder */}
            <div className="mt-6 rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900 mb-2">
                What happens after payment:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 text-left">
                <li>✓ Instant access to all your data</li>
                <li>✓ Continue where you left off</li>
                <li>✓ All features of your selected plan</li>
                <li>✓ Cancel anytime</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-3">
            <button
              onClick={() => navigate("/settings/subscription")}
              className="inline-flex w-full justify-center items-center rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Choose a Plan & Pay
            </button>

            <button
              onClick={() => navigate("/login")}
              className="inline-flex w-full justify-center rounded-md bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Logout
            </button>
          </div>

          {/* Help text */}
          <p className="mt-4 text-center text-xs text-gray-500">
            Need help? Contact us at support@smartcfo.webcraftio.com
          </p>
        </div>
      </div>
    </div>
  );
};
