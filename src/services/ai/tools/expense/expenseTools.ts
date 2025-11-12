/**
 * Expense Tools - Expense-specific operations
 * Handles creating, reading, and updating expense records
 */

import { createExpense, updateExpense, getExpenses } from '../../../database';
import { createPendingAction } from '../../pendingActionsService';
import { getUserSettings, getInvoiceSettings, getExchangeRate, parseRelativeDate } from '../../userSettingsService';
import { searchVendorByName } from '../shared/vendorTools';
import { searchCategoryByName } from '../shared/categoryTools';
import { searchTaxRateByPercentage } from '../shared/taxTools';

/**
 * Validate expense data before creating
 * Checks all provided fields and returns errors + missing fields
 * Does NOT create pending action - only validates
 */
export const validateExpenseTool = async (
  userId: string,
  data: {
    amount: number;
    description?: string;
    category_name?: string;
    vendor_name?: string;
    tax_rate?: number;
    currency?: string;
  }
): Promise<{
  valid: boolean;
  errors: string[];
  missing_fields: string[];
}> => {
  try {
    console.log('[validateExpenseTool] Validating expense data:', JSON.stringify(data, null, 2));

    const errors: string[] = [];
    const missing_fields: string[] = [];

    // Get user settings for currency validation
    const userSettings = await getUserSettings(userId);

    // Validate currency if provided
    if (data.currency) {
      const enabledCurrencies = userSettings.enabled_currencies || [userSettings.base_currency || 'USD'];
      if (!enabledCurrencies.includes(data.currency)) {
        errors.push(`${data.currency} is not enabled in your currency settings. Please enable it in Settings > Currency and try again.`);
      }
    }

    // Check for missing optional fields
    if (!data.description) missing_fields.push('description');
    if (!data.category_name) missing_fields.push('category');
    if (!data.vendor_name) missing_fields.push('vendor');
    // Reference number is always optional, don't list as missing

    // Validate category if provided
    if (data.category_name) {
      const { exactMatch, similarCategories } = await searchCategoryByName(userId, data.category_name, 'expense');
      if (!exactMatch && similarCategories.length > 0) {
        const categoryList = similarCategories.map((c) => `- ${c.name}`).join('\n');
        errors.push(`Found ${similarCategories.length} similar categor${similarCategories.length > 1 ? 'ies' : 'y'} but no exact match for "${data.category_name}":\n\n${categoryList}\n\nWhich one did you mean? Or I can create a new category "${data.category_name}".`);
      } else if (!exactMatch && similarCategories.length === 0) {
        errors.push(`Category "${data.category_name}" doesn't exist. Would you like me to create it?`);
      }
    }

    // Validate vendor if provided
    if (data.vendor_name) {
      const { exactMatch, similarVendors } = await searchVendorByName(userId, data.vendor_name);
      if (!exactMatch && similarVendors.length > 0) {
        const vendorList = similarVendors
          .map((v) => `- ${v.name}${v.email ? ` (${v.email})` : ''}`)
          .join('\n');
        errors.push(`Found ${similarVendors.length} similar vendor${similarVendors.length > 1 ? 's' : ''} but no exact match for "${data.vendor_name}":\n\n${vendorList}\n\nWhich one did you mean? Or I can create a new vendor "${data.vendor_name}".`);
      } else if (!exactMatch && similarVendors.length === 0) {
        errors.push(`Vendor "${data.vendor_name}" doesn't exist. Would you like me to create it?`);
      }
    }

    // Validate tax rate if provided
    if (data.tax_rate !== undefined && data.tax_rate !== null && data.tax_rate > 0) {
      const { exactMatch, similarRates } = await searchTaxRateByPercentage(userId, data.tax_rate);
      if (!exactMatch && similarRates.length > 0) {
        const rateList = similarRates.map(r => `- ${r.name} (${r.rate}%)`).join('\n');
        errors.push(`Found ${similarRates.length} similar tax rate${similarRates.length > 1 ? 's' : ''} but no exact match for ${data.tax_rate}%:\n\n${rateList}\n\nWhich one did you mean? Or should I create a new ${data.tax_rate}% tax rate?`);
      } else if (!exactMatch && similarRates.length === 0) {
        errors.push(`You don't have a ${data.tax_rate}% tax rate set up yet. Would you like me to create it?`);
      }
    }

    console.log('[validateExpenseTool] Validation result:', {
      valid: errors.length === 0,
      errorsCount: errors.length,
      missingCount: missing_fields.length
    });

    return {
      valid: errors.length === 0,
      errors,
      missing_fields
    };
  } catch (error: any) {
    console.error('[validateExpenseTool] Error:', error);
    return {
      valid: false,
      errors: [error.message],
      missing_fields: []
    };
  }
};

/**
 * Create a new expense record
 * Shows preview to user before saving
 */
