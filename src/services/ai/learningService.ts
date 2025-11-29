import { supabase } from '../supabaseClient';
import { getEffectiveUserId } from '../database';

/**
 * AI Learning Service
 * Tracks user interactions and builds intelligent patterns for suggestions
 */

export interface UserInteraction {
  id?: string;
  user_id: string;
  interaction_type: 'query' | 'correction' | 'confirmation' | 'rejection';
  query_text?: string;
  ai_response?: string;
  entity_type?: 'income' | 'expense' | 'invoice' | 'client' | 'category' | 'project' | 'budget';
  entity_id?: string;
  ai_suggested_value?: any;
  user_chosen_value?: any;
  context_data?: any;
  created_at?: string;
}

export interface LearnedPatterns {
  expense_patterns?: Record<string, {
    category_id: string;
    category_name: string;
    frequency: number;
    confidence: number;
  }>;
  income_patterns?: Record<string, {
    typical_amount: number;
    typical_category_id?: string;
    typical_category_name?: string;
    typical_description?: string;
    typical_tax_rate?: number;
    frequency: number;
    last_amount: number;
    last_date: string;
    confidence: number;
  }>;
  common_queries?: Array<{ query: string; count: number }>;
  description_templates?: Array<{ description: string; count: number; category_id?: string }>;
}

export interface ClientSuggestions {
  amount?: number;
  category_id?: string;
  category_name?: string;
  description?: string;
  tax_rate?: number;
  confidence: number;
}

export class AILearningService {
  /**
   * Log a user interaction for learning
   */
  static async logInteraction(params: UserInteraction): Promise<void> {
    try {
      const effectiveUserId = await getEffectiveUserId(params.user_id);

      await supabase.from('ai_user_interactions').insert({
        user_id: effectiveUserId,
        interaction_type: params.interaction_type,
        query_text: params.query_text,
        ai_response: params.ai_response,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        ai_suggested_value: params.ai_suggested_value,
        user_chosen_value: params.user_chosen_value,
        context_data: params.context_data,
      });

      console.log('[AI Learning] Logged interaction:', params.interaction_type, params.entity_type);
    } catch (error) {
      console.error('[AI Learning] Error logging interaction:', error);
      // Don't throw - logging failures shouldn't break the app
    }
  }

  /**
   * Analyze patterns from user interactions
   * Call this periodically (every 50-100 interactions or daily)
   */
  static async analyzeAndLearnPatterns(userId: string): Promise<LearnedPatterns> {
    try {
      const effectiveUserId = await getEffectiveUserId(userId);

      // Get last 90 days of interactions
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: interactions, error } = await supabase
        .from('ai_user_interactions')
        .select('*')
        .eq('user_id', effectiveUserId)
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!interactions || interactions.length === 0) {
        console.log('[AI Learning] No interactions found for analysis');
        return {};
      }

      console.log(`[AI Learning] Analyzing ${interactions.length} interactions...`);

      const patterns: LearnedPatterns = {
        expense_patterns: {},
        income_patterns: {},
        common_queries: [],
        description_templates: []
      };

      // Analyze expense corrections (vendor → category)
      const expenseCorrections = interactions.filter(
        i => i.interaction_type === 'correction' && i.entity_type === 'expense'
      );

      expenseCorrections.forEach(correction => {
        const vendor = correction.context_data?.vendor;
        const correctCategoryId = correction.user_chosen_value?.category_id;
        const correctCategoryName = correction.user_chosen_value?.category_name;

        if (vendor && correctCategoryId) {
          if (!patterns.expense_patterns![vendor]) {
            patterns.expense_patterns![vendor] = {
              category_id: correctCategoryId,
              category_name: correctCategoryName,
              frequency: 0,
              confidence: 0
            };
          }
          patterns.expense_patterns![vendor].frequency++;
        }
      });

      // Calculate expense confidence scores
      Object.keys(patterns.expense_patterns!).forEach(vendor => {
        const pattern = patterns.expense_patterns![vendor];
        const totalInteractions = expenseCorrections.filter(
          i => i.context_data?.vendor === vendor
        ).length;
        pattern.confidence = totalInteractions > 0 ? pattern.frequency / totalInteractions : 0;
      });

      // Analyze income confirmations (client → typical values)
      const incomeConfirmations = interactions.filter(
        i => (i.interaction_type === 'confirmation' || i.interaction_type === 'correction') &&
            i.entity_type === 'income'
      );

      const clientData: Record<string, Array<{
        amount: number;
        category_id?: string;
        category_name?: string;
        description?: string;
        tax_rate?: number;
        date: string;
      }>> = {};

