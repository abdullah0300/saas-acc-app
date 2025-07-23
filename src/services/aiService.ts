// FRONTEND: src/services/aiService.ts
import { supabase } from './supabaseClient';

export interface AISuggestion {
  category?: string;
  confidence: number;
  reason: string;
}

interface UserPatternCache {
  userId: string;
  patterns: {
    keywordMap: Record<string, { category: string; confidence: number }>;
    topCategories: string[];
  };
  timestamp: number;
}

export class AIService {
  private static patternCache: UserPatternCache | null = null;
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  // Get instant suggestion using cached patterns
  static getInstantSuggestion(
    description: string,
    existingCategories: Array<{id: string, name: string}>
  ): AISuggestion | null {
    if (!this.patternCache || this.isCacheExpired()) {
      return null;
    }

    const desc = description.toLowerCase().trim();
    const categoryNames = existingCategories.map(c => c.name);

    // Check direct category name match
    for (const category of categoryNames) {
      if (desc.includes(category.toLowerCase())) {
        return {
          category: category,
          confidence: 0.9,
          reason: "Direct match"
        };
      }
    }

    // Check personal keyword patterns
    const words = desc.split(' ').filter((word: string) => word.length > 2);
    const matches: Array<{ category: string; confidence: number }> = [];

    words.forEach((word: string) => {
      const pattern = this.patternCache!.patterns.keywordMap[word];
      if (pattern && categoryNames.includes(pattern.category)) {
        matches.push({
          category: pattern.category,
          confidence: pattern.confidence
        });
      }
    });

    if (matches.length > 0) {
      const bestMatch = matches.reduce((a, b) => a.confidence > b.confidence ? a : b);
      if (bestMatch.confidence > 0.6) {
        return {
          category: bestMatch.category,
          confidence: bestMatch.confidence,
          reason: "Personal pattern"
        };
      }
    }

    return null;
  }

  // Main AI suggestion method with instant fallback
  static async getExpenseCategorySuggestions(
    amount: number,
    description: string,
    vendor: string = '',
    existingCategories: Array<{id: string, name: string}> = []
  ): Promise<AISuggestion> {
    try {
      // Load user patterns if not cached
      await this.ensurePatternCache();

      // Try instant suggestion first
      const instantSuggestion = this.getInstantSuggestion(description, existingCategories);
      if (instantSuggestion) {
        // Show instant result, but still call AI in background for learning
        this.callAIInBackground(amount, description, vendor, existingCategories);
        return instantSuggestion;
      }

      // Fall back to AI call
      return await this.callAIService(amount, description, vendor, existingCategories);

    } catch (error) {
      console.error('AI suggestion error:', error);
      return this.getBasicFallback(existingCategories);
    }
  }

  // Ensure user patterns are cached
  private static async ensurePatternCache() {
    if (this.patternCache && !this.isCacheExpired()) {
      return; // Cache is valid
    }

    const { data: user } = await supabase.auth.getUser();
    if (!user.user?.id) return;

    try {
      // Load user's recent interaction patterns
      const { data: interactions } = await supabase
        .from('ai_interactions')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('action_type', 'expense_category')
        .eq('outcome', 'accepted')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!interactions || interactions.length === 0) {
        this.patternCache = {
          userId: user.user.id,
          patterns: { keywordMap: {}, topCategories: [] },
          timestamp: Date.now()
        };
        return;
      }

      // Build keyword mapping
      const keywordMap: Record<string, Record<string, number>> = {};
      const categoryFreq: Record<string, number> = {};

      interactions.forEach(interaction => {
        if (interaction.user_choice && interaction.context_data?.description) {
          const description = interaction.context_data.description.toLowerCase();
          const category = interaction.user_choice;
          
          categoryFreq[category] = (categoryFreq[category] || 0) + 1;
          
          const words = description.split(' ').filter((w: string) => w.length > 2);
          words.forEach((word: string) => {
            if (!keywordMap[word]) keywordMap[word] = {};
            keywordMap[word][category] = (keywordMap[word][category] || 0) + 1;
          });
        }
      });

      // Convert to confidence patterns
      const personalKeywords: Record<string, { category: string; confidence: number }> = {};
      Object.keys(keywordMap).forEach(keyword => {
        const categories = keywordMap[keyword];
        const total = Object.values(categories).reduce((a, b) => a + b, 0);
        const topCategory = Object.keys(categories).reduce((a, b) => 
          categories[a] > categories[b] ? a : b
        );
        
        personalKeywords[keyword] = {
          category: topCategory,
          confidence: categories[topCategory] / total
        };
      });

      // Get top categories
      const topCategories = Object.keys(categoryFreq)
        .sort((a, b) => categoryFreq[b] - categoryFreq[a])
        .slice(0, 5);

      this.patternCache = {
        userId: user.user.id,
        patterns: {
          keywordMap: personalKeywords,
          topCategories
        },
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Error caching patterns:', error);
    }
  }

  // Call AI service
  private static async callAIService(
    amount: number,
    description: string,
    vendor: string,
    existingCategories: Array<{id: string, name: string}>
  ): Promise<AISuggestion> {
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
  }

  // Background AI call for learning (fire and forget)
  private static callAIInBackground(
    amount: number,
    description: string,
    vendor: string,
    existingCategories: Array<{id: string, name: string}>
  ) {
    // Don't await this - let it run in background
    this.callAIService(amount, description, vendor, existingCategories)
      .catch(error => console.log('Background AI call failed:', error));
  }

  // Basic fallback
  private static getBasicFallback(
    existingCategories: Array<{id: string, name: string}>
  ): AISuggestion {
    if (this.patternCache && this.patternCache.patterns.topCategories.length > 0) {
      const topCategory = this.patternCache.patterns.topCategories[0];
      const categoryExists = existingCategories.find(c => c.name === topCategory);
      
      if (categoryExists) {
        return {
          category: topCategory,
          confidence: 0.6,
          reason: "Your most used category"
        };
      }
    }

    if (existingCategories.length > 0) {
      return {
        category: existingCategories[0].name,
        confidence: 0.4,
        reason: "Default category"
      };
    }

    return { confidence: 0, reason: 'No categories available' };
  }

  // Check if cache is expired
  private static isCacheExpired(): boolean {
    return !this.patternCache || 
           (Date.now() - this.patternCache.timestamp) > this.CACHE_DURATION;
  }

  // Preload patterns (call this when expense form loads)
  static async preloadUserPatterns() {
    await this.ensurePatternCache();
  }

  // Clear cache (call when user makes new categorization)
  static clearPatternCache() {
    this.patternCache = null;
  }

  // Log user choice
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

      // Clear cache so it refreshes with new data
      this.clearPatternCache();
      
    } catch (error) {
      console.error('Error logging user choice:', error);
    }
  }
}