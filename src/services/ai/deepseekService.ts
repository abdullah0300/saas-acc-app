/**
 * DeepSeek API Service
 * Handles communication with DeepSeek API for AI chat functionality
 */

import { supabase } from '../supabaseClient';
import { getSystemKnowledge } from '../../config/aiSystemKnowledge';
import {
  parseDateQueryTool,
  createInvoiceTool,
  getInvoicesTool,
  createExpenseTool,
  getExpensesTool,
  createIncomeTool,
  updateIncomeTool,
  getIncomeTool,
  getClientsTool,
  getCategoriesTool,
  getProjectsTool,
  calculateMonthlyIncomeTool,
  searchClientTool,
  createClientTool,
  createCategoryTool,
} from './aiTools';
import type { ChatMessage } from './chatConversationService';

// Import shared tools
import { parseDateQueryTool } from './tools/shared/dateTools';
import { getClientsTool, createClientTool } from './tools/shared/clientTools';
import { getCategoriesTool, createCategoryTool } from './tools/shared/categoryTools';
import { getTaxRatesTool, createTaxRateTool } from './tools/shared/taxTools';
import { validateProjectTool, createProjectTool, getProjectsTool, updateProjectTool, deleteProjectTool } from './tools/shared/projectTools';
import { getUIGuideTool } from './tools/shared/uiNavigationTools';

// Import income tools
import { validateIncomeTool, createIncomeTool, getIncomeTool, updateIncomeTool } from './tools/income/incomeTools';

// Import expense tools
import { validateExpenseTool, createExpenseTool, getExpensesTool, updateExpenseTool } from './tools/expense/expenseTools';
import { createVendorTool, getVendorsTool } from './tools/shared/vendorTools';

// Import budget tools
import { validateBudgetTool, createBudgetTool, getBudgetsTool, updateBudgetTool, deleteBudgetTool } from './tools/budget/budgetTools';

// Import invoice tools
import { getInvoicesTool } from './tools/invoice/invoiceTools';

// Import report tools
import { getReportSummaryTool, getTaxSummaryTool, getClientSummaryTool } from './tools/shared/reportTools';

// Import instructions
import { sharedInstructions } from './instructions/shared';
import { incomeInstructions } from './instructions/income';
import { expenseInstructions } from './instructions/expense';
import { budgetInstructions } from './instructions/budget';
import { invoiceInstructions } from './instructions/invoice';
import { projectInstructions } from './instructions/project';
import { reportInstructions } from './instructions/report';

// Import user settings
import { getUserSettings, getInvoiceSettings } from './userSettingsService';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat'; // or 'deepseek-chat' depending on available models

/**
 * Get DeepSeek API key from Supabase secrets
 */
const getDeepSeekApiKey = async (): Promise<string> => {
  try {
    // Get API key from Supabase Edge Function or environment
    // Since we're in the frontend, we'll need to call an edge function
    // For now, let's use a direct approach - you'll need to set up an edge function
    // that returns the API key securely
    
    // Alternative: Store in environment variable (less secure but simpler)
    const apiKey = process.env.REACT_APP_DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      // Try to get from Supabase edge function
      const { data, error } = await supabase.functions.invoke('get-deepseek-key');
      if (error || !data?.key) {
        throw new Error('DeepSeek API key not found');
      }
      return data.key;
    }
    
    return apiKey;
  } catch (error) {
    console.error('Error getting DeepSeek API key:', error);
    throw error;
  }
};

/**
 * Define available tools for the AI
 */
