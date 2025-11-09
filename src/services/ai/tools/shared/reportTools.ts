/**
 * Report Tools - Query-only operations for financial reports
 * Provides summaries and directs users to UI for detailed analysis
 */

import { getIncomes, getExpenses, getCreditNotes, getInvoices, getClients } from '../../../database';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';

/**
 * Get comprehensive financial summary (Profit & Loss)
 * Returns revenue, expenses, profit, margins, and top categories
 */
export const getReportSummaryTool = async (
  userId: string,
  filters?: {
    start_date?: string;
    end_date?: string;
  }
): Promise<{
  success: boolean;
  data?: {
    period: {
      start: string;
      end: string;
      label: string;
    };
    revenue: {
      gross: number;
      creditNotes: number;
      net: number;
      transactionCount: number;
    };
    expenses: {
      total: number;
      transactionCount: number;
    };
    profit: {
      amount: number;
      margin: number;
      vs_previous_period?: {
        amount_change: number;
        percent_change: number;
      };
    };
    top_income_categories: Array<{ name: string; amount: number; percentage: number }>;
    top_expense_categories: Array<{ name: string; amount: number; percentage: number }>;
  };
  error?: string;
}> => {
  try {
    console.log('[getReportSummaryTool] Fetching report summary for user:', userId);
    console.log('[getReportSummaryTool] Filters:', JSON.stringify(filters, null, 2));

    // Determine date range
    const endDate = filters?.end_date || format(new Date(), 'yyyy-MM-dd');
    const startDate = filters?.start_date || format(startOfMonth(new Date()), 'yyyy-MM-dd');

    // Calculate previous period for comparison
    const periodStart = parseISO(startDate);
    const periodEnd = parseISO(endDate);
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = format(subMonths(periodStart, Math.ceil(daysDiff / 30)), 'yyyy-MM-dd');
    const prevEnd = format(subMonths(periodEnd, Math.ceil(daysDiff / 30)), 'yyyy-MM-dd');

    // Fetch current period data
    const [incomes, expenses, creditNotes] = await Promise.all([
      getIncomes(userId, startDate, endDate),
      getExpenses(userId, startDate, endDate),
      getCreditNotes(userId, startDate, endDate)
    ]);

    // Fetch previous period data for comparison
    const [prevIncomes, prevExpenses, prevCreditNotes] = await Promise.all([
      getIncomes(userId, prevStart, prevEnd),
      getExpenses(userId, prevStart, prevEnd),
      getCreditNotes(userId, prevStart, prevEnd)
    ]);

    console.log('[getReportSummaryTool] Data counts:', {
      incomes: incomes.length,
      expenses: expenses.length,
      creditNotes: creditNotes.length
    });

    // Calculate revenue (using base_amount for multi-currency support)
    const grossRevenue = incomes
      .filter(inc => !inc.credit_note_id) // Exclude credit note entries
      .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);

    const creditNoteAmount = creditNotes
      .filter(cn => cn.applied_to_income)
      .reduce((sum, cn) => sum + (cn.base_amount || cn.total), 0);

    const netRevenue = grossRevenue - creditNoteAmount;

    // Calculate expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);

    // Calculate profit
    const profit = netRevenue - totalExpenses;
    const profitMargin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

    // Calculate previous period profit for comparison
    const prevGrossRevenue = prevIncomes
      .filter(inc => !inc.credit_note_id)
      .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);
    const prevCreditNoteAmount = prevCreditNotes
      .filter(cn => cn.applied_to_income)
      .reduce((sum, cn) => sum + (cn.base_amount || cn.total), 0);
    const prevNetRevenue = prevGrossRevenue - prevCreditNoteAmount;
    const prevTotalExpenses = prevExpenses.reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);
    const prevProfit = prevNetRevenue - prevTotalExpenses;

    // Calculate category breakdowns
    const incomeByCat = new Map<string, number>();
    incomes
      .filter(inc => !inc.credit_note_id)
      .forEach(inc => {
        const catName = inc.category?.name || 'Uncategorized';
        incomeByCat.set(catName, (incomeByCat.get(catName) || 0) + (inc.base_amount || inc.amount));
      });

    const expenseByCat = new Map<string, number>();
    expenses.forEach(exp => {
      const catName = exp.category?.name || 'Uncategorized';
      expenseByCat.set(catName, (expenseByCat.get(catName) || 0) + (exp.base_amount || exp.amount));
    });

    // Sort and get top 5 categories
    const topIncomeCategories = Array.from(incomeByCat.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: netRevenue > 0 ? (amount / netRevenue) * 100 : 0
      }));

    const topExpenseCategories = Array.from(expenseByCat.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
      }));

    // Determine period label
    let periodLabel = 'Custom period';
    if (!filters?.start_date && !filters?.end_date) {
      periodLabel = 'This month';
    } else if (startDate === format(startOfMonth(new Date()), 'yyyy-MM-dd')) {
      periodLabel = 'This month';
    }

    const result = {
      success: true,
      data: {
        period: {
          start: startDate,
          end: endDate,
          label: periodLabel
        },
        revenue: {
          gross: grossRevenue,
          creditNotes: creditNoteAmount,
          net: netRevenue,
          transactionCount: incomes.filter(inc => !inc.credit_note_id).length
        },
        expenses: {
          total: totalExpenses,
          transactionCount: expenses.length
        },
        profit: {
          amount: profit,
          margin: profitMargin,
          vs_previous_period: {
            amount_change: profit - prevProfit,
            percent_change: prevProfit !== 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : 0
          }
        },
        top_income_categories: topIncomeCategories,
        top_expense_categories: topExpenseCategories
      }
    };

    console.log('[getReportSummaryTool] Summary calculated successfully');
    return result;

  } catch (error: any) {
    console.error('[getReportSummaryTool] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate report summary'
    };
  }
};

