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

// Import income tools
import { createIncomeTool, getIncomeTool, updateIncomeTool } from './tools/income/incomeTools';

// Import instructions
import { sharedInstructions } from './instructions/shared';
import { incomeInstructions } from './instructions/income';

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

    // Income tools
    {
      type: 'function',
      function: {
        name: 'createIncomeTool',
        description: 'Creates a new income record. Shows preview to user before saving. Category and client are optional.',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Income amount (NET, before tax)' },
            description: { type: 'string', description: 'Description of the income' },
            date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            category_name: { type: 'string', description: 'Category name (optional)' },
            client_name: { type: 'string', description: 'Client name (optional)' },
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
        description: 'Retrieves income records with optional filters. Use parsed dates from parseDateQueryTool for date filters.',
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
            reference_number: { type: 'string', description: 'New reference number' },
            tax_rate: { type: 'number', description: 'New tax rate' },
            currency: { type: 'string', description: 'New currency code' },
          },
          required: ['income_id'],
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

    return `${sharedInstructions}\n\n${incomeInstructions}\n\n${userContext}`.trim();
  } catch (error) {
    console.error('Error building system prompt:', error);
    return `${sharedInstructions}\n\n${incomeInstructions}`.trim();
  }
};

/**
 * Execute tool call
 */
const executeToolCall = async (
  toolName: string,
  args: any,
  userId: string,
  conversationId: string
): Promise<any> => {
  console.log(`[DeepSeek] Executing tool: ${toolName}`, args);

  try {
    switch (toolName) {
      // Date tool
      case 'parseDateQueryTool':
        return await parseDateQueryTool(args.dateQuery);

      // Income tools
      case 'createIncomeTool':
        return await createIncomeTool(userId, conversationId, args);
      case 'getIncomeTool':
        return await getIncomeTool(userId, args);
      case 'updateIncomeTool':
        return await updateIncomeTool(userId, conversationId, args);

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

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    console.error(`[DeepSeek] Tool execution error:`, error);
    return { error: error.message || 'Tool execution failed' };
  }
};

/**
 * Main chat function
 */
export const sendMessageToDeepSeek = async (
  messages: ChatMessage[],
  userId: string,
  conversationId: string
): Promise<{ content: string; tool_calls?: any[] }> => {
  try {
    const apiKey = await getDeepSeekApiKey();
    const systemPrompt = await buildSystemPrompt(userId);

    // Build messages array
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-5).map((msg) => ({
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

    // Check for tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log('[DeepSeek] Tool calls detected:', assistantMessage.tool_calls.length);

      const toolResults: { toolName: string; result: any }[] = [];

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        const result = await executeToolCall(toolName, toolArgs, userId, conversationId);
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

    // No tool calls - return response directly
    return {
      content: assistantMessage.content || 'I can help you manage your income records!',
    };
  } catch (error: any) {
    console.error('[DeepSeek] Error:', error);
    throw error;
  }
};
