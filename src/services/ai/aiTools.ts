/**
 * AI Tools - Wrappers for database functions
 * These tools are available for the AI to call when needed
 */

import {
  createInvoice,
  getInvoices,
  getInvoice,
  createExpense,
  getExpenses,
  createIncome,
  updateIncome,
  getIncomes,
  getClients,
  createClient,
  getCategories,
  createCategory,
  checkCategoryExists,
  getProjects,
} from '../database';
import { createPendingAction } from './pendingActionsService';
import { getSystemKnowledge } from '../../config/aiSystemKnowledge';
import { getUserSettings, getInvoiceSettings, getExchangeRate, parseRelativeDate, getCurrentDate } from './userSettingsService';
import type { Client, Category } from '../../types';

// Note: We'll need to import project functions if they exist
// For now, we'll create basic wrappers

/**
 * Tool: Parse Date Query
 * This tool MUST be called first by AI whenever user mentions dates, date ranges, or time-related queries.
 * It parses natural language dates and returns standardized YYYY-MM-DD format.
 */
export const parseDateQueryTool = async (
  dateQuery: string
): Promise<{ 
  success: boolean; 
  start_date?: string; 
  end_date?: string; 
  current_date?: string;
  current_year?: number;
  parsed_info?: string;
  next_action?: string;
  error?: string;
}> => {
  try {
    console.log('[parseDateQueryTool] Received dateQuery:', dateQuery);
    const today = new Date();
    const currentDate = getCurrentDate(); // YYYY-MM-DD format
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();
    
    console.log('[parseDateQueryTool] Current date:', currentDate, 'Current year:', currentYear);
    
    const query = dateQuery.toLowerCase().trim();
    
    // If query is empty or just whitespace, return current date info
    if (!query || query.length === 0) {
      return {
        success: true,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: 'No date query provided. Returning current date info.',
        next_action: 'If you need to fetch data, call getIncomeTool, getExpensesTool, or getInvoicesTool with appropriate date parameters.',
      };
    }

    // Parse month names
    const monthMap: { [key: string]: number } = {
      'january': 1, 'jan': 1,
      'february': 2, 'feb': 2,
      'march': 3, 'mar': 3,
      'april': 4, 'apr': 4,
      'may': 5,
      'june': 6, 'jun': 6,
      'july': 7, 'jul': 7,
      'august': 8, 'aug': 8,
      'september': 9, 'sep': 9, 'sept': 9,
      'october': 10, 'oct': 10,
      'november': 11, 'nov': 11,
      'december': 12, 'dec': 12,
    };

    // Helper function to format date to YYYY-MM-DD
    const formatDate = (year: number, month: number, day: number): string => {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    // Helper function to get week start (Monday)
    const getWeekStart = (date: Date): Date => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      return new Date(d.setDate(diff));
    };

    // Helper function to get week end (Sunday)
    const getWeekEnd = (date: Date): Date => {
      const weekStart = getWeekStart(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return weekEnd;
    };

    // Parse relative dates first
    if (query === 'today') {
      return {
        success: true,
        start_date: currentDate,
        end_date: currentDate,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Today is ${currentDate}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    if (query === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate());
      return {
        success: true,
        start_date: yesterdayStr,
        end_date: yesterdayStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Yesterday was ${yesterdayStr}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    if (query === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatDate(tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate());
      return {
        success: true,
        start_date: tomorrowStr,
        end_date: tomorrowStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Tomorrow is ${tomorrowStr}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    // Parse "last N days"
    const lastDaysMatch = query.match(/last\s+(\d+)\s+days?/);
    if (lastDaysMatch) {
      const days = parseInt(lastDaysMatch[1]);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - days);
      const startStr = formatDate(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
      return {
        success: true,
        start_date: startStr,
        end_date: currentDate,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Last ${days} days: ${startStr} to ${currentDate}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    // Parse "this week"
    if (query.includes('this week')) {
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);
      const startStr = formatDate(weekStart.getFullYear(), weekStart.getMonth() + 1, weekStart.getDate());
      const endStr = formatDate(weekEnd.getFullYear(), weekEnd.getMonth() + 1, weekEnd.getDate());
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `This week: ${startStr} to ${endStr}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    // Parse "last week"
    if (query.includes('last week')) {
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const weekStart = getWeekStart(lastWeekStart);
      const weekEnd = getWeekEnd(lastWeekStart);
      const startStr = formatDate(weekStart.getFullYear(), weekStart.getMonth() + 1, weekStart.getDate());
      const endStr = formatDate(weekEnd.getFullYear(), weekEnd.getMonth() + 1, weekEnd.getDate());
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Last week: ${startStr} to ${endStr}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    // Parse "this month"
    if (query.includes('this month')) {
      const monthStart = new Date(currentYear, currentMonth - 1, 1);
      const monthEnd = new Date(currentYear, currentMonth, 0);
      const startStr = formatDate(monthStart.getFullYear(), monthStart.getMonth() + 1, monthStart.getDate());
      const endStr = formatDate(monthEnd.getFullYear(), monthEnd.getMonth() + 1, monthEnd.getDate());
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `This month: ${startStr} to ${endStr}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    // Parse "last month"
    if (query.includes('last month')) {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const monthStart = new Date(lastMonthYear, lastMonth - 1, 1);
      const monthEnd = new Date(lastMonthYear, lastMonth, 0);
      const startStr = formatDate(monthStart.getFullYear(), monthStart.getMonth() + 1, monthStart.getDate());
      const endStr = formatDate(monthEnd.getFullYear(), monthEnd.getMonth() + 1, monthEnd.getDate());
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Last month: ${startStr} to ${endStr}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    // Parse "this year"
    if (query.includes('this year')) {
      const startStr = `${currentYear}-01-01`;
      const endStr = `${currentYear}-12-31`;
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `This year: ${startStr} to ${endStr}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    // Parse "last year"
    if (query.includes('last year')) {
      const lastYear = currentYear - 1;
      const startStr = `${lastYear}-01-01`;
      const endStr = `${lastYear}-12-31`;
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Last year: ${startStr} to ${endStr}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    // Parse specific date formats
    // Pattern: "November 5" or "Nov 5" or "5 November" or "5 Nov"
    // Pattern: "November 5, 2025" or "Nov 5 2025" or "5 Nov 2025"
    // Pattern: "2025-11-05" (already in correct format)
    
    // Try to match month name patterns
    let month: number | null = null;
    let day: number | null = null;
    let year: number | null = null;

    // Match patterns like "november 5", "nov 5", "5 november", "5 nov", "on 9 november"
    for (const [monthName, monthNum] of Object.entries(monthMap)) {
      // Pattern: "month day" or "day month" (with word boundaries to avoid partial matches)
      // Use word boundary \\b to ensure we match whole words only
      const pattern1 = new RegExp(`\\b${monthName}\\s+(\\d{1,2})(?:\\s+(\\d{4}))?\\b`, 'i');
      const pattern2 = new RegExp(`\\b(\\d{1,2})\\s+${monthName}(?:\\s+(\\d{4}))?\\b`, 'i');
      
      const match1 = query.match(pattern1);
      const match2 = query.match(pattern2);
      
      if (match1) {
        month = monthNum;
        day = parseInt(match1[1]);
        year = match1[2] ? parseInt(match1[2]) : currentYear;
        break;
      } else if (match2) {
        month = monthNum;
        day = parseInt(match2[1]);
        year = match2[2] ? parseInt(match2[2]) : currentYear;
        break;
      }
    }

    // If found month/day, format and return
    if (month && day) {
      const dateStr = formatDate(year!, month, day);
      console.log('[parseDateQueryTool] Matched date pattern - month:', month, 'day:', day, 'year:', year, 'formatted:', dateStr);
      return {
        success: true,
        start_date: dateStr,
        end_date: dateStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Parsed date: ${dateStr} (year ${year!} ${year === currentYear ? '(current year)' : `(specified year, current year is ${currentYear})`})`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }
    
    console.log('[parseDateQueryTool] No month/day pattern matched for query:', query);

    // Try to parse month-only queries: "october", "all of october", "october 2024", etc.
    let monthOnly: number | null = null;
    let yearForMonth: number | null = null;
    
    for (const [monthName, monthNum] of Object.entries(monthMap)) {
      // Pattern: "all of month" or "month" or "month year" (e.g., "october", "all of october", "october 2024")
      const monthPattern1 = new RegExp(`(?:all\\s+of\\s+)?\\b${monthName}\\b(?:\\s+(\\d{4}))?`, 'i');
      const monthMatch = query.match(monthPattern1);
      
      if (monthMatch) {
        monthOnly = monthNum;
        yearForMonth = monthMatch[1] ? parseInt(monthMatch[1]) : currentYear;
        
        // Calculate first and last day of the month
        const monthStart = new Date(yearForMonth, monthOnly - 1, 1);
        const monthEnd = new Date(yearForMonth, monthOnly, 0); // Last day of month
        
        const startStr = formatDate(monthStart.getFullYear(), monthStart.getMonth() + 1, monthStart.getDate());
        const endStr = formatDate(monthEnd.getFullYear(), monthEnd.getMonth() + 1, monthEnd.getDate());
        
        console.log('[parseDateQueryTool] Matched month-only pattern - month:', monthOnly, 'year:', yearForMonth, 'range:', startStr, 'to', endStr);
        
        return {
          success: true,
          start_date: startStr,
          end_date: endStr,
          current_date: currentDate,
          current_year: currentYear,
          parsed_info: `Month range: ${startStr} to ${endStr} (${monthName} ${yearForMonth})`,
          next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
        };
      }
    }

    // Try to parse date range: "from X to Y" or "X to Y"
    const rangePattern = /(?:from\s+)?(.+?)\s+to\s+(.+)/i;
    const rangeMatch = query.match(rangePattern);
    if (rangeMatch) {
      const startQuery = rangeMatch[1].trim();
      const endQuery = rangeMatch[2].trim();
      
      // Recursively parse start and end dates
      const startResult = await parseDateQueryTool(startQuery);
      const endResult = await parseDateQueryTool(endQuery);
      
      if (startResult.success && endResult.success && startResult.start_date && endResult.end_date) {
        return {
          success: true,
          start_date: startResult.start_date,
          end_date: endResult.end_date,
          current_date: currentDate,
          current_year: currentYear,
          parsed_info: `Date range: ${startResult.start_date} to ${endResult.end_date}`,
          next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
        };
      }
    }

    // Try to parse YYYY-MM-DD format
    const isoMatch = query.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]);
      const day = parseInt(isoMatch[3]);
      const dateStr = formatDate(year, month, day);
      return {
        success: true,
        start_date: dateStr,
        end_date: dateStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `ISO format date: ${dateStr}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    // Try to parse MM/DD/YYYY or DD/MM/YYYY
    const slashMatch = query.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (slashMatch) {
      let month = parseInt(slashMatch[1]);
      let day = parseInt(slashMatch[2]);
      let year = parseInt(slashMatch[3]);
      
      // Handle 2-digit year
      if (year < 100) {
        year = 2000 + year;
      }
      
      // Try to detect DD/MM vs MM/DD (if day > 12, likely DD/MM)
      if (day > 12 && month <= 12) {
        [month, day] = [day, month];
      }
      
      const dateStr = formatDate(year, month, day);
      return {
        success: true,
        start_date: dateStr,
        end_date: dateStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Parsed date: ${dateStr}`,
        next_action: 'You MUST now call getIncomeTool, getExpensesTool, or getInvoicesTool with start_date and end_date from this result.',
      };
    }

    // If no date pattern found, return current date info
    return {
      success: true,
      current_date: currentDate,
      current_year: currentYear,
      parsed_info: `Could not parse date query "${dateQuery}". Returning current date info. Current date: ${currentDate}, Current year: ${currentYear}`,
      next_action: 'If you need to fetch data, call getIncomeTool, getExpensesTool, or getInvoicesTool with appropriate date parameters.',
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to parse date query',
    };
  }
};

/**
 * Helper: Match client by name or company_name
 * Returns: { exactMatch: Client | null, similarClients: Client[] }
 */
const matchClient = (clients: Client[], searchName: string): { exactMatch: Client | null; similarClients: Client[] } => {
  const searchLower = searchName.trim().toLowerCase();
  
  // First, try exact match (case-insensitive) on name or company_name
  const exactMatches = clients.filter(c => 
    c.name.toLowerCase() === searchLower ||
    (c.company_name && c.company_name.toLowerCase() === searchLower)
  );
  
  if (exactMatches.length === 1) {
    return { exactMatch: exactMatches[0], similarClients: [] };
  }
  
  if (exactMatches.length > 1) {
    // Multiple exact matches - return them as similar for user to choose
    return { exactMatch: null, similarClients: exactMatches };
  }
  
  // No exact match, try fuzzy matching
  const similarClients = clients.filter(c => {
    const nameLower = c.name.toLowerCase();
    const companyLower = (c.company_name || '').toLowerCase();
    
    // Check if search term is contained in name or company name (or vice versa)
    return nameLower.includes(searchLower) ||
           searchLower.includes(nameLower) ||
           (companyLower && (companyLower.includes(searchLower) || searchLower.includes(companyLower))) ||
           nameLower.startsWith(searchLower) ||
           searchLower.startsWith(nameLower) ||
           (companyLower && (companyLower.startsWith(searchLower) || searchLower.startsWith(companyLower)));
  });
  
  return { exactMatch: null, similarClients };
};

/**
 * Helper: Match category by name
 * Returns: { exactMatch: Category | null, similarCategories: Category[] }
 */
const matchCategory = (categories: Category[], searchName: string): { exactMatch: Category | null; similarCategories: Category[] } => {
  const searchLower = searchName.trim().toLowerCase();
  
  // First, try exact match (case-insensitive)
  const exactMatches = categories.filter(c => c.name.toLowerCase() === searchLower);
  
  if (exactMatches.length === 1) {
    return { exactMatch: exactMatches[0], similarCategories: [] };
  }
  
  if (exactMatches.length > 1) {
    // Multiple exact matches - return them as similar for user to choose
    return { exactMatch: null, similarCategories: exactMatches };
  }
  
  // No exact match, try fuzzy matching
  const similarCategories = categories.filter(c => {
    const nameLower = c.name.toLowerCase();
    return nameLower.includes(searchLower) ||
           searchLower.includes(nameLower) ||
           nameLower.startsWith(searchLower) ||
           searchLower.startsWith(nameLower);
  });
  
  return { exactMatch: null, similarCategories };
};

/**
 * Tool: Create Invoice (saves as pending action for preview)
 */
export const createInvoiceTool = async (
  userId: string,
  conversationId: string,
  data: {
    client_id?: string;
    client_name?: string;
    date: string;
    due_date: string;
    items: Array<{ description: string; quantity: number; rate: number }>;
    notes?: string;
    tax_rate?: number;
    project_id?: string;
  }
): Promise<{ success: boolean; pending_action_id?: string; error?: string }> => {
  try {
    // Get user settings for base currency and default tax
    const userSettings = await getUserSettings(userId);
    const invoiceSettings = await getInvoiceSettings(userId);
    
    // Resolve client if name provided
    let clientId = data.client_id;
    let clientName = data.client_name || null;
    
    // If no client provided, try to match by name (using matchClient which checks both name and company_name)
    if (!clientId && data.client_name) {
      const clients = await getClients(userId);
      const { exactMatch, similarClients } = matchClient(clients, data.client_name);
      
      if (exactMatch) {
        clientId = exactMatch.id;
        clientName = exactMatch.name;
      } else if (similarClients.length > 0) {
        // Multiple matches or similar matches found
        const clientList = similarClients.map(c => 
          `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`
        ).join('\n');
        return {
          success: false,
          error: `I found ${similarClients.length} similar client${similarClients.length > 1 ? 's' : ''} but no exact match for "${data.client_name}". Please clarify which client you meant:\n\n${clientList}\n\nOr provide the exact client name or company name.`
        };
      } else {
        // Client not found
        return {
          success: false,
          error: `I don't see a client named "${data.client_name}" in your records. Would you like me to create it for you? Or you can create it manually by visiting: [Create Client](/clients/new)`
        };
      }
    } else if (clientId && !clientName) {
      // If we have client_id but no name, look it up
      const clients = await getClients(userId);
      const client = clients.find((c) => c.id === clientId);
      if (client) {
        clientName = client.name;
      }
    }
    
    // If still no client, return error
    if (!clientId && !clientName) {
      return {
        success: false,
        error: 'Please provide a client name or ID for this invoice.'
      };
    }

    // Determine tax rate: use provided rate, or invoice_settings default, or 0
    const taxRate = data.tax_rate ?? invoiceSettings.default_tax_rate ?? 0;
    
    // Use base currency from user settings (ALWAYS use base currency for AI-created invoices)
    const currency = userSettings.base_currency || 'USD';

    // Create pending action for preview
    const pendingAction = await createPendingAction(
      conversationId,
      userId,
      'invoice',
      {
        client_id: clientId,
        client_name: clientName, // Include client name for preview display
        date: data.date,
        due_date: data.due_date,
        items: data.items,
        notes: data.notes,
        tax_rate: taxRate,
        currency: currency, // Store base currency
        project_id: data.project_id,
      }
    );

    return { success: true, pending_action_id: pendingAction.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Tool: Get Invoices with filters
 */
export const getInvoicesTool = async (
  userId: string,
  filters?: {
    client_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    month?: string;
  }
): Promise<any[]> => {
  try {
    let invoices = await getInvoices(userId);

    // Apply filters
    if (filters?.client_id) {
      invoices = invoices.filter((inv) => inv.client_id === filters.client_id);
    }
    if (filters?.start_date || filters?.end_date) {
      invoices = invoices.filter((inv) => {
        const invDate = new Date(inv.date);
        if (filters.start_date && invDate < new Date(filters.start_date)) return false;
        if (filters.end_date && invDate > new Date(filters.end_date)) return false;
        return true;
      });
    }
    if (filters?.status) {
      invoices = invoices.filter((inv) => inv.status === filters.status);
    }
    if (filters?.month) {
      const [year, month] = filters.month.split('-');
      invoices = invoices.filter((inv) => {
        const invDate = new Date(inv.date);
        return invDate.getFullYear() === parseInt(year) && invDate.getMonth() + 1 === parseInt(month);
      });
    }

    return invoices;
  } catch (error) {
    console.error('Error getting invoices:', error);
    return [];
  }
};

/**
 * Tool: Create Expense (saves as pending action for preview)
 */
export const createExpenseTool = async (
  userId: string,
  conversationId: string,
  data: {
    amount: number;
    category_id?: string;
    category_name?: string;
    description: string;
    date: string;
    vendor?: string;
    project_id?: string;
  }
): Promise<{ success: boolean; pending_action_id?: string; error?: string }> => {
  try {
    // Resolve category if name provided
    let categoryId = data.category_id;
    
    // If no category provided, try fuzzy match or use provided name
    if (!categoryId && data.category_name) {
      const categories = await getCategories(userId, 'expense');
      // Try fuzzy match - check all categories
      const category = categories.find(
        (c) => c.name.toLowerCase().includes(data.category_name!.toLowerCase()) ||
               data.category_name!.toLowerCase().includes(c.name.toLowerCase())
      );
      if (category) {
        categoryId = category.id;
      }
      // If not found, category_name will be used as-is
    }

    // Create pending action for preview
    const pendingAction = await createPendingAction(
      conversationId,
      userId,
      'expense',
      {
        amount: data.amount,
        category_id: categoryId,
        description: data.description,
        date: data.date,
        vendor: data.vendor,
        project_id: data.project_id,
      }
    );

    return { success: true, pending_action_id: pendingAction.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Tool: Get Expenses with filters
 */
export const getExpensesTool = async (
  userId: string,
  filters?: {
    category_id?: string;
    start_date?: string;
    end_date?: string;
    month?: string;
    project_id?: string;
  }
): Promise<any[]> => {
  try {
    let expenses = await getExpenses(userId, filters?.start_date, filters?.end_date);

    // Apply additional filters
    if (filters?.category_id) {
      expenses = expenses.filter((exp) => exp.category_id === filters.category_id);
    }
    if (filters?.project_id) {
      expenses = expenses.filter((exp: any) => exp.project_id === filters.project_id);
    }
    if (filters?.month) {
      const [year, month] = filters.month.split('-');
      expenses = expenses.filter((exp) => {
        const expDate = new Date(exp.date);
        return expDate.getFullYear() === parseInt(year) && expDate.getMonth() + 1 === parseInt(month);
      });
    }

    return expenses;
  } catch (error) {
    console.error('Error getting expenses:', error);
    return [];
  }
};

/**
 * Tool: Create Income (saves as pending action for preview)
 */
export const createIncomeTool = async (
  userId: string,
  conversationId: string,
  data: {
    amount: number;
    description: string;
    date: string;
    category_id?: string;
    category_name?: string;
    client_id?: string;
    client_name?: string;
    project_id?: string;
    reference_number?: string;
    tax_rate?: number;
    tax_amount?: number;
    currency?: string;
  }
): Promise<{ success: boolean; pending_action_id?: string; error?: string }> => {
  try {
    // Get user settings for currency and tax
    const userSettings = await getUserSettings(userId);
    const invoiceSettings = await getInvoiceSettings(userId);

    // Parse relative dates
    let parsedDate = parseRelativeDate(data.date);
    if (!parsedDate) {
      parsedDate = data.date;
    }

    // Resolve category if name provided
    // If category_name is provided, it's treated as required - must find or return error
    let categoryId = data.category_id;
    let categoryName = data.category_name;
    if (!categoryId && categoryName) {
      const categories = await getCategories(userId, 'income');
      const { exactMatch, similarCategories } = matchCategory(categories, categoryName);
      
      if (exactMatch) {
        categoryId = exactMatch.id;
        categoryName = exactMatch.name;
      } else if (similarCategories.length > 0) {
        // Multiple matches or similar matches found
        const categoryList = similarCategories.map(c => `- ${c.name}`).join('\n');
        return {
          success: false,
          error: `I found ${similarCategories.length} similar categor${similarCategories.length > 1 ? 'ies' : 'y'} but no exact match for "${categoryName}". Please clarify which category you meant:\n\n${categoryList}\n\nOr provide the exact category name.`
        };
      } else {
        // Category not found
        return {
          success: false,
          error: `I don't see a category named "${categoryName}" in your records. Would you like me to create it for you? Or you can create it manually by visiting: [Create Category](/categories/new)`
        };
      }
    }

    // Resolve client if name provided
    // If client_name is provided, it's treated as required - must find or return error
    let clientId = data.client_id;
    let clientName = data.client_name;
    if (!clientId && clientName) {
      const clients = await getClients(userId);
      const { exactMatch, similarClients } = matchClient(clients, clientName);
      
      if (exactMatch) {
        clientId = exactMatch.id;
        clientName = exactMatch.name;
      } else if (similarClients.length > 0) {
        // Multiple matches or similar matches found
        const clientList = similarClients.map(c => 
          `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`
        ).join('\n');
        return {
          success: false,
          error: `I found ${similarClients.length} similar client${similarClients.length > 1 ? 's' : ''} but no exact match for "${clientName}". Please clarify which client you meant:\n\n${clientList}\n\nOr provide the exact client name or company name.`
        };
      } else {
        // Client not found
        return {
          success: false,
          error: `I don't see a client named "${clientName}" in your records. Would you like me to create it for you? Or you can create it manually by visiting: [Create Client](/clients/new)`
        };
      }
    }

    // Determine tax rate: use provided rate, or invoice_settings default, or 0
    const taxRate = data.tax_rate ?? invoiceSettings.default_tax_rate ?? 0;
    
    // Calculate tax amount if not provided
    let taxAmount = data.tax_amount;
    if (taxAmount === undefined && taxRate > 0) {
      taxAmount = (data.amount * taxRate) / 100;
    }
    taxAmount = taxAmount || 0;

    // Use provided currency or base currency
    const currency = data.currency || userSettings.base_currency || 'USD';

    // Create pending action for preview
    const pendingAction = await createPendingAction(
      conversationId,
      userId,
      'income',
      {
        amount: data.amount,
        description: data.description,
        date: parsedDate,
        category_id: categoryId,
        category_name: categoryName, // Store category name for preview
        client_id: clientId,
        client_name: clientName, // Store client name for preview
        project_id: data.project_id,
        reference_number: data.reference_number,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        currency: currency,
      }
    );

    return { success: true, pending_action_id: pendingAction.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Tool: Get Income with filters
 */
export const getIncomeTool = async (
  userId: string,
  filters?: {
    start_date?: string;
    end_date?: string;
    month?: string;
    client_id?: string;
    client_name?: string;
    category_id?: string;
    project_id?: string;
    search_term?: string;
    currency?: string;
    tax_rate?: number;
    amount?: number;
  }
): Promise<any[]> => {
  try {
    // Solution 2: Always use search_term for client_name instead of resolving to client_id
    // This ensures better matching and avoids client_id mismatches
    let resolvedClientId: string | null = null;
    let searchTerm = filters?.search_term;
    
    if (filters?.client_name) {
      // Always use search_term for client_name - don't resolve to client_id
      // This ensures we match by name/company_name which is what users expect
      searchTerm = filters.client_name;
      console.log('[getIncomeTool] Using client_name as search_term:', filters.client_name);
    } else if (filters?.client_id) {
      // Only use client_id if explicitly provided (not from client_name resolution)
      resolvedClientId = filters.client_id;
      console.log('[getIncomeTool] Using client_id filter:', resolvedClientId);
    }
    
    // Normalize dates to YYYY-MM-DD format (remove any time components)
    let startDate = filters?.start_date;
    let endDate = filters?.end_date;
    
    // Solution 8: Enhanced debug logging
    console.log('[getIncomeTool] Filters received:', JSON.stringify(filters, null, 2));
    console.log('[getIncomeTool] Original startDate:', startDate, 'endDate:', endDate);
    console.log('[getIncomeTool] Will use searchTerm:', searchTerm, 'resolvedClientId:', resolvedClientId);
    
    // If both dates are provided and are the same, ensure they're in correct format
    if (startDate && endDate && startDate === endDate) {
      // For single date queries, ensure format is YYYY-MM-DD
      const dateMatch = startDate.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        startDate = dateMatch[1];
        endDate = dateMatch[1];
      }
    } else {
      // Normalize individual dates
      if (startDate) {
        const startMatch = startDate.match(/^(\d{4}-\d{2}-\d{2})/);
        if (startMatch) startDate = startMatch[1];
      }
      if (endDate) {
        const endMatch = endDate.match(/^(\d{4}-\d{2}-\d{2})/);
        if (endMatch) endDate = endMatch[1];
      }
    }
    
    console.log('[getIncomeTool] Normalized startDate:', startDate, 'endDate:', endDate);
    
    let income = await getIncomes(userId, startDate, endDate);
    
    console.log('[getIncomeTool] Total income fetched from DB:', income.length);

    // Note: getIncomes() now uses .eq() for single dates, which is more accurate
    // Still keep JavaScript fallback filter as a safety measure for any edge cases
    if (startDate && endDate && startDate === endDate) {
      const targetDate = startDate;
      const beforeFilter = income.length;
      
      // Additional safety filter - extract date part and compare
      income = income.filter((inc) => {
        // Extract date part only (YYYY-MM-DD) from stored date
        // Database stores dates as strings in YYYY-MM-DD format or with time components
        const dateStr = String(inc.date);
        // Handle both "2025-06-03" and "2025-06-03T00:00:00Z" formats
        const incDateStr = dateStr.split('T')[0].split(' ')[0];
        const matches = incDateStr === targetDate;
        if (!matches && beforeFilter > 0) {
          console.log('[getIncomeTool] Date mismatch (filtered out):', incDateStr, '!==', targetDate, 'for income:', inc.id, inc.description);
        }
        return matches;
      });
      console.log('[getIncomeTool] Single date filter: before:', beforeFilter, 'after:', income.length, 'targetDate:', targetDate);
      
      if (beforeFilter > 0 && income.length === 0) {
        console.warn('[getIncomeTool] WARNING: Database returned', beforeFilter, 'records but none matched exact date', targetDate, '- this might indicate a date format issue');
      }
    }

    // Solution 7: Combine filters intelligently - apply in order: date → search_term (client) → amount
    // Store original count for Solution 5 (fallback logic) and Solution 9 (post-filter verification)
    const incomeBeforeClientFilter = [...income];
    
    // Apply client filter first
    if (resolvedClientId) {
      const beforeFilter = income.length;
      income = income.filter((inc) => {
        const matches = inc.client_id === resolvedClientId;
        if (!matches && beforeFilter > 0) {
          console.log('[getIncomeTool] Client ID filter - filtered out:', inc.id, 'client_id:', inc.client_id, 'expected:', resolvedClientId);
        }
        return matches;
      });
      console.log('[getIncomeTool] Client ID filter: before:', beforeFilter, 'after:', income.length);
      
      // Solution 5: Fallback logic - if client_id filter returns 0 and client_name was provided, retry with search_term
      if (income.length === 0 && beforeFilter > 0 && filters?.client_name && !searchTerm) {
        console.log('[getIncomeTool] Client ID filter returned 0 results, retrying with search_term for client_name:', filters.client_name);
        income = incomeBeforeClientFilter;
        searchTerm = filters.client_name;
        resolvedClientId = null; // Clear client_id filter
      }
    }
    
    if (filters?.category_id) {
      const beforeFilter = income.length;
      income = income.filter((inc) => inc.category_id === filters.category_id);
      console.log('[getIncomeTool] Category filter: before:', beforeFilter, 'after:', income.length);
    }
    
    if (filters?.project_id) {
      const beforeFilter = income.length;
      income = income.filter((inc: any) => inc.project_id === filters.project_id);
      console.log('[getIncomeTool] Project filter: before:', beforeFilter, 'after:', income.length);
    }
    
    if (searchTerm) {
      const beforeFilter = income.length;
      const searchLower = searchTerm.toLowerCase();
      income = income.filter((inc) => {
        const matches = 
          inc.description.toLowerCase().includes(searchLower) ||
          inc.reference_number?.toLowerCase().includes(searchLower) ||
          inc.category?.name?.toLowerCase().includes(searchLower) ||
          inc.client?.name?.toLowerCase().includes(searchLower) ||
          inc.client?.company_name?.toLowerCase().includes(searchLower);
        if (!matches && beforeFilter > 0) {
          console.log('[getIncomeTool] Search term filter - filtered out:', inc.id, 'description:', inc.description, 'client:', inc.client?.name);
        }
        return matches;
      });
      console.log('[getIncomeTool] Search term filter ("' + searchTerm + '"): before:', beforeFilter, 'after:', income.length);
    }
    
    if (filters?.month) {
      const beforeFilter = income.length;
      const [year, month] = filters.month.split('-');
      income = income.filter((inc) => {
        const incDate = new Date(inc.date);
        return incDate.getFullYear() === parseInt(year) && incDate.getMonth() + 1 === parseInt(month);
      });
      console.log('[getIncomeTool] Month filter: before:', beforeFilter, 'after:', income.length);
    }
    
    if (filters?.currency) {
      const beforeFilter = income.length;
      income = income.filter((inc) => (inc.currency || 'USD') === filters.currency);
      console.log('[getIncomeTool] Currency filter: before:', beforeFilter, 'after:', income.length);
    }
    
    if (filters?.tax_rate !== undefined) {
      const beforeFilter = income.length;
      income = income.filter((inc) => {
        const incTaxRate = inc.tax_rate || 0;
        // Allow small floating point differences (0.01 tolerance)
        return Math.abs(incTaxRate - filters.tax_rate!) < 0.01;
      });
      console.log('[getIncomeTool] Tax rate filter: before:', beforeFilter, 'after:', income.length);
    }
    
    // Solution 1: Handle amount mismatches - keep strict tolerance but track for user engagement
    let amountFilterApplied = false;
    let amountFilteredCount = 0;
    if (filters?.amount !== undefined) {
      amountFilterApplied = true;
      const beforeFilter = income.length;
      income = income.filter((inc) => {
        // Allow small floating point differences (0.01 tolerance) for amount matching
        const matches = Math.abs((inc.amount || 0) - filters.amount!) < 0.01;
        if (!matches && beforeFilter > 0) {
          console.log('[getIncomeTool] Amount filter - filtered out:', inc.id, 'amount:', inc.amount, 'expected:', filters.amount, 'difference:', Math.abs((inc.amount || 0) - filters.amount!));
        }
        return matches;
      });
      amountFilteredCount = beforeFilter - income.length;
      console.log('[getIncomeTool] Amount filter: before:', beforeFilter, 'after:', income.length, 'filtered out:', amountFilteredCount);
    }

    // Solution 9: Post-filter verification - if 0 results, check if unfiltered results exist
    const finalResultCount = income.length;
    if (finalResultCount === 0 && incomeBeforeClientFilter.length > 0) {
      console.log('[getIncomeTool] WARNING: Filters returned 0 results, but unfiltered results exist:', incomeBeforeClientFilter.length);
      console.log('[getIncomeTool] Applied filters:', {
        client_id: resolvedClientId,
        client_name: filters?.client_name,
        search_term: searchTerm,
        amount: filters?.amount,
        category_id: filters?.category_id,
        currency: filters?.currency,
        date_range: `${startDate} to ${endDate}`
      });
    }

    console.log('[getIncomeTool] Final result count:', finalResultCount);
    
    // Return result with metadata for Solution 1 (amount mismatch handling)
    // We'll handle the user engagement message in the AI service layer
    return income;
  } catch (error) {
    console.error('[getIncomeTool] Error getting income:', error);
    return [];
  }
};

/**
 * Tool: Update Income
 */
export const updateIncomeTool = async (
  userId: string,
  conversationId: string,
  data: {
    income_id: string;
    amount?: number;
    description?: string;
    date?: string;
    category_id?: string;
    category_name?: string;
    client_id?: string;
    client_name?: string;
    project_id?: string;
    reference_number?: string;
    tax_rate?: number;
    tax_amount?: number;
    currency?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get existing income to verify it exists and belongs to user
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
    if (data.project_id !== undefined) updateData.project_id = data.project_id || null;

    // Handle category
    if (data.category_id !== undefined) {
      updateData.category_id = data.category_id || null;
    } else if (data.category_name) {
      const categories = await getCategories(userId, 'income');
      const { exactMatch, similarCategories } = matchCategory(categories, data.category_name);
      
      if (exactMatch) {
        updateData.category_id = exactMatch.id;
      } else if (similarCategories.length > 0) {
        // Multiple matches or similar matches found
        const categoryList = similarCategories.map(c => `- ${c.name}`).join('\n');
        return {
          success: false,
          error: `I found ${similarCategories.length} similar categor${similarCategories.length > 1 ? 'ies' : 'y'} but no exact match for "${data.category_name}". Please clarify which category you meant:\n\n${categoryList}\n\nOr provide the exact category name.`
        };
      } else {
        // Category not found
        return {
          success: false,
          error: `I don't see a category named "${data.category_name}" in your records. Would you like me to create it for you? Or you can create it manually by visiting: [Create Category](/categories/new)`
        };
      }
    }

    // Handle client
    if (data.client_id !== undefined) {
      updateData.client_id = data.client_id || null;
    } else if (data.client_name) {
      const clients = await getClients(userId);
      const { exactMatch, similarClients } = matchClient(clients, data.client_name);
      
      if (exactMatch) {
        updateData.client_id = exactMatch.id;
      } else if (similarClients.length > 0) {
        // Multiple matches or similar matches found
        const clientList = similarClients.map(c => 
          `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`
        ).join('\n');
        return {
          success: false,
          error: `I found ${similarClients.length} similar client${similarClients.length > 1 ? 's' : ''} but no exact match for "${data.client_name}". Please clarify which client you meant:\n\n${clientList}\n\nOr provide the exact client name or company name.`
        };
      } else {
        // Client not found
        return {
          success: false,
          error: `I don't see a client named "${data.client_name}" in your records. Would you like me to create it for you? Or you can create it manually by visiting: [Create Client](/clients/new)`
        };
      }
    }

    // Handle tax
    if (data.tax_rate !== undefined) updateData.tax_rate = data.tax_rate || null;
    if (data.tax_amount !== undefined) {
      updateData.tax_amount = data.tax_amount || null;
    } else if (data.tax_rate !== undefined && data.amount !== undefined) {
      // Calculate tax if rate and amount provided
      updateData.tax_amount = data.tax_rate > 0 ? (data.amount * data.tax_rate) / 100 : 0;
    }

    // Handle currency
    if (data.currency !== undefined) {
      updateData.currency = data.currency;
      // If currency changes, we might need to recalculate exchange rate
      // For now, just update the currency
    }

    // Update income
    await updateIncome(data.income_id, updateData);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};


/**
 * Tool: Get Clients
 */
export const getClientsTool = async (userId: string): Promise<any[]> => {
  try {
    return await getClients(userId);
  } catch (error) {
    console.error('Error getting clients:', error);
    return [];
  }
};

/**
 * Tool: Get Categories
 */
export const getCategoriesTool = async (
  userId: string,
  type?: 'income' | 'expense'
): Promise<any[]> => {
  try {
    return await getCategories(userId, type);
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
};

/**
 * Tool: Get Projects
 */
export const getProjectsTool = async (
  userId: string,
  status?: 'active' | 'completed' | 'on_hold' | 'cancelled' | 'all'
): Promise<any[]> => {
  try {
    return await getProjects(userId, status);
  } catch (error) {
    console.error('Error getting projects:', error);
    return [];
  }
};

/**
 * Tool: Calculate Monthly Income
 */
export const calculateMonthlyIncomeTool = async (
  userId: string,
  month: string // Format: "YYYY-MM"
): Promise<{ total: number; count: number }> => {
  try {
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0).toISOString().split('T')[0];

    const income = await getIncomes(userId, startDate, endDate);
    const total = income.reduce((sum, inc) => sum + (inc.base_amount || inc.amount || 0), 0);

    return { total, count: income.length };
  } catch (error) {
    console.error('Error calculating monthly income:', error);
    return { total: 0, count: 0 };
  }
};

/**
 * Tool: Search for client by name (fuzzy match)
 */
export const searchClientTool = async (
  userId: string,
  searchTerm: string
): Promise<any[]> => {
  try {
    const clients = await getClients(userId);
    const searchLower = searchTerm.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchLower) ||
        client.email?.toLowerCase().includes(searchLower) ||
        client.company_name?.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error('Error searching clients:', error);
    return [];
  }
};

/**
 * Tool: Create Client
 * Creates a new client. Checks if client already exists first.
 */
export const createClientTool = async (
  userId: string,
  data: {
    name: string;
    company_name?: string;
    email?: string;
    phone?: string;
    phone_country_code?: string;
    address?: string;
  }
): Promise<{ success: boolean; client?: Client; error?: string }> => {
  try {
    // Check if client already exists (fuzzy match on name)
    const clients = await getClients(userId);
    const { exactMatch, similarClients } = matchClient(clients, data.name);
    
    if (exactMatch) {
      return {
        success: false,
        error: `A client named "${data.name}" already exists. ${exactMatch.company_name ? `Company: ${exactMatch.company_name}` : ''}`
      };
    }
    
    if (similarClients.length > 0) {
      const clientList = similarClients.map(c => 
        `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`
      ).join('\n');
      return {
        success: false,
        error: `I found ${similarClients.length} similar client${similarClients.length > 1 ? 's' : ''} that might be a match:\n\n${clientList}\n\nPlease use a different name or specify if you want to use one of these existing clients.`
      };
    }

    // Create client with minimal required info
    const newClient = await createClient({
      user_id: userId,
      name: data.name.trim(),
      company_name: data.company_name?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      phone_country_code: data.phone_country_code || '+1',
      address: data.address?.trim() || undefined,
    });

    return { success: true, client: newClient };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Tool: Create Category
 * Creates a new category. Checks if category already exists first.
 */
export const createCategoryTool = async (
  userId: string,
  data: {
    name: string;
    type: 'income' | 'expense';
    color?: string;
  }
): Promise<{ success: boolean; category?: Category; error?: string }> => {
  try {
    // Check if category already exists
    const exists = await checkCategoryExists(userId, data.name.trim(), data.type);
    if (exists) {
      return {
        success: false,
        error: `A ${data.type} category named "${data.name}" already exists.`
      };
    }

    // Check for similar categories (fuzzy match)
    const categories = await getCategories(userId, data.type);
    const { similarCategories } = matchCategory(categories, data.name);
    
    if (similarCategories.length > 0) {
      const categoryList = similarCategories.map(c => `- ${c.name}`).join('\n');
      return {
        success: false,
        error: `I found ${similarCategories.length} similar categor${similarCategories.length > 1 ? 'ies' : 'y'} that might be a match:\n\n${categoryList}\n\nPlease use a different name or specify if you want to use one of these existing categories.`
      };
    }

    // Preset colors (same as AddCategoryModal)
    const PRESET_COLORS = [
      "#3B82F6", // Blue
      "#10B981", // Green
      "#F59E0B", // Yellow
      "#EF4444", // Red
      "#8B5CF6", // Purple
      "#EC4899", // Pink
      "#14B8A6", // Teal
      "#F97316", // Orange
      "#6B7280", // Gray
    ];

    // Create category with auto-assigned color (first preset)
    const newCategory = await createCategory({
      user_id: userId,
      name: data.name.trim(),
      type: data.type,
      color: data.color || PRESET_COLORS[0],
    });

    return { success: true, category: newCategory };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Execute a confirmed pending action (called after user confirms)
 */
export const executePendingAction = async (
  userId: string,
  pendingAction: any
): Promise<{ success: boolean; result?: any; error?: string }> => {
  try {
    const { action_type, action_data } = pendingAction;
    
    // Get user settings as fallback for currency (if not stored in pending action)
    const userSettings = await getUserSettings(userId);
    const baseCurrency = userSettings.base_currency || 'USD';
    const currency = action_data.currency || baseCurrency;

    switch (action_type) {
      case 'invoice': {
        // Calculate totals from items (like InvoiceForm does)
        const items = action_data.items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          amount: (item.quantity || 1) * (item.rate || 0),
        }));

        // Calculate subtotal, tax, and total
        const subtotal = items.reduce((sum: number, item: any) => sum + item.amount, 0);
        
        // Get tax rate: use stored rate, or fetch invoice_settings default, or 0
        // Check if tax_rate is explicitly provided (including 0), otherwise use defaults
        let taxRate = action_data.tax_rate;
        if (taxRate === null || taxRate === undefined) {
          const invoiceSettings = await getInvoiceSettings(userId);
          taxRate = invoiceSettings.default_tax_rate ?? 0;
        }
        
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;

        // Get exchange rate for currency conversion
        const exchangeRate = await getExchangeRate(userId, currency, baseCurrency);
        const baseAmount = subtotal / exchangeRate;
        const baseTaxAmount = taxAmount / exchangeRate;

        // CRITICAL: Never pass 'status' - let the database RPC function handle it
        // Build clean invoice data WITHOUT status field
        const cleanInvoiceData: Record<string, any> = {
          client_id: action_data.client_id,
          date: action_data.date,
          due_date: action_data.due_date,
          notes: action_data.notes || null,
          tax_rate: taxRate,
          tax_amount: Number(taxAmount.toFixed(2)),
          subtotal: Number(subtotal.toFixed(2)),
          total: Number(total.toFixed(2)),
          project_id: action_data.project_id || null,
          currency: currency,
          exchange_rate: exchangeRate,
          base_amount: baseAmount,
          base_tax_amount: baseTaxAmount,
          income_category_id: action_data.income_category_id || null,
          // DO NOT include status - database will set it to 'draft'
        };

        // Final safety check: ensure status is definitely not in the object
        if ('status' in cleanInvoiceData) {
          delete cleanInvoiceData.status;
        }

        // Remove any other unwanted fields that might cause issues
        const forbiddenFields = ['status', 'id', 'invoice_number', 'created_at', 'updated_at'];
        forbiddenFields.forEach(field => {
          if (field in cleanInvoiceData) {
            delete cleanInvoiceData[field];
          }
        });

        console.log('[executePendingAction] Calling createInvoice');
        console.log('[executePendingAction] cleanInvoiceData keys:', Object.keys(cleanInvoiceData));
        console.log('[executePendingAction] Status field present?', 'status' in cleanInvoiceData);
        console.log('[executePendingAction] cleanInvoiceData:', JSON.stringify(cleanInvoiceData, null, 2));

        const result = await createInvoice(userId, cleanInvoiceData as any, items);
        return { success: true, result };
      }

      case 'expense': {
        const result = await createExpense({
          user_id: userId,
          amount: action_data.amount,
          category_id: action_data.category_id,
          description: action_data.description,
          date: action_data.date,
          vendor: action_data.vendor,
          project_id: action_data.project_id,
        } as any);
        return { success: true, result };
      }

      case 'income': {
        // Calculate exchange rate and base amounts (matching IncomeForm logic)
        const exchangeRate = currency !== baseCurrency
          ? await getExchangeRate(userId, currency, baseCurrency)
          : 1;

        // Get tax rate and tax amount from action_data (already calculated in createIncomeTool)
        const taxRate = action_data.tax_rate ?? null;
        const taxAmount = action_data.tax_amount ?? 0;
        
        // Calculate base amounts (NET amount in base currency)
        // amount is NET (excluding VAT), matching IncomeForm behavior
        const netAmount = action_data.amount || 0;
        const baseAmount = netAmount / exchangeRate;
        const baseTaxAmount = taxAmount / exchangeRate;

        const result = await createIncome({
          user_id: userId,
          amount: netAmount, // NET amount (excluding VAT)
          description: action_data.description,
          date: action_data.date,
          category_id: action_data.category_id || null,
          client_id: action_data.client_id || null,
          project_id: action_data.project_id || null,
          currency: currency,
          exchange_rate: exchangeRate,
          base_amount: baseAmount,
          base_tax_amount: baseTaxAmount,
          tax_rate: taxRate,
          tax_amount: taxAmount || null,
          reference_number: action_data.reference_number || null,
        } as any);
        return { success: true, result };
      }

      default:
        return { success: false, error: `Unknown action type: ${action_type}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
