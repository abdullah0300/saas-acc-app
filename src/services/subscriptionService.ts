// src/services/subscriptionService.ts
import { supabase } from './supabaseClient';

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'simple_start' | 'essentials' | 'plus';
  interval: 'monthly' | 'yearly';
  status: string;
  trial_end: string;
  current_period_end: string;
}

// Plan limits configuration
const PLAN_USER_LIMITS = {
  simple_start: 1,
  essentials: 3,
  plus: 10
};

class SubscriptionService {
  private userSubscription: Subscription | null = null;

  async loadUserSubscription(userId: string) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No subscription found - create a default one
          console.log('No subscription found, creating default...');
          
          const { data: newSub, error: createError } = await supabase
            .from('subscriptions')
            .insert([{
              user_id: userId,
              plan: 'simple_start',
              interval: 'monthly',
              status: 'active',
              trial_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }])
            .select()
            .single();
            
          if (createError) {
            console.error('Error creating subscription:', createError);
            return null;
          }
          
          this.userSubscription = newSub;
          return newSub;
        }
        throw error;
      }
      
      this.userSubscription = data;
      return data;
    } catch (error) {
      console.error('Error loading subscription:', error);
      return null;
    }
  }

  getCurrentPlan() {
    return this.userSubscription?.plan || 'simple_start';
  }

  getUserLimit(): number {
    const plan = this.getCurrentPlan();
    return PLAN_USER_LIMITS[plan] || 1;
  }

  async checkUserLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    try {
      // Get current team members count - count only active users
      const { count, error } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', userId)
        .eq('status', 'active');

      if (error) {
        console.error('Error counting team members:', error);
        // If there's an error, assume user is the only member
        const limit = this.getUserLimit();
        return {
          allowed: limit > 1, // If limit is more than 1, they can add users
          current: 1,
          limit: limit
        };
      }

      const currentCount = count || 1; // At least 1 (the owner)
      const limit = this.getUserLimit();

      return {
        allowed: currentCount < limit,
        current: currentCount,
        limit: limit
      };
    } catch (error) {
      console.error('Error checking user limit:', error);
      // Return safe defaults
      const limit = this.getUserLimit();
      return { 
        allowed: limit > 1, 
        current: 1, 
        limit: limit 
      };
    }
  }

  canAddUsers(): boolean {
    const limit = this.getUserLimit();
    return limit > 1; // Only plans above simple_start can add users
  }

  isInTrial(): boolean {
    if (!this.userSubscription) return false;
    const trialEnd = new Date(this.userSubscription.trial_end);
    return trialEnd > new Date() && this.userSubscription.status === 'trialing';
  }

  getDaysLeftInTrial(): number {
    if (!this.isInTrial() || !this.userSubscription) return 0;
    const trialEnd = new Date(this.userSubscription.trial_end);
    const now = new Date();
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  }

  getPlanDisplayName(plan?: string): string {
    const currentPlan = plan || this.getCurrentPlan();
    const displayNames: Record<string, string> = {
      simple_start: 'Simple Start',
      essentials: 'Essentials',
      plus: 'Plus'
    };
    return displayNames[currentPlan] || 'Simple Start';
  }
}

export const subscriptionService = new SubscriptionService();