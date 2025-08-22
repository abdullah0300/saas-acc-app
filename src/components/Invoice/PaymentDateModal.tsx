// PaymentDateModal.tsx - Works for ALL countries
import React, { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';

interface PaymentDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  invoiceNumber: string;
  invoiceDate: string;
  clientName?: string;
}

export const PaymentDateModal: React.FC<PaymentDateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  invoiceNumber,
  invoiceDate,
  clientName
}) => {
  const { userSettings } = useSettings();
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Only show tax point info for UK users
  const isUKUser = userSettings?.country === 'GB';
  const usesCashAccounting = (userSettings as any)?.uk_vat_scheme === 'cash';

  const handleConfirm = () => {
    onConfirm(new Date(paymentDate));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Record Payment</h3>
          <p className="text-sm text-gray-600 mt-1">
            Invoice #{invoiceNumber} {clientName && `• ${clientName}`}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Payment Received Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              min={invoiceDate}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            
            {/* Only show UK-specific VAT info */}
            {isUKUser && usesCashAccounting && (
              <p className="text-xs text-gray-500 mt-1">
                This date will be used as the tax point for VAT (cash accounting scheme)
              </p>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            <Check className="inline h-4 w-4 mr-2" />
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
};