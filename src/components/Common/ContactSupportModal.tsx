// src/components/Common/ContactSupportModal.tsx
import React, { useEffect } from "react";
import { X, Mail, MessageCircle } from "lucide-react";

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactSupportModal: React.FC<ContactSupportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const supportEmail = "info@smartcfo.webcraftio.com";

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Initialize Tawk.to if not already loaded
      if (window.Tawk_API) {
        // Tawk.to is already loaded
      }
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleChatClick = () => {
    if (window.Tawk_API) {
      // Show widget first, then maximize it
      window.Tawk_API.showWidget();
      window.Tawk_API.maximize();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-white/95 backdrop-blur-lg px-6 pb-6 pt-6 text-left shadow-2xl border border-white/60 transition-all sm:w-full sm:max-w-lg">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-4">
              <MessageCircle className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900">
              Contact Support
            </h3>
            <p className="mt-2 text-gray-600">
              We're here to help! Choose how you'd like to reach us.
            </p>
          </div>

          {/* Contact Options */}
          <div className="space-y-3">
            {/* Live Chat Button */}
            <button
              onClick={handleChatClick}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              <MessageCircle className="h-5 w-5" />
              Start Live Chat
            </button>

            {/* Email Option */}
            <a
              href={`mailto:${supportEmail}`}
              onClick={onClose}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <Mail className="h-5 w-5" />
              Send Email
            </a>

            {/* Email Display */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-center text-sm text-gray-600">
                Or email us directly at
              </p>
              <a
                href={`mailto:${supportEmail}`}
                onClick={onClose}
                className="block text-center mt-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                {supportEmail}
              </a>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-gray-500">
            We typically respond within 24 hours
          </p>
        </div>
      </div>
    </div>
  );
};

// Extend Window interface for Tawk.to
declare global {
  interface Window {
    Tawk_API?: {
      maximize: () => void;
      minimize: () => void;
      toggle: () => void;
      showWidget: () => void;
      hideWidget: () => void;
      [key: string]: any;
    };
  }
}



