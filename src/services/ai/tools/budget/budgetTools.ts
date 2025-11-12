/**
 * Budget Tools - Budget management operations
 * Handles creating, reading, updating, and deleting budget records
 */

import { createBudget, updateBudget, deleteBudget, getBudgets, getIncomes, getExpenses } from '../../../database';
import { createPendingAction } from '../../pendingActionsService';
import { getUserSettings, parseRelativeDate } from '../../userSettingsService';
import { searchCategoryByName } from '../shared/categoryTools';
import { format, startOfMonth } from 'date-fns';

/**
 * Validate budget data before creating
 * Checks category exists and returns errors + missing fields
 */
export const validateBudgetTool = async (
  userId: string,
  data: {
    amount: number;
    category_name?: string;
    period?: 'monthly' | 'quarterly' | 'yearly';
  }
): Promise<{
  valid: boolean;
  errors: string[];
  missing_fields: string[];
}> => {
  try {
    console.log('[validateBudgetTool] Validating budget data:', JSON.stringify(data, null, 2));

    const errors: string[] = [];
    const missing_fields: string[] = [];

    // Check for missing optional fields
    if (!data.category_name) missing_fields.push('category');
    if (!data.period) missing_fields.push('period');

    // Validate category if provided
    if (data.category_name) {
      // Try income categories first
      const { exactMatch: incomeMatch, similarCategories: similarIncome } = await searchCategoryByName(userId, data.category_name, 'income');

      if (!incomeMatch) {
        // Try expense categories
        const { exactMatch: expenseMatch, similarCategories: similarExpense } = await searchCategoryByName(userId, data.category_name, 'expense');

        if (!expenseMatch) {
          // Not found in either - show all similar categories
          const allSimilar = [...similarIncome, ...similarExpense];

          if (allSimilar.length > 0) {
            const categoryList = allSimilar.map((c) => `- ${c.name} (${c.type})`).join('\n');
            errors.push(`Found ${allSimilar.length} similar categor${allSimilar.length > 1 ? 'ies' : 'y'} but no exact match for "${data.category_name}":\n\n${categoryList}\n\nWhich one did you mean? Or I can create a new category "${data.category_name}".`);
          } else {
            errors.push(`Category "${data.category_name}" doesn't exist. Would you like me to create it? (Specify if it's an income or expense category)`);
          }
        }
      }
    }

    console.log('[validateBudgetTool] Validation result:', {
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
    console.error('[validateBudgetTool] Error:', error);
    return {
      valid: false,
      errors: [error.message],
      missing_fields: []
    };
  }
};

/**
 * Create a new budget record
 * Shows preview to user before saving
 */
export const createBudgetTool = async (
  userId: string,
  conversationId: string,
  data: {
    amount: number;
    category_name: string;
    period: 'monthly' | 'quarterly' | 'yearly';
    start_date?: string;
  }
): Promise<{ success: boolean; pending_action_id?: string; error?: string }> => {
  try {
    console.log('[createBudgetTool] ========== FUNCTION CALLED ==========');
    console.log('[createBudgetTool] Parameters:', JSON.stringify(data, null, 2));

    // Parse start date (default to start of current month)
    let startDate: string;
    if (!data.start_date) {
      startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    } else {
      const parsed = parseRelativeDate(data.start_date);
      startDate = parsed || data.start_date;
    }

    // Handle category - try income first, then expense
    let categoryId: string | undefined;
    let categoryName: string | undefined;
    let categoryType: 'income' | 'expense' | undefined;

    // Try income categories
    const { exactMatch: incomeMatch } = await searchCategoryByName(userId, data.category_name, 'income');

    if (incomeMatch) {
      categoryId = incomeMatch.id;
      categoryName = incomeMatch.name;
      categoryType = 'income';
    } else {
      // Try expense categories
      const { exactMatch: expenseMatch, similarCategories: similarExpense } = await searchCategoryByName(userId, data.category_name, 'expense');

      if (expenseMatch) {
        categoryId = expenseMatch.id;
        categoryName = expenseMatch.name;
        categoryType = 'expense';
      } else {
        // Not found in either
        if (similarExpense.length > 0) {
          const categoryList = similarExpense.map((c) => `- ${c.name}`).join('\n');
          return {
            success: false,
            error: `Found ${similarExpense.length} similar expense categor${similarExpense.length > 1 ? 'ies' : 'y'}:\n\n${categoryList}\n\nWhich one did you mean? Or I can create a new category "${data.category_name}" for you.`,
          };
        } else {
          return {
            success: false,
            error: `Category "${data.category_name}" doesn't exist. Would you like me to create it? (Please specify if it's an income or expense category)`,
          };
        }
      }
    }

    // Check if budget already exists for this category
    const existingBudgets = await getBudgets(userId);
    const duplicateBudget = existingBudgets.find(b => b.category_id === categoryId);

    if (duplicateBudget) {
      return {
        success: false,
        error: `A budget already exists for category "${categoryName}". Would you like me to update it instead?`,
      };
    }

    // Create pending action for preview
    const pendingAction = await createPendingAction(conversationId, userId, 'budget', {
      amount: data.amount,
      category_id: categoryId,
      category_name: categoryName,
      category_type: categoryType,
      period: data.period,
      start_date: startDate,
    });

    return { success: true, pending_action_id: pendingAction.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get budget records with progress information
 */
export const getBudgetsTool = async (
  userId: string,
  filters?: {
    category_name?: string;
    period?: 'monthly' | 'quarterly' | 'yearly';
  }
): Promise<any[]> => {
  try {
    // Fetch budgets
    let budgets = await getBudgets(userId);

    console.log('[getBudgetsTool] Fetched budget count:', budgets.length);
    console.log('[getBudgetsTool] Filters:', JSON.stringify(filters, null, 2));

    // Filter by category name (if provided)
    if (filters?.category_name) {
      const searchLower = filters.category_name.toLowerCase();
      const beforeFilter = budgets.length;

      budgets = budgets.filter((budget) => {
        const matches =
          budget.category?.name?.toLowerCase().includes(searchLower) ||
          searchLower.includes(budget.category?.name?.toLowerCase() || '');
        return matches;
      });

      console.log('[getBudgetsTool] Category filter:', beforeFilter, '→', budgets.length);
    }

    // Filter by period (if provided)
    if (filters?.period) {
      const beforeFilter = budgets.length;
      budgets = budgets.filter((budget) => budget.period === filters.period);
      console.log('[getBudgetsTool] Period filter:', beforeFilter, '→', budgets.length);
    }

    // Calculate progress for each budget
    const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const endDate = format(new Date(), 'yyyy-MM-dd');

    const [incomes, expenses] = await Promise.all([
      getIncomes(userId, startDate, endDate),
      getExpenses(userId, startDate, endDate)
    ]);

    const budgetsWithProgress = budgets.map(budget => {
      let actualAmount = 0;

      if (budget.category?.type === 'income') {
        actualAmount = incomes
          .filter(inc => inc.category_id === budget.category_id)
          .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);
      } else {
        actualAmount = expenses
          .filter(exp => exp.category_id === budget.category_id)
          .reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);
      }

      const budgetedAmount = budget.amount || 0;
      const remaining = budgetedAmount - actualAmount;
      const percentage = budgetedAmount > 0 ? Math.round((actualAmount / budgetedAmount) * 100) : 0;

      return {
        ...budget,
        actual: Math.round(actualAmount),
        remaining: Math.round(remaining),
        percentage: percentage,
        status: percentage >= 90 ? 'critical' : percentage >= 70 ? 'warning' : 'healthy'
      };
    });

    console.log('[getBudgetsTool] Final result count:', budgetsWithProgress.length);
    return budgetsWithProgress;
  } catch (error) {
    console.error('[getBudgetsTool] Error:', error);
    return [];
  }
};

/**
 * Update an existing budget record
 */
export const updateBudgetTool = async (
  userId: string,
  conversationId: string,
  data: {
    budget_id?: string;
    category_name?: string;
    amount?: number;
    period?: 'monthly' | 'quarterly' | 'yearly';
    start_date?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Find budget by ID or category name
    const budgets = await getBudgets(userId);
    let existingBudget;

    if (data.budget_id) {
      existingBudget = budgets.find((b) => b.id === data.budget_id);
    } else if (data.category_name) {
      // Search by category name
      const searchLower = data.category_name.toLowerCase();
      existingBudget = budgets.find(
        (b) => b.category?.name?.toLowerCase() === searchLower
      );
    }

    if (!existingBudget) {
      return {
        success: false,
        error: data.budget_id
          ? `Budget with ID ${data.budget_id} not found.`
          : `No budget found for category "${data.category_name}".`
      };
    }

    // Prepare update data
    const updateData: any = {};

    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.period !== undefined) updateData.period = data.period;
    if (data.start_date !== undefined) {
      const parsedDate = parseRelativeDate(data.start_date) || data.start_date;
      updateData.start_date = parsedDate;
    }

    // Handle category change
    if (data.category_name && data.category_name.toLowerCase() !== existingBudget.category?.name?.toLowerCase()) {
      // Try income first, then expense
      const { exactMatch: incomeMatch } = await searchCategoryByName(userId, data.category_name, 'income');

      if (incomeMatch) {
        updateData.category_id = incomeMatch.id;
      } else {
        const { exactMatch: expenseMatch, similarCategories } = await searchCategoryByName(userId, data.category_name, 'expense');

        if (expenseMatch) {
          updateData.category_id = expenseMatch.id;
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
    }

    // Update budget
    await updateBudget(existingBudget.id, updateData);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Delete a budget record
 */
export const deleteBudgetTool = async (
  userId: string,
  data: {
    budget_id?: string;
    category_name?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Find budget by ID or category name
    const budgets = await getBudgets(userId);
    let existingBudget;

    if (data.budget_id) {
      existingBudget = budgets.find((b) => b.id === data.budget_id);
    } else if (data.category_name) {
      const searchLower = data.category_name.toLowerCase();
      existingBudget = budgets.find(
        (b) => b.category?.name?.toLowerCase() === searchLower
      );
    }

    if (!existingBudget) {
      return {
        success: false,
        error: data.budget_id
          ? `Budget with ID ${data.budget_id} not found.`
          : `No budget found for category "${data.category_name}".`
      };
    }

    // Delete budget
    await deleteBudget(existingBudget.id);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
