import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, GripVertical } from 'lucide-react';

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMinimized, setIsMinimized] = useState(() => {
    // Check if user previously minimized the widget
    return localStorage.getItem('aiWidgetMinimized') === 'true';
  });
  const [isDragging, setIsDragging] = useState(false);
  const [hasBouncedOnLoad, setHasBouncedOnLoad] = useState(false);
  const [position, setPosition] = useState(() => {
    // Always start at bottom-right, no localStorage
    const isMobileView = window.innerWidth < 768;
    if (isMobileView) {
      // Mobile: bottom-right with margin
      return { x: window.innerWidth - 76, y: window.innerHeight - 120 };
    }
    // Desktop: bottom-right with margin (60px button width + 20px margin from right, 40px from bottom)
    return { x: window.innerWidth - 80, y: window.innerHeight - 100 };
  });

  const cycleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const assistantTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  // Bounce on load effect - triggers after component mounts
  useEffect(() => {
    const bounceTimer = setTimeout(() => {
      setHasBouncedOnLoad(true);
    }, 1500); // Complete bounce animation (1000ms) + buffer (500ms)

    return () => clearTimeout(bounceTimer);
  }, []);

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

  // Handle drag functionality (disabled on mobile)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return; // Disable dragging on mobile
    if ((e.target as HTMLElement).closest('button')) return; // Don't drag when clicking buttons
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;

      // Constrain to viewport - use 80px for minimized button size
      const buttonSize = 80;
      const maxX = window.innerWidth - buttonSize;
      const maxY = window.innerHeight - buttonSize;

      const constrainedPosition = {
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      };

      setPosition(constrainedPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Don't save position - it will reset on reload
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  // Handle window resize and mobile detection - reset to bottom-right
  useEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);

      // Always reset to bottom-right on resize
      if (isMobileView) {
        // Mobile: bottom-right with margin
        setPosition({
          x: window.innerWidth - 76,
          y: window.innerHeight - 120,
        });
      } else {
        // Desktop: bottom-right with margin
        setPosition({
          x: window.innerWidth - 80,
          y: window.innerHeight - 100,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMinimized]);

  const handleMinimize = () => {
    setIsMinimized(true);
    localStorage.setItem('aiWidgetMinimized', 'true');

    // Reset to bottom-right corner
    const newPosition = isMobile
      ? { x: window.innerWidth - 76, y: window.innerHeight - 120 }
      : { x: window.innerWidth - 80, y: window.innerHeight - 100 };
    setPosition(newPosition);
  };

  const handleExpand = () => {
    // Instead of expanding the preview widget, open the main chat popup
    onOpen();
  };

  const currentConversation = conversations[currentIndex];

  return (
    <div
      ref={widgetRef}
      className="fixed z-50 select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default',
        width: isMinimized ? '60px' : (isMobile ? 'calc(100% - 32px)' : '260px'),
        maxWidth: isMobile ? '100%' : '260px',
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
    >
      {isMinimized ? (
        // Minimized Tab View - Simple Button
        <div className="relative">
          {/* Pulsing Shadow Effect */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              animation: 'shadowPulse 3s ease-in-out infinite',
              filter: 'blur(20px)',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.6) 0%, rgba(147, 51, 234, 0.6) 100%)',
              transform: 'scale(1.1)',
            }}
          />

          {/* Main Button */}
          <div
            className="relative rounded-2xl p-3 cursor-pointer transition-all duration-500 ease-out hover:scale-105"
            onClick={handleExpand}
            onMouseDown={handleMouseDown}
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 50%, rgba(241, 245, 249, 0.98) 100%)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              border: '1.5px solid rgba(203, 213, 225, 0.5)',
              boxShadow: '0 15px 40px rgba(100, 116, 139, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              animation: hasBouncedOnLoad ? 'none' : 'bounceOnLoad 1s ease-out forwards',
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(to bottom right, rgb(59, 130, 246), rgb(147, 51, 234))',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                }}
              >
                <img
                  src="/smartcfo logo bg.png"
                  alt="SmartCFO"
                  className="w-full h-full object-contain p-1.5"
                />
              </div>
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
          </div>
        </div>
      ) : (
        // Full Widget View
        <div
          className={`relative ${isMobile ? 'rounded-[20px] p-3' : 'rounded-[24px] p-4'} overflow-hidden transition-all duration-700 ease-out`}
          onMouseDown={handleMouseDown}
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 50%, rgba(241, 245, 249, 0.98) 100%)',
            backdropFilter: 'blur(40px) saturate(200%)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            border: isHovered ? '1.5px solid rgba(203, 213, 225, 0.6)' : '1.5px solid rgba(203, 213, 225, 0.4)',
            boxShadow: isHovered
              ? '0 25px 60px rgba(100, 116, 139, 0.35), 0 15px 35px rgba(148, 163, 184, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
              : '0 20px 45px rgba(100, 116, 139, 0.25), 0 10px 25px rgba(148, 163, 184, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
            transform: isDragging ? 'scale(0.97) rotate(-1deg)' : isHovered ? 'scale(1.02) translateY(-4px)' : 'scale(1)',
          }}
        >
          {/* Close & Drag Header */}
          <div className="absolute top-2 right-2 left-2 flex items-center justify-between px-1 z-10">
            {!isMobile && (
              <div
                className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg hover:bg-slate-100/50 transition-all duration-300"
                title="Drag to move"
                style={{
                  backdropFilter: 'blur(10px)',
                }}
              >
                <GripVertical className="h-3.5 w-3.5 text-slate-400" />
              </div>
            )}
            {isMobile && <div />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMinimize();
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100/50 hover:rotate-90 transition-all duration-300 group"
              title="Minimize widget"
              style={{
                backdropFilter: 'blur(10px)',
              }}
            >
              <X className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
            </button>
          </div>

        {/* Animated gradient orbs */}
        <div
          className="absolute top-0 right-0 w-32 h-32 rounded-full transition-opacity duration-700 pointer-events-none"
          style={{
            opacity: isHovered ? 0.25 : 0.15,
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'float 6s ease-in-out infinite',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-24 h-24 rounded-full transition-opacity duration-700 pointer-events-none"
          style={{
            opacity: isHovered ? 0.25 : 0.15,
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
            filter: 'blur(35px)',
            animation: 'float 8s ease-in-out infinite reverse',
          }}
        />

        {/* Premium shine effect */}
        <div
          className="absolute inset-0 transition-all duration-700 pointer-events-none overflow-hidden rounded-[24px]"
          style={{
            opacity: isHovered ? 0.4 : 0.25,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'linear-gradient(45deg, transparent 30%, rgba(203, 213, 225, 0.3) 50%, transparent 70%)',
              animation: isHovered ? 'shine 2s ease-in-out infinite' : 'none',
            }}
          />
        </div>

        {/* Hover glow effect */}
        {isHovered && (
          <div
            className="absolute inset-0 pointer-events-none rounded-[24px]"
            style={{
              background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
              animation: 'pulseGlow 3s ease-in-out infinite',
            }}
          />
        )}

        {/* Animated Messages - Compact, show only one at a time */}
        <div className={`relative space-y-3 mb-3 pt-6 ${isMobile ? 'min-h-[60px]' : 'min-h-[70px]'}`}>
          {/* Show only assistant message with typing indicator if user message would show */}
          {showAssistantMessage ? (
            <div
              key={`assistant-${currentIndex}`}
              className="flex justify-start"
              style={{ animation: 'fadeInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <div className="flex items-start gap-2 max-w-full">
                {/* SmartCFO Logo - Modern style */}
                <div
                  className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} rounded-xl flex items-center justify-center flex-shrink-0 relative transition-transform duration-300 hover:scale-110`}
                  style={{
                    background: 'linear-gradient(to bottom right, rgb(59, 130, 246), rgb(147, 51, 234))',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  }}
                >
                  <img
                    src="/smartcfo logo bg.png"
                    alt="SmartCFO"
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <div
                  className={`rounded-2xl ${isMobile ? 'px-3 py-2' : 'px-3.5 py-2.5'} relative flex-1 transition-all duration-300 hover:shadow-lg`}
                  style={{
                    background: 'linear-gradient(135deg, rgba(249, 250, 251, 0.95) 0%, rgba(243, 244, 246, 0.9) 100%)',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                    border: '1.5px solid rgba(229, 231, 235, 0.8)',
                    boxShadow: '0 4px 16px rgba(100, 116, 139, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <p className={`${isMobile ? 'text-[11px]' : 'text-xs'} text-slate-700 font-medium leading-relaxed`}>{currentConversation.assistant}</p>
                </div>
              </div>
            </div>
          ) : showUserMessage ? (
            // Typing Indicator (show when user message appears, before assistant responds)
            <div className="flex justify-start" style={{ animation: 'fadeInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div className="flex items-start gap-2">
                <div
                  className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} rounded-xl flex items-center justify-center flex-shrink-0 relative`}
                  style={{
                    background: 'linear-gradient(to bottom right, rgb(59, 130, 246), rgb(147, 51, 234))',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  }}
                >
                  <img
                    src="/smartcfo logo bg.png"
                    alt="SmartCFO"
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <div
                  className={`rounded-2xl ${isMobile ? 'px-3 py-2' : 'px-4 py-2.5'}`}
                  style={{
                    background: 'linear-gradient(135deg, rgba(249, 250, 251, 0.95) 0%, rgba(243, 244, 246, 0.9) 100%)',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                    border: '1.5px solid rgba(229, 231, 235, 0.8)',
                    boxShadow: '0 4px 16px rgba(100, 116, 139, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <div className="flex gap-1.5 items-center">
                    <div
                      className={`${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full`}
                      style={{
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.8) 0%, rgba(99, 102, 241, 0.8) 100%)',
                        animation: 'typingBounce 1.4s ease-in-out infinite',
                        animationDelay: '0ms',
                        boxShadow: '0 2px 6px rgba(139, 92, 246, 0.3)',
                      }}
                    />
                    <div
                      className={`${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full`}
                      style={{
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.8) 0%, rgba(99, 102, 241, 0.8) 100%)',
                        animation: 'typingBounce 1.4s ease-in-out infinite',
                        animationDelay: '200ms',
                        boxShadow: '0 2px 6px rgba(139, 92, 246, 0.3)',
                      }}
                    />
                    <div
                      className={`${isMobile ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full`}
                      style={{
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.8) 0%, rgba(99, 102, 241, 0.8) 100%)',
                        animation: 'typingBounce 1.4s ease-in-out infinite',
                        animationDelay: '400ms',
                        boxShadow: '0 2px 6px rgba(139, 92, 246, 0.3)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Call to Action */}
        <div
          className={`flex items-center justify-between ${isMobile ? 'pt-2' : 'pt-3'} relative`}
          style={{
            borderTop: '1.5px solid rgba(226, 232, 240, 0.6)',
          }}
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="flex-shrink-0 relative"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(139, 92, 246, 0.3))',
              }}
            >
              <Sparkles className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-purple-500`} style={{ animation: 'sparkle 2s ease-in-out infinite' }} />
            </div>
            <span
              className={`${isMobile ? 'text-[11px]' : 'text-xs'} font-semibold text-slate-600 truncate transition-all duration-300 tracking-tight`}
              style={{
                textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
              }}
            >
              {!isMobile && isHovered ? "Talk to AI for Smart Accounting" : currentConversation.feature}
            </span>
          </div>
          <button
            className={`relative ${isMobile ? 'px-3 py-1' : 'px-3.5 py-1.5'} rounded-lg ${isMobile ? 'text-[11px]' : 'text-xs'} font-medium flex-shrink-0 ml-2 transition-all duration-300 overflow-hidden group`}
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
              boxShadow: isHovered
                ? '0 4px 12px rgba(59, 130, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
                : '0 2px 8px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
              border: '1.5px solid rgba(59, 130, 246, 0.3)',
              transform: isHovered ? 'scale(1.03) translateY(-1px)' : 'scale(1)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <span className="relative z-10 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Chat Now
            </span>
            {/* Button shine effect */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.1) 50%, transparent 100%)',
              }}
            />
          </button>
        </div>
        </div>
      )}

      {/* Premium CSS Animations */}
      <style>{`
        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(20px) scale(0.94);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px) scale(0.94);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes typingBounce {
          0%, 60%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.8;
          }
          30% {
            transform: translateY(-10px) scale(1.15);
            opacity: 1;
          }
        }

        @keyframes sparkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.2) rotate(10deg);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.08);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(10px, -10px) scale(1.05);
          }
          66% {
            transform: translate(-10px, 10px) scale(0.95);
          }
        }

        @keyframes shine {
          0% {
            transform: translateX(-100%) translateY(-100%) rotate(45deg);
          }
          100% {
            transform: translateX(100%) translateY(100%) rotate(45deg);
          }
        }

        /* Bounce on Load Animation */
        @keyframes bounceOnLoad {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(0);
          }
          50% {
            opacity: 1;
            transform: scale(1.05) translateY(-20px);
          }
          65% {
            transform: scale(0.95) translateY(0);
          }
          80% {
            transform: scale(1.02) translateY(-10px);
          }
          95% {
            transform: scale(0.98) translateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* Shadow Pulse Animation */
        @keyframes shadowPulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1.1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.3);
          }
        }
      `}</style>
    </div>
  );
};

