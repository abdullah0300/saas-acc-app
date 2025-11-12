import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, RefreshCw, Menu, Minimize2, Maximize2, MessageSquare, Trash2, Plus, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getUserConversation, addMessage, getConversationHistory, type ChatMessage, createConversation, updateConversationStatus, getConversation, getUserConversations, getConversationTitle, deleteConversation, type ChatConversation } from '../../services/ai/chatConversationService';
import { sendMessageToDeepSeek } from '../../services/ai/deepseekService';
import { checkCredits, useCredit as consumeCredit, getCreditsRemaining } from '../../services/ai/creditsService';
import { getLatestPendingAction } from '../../services/ai/pendingActionsService';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { AIPreviewCard } from './AIPreviewCard';
import { CreditsIndicator } from './CreditsIndicator';
import { AnimatedChatWidget } from './AnimatedChatWidget';
import { formatDistanceToNow } from 'date-fns';

export const AIChatWidget: React.FC = () => {
  const { user } = useAuth();
  // Now safely inside SettingsProvider - always has access to exchange rates
  const { exchangeRates } = useSettings();

  // Log exchange rates availability for debugging
  useEffect(() => {
    console.log('[AIChatWidget] ✓ Exchange rates loaded:', Object.keys(exchangeRates).length, 'currencies');
    if (Object.keys(exchangeRates).length > 0) {
      console.log('[AIChatWidget] Available currencies:', Object.keys(exchangeRates).join(', '));
    } else {
      console.log('[AIChatWidget] No exchange rates loaded yet (might still be fetching)');
    }
  }, [exchangeRates]);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number>(0);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Chat history - integrated in popup
  const [showHistory, setShowHistory] = useState(true); // Show by default in popup
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Premium features: draggable, minimize
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  // Initialize button position to bottom-right corner
  const [buttonPosition, setButtonPosition] = useState(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth - 80 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight - 80 : 0
  }));
  // Initialize popup position to center-bottom (bigger popup now)
  const [popupPosition, setPopupPosition] = useState(() => ({
    x: typeof window !== 'undefined' ? (window.innerWidth - 900) / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight - 730 : 0 // Center-bottom position
  }));
  // Initialize minimized popup position to right-bottom
  const [minimizedPosition, setMinimizedPosition] = useState(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth - 464 : 0, // Right side (440px width + 24px padding)
    y: typeof window !== 'undefined' ? window.innerHeight - 450 : 0 // Bottom position
  }));
  const [isAnimating, setIsAnimating] = useState(false);
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const buttonDragStart = useRef({ x: 0, y: 0 });

  // Update positions on window resize
  useEffect(() => {
    const handleResize = () => {
      if (!isOpen) {
        setButtonPosition({
          x: Math.min(buttonPosition.x, window.innerWidth - 80),
          y: Math.min(buttonPosition.y, window.innerHeight - 80)
        });
      } else if (isOpen && !isMinimized) {
        // Big popup always returns to bottom-center on resize
        setPopupPosition({
          x: (window.innerWidth - 900) / 2,
          y: window.innerHeight - 730
        });
      } else if (isOpen && isMinimized) {
        // Small popup - keep position but constrain to viewport
        setMinimizedPosition({
          x: Math.min(minimizedPosition.x, window.innerWidth - 464),
          y: Math.min(minimizedPosition.y, window.innerHeight - 450)
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, isMinimized, buttonPosition, popupPosition, minimizedPosition]);

  // Load conversation on mount or when user changes
  useEffect(() => {
    if (user && isOpen) {
      loadActiveConversation();
      loadCredits();
      loadConversations();
    }
  }, [user, isOpen]);

  // Load chat history
  const loadConversations = async () => {
    if (!user) return;
    try {
      setHistoryLoading(true);
      const allConversations = await getUserConversations(user.id);
      setConversations(allConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setHistoryLoading(false);
    }
  };


  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadActiveConversation = async () => {
    if (!user) return;

    try {
      const conversations = await getUserConversations(user.id);
      
      let activeConversation = null;
      if (conversationId) {
        activeConversation = conversations.find(c => c.id === conversationId);
        if (!activeConversation || !activeConversation.messages || activeConversation.messages.length === 0) {
          activeConversation = null;
          setConversationId(null);
        }
      }
      
      if (!activeConversation) {
        activeConversation = conversations.find(
          c => c.status === 'active' && c.messages && c.messages.length > 0
        );
      }
      
      if (activeConversation) {
        setConversationId(activeConversation.id);
        setMessages(activeConversation.messages || []);
        await checkPendingActions();
      } else {
        setConversationId(null);
        setMessages([]);
        setPendingAction(null);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      setConversationId(null);
      setMessages([]);
      setPendingAction(null);
    }
  };

  const loadCredits = async () => {
    if (!user) return;
    try {
      setCreditsLoading(true);
      const remaining = await getCreditsRemaining(user.id);
      setCreditsRemaining(remaining);
    } catch (error) {
      console.error('Error loading credits:', error);
    } finally {
      setCreditsLoading(false);
    }
  };

  const checkPendingActions = async () => {
    if (!conversationId) return;
    try {
      const latest = await getLatestPendingAction(conversationId);
      setPendingAction(latest);
    } catch (error) {
      console.error('Error checking pending actions:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (message: string) => {
    if (!user || !message.trim()) return;

    let currentConversationId = conversationId;
    if (!currentConversationId) {
      try {
        const newConversation = await createConversation(user.id);
        currentConversationId = newConversation.id;
        setConversationId(currentConversationId);
        await loadConversations();
      } catch (error) {
        console.error('Error creating conversation:', error);
        return;
      }
    }

    const hasCredits = await checkCredits(user.id);
    if (!hasCredits) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm sorry, you've used all your daily AI credits. Please try again tomorrow!",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    await addMessage(currentConversationId, 'user', message.trim());

    await consumeCredit(user.id);
    await loadCredits();

    setIsLoading(true);

    try {
      const conversation = await getConversation(currentConversationId);
      const history = getConversationHistory(conversation, 20);

      console.log('[AIChatWidget] Sending message to AI with exchange rates:', Object.keys(exchangeRates));

      const response = await sendMessageToDeepSeek(
        history,
        user.id,
        currentConversationId,
        exchangeRates
      );

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      await addMessage(currentConversationId, 'assistant', response.content);

      await checkPendingActions();
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `I'm sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      await loadCredits();
    }
  };

  const handleNewChat = async () => {
    if (!user) return;

    try {
      if (conversationId && messages.length > 0) {
        await updateConversationStatus(conversationId, 'completed');
      } else if (conversationId && messages.length === 0) {
        await deleteConversation(conversationId);
      }

      setConversationId(null);
      setMessages([]);
      setPendingAction(null);
      await loadConversations();
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  const handleSelectConversation = async (selectedConversationId: string) => {
    if (!user || selectedConversationId === conversationId) return;

    try {
      const conversation = await getConversation(selectedConversationId);
      
      if (!conversation.messages || conversation.messages.length === 0) {
        return;
      }
      
      if (conversationId && conversationId !== selectedConversationId) {
        await updateConversationStatus(conversationId, 'completed');
      }

      await updateConversationStatus(selectedConversationId, 'active');
      
      setConversationId(conversation.id);
      setMessages(conversation.messages || []);
      
      await checkPendingActions();
    } catch (error: any) {
      console.error('Error loading conversation:', error);
      if (error.message?.includes('not found') || error.code === 'PGRST116') {
        await loadActiveConversation();
      }
    }
  };

  const handleDeleteConversation = async (conversationIdToDelete: string) => {
    if (!user) return;
    try {
      setDeletingId(conversationIdToDelete);
      await deleteConversation(conversationIdToDelete);
      
      if (conversationId === conversationIdToDelete) {
        setConversationId(null);
        setMessages([]);
        setPendingAction(null);
      }
      
      await loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePendingActionUpdate = async (action: 'confirmed' | 'cancelled', actionType?: string) => {
    await checkPendingActions();
    
    if (action === 'confirmed') {
      const successMessage: ChatMessage = {
        role: 'assistant',
        content: `✅ **Successfully created ${actionType || 'record'}!**\n\nThe ${actionType || 'record'} has been added to your account and is now available in your dashboard.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, successMessage]);
      
      if (conversationId) {
        await addMessage(conversationId, 'assistant', successMessage.content);
      }
    } else if (action === 'cancelled') {
      const cancelMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ **Action cancelled.**\n\nThe ${actionType || 'record'} was not created. You can ask me to create it again anytime.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, cancelMessage]);
      
      if (conversationId) {
        await addMessage(conversationId, 'assistant', cancelMessage.content);
      }
    }
    
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Premium animations
  const handleOpen = useCallback(() => {
    setIsAnimating(true);
    setIsOpen(true);
    setIsMinimized(false);
    
    setPopupPosition({
      x: (window.innerWidth - 900) / 2,
      y: window.innerHeight - 730
    });
    
    setTimeout(() => setIsAnimating(false), 300);
  }, []);

  const handleClose = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsMinimized(false);
      setIsAnimating(false);
    }, 300);
  }, []);

  const handleMinimize = useCallback(() => {
    setIsAnimating(true);
    setIsMinimized(true);
    // Set position to right-bottom when minimizing
    setMinimizedPosition({
      x: window.innerWidth - 464, // Right side (440px width + 24px padding)
      y: window.innerHeight - 450
    });
    setTimeout(() => setIsAnimating(false), 400);
  }, []);

  const handleMaximize = useCallback(() => {
    setIsAnimating(true);
    setIsMinimized(false);
    
    setPopupPosition({
      x: (window.innerWidth - 900) / 2,
      y: window.innerHeight - 730
    });
    
    setTimeout(() => setIsAnimating(false), 400);
  }, []);

  // Drag handlers for small minimized popup only
  const handlePopupMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMinimized && (e.target as HTMLElement).closest('button, input, textarea, a') === null) {
      setIsDragging(true);
      dragStartPos.current = {
        x: e.clientX - minimizedPosition.x,
        y: e.clientY - minimizedPosition.y,
      };
    }
  }, [isMinimized, minimizedPosition]);

  // Global mouse handlers for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isMinimized) {
        const newX = e.clientX - dragStartPos.current.x;
        const newY = e.clientY - dragStartPos.current.y;
        
        setMinimizedPosition({
          x: Math.max(0, Math.min(newX, window.innerWidth - 464)),
          y: Math.max(0, Math.min(newY, window.innerHeight - 450)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isMinimized]);

  if (!user) return null;

  // Premium animation classes
  const popupAnimationClass = isAnimating
    ? isMinimized
      ? 'animate-[scaleDown_0.4s_cubic-bezier(0.16,1,0.3,1)]'
      : 'animate-[scaleUp_0.3s_cubic-bezier(0.16,1,0.3,1)]'
    : '';

  return (
    <>
      {/* Animated Chat Widget */}
      {/* UNCOMMENT THE LINE BELOW TO ENABLE THE ANIMATED CHAT WIDGET */}
      {/* {!isOpen && <AnimatedChatWidget onOpen={handleOpen} />} */}

      {/* Chat Popup */}
      {isOpen && (
        <>
          {/* Glassmorphism Backdrop - Only for big popup */}
          {!isMinimized && (
            <div 
              className="fixed inset-0 z-40 pointer-events-none"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            />
          )}

          {/* Small Minimized Popup - Draggable */}
          {isMinimized && (
            <div
              ref={popupRef}
              onMouseDown={handlePopupMouseDown}
              style={{
                position: 'fixed',
                left: `${minimizedPosition.x}px`,
                top: `${minimizedPosition.y}px`,
                width: '440px',
                height: '420px',
                background: 'linear-gradient(to bottom, rgba(248, 246, 255, 0.95), rgba(243, 240, 255, 0.9), rgba(238, 235, 255, 0.85))',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                cursor: isDragging ? 'grabbing' : 'default',
              }}
              className={`z-50 rounded-2xl border border-white/30 flex flex-col overflow-hidden shadow-2xl ${popupAnimationClass}`}
            >
              {/* Header - Thinner */}
              <div 
                className="px-4 py-3 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 backdrop-blur-sm border-b border-white/20 flex items-center justify-between"
                style={{ cursor: isDragging ? 'grabbing' : 'default' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden p-1">
                    <img 
                      src="/smartcfo logo bg.png" 
                      alt="SmartCFO" 
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900">SmartCFO</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleMaximize}
                    className="p-2 hover:bg-white/40 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
                    aria-label="Maximize"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-white/40 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
                    aria-label="Close"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Messages - Compact */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-white/80 to-white/40 backdrop-blur-sm">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 py-8">
                    <MessageCircle className="h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-700">Start chatting!</p>
                  </div>
                ) : (
                  <>
                    <ChatMessageList messages={messages.slice(-4)} />
                    {isLoading && (
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>AI is thinking...</span>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input - Compact */}
              <div className="p-4 border-t border-gray-200/50 bg-white/90 backdrop-blur-sm">
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={creditsRemaining === 0}
                  creditsRemaining={creditsRemaining}
                  isLoading={isLoading}
                />
              </div>
            </div>
          )}

          {/* Big Popup - Fixed Position, Not Draggable */}
          {!isMinimized && (
            <div
              ref={popupRef}
              style={{
                position: 'fixed',
                left: `${popupPosition.x}px`,
                top: `${popupPosition.y}px`,
                width: '900px',
                height: '700px',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
                backdropFilter: 'blur(24px) saturate(200%)',
                WebkitBackdropFilter: 'blur(24px) saturate(200%)',
              }}
              className={`z-50 rounded-3xl border border-white/40 flex flex-col overflow-hidden shadow-2xl ${popupAnimationClass}`}
            >
              {/* Header - Thinner with SmartCFO Logo */}
              <div className="px-5 py-3 bg-gradient-to-r from-purple-50/90 via-indigo-50/90 to-purple-50/90 backdrop-blur-sm border-b border-white/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="p-1.5 hover:bg-white/40 rounded-lg transition-colors duration-200 text-gray-600 hover:text-gray-900"
                    aria-label="Toggle Chat History"
                    title={showHistory ? "Hide History" : "Show History"}
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  
                  {/* SmartCFO Logo with Brand Gradient */}
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <img 
                      src="/smartcfo logo bg.png" 
                      alt="SmartCFO" 
                      className="text-white font-bold text-xl"
                    />
                  </div>
                  
                  <h3 className="font-semibold text-sm text-gray-900">
                    SmartCFO
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMinimize}
                    className="p-2 hover:bg-white/40 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
                    aria-label="Minimize"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-white/40 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Chat History Sidebar - Integrated */}
                {showHistory && (
                  <div className="w-72 border-r border-gray-200/30 bg-gradient-to-b from-white/60 via-purple-50/30 to-indigo-50/30 backdrop-blur-sm flex flex-col">
                    <div className="p-4 border-b border-gray-200/30">
                      <button
                        onClick={handleNewChat}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 text-sm font-semibold shadow-md hover:shadow-lg"
                      >
                        <Plus className="h-4 w-4" />
                        New
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                      {historyLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                      ) : conversations.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p>No conversations yet</p>
                        </div>
                      ) : (
                        conversations.map((conv) => {
                          const title = getConversationTitle(conv);
                          const isActive = conv.id === conversationId;
                          return (
                            <div
                              key={conv.id}
                              onClick={() => handleSelectConversation(conv.id)}
                              className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                                isActive
                                  ? 'bg-gradient-to-r from-purple-100 to-indigo-100 border border-purple-200/50 shadow-sm'
                                  : 'hover:bg-white/60 border border-transparent'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {conv.messages && conv.messages.length > 0
                                      ? formatDistanceToNow(new Date(conv.messages[conv.messages.length - 1].timestamp), { addSuffix: true })
                                      : 'Just now'}
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteConversation(conv.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded-lg transition-all text-gray-400 hover:text-red-600"
                                  disabled={deletingId === conv.id}
                                >
                                  {deletingId === conv.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Credits Indicator */}
                  <div className="px-4 pt-3 pb-2 border-b border-gray-200/50 bg-white/60 backdrop-blur-sm">
                    <CreditsIndicator creditsRemaining={creditsRemaining} isLoading={creditsLoading} />
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white/80 to-white/40 backdrop-blur-sm">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                        <div className="relative mb-6">
                          <MessageCircle className="h-16 w-16 text-gray-300 mx-auto" />
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-indigo-400/20 rounded-full blur-xl animate-pulse" />
                        </div>
                        <p className="text-sm font-medium text-gray-700">Start a conversation with your AI assistant!</p>
                        <p className="text-xs mt-2 text-gray-500">Try: "Show me my invoices from January"</p>
                      </div>
                    ) : (
                      <>
                        <ChatMessageList messages={messages} />
                        
                        {/* Pending Action Preview - Shown in chat flow */}
                        {pendingAction && (
                          <div className="flex justify-start">
                            <div className="max-w-[85%] w-full">
                              <AIPreviewCard
                                pendingAction={pendingAction}
                                onUpdate={handlePendingActionUpdate}
                                conversationId={conversationId!}
                                userId={user.id}
                              />
                            </div>
                          </div>
                        )}
                        
                        {isLoading && (
                          <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>AI is thinking...</span>
                          </div>
                        )}
                      </>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-white/20 bg-white/90 backdrop-blur-sm rounded-br-3xl">
                    <ChatInput
                      onSend={handleSendMessage}
                      disabled={creditsRemaining === 0}
                      creditsRemaining={creditsRemaining}
                      isLoading={isLoading}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes scaleUp {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes scaleDown {
          from {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          to {
            opacity: 0.9;
            transform: scale(0.98) translateY(5px);
          }
        }
      `}</style>
    </>
  );
};