/**
 * Get tax summary for a period
 * Returns tax collected, paid, and net liability
 */
export const getTaxSummaryTool = async (
  userId: string,
  filters?: {
    start_date?: string;
    end_date?: string;
  }
): Promise<{
  success: boolean;
  data?: {
    period: {
      start: string;
      end: string;
      label: string;
    };
    tax_collected: {
      amount: number;
      from_sales: number;
    };
    credit_note_adjustment: {
      amount: number;
    };
    tax_paid: {
      amount: number;
      on_purchases: number;
    };
    net_tax_liability: number;
    effective_rate: number;
  };
  error?: string;
}> => {
  try {
    console.log('[getTaxSummaryTool] Fetching tax summary for user:', userId);

    // Determine date range
    const endDate = filters?.end_date || format(new Date(), 'yyyy-MM-dd');
    const startDate = filters?.start_date || format(startOfMonth(new Date()), 'yyyy-MM-dd');

    // Fetch data
    const [incomes, expenses, creditNotes] = await Promise.all([
      getIncomes(userId, startDate, endDate),
      getExpenses(userId, startDate, endDate),
      getCreditNotes(userId, startDate, endDate)
    ]);

    // Calculate tax collected from sales
    const taxCollected = incomes
      .filter(inc => !inc.credit_note_id)
      .reduce((sum, inc) => {
        const taxAmount = inc.tax_amount || 0;
        return sum + taxAmount;
      }, 0);

    const salesAmount = incomes
      .filter(inc => !inc.credit_note_id)
      .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);

    // Calculate credit note tax adjustment
    const creditNoteTaxAdjustment = creditNotes
      .filter(cn => cn.applied_to_income)
      .reduce((sum, cn) => {
        // Sum up tax from credit note items
        const cnTax = cn.items?.reduce((itemSum, item) => {
          return itemSum + (item.tax_amount || 0);
        }, 0) || 0;
        return sum + cnTax;
      }, 0);

    // Calculate tax paid on purchases
    const taxPaid = expenses.reduce((sum, exp) => {
      const taxAmount = exp.tax_amount || 0;
      return sum + taxAmount;
    }, 0);

    const purchaseAmount = expenses.reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);

    // Calculate net tax liability
    const netTaxLiability = taxCollected - creditNoteTaxAdjustment - taxPaid;

    // Calculate effective tax rate
    const effectiveRate = salesAmount > 0 ? (taxCollected / salesAmount) * 100 : 0;

    // Determine period label
    let periodLabel = 'Custom period';
    if (!filters?.start_date && !filters?.end_date) {
      periodLabel = 'This month';
    }

    return {
      success: true,
      data: {
        period: {
          start: startDate,
          end: endDate,
          label: periodLabel
        },
        tax_collected: {
          amount: taxCollected,
          from_sales: salesAmount
        },
        credit_note_adjustment: {
          amount: creditNoteTaxAdjustment
        },
        tax_paid: {
          amount: taxPaid,
          on_purchases: purchaseAmount
        },
        net_tax_liability: netTaxLiability,
        effective_rate: effectiveRate
      }
    };

  } catch (error: any) {
    console.error('[getTaxSummaryTool] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate tax summary'
    };
  }
};