const getToolsDefinition = () => {
  return [
    {
      type: 'function',
      function: {
        name: 'parseDateQueryTool',
        description: 'CRITICAL: This tool MUST be called FIRST whenever user mentions dates, date ranges, or time-related queries. It parses natural language dates and returns standardized YYYY-MM-DD format. IMPORTANT: After calling this tool and getting start_date and end_date, you MUST IMMEDIATELY call the appropriate get tool (getIncomeTool, getExpensesTool, or getInvoicesTool) with those dates. Do NOT respond to the user with just text - you MUST call the get tool to actually fetch the data. Examples: "Nov 5" → "2025-11-05", "November 5, 2024" → "2024-11-05", "last 7 days" → date range, "this week" → date range, "october" → "2025-10-01 to 2025-10-31", etc. IMPORTANT: Extract ONLY the date part from user query. For example, if user says "show me income on 9 november", extract just "9 november" and pass it as dateQuery. Flow: Step 1) Call parseDateQueryTool, Step 2) IMMEDIATELY call getIncomeTool/getExpensesTool/getInvoicesTool with the returned start_date and end_date.',
        parameters: {
          type: 'object',
          properties: {
            dateQuery: { 
              type: 'string', 
              description: 'EXTRACT AND PASS ONLY THE DATE PART from user query. Examples: If user says "show me income on 9 november", extract "9 november" and pass it. If user says "all of october", extract "october" or "all of october" and pass it. Can be: specific dates ("Nov 5", "November 5, 2025", "9 november"), relative dates ("today", "yesterday", "last 7 days"), date ranges ("from Nov 1 to Nov 5"), month-only ("october", "all of october", "october 2024"), or any natural language date expression. If user query contains no date, you can still call this with empty string to get current date info.' 
            },
          },
          required: ['dateQuery'],
        },
      },
    },

    // UI Navigation guide tool
    {
      type: 'function',
      function: {
        name: 'getUIGuideTool',
        description: 'Get step-by-step UI navigation instructions when user asks "how do I..." questions about using SmartCFO. Returns detailed steps, tips, and routes.',
        parameters: {
          type: 'object',
          properties: {
            feature: {
              type: 'string',
              enum: ['invoices', 'expenses', 'income', 'clients', 'projects', 'reports', 'dashboard', 'settings', 'overview'],
              description: 'Which feature the user needs help with. Use "overview" for general navigation.'
            }
          },
          required: ['feature'],
        },
      },
    },

    // Income tools
    {
      type: 'function',
      function: {
        name: 'validateIncomeTool',
        description: 'Validates income data BEFORE creating. Checks if provided client/category/tax_rate/currency exist and returns errors + missing fields. Use this FIRST when user provides income data.',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Income amount (NET, before tax)' },
            description: { type: 'string', description: 'Description of the income (optional)' },
            category_name: { type: 'string', description: 'Category name (optional)' },
            client_name: { type: 'string', description: 'Client name (optional)' },
            project_name: { type: 'string', description: 'Project name (optional, only if client is provided)' },
            tax_rate: { type: 'number', description: 'Tax rate percentage (optional)' },
            currency: { type: 'string', description: 'Currency code (optional, defaults to user base currency). Will validate if currency is enabled.' },
          },
          required: ['amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createIncomeTool',
        description: 'Creates a new income record. Shows preview to user before saving. Category, client, and project are optional.',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Income amount (NET, before tax)' },
            description: { type: 'string', description: 'Description of the income' },
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            category_name: { type: 'string', description: 'Category name (optional)' },
            client_name: { type: 'string', description: 'Client name (optional)' },
            project_name: { type: 'string', description: 'Project name (optional, only if client is provided)' },
            reference_number: { type: 'string', description: 'Reference number (optional)' },
            tax_rate: { type: 'number', description: 'Tax rate percentage (optional)' },
            currency: { type: 'string', description: 'Currency code (optional, defaults to user base currency)' },
          },
          required: ['amount', 'description', 'date'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getExpensesTool',
        description: 'Get expenses with optional filters',
        parameters: {
          type: 'object',
          properties: {
            category_id: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            month: { type: 'string' },
            project_id: { type: 'string' },
          },
        },
      },
    },
                    {
                  type: 'function',
                  function: {
                    name: 'createIncomeTool',
                    description: 'Create a new income record. This saves it as a pending action for user preview. CRITICAL: You MUST ask for client_name unless user explicitly provides it or explicitly says "no client needed". Do NOT skip asking for client.',
                    parameters: {
                      type: 'object',
                      properties: {
                        amount: { type: 'number' },
                        description: { type: 'string' },
                        date: { type: 'string', description: 'Date (YYYY-MM-DD format, or relative like "yesterday", "today", "tomorrow" - will be auto-converted. If year is missing, current year will be used)' },
                        category_id: { type: 'string', description: 'Income category ID (optional)' },
                        category_name: { type: 'string', description: 'Income category name (optional, e.g., "Web Development", "Consulting", "Services") - will be resolved to category_id automatically' },
                        client_id: { type: 'string', description: 'Client ID (optional but recommended - ask for client unless user explicitly says "no client needed")' },
                        client_name: { type: 'string', description: 'Client name (optional but recommended - ask for client unless user explicitly says "no client needed") - will be resolved to client_id automatically. Try to extract client names from natural language descriptions (e.g., "sell nexterix a design" → client: "nexterix", description: "a design")' },
                        project_id: { type: 'string', description: 'Project ID (optional)' },
                        reference_number: { type: 'string', description: 'Reference number (optional)' },
                        tax_rate: { type: 'number', description: 'Tax rate percentage (optional, defaults to user\'s default tax rate)' },
                        tax_amount: { type: 'number', description: 'Tax amount (optional, will be calculated from tax_rate and amount if not provided)' },
                        currency: { type: 'string', description: 'Currency code (optional, defaults to user\'s base currency)' },
                      },
                      required: ['amount', 'description', 'date'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'updateIncomeTool',
                    description: 'Update an existing income record. Uses the same client and category matching logic as createIncomeTool - checks both name and company_name for clients, handles multiple matches, and performs fuzzy matching. If client_name or category_name is provided and not found, returns an error with suggestions or offer to create.',
                    parameters: {
                      type: 'object',
                      properties: {
                        income_id: { type: 'string', description: 'Income record ID to update' },
                        amount: { type: 'number', description: 'Amount (optional)' },
                        description: { type: 'string', description: 'Description (optional)' },
                        date: { type: 'string', description: 'Date (YYYY-MM-DD format, or relative like "yesterday", "today" - optional)' },
                        category_id: { type: 'string', description: 'Category ID (optional)' },
                        category_name: { type: 'string', description: 'Category name (optional, will be resolved to category_id)' },
                        client_id: { type: 'string', description: 'Client ID (optional)' },
                        client_name: { type: 'string', description: 'Client name (optional, will be resolved to client_id)' },
                        project_id: { type: 'string', description: 'Project ID (optional)' },
                        reference_number: { type: 'string', description: 'Reference number (optional)' },
                        tax_rate: { type: 'number', description: 'Tax rate percentage (optional)' },
                        tax_amount: { type: 'number', description: 'Tax amount (optional)' },
                        currency: { type: 'string', description: 'Currency code (optional)' },
                      },
                      required: ['income_id'],
                    },
                  },
                },
    {
      type: 'function',
      function: {
        name: 'getIncomeTool',
        description: 'Get income records with optional filters. CRITICAL WORKFLOW: (1) Call parseDateQueryTool FIRST to parse date queries, (2) IMMEDIATELY call this tool with the returned start_date and end_date from parseDateQueryTool. Do NOT respond to the user until you have called this tool. Do NOT parse dates yourself - always use parseDateQueryTool first, then IMMEDIATELY call this tool with the returned dates. For single date queries, set both start_date and end_date to the same date (from parseDateQueryTool result). After calling this tool, you will receive the actual income data - then format and display it to the user.',
        parameters: {
          type: 'object',
          properties: {
            income_id: { type: 'string', description: 'ID of the income record to update' },
            amount: { type: 'number', description: 'New amount' },
            description: { type: 'string', description: 'New description' },
            date: { type: 'string', description: 'New date (YYYY-MM-DD)' },
            category_name: { type: 'string', description: 'New category name' },
            client_name: { type: 'string', description: 'New client name' },
            project_name: { type: 'string', description: 'New project name' },
            reference_number: { type: 'string', description: 'New reference number' },
            tax_rate: { type: 'number', description: 'New tax rate' },
            currency: { type: 'string', description: 'New currency code' },
          },
          required: ['income_id'],
        },
      },
    },

    // Expense tools
    {
      type: 'function',
      function: {
        name: 'validateExpenseTool',
        description: 'Validates expense data BEFORE creating. Checks if provided vendor/category/tax_rate/currency exist and returns errors + missing fields. Use this FIRST when user provides expense data.',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Expense amount (NET, before tax)' },
            description: { type: 'string', description: 'Description of the expense (optional)' },
            category_name: { type: 'string', description: 'Category name (optional)' },
            vendor_name: { type: 'string', description: 'Vendor name (optional)' },
            tax_rate: { type: 'number', description: 'Tax rate percentage (optional)' },
            currency: { type: 'string', description: 'Currency code (optional, defaults to user base currency). Will validate if currency is enabled.' },
          },
          required: ['amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createExpenseTool',
        description: 'Creates a new expense record. Shows preview to user before saving. Category and vendor are optional.',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Expense amount (NET, before tax)' },
            description: { type: 'string', description: 'Description of the expense' },
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            category_name: { type: 'string', description: 'Category name (optional)' },
            vendor_name: { type: 'string', description: 'Vendor name (optional)' },
            reference_number: { type: 'string', description: 'Reference number (optional)' },
            tax_rate: { type: 'number', description: 'Tax rate percentage (optional)' },
            currency: { type: 'string', description: 'Currency code (optional, defaults to user base currency)' },
          },
          required: ['amount', 'description', 'date'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getExpensesTool',
        description: 'Retrieves expense records with optional filters. Use parsed dates from parseDateQueryTool for date filters.',
        parameters: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
            category_name: { type: 'string', description: 'Filter by category name' },
            vendor_name: { type: 'string', description: 'Filter by vendor name' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'updateExpenseTool',
        description: 'Updates an existing expense record.',
        parameters: {
          type: 'object',
          properties: {
            expense_id: { type: 'string', description: 'ID of the expense record to update' },
            amount: { type: 'number', description: 'New amount' },
            description: { type: 'string', description: 'New description' },
            date: { type: 'string', description: 'New date (YYYY-MM-DD)' },
            category_name: { type: 'string', description: 'New category name' },
            vendor_name: { type: 'string', description: 'New vendor name' },
            reference_number: { type: 'string', description: 'New reference number' },
            tax_rate: { type: 'number', description: 'New tax rate' },
            currency: { type: 'string', description: 'New currency code' },
          },
          required: ['expense_id'],
        },
      },
    },

    // Vendor tools
    {
      type: 'function',
      function: {
        name: 'getVendorsTool',
        description: 'Retrieves all vendors for the user.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createVendorTool',
        description: 'Creates a new vendor. Checks for duplicates before creating.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Vendor name' },
            email: { type: 'string', description: 'Email (optional)' },
            phone: { type: 'string', description: 'Phone (optional)' },
            address: { type: 'string', description: 'Address (optional)' },
            tax_id: { type: 'string', description: 'Tax ID (optional)' },
            payment_terms: { type: 'number', description: 'Payment terms in days (optional)' },
            notes: { type: 'string', description: 'Notes (optional)' },
          },
          required: ['name'],
        },
      },
    },

    // Budget tools
    {
      type: 'function',
      function: {
        name: 'validateBudgetTool',
        description: 'Validates budget data BEFORE creating. Checks if category exists and returns errors + missing fields. Use this FIRST when user wants to create a budget.',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Budget amount (limit)' },
            category_name: { type: 'string', description: 'Category name (income or expense category, optional)' },
            period: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'], description: 'Budget period (optional, defaults to monthly)' },
          },
          required: ['amount'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createBudgetTool',
        description: 'Creates a new budget. Shows preview to user before saving. Category is required.',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Budget amount (limit)' },
            category_name: { type: 'string', description: 'Category name (income or expense category)' },
            period: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'], description: 'Budget period (monthly/quarterly/yearly)' },
            start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format (optional, defaults to start of current month)' },
          },
          required: ['amount', 'category_name', 'period'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getBudgetsTool',
        description: 'Retrieves budgets with progress information (actual vs budgeted). Returns budget status, percentage used, and alerts.',
        parameters: {
          type: 'object',
          properties: {
            category_name: { type: 'string', description: 'Filter by category name (optional)' },
            period: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'], description: 'Filter by period (optional)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'updateBudgetTool',
        description: 'Updates an existing budget. Can find by category name or budget ID.',
        parameters: {
          type: 'object',
          properties: {
            budget_id: { type: 'string', description: 'Budget ID (optional if category_name provided)' },
            category_name: { type: 'string', description: 'Category name to find budget (optional if budget_id provided)' },
            amount: { type: 'number', description: 'New budget amount (optional)' },
            period: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'], description: 'New period (optional)' },
            start_date: { type: 'string', description: 'New start date (optional)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'deleteBudgetTool',
        description: 'Deletes a budget. Can find by category name or budget ID.',
        parameters: {
          type: 'object',
          properties: {
            budget_id: { type: 'string', description: 'Budget ID (optional if category_name provided)' },
            category_name: { type: 'string', description: 'Category name to find budget (optional if budget_id provided)' },
          },
          required: [],
        },
      },
    },

    // Invoice tools (query-only)
    {
      type: 'function',
      function: {
        name: 'getInvoicesTool',
        description: 'Retrieves invoices with filters (date, status, client, currency, amount). Query-only - cannot create/edit invoices.',
        parameters: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
            status: {
              type: 'string',
              enum: ['draft', 'sent', 'paid', 'overdue', 'canceled', 'partially_paid'],
              description: 'Filter by invoice status (optional)'
            },
            client_name: { type: 'string', description: 'Filter by client name (optional)' },
            currency: { type: 'string', description: 'Filter by currency (optional)' },
            min_amount: { type: 'number', description: 'Minimum invoice amount (optional)' },
            max_amount: { type: 'number', description: 'Maximum invoice amount (optional)' },
          },
          required: [],
        },
      },
    },

    // Client tools
    {
      type: 'function',
      function: {
        name: 'getClientsTool',
        description: 'Get all clients from the clients table. This queries the clients table directly - use this to get ALL clients, including those with no income/invoice records. Do NOT extract clients from income/invoice records - always use this tool to get clients from the clients table. Returns all clients for the user.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getCategoriesTool',
        description: 'Get all categories. Use this to match category names when filtering income/expenses.',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['income', 'expense'], description: 'Filter by category type (optional)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getProjectsTool',
        description: 'Get all projects. Use this to match project names when filtering income/expenses/invoices.',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['active', 'completed', 'on_hold', 'cancelled', 'all'], description: 'Filter by project status (optional, defaults to all)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'searchClientTool',
        description: 'Search for a client by name (fuzzy match)',
        parameters: {
          type: 'object',
          properties: {
            searchTerm: { type: 'string' },
          },
          required: ['searchTerm'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createClientTool',
        description: 'Create a new client. Checks if client already exists first. Use this when user wants to create a client that doesn\'t exist in the system.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Client name (required)' },
            company_name: { type: 'string', description: 'Company name (optional)' },
            email: { type: 'string', description: 'Email address (optional)' },
            phone: { type: 'string', description: 'Phone number (optional)' },
            phone_country_code: { type: 'string', description: 'Phone country code (optional, defaults to +1)' },
            address: { type: 'string', description: 'Address (optional)' },
          },
          required: ['name'],
        },
      },
    },

    // Category tools
    {
      type: 'function',
      function: {
        name: 'getCategoriesTool',
        description: 'Retrieves categories. Can filter by type (income or expense).',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['income', 'expense'], description: 'Category type' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createCategoryTool',
        description: 'Creates a new category. Checks for duplicates before creating.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Category name' },
            type: { type: 'string', enum: ['income', 'expense'], description: 'Category type' },
            color: { type: 'string', description: 'Hex color code (optional)' },
          },
          required: ['name', 'type'],
        },
      },
    },

    // Tax rate tools
    {
      type: 'function',
      function: {
        name: 'getTaxRatesTool',
        description: 'Retrieves all configured tax rates for the user.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createTaxRateTool',
        description: 'Creates a new tax rate. Checks if rate already exists. Use when user wants to create a custom tax rate.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tax rate name (e.g., VAT, GST, Sales Tax)' },
            rate: { type: 'number', description: 'Tax rate percentage (e.g., 15, 20, 5)' },
          },
          required: ['name', 'rate'],
        },
      },
    },

    // Report tools (query-only)
    {
      type: 'function',
      function: {
        name: 'getReportSummaryTool',
        description: 'Get Profit & Loss summary with revenue (gross/credit notes/net), expenses, profit margin, and top income/expense categories. Query-only - directs users to UI for detailed charts.',
        parameters: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date (YYYY-MM-DD, optional, defaults to current month start)' },
            end_date: { type: 'string', description: 'End date (YYYY-MM-DD, optional, defaults to today)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getTaxSummaryTool',
        description: 'Get tax summary with tax collected (from sales), credit note adjustments, tax paid (on purchases), and net tax liability. Query-only - directs users to UI for detailed tax reports.',
        parameters: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date (YYYY-MM-DD, optional, defaults to current month start)' },
            end_date: { type: 'string', description: 'End date (YYYY-MM-DD, optional, defaults to today)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getClientSummaryTool',
        description: 'Get top clients by revenue ranking with gross/net revenue (after credit notes), invoice counts, and outstanding amounts. Query-only - directs users to UI for detailed client profitability analysis.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'How many top clients to return (optional, defaults to 10)' },
          },
          required: [],
        },
      },
    },

    // Project tools
    {
      type: 'function',
      function: {
        name: 'validateProjectTool',
        description: 'Validates project data BEFORE creating. Checks name uniqueness, client existence, date range. Returns errors and missing_fields. ALWAYS call this before createProjectTool.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Project name (required, must be unique)' },
            client_name: { type: 'string', description: 'Client name (optional)' },
            description: { type: 'string', description: 'Project description (optional)' },
            budget_amount: { type: 'number', description: 'Budget amount (optional)' },
            start_date: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
            end_date: { type: 'string', description: 'End date YYYY-MM-DD (optional, must be after start_date)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createProjectTool',
        description: 'Creates a new project with preview. Call validateProjectTool FIRST. Creates pending action for user confirmation.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Project name (required, must be unique)' },
            client_name: { type: 'string', description: 'Client name (optional)' },
            description: { type: 'string', description: 'Project description (optional)' },
            budget_amount: { type: 'number', description: 'Budget amount (optional)' },
            budget_currency: { type: 'string', description: 'Budget currency code (optional, defaults to user base currency)' },
            start_date: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
            end_date: { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
            color: { type: 'string', description: 'Hex color code like #6366F1 (optional, defaults to indigo)' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getProjectsTool',
        description: 'Retrieves projects with filters (status, client). Returns projects with stats (income, expenses, profit, margin).',
        parameters: {
          type: 'object',
          properties: {
            client_name: { type: 'string', description: 'Filter by client name (optional)' },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'on_hold', 'cancelled', 'all'],
              description: 'Filter by status (optional, defaults to active)'
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'updateProjectTool',
        description: 'Updates an existing project. Can find by name or ID.',
        parameters: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID (optional if project_name provided)' },
            project_name: { type: 'string', description: 'Project name to find (optional if project_id provided)' },
            name: { type: 'string', description: 'New project name (optional)' },
            description: { type: 'string', description: 'New description (optional)' },
            client_name: { type: 'string', description: 'New client name (optional)' },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'on_hold', 'cancelled'],
              description: 'New status (optional)'
            },
            budget_amount: { type: 'number', description: 'New budget amount (optional)' },
            budget_currency: { type: 'string', description: 'New budget currency (optional)' },
            start_date: { type: 'string', description: 'New start date YYYY-MM-DD (optional)' },
            end_date: { type: 'string', description: 'New end date YYYY-MM-DD (optional)' },
            color: { type: 'string', description: 'New hex color code (optional)' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'deleteProjectTool',
        description: 'Deletes a project. Can find by name or ID. Ask for confirmation first.',
        parameters: {
          type: 'object',
          properties: {
            project_id: { type: 'string', description: 'Project ID (optional if project_name provided)' },
            project_name: { type: 'string', description: 'Project name to delete (optional if project_id provided)' },
          },
          required: [],
        },
      },
    },

  ];
};

