import { supabase } from './supabaseClient';

export interface AISuggestion {
  category?: string;
  confidence: number;
  reason: string;
}

export class AIService {
  // Get AI suggestions for expense categorization
  static async getExpenseCategorySuggestions(
    amount: number,
    description: string,
    vendor: string = '',
    existingCategories: Array<{id: string, name: string}> = []
  ): Promise<AISuggestion> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          userId: (await supabase.auth.getUser()).data.user?.id,
          feature: 'expense_category',
          data: { 
            amount, 
            description, 
            vendor,
            existingCategories: existingCategories.map(cat => cat.name)
          }
        }
      });

      if (error) throw error;
      return data.suggestions || { confidence: 0, reason: 'No suggestions available' };
      
    } catch (error) {
      console.error('AI suggestion error:', error);
      return { confidence: 0, reason: 'AI service unavailable' };
    }
  }

  // Log user's choice for future learning
  static async logUserChoice(
    feature: string,
    aiSuggestion: string,
    userChoice: string,
    context: any
  ) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) return;

      await supabase.from('ai_interactions').insert({
        user_id: user.user.id,
        action_type: feature,
        context_data: context,
        ai_suggestion: aiSuggestion,
        user_choice: userChoice,
        outcome: userChoice === aiSuggestion ? 'accepted' : 'rejected'
      });
      
    } catch (error) {
      console.error('Error logging user choice:', error);
    }
  }
}