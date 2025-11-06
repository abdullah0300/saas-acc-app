import { supabase } from '../supabaseClient';

export interface AICredits {
  id: string;
  user_id: string;
  credits_used_today: number;
  daily_limit: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get credits info for a user
 * Creates credits record if it doesn't exist
 */
export const getCredits = async (userId: string): Promise<AICredits> => {
  // Check if credits record exists
  const { data: existing, error: fetchError } = await supabase
    .from('ai_credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is fine
    throw fetchError;
  }

  // If exists, reset if needed and return
  if (existing) {
    const today = new Date().toISOString().split('T')[0];
    if (existing.last_reset_date < today) {
      // Reset credits for new day
      const { data: reset, error: resetError } = await supabase
        .from('ai_credits')
        .update({
          credits_used_today: 0,
          last_reset_date: today,
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (resetError) throw resetError;
      return reset as AICredits;
    }
    return existing as AICredits;
  }

  // Create new credits record
  const { data: newCredits, error: createError } = await supabase
    .from('ai_credits')
    .insert({
      user_id: userId,
      credits_used_today: 0,
      daily_limit: 50, // Default, can be based on subscription plan
      last_reset_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (createError) throw createError;
  return newCredits as AICredits;
};

/**
 * Check if user has credits remaining
 */
export const checkCredits = async (userId: string): Promise<boolean> => {
  const credits = await getCredits(userId);
  return credits.credits_used_today < credits.daily_limit;
};

/**
 * Get remaining credits count
 */
export const getCreditsRemaining = async (userId: string): Promise<number> => {
  const credits = await getCredits(userId);
  return Math.max(0, credits.daily_limit - credits.credits_used_today);
};

/**
 * Use one credit (increment credits_used_today)
 * Returns true if credit was used, false if no credits left
 */
export const useCredit = async (userId: string): Promise<boolean> => {
  // First check if user has credits
  const hasCredits = await checkCredits(userId);
  if (!hasCredits) {
    return false;
  }

  // Reset if new day
  await getCredits(userId); // This will auto-reset if needed

  // Increment credits used
  const { error } = await supabase.rpc('increment_ai_credit', {
    user_id_param: userId,
  });

  // If RPC doesn't exist, use direct update
  if (error) {
    const credits = await getCredits(userId);
    const { error: updateError } = await supabase
      .from('ai_credits')
      .update({
        credits_used_today: credits.credits_used_today + 1,
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;
  }

  return true;
};

/**
 * Reset credits for all users (typically called daily via cron)
 * This is a helper function, actual reset should be done via database function
 */
export const resetDailyCredits = async (): Promise<void> => {
  const { error } = await supabase.rpc('reset_daily_credits');
  if (error) throw error;
};
