// src/services/exportService.ts

import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, parseISO } from 'date-fns';
import { ExportTemplates, ExportType, ExportOptions } from './exportTemplates';
import { getIncomes, getExpenses, getInvoices, getClients } from './database';
import { supabase } from './supabaseClient';

export class ExportService {
  // Main export function
  static async exportData(
    type: ExportType,
    userId: string,
    options: Partial<ExportOptions> = {}
  ): Promise<void> {
    try {
       
      let csvContent = '';
      
      switch (type) {
        case 'summary':
          csvContent = await this.generateSummaryData(userId, options);
          break;
        case 'detailed':
          csvContent = await this.generateDetailedData(userId, options);
          break;
        case 'tax':
          csvContent = await this.generateTaxData(userId, options);
          break;
        case 'client':
          if (!options.clientId) throw new Error('Client ID required');
          csvContent = await this.generateClientData(userId, options.clientId, options);
          break;
        case 'monthly':
          csvContent = await this.generateMonthlyData(userId, options);
          break;
      }
      
      // Download the file
      this.downloadCSV(csvContent, `${type}-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      
      // Save to export history
      this.saveExportHistory(type, options);
      
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  // Generate summary data (enhanced current export)
  private static async generateSummaryData(
    userId: string, 
    options: Partial<ExportOptions>
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
    
    // Calculate metrics
    const totalRevenue = incomes.reduce((sum, inc) => sum + inc.amount, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // Group by category
    const incomeByCategory = this.groupByCategory(incomes);
    const expenseByCategory = this.groupByCategory(expenses);
    
    // Invoice metrics
    const periodInvoices = invoices.filter(inv => 
      inv.date >= startDate && inv.date <= endDate
    );
    const totalOutstanding = periodInvoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);
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
    
    return ExportTemplates.generateSummaryExport(data, { type: 'summary', dateRange });
  }

  // Generate detailed transaction data
  private static async generateDetailedData(
    userId: string,
    options: Partial<ExportOptions>
  ): Promise<string> {
    const { dateRange } = options;
    const startDate = dateRange?.start || format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const endDate = dateRange?.end || format(endOfMonth(new Date()), 'yyyy-MM-dd');
    
    const [incomes, expenses] = await Promise.all([
      getIncomes(userId, startDate, endDate),
      getExpenses(userId, startDate, endDate)
    ]);
    
    const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const data = {
      incomes: incomes.sort((a, b) => a.date.localeCompare(b.date)),
      expenses: expenses.sort((a, b) => a.date.localeCompare(b.date)),
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses
    };
    
    return ExportTemplates.generateDetailedExport(data, { type: 'detailed', dateRange });
  }

  // Generate tax-ready data
  private static async generateTaxData(
    userId: string,
    options: Partial<ExportOptions>
  ): Promise<string> {
    const { dateRange } = options;
    const year = dateRange?.start ? new Date(dateRange.start).getFullYear() : new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const [incomes, expenses] = await Promise.all([
      getIncomes(userId, startDate, endDate),
      getExpenses(userId, startDate, endDate)
    ]);
    
    // Tax calculations
    const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
    const taxCollected = incomes.reduce((sum, inc) => sum + (inc.tax_amount || 0), 0);
    const taxPaid = expenses.reduce((sum, exp) => sum + (exp.tax_amount || 0), 0);
    
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
    
    return ExportTemplates.generateTaxExport(data, { type: 'tax', dateRange: { start: startDate, end: endDate } });
  }

  // Generate client-specific data
  private static async generateClientData(
    userId: string,
    clientId: string,
    options: Partial<ExportOptions>
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
    
    const totalRevenue = clientIncomes.reduce((sum, inc) => sum + inc.amount, 0);
    const outstandingBalance = filteredInvoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);
    
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
        amount: inc.amount,
        method: 'Bank Transfer' // Would need payment method tracking
      })),
      activity
    };
    
    return ExportTemplates.generateClientExport(data, { type: 'client', clientId, dateRange });
  }

  // Generate monthly business review data
  private static async generateMonthlyData(
    userId: string,
    options: Partial<ExportOptions>
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
    
    // Calculate metrics
    const revenue = incomes.reduce((sum, inc) => sum + inc.amount, 0);
    const expenses_ = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const lastMonthRevenue = lastIncomes.reduce((sum, inc) => sum + inc.amount, 0);
    const lastMonthExpenses = lastExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
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
    
    return ExportTemplates.generateMonthlyExport(data, { type: 'monthly', dateRange: { start: monthStart, end: monthEnd } });
  }

  // Helper functions
  private static groupByCategory(items: any[]): any[] {
    const grouped = items.reduce((acc, item) => {
      const category = item.category?.name || 'Uncategorized';
      if (!acc[category]) acc[category] = 0;
      acc[category] += item.amount;
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
      
      const income = monthIncomes.reduce((sum, inc) => sum + inc.amount, 0);
      const expense = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
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
      
      acc[key].amount += item.amount;
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
      
      const income = qIncomes.reduce((sum, inc) => sum + inc.amount, 0);
      const expense = qExpenses.reduce((sum, exp) => sum + exp.amount, 0);
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
        balance += item.total;
        activity.push({
          date: item.date,
          description: `Invoice #${item.invoice_number}`,
          debit: item.total,
          credit: null,
          balance
        });
      } else {
        balance -= item.amount;
        activity.push({
          date: item.date,
          description: `Payment received`,
          debit: null,
          credit: item.amount,
          balance
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
      acc[key] += item.amount;
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