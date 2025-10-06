import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Calculator,
  AlertCircle,
  DollarSign,
  Percent,
  Calendar,
  Building2,
  FileText,
  Plus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import {
  createLoan,
  updateLoan,
  getLoan,
  getVendors,
  createVendor,
  saveLoanSchedule
} from '../../services/database';
import { loanService } from '../../services/loanService';
import { Vendor, PaymentFrequency, LoanType } from '../../types';
import { addMonths, format } from 'date-fns';

export const LoanForm: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    loan_number: '',
    lender_name: '',
    vendor_id: '',
    principal_amount: '',
    interest_rate: '',
    term_months: '',
    start_date: new Date().toISOString().split('T')[0],
    first_payment_date: addMonths(new Date(), 1).toISOString().split('T')[0],
    payment_frequency: 'monthly' as PaymentFrequency,
    loan_type: '' as LoanType | '',
    collateral: '',
    notes: '',
    currency: baseCurrency,
  });

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [calculatedPayment, setCalculatedPayment] = useState<number>(0);
  const [totalInterest, setTotalInterest] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [isAddingVendor, setIsAddingVendor] = useState(false);

  useEffect(() => {
    loadVendors();
    if (isEdit && id) {
      loadLoan();
    }
  }, [id, isEdit]);

  useEffect(() => {
    calculatePayment();
  }, [
    formData.principal_amount,
    formData.interest_rate,
    formData.term_months,
    formData.payment_frequency
  ]);

  const loadVendors = async () => {
    if (!user) return;
    try {
      const data = await getVendors(user.id);
      setVendors(data || []);
    } catch (err) {
      console.error('Error loading vendors:', err);
    }
  };

  const loadLoan = async () => {
    if (!user || !id) return;

    try {
      setLoading(true);
      const loan = await getLoan(id, user.id);

      setFormData({
        loan_number: loan.loan_number || '',
        lender_name: loan.lender_name || '',
        vendor_id: loan.vendor_id || '',
        principal_amount: loan.principal_amount.toString(),
        interest_rate: loan.interest_rate.toString(),
        term_months: loan.term_months.toString(),
        start_date: loan.start_date,
        first_payment_date: loan.first_payment_date,
        payment_frequency: loan.payment_frequency,
        loan_type: loan.loan_type || '',
        collateral: loan.collateral || '',
        notes: loan.notes || '',
        currency: loan.currency || baseCurrency,
      });
    } catch (err: any) {
      console.error('Error loading loan:', err);
      setError(err.message || 'Failed to load loan');
    } finally {
      setLoading(false);
    }
  };

  const calculatePayment = () => {
    const principal = parseFloat(formData.principal_amount);
    const rate = parseFloat(formData.interest_rate);
    const term = parseInt(formData.term_months);

    if (principal > 0 && rate >= 0 && term > 0) {
      const payment = loanService.calculatePaymentAmount(
        principal,
        rate,
        term,
        formData.payment_frequency
      );
      setCalculatedPayment(payment);

      const interest = loanService.calculateTotalInterest(
        principal,
        rate,
        term,
        formData.payment_frequency
      );
      setTotalInterest(interest);
    } else {
      setCalculatedPayment(0);
      setTotalInterest(0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVendorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vendorId = e.target.value;

    if (vendorId === 'add_new') {
      setShowVendorModal(true);
      return;
    }

    const selectedVendor = vendors.find(v => v.id === vendorId);
    setFormData(prev => ({
      ...prev,
      vendor_id: vendorId,
      lender_name: selectedVendor?.name || prev.lender_name
    }));
  };

  const handleAddVendor = async () => {
    if (!user || !newVendorName.trim()) return;

    setIsAddingVendor(true);
    try {
      const vendor = await createVendor({
        user_id: user.id,
        name: newVendorName.trim(),
      });

      await loadVendors();
      setFormData(prev => ({
        ...prev,
        vendor_id: vendor.id,
        lender_name: vendor.name
      }));
      setShowVendorModal(false);
      setNewVendorName('');
    } catch (err: any) {
      console.error('Error creating vendor:', err);
      setError(err.message || 'Failed to create vendor');
    } finally {
      setIsAddingVendor(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.lender_name.trim()) {
      setError('Lender name is required');
      return false;
    }

    const principal = parseFloat(formData.principal_amount);
    if (!principal || principal <= 0) {
      setError('Principal amount must be greater than 0');
      return false;
    }

    const rate = parseFloat(formData.interest_rate);
    if (rate === undefined || rate < 0 || rate > 100) {
      setError('Interest rate must be between 0 and 100');
      return false;
    }

    const term = parseInt(formData.term_months);
    if (!term || term <= 0) {
      setError('Loan term must be greater than 0');
      return false;
    }

    if (!formData.start_date) {
      setError('Start date is required');
      return false;
    }

    if (!formData.first_payment_date) {
      setError('First payment date is required');
      return false;
    }

    if (new Date(formData.first_payment_date) < new Date(formData.start_date)) {
      setError('First payment date must be on or after start date');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const principal = parseFloat(formData.principal_amount);
      const rate = parseFloat(formData.interest_rate);
      const term = parseInt(formData.term_months);

      // Generate loan number if not provided
      const loanNumber = formData.loan_number.trim() || `LOAN-${Date.now()}`;

      // Calculate end date
      const endDate = addMonths(new Date(formData.start_date), term);

      const loanData = {
        loan_number: loanNumber,
        lender_name: formData.lender_name.trim(),
        vendor_id: formData.vendor_id || null,
        principal_amount: principal,
        interest_rate: rate,
        term_months: term,
        start_date: formData.start_date,
        end_date: format(endDate, 'yyyy-MM-dd'),
        first_payment_date: formData.first_payment_date,
        payment_frequency: formData.payment_frequency,
        monthly_payment: calculatedPayment,
        current_balance: principal,
        total_paid: 0,
        total_interest_paid: 0,
        total_principal_paid: 0,
        status: 'active',
        loan_type: formData.loan_type || null,
        collateral: formData.collateral.trim() || null,
        notes: formData.notes.trim() || null,
        currency: formData.currency,
      };

      let savedLoan;
      if (isEdit && id) {
        savedLoan = await updateLoan(id, loanData, user.id);
      } else {
        savedLoan = await createLoan(loanData, user.id);
      }

      // Generate and save amortization schedule
      const schedule = loanService.generateAmortizationSchedule(
        principal,
        rate,
        term,
        formData.first_payment_date,
        formData.payment_frequency
      );

      await saveLoanSchedule(savedLoan.id, schedule, user.id);

      navigate('/loans');
    } catch (err: any) {
      console.error('Error saving loan:', err);
      setError(err.message || 'Failed to save loan');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading loan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/loans')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Loans
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEdit ? 'Edit Loan' : 'Add New Loan'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isEdit ? 'Update loan details' : 'Enter loan information to track payments and amortization'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-indigo-600" />
              Loan Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Loan Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Number <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="loan_number"
                  value={formData.loan_number}
                  onChange={handleChange}
                  placeholder="Auto-generated if empty"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Vendor/Lender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lender <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.vendor_id}
                  onChange={handleVendorChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select or enter lender name</option>
                  {vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                  <option value="add_new">+ Add New Lender</option>
                </select>
              </div>

              {/* Lender Name (if not selected from vendors) */}
              {!formData.vendor_id && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lender Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      name="lender_name"
                      value={formData.lender_name}
                      onChange={handleChange}
                      required
                      placeholder="Enter lender name"
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Principal Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Principal Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    name="principal_amount"
                    value={formData.principal_amount}
                    onChange={handleChange}
                    required
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Interest Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interest Rate (%) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    name="interest_rate"
                    value={formData.interest_rate}
                    onChange={handleChange}
                    required
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0.00"
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Term (Months) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Term (Months) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="term_months"
                  value={formData.term_months}
                  onChange={handleChange}
                  required
                  min="1"
                  placeholder="60"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Payment Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Frequency <span className="text-red-500">*</span>
                </label>
                <select
                  name="payment_frequency"
                  value={formData.payment_frequency}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    required
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* First Payment Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Payment Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="date"
                    name="first_payment_date"
                    value={formData.first_payment_date}
                    onChange={handleChange}
                    required
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Loan Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Type <span className="text-gray-400">(Optional)</span>
                </label>
                <select
                  name="loan_type"
                  value={formData.loan_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select type</option>
                  <option value="business">Business Loan</option>
                  <option value="equipment">Equipment Loan</option>
                  <option value="line_of_credit">Line of Credit</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="personal">Personal Loan</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Collateral */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Collateral <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="collateral"
                  value={formData.collateral}
                  onChange={handleChange}
                  placeholder="Equipment, property, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes <span className="text-gray-400">(Optional)</span>
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Additional information about this loan..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Calculated Payment Summary */}
          {calculatedPayment > 0 && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-sm border border-indigo-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calculator className="h-5 w-5 mr-2 text-indigo-600" />
                Payment Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Payment Amount</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(calculatedPayment)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    per {formData.payment_frequency.replace('ly', '')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Interest</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(totalInterest)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">over loan life</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Repayment</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(parseFloat(formData.principal_amount || '0') + totalInterest)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">principal + interest</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/loans')}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  {isEdit ? 'Update Loan' : 'Create Loan'}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Add Vendor Modal */}
        {showVendorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Lender</h3>
              <input
                type="text"
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
                placeholder="Enter lender name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
                autoFocus
              />
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowVendorModal(false);
                    setNewVendorName('');
                  }}
                  disabled={isAddingVendor}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddVendor}
                  disabled={isAddingVendor || !newVendorName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                >
                  {isAddingVendor ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Lender
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
