/**
 * DeepSeek API Service - Clean Architecture
 * Handles AI chat functionality with modular tool structure
 */

import { supabase } from '../supabaseClient';
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
const DEEPSEEK_MODEL = 'deepseek-chat';

/**
 * Get DeepSeek API key
 */
const getDeepSeekApiKey = async (): Promise<string> => {
  try {
    const apiKey = process.env.REACT_APP_DEEPSEEK_API_KEY;

    if (!apiKey) {
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
 * Tool definitions for DeepSeek API
 * Simple, clean descriptions without enforcement language
 */
const getToolsDefinition = () => {
  return [
    // Date parsing tool
    {
      type: 'function',
      function: {
        name: 'parseDateQueryTool',
        description: 'Parses natural language dates into YYYY-MM-DD format. Use this when user mentions dates like "today", "November 5", "last month", "this year". Returns start_date and end_date for date ranges.',
        parameters: {
          type: 'object',
          properties: {
            dateQuery: {
              type: 'string',
              description: 'The date expression from the user. Examples: "November 5", "today", "last month", "this year", "october"',
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
        name: 'getIncomeTool',
        description: `Retrieves income with filters. Returns: { summary: { total, count, by_category }, records: [...] }

CRITICAL - Choose response type based on user intent:

TYPE 1 - ANALYTICAL QUESTIONS → Return conversational analysis:
Keywords: "how", "should", "recommend", "advice", "good", "bad", "worry", "think", "analysis", "insights", "better", "worse"
Examples: "How is my income this month?", "Should I worry?", "Any recommendations?", "Is my income good?"

Response format: Write natural conversational text analyzing the data:
- Use summary.total (ALWAYS in user's base currency) for all numbers
- Compare with previous period if relevant
- Highlight trends, top categories from by_category
- Give actionable insights and recommendations
- Be specific with numbers and percentages

TYPE 2 - DATA RETRIEVAL → Return raw data structure:
Keywords: "show", "list", "find", "get", "display", "see", "view"
Examples: "Show me income last month", "List consulting income", "Find income from ABC client"

Response format: Return the full data structure { summary, records } unchanged. Frontend will render overview card + rows.

Use parseDateQueryTool first for date queries.`,
        parameters: {
          type: 'object',
          properties: {
            start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
            category_name: { type: 'string', description: 'Filter by category name' },
            client_name: { type: 'string', description: 'Filter by client name' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'updateIncomeTool',
        description: 'Updates an existing income record.',
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
        description: 'Retrieves all clients for the user.',
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
        name: 'createClientTool',
        description: 'Creates a new client. Checks for duplicates before creating.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Client name' },
            company_name: { type: 'string', description: 'Company name (optional)' },
            email: { type: 'string', description: 'Email address (optional)' },
            phone: { type: 'string', description: 'Phone number (optional)' },
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
const executeToolCall = async (
  toolName: string,
  args: any,
  userId: string,
  conversationId: string,
  exchangeRates: Record<string, number> = {}
): Promise<any> => {
  console.log(`[DeepSeek] Executing tool: ${toolName}`);
  console.log(`[DeepSeek] Tool arguments:`, JSON.stringify(args, null, 2));

  try {
    let result: any;
    switch (toolName) {
      // Date tool
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
      case 'createClientTool':
        return await createClientTool(userId, args);

      // Category tools
      case 'getCategoriesTool':
        return await getCategoriesTool(userId, args.type);
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
    console.error(`[DeepSeek] Tool execution error:`, error);
    return { error: error.message || 'Tool execution failed' };
  }
};

/**
 * Main chat function
 */
export const chatWithDeepSeek = async (
  messages: ChatMessage[],
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
    ];

    console.log('[DeepSeek] Sending request...');

    // Call DeepSeek API
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: apiMessages,
        tools: getToolsDefinition(),
        tool_choice: 'auto', // Explicitly enable tool calling
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
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
          max_tokens: 2000,
        }),
      });

      if (!followUpResponse.ok) {
        const errorBody = await followUpResponse.text();
        console.error('[DeepSeek Streaming] Follow-up error response:', errorBody);
        throw new Error(`DeepSeek follow-up error: ${followUpResponse.status} - ${errorBody}`);
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
      content: assistantMessage.content || 'I can help you manage your income records!',
    };
  } catch (error: any) {
    console.error('[DeepSeek] Error:', error);
    throw error;
  }
};

/**
 * Streaming version of chatWithDeepSeek for AI search
 * Returns results progressively for better UX
 */
export const chatWithDeepSeekStreaming = async (
  messages: ChatMessage[],
  userId: string,
  conversationId: string,
  exchangeRates: Record<string, number> = {},
  onProgress?: (status: string) => void
): Promise<{ content: string; tool_calls?: any[] }> => {
  try {
    onProgress?.('💭 SmartCFO is thinking...');

    const apiKey = await getDeepSeekApiKey();
    const systemPrompt = await buildSystemPrompt(userId);

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-20).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
    ];

    onProgress?.('🔍 Looking through your records...');

    // Call DeepSeek API with streaming enabled
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: apiMessages,
        tools: getToolsDefinition(),
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 800, // Shorter responses for speed
        stream: true, // Enable streaming!
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    // Process streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantMessage: any = { content: '', tool_calls: [] };
    let currentToolCall: any = null;

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0]?.delta;

            if (delta?.content) {
              assistantMessage.content += delta.content;
              onProgress?.('📋 Analyzing your data...');
            }

            if (delta?.tool_calls) {
              for (const toolCallDelta of delta.tool_calls) {
                if (toolCallDelta.index !== undefined) {
                  if (!assistantMessage.tool_calls[toolCallDelta.index]) {
                    assistantMessage.tool_calls[toolCallDelta.index] = {
                      id: toolCallDelta.id || '',
                      type: 'function',
                      function: { name: '', arguments: '' }
                    };
                  }

                  const toolCall = assistantMessage.tool_calls[toolCallDelta.index];

                  if (toolCallDelta.id) {
                    toolCall.id = toolCallDelta.id;
                  }
                  if (toolCallDelta.function?.name) {
                    toolCall.function.name = toolCallDelta.function.name;
                    onProgress?.('🔎 Searching...');
                  }
                  if (toolCallDelta.function?.arguments) {
                    toolCall.function.arguments += toolCallDelta.function.arguments;
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[DeepSeek Streaming] Failed to parse chunk:', e);
          }
        }
      }
    }

    // If tool calls detected, execute them (WITH CHAINING SUPPORT!)
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      onProgress?.('📊 Gathering your information...');

      const toolResults: Array<{ toolName: string; result: any }> = [];

      // Execute first round of tools
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        console.log('[DeepSeek Streaming] Executing tool:', toolName);
        const result = await executeToolCall(toolName, toolArgs, userId, conversationId, exchangeRates);
        toolResults.push({ toolName, result });
      }

      // Send tool results back to AI (non-streaming for follow-up)
      const followUpMessages = [
        ...apiMessages,
        {
          role: 'assistant',  // ← ADD ROLE FIELD!
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls
        },
        ...assistantMessage.tool_calls.map((tc: any, idx: number) => ({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(toolResults[idx].result),
        })),
      ];

      console.log('[DeepSeek Streaming] Sending tool results back...');
      console.log('[DeepSeek Streaming] Follow-up message structure:', {
        total_messages: followUpMessages.length,
        last_message_role: followUpMessages[followUpMessages.length - 1].role,
        assistant_message_has_role: !!followUpMessages.find(m => m.role === 'assistant' && m.tool_calls)
      });
      onProgress?.('✨ Almost there...');

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
          max_tokens: 800,
          // NO streaming for follow-up (faster for tool chains)
        }),
      });

      if (!followUpResponse.ok) {
        const errorBody = await followUpResponse.text();
        console.error('[DeepSeek Streaming] Follow-up error response:', errorBody);
        throw new Error(`DeepSeek follow-up error: ${followUpResponse.status} - ${errorBody}`);
      }

      const followUpData = await followUpResponse.json();
      let currentResponse = followUpData.choices[0].message;

      // Handle chained tool calls (AI wants to call more tools)
      let currentMessages = followUpMessages;
      let maxIterations = 5; // Prevent infinite loops
      let iteration = 0;

      while (currentResponse.tool_calls && currentResponse.tool_calls.length > 0 && iteration < maxIterations) {
        iteration++;
        console.log(`[DeepSeek Streaming] Chained tool calls (iteration ${iteration}):`, currentResponse.tool_calls.length);
        onProgress?.('🔍 Finding more details...');

        // Execute additional tool calls
        const additionalToolResults: Array<{ toolName: string; result: any }> = [];

        for (const toolCall of currentResponse.tool_calls) {
          console.log(`[DeepSeek Streaming] Executing chained tool: ${toolCall.function.name}`);
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeToolCall(toolCall.function.name, args, userId, conversationId, exchangeRates);
          additionalToolResults.push({ toolName: toolCall.function.name, result });
          toolResults.push({ toolName: toolCall.function.name, result }); // Add to main results
        }

        // Build next messages array
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

        console.log('[DeepSeek Streaming] Sending chained results back...');

        // Send results back
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
            max_tokens: 800,
          }),
        });

        if (!chainedResponse.ok) {
          const errorBody = await chainedResponse.text();
          console.error('[DeepSeek Streaming] Chained call error response:', errorBody);
          throw new Error(`DeepSeek chained error: ${chainedResponse.status} - ${errorBody}`);
        }

        const chainedData = await chainedResponse.json();
        currentResponse = chainedData.choices[0].message;

        console.log(`[DeepSeek Streaming] Chained response (iteration ${iteration}):`, {
          finish_reason: chainedData.choices[0].finish_reason,
          has_tool_calls: !!currentResponse.tool_calls,
        });
      }

      if (iteration >= maxIterations) {
        console.warn('[DeepSeek Streaming] Max tool call iterations reached');
      }

      onProgress?.('✅ Found your results!');

      return {
        content: currentResponse.content || 'Results retrieved!',
        tool_calls: toolResults,
      };
    }

    return {
      content: assistantMessage.content || 'I can help you search your income records!',
    };
  } catch (error: any) {
    console.error('[DeepSeek Streaming] Error:', error);
    throw error;
  }
};

// Export alias for backward compatibility
export const sendMessageToDeepSeek = chatWithDeepSeek;
