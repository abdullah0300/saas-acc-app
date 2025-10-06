import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  TrendingDown,
  Percent,
  Building2,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Landmark,
  CreditCard,
  Download,
  Calculator,
  Eye,
  ExternalLink,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getLoan, deleteLoan, getLoanSchedule, getLoanPayments, deleteLoanPayment } from '../../services/database';
import { Loan, LoanSchedule, LoanPayment, AmortizationEntry } from '../../types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { RecordPaymentModal } from './RecordPaymentModal';
import { EarlyPayoffCalculator } from './EarlyPayoffCalculator';

export const LoanView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [schedule, setSchedule] = useState<LoanSchedule | null>(null);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeletePaymentModal, setShowDeletePaymentModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<LoanPayment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [interestExpenseAmount, setInterestExpenseAmount] = useState<number>(0);

  useEffect(() => {
    loadLoanData();
  }, [id]);

  const loadLoanData = async () => {
    if (!user || !id) return;

    try {
      setLoading(true);
      setError('');

      const [loanData, scheduleData, paymentsData] = await Promise.all([
        getLoan(id, user.id),
        getLoanSchedule(id, user.id),
        getLoanPayments(id, user.id),
      ]);

      setLoan(loanData);
      setSchedule(scheduleData);
      setPayments(paymentsData || []);
    } catch (err: any) {
      console.error('Error loading loan data:', err);
      setError(err.message || 'Failed to load loan details');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentRecorded = async (interestAmount?: number) => {
    await loadLoanData();

    if (interestAmount && interestAmount > 0) {
      setInterestExpenseAmount(interestAmount);
      setShowSuccessBanner(true);

      // Auto-hide banner after 10 seconds
      setTimeout(() => {
        setShowSuccessBanner(false);
      }, 10000);
    }
  };

  const handleDelete = async () => {
    if (!user || !id) return;

    try {
      setDeleting(true);
      await deleteLoan(id, user.id);
      navigate('/loans');
    } catch (err: any) {
      console.error('Error deleting loan:', err);
      setError(err.message || 'Failed to delete loan');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!user || !paymentToDelete) return;

    try {
      setDeletingPayment(true);
      await deleteLoanPayment(paymentToDelete.id, user.id);
      setShowDeletePaymentModal(false);
      setPaymentToDelete(null);
      // Reload loan data to refresh totals
      await loadLoanData();
    } catch (err: any) {
      console.error('Error deleting payment:', err);
      setError(err.message || 'Failed to delete payment');
    } finally {
      setDeletingPayment(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'paid_off':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'defaulted':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentStatusBadge = (
    entry: AmortizationEntry,
    paidPayments: LoanPayment[]
  ) => {
    const isPaid = paidPayments.some(
      (p) => p.payment_number === entry.payment_number && p.status === 'paid'
    );
    const isScheduled = paidPayments.some(
      (p) => p.payment_number === entry.payment_number && p.status === 'scheduled'
    );
    const isOverdue =
      !isPaid &&
      !isScheduled &&
      differenceInDays(new Date(), parseISO(entry.payment_date)) > 0;

    if (isPaid) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full border border-green-200">
          <CheckCircle className="w-3 h-3" />
          Paid
        </span>
      );
    }

    if (isScheduled) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-50 rounded-full border border-yellow-200">
          <Clock className="w-3 h-3" />
          Scheduled
        </span>
      );
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-full border border-red-200">
          <AlertCircle className="w-3 h-3" />
          Overdue
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded-full border border-gray-200">
        <Calendar className="w-3 h-3" />
        Upcoming
      </span>
    );
  };

  const calculateProgress = () => {
    if (!loan || loan.principal_amount === 0) return 0;
    const paidPrincipal = loan.principal_amount - loan.current_balance;
    return Math.round((paidPrincipal / loan.principal_amount) * 100);
  };

  const getNextPayment = (): AmortizationEntry | null => {
    if (!schedule?.schedule_data) return null;

    const paidNumbers = new Set(
      payments.filter((p) => p.status === 'paid').map((p) => p.payment_number)
    );

    return (
      schedule.schedule_data.find(
        (entry: AmortizationEntry) => !paidNumbers.has(entry.payment_number)
      ) || null
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading loan details...</p>
        </div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error || 'Loan not found'}</p>
        </div>
        <Link
          to="/loans"
          className="mt-4 inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Loans
        </Link>
      </div>
    );
  }

  const progress = calculateProgress();
  const nextPayment = getNextPayment();
  const totalInterest = schedule?.schedule_data
    ? schedule.schedule_data.reduce(
        (sum: number, entry: AmortizationEntry) => sum + entry.interest_payment,
        0
      )
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/loans"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {loan.loan_number}
            </h1>
            <p className="text-gray-600 mt-1">{loan.lender_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {loan.status === 'active' && (
            <>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-md"
              >
                <CreditCard className="w-4 h-4" />
                Record Payment
              </button>
              <button
                onClick={() => setShowCalculator(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-purple-300 rounded-lg text-purple-700 hover:bg-purple-50 transition-colors"
              >
                <Calculator className="w-4 h-4" />
                Early Payoff Calculator
              </button>
            </>
          )}
          <Link
            to={`/loans/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-6">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(
            loan.status
          )}`}
        >
          <Landmark className="w-4 h-4" />
          {loan.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {/* Success Banner */}
      {showSuccessBanner && (
        <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-4 shadow-sm animate-in fade-in slide-in-from-top-5 duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-green-900">
                  Payment Recorded Successfully!
                </h3>
                <p className="mt-1 text-sm text-green-800">
                  An expense of <span className="font-bold">{formatCurrency(interestExpenseAmount, loan.currency)}</span> was automatically created for the interest portion.{' '}
                  <Link to="/expenses" className="underline font-medium hover:text-green-900">
                    View Expenses →
                  </Link>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSuccessBanner(false)}
              className="text-green-600 hover:text-green-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Balance</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(loan.current_balance, loan.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Monthly Payment</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(loan.monthly_payment, loan.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Percent className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Interest Rate</p>
              <p className="text-xl font-bold text-gray-900">
                {loan.interest_rate}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Progress</p>
              <p className="text-xl font-bold text-gray-900">{progress}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Loan Progress</h3>
          <span className="text-sm text-gray-600">
            {formatCurrency(
              loan.principal_amount - loan.current_balance,
              loan.currency
            )}{' '}
            of {formatCurrency(loan.principal_amount, loan.currency)} paid
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
            style={{ width: `${progress}%` }}
          >
            {progress > 10 && (
              <span className="text-xs font-bold text-white">{progress}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Loan Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Loan Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Principal Amount
            </label>
            <p className="mt-1 text-gray-900">
              {formatCurrency(loan.principal_amount, loan.currency)}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Interest Rate
            </label>
            <p className="mt-1 text-gray-900">{loan.interest_rate}%</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Term</label>
            <p className="mt-1 text-gray-900">{loan.term_months} months</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Payment Frequency
            </label>
            <p className="mt-1 text-gray-900 capitalize">
              {loan.payment_frequency}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Start Date
            </label>
            <p className="mt-1 text-gray-900">
              {format(parseISO(loan.start_date), 'MMM dd, yyyy')}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">End Date</label>
            <p className="mt-1 text-gray-900">
              {format(parseISO(loan.end_date), 'MMM dd, yyyy')}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              First Payment Date
            </label>
            <p className="mt-1 text-gray-900">
              {format(parseISO(loan.first_payment_date), 'MMM dd, yyyy')}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Total Interest
            </label>
            <p className="mt-1 text-gray-900">
              {formatCurrency(totalInterest, loan.currency)}
            </p>
          </div>

          {loan.loan_type && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Loan Type
              </label>
              <p className="mt-1 text-gray-900 capitalize">
                {loan.loan_type.replace('_', ' ')}
              </p>
            </div>
          )}

          {loan.collateral && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Collateral
              </label>
              <p className="mt-1 text-gray-900">{loan.collateral}</p>
            </div>
          )}

          {loan.vendor && (
            <div>
              <label className="text-sm font-medium text-gray-700">Vendor</label>
              <p className="mt-1 text-gray-900">{loan.vendor.name}</p>
            </div>
          )}

          {loan.notes && (
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <p className="mt-1 text-gray-900 whitespace-pre-wrap">
                {loan.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Next Payment Alert */}
      {nextPayment && loan.status === 'active' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-900">
                Next Payment Due
              </h3>
              <p className="text-sm text-yellow-800 mt-1">
                Payment #{nextPayment.payment_number} of {loan.term_months} due
                on {format(parseISO(nextPayment.payment_date), 'MMM dd, yyyy')}{' '}
                - {formatCurrency(nextPayment.total_payment, loan.currency)}
              </p>
              <div className="text-xs text-yellow-700 mt-2">
                Principal: {formatCurrency(nextPayment.principal_payment, loan.currency)} |
                Interest: {formatCurrency(nextPayment.interest_payment, loan.currency)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Payment History
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                {payments.length} payment{payments.length !== 1 ? 's' : ''} made
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Payment #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Date Paid
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Total Paid
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Principal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Interest
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Proof
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments
                  .sort((a, b) => b.payment_number - a.payment_number)
                  .map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{payment.payment_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {format(parseISO(payment.payment_date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">
                        {formatCurrency(payment.total_payment, loan.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                        {formatCurrency(payment.principal_amount, loan.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                        {formatCurrency(payment.interest_amount, loan.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
                          {payment.payment_method?.replace('_', ' ').toUpperCase() || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full border border-green-200">
                          <CheckCircle className="w-3 h-3" />
                          {payment.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {payment.payment_proof_url ? (
                          <a
                            href={payment.payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors"
                            title="View payment proof"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-xs">View</span>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => {
                            setPaymentToDelete(payment);
                            setShowDeletePaymentModal(true);
                          }}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Delete payment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Total Paid</p>
                <p className="font-bold text-gray-900 text-lg">
                  {formatCurrency(
                    payments.reduce((sum, p) => sum + p.total_payment, 0),
                    loan.currency
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Principal Paid</p>
                <p className="font-bold text-green-700 text-lg">
                  {formatCurrency(
                    payments.reduce((sum, p) => sum + p.principal_amount, 0),
                    loan.currency
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Interest Paid</p>
                <p className="font-bold text-orange-700 text-lg">
                  {formatCurrency(
                    payments.reduce((sum, p) => sum + p.interest_amount, 0),
                    loan.currency
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Amortization Schedule */}
      {schedule?.schedule_data && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Amortization Schedule
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Principal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Interest
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schedule.schedule_data.map((entry: AmortizationEntry) => {
                  const isPaid = payments.some(
                    (p) =>
                      p.payment_number === entry.payment_number &&
                      p.status === 'paid'
                  );

                  return (
                    <tr
                      key={entry.payment_number}
                      className={isPaid ? 'bg-green-50' : 'hover:bg-gray-50'}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {entry.payment_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {format(parseISO(entry.payment_date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                        {formatCurrency(entry.total_payment, loan.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                        {formatCurrency(entry.principal_payment, loan.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                        {formatCurrency(entry.interest_payment, loan.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                        {formatCurrency(entry.ending_balance, loan.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getPaymentStatusBadge(entry, payments)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <RecordPaymentModal
          loan={loan}
          nextPayment={nextPayment}
          existingPayments={payments}
          onClose={() => setShowPaymentModal(false)}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}

      {/* Early Payoff Calculator */}
      {showCalculator && (
        <EarlyPayoffCalculator
          loan={loan}
          formatCurrency={formatCurrency}
          onClose={() => setShowCalculator(false)}
        />
      )}

      {/* Delete Payment Confirmation Modal */}
      {showDeletePaymentModal && paymentToDelete && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Payment
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Are you sure you want to delete payment #{paymentToDelete.payment_number}?
                  The loan balance will be recalculated automatically.
                </p>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                  <p className="text-gray-700">
                    Amount: <span className="font-semibold">{formatCurrency(paymentToDelete.total_payment, loan.currency)}</span>
                  </p>
                  <p className="text-gray-700">
                    Date: {format(parseISO(paymentToDelete.payment_date), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowDeletePaymentModal(false);
                      setPaymentToDelete(null);
                    }}
                    disabled={deletingPayment}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeletePayment}
                    disabled={deletingPayment}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {deletingPayment ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Payment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Loan Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Loan
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Are you sure you want to delete this loan? This action cannot
                  be undone. The loan will be archived and can be recovered if
                  needed.
                </p>
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
