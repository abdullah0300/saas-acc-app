// src/services/exportTemplates.ts

import { format } from 'date-fns';

export type ExportType = 'summary' | 'detailed' | 'tax' | 'client' | 'monthly';

export interface ExportOptions {
  type: ExportType;
  dateRange?: { start: string; end: string };
  clientId?: string;
  includeTransactions?: boolean;
  groupByCategory?: boolean;
  baseCurrency?: string; // ADD THIS LINE
}

export class ExportTemplates {
  // Generate header metadata for any export
  static generateHeader(title: string, options: ExportOptions, filters?: any): string {
  const headers = [
    `${title}`,
    `Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`,
    options.dateRange ? `Period: ${options.dateRange.start} to ${options.dateRange.end}` : '',
    options.baseCurrency ? `Currency: ${options.baseCurrency}` : '', // ADD THIS
    filters?.clientName ? `Client: ${filters.clientName}` : '',
    `Report Type: ${options.type.charAt(0).toUpperCase() + options.type.slice(1)}`,
    '',
    '---'
  ].filter(Boolean);
    
    return headers.join('\n');
  }

  // Summary Export - Current functionality enhanced
  static generateSummaryExport(data: any, options: ExportOptions): string {
    const csv = [
      this.generateHeader('Financial Summary Report', options),
      '',
      'KEY PERFORMANCE INDICATORS',
      `Total Revenue (${options.baseCurrency}),${data.totalRevenue}`,
      `Total Expenses (${options.baseCurrency}),${data.totalExpenses}`,
      `Net Profit,${data.netProfit}`,
      `Profit Margin,${data.profitMargin.toFixed(2)}%`,
      `Outstanding Amount,${data.totalOutstanding}`,
      `Collection Rate,${data.collectionRate.toFixed(2)}%`,
      `Average Days to Payment,${data.avgDaysToPayment.toFixed(0)}`,
      '',
      'REVENUE BY CATEGORY',
      'Category,Amount,Percentage',
      ...data.incomeCategories.map((cat: any) => 
        `${cat.name},${cat.value},${cat.percentage.toFixed(1)}%`
      ),
      `Total Revenue,${data.totalRevenue},100%`,
      '',
      'EXPENSES BY CATEGORY',
      'Category,Amount,Percentage',
      ...data.expenseCategories.map((cat: any) => 
        `${cat.name},${cat.value},${cat.percentage.toFixed(1)}%`
      ),
      `Total Expenses,${data.totalExpenses},100%`,
      '',
      'MONTHLY BREAKDOWN',
      'Month,Revenue,Expenses,Net Profit',
      ...data.monthlyData.map((month: any) => 
        `${month.month},${month.income},${month.expenses},${month.profit}`
      )
    ];
    
    return csv.join('\n');
  }

  // Detailed Transaction Export
  static generateDetailedExport(data: any, options: ExportOptions): string {
  const csv = [
    this.generateHeader('Detailed Transaction Report', options),
    '',
    'INCOME TRANSACTIONS',
    `Date,Description,Category,Client,Original Amount,Currency,Exchange Rate,Amount (${options.baseCurrency}),Tax,Reference`,
    ...data.incomes.map((inc: any) => 
      `${inc.date},"${inc.description}","${inc.category?.name || 'Uncategorized'}","${inc.client?.name || ''}",${inc.amount},${inc.currency || options.baseCurrency},${inc.exchange_rate || 1},${inc.base_amount || inc.amount},${inc.tax_amount || 0},"${inc.reference_number || ''}"`
    ),
    `,,,,,,Subtotal (${options.baseCurrency}):,${data.totalIncome}`,
    '',
    'EXPENSE TRANSACTIONS',
    `Date,Description,Category,Vendor,Original Amount,Currency,Exchange Rate,Amount (${options.baseCurrency}),Tax,Receipt`,
    ...data.expenses.map((exp: any) => 
      `${exp.date},"${exp.description}","${exp.category?.name || 'Uncategorized'}","${exp.vendor?.name || ''}",${exp.amount},${exp.currency || options.baseCurrency},${exp.exchange_rate || 1},${exp.base_amount || exp.amount},${exp.tax_amount || 0},"${exp.receipt_url ? 'Yes' : 'No'}"`
    ),
    `,,,,,,Subtotal (${options.baseCurrency}):,${data.totalExpenses}`,
    '',
    'SUMMARY',
    `Total Income,,,,,,,${data.totalIncome}`,
    `Total Expenses,,,,,,,${data.totalExpenses}`,
    `Net Profit/Loss,,,,,,,${data.netProfit}`
  ];
  
  return csv.join('\n');
}

  // Tax-Ready Export
  static generateTaxExport(data: any, options: ExportOptions): string {
    const csv = [
      this.generateHeader('Tax Summary Report', options),
      'Note: Please consult with your tax professional. Categories are mapped to common tax categories.',
      '',
      'TAX SUMMARY',
      `Gross Income,${data.totalIncome}`,
      `Total Deductible Expenses,${data.deductibleExpenses}`,
      `Net Business Income,${data.netIncome}`,
      `Total Tax Collected,${data.taxCollected}`,
      `Total Tax Paid,${data.taxPaid}`,
      `Net Tax Liability,${data.netTaxLiability}`,
      '',
      'INCOME BY TAX CATEGORY',
      'Category,Tax Category,Amount,Tax Collected',
      ...data.incomeByCategoryTax.map((cat: any) => 
        `"${cat.category}","${cat.taxCategory}",${cat.amount},${cat.taxAmount}`
      ),
      '',
      'DEDUCTIBLE EXPENSES BY TAX CATEGORY',
      'Category,Tax Category,Amount,Tax Paid,Deductible',
      ...data.expensesByCategoryTax.map((cat: any) => 
        `"${cat.category}","${cat.taxCategory}",${cat.amount},${cat.taxAmount},${cat.deductible ? 'Yes' : 'No'}`
      ),
      '',
      'QUARTERLY BREAKDOWN',
      'Quarter,Income,Expenses,Net Income,Tax Liability',
      ...data.quarterlyBreakdown.map((q: any) => 
        `${q.quarter},${q.income},${q.expenses},${q.netIncome},${q.estimatedTax}`
      ),
      '',
      'MILEAGE LOG (if applicable)',
      'Date,Purpose,Miles,Deductible Amount',
      ...data.mileageLog.map((log: any) => 
        `${log.date},"${log.purpose}",${log.miles},${log.deductibleAmount}`
      ),
      '',
      '*Tax deductible items marked. Consult your tax professional for advice.'
    ];
    
    return csv.join('\n');
  }

