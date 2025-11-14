import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, DollarSign, Calendar, TrendingDown, AlertCircle, ArrowRight, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getLoans } from '../../services/database';
import { Loan } from '../../types';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';

export const LoanDashboardCard: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadLoans();
  }, [user]);

  const loadLoans = async () => {
    if (!user) return;

    try {
      // Only show loading skeleton on initial load
      if (isInitialLoad) {
        setLoading(true);
      }
      const data = await getLoans(user.id);
      // Only show active loans
      const activeLoans = data.filter(loan => loan.status === 'active');
      setLoans(activeLoans);
      setIsInitialLoad(false);
    } catch (err: any) {
      console.error('Error loading loans:', err);
      setError(err.message || 'Failed to load loans');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  // Only show loading skeleton on initial load
  if (loading && isInitialLoad) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-200 rounded-xl w-12 h-12"></div>
              <div className="h-6 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-600">Failed to load loans</p>
        </div>
      </div>
    );
  }

  const totalDebt = loans.reduce((sum, loan) => sum + loan.current_balance, 0);
  const monthlyPayment = loans.reduce((sum, loan) => sum + loan.monthly_payment, 0);
  const totalPaid = loans.reduce((sum, loan) => sum + loan.total_paid, 0);

  // Find next payment due date
  const today = startOfDay(new Date());
  const upcomingPayments = loans
    .filter(loan => loan.next_payment && isBefore(parseISO(loan.next_payment.due_date), startOfDay(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000))))
    .sort((a, b) => {
      if (!a.next_payment || !b.next_payment) return 0;
      return parseISO(a.next_payment.due_date).getTime() - parseISO(b.next_payment.due_date).getTime();
    });

  const nextPaymentDate = upcomingPayments.length > 0 && upcomingPayments[0].next_payment
    ? parseISO(upcomingPayments[0].next_payment.due_date)
    : null;

  // If no active loans, show empty state
  if (loans.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-indigo-50 rounded-2xl shadow-xl p-8 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-gray-400 to-gray-600 rounded-2xl">
              <Landmark className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Loan Management</h3>
              <p className="text-sm text-gray-600 mt-1">Track and manage your business loans</p>
            </div>
          </div>
          <Link
            to="/loans/new"
            className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Loan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-red-50 via-white to-orange-50 rounded-2xl shadow-xl p-6 border border-red-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-red-400 to-red-600 rounded-xl">
            <Landmark className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Active Loans</h3>
            <p className="text-sm text-gray-600">{loans.length} loan{loans.length > 1 ? 's' : ''} being tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/loans/new"
            className="inline-flex items-center px-4 py-2 bg-white border border-red-200 text-red-700 rounded-xl hover:bg-red-50 transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Loan
          </Link>
          <Link
            to="/loans"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-md group"
          >
            View All
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Debt */}
        <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Debt</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalDebt)}</p>
          <p className="text-xs text-gray-500 mt-1">Remaining balance</p>
        </div>

        {/* Monthly Payment */}
        <div className="bg-white rounded-xl p-4 border border-orange-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-orange-600" />
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Monthly Payment</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(monthlyPayment)}</p>
          <p className="text-xs text-gray-500 mt-1">Combined payments</p>
        </div>

        {/* Total Paid */}
        <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-emerald-600" />
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Paid</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-gray-500 mt-1">Amount repaid</p>
        </div>

        {/* Next Payment */}
        <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Next Payment</p>
          </div>
          {nextPaymentDate ? (
            <>
              <p className="text-2xl font-bold text-gray-900">{format(nextPaymentDate, 'MMM dd')}</p>
              <p className="text-xs text-gray-500 mt-1">{format(nextPaymentDate, 'yyyy')}</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-400">—</p>
              <p className="text-xs text-gray-500 mt-1">No upcoming</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
