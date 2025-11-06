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
    {
      type: 'function',
      function: {
        name: 'createInvoiceTool',
        description: 'Create a new invoice. IMPORTANT: If client_name or client_id is not provided, the system will show a selection modal to the user. Do NOT guess or assume client names - if user says "use 4" or refers to a number, ask them to select from the list. The system will automatically use the user\'s base currency - do not specify currency.',
        parameters: {
          type: 'object',
          properties: {
            client_name: { type: 'string', description: 'Client name (ONLY if user explicitly provided it, otherwise leave empty to show selection)' },
            client_id: { type: 'string', description: 'Client ID (if known, otherwise leave empty)' },
            date: { type: 'string', description: 'Invoice date (YYYY-MM-DD)' },
            due_date: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  quantity: { type: 'number' },
                  rate: { type: 'number' },
                },
                required: ['description', 'quantity', 'rate'],
              },
            },
            notes: { type: 'string' },
            tax_rate: { type: 'number' },
          },
          required: ['date', 'due_date', 'items'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getInvoicesTool',
        description: 'Get invoices with optional filters (client, date range, status, month)',
        parameters: {
          type: 'object',
          properties: {
            client_id: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
            status: { type: 'string' },
            month: { type: 'string', description: 'Month in format YYYY-MM' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createExpenseTool',
        description: 'Create a new expense. IMPORTANT: If category_name or category_id is not provided, the system will show a selection modal. Do NOT guess category names - if user says "use category 3" or refers to a number, leave category_name and category_id empty to show selection.',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            category_name: { type: 'string', description: 'Category name (ONLY if user explicitly provided the exact name, otherwise leave empty to show selection)' },
            category_id: { type: 'string', description: 'Category ID (if known, otherwise leave empty)' },
            description: { type: 'string' },
            date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
            vendor: { type: 'string' },
            project_id: { type: 'string' },
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
            start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format. CRITICAL: Use the start_date value returned by parseDateQueryTool. Do NOT parse dates yourself - always call parseDateQueryTool first and use its returned start_date.' },
            end_date: { type: 'string', description: 'End date in YYYY-MM-DD format. CRITICAL: Use the end_date value returned by parseDateQueryTool. Do NOT parse dates yourself - always call parseDateQueryTool first and use its returned end_date. For single date queries, set this to the same as start_date (from parseDateQueryTool result).' },
            month: { type: 'string', description: 'Month in format YYYY-MM' },
            client_id: { type: 'string', description: 'Filter by client ID (optional - prefer using client_name or search_term for better matching)' },
            client_name: { type: 'string', description: 'Filter by client name (optional - will be resolved to client_id or used as search_term. CRITICAL: When user mentions a client name like "Abdullah Aslam", use client_name instead of trying to resolve client_id first. This ensures better matching.)' },
            category_id: { type: 'string', description: 'Filter by category ID' },
            project_id: { type: 'string', description: 'Filter by project ID' },
            search_term: { type: 'string', description: 'Search in description, reference number, category name, client name, or company name. CRITICAL: When user mentions a client name, prefer using client_name parameter or search_term instead of client_id for better matching.' },
            currency: { type: 'string', description: 'Filter by currency code (e.g., "USD", "EUR", "GBP")' },
            tax_rate: { type: 'number', description: 'Filter by tax rate percentage (e.g., 20 for 20%)' },
            amount: { type: 'number', description: 'Filter by exact amount (e.g., 239 for PKR 239)' },
          },
        },
      },
    },
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
    {
      type: 'function',
      function: {
        name: 'createCategoryTool',
        description: 'Create a new category (income or expense). Checks if category already exists first. Use this when user wants to create a category that doesn\'t exist in the system.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Category name (required)' },
            type: { type: 'string', enum: ['income', 'expense'], description: 'Category type - income or expense (required)' },
            color: { type: 'string', description: 'Category color hex code (optional, will be auto-assigned if not provided)' },
          },
          required: ['name', 'type'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'calculateMonthlyIncomeTool',
        description: 'Calculate total income for a specific month',
        parameters: {
          type: 'object',
          properties: {
            month: { type: 'string', description: 'Month in format YYYY-MM' },
          },
          required: ['month'],
        },
      },
    },
  ];
};

