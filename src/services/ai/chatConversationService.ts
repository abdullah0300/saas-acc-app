import { supabase } from '../supabaseClient';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  messages: ChatMessage[];
  current_context: Record<string, any>;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

/**
 * Create a new conversation for a user
 */
export const createConversation = async (userId: string): Promise<ChatConversation> => {
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      user_id: userId,
      messages: [],
      current_context: {},
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return data as ChatConversation;
};

/**
 * Get a conversation by ID
 */
export const getConversation = async (conversationId: string): Promise<ChatConversation> => {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Conversation not found');
    }
    throw error;
  }
  
  if (!data) {
    throw new Error('Conversation not found');
  }
  
  return data as ChatConversation;
};

/**
 * Get active conversation for a user (or create if doesn't exist)
 * NOTE: This function is deprecated - conversations should only be created when user sends first message
 * Use getUserConversations() and filter for active conversations instead
 */
export const getUserConversation = async (userId: string): Promise<ChatConversation> => {
  // Try to get active conversation with messages
  const { data: existing, error: fetchError } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  // If exists and has messages, return it
  if (existing && existing.messages && existing.messages.length > 0) {
    return existing as ChatConversation;
  }

  // Don't create empty conversation - let caller handle creation
  throw new Error('No active conversation found');
};

/**
 * Add a message to a conversation
 */
export const addMessage = async (
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<void> => {
  // Get current conversation
  const conversation = await getConversation(conversationId);

  // Add new message
  const newMessage: ChatMessage = {
    role,
    content,
    timestamp: new Date().toISOString(),
  };

  const updatedMessages = [...(conversation.messages || []), newMessage];

  // Update conversation
  const { error } = await supabase
    .from('chat_conversations')
    .update({
      messages: updatedMessages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) throw error;
};

/**
 * Update conversation context
 */
export const updateContext = async (
  conversationId: string,
  context: Record<string, any>
): Promise<void> => {
  const { error } = await supabase
    .from('chat_conversations')
    .update({
      current_context: context,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) throw error;
};

/**
 * Update conversation status
 */
export const updateConversationStatus = async (
  conversationId: string,
  status: 'active' | 'completed' | 'cancelled'
): Promise<void> => {
  const { error } = await supabase
    .from('chat_conversations')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) throw error;
};

/**
 * Get conversation history (last N messages for context)
 */
export const getConversationHistory = (
  conversation: ChatConversation,
  limit: number = 20
): ChatMessage[] => {
  const messages = conversation.messages || [];
  // Return last N messages
  return messages.slice(-limit);
};

/**
 * Get all conversations for a user (ordered by most recent)
 * Only returns conversations that have at least one message
 */
export const getUserConversations = async (userId: string): Promise<ChatConversation[]> => {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  
  // Filter out empty conversations (conversations with no messages)
  const conversations = (data || []) as ChatConversation[];
  return conversations.filter(c => c.messages && c.messages.length > 0);
};

/**
 * Get conversation title from first user message
 */
export const getConversationTitle = (conversation: ChatConversation): string => {
  const messages = conversation.messages || [];
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const title = firstUserMessage.content.slice(0, 50);
    return title.length < firstUserMessage.content.length ? title + '...' : title;
  }
  return 'New Chat';
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (conversationId: string): Promise<void> => {
  // Delete the conversation
  const { error, data } = await supabase
    .from('chat_conversations')
    .delete()
    .eq('id', conversationId)
    .select();

  if (error) {
    console.error('Delete conversation error:', error);
    throw error;
  }

  // If no rows were affected, the conversation might not exist
  // This is okay - it might have been deleted already
  if (!data || data.length === 0) {
    console.warn('No conversation found to delete:', conversationId);
    // Don't throw error - it's already deleted or doesn't exist
    return;
  }

  // Deletion succeeded
  // Note: We don't verify after deletion because Supabase might have caching
  // The deletion should work if no error was thrown
};

/**
 * Clean up empty conversations (conversations with no messages)
 */
export const cleanupEmptyConversations = async (userId: string): Promise<number> => {
  try {
    // Get all conversations for user
    const conversations = await getUserConversations(userId);
    
    // Find empty conversations
    const emptyConversations = conversations.filter(
      c => !c.messages || c.messages.length === 0
    );
    
    // Delete empty conversations
    if (emptyConversations.length > 0) {
      const ids = emptyConversations.map(c => c.id);
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .in('id', ids);
      
      if (error) throw error;
      return ids.length;
    }
    
    return 0;
  } catch (error) {
    console.error('Error cleaning up empty conversations:', error);
    return 0;
  }
};