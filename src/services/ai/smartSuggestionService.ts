/**
 * Smart AI Suggestion Service
 * Provides intelligent category suggestions by combining:
 * 1. User's learned patterns (from database)
 * 2. Acceptance/rejection history (what AI got right/wrong)
 * 3. DeepSeek AI analysis (with full context)
 */

import { supabase } from '../supabaseClient';
import { AILearningService } from './learningService';

export interface SmartSuggestion {
  category_id?: string;
  category_name?: string;
  vendor_name?: string;
  client_name?: string;
  amount?: number;
  tax_rate?: number;
  confidence: number;
  reason: string;
}

interface Category {
  id: string;
  name: string;
  type?: string;
}

export class SmartSuggestionService {
  /**
   * Get DeepSeek API key
   */
  private static async getDeepSeekApiKey(): Promise<string> {
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
  }

  /**
   * Get smart expense category suggestion
   */
  static async getExpenseSuggestion(
    userId: string,
    description: string,
    amount: string,
    vendor: string,
    categories: Category[]
  ): Promise<SmartSuggestion> {
    try {
      console.log('[Smart Suggestion] Getting expense suggestion for:', { description, amount, vendor });

      // 1. Load learned patterns
      const patterns = await AILearningService.getLearnedPatterns(userId);

      // 2. Load acceptance/rejection history
      const history = await AILearningService.getAcceptanceRejectionHistory(userId, 'expense');

      // 3. Build context for AI
      const context = this.buildExpenseContext(description, amount, vendor, categories, patterns, history);

      // 4. Call DeepSeek AI
      const apiKey = await this.getDeepSeekApiKey();
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: context.systemPrompt },
            { role: 'user', content: context.userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      console.log('[Smart Suggestion] AI response:', aiResponse);

      // 5. Parse AI response
      return this.parseExpenseResponse(aiResponse, categories);
    } catch (error) {
      console.error('[Smart Suggestion] Error:', error);
      return {
        confidence: 0,
        reason: 'Unable to get suggestion at this time'
      };
    }
  }

  /**
   * Get smart income suggestion
   */
  static async getIncomeSuggestion(
    userId: string,
    description: string,
    amount: string,
    clientName: string,
    categories: Category[]
  ): Promise<SmartSuggestion> {
    try {
      console.log('[Smart Suggestion] Getting income suggestion for:', { description, amount, clientName });

      // 1. Load learned patterns
      const patterns = await AILearningService.getLearnedPatterns(userId);

      // 2. Load acceptance/rejection history
      const history = await AILearningService.getAcceptanceRejectionHistory(userId, 'income');

      // 3. Build context for AI
      const context = this.buildIncomeContext(description, amount, clientName, categories, patterns, history);

      // 4. Call DeepSeek AI
      const apiKey = await this.getDeepSeekApiKey();
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: context.systemPrompt },
            { role: 'user', content: context.userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      console.log('[Smart Suggestion] AI response:', aiResponse);

      // 5. Parse AI response
      return this.parseIncomeResponse(aiResponse, categories);
    } catch (error) {
      console.error('[Smart Suggestion] Error:', error);
      return {
        confidence: 0,
        reason: 'Unable to get suggestion at this time'
      };
    }
  }