/**
 * Execute a tool function based on tool name and arguments
 */
const executeTool = async (
  toolName: string,
  toolArguments: any,
  userId: string,
  conversationId: string
): Promise<any> => {
  try {
    console.log('[executeTool] Called tool:', toolName, 'with arguments:', JSON.stringify(toolArguments, null, 2));
    
    switch (toolName) {
      case 'parseDateQueryTool':
        return await parseDateQueryTool(toolArguments.dateQuery);
      
      case 'createInvoiceTool':
        return await createInvoiceTool(userId, conversationId, toolArguments);
      
      case 'getInvoicesTool':
        return await getInvoicesTool(userId, toolArguments);
      
      case 'createExpenseTool':
        return await createExpenseTool(userId, conversationId, toolArguments);
      
      case 'getExpensesTool':
        return await getExpensesTool(userId, toolArguments);
      
      case 'createIncomeTool':
        return await createIncomeTool(userId, conversationId, toolArguments);
      
      case 'updateIncomeTool':
        return await updateIncomeTool(userId, conversationId, toolArguments);
      
      case 'getIncomeTool':
        return await getIncomeTool(userId, toolArguments);
      
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
        return await createCategoryTool(userId, toolArguments);
      
      case 'calculateMonthlyIncomeTool':
        return await calculateMonthlyIncomeTool(userId, toolArguments.month);
      
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
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
  userContext?: Record<string, any>
): Promise<{ content: string; toolCalls?: any[] }> => {
  try {
    const apiKey = await getDeepSeekApiKey();
    
    // Build messages array for DeepSeek
    // Format user context for better readability
    const userContextStr = userContext && Object.keys(userContext).length > 0
      ? `\n\n=== USER CONTEXT ===\n${JSON.stringify(userContext, null, 2)}\n==================\n\nIMPORTANT: Always use the base_currency from User Context when displaying amounts. Do NOT default to USD.`
      : '';
    
    const messages: any[] = [
      {
        role: 'system',
        content: `${getSystemKnowledge()}${userContextStr}`,
      },
      ...conversationHistory.map((msg) => ({
        role: msg.role,
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
        tool_choice: 'auto', // Let AI decide when to use tools
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DeepSeek API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    // Check if AI wants to call a tool
    console.log('[DeepSeek] AI response - has tool_calls:', !!choice.message.tool_calls);
    console.log('[DeepSeek] AI response - tool_calls count:', choice.message.tool_calls?.length || 0);
    console.log('[DeepSeek] AI response - content:', choice.message.content);
    
    const toolCalls: any[] = choice.message.tool_calls || [];
    
    if (toolCalls.length > 0) {
      console.log('[DeepSeek] Tool calls detected:', toolCalls.map((tc: any) => ({ name: tc.function.name, args: tc.function.arguments })));
      
      // Execute tools and collect results
      const toolResults: any[] = [];
      
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        console.log('[DeepSeek] Executing tool:', toolName, 'with args:', JSON.stringify(toolArgs, null, 2));
        
        const result = await executeTool(toolName, toolArgs, userId, conversationId);
        
        console.log('[DeepSeek] Tool result:', toolName, '- Success:', result.success !== false, '- Result type:', Array.isArray(result) ? `Array(${result.length})` : typeof result);
        
        // If tool returned an error, include it in the response so AI can inform the user
        if (result.success === false && result.error) {
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolName,
            content: JSON.stringify({ error: result.error, success: false }),
          });
        } else {
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolName,
            content: JSON.stringify(result),
          });
        }
      }

      // Make second API call with tool results (include userContext in system message)
      const secondResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            {
              role: 'system',
              content: `${getSystemKnowledge()}${userContextStr}`,
            },
            ...conversationHistory.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            {
              role: 'user',
              content: userMessage,
            },
            choice.message, // AI's request to call tool
            ...toolResults, // Tool execution results
          ],
          tools: getToolsDefinition(),
          temperature: 0.7,
        }),
      });

      if (!secondResponse.ok) {
        throw new Error(`DeepSeek API error on second call: ${secondResponse.status}`);
      }

      const secondData = await secondResponse.json();
      const finalChoice = secondData.choices[0];
      
      console.log('[DeepSeek] Final AI response after tools:', finalChoice.message.content);
      
      // Check if AI's response promises to do something without actually calling tools
      const aiResponseContent = (finalChoice.message.content || '').toLowerCase();
      const aiSaysWillDo = 
        aiResponseContent.includes('let me get') ||
        aiResponseContent.includes('now let me') ||
        aiResponseContent.includes("i'll check") ||
        aiResponseContent.includes("i'll get") ||
        aiResponseContent.includes('let me check') ||
        aiResponseContent.includes('i will check') ||
        aiResponseContent.includes('i will get');
      
      // Check if AI mentions dates/queries in its response
      const aiMentionsDates = 
        aiResponseContent.includes('date range') ||
        aiResponseContent.includes('date') ||
        aiResponseContent.includes('last month') ||
        aiResponseContent.includes('this month') ||
        aiResponseContent.includes('last week') ||
        aiResponseContent.includes('check if') ||
        aiResponseContent.includes('check any') ||
        aiResponseContent.includes('existing records');
      
      // Option 3: Check if parseDateQueryTool was called and user query mentions income/expenses/invoices
      // If so, and AI hasn't called getIncomeTool/getExpensesTool/getInvoicesTool, force another API call
      const parseDateToolCalled = toolCalls.some((tc: any) => tc.function.name === 'parseDateQueryTool');
      const getToolCalled = toolCalls.some((tc: any) => 
        ['getIncomeTool', 'getExpensesTool', 'getInvoicesTool'].includes(tc.function.name)
      );
      
      // Solution 4: Check required tool type specifically (will be set after we determine mentionsIncome/etc)
      // This is a placeholder - will be updated after we check context
      let requiredGetToolName: string | null = null;
      let requiredGetToolCalled = false;
      
      // Also check if finalChoice has tool_calls (AI might call tools in the second response)
      const finalChoiceHasToolCalls = finalChoice.message.tool_calls && finalChoice.message.tool_calls.length > 0;
      const finalChoiceParseDateCalled = finalChoiceHasToolCalls && finalChoice.message.tool_calls.some((tc: any) => tc.function.name === 'parseDateQueryTool');
      const finalChoiceGetToolCalled = finalChoiceHasToolCalls && finalChoice.message.tool_calls.some((tc: any) => 
        ['getIncomeTool', 'getExpensesTool', 'getInvoicesTool'].includes(tc.function.name)
      );
      
      console.log('[DeepSeek] Tool call check - parseDateToolCalled:', parseDateToolCalled, 'getToolCalled:', getToolCalled);
      console.log('[DeepSeek] AI response analysis - aiSaysWillDo:', aiSaysWillDo, 'aiMentionsDates:', aiMentionsDates);
      console.log('[DeepSeek] Final choice tool calls - hasToolCalls:', finalChoiceHasToolCalls, 'parseDateCalled:', finalChoiceParseDateCalled, 'getToolCalled:', finalChoiceGetToolCalled);
      
      // Solution 3: Check last 5 messages for context + check AI's response content for mentions
      const userQueryLower = userMessage.toLowerCase();
      
      // Get last 5 messages for context checking
      const last5Messages = conversationHistory.slice(-5).map((msg) => msg.content?.toLowerCase() || '').join(' ');
      const combinedContext = (userQueryLower + ' ' + last5Messages + ' ' + aiResponseContent).toLowerCase();
      
      // Check both user query and AI's response for mentions
      const userMentionsIncome = userQueryLower.includes('income') || userQueryLower.includes('earn') || userQueryLower.includes('revenue') || (userQueryLower.includes('have') && userQueryLower.includes('income'));
      const userMentionsExpenses = userQueryLower.includes('expense') || userQueryLower.includes('spend');
      const userMentionsInvoices = userQueryLower.includes('invoice') || userQueryLower.includes('bill');
      
      // Check AI's response for mentions
      const aiMentionsIncome = aiResponseContent.includes('income') || aiResponseContent.includes('earn') || aiResponseContent.includes('revenue');
      const aiMentionsExpenses = aiResponseContent.includes('expense') || aiResponseContent.includes('spend');
      const aiMentionsInvoices = aiResponseContent.includes('invoice') || aiResponseContent.includes('bill');
      
      // Check context (last 5 messages) for mentions
      const contextMentionsIncome = combinedContext.includes('income') || combinedContext.includes('earn') || combinedContext.includes('revenue');
      const contextMentionsExpenses = combinedContext.includes('expense') || combinedContext.includes('spend');
      const contextMentionsInvoices = combinedContext.includes('invoice') || combinedContext.includes('bill');
      
      // Combined mentions (user OR AI OR context)
      const mentionsIncome = userMentionsIncome || aiMentionsIncome || contextMentionsIncome;
      const mentionsExpenses = userMentionsExpenses || aiMentionsExpenses || contextMentionsExpenses;
      const mentionsInvoices = userMentionsInvoices || aiMentionsInvoices || contextMentionsInvoices;
      
      // Solution 4: Determine required tool and check if it was called
      requiredGetToolName = mentionsIncome ? 'getIncomeTool' : mentionsExpenses ? 'getExpensesTool' : mentionsInvoices ? 'getInvoicesTool' : null;
      requiredGetToolCalled = requiredGetToolName ? toolCalls.some((tc: any) => tc.function.name === requiredGetToolName) : false;
      const finalChoiceRequiredGetToolCalled = finalChoiceHasToolCalls && requiredGetToolName && finalChoice.message.tool_calls.some((tc: any) => tc.function.name === requiredGetToolName);
      
      // Check if user says "get all records" without specifying type
      const userSaysRecords = userQueryLower.includes('records') || userQueryLower.includes('get all') || userQueryLower.includes('show all');
      const userSpecifiesType = mentionsIncome || mentionsExpenses || mentionsInvoices;
      
      console.log('[DeepSeek] User query analysis - mentionsIncome:', mentionsIncome, 'mentionsExpenses:', mentionsExpenses, 'mentionsInvoices:', mentionsInvoices);
      console.log('[DeepSeek] Context analysis - userSaysRecords:', userSaysRecords, 'userSpecifiesType:', userSpecifiesType, 'contextMentionsIncome:', contextMentionsIncome);
      console.log('[DeepSeek] Solution 4 - requiredGetToolName:', requiredGetToolName, 'requiredGetToolCalled:', requiredGetToolCalled, 'finalChoiceRequiredGetToolCalled:', finalChoiceRequiredGetToolCalled);
      
      // Solution 3: If user says "get all records" without specifying type, check context or ask for clarification
      if (userSaysRecords && !userSpecifiesType && !finalChoiceHasToolCalls) {
        // Check if context (last 5 messages) gives us a clue
        if (contextMentionsIncome || contextMentionsExpenses || contextMentionsInvoices) {
          console.log('[DeepSeek] User said "get all records" but context shows type. Using context to determine tool.');
          // Continue with enforcement below
        } else {
          // Not clear from context - return message asking for clarification
          console.log('[DeepSeek] User said "get all records" without specifying type and context is unclear. Asking for clarification.');
          return {
            content: `I see you want to see records, but I'm not sure which type you're referring to. Are you asking about income, expenses, or invoices? Please clarify so I can show you the right information.`,
            toolCalls: toolCalls,
          };
        }
      }
      
      // If AI says it will do something (check dates, get records) but didn't call the required tool, force it
      // Solution 4: Check if the specific required tool was called, not just any tool
      const shouldEnforce = (mentionsIncome || mentionsExpenses || mentionsInvoices) && 
                            !finalChoiceRequiredGetToolCalled && 
                            !requiredGetToolCalled &&
                            (aiSaysWillDo || !finalChoiceHasToolCalls);
      
      if (shouldEnforce) {
        console.log('[DeepSeek] Detected AI promising to get records or missing required tool call. Forcing tool calls...');
        
        // Force parseDateQueryTool and getIncomeTool/getExpensesTool/getInvoicesTool
        const enforcementMessages = [
          {
            role: 'system',
            content: `${getSystemKnowledge()}${userContextStr}`,
          },
          ...conversationHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          {
            role: 'user',
            content: userMessage,
          },
          choice.message, // AI's first tool call
          ...toolResults, // Tool execution results
          finalChoice.message, // AI's response that promised to do something
          {
            role: 'system',
            content: `CRITICAL: You said you will check dates/get records, but you did not call the required tools. You MUST immediately call parseDateQueryTool with the date mentioned (e.g., "last month"), then IMMEDIATELY call the appropriate get tool (getIncomeTool/getExpensesTool/getInvoicesTool) with the returned dates. Do NOT respond with text - just call the tools.`,
          },
        ];
        
        const enforcementResponse = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: enforcementMessages,
            tools: getToolsDefinition(),
            temperature: 0.7,
          }),
        });
        
        if (enforcementResponse.ok) {
          const enforcementData = await enforcementResponse.json();
          const enforcementChoice = enforcementData.choices[0];
          
          // If AI now called tools, execute them
          if (enforcementChoice.message.tool_calls && enforcementChoice.message.tool_calls.length > 0) {
            const enforcementToolCalls = enforcementChoice.message.tool_calls;
            const enforcementToolResults: any[] = [];
            
            for (const toolCall of enforcementToolCalls) {
              const toolName = toolCall.function.name;
              const toolArgs = JSON.parse(toolCall.function.arguments);
              
              console.log('[DeepSeek] Executing enforced tool:', toolName, 'with args:', JSON.stringify(toolArgs, null, 2));
              
              const result = await executeTool(toolName, toolArgs, userId, conversationId);
              
              enforcementToolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolName,
                content: JSON.stringify(result),
              });
            }
            
            // Make final API call with all tool results
            const finalEnforcementResponse = await fetch(DEEPSEEK_API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: DEEPSEEK_MODEL,
                messages: [
                  ...enforcementMessages,
                  enforcementChoice.message,
                  ...enforcementToolResults,
                ],
                tools: getToolsDefinition(),
                temperature: 0.7,
              }),
            });
            
            if (finalEnforcementResponse.ok) {
              const finalEnforcementData = await finalEnforcementResponse.json();
              const finalEnforcementChoice = finalEnforcementData.choices[0];
              
              console.log('[DeepSeek] Final AI response after enforced tool calls:', finalEnforcementChoice.message.content);
              
              return {
                content: finalEnforcementChoice.message.content || '',
                toolCalls: [...toolCalls, ...enforcementToolCalls],
              };
            }
          }
        }
      }
      
      // If parseDateQueryTool was called but no get tool was called, and user query is about data fetching
      if (parseDateToolCalled && !getToolCalled && (mentionsIncome || mentionsExpenses || mentionsInvoices)) {
        console.log('[DeepSeek] Detected parseDateQueryTool called without follow-up get tool. Forcing follow-up...');
        
        // Find the parseDateQueryTool result - MUST be from the CURRENT tool call, not previous ones
        const parseDateResult = toolResults.find((tr: any) => {
          try {
            const result = JSON.parse(tr.content);
            const hasDates = result.success && result.start_date && result.end_date;
            console.log('[DeepSeek] Checking parseDateResult:', result.start_date, result.end_date, 'hasDates:', hasDates);
            return hasDates;
          } catch (e) {
            console.log('[DeepSeek] Error parsing parseDateResult:', e);
            return false;
          }
        });
        
        if (parseDateResult) {
          const parsedResult = JSON.parse(parseDateResult.content);
          console.log('[DeepSeek] Found valid parseDateResult with dates:', parsedResult.start_date, 'to', parsedResult.end_date);
          
          // Determine which get tool to call based on user query
          let targetTool = 'getIncomeTool';
          if (mentionsExpenses) {
            targetTool = 'getExpensesTool';
          } else if (mentionsInvoices) {
            targetTool = 'getInvoicesTool';
          }
          
          console.log('[DeepSeek] Will force call to:', targetTool, 'with dates:', parsedResult.start_date, parsedResult.end_date);
          
          // Inject a system message that forces the AI to call the get tool
          const followUpMessages = [
            {
              role: 'system',
              content: `${getSystemKnowledge()}${userContextStr}`,
            },
            ...conversationHistory.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            {
              role: 'user',
              content: userMessage,
            },
            choice.message, // AI's request to call parseDateQueryTool
            ...toolResults, // Tool execution results
            {
              role: 'system',
              content: `CRITICAL: You have parsed the date query successfully. The user asked about ${mentionsIncome ? 'income' : mentionsExpenses ? 'expenses' : 'invoices'}. You MUST now call ${targetTool} with start_date="${parsedResult.start_date}" and end_date="${parsedResult.end_date}" to fetch the actual data for THIS SPECIFIC DATE. Do NOT use dates from previous queries. Do NOT respond with text until you have called this tool.`,
            },
          ];
          
          // Make third API call to force get tool execution
          const thirdResponse = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: DEEPSEEK_MODEL,
              messages: followUpMessages,
              tools: getToolsDefinition(),
              temperature: 0.7,
            }),
          });
          
          if (thirdResponse.ok) {
            const thirdData = await thirdResponse.json();
            const thirdChoice = thirdData.choices[0];
            
            // If AI called the get tool, execute it
            if (thirdChoice.message.tool_calls && thirdChoice.message.tool_calls.length > 0) {
              const followUpToolCalls = thirdChoice.message.tool_calls;
              const followUpToolResults: any[] = [];
              
              for (const toolCall of followUpToolCalls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);
                
                console.log('[DeepSeek] Executing follow-up tool:', toolName, 'with args:', JSON.stringify(toolArgs, null, 2));
                
                // Verify the dates match what we expect
                if (toolName === targetTool && toolArgs.start_date && toolArgs.end_date) {
                  console.log('[DeepSeek] Verifying dates - Expected:', parsedResult.start_date, parsedResult.end_date, 'Got:', toolArgs.start_date, toolArgs.end_date);
                  if (toolArgs.start_date !== parsedResult.start_date || toolArgs.end_date !== parsedResult.end_date) {
                    console.warn('[DeepSeek] WARNING: Dates mismatch! Forcing correct dates...');
                    toolArgs.start_date = parsedResult.start_date;
                    toolArgs.end_date = parsedResult.end_date;
                  }
                }
                
                const result = await executeTool(toolName, toolArgs, userId, conversationId);
                
                console.log('[DeepSeek] Follow-up tool result:', toolName, '- Success:', result.success !== false, '- Result count:', Array.isArray(result) ? result.length : 'N/A');
                
                followUpToolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: toolName,
                  content: JSON.stringify(result),
                });
              }
              
              // Make final API call with all tool results
              const finalResponse = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model: DEEPSEEK_MODEL,
                  messages: [
                    ...followUpMessages,
                    thirdChoice.message,
                    ...followUpToolResults,
                  ],
                  tools: getToolsDefinition(),
                  temperature: 0.7,
                }),
              });
              
              if (finalResponse.ok) {
                const finalData = await finalResponse.json();
                const finalChoice = finalData.choices[0];
                
                console.log('[DeepSeek] Final AI response after forced follow-up:', finalChoice.message.content);
                
                return {
                  content: finalChoice.message.content || '',
                  toolCalls: [...toolCalls, ...followUpToolCalls],
                };
              }
            }
          }
        }
      }
      
      return {
        content: finalChoice.message.content || '',
        toolCalls: toolCalls,
      };
    }

    // No tool calls - AI responded directly
    console.log('[DeepSeek] WARNING: AI responded without calling any tools. Content:', choice.message.content);
    
    // Enforcement: Check if user asked for client names but AI didn't call getClientsTool
    const userQueryLower = userMessage.toLowerCase();
    const lastUserMessage = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1]?.content?.toLowerCase() || '' : '';
    const combinedContext = (userQueryLower + ' ' + lastUserMessage).toLowerCase();
    
    const mentionsClients = 
      combinedContext.includes('client') && (
        combinedContext.includes('name') || 
        combinedContext.includes('list') || 
        combinedContext.includes('show') || 
        combinedContext.includes('tell') || 
        combinedContext.includes('give') ||
        combinedContext.includes('all') ||
        combinedContext.includes('my clients') ||
        combinedContext.includes('your clients')
      );
    
    const getClientsToolCalled = toolCalls && toolCalls.length > 0 && toolCalls.some((tc: any) => tc.function.name === 'getClientsTool');
    
    console.log('[DeepSeek] Client query check - mentionsClients:', mentionsClients, 'getClientsToolCalled:', getClientsToolCalled);
    
    // If user asked for clients but AI didn't call getClientsTool, force it
    if (mentionsClients && !getClientsToolCalled) {
      console.log('[DeepSeek] Detected client query without getClientsTool call. Forcing getClientsTool...');
      
      // Make API call to force getClientsTool execution
      const clientEnforcementMessages = [
        {
          role: 'system',
          content: `${getSystemKnowledge()}${userContextStr}`,
        },
        ...conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: userMessage,
        },
        choice.message, // AI's response without tool call
        {
          role: 'system',
          content: `CRITICAL: The user asked for client names/list. You MUST call getClientsTool to get clients directly from the clients table. Do NOT use cached data. Do NOT extract clients from income/invoice records. Always call getClientsTool fresh to ensure you get ALL clients, including those with no transactions. Do NOT respond with text until you have called getClientsTool.`,
        },
      ];
      
      const clientEnforcementResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: clientEnforcementMessages,
          tools: getToolsDefinition(),
          temperature: 0.7,
        }),
      });
      
      if (clientEnforcementResponse.ok) {
        const clientEnforcementData = await clientEnforcementResponse.json();
        const clientEnforcementChoice = clientEnforcementData.choices[0];
        
        // Check if AI now called getClientsTool
        if (clientEnforcementChoice.message.tool_calls && clientEnforcementChoice.message.tool_calls.length > 0) {
          const clientToolCalls = clientEnforcementChoice.message.tool_calls;
          const clientToolResults: any[] = [];
          
          for (const toolCall of clientToolCalls) {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            
            console.log('[DeepSeek] Executing enforced getClientsTool:', toolName);
            
            const result = await executeTool(toolName, toolArgs, userId, conversationId);
            
            clientToolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: toolName,
              content: JSON.stringify(result),
            });
          }
          
          // Make final API call with tool results
          const finalClientResponse = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: DEEPSEEK_MODEL,
              messages: [
                ...clientEnforcementMessages,
                clientEnforcementChoice.message,
                ...clientToolResults,
              ],
              tools: getToolsDefinition(),
              temperature: 0.7,
            }),
          });
          
          if (finalClientResponse.ok) {
            const finalClientData = await finalClientResponse.json();
            const finalClientChoice = finalClientData.choices[0];
            
            console.log('[DeepSeek] Final AI response after enforced getClientsTool:', finalClientChoice.message.content);
            
            return {
              content: finalClientChoice.message.content || '',
              toolCalls: clientToolCalls,
            };
          }
        }
      }
    }
    
    // Return regular text response
    return {
      content: choice.message.content || '',
    };
  } catch (error: any) {
    console.error('Error sending message to DeepSeek:', error);
    throw error;
  }
};
