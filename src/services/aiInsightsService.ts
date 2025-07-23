// FILE: src/services/aiInsightsService.ts
import { supabase } from './supabaseClient';

export interface Insight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'urgent';
  category: 'cash_flow' | 'collections' | 'spending' | 'revenue' | 'clients' | 'strategy';
  title: string;
  message: string;
  priority: number;
  action?: {
    label: string;
    link: string;
  };
}

export interface InsightsResponse {
  insights: Insight[];
  generated_at: string;
  source: 'cache' | 'smart_logic' | 'ai';
  needsContext?: boolean;  // ADD this
  missingFields?: any[];   // ADD this
  message?: string;
}

export class AIInsightsService {
  private static cache: {
    data: InsightsResponse | null;
    timestamp: number;
  } = {
    data: null,
    timestamp: 0
  };

  private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  // Get insights (with caching)
  static async getInsights(forceRefresh = false): Promise<InsightsResponse> {
    try {
      // Check if we have valid cache
      if (!forceRefresh && this.isCacheValid()) {
        console.log('✅ Using cached insights');
        return this.cache.data!;
      }

      console.log('🔄 Fetching fresh insights...');
      
      // Get current user
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) {
        throw new Error('User not authenticated');
      }

      // Call AI assistant for insights
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          userId: user.user.id,
          feature: 'get_insights'
        }
      });

      if (error) throw error;

      // Cache the result
      this.cache = {
        data: data,
        timestamp: Date.now()
      };

      console.log('✅ Insights fetched and cached');
      return data;

    } catch (error) {
      console.error('Error getting insights:', error);
      
      // Return fallback insights if API fails
      return this.getFallbackInsights();
    }
  }

  // ADD these methods to your AIInsightsService class:

// Check what context is missing
static async getMissingContext(): Promise<any> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user?.id) throw new Error('User not authenticated');

    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        userId: user.user.id,
        feature: 'get_missing_context'
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting missing context:', error);
    return { hasAllContext: true, missingFields: [] };
  }
}

// Update user context
static async updateUserContext(contextData: any): Promise<any> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user?.id) throw new Error('User not authenticated');

    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        userId: user.user.id,
        feature: 'update_user_context',
        data: contextData
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating context:', error);
    throw error;
  }
}

  // Force regenerate insights
  static async regenerateInsights(): Promise<InsightsResponse> {
    try {
      console.log('🔄 Regenerating insights...');
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) {
        throw new Error('User not authenticated');
      }

      // Call AI assistant to generate fresh insights
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          userId: user.user.id,
          feature: 'generate_insights'
        }
      });

      if (error) throw error;

      // Update cache
      this.cache = {
        data: data,
        timestamp: Date.now()
      };

      console.log('✅ Insights regenerated');
      return data;

    } catch (error) {
      console.error('Error regenerating insights:', error);
      return this.getFallbackInsights();
    }
  }

  // Trigger insights refresh when user makes transactions
  static async refreshInsightsOnTransaction(transactionType: 'expense' | 'income' | 'invoice') {
    console.log(`🔄 Transaction detected: ${transactionType}, refreshing insights...`);
    
    // Invalidate cache
    this.cache.timestamp = 0;
    
    // Don't await - let it run in background
    this.getInsights(true).catch(error => 
      console.error('Background insight refresh failed:', error)
    );
  }

  // Check cache validity
  private static isCacheValid(): boolean {
    return (
      this.cache.data !== null &&
      (Date.now() - this.cache.timestamp) < this.CACHE_DURATION
    );
  }

  // Fallback insights when API fails
  private static getFallbackInsights(): InsightsResponse {
    return {
      insights: [
        {
          id: 'system-offline',
          type: 'info',
          category: 'cash_flow',
          title: 'Insights Temporarily Unavailable',
          message: 'AI insights are being updated. Your data is safe and insights will return shortly.',
          priority: 1
        }
      ],
      generated_at: new Date().toISOString(),
      source: 'cache'
    };
  }

  // Clear cache (useful for testing)
  static clearCache() {
    this.cache = {
      data: null,
      timestamp: 0
    };
  }
}