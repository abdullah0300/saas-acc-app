// src/services/exportService.ts

import { ExportTemplates, ExportType, ExportOptions } from './exportTemplates';
import { getIncomes, getExpenses, getInvoices, getClients } from './database';
import { supabase } from './supabaseClient';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, parseISO, startOfYear } from 'date-fns';
import { auditService } from './auditService';

export class ExportService {
  // Add this method to the ExportService class
  static async exportAllData(userId: string, baseCurrency: string): Promise<void> {
    try {
      // Create a timestamp for all exports
      const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm');
      
      // Export all data types with the actual baseCurrency
      const exports = [
        this.exportData('summary', userId, { 
          dateRange: { 
            start: '2020-01-01', 
            end: format(new Date(), 'yyyy-MM-dd') 
          },
          baseCurrency // Use the passed baseCurrency
        }),
        this.exportData('detailed', userId, { 
          dateRange: { 
            start: '2020-01-01', 
            end: format(new Date(), 'yyyy-MM-dd') 
          },
          baseCurrency // Use the passed baseCurrency
        }),
        this.exportData('tax', userId, {
          dateRange: { 
            start: format(startOfYear(new Date()), 'yyyy-MM-dd'), 
            end: format(new Date(), 'yyyy-MM-dd') 
          },
          baseCurrency // Use the passed baseCurrency
        })
      ];
      
      await Promise.all(exports);
      
      // Log the export
      await auditService.logExport('user', { 
        type: 'full_account_export',
        timestamp 
      });
    } catch (error) {
      console.error('Failed to export all data:', error);
      throw error;
    }
  }

