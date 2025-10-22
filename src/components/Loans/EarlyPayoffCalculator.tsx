import React, { useState } from 'react';
import { X, Calculator, DollarSign, Calendar, TrendingDown, Zap } from 'lucide-react';
import { Loan } from '../../types';
import { calculateMonthlyPayment } from '../../services/loanService';
import { format, addMonths } from 'date-fns';

interface EarlyPayoffCalculatorProps {
  loan: Loan;
  formatCurrency: (amount: number, currency?: string) => string;
  onClose: () => void;
}

export const EarlyPayoffCalculator: React.FC<EarlyPayoffCalculatorProps> = ({
  loan,
  formatCurrency,
  onClose,
}) => {
  const [extraPayment, setExtraPayment] = useState<number>(0);
  const [calculation, setCalculation] = useState<{
    monthsSaved: number;
    interestSaved: number;
    newPayoffDate: Date;
    originalPayoffDate: Date;
  } | null>(null);

  const calculatePayoff = () => {
    const monthlyRate = loan.interest_rate / 100 / 12;
    const regularPayment = loan.monthly_payment;
    const currentBalance = loan.current_balance;

    // Calculate original payoff
    let originalBalance = currentBalance;
    let originalMonths = 0;
    let originalInterest = 0;

    while (originalBalance > 0 && originalMonths < 600) {
      const interestPayment = originalBalance * monthlyRate;
      const principalPayment = regularPayment - interestPayment;

      originalInterest += interestPayment;
      originalBalance -= principalPayment;
      originalMonths++;

      if (originalBalance < 0) originalBalance = 0;
    }

    // Calculate with extra payment
    let newBalance = currentBalance;
    let newMonths = 0;
    let newInterest = 0;
    const totalPayment = regularPayment + extraPayment;

    while (newBalance > 0 && newMonths < 600) {
      const interestPayment = newBalance * monthlyRate;
      const principalPayment = totalPayment - interestPayment;

      newInterest += interestPayment;
      newBalance -= principalPayment;
      newMonths++;

      if (newBalance < 0) newBalance = 0;
    }

    const monthsSaved = originalMonths - newMonths;
    const interestSaved = originalInterest - newInterest;

    const today = new Date();
    const originalPayoffDate = addMonths(today, originalMonths);
    const newPayoffDate = addMonths(today, newMonths);

    setCalculation({
      monthsSaved,
      interestSaved,
      newPayoffDate,
      originalPayoffDate,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Early Payoff Calculator</h2>
                <p className="text-indigo-100 text-sm">
                  See how extra payments can save you money
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

        {/* Content */}
        <div className="p-6">
          {/* Current Loan Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Current Loan Status</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Current Balance</p>
                <p className="font-bold text-gray-900">
                  {formatCurrency(loan.current_balance)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Monthly Payment</p>
                <p className="font-bold text-gray-900">
                  {formatCurrency(loan.monthly_payment)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Interest Rate</p>
                <p className="font-bold text-gray-900">{loan.interest_rate}%</p>
              </div>
              <div>
                <p className="text-gray-600">Remaining Term</p>
                <p className="font-bold text-gray-900">
                  {Math.ceil((loan.current_balance / loan.monthly_payment) * (loan.interest_rate > 0 ? 1.1 : 1))} months (approx)
                </p>
              </div>
            </div>
          </div>

          {/* Extra Payment Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Zap className="w-4 h-4 inline mr-1 text-yellow-500" />
              Extra Monthly Payment
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                value={extraPayment}
                onChange={(e) => setExtraPayment(parseFloat(e.target.value) || 0)}
                step="100"
                min="0"
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg font-semibold"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter how much extra you want to pay each month
            </p>
          </div>

          {/* Calculate Button */}
          <button
            onClick={calculatePayoff}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg"
          >
            <Calculator className="w-5 h-5" />
            Calculate Savings
          </button>

          {/* Results */}
          {calculation && (
            <div className="mt-6 space-y-4">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5" />
                  Your Savings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Time Saved</p>
                    <p className="text-3xl font-bold text-green-700">
                      {calculation.monthsSaved} months
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(calculation.monthsSaved / 12).toFixed(1)} years
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Interest Saved</p>
                    <p className="text-3xl font-bold text-green-700">
                      {formatCurrency(calculation.interestSaved)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Total savings over life of loan
                    </p>
                  </div>
                </div>
              </div>

              {/* Payoff Dates */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Payoff Timeline
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Original Payoff Date:</span>
                    <span className="font-semibold text-gray-900">
                      {format(calculation.originalPayoffDate, 'MMM dd, yyyy')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">New Payoff Date:</span>
                    <span className="font-semibold text-green-700">
                      {format(calculation.newPayoffDate, 'MMM dd, yyyy')}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-indigo-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">New Monthly Payment:</span>
                      <span className="text-lg font-bold text-indigo-700">
                        {formatCurrency(loan.monthly_payment + extraPayment)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tip */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>💡 Tip:</strong> Even small extra payments can make a big difference over time!
                  Try different amounts to see what works best for your budget.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