/**
 * Build system prompt with user context
 */
const buildSystemPrompt = async (userId: string): Promise<string> => {
  try {
    const userSettings = await getUserSettings(userId);
    const invoiceSettings = await getInvoiceSettings(userId);

    const userContext = `
# User Context
- Base Currency: ${userSettings.base_currency || 'USD'}
- Country: ${userSettings.country || 'US'}
- Default Tax Rate: ${invoiceSettings.default_tax_rate || 0}%
`;

    return `${sharedInstructions}\n\n${incomeInstructions}\n\n${expenseInstructions}\n\n${budgetInstructions}\n\n${invoiceInstructions}\n\n${projectInstructions}\n\n${reportInstructions}\n\n${userContext}`.trim();
  } catch (error) {
    console.error('Error building system prompt:', error);
    return `${sharedInstructions}\n\n${incomeInstructions}\n\n${expenseInstructions}\n\n${budgetInstructions}\n\n${invoiceInstructions}\n\n${projectInstructions}\n\n${reportInstructions}`.trim();
  }
};

/**
 * Check if content contains malformed tool call syntax
 */
const isMalformedToolCall = (content: string): boolean => {
  if (!content) return false;

  // Check for DeepSeek's malformed tool call markers
  const malformedPatterns = [
    '<｜tool▁calls▁begin｜>',
    '<｜tool▁call▁begin｜>',
    '<｜tool▁sep｜>',
    '<｜tool▁call▁end｜>',
    '<｜tool▁calls▁end｜>',
    '｜tool▁',
  ];

  return malformedPatterns.some(pattern => content.includes(pattern));
};