  // Main export function
  static async exportData(
    type: ExportType,
    userId: string,
    options: Partial<ExportOptions> = {}
  ): Promise<void> {
    try {
      // Resolve baseCurrency first
      const baseCurrency = await this.resolveBaseCurrency(userId, options.baseCurrency);
      
      // Now baseCurrency is guaranteed to be a string
      const finalOptions = { ...options, baseCurrency };
      
      let csvContent = '';
      
      switch (type) {
        case 'summary':
          csvContent = await this.generateSummaryData(userId, finalOptions, baseCurrency);
          break;
        case 'detailed':
          csvContent = await this.generateDetailedData(userId, finalOptions, baseCurrency);
          break;
        case 'tax':
          csvContent = await this.generateTaxData(userId, finalOptions, baseCurrency);
          break;
        case 'client':
          if (!finalOptions.clientId) throw new Error('Client ID required');
          csvContent = await this.generateClientData(userId, finalOptions.clientId, finalOptions, baseCurrency);
          break;
        case 'monthly':
          csvContent = await this.generateMonthlyData(userId, finalOptions, baseCurrency);
          break;
      }
      
      // Download the file with currency in filename
      this.downloadCSV(csvContent, `${type}-export-${format(new Date(), 'yyyy-MM-dd')}-${baseCurrency}.csv`);
      
      // Save to export history with finalOptions
      this.saveExportHistory(type, finalOptions);
      
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  // Helper method to resolve base currency
  private static async resolveBaseCurrency(userId: string, providedCurrency?: string): Promise<string> {
    if (providedCurrency) {
      return providedCurrency;
    }
    
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('base_currency')
      .eq('user_id', userId)
      .single();
    
    return userSettings?.base_currency || 'USD';
  }

  // Generate summary data (enhanced current export)
  private static async generateSummaryData(
    userId: string, 
    options: Partial<ExportOptions>,
    baseCurrency: string
  ): Promise<string> {
    const { dateRange } = options;
    const startDate = dateRange?.start || format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const endDate = dateRange?.end || format(endOfMonth(new Date()), 'yyyy-MM-dd');
    
    // Fetch data
    const [incomes, expenses, invoices] = await Promise.all([
      getIncomes(userId, startDate, endDate),
      getExpenses(userId, startDate, endDate),
      getInvoices(userId)
    ]);
    
    // Calculate metrics using base amounts with proper rounding
    const totalRevenue = this.calculateTotalWithCurrency(incomes);
    const totalExpenses = this.calculateTotalWithCurrency(expenses);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // Group by category
    const incomeByCategory = this.groupByCategory(incomes);
    const expenseByCategory = this.groupByCategory(expenses);
    
    // Invoice metrics
    const periodInvoices = invoices.filter(inv => 
      inv.date >= startDate && inv.date <= endDate
    );
    const totalOutstanding = this.calculateTotalWithCurrency(
      periodInvoices.filter(inv => inv.status !== 'paid'),
      'total'
    );
    const collectionRate = this.calculateCollectionRate(periodInvoices);
    const avgDaysToPayment = this.calculateAvgPaymentDays(periodInvoices);
    
    // Monthly breakdown
    const monthlyData = this.generateMonthlyBreakdown(incomes, expenses, startDate, endDate);
    
    const data = {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      totalOutstanding,
      collectionRate,
      avgDaysToPayment,
      incomeCategories: incomeByCategory,
      expenseCategories: expenseByCategory,
      monthlyData
    };
    
    return ExportTemplates.generateSummaryExport(data, { type: 'summary', dateRange, baseCurrency });
  }

  // Generate detailed transaction data
  private static async generateDetailedData(
    userId: string,
    options: Partial<ExportOptions>,
    baseCurrency: string
  ): Promise<string> {
    const { dateRange } = options;
    const startDate = dateRange?.start || format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const endDate = dateRange?.end || format(endOfMonth(new Date()), 'yyyy-MM-dd');
    
    const [incomes, expenses] = await Promise.all([
      getIncomes(userId, startDate, endDate),
      getExpenses(userId, startDate, endDate)
    ]);
    
    const totalIncome = this.calculateTotalWithCurrency(incomes);
    const totalExpenses = this.calculateTotalWithCurrency(expenses);
    
    const data = {
      incomes: incomes.sort((a, b) => a.date.localeCompare(b.date)).map(inc => ({
        ...inc,
        // Ensure all currency fields are included
        amount: inc.amount,
        currency: inc.currency || baseCurrency,
        exchange_rate: inc.exchange_rate || 1,
        base_amount: inc.base_amount || inc.amount
      })),
      expenses: expenses.sort((a, b) => a.date.localeCompare(b.date)).map(exp => ({
        ...exp,
        // Ensure all currency fields are included
        amount: exp.amount,
        currency: exp.currency || baseCurrency,
        exchange_rate: exp.exchange_rate || 1,
        base_amount: exp.base_amount || exp.amount
      })),
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses
    };
    
    return ExportTemplates.generateDetailedExport(data, { type: 'detailed', dateRange, baseCurrency });
  }

  // Generate tax-ready data
  private static async generateTaxData(
    userId: string,
    options: Partial<ExportOptions>,
    baseCurrency: string
  ): Promise<string> {
    const { dateRange } = options;
    const year = dateRange?.start ? new Date(dateRange.start).getFullYear() : new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const [incomes, expenses] = await Promise.all([
      getIncomes(userId, startDate, endDate),
      getExpenses(userId, startDate, endDate)
    ]);
    
    // Tax calculations using base amounts with proper currency conversion
    const totalIncome = this.calculateTotalWithCurrency(incomes);
    const taxCollected = this.calculateTaxInBaseCurrency(incomes, baseCurrency);
    const taxPaid = this.calculateTaxInBaseCurrency(expenses, baseCurrency);
    
    // Map to tax categories
    const incomeByCategoryTax = this.mapToTaxCategories(incomes, 'income');
    const expensesByCategoryTax = this.mapToTaxCategories(expenses, 'expense');
    const deductibleExpenses = expensesByCategoryTax
      .filter(cat => cat.deductible)
      .reduce((sum, cat) => sum + cat.amount, 0);
    
    // Quarterly breakdown
    const quarterlyBreakdown = this.generateQuarterlyBreakdown(incomes, expenses, year);
    
    const data = {
      totalIncome,
      deductibleExpenses,
      netIncome: totalIncome - deductibleExpenses,
      taxCollected,
      taxPaid,
      netTaxLiability: taxCollected - taxPaid,
      incomeByCategoryTax,
      expensesByCategoryTax,
      quarterlyBreakdown,
      mileageLog: [] // Placeholder - would need mileage tracking feature
    };
    
    return ExportTemplates.generateTaxExport(data, { type: 'tax', dateRange: { start: startDate, end: endDate }, baseCurrency });
  }

  // Generate client-specific data
  private static async generateClientData(
    userId: string,
    clientId: string,
    options: Partial<ExportOptions>,
    baseCurrency: string
  ): Promise<string> {
    const { dateRange } = options;
    
    const [clients, invoices, incomes] = await Promise.all([
      getClients(userId),
      getInvoices(userId),
      getIncomes(userId)
    ]);
    
    const client = clients.find(c => c.id === clientId);
    if (!client) throw new Error('Client not found');
    
    const clientInvoices = invoices.filter(inv => inv.client_id === clientId);
    const clientIncomes = incomes.filter(inc => inc.client_id === clientId);
    
    // Filter by date if provided
    const filteredInvoices = dateRange 
      ? clientInvoices.filter(inv => inv.date >= dateRange.start && inv.date <= dateRange.end)
      : clientInvoices;
    
    const totalRevenue = this.calculateTotalWithCurrency(clientIncomes);
    const outstandingBalance = this.calculateTotalWithCurrency(
      filteredInvoices.filter(inv => inv.status !== 'paid'),
      'total'
    );
    
    // Generate activity timeline
    const activity = this.generateClientActivity(filteredInvoices, clientIncomes);
    
    const data = {
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      totalRevenue,
      outstandingBalance,
      invoices: filteredInvoices.map(inv => ({
        ...inv,
        daysOverdue: inv.status === 'overdue' 
          ? Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0
      })),
      payments: clientIncomes.map(inc => ({
        date: inc.date,
        invoice_number: filteredInvoices.find(inv => inv.id === inc.reference_number)?.invoice_number || 'Direct Payment',
        amount: inc.base_amount || inc.amount, // Use base amount for consistency
        original_amount: inc.amount,
        currency: inc.currency || baseCurrency,
        method: 'Bank Transfer' // Would need payment method tracking
      })),
      activity
    };
    
    return ExportTemplates.generateClientExport(data, { type: 'client', clientId, dateRange, baseCurrency });
  }

  // Generate monthly business review data
  private static async generateMonthlyData(
    userId: string,
    options: Partial<ExportOptions>,
    baseCurrency: string
  ): Promise<string> {
    const targetDate = options.dateRange?.start ? new Date(options.dateRange.start) : new Date();
    const monthStart = format(startOfMonth(targetDate), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(targetDate), 'yyyy-MM-dd');
    const lastMonthStart = format(startOfMonth(new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1)), 'yyyy-MM-dd');
    const lastMonthEnd = format(endOfMonth(new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1)), 'yyyy-MM-dd');
    
    // Fetch current and previous month data
    const [incomes, expenses, invoices, lastIncomes, lastExpenses, clients] = await Promise.all([
      getIncomes(userId, monthStart, monthEnd),
      getExpenses(userId, monthStart, monthEnd),
      getInvoices(userId),
      getIncomes(userId, lastMonthStart, lastMonthEnd),
      getExpenses(userId, lastMonthStart, lastMonthEnd),
      getClients(userId)
    ]);
    
    const monthInvoices = invoices.filter(inv => inv.date >= monthStart && inv.date <= monthEnd);
    const lastMonthInvoices = invoices.filter(inv => inv.date >= lastMonthStart && inv.date <= lastMonthEnd);
    
    // Calculate metrics using base amounts with proper rounding
    const revenue = this.calculateTotalWithCurrency(incomes);
    const expenses_ = this.calculateTotalWithCurrency(expenses);
    const lastMonthRevenue = this.calculateTotalWithCurrency(lastIncomes);
    const lastMonthExpenses = this.calculateTotalWithCurrency(lastExpenses);
    
    // Top sources and categories
    const topIncomeSources = this.getTopItems(incomes, 'client', 5, revenue);
    const topExpenseCategories = this.getTopItems(expenses, 'category', 5, expenses_);
    
    // Action items based on data
    const actionItems = this.generateActionItems(revenue, expenses_, monthInvoices);
    
    const data = {
      monthName: format(targetDate, 'MMMM yyyy'),
      revenue,
      expenses: expenses_,
      netProfit: revenue - expenses_,
      profitMargin: revenue > 0 ? ((revenue - expenses_) / revenue * 100).toFixed(1) : '0',
      revenueChange: lastMonthRevenue > 0 ? ((revenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1) : '0',
      expenseChange: lastMonthExpenses > 0 ? ((expenses_ - lastMonthExpenses) / lastMonthExpenses * 100).toFixed(1) : '0',
      cashBalance: revenue - expenses_, // Simplified - would need actual cash tracking
      newClients: this.countNewClients(clients, monthInvoices),
      invoicesSent: monthInvoices.length,
      invoicesPaid: monthInvoices.filter(inv => inv.status === 'paid').length,
      avgInvoiceValue: monthInvoices.length > 0 ? (revenue / monthInvoices.length).toFixed(2) : '0',
      collectionRate: this.calculateCollectionRate(monthInvoices),
      topIncomeSources,
      topExpenseCategories,
      actionItems,
      lastMonthRevenue,
      lastMonthExpenses,
      lastMonthNewClients: this.countNewClients(clients, lastMonthInvoices),
      lastMonthInvoicesPaid: lastMonthInvoices.filter(inv => inv.status === 'paid').length
    };
    
    return ExportTemplates.generateMonthlyExport(data, { type: 'monthly', dateRange: { start: monthStart, end: monthEnd }, baseCurrency });
  }

  // Helper method to round money values
  private static roundMoney(amount: number): number {
    return Math.round(amount * 100) / 100; // Round to 2 decimal places
  }

  // Helper method to calculate totals with proper currency handling
  private static calculateTotalWithCurrency(
    items: any[],
    field: 'amount' | 'total' = 'amount'
  ): number {
    return items.reduce((sum, item) => {
      // For invoices, use base_amount or total
      if (field === 'total') {
        return sum + this.roundMoney(item.base_amount || item.total);
      }
      // For income/expenses, use base_amount or amount
      return sum + this.roundMoney(item.base_amount || item.amount);
    }, 0);
  }

  // Helper method to convert tax amounts to base currency
  private static calculateTaxInBaseCurrency(
    items: any[],
    baseCurrency: string
  ): number {
    return items.reduce((sum, item) => {
      if (item.tax_amount) {
        // If tax was calculated in original currency, convert it
        const taxInBaseCurrency = item.currency && item.currency !== baseCurrency 
          ? item.tax_amount * (item.exchange_rate || 1)
          : item.tax_amount;
        return sum + this.roundMoney(taxInBaseCurrency);
      }
      // If no tax_amount, calculate from base_amount
      const baseAmount = item.base_amount || item.amount;
      const taxRate = item.tax_rate || 0;
      return sum + this.roundMoney(baseAmount * taxRate / 100);
    }, 0);
  }

  // Helper functions
  private static groupByCategory(items: any[]): any[] {
    const grouped = items.reduce((acc, item) => {
      const category = item.category?.name || 'Uncategorized';
      if (!acc[category]) acc[category] = 0;
      acc[category] += this.roundMoney(item.base_amount || item.amount);
      return acc;
    }, {} as Record<string, number>);
    
    const values = Object.values(grouped) as number[];
    const total = values.reduce((sum, val) => sum + val, 0);
    
    return Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        value: value as number,
        percentage: total > 0 ? ((value as number) / total * 100) : 0
      }))
      .sort((a, b) => b.value - a.value);
  }

  private static calculateCollectionRate(invoices: any[]): number {
    if (invoices.length === 0) return 0;
    const paid = invoices.filter(inv => inv.status === 'paid').length;
    return (paid / invoices.length) * 100;
  }

  private static calculateAvgPaymentDays(invoices: any[]): number {
    const paidInvoices = invoices.filter(inv => inv.status === 'paid' && inv.paid_date);
    if (paidInvoices.length === 0) return 0;
    
    const totalDays = paidInvoices.reduce((sum, inv) => {
      const days = Math.floor(
        (new Date(inv.paid_date).getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + days;
    }, 0);
    
    return totalDays / paidInvoices.length;
  }

  private static generateMonthlyBreakdown(
    incomes: any[], 
    expenses: any[], 
    startDate: string, 
    endDate: string
  ): any[] {
    const months: any[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      const monthStart = format(startOfMonth(d), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(d), 'yyyy-MM-dd');
      
      const monthIncomes = incomes.filter(inc => 
        inc.date >= monthStart && inc.date <= monthEnd
      );
      const monthExpenses = expenses.filter(exp => 
        exp.date >= monthStart && exp.date <= monthEnd
      );
      
      const income = this.calculateTotalWithCurrency(monthIncomes);
      const expense = this.calculateTotalWithCurrency(monthExpenses);
      
      months.push({
        month: format(d, 'MMM yyyy'),
        income,
        expenses: expense,
        profit: income - expense
      });
    }
    
    return months;
  }

  private static mapToTaxCategories(items: any[], type: 'income' | 'expense'): any[] {
    const grouped = items.reduce((acc, item) => {
      const category = item.category?.name || 'Uncategorized';
      const taxCategory = ExportTemplates.mapToTaxCategory(category);
      
      const key = `${category}|${taxCategory}`;
      if (!acc[key]) {
        acc[key] = {
          category,
          taxCategory,
          amount: 0,
          taxAmount: 0,
          deductible: type === 'expense' && taxCategory !== 'Meals and Entertainment (50% deductible)'
        };
      }
      
      acc[key].amount += this.roundMoney(item.base_amount || item.amount);
      acc[key].taxAmount += item.tax_amount || 0;
      
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(grouped)
      .map((item: any) => ({
        category: item.category,
        taxCategory: item.taxCategory,
        amount: item.amount,
        taxAmount: item.taxAmount,
        deductible: item.deductible
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private static generateQuarterlyBreakdown(incomes: any[], expenses: any[], year: number): any[] {
    const quarters = [];
    
    for (let q = 0; q < 4; q++) {
      const quarterStart = startOfQuarter(new Date(year, q * 3, 1));
      const quarterEnd = endOfQuarter(quarterStart);
      
      const qIncomes = incomes.filter(inc => {
        const date = parseISO(inc.date);
        return date >= quarterStart && date <= quarterEnd;
      });
      
      const qExpenses = expenses.filter(exp => {
        const date = parseISO(exp.date);
        return date >= quarterStart && date <= quarterEnd;
      });
      
      const income = this.calculateTotalWithCurrency(qIncomes);
      const expense = this.calculateTotalWithCurrency(qExpenses);
      const netIncome = income - expense;
      
      quarters.push({
        quarter: `Q${q + 1} ${year}`,
        income,
        expenses: expense,
        netIncome,
        estimatedTax: netIncome * 0.25 // Simplified - would need actual tax calculation
      });
    }
    
    return quarters;
  }

  private static generateClientActivity(invoices: any[], incomes: any[]): any[] {
    const activity: any[] = [];
    let balance = 0;
    
    // Combine invoices and payments
    const allItems = [
      ...invoices.map(inv => ({ ...inv, type: 'invoice' })),
      ...incomes.map(inc => ({ ...inc, type: 'payment' }))
    ].sort((a, b) => a.date.localeCompare(b.date));
    
    allItems.forEach(item => {
      if (item.type === 'invoice') {
        const amount = this.roundMoney(item.base_amount || item.total);
        balance += amount;
        activity.push({
          date: item.date,
          description: `Invoice #${item.invoice_number}`,
          debit: amount,
          credit: null,
          balance: this.roundMoney(balance)
        });
      } else {
        const amount = this.roundMoney(item.base_amount || item.amount);
        balance -= amount;
        activity.push({
          date: item.date,
          description: `Payment received`,
          debit: null,
          credit: amount,
          balance: this.roundMoney(balance)
        });
      }
    });
    
    return activity;
  }

  private static getTopItems(items: any[], groupBy: string, limit: number, total: number): any[] {
    const grouped = items.reduce((acc, item) => {
      const key = groupBy === 'client' 
        ? item.client?.name || 'Direct'
        : item.category?.name || 'Uncategorized';
      
      if (!acc[key]) acc[key] = 0;
      acc[key] += this.roundMoney(item.base_amount || item.amount);
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([name, amount]) => ({
        name,
        amount: amount as number,
        percentage: total > 0 ? ((amount as number) / total * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  private static countNewClients(clients: any[], invoices: any[]): number {
    // Simplified - would need to track client creation date
    const uniqueClientIds = new Set(invoices.map(inv => inv.client_id).filter(Boolean));
    return uniqueClientIds.size;
  }

  private static generateActionItems(revenue: number, expenses: number, invoices: any[]): string[] {
    const items = [];
    
    if (revenue < expenses) {
      items.push('Revenue is below expenses - focus on increasing sales or reducing costs');
    }
    
    const unpaidCount = invoices.filter(inv => inv.status !== 'paid').length;
    if (unpaidCount > 5) {
      items.push(`Follow up on ${unpaidCount} unpaid invoices`);
    }
    
    const overdueCount = invoices.filter(inv => inv.status === 'overdue').length;
    if (overdueCount > 0) {
      items.push(`${overdueCount} invoices are overdue - prioritize collection`);
    }
    
    if (items.length === 0) {
      items.push('All metrics look healthy - keep up the good work!');
    }
    
    return items;
  }

  private static downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Fix for TypeScript - use type assertion for IE compatibility
    const nav = navigator as any;
    if (nav.msSaveBlob) {
      nav.msSaveBlob(blob, filename);
    } else {
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  }

  private static saveExportHistory(type: ExportType, options: Partial<ExportOptions>): void {
    const history = JSON.parse(localStorage.getItem('exportHistory') || '[]');
    history.unshift({
      type,
      options,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 exports
    localStorage.setItem('exportHistory', JSON.stringify(history.slice(0, 10)));
  }

  static getExportHistory(): any[] {
    return JSON.parse(localStorage.getItem('exportHistory') || '[]');
  }
}