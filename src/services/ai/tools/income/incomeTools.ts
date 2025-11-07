/**
 * Income Tools - Income-specific operations
 * Handles creating, reading, and updating income records
 */

import { createIncome, updateIncome, getIncomes } from '../../../database';
import { createPendingAction } from '../../pendingActionsService';
import { getUserSettings, getInvoiceSettings, getExchangeRate, parseRelativeDate } from '../../userSettingsService';
import { searchClientByName } from '../shared/clientTools';
import { searchCategoryByName } from '../shared/categoryTools';

/**
 * Create a new income record
 * Shows preview to user before saving
 */
export const createIncomeTool = async (
  userId: string,
  conversationId: string,
  data: {
    amount: number;
    description: string;
    date: string;
    category_name?: string;
    client_name?: string;
    reference_number?: string;
    tax_rate?: number;
    currency?: string;
  }
): Promise<{ success: boolean; pending_action_id?: string; error?: string }> => {
  try {
    // Get user settings
    const userSettings = await getUserSettings(userId);
    const invoiceSettings = await getInvoiceSettings(userId);

    // Parse date
    let parsedDate = parseRelativeDate(data.date);
    if (!parsedDate) {
      parsedDate = data.date;
    }

    // Handle category (optional - only validate if provided)
    let categoryId: string | undefined;
    let categoryName: string | undefined;

    if (data.category_name) {
      const { exactMatch, similarCategories } = await searchCategoryByName(userId, data.category_name, 'income');

      if (exactMatch) {
        categoryId = exactMatch.id;
        categoryName = exactMatch.name;
      } else if (similarCategories.length > 0) {
        const categoryList = similarCategories.map((c) => `- ${c.name}`).join('\n');
        return {
          success: false,
          error: `Found ${similarCategories.length} similar categor${similarCategories.length > 1 ? 'ies' : 'y'}:\n\n${categoryList}\n\nWhich one did you mean? Or I can create a new category "${data.category_name}" for you.`,
        };
      } else {
        // Category not found - suggest creating it
        return {
          success: false,
          error: `Category "${data.category_name}" doesn't exist. Would you like me to create it?`,
        };
      }
    }

    // Handle client (optional - only validate if provided)
    let clientId: string | undefined;
    let clientName: string | undefined;

    if (data.client_name) {
      const { exactMatch, similarClients } = await searchClientByName(userId, data.client_name);

      if (exactMatch) {
        clientId = exactMatch.id;
        clientName = exactMatch.name;
      } else if (similarClients.length > 0) {
        const clientList = similarClients
          .map((c) => `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`)
          .join('\n');
        return {
          success: false,
          error: `Found ${similarClients.length} similar client${similarClients.length > 1 ? 's' : ''}:\n\n${clientList}\n\nWhich one did you mean? Or I can create a new client "${data.client_name}" for you.`,
        };
      } else {
        // Client not found - suggest creating it
        return {
          success: false,
          error: `Client "${data.client_name}" doesn't exist. Would you like me to create it?`,
        };
      }
    }

    // Tax calculation
    const taxRate = data.tax_rate ?? invoiceSettings.default_tax_rate ?? 0;
    const taxAmount = taxRate > 0 ? (data.amount * taxRate) / 100 : 0;

    // Currency
    const currency = data.currency || userSettings.base_currency || 'USD';

    // Create pending action for preview
    const pendingAction = await createPendingAction(conversationId, userId, 'income', {
      amount: data.amount,
      description: data.description,
      date: parsedDate,
      category_id: categoryId,
      category_name: categoryName,
      client_id: clientId,
      client_name: clientName,
      reference_number: data.reference_number,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      currency: currency,
    });

    return { success: true, pending_action_id: pendingAction.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get income records with filters
 * Can filter by date range, category, client, etc.
 */
export const getIncomeTool = async (
  userId: string,
  filters?: {
    start_date?: string;
    end_date?: string;
    category_name?: string;
    client_name?: string;
  }
): Promise<any[]> => {
  try {
    // Fetch income records
    let income = await getIncomes(userId, filters?.start_date, filters?.end_date);

    console.log('[getIncomeTool] Fetched income count:', income.length);
    console.log('[getIncomeTool] Filters:', JSON.stringify(filters, null, 2));

    // Filter by category name (if provided)
    if (filters?.category_name) {
      const searchLower = filters.category_name.toLowerCase();
      const beforeFilter = income.length;

      income = income.filter((inc) => {
        const matches =
          inc.category?.name?.toLowerCase().includes(searchLower) ||
          searchLower.includes(inc.category?.name?.toLowerCase() || '');
        return matches;
      });

      console.log('[getIncomeTool] Category filter:', beforeFilter, '→', income.length);
    }

    // Filter by client name (if provided)
    if (filters?.client_name) {
      const searchLower = filters.client_name.toLowerCase();
      const beforeFilter = income.length;

      income = income.filter((inc) => {
        const matches =
          inc.client?.name?.toLowerCase().includes(searchLower) ||
          inc.client?.company_name?.toLowerCase().includes(searchLower) ||
          searchLower.includes(inc.client?.name?.toLowerCase() || '') ||
          searchLower.includes(inc.client?.company_name?.toLowerCase() || '');
        return matches;
      });

      console.log('[getIncomeTool] Client filter:', beforeFilter, '→', income.length);
    }

    console.log('[getIncomeTool] Final result count:', income.length);
    return income;
  } catch (error) {
    console.error('[getIncomeTool] Error:', error);
    return [];
  }
};

/**
 * Update an existing income record
 */
export const updateIncomeTool = async (
  userId: string,
  conversationId: string,
  data: {
    income_id: string;
    amount?: number;
    description?: string;
    date?: string;
    category_name?: string;
    client_name?: string;
    reference_number?: string;
    tax_rate?: number;
    currency?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verify income exists
    const incomes = await getIncomes(userId);
    const existingIncome = incomes.find((inc) => inc.id === data.income_id);

    if (!existingIncome) {
      return { success: false, error: `Income record with ID ${data.income_id} not found.` };
    }

    // Prepare update data
    const updateData: any = {};

    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.date !== undefined) {
      const parsedDate = parseRelativeDate(data.date) || data.date;
      updateData.date = parsedDate;
    }
    if (data.reference_number !== undefined) updateData.reference_number = data.reference_number || null;

    // Handle category
    if (data.category_name) {
      const { exactMatch, similarCategories } = await searchCategoryByName(userId, data.category_name, 'income');

      if (exactMatch) {
        updateData.category_id = exactMatch.id;
      } else if (similarCategories.length > 0) {
        const categoryList = similarCategories.map((c) => `- ${c.name}`).join('\n');
        return {
          success: false,
          error: `Found ${similarCategories.length} similar categor${similarCategories.length > 1 ? 'ies' : 'y'}:\n\n${categoryList}\n\nWhich one did you mean?`,
        };
      } else {
        return {
          success: false,
          error: `Category "${data.category_name}" doesn't exist. Would you like me to create it?`,
        };
      }
    }

    // Handle client
    if (data.client_name) {
      const { exactMatch, similarClients } = await searchClientByName(userId, data.client_name);

      if (exactMatch) {
        updateData.client_id = exactMatch.id;
      } else if (similarClients.length > 0) {
        const clientList = similarClients
          .map((c) => `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`)
          .join('\n');
        return {
          success: false,
          error: `Found ${similarClients.length} similar client${similarClients.length > 1 ? 's' : ''}:\n\n${clientList}\n\nWhich one did you mean?`,
        };
      } else {
        return {
          success: false,
          error: `Client "${data.client_name}" doesn't exist. Would you like me to create it?`,
        };
      }
    }

    // Handle tax
    if (data.tax_rate !== undefined) {
      updateData.tax_rate = data.tax_rate || null;
      if (data.amount !== undefined && data.tax_rate > 0) {
        updateData.tax_amount = (data.amount * data.tax_rate) / 100;
      }
    }

    // Handle currency
    if (data.currency !== undefined) {
      updateData.currency = data.currency;
    }

    // Update income
    await updateIncome(data.income_id, updateData);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
