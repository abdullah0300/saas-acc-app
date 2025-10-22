import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, CreditCard, FileText, CheckCircle, Upload, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { createLoanPayment, updateLoan, getLoan } from '../../services/database';
import { Loan, AmortizationEntry, PaymentMethod, LoanPayment } from '../../types';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../services/supabaseClient';

interface RecordPaymentModalProps {
  loan: Loan;
  nextPayment: AmortizationEntry | null;
  existingPayments: LoanPayment[];
  onClose: () => void;
  onPaymentRecorded: (interestAmount?: number) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  loan,
  nextPayment,
  existingPayments,
  onClose,
  onPaymentRecorded,
}) => {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();

  // Calculate next payment number based on existing payments
  const getNextPaymentNumber = () => {
    if (existingPayments.length === 0) return 1;
    const maxPaymentNumber = Math.max(...existingPayments.map(p => p.payment_number));
    return maxPaymentNumber + 1;
  };

  const [formData, setFormData] = useState({
    payment_number: getNextPaymentNumber(),
    payment_date: new Date().toISOString().split('T')[0],
    principal_amount: nextPayment?.principal_payment || 0,
    interest_amount: nextPayment?.interest_payment || 0,
    total_payment: nextPayment?.total_payment || 0,
    payment_method: 'bank_transfer' as PaymentMethod,
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string>('');

  // Update form when next payment changes
  useEffect(() => {
    if (nextPayment) {
      setFormData((prev) => ({
        ...prev,
        payment_number: nextPayment.payment_number,
        principal_amount: nextPayment.principal_payment,
        interest_amount: nextPayment.interest_payment,
        total_payment: nextPayment.total_payment,
      }));
    }
  }, [nextPayment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to record payments');
      return;
    }

    // Validation
    if (formData.total_payment <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }

    if (!formData.payment_date) {
      setError('Payment date is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Upload payment proof if exists
      let paymentProofUrl: string | undefined;
      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${user.id}/loan-${loan.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, proofFile);

        if (uploadError) {
          throw new Error(`Failed to upload proof: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);

        paymentProofUrl = publicUrl;
      }

      // Calculate remaining balance after this payment
      const remainingBalance = loan.current_balance - formData.principal_amount;

      // Create payment record
      const paymentData = {
        loan_id: loan.id,
        payment_number: formData.payment_number,
        payment_date: formData.payment_date,
        due_date: nextPayment?.payment_date || formData.payment_date,
        principal_amount: formData.principal_amount,
        interest_amount: formData.interest_amount,
        total_payment: formData.total_payment,
        remaining_balance: Math.max(0, remainingBalance),
        payment_method: formData.payment_method,
        status: 'paid' as const,
        notes: formData.notes || undefined,
        payment_proof_url: paymentProofUrl,
      };

      await createLoanPayment(paymentData, user.id);

      // Update loan totals
      const updatedLoan = {
        current_balance: Math.max(0, remainingBalance),
        total_paid: (loan.total_paid || 0) + formData.total_payment,
        total_principal_paid: (loan.total_principal_paid || 0) + formData.principal_amount,
        total_interest_paid: (loan.total_interest_paid || 0) + formData.interest_amount,
        status: remainingBalance <= 0 ? ('paid_off' as const) : loan.status,
      };

      await updateLoan(loan.id, updatedLoan, user.id);

      // Success - pass interest amount to show banner
      onPaymentRecorded(formData.interest_amount > 0 ? formData.interest_amount : undefined);
      onClose();
    } catch (err: any) {
      console.error('Error recording payment:', err);
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // If principal amount changes, recalculate total
    if (name === 'principal_amount') {
      const principal = parseFloat(value) || 0;
      const interest = formData.interest_amount;
      setFormData((prev) => ({
        ...prev,
        principal_amount: principal,
        total_payment: principal + interest,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid image (JPG, PNG, WebP) or PDF file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      setProofFile(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setProofPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setProofPreview(''); // PDF preview not needed
      }
    }
  };

  const removeProofFile = () => {
    setProofFile(null);
    setProofPreview('');
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Record Payment</h2>
                <p className="text-indigo-100 text-sm">
                  {loan.loan_number} - {loan.lender_name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Payment Summary */}
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Payment Summary
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-indigo-700">Payment #</p>
                <p className="font-bold text-indigo-900">{formData.payment_number}</p>
              </div>
              <div>
                <p className="text-indigo-700">Total Amount</p>
                <p className="font-bold text-indigo-900 text-lg">
                  {formatCurrency(formData.total_payment)}
                </p>
              </div>
              <div>
                <p className="text-indigo-700">Principal</p>
                <p className="font-semibold text-indigo-900">
                  {formatCurrency(formData.principal_amount)}
                </p>
              </div>
              <div>
                <p className="text-indigo-700">Interest</p>
                <p className="font-semibold text-indigo-900">
                  {formatCurrency(formData.interest_amount)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-indigo-700">New Balance After Payment</p>
                <p className="font-bold text-indigo-900 text-lg">
                  {formatCurrency(
                    Math.max(0, loan.current_balance - formData.principal_amount)
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Payment Date *
              </label>
              <input
                type="date"
                name="payment_date"
                value={formData.payment_date}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Payment Method *
              </label>
              <select
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="debit_card">Debit Card</option>
                <option value="credit_card">Credit Card</option>
                <option value="ach">ACH</option>
                <option value="wire">Wire Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Principal Amount (Editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Principal Amount *
              </label>
              <input
                type="number"
                name="principal_amount"
                value={formData.principal_amount}
                onChange={handleChange}
                step="0.01"
                min="0"
                max={loan.current_balance}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {nextPayment
                  ? `Scheduled: ${formatCurrency(nextPayment.principal_payment)}`
                  : 'Amount that reduces loan balance'
                }
              </p>
            </div>

            {/* Total Payment (Auto-calculated) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Payment Amount
              </label>
              <div className="w-full px-4 py-2 border-2 border-indigo-200 rounded-lg bg-indigo-50 text-indigo-900 font-bold text-lg">
                {formatCurrency(formData.total_payment)}
              </div>
              <p className="text-xs text-indigo-600 mt-1">
                Principal + Interest (auto-calculated)
              </p>
            </div>
          </div>

          {/* Payment Proof Upload */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Upload className="w-4 h-4 inline mr-1" />
              Payment Proof (Optional)
            </label>

            {!proofFile ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
                <input
                  type="file"
                  id="proof-upload"
                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="proof-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600 font-medium">
                    Click to upload receipt or screenshot
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    JPG, PNG, WebP or PDF (max 5MB)
                  </span>
                </label>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {proofPreview ? (
                      <img
                        src={proofPreview}
                        alt="Payment proof"
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {proofFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(proofFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeProofFile}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Add any notes about this payment..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end mt-8">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
