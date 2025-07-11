// src/components/Invoice/DeleteInvoiceWarning.tsx
import React, { useState } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

interface DeleteInvoiceWarningProps {
  isOpen: boolean;
  invoiceNumber: string;
  invoiceStatus: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteInvoiceWarning: React.FC<DeleteInvoiceWarningProps> = ({
  isOpen,
  invoiceNumber,
  invoiceStatus,
  onConfirm,
  onCancel
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const isPaid = invoiceStatus === 'paid';

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideInvoiceDeleteWarning', 'true');
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">
                Delete Invoice
              </h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3">
            You are about to delete invoice <span className="font-semibold">{invoiceNumber}</span>.
          </p>

          {isPaid && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-amber-800 mb-1">
                    Important Notice
                  </h4>
                  <p className="text-sm text-amber-700">
                    This invoice has been marked as <strong>paid</strong> and may have associated income records. 
                    Deleting this invoice will <strong>not remove</strong> the income record from your books.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600">
            This action cannot be undone. Are you sure you want to proceed?
          </p>

          {/* Don't show again checkbox */}
          {isPaid && (
            <label className="flex items-center mt-4 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
              />
              Don't show this warning again for paid invoices
            </label>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Invoice
          </button>
        </div>
      </div>
    </div>
  );
};