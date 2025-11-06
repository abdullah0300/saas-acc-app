import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Trash2, Plus, Clock } from 'lucide-react';
import { getUserConversations, getConversationTitle, deleteConversation, type ChatConversation } from '../../services/ai/chatConversationService';
import { formatDistanceToNow } from 'date-fns';

interface ChatHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  isOpen,
  onClose,
  userId,
  currentConversationId,
  onSelectConversation,
  onNewChat,
}) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId, currentConversationId]); // Reload when conversation changes (e.g., after deletion)

  const loadConversations = async () => {
    try {
      setLoading(true);
      const allConversations = await getUserConversations(userId);
      setConversations(allConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;

    try {
      setDeletingId(conversationId);
      
      // Delete from database
      await deleteConversation(conversationId);
      
      // Remove from local state immediately
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      // If deleted conversation was current, switch to new chat (without creating conversation)
      if (conversationId === currentConversationId) {
        onNewChat();
      }
      
      // Reload conversations to ensure sync with database
      await loadConversations();
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      alert(`Failed to delete conversation: ${error.message || 'Please try again.'}`);
      // Reload conversations on error to sync state
      await loadConversations();
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelect = (conversationId: string) => {
    onSelectConversation(conversationId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-sm">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            <div className="p-2">
              {conversations.map((conversation) => {
                const title = getConversationTitle(conversation);
                const isActive = conversation.id === currentConversationId;
                const isDeleting = deletingId === conversation.id;
                const timeAgo = formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true });

                return (
                  <div
                    key={conversation.id}
                    onClick={() => handleSelect(conversation.id)}
                    className={`group relative p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                      isActive
                        ? 'bg-purple-50 border border-purple-200'
                        : 'hover:bg-gray-50'
                    } ${isDeleting ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare
                        className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                          isActive ? 'text-purple-600' : 'text-gray-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isActive ? 'text-purple-900' : 'text-gray-900'
                          }`}
                        >
                          {title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <p className="text-xs text-gray-500">{timeAgo}</p>
                          {conversation.messages?.length > 0 && (
                            <span className="text-xs text-gray-400">
                              • {conversation.messages.filter(m => m.role === 'user').length} messages
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, conversation.id)}
                        disabled={isDeleting}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all text-red-600"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

