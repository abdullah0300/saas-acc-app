/**
 * Income Tools - Income-specific operations
 * Handles creating, reading, and updating income records
 */

import { createIncome, updateIncome, getIncomes } from '../../../database';
import { createPendingAction } from '../../pendingActionsService';
import { getUserSettings, getInvoiceSettings, getExchangeRate, parseRelativeDate } from '../../userSettingsService';
import { searchClientByName } from '../shared/clientTools';
import { searchCategoryByName } from '../shared/categoryTools';
import { searchProjectByName } from '../shared/projectTools';
import { searchTaxRateByPercentage } from '../shared/taxTools';

/**
 * Validate income data before creating
 * Checks all provided fields and returns errors + missing fields
 * Does NOT create pending action - only validates
 */
export const validateIncomeTool = async (
  userId: string,
  data: {
    amount: number;
    description?: string;
    category_name?: string;
    client_name?: string;
    project_name?: string;
    tax_rate?: number;
    currency?: string;
  }
): Promise<{
  valid: boolean;
  errors: string[];
  missing_fields: string[];
}> => {
  try {
    console.log('[validateIncomeTool] Validating income data:', JSON.stringify(data, null, 2));

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
    if (!data.client_name) missing_fields.push('client');
    if (!data.project_name) missing_fields.push('project');
    // Reference number is always optional, don't list as missing

    // Validate category if provided
    if (data.category_name) {
      const { exactMatch, similarCategories } = await searchCategoryByName(userId, data.category_name, 'income');
      if (!exactMatch && similarCategories.length > 0) {
        const categoryList = similarCategories.map((c) => `- ${c.name}`).join('\n');
        errors.push(`Found ${similarCategories.length} similar categor${similarCategories.length > 1 ? 'ies' : 'y'} but no exact match for "${data.category_name}":\n\n${categoryList}\n\nWhich one did you mean? Or I can create a new category "${data.category_name}".`);
      } else if (!exactMatch && similarCategories.length === 0) {
        errors.push(`Category "${data.category_name}" doesn't exist. Would you like me to create it?`);
      }
    }

    // Validate client if provided (and track if validation passed)
    let clientValidationPassed = false;
    let validatedClientId: string | undefined;

    if (data.client_name) {
      const { exactMatch, similarClients } = await searchClientByName(userId, data.client_name);
      if (exactMatch) {
        clientValidationPassed = true;
        validatedClientId = exactMatch.id;
      } else if (similarClients.length > 0) {
        const clientList = similarClients
          .map((c) => `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`)
          .join('\n');
        errors.push(`Found ${similarClients.length} similar client${similarClients.length > 1 ? 's' : ''} but no exact match for "${data.client_name}":\n\n${clientList}\n\nWhich one did you mean? Or I can create a new client "${data.client_name}".`);
      } else {
        errors.push(`Client "${data.client_name}" doesn't exist. Would you like me to create it?`);
      }
    } else {
      // No client provided, so we can't validate project
      clientValidationPassed = true; // Allow project validation to proceed if user provided project without client
    }

    // Validate project ONLY if client validation passed (staged validation)
    // This ensures user fixes client issues first before dealing with project issues
    if (data.project_name) {
      if (data.client_name && !clientValidationPassed) {
        // Client validation failed - skip project validation for now
        // User will fix client first, then project gets validated on next call
        console.log('[validateIncomeTool] Skipping project validation - client validation failed first');
      } else if (data.client_name && clientValidationPassed && validatedClientId) {
        // Client exists - validate project for that client
        const { exactMatch, similarProjects } = await searchProjectByName(userId, data.project_name, validatedClientId);
        if (!exactMatch && similarProjects.length > 0) {
          const projectList = similarProjects
            .map((p) => `- ${p.name}${p.client ? ` (${p.client.name})` : ''}`)
            .join('\n');
          errors.push(`Found ${similarProjects.length} similar project${similarProjects.length > 1 ? 's' : ''} but no exact match for "${data.project_name}":\n\n${projectList}\n\nWhich one did you mean? Or I can create a new project "${data.project_name}".`);
        } else if (!exactMatch) {
          errors.push(`Project "${data.project_name}" doesn't exist for this client. Would you like me to create it?`);
        }
      } else if (!data.client_name) {
        // User provided project without client - ask for client first
        errors.push(`Projects must be linked to a client. Please specify which client this project belongs to.`);
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

    console.log('[validateIncomeTool] Validation result:', {
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
    console.error('[validateIncomeTool] Error:', error);
    return {
      valid: false,
      errors: [error.message],
      missing_fields: []
    };
  }
};

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
    project_name?: string;
    reference_number?: string;
    tax_rate?: number;
    currency?: string;
  },
  exchangeRates: Record<string, number> = {}
): Promise<{ success: boolean; pending_action_id?: string; error?: string }> => {
  try {
    console.log('[createIncomeTool] ========== FUNCTION CALLED ==========');
    console.log('[createIncomeTool] Parameters:', JSON.stringify(data, null, 2));

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
    let clientCompanyName: string | undefined;

    if (data.client_name) {
      const { exactMatch, similarClients } = await searchClientByName(userId, data.client_name);

      if (exactMatch) {
        clientId = exactMatch.id;
        clientName = exactMatch.name;
        clientCompanyName = exactMatch.company_name || undefined;
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

    // Handle project (optional - only validate if provided)
    let projectId: string | undefined;
    let projectName: string | undefined;

    if (data.project_name) {
      const { exactMatch, similarProjects } = await searchProjectByName(userId, data.project_name, clientId);

      if (exactMatch) {
        projectId = exactMatch.id;
        projectName = exactMatch.name;
      } else if (similarProjects.length > 0) {
        const projectList = similarProjects
          .map((p) => `- ${p.name}${p.client ? ` (${p.client.name})` : ''}`)
          .join('\n');
        return {
          success: false,
          error: `Found ${similarProjects.length} similar project${similarProjects.length > 1 ? 's' : ''}:\n\n${projectList}\n\nWhich one did you mean? Or I can create a new project "${data.project_name}" for you.`,
        };
      } else {
        // Project not found - suggest creating it
        return {
          success: false,
          error: `Project "${data.project_name}" doesn't exist. Would you like me to create it?`,
        };
      }
    }

    // Tax validation and calculation
    let taxRate = data.tax_rate ?? invoiceSettings.default_tax_rate ?? 0;
    let taxRateName: string | undefined;

    console.log('[createIncomeTool] Tax validation:', {
      provided_tax_rate: data.tax_rate,
      default_tax_rate: invoiceSettings.default_tax_rate,
      will_validate: data.tax_rate !== undefined && data.tax_rate !== null && data.tax_rate > 0
    });

    if (data.tax_rate !== undefined && data.tax_rate !== null && data.tax_rate > 0) {
      // User specified a custom tax rate - validate it exists
      console.log('[createIncomeTool] Validating custom tax rate:', data.tax_rate);
      const { exactMatch, similarRates } = await searchTaxRateByPercentage(userId, data.tax_rate);
      console.log('[createIncomeTool] Tax validation result:', {
        exactMatch: !!exactMatch,
        similarRatesCount: similarRates.length
      });

      if (exactMatch) {
        // Tax rate exists, use it
        taxRate = exactMatch.rate;
        taxRateName = exactMatch.name;
        console.log('[createIncomeTool] Using existing tax rate:', taxRateName, taxRate);
      } else if (similarRates.length > 0) {
        // Similar tax rates found
        const rateList = similarRates.map(r => `- ${r.name} (${r.rate}%)`).join('\n');
        return {
          success: false,
          error: `Found ${similarRates.length} similar tax rate${similarRates.length > 1 ? 's' : ''} but no exact match for ${data.tax_rate}%:\n\n${rateList}\n\nWhich one did you mean? Or should I create a new ${data.tax_rate}% tax rate?`
        };
      } else {
        // Tax rate doesn't exist
        console.log('[createIncomeTool] Tax rate not found, returning error');
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
      console.log('[createIncomeTool] ========== EXCHANGE RATE HANDLING ==========');
      console.log('[createIncomeTool] Income currency:', currency);
      console.log('[createIncomeTool] Base currency:', baseCurrency);
      console.log('[createIncomeTool] Income amount:', data.amount);
      console.log('[createIncomeTool] Available cached rates:', Object.keys(exchangeRates).length > 0 ? Object.keys(exchangeRates).join(', ') : 'NONE');

      try {
        // Try cached rate first, fall back to edge function if not available
        if (exchangeRates && exchangeRates[currency]) {
          exchangeRate = exchangeRates[currency];
          console.log('[createIncomeTool] ✓ Using CACHED exchange rate:', exchangeRate);
          console.log('[createIncomeTool] Source: SettingsContext (fast)');
        } else {
          console.warn('[createIncomeTool] ⚠ Cached rate NOT available for', currency);
          console.log('[createIncomeTool] Falling back to edge function...');
          exchangeRate = await getExchangeRate(userId, currency, baseCurrency);
          console.log('[createIncomeTool] ✓ Fetched exchange rate from edge function:', exchangeRate);
          console.log('[createIncomeTool] Source: Edge function (slower)');
        }

        baseAmount = data.amount / exchangeRate;
        console.log('[createIncomeTool] Calculation:', data.amount, '/', exchangeRate, '=', baseAmount);
        console.log('[createIncomeTool] Final base amount (', baseCurrency, '):', baseAmount);
        console.log('[createIncomeTool] ========== EXCHANGE RATE SUCCESS ==========');
      } catch (error: any) {
        console.error('[createIncomeTool] ========== EXCHANGE RATE ERROR ==========');
        console.error('[createIncomeTool] Error fetching exchange rate:', error);
        console.error('[createIncomeTool] Currency:', currency, '| Base:', baseCurrency);
        console.error('[createIncomeTool] Defaulting to rate 1 (no conversion)');
        console.error('[createIncomeTool] ========== ERROR END ==========');
        exchangeRate = 1; // Fallback to 1 if error
        baseAmount = data.amount;
      }
    } else {
      console.log('[createIncomeTool] Currency matches base currency (', baseCurrency, ') - no conversion needed');
    }

    // Create pending action for preview
    const pendingAction = await createPendingAction(conversationId, userId, 'income', {
      amount: data.amount,
      description: data.description,
      date: parsedDate,
      category_id: categoryId,
      category_name: categoryName,
      client_id: clientId,
      client_name: clientName,
      client_company_name: clientCompanyName,
      project_id: projectId,
      project_name: projectName,
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
    project_name?: string;
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

    // Handle project
    if (data.project_name) {
      const clientId = updateData.client_id || existingIncome.client_id;
      const { exactMatch, similarProjects } = await searchProjectByName(userId, data.project_name, clientId);

      if (exactMatch) {
        updateData.project_id = exactMatch.id;
      } else if (similarProjects.length > 0) {
        const projectList = similarProjects
          .map((p) => `- ${p.name}${p.client ? ` (${p.client.name})` : ''}`)
          .join('\n');
        return {
          success: false,
          error: `Found ${similarProjects.length} similar project${similarProjects.length > 1 ? 's' : ''}:\n\n${projectList}\n\nWhich one did you mean?`,
        };
      } else {
        return {
          success: false,
          error: `Project "${data.project_name}" doesn't exist. Would you like me to create it?`,
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