  // Client-Specific Export
  static generateClientExport(data: any, options: ExportOptions): string {
    const csv = [
      this.generateHeader(`Client Statement - ${data.clientName}`, options),
      '',
      'CLIENT INFORMATION',
      `Name,${data.clientName}`,
      `Email,${data.clientEmail || 'N/A'}`,
      `Phone,${data.clientPhone || 'N/A'}`,
      `Total Revenue,${data.totalRevenue}`,
      `Outstanding Balance,${data.outstandingBalance}`,
      '',
      'INVOICE SUMMARY',
      'Invoice #,Date,Due Date,Amount,Status,Days Overdue',
      ...data.invoices.map((inv: any) => 
        `${inv.invoice_number},${inv.date},${inv.due_date},${inv.total},${inv.status},${inv.daysOverdue || 0}`
      ),
      '',
      'PAYMENT HISTORY',
      'Date,Invoice #,Amount,Payment Method',
      ...data.payments.map((pmt: any) => 
        `${pmt.date},${pmt.invoice_number},${pmt.amount},"${pmt.method || 'Bank Transfer'}"`
      ),
      '',
      'ACCOUNT ACTIVITY',
      'Date,Description,Debit,Credit,Balance',
      ...data.activity.map((act: any) => 
        `${act.date},"${act.description}",${act.debit || ''},${act.credit || ''},${act.balance}`
      ),
      '',
      `Current Balance Due:,,,${data.outstandingBalance}`,
      '',
      'Thank you for your business!'
    ];
    
    return csv.join('\n');
  }

  // Monthly Business Review Export
  static generateMonthlyExport(data: any, options: ExportOptions): string {
    const csv = [
      this.generateHeader(`Monthly Business Review - ${data.monthName}`, options),
      '',
      'EXECUTIVE SUMMARY',
      `Revenue,${data.revenue},${data.revenueChange > 0 ? '+' : ''}${data.revenueChange}% from last month`,
      `Expenses,${data.expenses},${data.expenseChange > 0 ? '+' : ''}${data.expenseChange}% from last month`,
      `Net Profit,${data.netProfit},${data.profitMargin}% margin`,
      `Cash Position,${data.cashBalance}`,
      '',
      'TOP METRICS',
      `New Clients,${data.newClients}`,
      `Invoices Sent,${data.invoicesSent}`,
      `Invoices Paid,${data.invoicesPaid}`,
      `Average Invoice Value,${data.avgInvoiceValue}`,
      `Collection Rate,${data.collectionRate}%`,
      '',
      'TOP 5 INCOME SOURCES',
      'Client/Category,Amount,% of Revenue',
      ...data.topIncomeSources.map((src: any) => 
        `"${src.name}",${src.amount},${src.percentage}%`
      ),
      '',
      'TOP 5 EXPENSE CATEGORIES',
      'Category,Amount,% of Expenses',
      ...data.topExpenseCategories.map((cat: any) => 
        `"${cat.name}",${cat.amount},${cat.percentage}%`
      ),
      '',
      'ACTION ITEMS',
      ...data.actionItems.map((item: any) => `"- ${item}"`),
      '',
      'MONTH-OVER-MONTH COMPARISON',
      'Metric,This Month,Last Month,Change',
      `Revenue,${data.revenue},${data.lastMonthRevenue},${data.revenueChange}%`,
      `Expenses,${data.expenses},${data.lastMonthExpenses},${data.expenseChange}%`,
      `New Clients,${data.newClients},${data.lastMonthNewClients},${data.newClients - data.lastMonthNewClients}`,
      `Invoices Paid,${data.invoicesPaid},${data.lastMonthInvoicesPaid},${data.invoicesPaid - data.lastMonthInvoicesPaid}`
    ];
    
    return csv.join('\n');
  }

  // Helper to determine tax category mapping
  static mapToTaxCategory(category: string): string {
    const taxMapping: Record<string, string> = {
      'Office Supplies': 'Office Expenses',
      'Travel': 'Travel and Entertainment',
      'Meals': 'Meals and Entertainment (50% deductible)',
      'Internet': 'Utilities',
      'Phone': 'Utilities',
      'Rent': 'Rent or Lease',
      'Insurance': 'Insurance',
      'Marketing': 'Advertising and Marketing',
      'Salary': 'Wages and Salaries',
      'Consulting': 'Professional Services',
      'Software': 'Software and Subscriptions',
      'Equipment': 'Depreciation',
      'Vehicle': 'Vehicle Expenses',
      'Bank Fees': 'Bank Charges',
      'Legal': 'Legal and Professional',
      'Training': 'Education and Training'
    };
    
    return taxMapping[category] || 'Other Business Expenses';
  }
}