export const createExpenseTool = async (
  userId: string,
  conversationId: string,
  data: {
    amount: number;
    description: string;
    date: string;
    category_name?: string;
    vendor_name?: string;
    reference_number?: string;
    tax_rate?: number;
    currency?: string;
  },
  exchangeRates: Record<string, number> = {}
): Promise<{ success: boolean; pending_action_id?: string; error?: string }> => {
  try {
    console.log('[createExpenseTool] ========== FUNCTION CALLED ==========');
    console.log('[createExpenseTool] Parameters:', JSON.stringify(data, null, 2));

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
      const { exactMatch, similarCategories } = await searchCategoryByName(userId, data.category_name, 'expense');

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

    // Handle vendor (optional - only validate if provided)
    let vendorId: string | undefined;
    let vendorName: string | undefined;

    if (data.vendor_name) {
      const { exactMatch, similarVendors } = await searchVendorByName(userId, data.vendor_name);

      if (exactMatch) {
        vendorId = exactMatch.id;
        vendorName = exactMatch.name;
      } else if (similarVendors.length > 0) {
        const vendorList = similarVendors
          .map((v) => `- ${v.name}${v.email ? ` (${v.email})` : ''}`)
          .join('\n');
        return {
          success: false,
          error: `Found ${similarVendors.length} similar vendor${similarVendors.length > 1 ? 's' : ''}:\n\n${vendorList}\n\nWhich one did you mean? Or I can create a new vendor "${data.vendor_name}" for you.`,
        };
      } else {
        // Vendor not found - suggest creating it
        return {
          success: false,
          error: `Vendor "${data.vendor_name}" doesn't exist. Would you like me to create it?`,
        };
      }
    }

    // Tax validation and calculation
    let taxRate = data.tax_rate ?? invoiceSettings.default_tax_rate ?? 0;
    let taxRateName: string | undefined;

    console.log('[createExpenseTool] Tax validation:', {
      provided_tax_rate: data.tax_rate,
      default_tax_rate: invoiceSettings.default_tax_rate,
      will_validate: data.tax_rate !== undefined && data.tax_rate !== null && data.tax_rate > 0
    });

    if (data.tax_rate !== undefined && data.tax_rate !== null && data.tax_rate > 0) {
      // User specified a custom tax rate - validate it exists
      console.log('[createExpenseTool] Validating custom tax rate:', data.tax_rate);
      const { exactMatch, similarRates } = await searchTaxRateByPercentage(userId, data.tax_rate);
      console.log('[createExpenseTool] Tax validation result:', {
        exactMatch: !!exactMatch,
        similarRatesCount: similarRates.length
      });

      if (exactMatch) {
        // Tax rate exists, use it
        taxRate = exactMatch.rate;
        taxRateName = exactMatch.name;
        console.log('[createExpenseTool] Using existing tax rate:', taxRateName, taxRate);
      } else if (similarRates.length > 0) {
        // Similar tax rates found
        const rateList = similarRates.map(r => `- ${r.name} (${r.rate}%)`).join('\n');
        return {
          success: false,
          error: `Found ${similarRates.length} similar tax rate${similarRates.length > 1 ? 's' : ''} but no exact match for ${data.tax_rate}%:\n\n${rateList}\n\nWhich one did you mean? Or should I create a new ${data.tax_rate}% tax rate?`
        };
      } else {
        // Tax rate doesn't exist
        console.log('[createExpenseTool] Tax rate not found, returning error');
        return {
          success: false,
          error: `You don't have a ${data.tax_rate}% tax rate set up yet. Would you like me to create it?`
        };
      }
    }

    const taxAmount = taxRate > 0 ? (data.amount * taxRate) / 100 : 0;

    // Currency and exchange rate handling
    const currency = data.currency || userSettings.base_currency || 'USD';
    const baseCurrency = userSettings.base_currency || 'USD';

    let exchangeRate = 1;
    let baseAmount = data.amount;

    // Use exchange rate if currency is different from base currency
    if (currency !== baseCurrency) {
      console.log('[createExpenseTool] ========== EXCHANGE RATE HANDLING ==========');
      console.log('[createExpenseTool] Expense currency:', currency);
      console.log('[createExpenseTool] Base currency:', baseCurrency);
      console.log('[createExpenseTool] Expense amount:', data.amount);
      console.log('[createExpenseTool] Available cached rates:', Object.keys(exchangeRates).length > 0 ? Object.keys(exchangeRates).join(', ') : 'NONE');

      try {
        // Try cached rate first, fall back to edge function if not available
        if (exchangeRates && exchangeRates[currency]) {
          exchangeRate = exchangeRates[currency];
          console.log('[createExpenseTool] ✓ Using CACHED exchange rate:', exchangeRate);
          console.log('[createExpenseTool] Source: SettingsContext (fast)');
        } else {
          console.warn('[createExpenseTool] ⚠ Cached rate NOT available for', currency);
          console.log('[createExpenseTool] Falling back to edge function...');
          exchangeRate = await getExchangeRate(userId, currency, baseCurrency);
          console.log('[createExpenseTool] ✓ Fetched exchange rate from edge function:', exchangeRate);
          console.log('[createExpenseTool] Source: Edge function (slower)');
        }

        baseAmount = data.amount / exchangeRate;
        console.log('[createExpenseTool] Calculation:', data.amount, '/', exchangeRate, '=', baseAmount);
        console.log('[createExpenseTool] Final base amount (', baseCurrency, '):', baseAmount);
        console.log('[createExpenseTool] ========== EXCHANGE RATE SUCCESS ==========');
      } catch (error: any) {
        console.error('[createExpenseTool] ========== EXCHANGE RATE ERROR ==========');
        console.error('[createExpenseTool] Error fetching exchange rate:', error);
        console.error('[createExpenseTool] Currency:', currency, '| Base:', baseCurrency);
        console.error('[createExpenseTool] Defaulting to rate 1 (no conversion)');
        console.error('[createExpenseTool] ========== ERROR END ==========');
        exchangeRate = 1; // Fallback to 1 if error
        baseAmount = data.amount;
      }
    } else {
      console.log('[createExpenseTool] Currency matches base currency (', baseCurrency, ') - no conversion needed');
    }

    // Create pending action for preview
    const pendingAction = await createPendingAction(conversationId, userId, 'expense', {
      amount: data.amount,
      description: data.description,
      date: parsedDate,
      category_id: categoryId,
      category_name: categoryName,
      vendor_id: vendorId,
      vendor_name: vendorName,
      reference_number: data.reference_number,
      tax_rate: taxRate,
      tax_rate_name: taxRateName,
      tax_amount: taxAmount,
      currency: currency,
      exchange_rate: exchangeRate,
      base_amount: baseAmount,
    });

    return { success: true, pending_action_id: pendingAction.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get expense records with filters
 * Can filter by date range, category, vendor, etc.
 */
export const getExpensesTool = async (
  userId: string,
  filters?: {
    start_date?: string;
    end_date?: string;
    category_name?: string;
    vendor_name?: string;
  }
): Promise<any[]> => {
  try {
    // Fetch expense records
    let expenses = await getExpenses(userId, filters?.start_date, filters?.end_date);

    console.log('[getExpensesTool] Fetched expense count:', expenses.length);
    console.log('[getExpensesTool] Filters:', JSON.stringify(filters, null, 2));

    // Filter by category name (if provided)
    if (filters?.category_name) {
      const searchLower = filters.category_name.toLowerCase();
      const beforeFilter = expenses.length;

      expenses = expenses.filter((exp) => {
        const matches =
          exp.category?.name?.toLowerCase().includes(searchLower) ||
          searchLower.includes(exp.category?.name?.toLowerCase() || '');
        return matches;
      });

      console.log('[getExpensesTool] Category filter:', beforeFilter, '→', expenses.length);
    }

    // Filter by vendor name (if provided)
    if (filters?.vendor_name) {
      const searchLower = filters.vendor_name.toLowerCase();
      const beforeFilter = expenses.length;

      expenses = expenses.filter((exp) => {
        const matches =
          exp.vendor_detail?.name?.toLowerCase().includes(searchLower) ||
          searchLower.includes(exp.vendor_detail?.name?.toLowerCase() || '');
        return matches;
      });

      console.log('[getExpensesTool] Vendor filter:', beforeFilter, '→', expenses.length);
    }

    console.log('[getExpensesTool] Final result count:', expenses.length);
    return expenses;
  } catch (error) {
    console.error('[getExpensesTool] Error:', error);
    return [];
  }
};

/**
 * Update an existing expense record
 */
export const updateExpenseTool = async (
  userId: string,
  conversationId: string,
  data: {
    expense_id: string;
    amount?: number;
    description?: string;
    date?: string;
    category_name?: string;
    vendor_name?: string;
    reference_number?: string;
    tax_rate?: number;
    currency?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verify expense exists
    const expenses = await getExpenses(userId);
    const existingExpense = expenses.find((exp) => exp.id === data.expense_id);

    if (!existingExpense) {
      return { success: false, error: `Expense record with ID ${data.expense_id} not found.` };
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
      const { exactMatch, similarCategories } = await searchCategoryByName(userId, data.category_name, 'expense');

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

    // Handle vendor
    if (data.vendor_name) {
      const { exactMatch, similarVendors } = await searchVendorByName(userId, data.vendor_name);

      if (exactMatch) {
        updateData.vendor_id = exactMatch.id;
      } else if (similarVendors.length > 0) {
        const vendorList = similarVendors
          .map((v) => `- ${v.name}${v.email ? ` (${v.email})` : ''}`)
          .join('\n');
        return {
          success: false,
          error: `Found ${similarVendors.length} similar vendor${similarVendors.length > 1 ? 's' : ''}:\n\n${vendorList}\n\nWhich one did you mean?`,
        };
      } else {
        return {
          success: false,
          error: `Vendor "${data.vendor_name}" doesn't exist. Would you like me to create it?`,
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

    // Update expense
    await updateExpense(data.expense_id, updateData);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