/**
 * Get client profitability summary
 * Returns top clients by revenue and their metrics
 */
export const getClientSummaryTool = async (
  userId: string,
  filters?: {
    limit?: number; // How many top clients to return (default 10)
  }
): Promise<{
  success: boolean;
  data?: {
    total_clients: number;
    active_clients: number; // Clients with transactions in last 90 days
    top_clients: Array<{
      id: string;
      name: string;
      company_name?: string;
      gross_revenue: number;
      credit_amount: number;
      net_revenue: number;
      invoice_count: number;
      outstanding_amount: number;
      last_payment_date?: string;
    }>;
  };
  error?: string;
}> => {
  try {
    console.log('[getClientSummaryTool] Fetching client summary for user:', userId);

    const limit = filters?.limit || 10;

    // Fetch all clients
    const clients = await getClients(userId);

    // Fetch all invoices and incomes (no date filter for complete picture)
    const [invoices, incomes, creditNotes] = await Promise.all([
      getInvoices(userId),
      getIncomes(userId),
      getCreditNotes(userId)
    ]);

    console.log('[getClientSummaryTool] Fetched data:', {
      clients: clients.length,
      invoices: invoices.length,
      incomes: incomes.length,
      creditNotes: creditNotes.length
    });

    // Calculate metrics per client
    const clientMetrics = clients.map(client => {
      // Get client's invoices
      const clientInvoices = invoices.filter(inv => inv.client_id === client.id);

      // Get client's incomes
      const clientIncomes = incomes.filter(inc => inc.client_id === client.id && !inc.credit_note_id);

      // Get client's credit notes
      const clientCreditNotes = creditNotes.filter(cn => cn.client_id === client.id && cn.applied_to_income);

      // Calculate gross revenue (from both invoices and direct income)
      const invoiceRevenue = clientInvoices
        .filter(inv => inv.status === 'paid' || inv.status === 'partially_paid')
        .reduce((sum, inv) => sum + (inv.base_amount || inv.total), 0);

      const directIncome = clientIncomes.reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);

      const grossRevenue = invoiceRevenue + directIncome;

      // Calculate credit note amount
      const creditAmount = clientCreditNotes.reduce((sum, cn) => sum + (cn.base_amount || cn.total), 0);

      // Net revenue
      const netRevenue = grossRevenue - creditAmount;

      // Outstanding amount (balance_due is already calculated in Invoice type)
      const outstanding = clientInvoices
        .filter(inv => inv.status === 'sent' || inv.status === 'overdue' || inv.status === 'partially_paid')
        .reduce((sum, inv) => {
          return sum + (inv.balance_due || 0);
        }, 0);

      // Last payment date
      const paidInvoices = clientInvoices
        .filter(inv => inv.paid_date)
        .sort((a, b) => new Date(b.paid_date!).getTime() - new Date(a.paid_date!).getTime());

      const lastPaymentDate = paidInvoices[0]?.paid_date;

      return {
        id: client.id,
        name: client.name,
        company_name: client.company_name,
        gross_revenue: grossRevenue,
        credit_amount: creditAmount,
        net_revenue: netRevenue,
        invoice_count: clientInvoices.length,
        outstanding_amount: outstanding,
        last_payment_date: lastPaymentDate
      };
    });

    // Sort by net revenue and get top clients
    const topClients = clientMetrics
      .sort((a, b) => b.net_revenue - a.net_revenue)
      .slice(0, limit);

    // Count active clients (those with transactions in last 90 days)
    const ninetyDaysAgo = format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    const activeClients = clientMetrics.filter(client => {
      return client.last_payment_date && client.last_payment_date >= ninetyDaysAgo;
    }).length;

    return {
      success: true,
      data: {
        total_clients: clients.length,
        active_clients: activeClients,
        top_clients: topClients
      }
    };

  } catch (error: any) {
    console.error('[getClientSummaryTool] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate client summary'
    };
  }
};
