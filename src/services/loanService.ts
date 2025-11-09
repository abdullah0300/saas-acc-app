// src/services/loanService.ts
// Loan management service with amortization calculations

import { addMonths, addYears, format, parseISO, differenceInDays } from 'date-fns';
import {
  Loan,
  LoanPayment,
  AmortizationEntry,
  LoanSummary,
  PaymentFrequency
} from '../types';

/**
 * Calculate monthly payment using the amortization formula
 * P = L[c(1 + c)^n]/[(1 + c)^n - 1]
 * Where:
 * P = Payment per period
 * L = Loan amount (principal)
 * c = Interest rate per period
 * n = Number of payments
 */
export const calculateMonthlyPayment = (
  principal: number,
  annualInterestRate: number,
  termMonths: number
): number => {
  if (annualInterestRate === 0) {
    return principal / termMonths;
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const payment =
    principal *
    (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  return Math.round(payment * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate payment amount based on frequency
 */
export const calculatePaymentAmount = (
  principal: number,
  annualInterestRate: number,
  termMonths: number,
  frequency: PaymentFrequency
): number => {
  const monthlyPayment = calculateMonthlyPayment(principal, annualInterestRate, termMonths);

  switch (frequency) {
    case 'monthly':
      return monthlyPayment;
    case 'quarterly':
      return monthlyPayment * 3;
    case 'yearly':
      return monthlyPayment * 12;
    default:
      return monthlyPayment;
  }
};

/**
 * Calculate the next payment date based on frequency
 */
export const getNextPaymentDate = (
  currentDate: Date | string,
  frequency: PaymentFrequency
): Date => {
  const date = typeof currentDate === 'string' ? parseISO(currentDate) : currentDate;

  switch (frequency) {
    case 'monthly':
      return addMonths(date, 1);
    case 'quarterly':
      return addMonths(date, 3);
    case 'yearly':
      return addYears(date, 1);
    default:
      return addMonths(date, 1);
  }
};

/**
 * Calculate total number of payments based on frequency
 */
export const getTotalPayments = (
  termMonths: number,
  frequency: PaymentFrequency
): number => {
  switch (frequency) {
    case 'monthly':
      return termMonths;
    case 'quarterly':
      return Math.ceil(termMonths / 3);
    case 'yearly':
      return Math.ceil(termMonths / 12);
    default:
      return termMonths;
  }
};

/**
 * Generate complete amortization schedule
 */
export const generateAmortizationSchedule = (
  principal: number,
  annualInterestRate: number,
  termMonths: number,
  startDate: string,
  frequency: PaymentFrequency = 'monthly'
): AmortizationEntry[] => {
  const schedule: AmortizationEntry[] = [];
  const monthlyPayment = calculateMonthlyPayment(principal, annualInterestRate, termMonths);
  const monthlyRate = annualInterestRate / 100 / 12;

  let balance = principal;
  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;
  let paymentDate = parseISO(startDate);
  const totalPayments = getTotalPayments(termMonths, frequency);

  for (let i = 1; i <= totalPayments; i++) {
    // Calculate interest for this period
    let interestPayment: number;
    let principalPayment: number;
    let totalPayment: number;

    if (frequency === 'monthly') {
      interestPayment = balance * monthlyRate;
      principalPayment = monthlyPayment - interestPayment;
      totalPayment = monthlyPayment;
    } else if (frequency === 'quarterly') {
      // Quarterly: accumulate 3 months of payments
      let quarterInterest = 0;
      let quarterPrincipal = 0;
      let tempBalance = balance;

      for (let j = 0; j < 3; j++) {
        const monthInterest = tempBalance * monthlyRate;
        const monthPrincipal = monthlyPayment - monthInterest;
        quarterInterest += monthInterest;
        quarterPrincipal += monthPrincipal;
        tempBalance -= monthPrincipal;
      }

      interestPayment = quarterInterest;
      principalPayment = quarterPrincipal;
      totalPayment = monthlyPayment * 3;
    } else {
      // Yearly: accumulate 12 months of payments
      let yearInterest = 0;
      let yearPrincipal = 0;
      let tempBalance = balance;

      for (let j = 0; j < 12; j++) {
        const monthInterest = tempBalance * monthlyRate;
        const monthPrincipal = monthlyPayment - monthInterest;
        yearInterest += monthInterest;
        yearPrincipal += monthPrincipal;
        tempBalance -= monthPrincipal;
      }

      interestPayment = yearInterest;
      principalPayment = yearPrincipal;
      totalPayment = monthlyPayment * 12;
    }

    // Adjust for final payment (handle rounding)
    if (i === totalPayments) {
      principalPayment = balance;
      totalPayment = principalPayment + interestPayment;
    }

    balance -= principalPayment;
    cumulativeInterest += interestPayment;
    cumulativePrincipal += principalPayment;

    // Ensure balance doesn't go negative due to rounding
    if (balance < 0) balance = 0;

    schedule.push({
      payment_number: i,
      payment_date: format(paymentDate, 'yyyy-MM-dd'),
      beginning_balance: Math.round((balance + principalPayment) * 100) / 100,
      total_payment: Math.round(totalPayment * 100) / 100,
      principal_payment: Math.round(principalPayment * 100) / 100,
      interest_payment: Math.round(interestPayment * 100) / 100,
      ending_balance: Math.round(balance * 100) / 100,
      cumulative_interest: Math.round(cumulativeInterest * 100) / 100,
      cumulative_principal: Math.round(cumulativePrincipal * 100) / 100,
    });

    // Move to next payment date
    paymentDate = getNextPaymentDate(paymentDate, frequency);
  }

  return schedule;
};

/**
 * Calculate total interest over the life of the loan
 */
export const calculateTotalInterest = (
  principal: number,
  annualInterestRate: number,
  termMonths: number,
  frequency: PaymentFrequency = 'monthly'
): number => {
  const schedule = generateAmortizationSchedule(
    principal,
    annualInterestRate,
    termMonths,
    format(new Date(), 'yyyy-MM-dd'),
    frequency
  );

  const lastEntry = schedule[schedule.length - 1];
  return lastEntry?.cumulative_interest || 0;
};

/**
 * Find the next upcoming payment in the schedule
 */
export const findNextPayment = (
  schedule: AmortizationEntry[],
  paidPayments: LoanPayment[]
): AmortizationEntry | null => {
  const paidPaymentNumbers = new Set(
    paidPayments.filter(p => p.status === 'paid').map(p => p.payment_number)
  );

  // Find first unpaid payment
  for (const entry of schedule) {
    if (!paidPaymentNumbers.has(entry.payment_number)) {
      return entry;
    }
  }

  return null;
};

/**
 * Check if a payment is overdue
 */
export const isPaymentOverdue = (dueDate: string): boolean => {
  const today = new Date();
  const due = parseISO(dueDate);
  return differenceInDays(today, due) > 0;
};

/**
 * Calculate loan progress percentage
 */
export const calculateLoanProgress = (loan: Loan): number => {
  if (loan.principal_amount === 0) return 0;
  return Math.round((loan.total_principal_paid / loan.principal_amount) * 100);
};

/**
 * Calculate remaining balance after a payment
 */
export const calculateRemainingBalance = (
  currentBalance: number,
  principalPaid: number
): number => {
  const remaining = currentBalance - principalPaid;
  return Math.max(0, Math.round(remaining * 100) / 100);
};

/**
 * Get loan summary statistics
 */
export const calculateLoanSummary = (loans: Loan[]): LoanSummary => {
  const activeLoans = loans.filter(l => l.status === 'active');

  const summary: LoanSummary = {
    total_loans: loans.length,
    active_loans: activeLoans.length,
    total_principal: 0,
    total_balance: 0,
    total_paid: 0,
    total_interest_paid: 0,
    monthly_payment_total: 0,
  };

  for (const loan of activeLoans) {
    summary.total_principal += loan.principal_amount;
    summary.total_balance += loan.current_balance;
    summary.total_paid += loan.total_paid;
    summary.total_interest_paid += loan.total_interest_paid;

    // Convert to monthly equivalent
    if (loan.payment_frequency === 'monthly') {
      summary.monthly_payment_total += loan.monthly_payment;
    } else if (loan.payment_frequency === 'quarterly') {
      summary.monthly_payment_total += loan.monthly_payment / 3;
    } else if (loan.payment_frequency === 'yearly') {
      summary.monthly_payment_total += loan.monthly_payment / 12;
    }
  }

  // Find next payment due across all loans
  let earliestPayment: { date: string; amount: number; loan_name: string } | undefined;

  for (const loan of activeLoans) {
    if (loan.next_payment) {
      const paymentDate = loan.next_payment.due_date;
      if (!earliestPayment || paymentDate < earliestPayment.date) {
        earliestPayment = {
          date: paymentDate,
          amount: loan.next_payment.total_payment,
          loan_name: loan.lender_name,
        };
      }
    }
  }

  if (earliestPayment) {
    summary.next_payment_due = earliestPayment;
  }

  // Round all numbers
  summary.total_principal = Math.round(summary.total_principal * 100) / 100;
  summary.total_balance = Math.round(summary.total_balance * 100) / 100;
  summary.total_paid = Math.round(summary.total_paid * 100) / 100;
  summary.total_interest_paid = Math.round(summary.total_interest_paid * 100) / 100;
  summary.monthly_payment_total = Math.round(summary.monthly_payment_total * 100) / 100;

  return summary;
};

/**
 * Format currency for display
 */
export const formatLoanCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Validate loan data
 */
export const validateLoanData = (data: Partial<Loan>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.lender_name || data.lender_name.trim() === '') {
    errors.push('Lender name is required');
  }

  if (!data.principal_amount || data.principal_amount <= 0) {
    errors.push('Principal amount must be greater than 0');
  }

  if (data.interest_rate === undefined || data.interest_rate < 0 || data.interest_rate > 100) {
    errors.push('Interest rate must be between 0 and 100');
  }

  if (!data.term_months || data.term_months <= 0) {
    errors.push('Loan term must be greater than 0');
  }

  if (!data.start_date) {
    errors.push('Start date is required');
  }

  if (!data.first_payment_date) {
    errors.push('First payment date is required');
  }

  if (data.start_date && data.first_payment_date) {
    const start = parseISO(data.start_date);
    const firstPayment = parseISO(data.first_payment_date);
    if (firstPayment < start) {
      errors.push('First payment date must be on or after start date');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const loanService = {
  calculateMonthlyPayment,
  calculatePaymentAmount,
  getNextPaymentDate,
  getTotalPayments,
  generateAmortizationSchedule,
  calculateTotalInterest,
  findNextPayment,
  isPaymentOverdue,
  calculateLoanProgress,
  calculateRemainingBalance,
  calculateLoanSummary,
  formatLoanCurrency,
  validateLoanData,
};
