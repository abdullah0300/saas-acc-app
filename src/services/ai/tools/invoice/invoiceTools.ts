/**
 * Invoice Tools - Query-only invoice operations
 * Handles reading and filtering invoice records
 * NOTE: Invoice creation is handled through the UI due to complexity
 */

import { getInvoices } from '../../../database';
import { parseRelativeDate } from '../../userSettingsService';

/**
 * Get invoice records with filters
 * Returns invoices with client details and calculated totals
 */
export const getInvoicesTool = async (
  userId: string,
  filters?: {
    start_date?: string;
    end_date?: string;
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled' | 'partially_paid';
    client_name?: string;
    currency?: string;
    min_amount?: number;
    max_amount?: number;
  }
): Promise<any[]> => {
  try {
    // Fetch all invoices
    let invoices = await getInvoices(userId);

    console.log('[getInvoicesTool] Fetched invoice count:', invoices.length);
    console.log('[getInvoicesTool] Filters:', JSON.stringify(filters, null, 2));

    // Filter by date range (if provided)
    if (filters?.start_date || filters?.end_date) {
      const beforeFilter = invoices.length;

      invoices = invoices.filter((invoice) => {
        const invoiceDate = new Date(invoice.date);
        if (filters.start_date && invoiceDate < new Date(filters.start_date)) return false;
        if (filters.end_date && invoiceDate > new Date(filters.end_date)) return false;
        return true;
      });

      console.log('[getInvoicesTool] Date filter:', beforeFilter, '→', invoices.length);
    }

    // Filter by status (if provided)
    if (filters?.status) {
      const beforeFilter = invoices.length;
      invoices = invoices.filter((invoice) => invoice.status === filters.status);
      console.log('[getInvoicesTool] Status filter:', beforeFilter, '→', invoices.length);
    }

    // Filter by client name (if provided)
    if (filters?.client_name) {
      const searchLower = filters.client_name.toLowerCase();
      const beforeFilter = invoices.length;

      invoices = invoices.filter((invoice) => {
        const matches =
          invoice.client?.name?.toLowerCase().includes(searchLower) ||
          invoice.client?.company_name?.toLowerCase().includes(searchLower) ||
          searchLower.includes(invoice.client?.name?.toLowerCase() || '') ||
          searchLower.includes(invoice.client?.company_name?.toLowerCase() || '');
        return matches;
      });

      console.log('[getInvoicesTool] Client filter:', beforeFilter, '→', invoices.length);
    }

    // Filter by currency (if provided)
    if (filters?.currency) {
      const beforeFilter = invoices.length;
      invoices = invoices.filter((invoice) => (invoice.currency || 'USD') === filters.currency);
      console.log('[getInvoicesTool] Currency filter:', beforeFilter, '→', invoices.length);
    }

    // Filter by amount range (if provided)
    if (filters?.min_amount !== undefined || filters?.max_amount !== undefined) {
      const beforeFilter = invoices.length;

      invoices = invoices.filter((invoice) => {
        const total = invoice.total || 0;
        if (filters.min_amount !== undefined && total < filters.min_amount) return false;
        if (filters.max_amount !== undefined && total > filters.max_amount) return false;
        return true;
      });

      console.log('[getInvoicesTool] Amount filter:', beforeFilter, '→', invoices.length);
    }

    // Calculate additional fields for better AI responses
    const invoicesWithDetails = invoices.map(invoice => {
      // Calculate days until due (positive = future, negative = overdue)
      const dueDate = new Date(invoice.due_date);
      const today = new Date();
      const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Determine if overdue
      const isOverdue = daysUntilDue < 0 && invoice.status !== 'paid' && invoice.status !== 'canceled';

      return {
        ...invoice,
        days_until_due: daysUntilDue,
        is_overdue: isOverdue,
        client_display_name: invoice.client?.company_name || invoice.client?.name || 'No client',
      };
    });

    console.log('[getInvoicesTool] Final result count:', invoicesWithDetails.length);
    return invoicesWithDetails;
  } catch (error) {
    console.error('[getInvoicesTool] Error:', error);
    return [];
  }
};