/**
 * Parse text-based tool calls from DeepSeek legacy format
 * Example: "<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>getIncomeTool<｜tool▁sep｜>{"startdate": "2025-11-01"}<｜tool▁call▁end｜><｜tool▁calls▁end｜>"
 */
const parseTextBasedToolCalls = (content: string): Array<{ name: string; arguments: any }> => {
  const toolCalls: Array<{ name: string; arguments: any }> = [];

  try {
    // Extract individual tool calls
    const toolCallPattern = /<｜tool▁call▁begin｜>(.*?)<｜tool▁sep｜>(.*?)<｜tool▁call▁end｜>/g;
    let match;

    while ((match = toolCallPattern.exec(content)) !== null) {
      const toolName = match[1].trim();
      const argsString = match[2].trim();

      try {
        // Parse the arguments JSON
        let parsedArgs = JSON.parse(argsString);

        // Fix parameter name mismatches (DeepSeek uses camelCase, we expect snake_case)
        if (parsedArgs.startdate) {
          parsedArgs.start_date = parsedArgs.startdate;
          delete parsedArgs.startdate;
        }
        if (parsedArgs.enddate) {
          parsedArgs.end_date = parsedArgs.enddate;
          delete parsedArgs.enddate;
        }

        toolCalls.push({
          name: toolName,
          arguments: parsedArgs,
        });
      } catch (jsonError) {
        console.error('[DeepSeek] Failed to parse tool arguments:', argsString, jsonError);
      }
    }
  } catch (error) {
    console.error('[DeepSeek] Error parsing text-based tool calls:', error);
  }

  return toolCalls;
};

