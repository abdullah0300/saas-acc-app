import React, { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';

interface Conversation {
  user: string;
  assistant: string;
  feature: string;
}

const conversations: Conversation[] = [
  {
    user: "Can you create an invoice?",
    assistant: "Sure! Tell me the client name and amount.",
    feature: "Invoice Creation"
  },
  {
    user: "Do I have any expenses this month?",
    assistant: "Let me check your expenses...",
    feature: "Expense Tracking"
  },
  {
    user: "Show me my financial reports",
    assistant: "I'll generate your reports right away!",
    feature: "Financial Reports"
  },
  {
    user: "What's my cash flow status?",
    assistant: "Analyzing your cash flow...",
    feature: "Cash Flow Analysis"
  }
];

interface AnimatedChatWidgetProps {
  onOpen: () => void;
}

export const AnimatedChatWidget: React.FC<AnimatedChatWidgetProps> = ({ onOpen }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUserMessage, setShowUserMessage] = useState(true);
  const [showAssistantMessage, setShowAssistantMessage] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cycleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const assistantTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset states when conversation changes
    setShowUserMessage(false);
    setShowAssistantMessage(false);

    // Clear any existing timeouts
    if (userTimeoutRef.current) clearTimeout(userTimeoutRef.current);
    if (assistantTimeoutRef.current) clearTimeout(assistantTimeoutRef.current);
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);

    // Show user message after short delay
    userTimeoutRef.current = setTimeout(() => {
      setShowUserMessage(true);
    }, 400);

    // Show assistant message after user message
    assistantTimeoutRef.current = setTimeout(() => {
      setShowAssistantMessage(true);
    }, 2200);

    // Move to next conversation after both messages are shown
    cycleTimeoutRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % conversations.length);
    }, 5500);

    return () => {
      if (userTimeoutRef.current) clearTimeout(userTimeoutRef.current);
      if (assistantTimeoutRef.current) clearTimeout(assistantTimeoutRef.current);
      if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
    };
  }, [currentIndex]);

  const currentConversation = conversations[currentIndex];

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[300px] select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Chat Widget */}
      <div
        className="relative rounded-[28px] p-4 cursor-pointer overflow-hidden transition-all duration-500 ease-out"
        onClick={onOpen}
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          border: isHovered ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: isHovered
            ? '0 25px 70px rgba(139, 92, 246, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)'
            : '0 20px 60px rgba(139, 92, 246, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
          transform: isHovered ? 'scale(1.02) translateY(-2px)' : 'scale(1)',
        }}
      >
        {/* Animated gradient background - Always visible */}
        <div 
          className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
          style={{
            opacity: isHovered ? 1.2 : 1,
            background: 'radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 40%, transparent 70%)',
          }}
        />

        {/* Shine effect - Always visible */}
        <div 
          className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
          style={{
            opacity: isHovered ? 0.5 : 0.3,
            background: 'linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
          }}
        />

        {/* Hover glow effect */}
        {isHovered && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
              animation: 'pulseGlow 2s ease-in-out infinite',
            }}
          />
        )}

        {/* Animated Messages */}
        <div className="relative space-y-2.5 min-h-[95px] mb-3">
          {/* User Message */}
          {showUserMessage && (
            <div
              key={`user-${currentIndex}`}
              className="flex justify-end"
              style={{ animation: 'fadeInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <div 
                className="rounded-[20px] px-4 py-2.5 max-w-[80%] relative"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.75) 100%)',
                  backdropFilter: 'blur(24px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                }}
              >
                <p className="text-xs text-gray-900 font-semibold leading-relaxed tracking-tight">{currentConversation.user}</p>
              </div>
            </div>
          )}

          {/* Assistant Message */}
          {showAssistantMessage && (
            <div
              key={`assistant-${currentIndex}`}
              className="flex justify-start"
              style={{ animation: 'fadeInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <div className="flex items-start gap-2 max-w-[80%]">
                {/* SmartCFO Logo - Premium */}
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 relative"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  <img 
                    src="/smartcfo logo bg.png" 
                    alt="SmartCFO" 
                    className="w-full h-full object-contain p-1"
                  />
                  {/* Glow effect */}
                  <div 
                    className="absolute inset-0 rounded-full opacity-50"
                    style={{
                      background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%)',
                    }}
                  />
                </div>
                <div 
                  className="rounded-[20px] px-4 py-2.5 relative"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.75) 100%)',
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                  }}
                >
                  <p className="text-xs text-gray-900 font-medium leading-relaxed tracking-tight">{currentConversation.assistant}</p>
                </div>
              </div>
            </div>
          )}

          {/* Typing Indicator */}
          {showUserMessage && !showAssistantMessage && (
            <div className="flex justify-start" style={{ animation: 'fadeInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div className="flex items-start gap-2">
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 relative"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  <img 
                    src="/smartcfo logo bg.png" 
                    alt="SmartCFO" 
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <div 
                  className="rounded-[20px] px-4 py-2.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.75) 100%)',
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                  }}
                >
                  <div className="flex gap-1.5 items-center">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        animation: 'typingBounce 1.4s ease-in-out infinite',
                        animationDelay: '0ms',
                      }} 
                    />
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        animation: 'typingBounce 1.4s ease-in-out infinite',
                        animationDelay: '200ms',
                      }} 
                    />
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        animation: 'typingBounce 1.4s ease-in-out infinite',
                        animationDelay: '400ms',
                      }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div 
          className="flex items-center justify-between pt-2.5 relative"
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div 
              className="flex-shrink-0"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(139, 92, 246, 0.3))',
              }}
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-500" style={{ animation: 'sparkle 2s ease-in-out infinite' }} />
            </div>
            <span 
              className="text-xs font-normal text-gray-700 truncate transition-all duration-300 tracking-tight"
              style={{
                textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
              }}
            >
              {isHovered ? "Talk to AI for Smart Accounting" : currentConversation.feature}
            </span>
          </div>
          <button
            className="relative px-4 py-1.5 rounded-full text-xs font-bold text-white flex-shrink-0 ml-2 transition-all duration-300 overflow-hidden group"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: isHovered 
                ? '0 10px 28px rgba(102, 126, 234, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
                : '0 4px 12px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              transform: isHovered ? 'scale(1.08)' : 'scale(1)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <span className="relative z-10">Chat</span>
            {/* Button shine effect */}
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: 'linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%)',
              }}
            />
          </button>
        </div>
      </div>

      {/* Premium CSS Animations */}
      <style>{`
        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes typingBounce {
          0%, 60%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.7;
          }
          30% {
            transform: translateY(-8px) scale(1.1);
            opacity: 1;
          }
        }

        @keyframes sparkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
};