  /**
   * Build context for expense suggestion
   */
  private static buildExpenseContext(
    description: string,
    amount: string,
    vendor: string,
    categories: Category[],
    patterns: any,
    history: any
  ) {
    // Build vendor patterns summary
    let vendorPatterns = '';
    if (patterns.expense_patterns && Object.keys(patterns.expense_patterns).length > 0) {
      vendorPatterns = '\n**Your Vendor Patterns:**\n';
      Object.entries(patterns.expense_patterns).forEach(([vendorName, pattern]: [string, any]) => {
        if (pattern.confidence > 0.5) {
          vendorPatterns += `- "${vendorName}" → ${pattern.category_name} (${pattern.frequency}x, ${(pattern.confidence * 100).toFixed(0)}% confident)\n`;
        }
      });
    }

    // Build acceptance history summary
    let acceptancesSummary = '';
    if (history.acceptances && history.acceptances.length > 0) {
      acceptancesSummary = '\n**What You Accepted Before (AI got it RIGHT):**\n';
      history.acceptances.slice(0, 10).forEach((acc: any) => {
        if (acc.description && acc.user_chose?.category_name) {
          acceptancesSummary += `- "${acc.description}" → ${acc.user_chose.category_name} ✓\n`;
        }
      });
    }

    // Build rejection history summary
    let rejectionsSummary = '';
    if (history.rejections && history.rejections.length > 0) {
      rejectionsSummary = '\n**What You Rejected Before (AI got it WRONG):**\n';
      history.rejections.slice(0, 10).forEach((rej: any) => {
        if (rej.description && rej.ai_suggested?.category_name && rej.user_chose?.category_name) {
          rejectionsSummary += `- "${rej.description}" → AI said "${rej.ai_suggested.category_name}" but you chose "${rej.user_chose.category_name}" ✗\n`;
        }
      });
    }

    const systemPrompt = `You are a smart expense categorization assistant. Your job is to suggest the BEST category for this user's expense based on their PERSONAL history and preferences.

AVAILABLE CATEGORIES:
${categories.map(c => `- ${c.name}`).join('\n')}
${vendorPatterns}${acceptancesSummary}${rejectionsSummary}

RULES:
1. ALWAYS prioritize user's past choices over generic assumptions
2. If vendor matches a learned pattern with high confidence (>85%), strongly suggest that category
3. Learn from rejections - don't repeat mistakes AI made before
4. If description is similar to accepted suggestions, use same category
5. Return ONLY ONE category suggestion with confidence 0-100

RESPONSE FORMAT (JSON only):
{
  "category": "Category Name",
  "confidence": 85,
  "reason": "Brief explanation referencing user's history"
}`;

    const userPrompt = `Expense to categorize:
- Description: "${description}"
- Amount: $${amount}
${vendor ? `- Vendor: "${vendor}"` : ''}

Suggest the best category for THIS user based on their history above.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Build context for income suggestion
   */
  private static buildIncomeContext(
    description: string,
    amount: string,
    clientName: string,
    categories: Category[],
    patterns: any,
    history: any
  ) {
    // Build client patterns summary
    let clientPatterns = '';
    if (patterns.income_patterns && Object.keys(patterns.income_patterns).length > 0) {
      clientPatterns = '\n**Your Client Patterns:**\n';
      Object.entries(patterns.income_patterns).forEach(([client, pattern]: [string, any]) => {
        if (pattern.confidence > 0.5) {
          const clientDisplay = client.includes('-') ? `[Client ID]` : client;
          clientPatterns += `- ${clientDisplay}: Usually $${pattern.typical_amount.toFixed(0)}`;
          if (pattern.typical_category_name) {
            clientPatterns += ` → ${pattern.typical_category_name}`;
          }
          clientPatterns += ` (${pattern.frequency}x)\n`;
        }
      });
    }

    // Build acceptance history summary
    let acceptancesSummary = '';
    if (history.acceptances && history.acceptances.length > 0) {
      acceptancesSummary = '\n**What You Accepted Before (AI got it RIGHT):**\n';
      history.acceptances.slice(0, 10).forEach((acc: any) => {
        if (acc.description && acc.user_chose?.category_name) {
          acceptancesSummary += `- "${acc.description}" → ${acc.user_chose.category_name} ✓\n`;
        }
      });
    }

    // Build rejection history summary
    let rejectionsSummary = '';
    if (history.rejections && history.rejections.length > 0) {
      rejectionsSummary = '\n**What You Rejected Before (AI got it WRONG):**\n';
      history.rejections.slice(0, 10).forEach((rej: any) => {
        if (rej.description && rej.ai_suggested?.category_name && rej.user_chose?.category_name) {
          rejectionsSummary += `- "${rej.description}" → AI said "${rej.ai_suggested.category_name}" but you chose "${rej.user_chose.category_name}" ✗\n`;
        }
      });
    }

    const systemPrompt = `You are a smart income categorization assistant. Your job is to suggest the BEST category for this user's income based on their PERSONAL history and preferences.

AVAILABLE CATEGORIES:
${categories.map(c => `- ${c.name}`).join('\n')}
${clientPatterns}${acceptancesSummary}${rejectionsSummary}

RULES:
1. ALWAYS prioritize user's past choices over generic assumptions
2. If description matches accepted patterns, strongly suggest same category
3. Learn from rejections - don't repeat mistakes AI made before
4. Consider typical amounts and descriptions for clients
5. Return ONLY ONE category suggestion with confidence 0-100

RESPONSE FORMAT (JSON only):
{
  "category": "Category Name",
  "confidence": 85,
  "reason": "Brief explanation referencing user's history"
}`;

    const userPrompt = `Income to categorize:
- Description: "${description}"
- Amount: $${amount}
${clientName ? `- Client: "${clientName}"` : ''}

Suggest the best category for THIS user based on their history above.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse expense AI response
   */
  private static parseExpenseResponse(aiResponse: string, categories: Category[]): SmartSuggestion {
    try {
      // Try to parse JSON response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const category = categories.find(c => c.name.toLowerCase() === parsed.category?.toLowerCase());

        return {
          category_id: category?.id,
          category_name: parsed.category,
          confidence: parsed.confidence || 50,
          reason: parsed.reason || 'AI suggestion'
        };
      }
    } catch (error) {
      console.error('[Smart Suggestion] Parse error:', error);
    }

    return {
      confidence: 0,
      reason: 'Unable to parse AI response'
    };
  }

  /**
   * Parse income AI response
   */
  private static parseIncomeResponse(aiResponse: string, categories: Category[]): SmartSuggestion {
    try {
      // Try to parse JSON response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const category = categories.find(c => c.name.toLowerCase() === parsed.category?.toLowerCase());

        return {
          category_id: category?.id,
          category_name: parsed.category,
          confidence: parsed.confidence || 50,
          reason: parsed.reason || 'AI suggestion'
        };
      }
    } catch (error) {
      console.error('[Smart Suggestion] Parse error:', error);
    }

    return {
      confidence: 0,
      reason: 'Unable to parse AI response'
    };
  }
}