/**
 * Execute tool call
 */
const executeTool = async (
  toolName: string,
  toolArguments: any,
  userId: string,
  conversationId: string,
  exchangeRates: Record<string, number> = {}
): Promise<any> => {
  console.log(`[DeepSeek] Executing tool: ${toolName}`);
  console.log(`[DeepSeek] Tool arguments:`, JSON.stringify(args, null, 2));

  try {
    let result: any;
    switch (toolName) {
      case 'parseDateQueryTool':
        result = await parseDateQueryTool(args.dateQuery);
        break;

      case 'getUIGuideTool':
        result = await getUIGuideTool(args.feature);
        break;

      // Income tools
      case 'validateIncomeTool':
        result = await validateIncomeTool(userId, args);
        console.log(`[DeepSeek] validateIncomeTool result:`, JSON.stringify(result, null, 2));
        return result;
      case 'createIncomeTool':
        console.log(`[DeepSeek] Calling createIncomeTool with ${Object.keys(exchangeRates).length} exchange rates`);
        if (args.currency) {
          console.log(`[DeepSeek] Income uses currency: ${args.currency}`);
          if (exchangeRates[args.currency]) {
            console.log(`[DeepSeek] ✓ Cached rate available for ${args.currency}: ${exchangeRates[args.currency]}`);
          } else {
            console.warn(`[DeepSeek] ⚠ No cached rate for ${args.currency} - will use edge function`);
          }
        }
        result = await createIncomeTool(userId, conversationId, args, exchangeRates);
        console.log(`[DeepSeek] createIncomeTool result:`, JSON.stringify(result, null, 2));
        return result;
      case 'getIncomeTool':
        return await getIncomeTool(userId, args);
      case 'updateIncomeTool':
        return await updateIncomeTool(userId, conversationId, args);

      // Expense tools
      case 'validateExpenseTool':
        result = await validateExpenseTool(userId, args);
        console.log(`[DeepSeek] validateExpenseTool result:`, JSON.stringify(result, null, 2));
        return result;
      case 'createExpenseTool':
        console.log(`[DeepSeek] Calling createExpenseTool with ${Object.keys(exchangeRates).length} exchange rates`);
        if (args.currency) {
          console.log(`[DeepSeek] Expense uses currency: ${args.currency}`);
          if (exchangeRates[args.currency]) {
            console.log(`[DeepSeek] ✓ Cached rate available for ${args.currency}: ${exchangeRates[args.currency]}`);
          } else {
            console.warn(`[DeepSeek] ⚠ No cached rate for ${args.currency} - will use edge function`);
          }
        }
        result = await createExpenseTool(userId, conversationId, args, exchangeRates);
        console.log(`[DeepSeek] createExpenseTool result:`, JSON.stringify(result, null, 2));
        return result;
      case 'getExpensesTool':
        return await getExpensesTool(userId, args);
      case 'updateExpenseTool':
        return await updateExpenseTool(userId, conversationId, args);

      // Vendor tools
      case 'getVendorsTool':
        return await getVendorsTool(userId);
      case 'createVendorTool':
        return await createVendorTool(userId, args);

      // Budget tools
      case 'validateBudgetTool':
        result = await validateBudgetTool(userId, args);
        console.log(`[DeepSeek] validateBudgetTool result:`, JSON.stringify(result, null, 2));
        return result;
      case 'createBudgetTool':
        result = await createBudgetTool(userId, conversationId, args);
        console.log(`[DeepSeek] createBudgetTool result:`, JSON.stringify(result, null, 2));
        return result;
      case 'getBudgetsTool':
        return await getBudgetsTool(userId, args);
      case 'updateBudgetTool':
        return await updateBudgetTool(userId, conversationId, args);
      case 'deleteBudgetTool':
        return await deleteBudgetTool(userId, args);

      // Invoice tools
      case 'getInvoicesTool':
        return await getInvoicesTool(userId, args);

      // Report tools (query-only)
      case 'getReportSummaryTool':
        return await getReportSummaryTool(userId, args);
      case 'getTaxSummaryTool':
        return await getTaxSummaryTool(userId, args);
      case 'getClientSummaryTool':
        return await getClientSummaryTool(userId, args);

      // Client tools
      case 'getClientsTool':
        return await getClientsTool(userId);
      
      case 'getCategoriesTool':
        return await getCategoriesTool(userId, toolArguments?.type);
      
      case 'getProjectsTool':
        return await getProjectsTool(userId, toolArguments?.status);
      
      case 'searchClientTool':
        return await searchClientTool(userId, toolArguments.searchTerm);
      
      case 'createClientTool':
        return await createClientTool(userId, toolArguments);
      
      case 'createCategoryTool':
        return await createCategoryTool(userId, args);

      // Tax rate tools
      case 'getTaxRatesTool':
        return await getTaxRatesTool(userId);
      case 'createTaxRateTool':
        return await createTaxRateTool(userId, args);

      // Project tools
      case 'validateProjectTool':
        result = await validateProjectTool(userId, args);
        console.log(`[DeepSeek] validateProjectTool result:`, JSON.stringify(result, null, 2));
        return result;
      case 'createProjectTool':
        result = await createProjectTool(userId, conversationId, args);
        console.log(`[DeepSeek] createProjectTool result:`, JSON.stringify(result, null, 2));
        return result;
      case 'getProjectsTool':
        return await getProjectsTool(userId, args);
      case 'updateProjectTool':
        return await updateProjectTool(userId, conversationId, args);
      case 'deleteProjectTool':
        return await deleteProjectTool(userId, args);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }

    console.log(`[DeepSeek] Tool result:`, JSON.stringify(result, null, 2));
    return result;
  } catch (error: any) {
    console.error(`Error executing tool ${toolName}:`, error);
    return { error: error.message };
  }
};

