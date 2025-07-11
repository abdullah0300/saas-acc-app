// src/services/insightsService.ts

import { format, subMonths, differenceInDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';

export interface Insight {
  id: string;
  type: 'warning' | 'success' | 'info' | 'action';
  title: string;
  message: string;
  icon?: string;
  action?: {
    label: string;
    link: string;
  };
  priority: number; // 1-10, higher is more important
}

export class InsightsEngine {
  // Helper to format currency
  // ✅ Updated to accept a currency formatter function
private static formatCurrency: (amount: number) => string = (amount: number) => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// ✅ New method to set the currency formatter
static setCurrencyFormatter(formatter: (amount: number) => string) {
  this.formatCurrency = formatter;
}

  // Helper to check if user is new (less than 2 months of data)
  private static isNewUser(oldestTransactionDate: Date | null): boolean {
    if (!oldestTransactionDate) return true;
    const monthsSinceStart = differenceInDays(new Date(), oldestTransactionDate) / 30;
    return monthsSinceStart < 2;
  }

  // Analyze revenue trends
  static analyzeRevenueTrends(
    currentMonthRevenue: number,
    lastMonthRevenue: number,
    avgMonthlyRevenue: number,
    monthsOfData: number = 1
  ): Insight[] {
    const insights: Insight[] = [];
    
    // For brand new users (first month)
    if (monthsOfData <= 1 || lastMonthRevenue === 0) {
      if (currentMonthRevenue > 0) {
        insights.push({
          id: 'first-revenue',
          type: 'success',
          title: 'Great start! 🚀',
          message: `You've generated ${this.formatCurrency(currentMonthRevenue)} in revenue. Track your growth by adding more invoices and income.`,
          action: {
            label: 'Create Invoice',
            link: '/invoices/new'
          },
          priority: 7
        });
      } else {
        insights.push({
          id: 'no-revenue-yet',
          type: 'info',
          title: 'Start earning revenue',
          message: 'Create your first invoice to start tracking income and unlock revenue insights.',
          action: {
            label: 'Create First Invoice',
            link: '/invoices/new'
          },
          priority: 8
        });
      }
      return insights;
    }
    
    // Calculate realistic growth (only if we have previous month data)
    const revenueGrowth = lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;

    // Significant revenue growth (but realistic)
    if (revenueGrowth > 20 && revenueGrowth < 200) {
      insights.push({
        id: 'revenue-growth',
        type: 'success',
        title: 'Revenue is growing! 📈',
        message: `Your revenue increased ${revenueGrowth.toFixed(0)}% from last month (${this.formatCurrency(lastMonthRevenue)} → ${this.formatCurrency(currentMonthRevenue)}). Keep up the momentum!`,
        priority: 8
      });
    }
    
    // Revenue decline warning
    if (revenueGrowth < -15) {
      insights.push({
        id: 'revenue-decline',
        type: 'warning',
        title: 'Revenue decreased this month',
        message: `Revenue dropped ${Math.abs(revenueGrowth).toFixed(0)}% from ${this.formatCurrency(lastMonthRevenue)} to ${this.formatCurrency(currentMonthRevenue)}. Time to follow up on pending invoices or reach out to past clients.`,
        action: {
          label: 'View Unpaid Invoices',
          link: '/invoices?status=unpaid'
        },
        priority: 9
      });
    }

    // Consistent revenue (good for established businesses)
    if (monthsOfData >= 3 && Math.abs(revenueGrowth) < 10) {
      insights.push({
        id: 'stable-revenue',
        type: 'info',
        title: 'Steady revenue flow',
        message: `Your revenue is consistent at around ${this.formatCurrency(avgMonthlyRevenue)}/month. Consider new growth strategies to increase income.`,
        priority: 5
      });
    }

    // Best month detection (only after 3+ months)
    if (monthsOfData >= 3 && currentMonthRevenue > avgMonthlyRevenue * 1.3) {
      const percentAboveAvg = ((currentMonthRevenue / avgMonthlyRevenue - 1) * 100);
      insights.push({
        id: 'best-month',
        type: 'success',
        title: 'Best month yet! 🎉',
        message: `Revenue is ${percentAboveAvg.toFixed(0)}% above your ${monthsOfData}-month average. You earned ${this.formatCurrency(currentMonthRevenue - avgMonthlyRevenue)} more than usual.`,
        priority: 7
      });
    }

    return insights;
  }

  // Analyze expense patterns
  static analyzeExpenses(
    currentMonthExpenses: number,
    lastMonthExpenses: number,
    revenue: number,
    topCategories: { name: string; amount: number }[]
  ): Insight[] {
    const insights: Insight[] = [];
    
    // Skip if no expenses yet
    if (currentMonthExpenses === 0 && lastMonthExpenses === 0) {
      insights.push({
        id: 'no-expenses',
        type: 'info',
        title: 'Track your expenses',
        message: 'Start adding expenses to see spending insights and identify savings opportunities.',
        action: {
          label: 'Add First Expense',
          link: '/expenses/new'
        },
        priority: 6
      });
      return insights;
    }

    const expenseGrowth = lastMonthExpenses > 0 
      ? ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 
      : 0;
    
    const expenseRatio = revenue > 0 ? (currentMonthExpenses / revenue) * 100 : 0;

    // Expense spike warning (only if significant)
    if (lastMonthExpenses > 0 && expenseGrowth > 30) {
      const increase = currentMonthExpenses - lastMonthExpenses;
      insights.push({
        id: 'expense-spike',
        type: 'warning',
        title: 'Expenses increased significantly',
        message: `You spent ${this.formatCurrency(increase)} more than last month (${expenseGrowth.toFixed(0)}% increase). Biggest spending was on ${topCategories[0]?.name || 'uncategorized items'}.`,
        action: {
          label: 'Review Expenses',
          link: '/expenses'
        },
        priority: 8
      });
    }

    // Good expense control
    if (lastMonthExpenses > 0 && expenseGrowth < -10) {
      const savings = lastMonthExpenses - currentMonthExpenses;
      insights.push({
        id: 'expense-reduction',
        type: 'success',
        title: 'Great job reducing expenses! 💰',
        message: `You saved ${this.formatCurrency(savings)} compared to last month. Keep monitoring to maintain these savings.`,
        priority: 6
      });
    }

    // High expense ratio (only if we have revenue)
    if (revenue > 100 && expenseRatio > 80) {
      const profitMargin = 100 - expenseRatio;
      insights.push({
        id: 'high-expense-ratio',
        type: 'warning',
        title: 'Low profit margins',
        message: `You're spending ${expenseRatio.toFixed(0)}% of revenue, leaving only ${profitMargin.toFixed(0)}% profit. Look for ways to reduce costs or increase prices.`,
        action: {
          label: 'Analyze Expenses',
          link: '/expenses'
        },
        priority: 9
      });
    }

    // Category-specific insights
    if (topCategories.length > 0 && topCategories[0].amount > currentMonthExpenses * 0.4) {
      insights.push({
        id: 'dominant-category',
        type: 'info',
        title: `High spending on ${topCategories[0].name}`,
        message: `${topCategories[0].name} represents ${((topCategories[0].amount / currentMonthExpenses) * 100).toFixed(0)}% of expenses (${this.formatCurrency(topCategories[0].amount)}). Review if this aligns with your budget.`,
        priority: 6
      });
    }

    return insights;
  }

  // Analyze cash flow
  static analyzeCashFlow(
    currentBalance: number,
    avgMonthlyExpenses: number,
    expectedIncome30Days: number,
    overdueAmount: number
  ): Insight[] {
    const insights: Insight[] = [];
    
    // Calculate realistic runway
    let monthsOfRunway = 999;
    if (avgMonthlyExpenses > 100) {
      monthsOfRunway = currentBalance / avgMonthlyExpenses;
    }
    
    // Critical cash warning
    if (avgMonthlyExpenses > 100 && monthsOfRunway < 2) {
      insights.push({
        id: 'low-cash',
        type: 'warning',
        title: monthsOfRunway < 1 ? 'Cash level needs attention 🚨' : 'Cash getting low',
        message: monthsOfRunway < 1 
          ? `Based on your spending, you have less than 1 month of expenses covered. Collect ${this.formatCurrency(overdueAmount)} in overdue payments.`
          : `You have ${monthsOfRunway.toFixed(1)} months of runway. Time to collect outstanding invoices.`,
        action: {
          label: overdueAmount > 0 ? 'Collect Overdue Payments' : 'Send Invoices',
          link: overdueAmount > 0 ? '/invoices?status=overdue' : '/invoices/new'
        },
        priority: 10
      });
    }

    // Healthy cash position (3-6 months)
    else if (avgMonthlyExpenses > 100 && monthsOfRunway >= 3 && monthsOfRunway <= 12) {
      insights.push({
        id: 'healthy-cash',
        type: 'success',
        title: 'Good cash position 💪',
        message: `You have ${Math.round(monthsOfRunway)} months of expenses covered. This is a healthy buffer for most businesses.`,
        priority: 5
      });
    }

    // Too much cash (opportunity cost)
    else if (avgMonthlyExpenses > 100 && monthsOfRunway > 12 && currentBalance > 50000) {
      insights.push({
        id: 'excess-cash',
        type: 'info',
        title: 'Consider investing excess cash',
        message: `With ${Math.round(monthsOfRunway)} months of runway, you might have excess cash. Consider investing in growth or earning interest on reserves.`,
        priority: 4
      });
    }

    // Overdue collections opportunity
    if (overdueAmount > 1000) {
      const percentOfBalance = currentBalance > 0 ? (overdueAmount / currentBalance) * 100 : 100;
      insights.push({
        id: 'overdue-collections',
        type: 'action',
        title: `Collect ${this.formatCurrency(overdueAmount)} in overdue payments`,
        message: percentOfBalance > 50 
          ? `Overdue invoices represent ${percentOfBalance.toFixed(0)}% of your current balance. Following up could significantly improve cash flow.`
          : `You have overdue invoices worth ${this.formatCurrency(overdueAmount)}. A quick follow-up could boost your cash position.`,
        action: {
          label: 'View Overdue Invoices',
          link: '/invoices?status=overdue'
        },
        priority: 9
      });
    }

    // Expected income insight
    if (expectedIncome30Days > currentBalance * 0.3) {
      insights.push({
        id: 'expected-income',
        type: 'info',
        title: 'Strong incoming cash flow',
        message: `You have ${this.formatCurrency(expectedIncome30Days)} expected in the next 30 days. Stay on top of collections to maintain cash flow.`,
        priority: 5
      });
    }

    return insights;
  }

  // Analyze invoice patterns
  static analyzeInvoices(
    invoices: any[],
    avgPaymentDays: number
  ): Insight[] {
    const insights: Insight[] = [];
    
    const unpaidInvoices = invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue');
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    
    // No invoices yet
    if (invoices.length === 0) {
      insights.push({
        id: 'no-invoices',
        type: 'info',
        title: 'Create your first invoice',
        message: 'Start sending invoices to track income and manage client payments effectively.',
        action: {
          label: 'Create Invoice',
          link: '/invoices/new'
        },
        priority: 8
      });
      return insights;
    }

    // Payment speed insights
    if (paidInvoices.length >= 5 && avgPaymentDays > 0) {
      if (avgPaymentDays <= 15) {
        insights.push({
          id: 'fast-payments',
          type: 'success',
          title: 'Clients pay quickly! ⚡',
          message: `Average payment time is just ${Math.round(avgPaymentDays)} days. Your payment process is working well.`,
          priority: 5
        });
      } else if (avgPaymentDays > 45) {
        insights.push({
          id: 'slow-payments',
          type: 'warning',
          title: 'Payments taking too long',
          message: `Clients take ${Math.round(avgPaymentDays)} days to pay on average. Consider requiring deposits or offering early payment discounts.`,
          action: {
            label: 'Update Payment Terms',
            link: '/settings/invoice'
          },
          priority: 7
        });
      }
    }

    // Multiple overdue invoices
    if (overdueInvoices.length >= 3) {
      const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const oldestDays = Math.max(...overdueInvoices.map(inv => 
        differenceInDays(new Date(), new Date(inv.due_date))
      ));
      
      insights.push({
        id: 'multiple-overdue',
        type: 'warning',
        title: `${overdueInvoices.length} overdue invoices need attention`,
        message: `Total ${this.formatCurrency(totalOverdue)} overdue. Oldest is ${oldestDays} days past due. Set aside 30 minutes for follow-ups today.`,
        action: {
          label: 'Start Collections',
          link: '/invoices?status=overdue'
        },
        priority: 9
      });
    }

    // High unpaid ratio
    const unpaidRatio = invoices.length > 0 ? (unpaidInvoices.length / invoices.length) * 100 : 0;
    if (invoices.length >= 10 && unpaidRatio > 40) {
      insights.push({
        id: 'high-unpaid-ratio',
        type: 'warning',
        title: 'Too many unpaid invoices',
        message: `${unpaidRatio.toFixed(0)}% of invoices are unpaid. This could indicate collection issues or unclear payment terms.`,
        action: {
          label: 'Review Unpaid',
          link: '/invoices?status=unpaid'
        },
        priority: 8
      });
    }

    return insights;
  }

  // Analyze tax readiness
  static analyzeTaxReadiness(
    categorizedExpenses: number,
    totalExpenses: number,
    currentQuarter: number,
    estimatedTax: number
  ): Insight[] {
    const insights: Insight[] = [];
    const categorizationRate = totalExpenses > 0 ? (categorizedExpenses / totalExpenses) * 100 : 100;
    
    // Poor categorization warning
    if (totalExpenses > 1000 && categorizationRate < 80) {
      const uncategorizedAmount = totalExpenses - categorizedExpenses;
      insights.push({
        id: 'poor-categorization',
        type: 'warning',
        title: 'Categorize expenses for taxes',
        message: `${this.formatCurrency(uncategorizedAmount)} in expenses are uncategorized (${(100 - categorizationRate).toFixed(0)}%). Proper categories make tax filing much easier.`,
        action: {
          label: 'Categorize Now',
          link: '/expenses?uncategorized=true'
        },
        priority: 7
      });
    }

    // Quarterly tax reminder
    const now = new Date();
    const quarterEnd = endOfQuarter(now);
    const daysUntilQuarterEnd = differenceInDays(quarterEnd, now);
    
    if (daysUntilQuarterEnd <= 15 && daysUntilQuarterEnd > 0 && estimatedTax > 100) {
      insights.push({
        id: 'quarterly-tax',
        type: 'info',
        title: `Q${currentQuarter} taxes due soon`,
        message: `Estimated ${this.formatCurrency(estimatedTax)} due in ${daysUntilQuarterEnd} days. Start preparing your quarterly tax payment.`,
        action: {
          label: 'View Tax Report',
          link: '/reports/tax'
        },
        priority: 8
      });
    }

    // Good tax preparation
    if (totalExpenses > 1000 && categorizationRate >= 95) {
      insights.push({
        id: 'tax-ready',
        type: 'success',
        title: 'Tax-ready records! 📊',
        message: 'Your expenses are well-categorized. Tax preparation will be much smoother.',
        priority: 4
      });
    }

    return insights;
  }

  // Get client-specific insights
  static analyzeClients(
    clients: any[],
    invoices: any[]
  ): Insight[] {
    const insights: Insight[] = [];
    
    if (clients.length === 0) {
      insights.push({
        id: 'no-clients',
        type: 'info',
        title: 'Add your first client',
        message: 'Adding clients helps you track who owes you money and manage relationships better.',
        action: {
          label: 'Add Client',
          link: '/clients/new'
        },
        priority: 6
      });
      return insights;
    }

    // Calculate client metrics
    const clientMetrics = clients.map(client => {
      const clientInvoices = invoices.filter(inv => inv.client_id === client.id);
      const paidInvoices = clientInvoices.filter(inv => inv.status === 'paid');
      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const unpaidAmount = clientInvoices
        .filter(inv => inv.status !== 'paid' && inv.status !== 'canceled')
        .reduce((sum, inv) => sum + inv.total, 0);
      
      // Calculate average payment time for this client
      const paymentTimes = paidInvoices
        .filter(inv => inv.paid_date)
        .map(inv => differenceInDays(new Date(inv.paid_date), new Date(inv.date)));
      
      const avgPaymentTime = paymentTimes.length > 0 
        ? paymentTimes.reduce((sum, days) => sum + days, 0) / paymentTimes.length
        : 0;
      
      return {
        client,
        totalRevenue,
        unpaidAmount,
        invoiceCount: clientInvoices.length,
        avgPaymentTime
      };
    }).filter(m => m.invoiceCount > 0);

    // Find concentration risk
    const totalRevenue = clientMetrics.reduce((sum, m) => sum + m.totalRevenue, 0);
    if (totalRevenue > 1000) {
      const topClient = clientMetrics.sort((a, b) => b.totalRevenue - a.totalRevenue)[0];
      if (topClient) {
        const revenueShare = (topClient.totalRevenue / totalRevenue) * 100;
        
        if (revenueShare > 50) {
          insights.push({
            id: 'client-concentration',
            type: 'warning',
            title: 'High client dependency',
            message: `${topClient.client.name} represents ${revenueShare.toFixed(0)}% of revenue (${this.formatCurrency(topClient.totalRevenue)}). Consider diversifying your client base.`,
            action: {
              label: 'Find New Clients',
              link: '/clients/new'
            },
            priority: 7
          });
        }
      }
    }

    // Find slow-paying clients
    const slowPayers = clientMetrics.filter(m => 
      m.avgPaymentTime > 45 && m.invoiceCount >= 2
    );
    
    if (slowPayers.length > 0) {
      const slowestPayer = slowPayers.sort((a, b) => b.avgPaymentTime - a.avgPaymentTime)[0];
      insights.push({
        id: 'slow-paying-client',
        type: 'info',
        title: 'Slow-paying client pattern',
        message: `${slowestPayer.client.name} takes ${Math.round(slowestPayer.avgPaymentTime)} days to pay on average. Consider requiring deposits or shorter payment terms.`,
        priority: 6
      });
    }

    // Inactive clients
    const inactiveClients = clients.filter(client => {
      const lastInvoice = invoices
        .filter(inv => inv.client_id === client.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      if (!lastInvoice) return true;
      return differenceInDays(new Date(), new Date(lastInvoice.date)) > 90;
    });

    if (inactiveClients.length >= 3 && clients.length > 5) {
      insights.push({
        id: 'inactive-clients',
        type: 'info',
        title: `${inactiveClients.length} inactive clients`,
        message: 'Several clients haven\'t been invoiced in 90+ days. Consider reaching out with new offers or services.',
        action: {
          label: 'View Clients',
          link: '/clients'
        },
        priority: 5
      });
    }

    return insights;
  }

  // Main function to get all insights
  static async getAllInsights(data: {
    revenue: { current: number; previous: number; average: number };
    expenses: { current: number; previous: number; byCategory: { name: string; amount: number }[] };
    cashFlow: { balance: number; monthlyExpenses: number; expectedIncome: number; overdueAmount: number };
    invoices: any[];
    clients: any[];
    tax: { categorizedAmount: number; totalAmount: number; quarterlyEstimate: number };
  }): Promise<Insight[]> {
    const allInsights: Insight[] = [];

    // Determine how many months of data we have
    const oldestTransaction = [...data.invoices]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    
    const monthsOfData = oldestTransaction 
      ? Math.max(1, Math.ceil(differenceInDays(new Date(), new Date(oldestTransaction.date)) / 30))
      : 1;

    // Get insights from each analyzer
    allInsights.push(...this.analyzeRevenueTrends(
      data.revenue.current,
      data.revenue.previous,
      data.revenue.average,
      monthsOfData
    ));

    allInsights.push(...this.analyzeExpenses(
      data.expenses.current,
      data.expenses.previous,
      data.revenue.current,
      data.expenses.byCategory
    ));

    allInsights.push(...this.analyzeCashFlow(
      data.cashFlow.balance,
      data.cashFlow.monthlyExpenses,
      data.cashFlow.expectedIncome,
      data.cashFlow.overdueAmount
    ));

    if (data.invoices.length > 0) {
      const paidInvoices = data.invoices.filter(inv => inv.status === 'paid' && inv.paid_date);
      const avgPaymentDays = paidInvoices.length > 0
        ? paidInvoices.reduce((sum, inv) => {
            return sum + differenceInDays(new Date(inv.paid_date!), new Date(inv.date));
          }, 0) / paidInvoices.length
        : 0;
      
      allInsights.push(...this.analyzeInvoices(data.invoices, avgPaymentDays));
    }

    // Only show tax insights if there's meaningful data
    if (data.tax.totalAmount > 100) {
      allInsights.push(...this.analyzeTaxReadiness(
        data.tax.categorizedAmount,
        data.tax.totalAmount,
        Math.floor((new Date().getMonth() / 3)) + 1,
        data.tax.quarterlyEstimate
      ));
    }

    if (data.clients.length > 0) {
      allInsights.push(...this.analyzeClients(data.clients, data.invoices));
    }

    // If user has very little data, add onboarding insights
    if (allInsights.length < 3) {
      if (data.invoices.length === 0) {
        allInsights.push({
          id: 'get-started',
          type: 'info',
          title: 'Welcome to SmartCFO! 👋',
          message: 'Start by creating your first invoice to begin tracking income and building financial insights.',
          action: {
            label: 'Create First Invoice',
            link: '/invoices/new'
          },
          priority: 10
        });
      }
      
      if (data.clients.length === 0 && data.invoices.length > 0) {
        allInsights.push({
          id: 'add-clients',
          type: 'info',
          title: 'Add client details',
          message: 'Adding clients helps track payments and build better relationships.',
          action: {
            label: 'Add Client',
            link: '/clients/new'
          },
          priority: 8
        });
      }
    }

    // Sort by priority and return top insights
    return allInsights
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10); // Return top 10, but UI will show 5 by default
  }
}