      incomeConfirmations.forEach(confirmation => {
        const clientId = confirmation.user_chosen_value?.client_id ||
                        confirmation.context_data?.client_id;
        const clientName = confirmation.user_chosen_value?.client_name ||
                          confirmation.context_data?.client_name;

        const key = clientId || clientName;

        if (!key) return;

        if (!clientData[key]) clientData[key] = [];

        clientData[key].push({
          amount: confirmation.user_chosen_value?.amount,
          category_id: confirmation.user_chosen_value?.category_id,
          category_name: confirmation.user_chosen_value?.category_name,
          description: confirmation.user_chosen_value?.description,
          tax_rate: confirmation.user_chosen_value?.tax_rate,
          date: confirmation.created_at || new Date().toISOString()
        });
      });

      // Calculate income patterns per client
      Object.keys(clientData).forEach(client => {
        const records = clientData[client];
        if (records.length === 0) return;

        const amounts = records.map(r => r.amount).filter(Boolean);
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

        // Find most common category
        const categoryFreq: Record<string, { id: string; name: string; count: number }> = {};
        records.forEach(r => {
          if (r.category_id) {
            if (!categoryFreq[r.category_id]) {
              categoryFreq[r.category_id] = {
                id: r.category_id,
                name: r.category_name || '',
                count: 0
              };
            }
            categoryFreq[r.category_id].count++;
          }
        });

        const mostCommonCategory = Object.values(categoryFreq).sort((a, b) => b.count - a.count)[0];

        // Find most common description
        const descFreq: Record<string, number> = {};
        records.forEach(r => {
          if (r.description) {
            descFreq[r.description] = (descFreq[r.description] || 0) + 1;
          }
        });
        const mostCommonDesc = Object.entries(descFreq).sort(([, a], [, b]) => b - a)[0]?.[0];

        // Find most common tax rate
        const taxRates = records.map(r => r.tax_rate).filter((t): t is number => t !== undefined && t !== null);
        const avgTaxRate = taxRates.length > 0
          ? taxRates.reduce((a, b) => a + b, 0) / taxRates.length
          : undefined;

        patterns.income_patterns![client] = {
          typical_amount: avgAmount,
          typical_category_id: mostCommonCategory?.id,
          typical_category_name: mostCommonCategory?.name,
          typical_description: mostCommonDesc,
          typical_tax_rate: avgTaxRate,
          frequency: records.length,
          last_amount: amounts[amounts.length - 1],
          last_date: records[records.length - 1].date,
          confidence: records.length >= 3 ? 0.9 : records.length >= 2 ? 0.7 : 0.5
        };
      });

      // Track common queries
      const queryFrequency: Record<string, number> = {};
      interactions
        .filter(i => i.interaction_type === 'query' && i.query_text)
        .forEach(i => {
          const query = i.query_text!.toLowerCase().trim();
          queryFrequency[query] = (queryFrequency[query] || 0) + 1;
        });

      patterns.common_queries = Object.entries(queryFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([query, count]) => ({ query, count }));

      // Track description templates
      const descriptionFreq: Record<string, { count: number; category_id?: string }> = {};
      incomeConfirmations.forEach(confirmation => {
        const desc = confirmation.user_chosen_value?.description;
        const catId = confirmation.user_chosen_value?.category_id;
        if (desc) {
          if (!descriptionFreq[desc]) {
            descriptionFreq[desc] = { count: 0, category_id: catId };
          }
          descriptionFreq[desc].count++;
        }
      });

      patterns.description_templates = Object.entries(descriptionFreq)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .map(([description, data]) => ({
          description,
          count: data.count,
          category_id: data.category_id
        }));