/**
 * Send a message to DeepSeek API and get response
 */
export const sendMessageToDeepSeek = async (
  userMessage: string,
  conversationHistory: ChatMessage[],
  userId: string,
  conversationId: string,
  exchangeRates: Record<string, number> = {}
): Promise<{ content: string; tool_calls?: any[] }> => {
  try {
    console.log('[DeepSeek] chatWithDeepSeek called with exchange rates:', Object.keys(exchangeRates).length, 'currencies');
    if (Object.keys(exchangeRates).length > 0) {
      console.log('[DeepSeek] Exchange rates available:', Object.keys(exchangeRates).join(', '));
    } else {
      console.warn('[DeepSeek] No exchange rates provided - tools will use edge function fallback');
    }

    const apiKey = await getDeepSeekApiKey();
    const systemPrompt = await buildSystemPrompt(userId);

    // Build messages array (keep last 20 messages for context)
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-20).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Make API call to DeepSeek
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: messages,
        tools: getToolsDefinition(),
        tool_choice: 'auto', // Explicitly enable tool calling
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DeepSeek API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const assistantMessage = choice.message;

    // Debug logging
    console.log('[DeepSeek] Response:', JSON.stringify({
      finish_reason: choice.finish_reason,
      has_tool_calls: !!assistantMessage.tool_calls,
      content_preview: assistantMessage.content?.substring(0, 200),
    }));

    // Check for tool calls (JSON format)
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log('[DeepSeek] Tool calls detected (JSON format):', assistantMessage.tool_calls.length);

      const toolResults: Array<{ toolName: string; result: any }> = [];

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        const result = await executeToolCall(toolName, toolArgs, userId, conversationId, exchangeRates);
        toolResults.push({ toolName, result });
      }

      // Send tool results back to AI
      const followUpMessages = [
        ...apiMessages,
        assistantMessage,
        ...assistantMessage.tool_calls.map((tc: any, idx: number) => ({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(toolResults[idx].result),
        })),
      ];

      console.log('[DeepSeek] Sending tool results back...');

      const followUpResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: followUpMessages,
          tools: getToolsDefinition(),
          tool_choice: 'auto',
          temperature: 0.7,
        }),
      });

      if (!followUpResponse.ok) {
        throw new Error(`DeepSeek follow-up error: ${followUpResponse.status}`);
      }

      const followUpData = await followUpResponse.json();
      const finalMessage = followUpData.choices[0].message;

      // Debug logging for follow-up response
      console.log('[DeepSeek] Follow-up response:', JSON.stringify({
        finish_reason: followUpData.choices[0].finish_reason,
        has_tool_calls: !!finalMessage.tool_calls,
        content_preview: finalMessage.content?.substring(0, 200),
      }));

      // Handle chained tool calls (AI wants to call more tools after getting results)
      let currentMessages = followUpMessages;
      let currentResponse = finalMessage;
      let maxIterations = 5; // Prevent infinite loops
      let iteration = 0;

      while (currentResponse.tool_calls && currentResponse.tool_calls.length > 0 && iteration < maxIterations) {
        iteration++;
        console.log(`[DeepSeek] Executing chained tool calls (iteration ${iteration}):`, currentResponse.tool_calls.length);

        // Execute the additional tool calls
        const additionalToolResults: Array<{ toolName: string; result: any }> = [];

        for (const toolCall of currentResponse.tool_calls) {
          console.log(`[DeepSeek] Executing chained tool: ${toolCall.function.name}`, toolCall.function.arguments);
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeToolCall(toolCall.function.name, args, userId, conversationId, exchangeRates);
          additionalToolResults.push({ toolName: toolCall.function.name, result });
          toolResults.push({ toolName: toolCall.function.name, result }); // Add to main results
        }

        // Build next messages array with new tool results
        currentMessages = [
          ...currentMessages,
          currentResponse,
          ...currentResponse.tool_calls.map((tc: any, idx: number) => ({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(additionalToolResults[idx].result),
          })),
        ];

        console.log('[DeepSeek] Sending chained tool results back...');

        // Send results back to API
        const chainedResponse = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: currentMessages,
            tools: getToolsDefinition(),
            tool_choice: 'auto',
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (!chainedResponse.ok) {
          throw new Error(`DeepSeek chained tool call error: ${chainedResponse.status}`);
        }

        const chainedData = await chainedResponse.json();
        currentResponse = chainedData.choices[0].message;

        console.log(`[DeepSeek] Chained response (iteration ${iteration}):`, JSON.stringify({
          finish_reason: chainedData.choices[0].finish_reason,
          has_tool_calls: !!currentResponse.tool_calls,
          content_preview: currentResponse.content?.substring(0, 200),
        }));
      }

      if (iteration >= maxIterations) {
        console.warn('[DeepSeek] Max tool call iterations reached');
      }

      return {
        content: currentResponse.content || 'Done!',
        tool_calls: toolResults,
      };
    }

    // Fallback: Check for text-based tool calls (DeepSeek legacy format)
    if (assistantMessage.content && isMalformedToolCall(assistantMessage.content)) {
      console.log('[DeepSeek] Detected text-based tool calls, attempting to parse...');

      try {
        const parsedToolCalls = parseTextBasedToolCalls(assistantMessage.content);

        if (parsedToolCalls.length > 0) {
          console.log('[DeepSeek] Successfully parsed', parsedToolCalls.length, 'text-based tool calls');

          const toolResults: Array<{ toolName: string; result: any }> = [];

          // Execute each parsed tool call
          for (const toolCall of parsedToolCalls) {
            const result = await executeToolCall(toolCall.name, toolCall.arguments, userId, conversationId, exchangeRates);
            toolResults.push({ toolName: toolCall.name, result });
          }

          // Send tool results back to AI
          const followUpMessages = [
            ...apiMessages,
            { role: 'assistant', content: assistantMessage.content },
            ...parsedToolCalls.map((tc, idx) => ({
              role: 'tool',
              tool_call_id: `call_${idx}`,
              name: tc.name,
              content: JSON.stringify(toolResults[idx].result),
            })),
          ];

          console.log('[DeepSeek] Sending tool results back...');

          const followUpResponse = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: DEEPSEEK_MODEL,
              messages: followUpMessages,
              tool_choice: 'auto',
              temperature: 0.7,
              max_tokens: 2000,
            }),
          });

          if (!followUpResponse.ok) {
            throw new Error(`DeepSeek follow-up error: ${followUpResponse.status}`);
          }

          const followUpData = await followUpResponse.json();
          const finalMessage = followUpData.choices[0].message;

          return {
            content: finalMessage.content || 'Done!',
            tool_calls: toolResults,
          };
        }
      } catch (parseError) {
        console.error('[DeepSeek] Failed to parse text-based tool calls:', parseError);
        // Fall through to return raw content
      }
    }

    // No tool calls - return response directly
    return {
      content: choice.message.content || '',
    };
  } catch (error: any) {
    console.error('Error sending message to DeepSeek:', error);
    throw error;
  }
};

// Export alias for backward compatibility
export const sendMessageToDeepSeek = chatWithDeepSeek;
