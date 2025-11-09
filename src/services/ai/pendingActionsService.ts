import { supabase } from '../supabaseClient';

export type PendingActionType = 'expense' | 'income' | 'invoice' | 'query' | 'project' | 'client' | 'budget';

export interface PendingAction {
  id: string;
  conversation_id: string;
  user_id: string;
  action_type: PendingActionType;
  action_data: Record<string, any>;
  confidence_score?: number;
  user_confirmed: boolean;
  executed_at?: string;
  created_at: string;
}

/**
 * Create a pending action (preview that needs user confirmation)
 */
export const createPendingAction = async (
  conversationId: string,
  userId: string,
  actionType: PendingActionType,
  actionData: Record<string, any>,
  confidenceScore?: number
): Promise<PendingAction> => {
  const { data, error } = await supabase
    .from('chat_pending_actions')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      action_type: actionType,
      action_data: actionData,
      confidence_score: confidenceScore,
      user_confirmed: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as PendingAction;
};

/**
 * Get pending actions for a conversation
 */
export const getPendingActions = async (
  conversationId: string
): Promise<PendingAction[]> => {
  const { data, error } = await supabase
    .from('chat_pending_actions')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_confirmed', false)
    .is('executed_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as PendingAction[];
};

/**
 * Get a specific pending action
 */
export const getPendingAction = async (actionId: string): Promise<PendingAction> => {
  const { data, error } = await supabase
    .from('chat_pending_actions')
    .select('*')
    .eq('id', actionId)
    .single();

  if (error) throw error;
  return data as PendingAction;
};

/**
 * Confirm a pending action (user clicked "Create")
 * Sets user_confirmed to true and executed_at timestamp
 */
export const confirmPendingAction = async (actionId: string): Promise<PendingAction> => {
  const { data, error } = await supabase
    .from('chat_pending_actions')
    .update({
      user_confirmed: true,
      executed_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .select()
    .single();

  if (error) throw error;
  return data as PendingAction;
};

/**
 * Cancel a pending action (user clicked "Cancel")
 * Delete the pending action
 */
export const cancelPendingAction = async (actionId: string): Promise<void> => {
  const { error } = await supabase
    .from('chat_pending_actions')
    .delete()
    .eq('id', actionId);

  if (error) throw error;
};

/**
 * Get latest pending action for a conversation (for showing preview)
 */
export const getLatestPendingAction = async (
  conversationId: string
): Promise<PendingAction | null> => {
  const { data, error } = await supabase
    .from('chat_pending_actions')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_confirmed', false)
    .is('executed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(); // Use maybeSingle() instead of single() to handle empty results gracefully

  if (error) {
    throw error;
  }

  return data as PendingAction | null;
};