      // Save patterns to user_settings
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ ai_learned_patterns: patterns })
        .eq('user_id', effectiveUserId);

      if (updateError) throw updateError;

      console.log('[AI Learning] Patterns updated:', {
        expense_patterns: Object.keys(patterns.expense_patterns!).length,
        income_patterns: Object.keys(patterns.income_patterns!).length,
        common_queries: patterns.common_queries!.length
      });

      return patterns;
    } catch (error) {
      console.error('[AI Learning] Error analyzing patterns:', error);
      return {};
    }
  }

  /**
   * Get learned patterns for a user
   */
  static async getLearnedPatterns(userId: string): Promise<LearnedPatterns> {
    try {
      const effectiveUserId = await getEffectiveUserId(userId);

      const { data, error } = await supabase
        .from('user_settings')
        .select('ai_learned_patterns')
        .eq('user_id', effectiveUserId)
        .single();

      if (error) {
        console.error('[AI Learning] Error fetching patterns:', error);
        return {};
      }

      return data?.ai_learned_patterns || {};
    } catch (error) {
      console.error('[AI Learning] Error getting patterns:', error);
      return {};
    }
  }

  /**
   * Get suggestions for a specific client (for Income Form)
   */
  static async getSuggestionsForClient(
    userId: string,
    clientId: string
  ): Promise<ClientSuggestions | null> {
    try {
      const patterns = await this.getLearnedPatterns(userId);

      if (!patterns.income_patterns) return null;

      const clientPattern = patterns.income_patterns[clientId];

      if (!clientPattern) return null;

      return {
        amount: clientPattern.typical_amount,
        category_id: clientPattern.typical_category_id,
        category_name: clientPattern.typical_category_name,
        description: clientPattern.typical_description,
        tax_rate: clientPattern.typical_tax_rate,
        confidence: clientPattern.confidence
      };
    } catch (error) {
      console.error('[AI Learning] Error getting client suggestions:', error);
      return null;
    }
  }

  /**
   * Get category suggestion for a vendor (for Expense Form)
   */
  static async getSuggestionsForVendor(
    userId: string,
    vendorName: string
  ): Promise<{ category_id: string; category_name: string; confidence: number } | null> {
    try {
      const patterns = await this.getLearnedPatterns(userId);

      if (!patterns.expense_patterns) return null;

      const vendorPattern = patterns.expense_patterns[vendorName];

      if (!vendorPattern) return null;

      return {
        category_id: vendorPattern.category_id,
        category_name: vendorPattern.category_name,
        confidence: vendorPattern.confidence
      };
    } catch (error) {
      console.error('[AI Learning] Error getting vendor suggestions:', error);
      return null;
    }
  }

  /**
   * Get common descriptions for autocomplete
   */
  static async getDescriptionSuggestions(userId: string): Promise<string[]> {
    try {
      const patterns = await this.getLearnedPatterns(userId);

      if (!patterns.description_templates) return [];

      return patterns.description_templates
        .sort((a, b) => b.count - a.count)
        .map(t => t.description);
    } catch (error) {
      console.error('[AI Learning] Error getting description suggestions:', error);
      return [];
    }
  }

  /**
   * Get acceptance and rejection history for smart AI suggestions
   * Returns last 50 acceptances and 50 rejections to help AI learn
   */
  static async getAcceptanceRejectionHistory(
    userId: string,
    entityType: 'income' | 'expense'
  ): Promise<{
    acceptances: Array<{ description: string; ai_suggested: any; user_chose: any; context?: any }>;
    rejections: Array<{ description: string; ai_suggested: any; user_chose: any; context?: any }>;
  }> {
    try {
      const effectiveUserId = await getEffectiveUserId(userId);

      // Get last 50 confirmations (acceptances)
      const { data: confirmations } = await supabase
        .from('ai_user_interactions')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('entity_type', entityType)
        .eq('interaction_type', 'confirmation')
        .order('created_at', { ascending: false })
        .limit(50);

      // Get last 50 rejections
      const { data: rejections } = await supabase
        .from('ai_user_interactions')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('entity_type', entityType)
        .eq('interaction_type', 'rejection')
        .order('created_at', { ascending: false })
        .limit(50);

      return {
        acceptances: (confirmations || []).map(c => ({
          description: c.context_data?.description || '',
          ai_suggested: c.ai_suggested_value,
          user_chose: c.user_chosen_value,
          context: c.context_data
        })),
        rejections: (rejections || []).map(r => ({
          description: r.context_data?.description || '',
          ai_suggested: r.ai_suggested_value,
          user_chose: r.user_chosen_value,
          context: r.context_data
        }))
      };
    } catch (error) {
      console.error('[AI Learning] Error getting acceptance/rejection history:', error);
      return { acceptances: [], rejections: [] };
    }
  }

  /**
   * Trigger pattern analysis if needed
   * Call this after every N interactions (e.g., 50)
   */
  static async maybeAnalyzePatterns(userId: string): Promise<void> {
    try {
      const effectiveUserId = await getEffectiveUserId(userId);

      // Check when last analysis was done
      const { data: settings } = await supabase
        .from('user_settings')
        .select('ai_preferences')
        .eq('user_id', effectiveUserId)
        .single();

      const lastAnalysis = settings?.ai_preferences?.last_analysis_date;
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Run analysis if:
      // 1. Never analyzed before, OR
      // 2. Last analysis was > 24 hours ago
      if (!lastAnalysis || new Date(lastAnalysis) < oneDayAgo) {
        console.log('[AI Learning] Triggering pattern analysis...');
        await this.analyzeAndLearnPatterns(userId);

        // Update last analysis timestamp
        await supabase
          .from('user_settings')
          .update({
            ai_preferences: {
              ...settings?.ai_preferences,
              last_analysis_date: now.toISOString()
            }
          })
          .eq('user_id', effectiveUserId);
      }
    } catch (error) {
      console.error('[AI Learning] Error in maybeAnalyzePatterns:', error);
    }
  }
}

export default AILearningService;
