// src/components/Common/LiveChatPopup.tsx
import React, { useEffect, useState, useRef } from "react";
import { X, MessageCircle } from "lucide-react";

interface LiveChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveChatPopup: React.FC<LiveChatPopupProps> = ({
  isOpen,
  onClose,
}) => {
  const [isChatActive, setIsChatActive] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const notificationListenersRef = useRef<boolean>(false);

  // Initialize Tawk.to and set up event listeners when popup opens
  useEffect(() => {
    if (!isOpen) return;

    // Wait for Tawk.to to be ready
    const initTawk = () => {
      if (!window.Tawk_API) {
        // Retry after a short delay if Tawk.to isn't loaded yet
        setTimeout(initTawk, 100);
        return;
      }

      // Remove global hide style
      const globalHideStyle = document.getElementById('tawk-global-hide');
      if (globalHideStyle) {
        globalHideStyle.remove();
      }

      // Get popup container position to constrain Tawk widget
      const popupContainer = document.getElementById('tawk-chat-popup-container');
      if (!popupContainer) {
        // Retry if container not ready yet
        setTimeout(initTawk, 100);
        return;
      }
      
      const rect = popupContainer.getBoundingClientRect();
      const popupRect = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };

      // Add show override style that constrains widget to popup
      let style = document.getElementById('tawk-show-override') as HTMLStyleElement;
      if (!style) {
        style = document.createElement('style');
        style.id = 'tawk-show-override';
        document.head.appendChild(style);
      }
      
      style.textContent = `
        /* Show Tawk widget but constrain it to the popup container */
        #tawkchat-container {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          position: fixed !important;
          top: ${popupRect.top}px !important;
          left: ${popupRect.left}px !important;
          width: ${popupRect.width}px !important;
          height: ${popupRect.height}px !important;
          z-index: 10000 !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          transform: none !important;
        }
        
        /* Hide the floating button/badge completely - never show it */
        #tawkchat-container > div:first-child:not(iframe),
        #tawkchat-container > button,
        #tawkchat-container > a,
        #tawkchat-container > span {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        
        /* Show only the chat iframe when maximized */
        #tawkchat-container iframe {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 1 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Ensure no external notifications or badges appear */
        body > div[id*="tawk"]:not(#tawkchat-container),
        body > iframe[id*="tawk"]:not(#tawkchat-container iframe) {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
      
      // Update position on window resize
      const updatePosition = () => {
        if (popupContainer && style) {
          const rect = popupContainer.getBoundingClientRect();
          style.textContent = `
            /* Show Tawk widget but constrain it to the popup container */
            #tawkchat-container {
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
              pointer-events: auto !important;
              position: fixed !important;
              top: ${rect.top}px !important;
              left: ${rect.left}px !important;
              width: ${rect.width}px !important;
              height: ${rect.height}px !important;
              z-index: 10000 !important;
              border: none !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              transform: none !important;
            }
            
            /* Hide the floating button/badge completely - never show it */
            #tawkchat-container > div:first-child:not(iframe),
            #tawkchat-container > button,
            #tawkchat-container > a,
            #tawkchat-container > span {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
            
            /* Show only the chat iframe when maximized */
            #tawkchat-container iframe {
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
              width: 100% !important;
              height: 100% !important;
              border: none !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              z-index: 1 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            /* Ensure no external notifications or badges appear */
            body > div[id*="tawk"]:not(#tawkchat-container),
            body > iframe[id*="tawk"]:not(#tawkchat-container iframe) {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
          `;
        }
      };
      
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      
      // Store cleanup function
      (window as any).__tawkPositionCleanup = () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };

      // Show and maximize the widget
      window.Tawk_API.showWidget();
      
      // Small delay to ensure widget is shown before maximizing
      setTimeout(() => {
        if (window.Tawk_API) {
          window.Tawk_API.maximize();
        }
      }, 300);

      // Set up event listeners only once (no notifications, just track state)
      if (!notificationListenersRef.current) {
        // Listen for chat started
        window.Tawk_API.onChatStarted = () => {
          setIsChatActive(true);
        };

        // Listen for chat ended
        window.Tawk_API.onChatEnded = () => {
          setIsChatActive(false);
        };

        // Disable all notification callbacks to prevent external notifications
        window.Tawk_API.onMessageReceived = null;
        window.Tawk_API.onChatMinimized = null;
        window.Tawk_API.onChatMaximized = null;

        notificationListenersRef.current = true;
      }
    };

    initTawk();

    // Cleanup function
    return () => {
      // Cleanup handled in handleCloseChat
    };
  }, [isOpen]);

  // Handle close chat button
  const handleCloseChat = () => {
    if (window.Tawk_API) {
      // End the current chat session
      try {
        window.Tawk_API.endChat();
      } catch (e) {
        console.log('Chat already ended or not started');
      }

      // Hide the widget completely
      window.Tawk_API.hideWidget();

      // Remove all event listeners
      window.Tawk_API.onMessageReceived = null;
      window.Tawk_API.onChatStarted = null;
      window.Tawk_API.onChatEnded = null;
      window.Tawk_API.onChatMinimized = null;
      window.Tawk_API.onChatMaximized = null;
    }

    // Clean up position listeners
    if ((window as any).__tawkPositionCleanup) {
      (window as any).__tawkPositionCleanup();
      delete (window as any).__tawkPositionCleanup;
    }
    
    // Remove the show override style
    const showOverride = document.getElementById('tawk-show-override');
    if (showOverride) {
      showOverride.remove();
    }
    
    // Restore global hide style
    let globalHideStyle = document.getElementById('tawk-global-hide');
    if (!globalHideStyle) {
      globalHideStyle = document.createElement('style');
      globalHideStyle.id = 'tawk-global-hide';
      globalHideStyle.textContent = `
        /* Hide all Tawk elements globally */
        #tawkchat-container,
        #tawkchat-container *,
        iframe[id*="tawk"],
        iframe[src*="tawk.to"],
        div[id*="tawk"],
        div[class*="tawk"],
        div[id*="tawkchat"],
        div[class*="tawkchat"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          position: fixed !important;
          z-index: -1 !important;
        }
      `;
      document.head.appendChild(globalHideStyle);
    }

    // Reset state
    setIsChatActive(false);
    notificationListenersRef.current = false;

    // Close the popup
    onClose();
  };

  // Clean up when component unmounts or closes
  useEffect(() => {
    if (!isOpen) {
      // Remove the show override style
      const showOverride = document.getElementById('tawk-show-override');
      if (showOverride) {
        showOverride.remove();
      }
      
      // Restore global hide style
      let globalHideStyle = document.getElementById('tawk-global-hide');
      if (!globalHideStyle) {
        globalHideStyle = document.createElement('style');
        globalHideStyle.id = 'tawk-global-hide';
        globalHideStyle.textContent = `
          /* Hide all Tawk elements globally */
          #tawkchat-container,
          #tawkchat-container *,
          iframe[id*="tawk"],
          iframe[src*="tawk.to"],
          div[id*="tawk"],
          div[class*="tawk"],
          div[id*="tawkchat"],
          div[class*="tawkchat"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: fixed !important;
            z-index: -1 !important;
          }
        `;
        document.head.appendChild(globalHideStyle);
      }
      
      if (window.Tawk_API) {
        // Ensure widget is hidden when popup is closed
        window.Tawk_API.hideWidget();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleCloseChat}
      />

      {/* Popup Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-4xl h-[85vh] max-h-[700px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 border-b border-blue-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Live Chat Support</h3>
                {isChatActive && (
                  <p className="text-xs text-blue-100">Chat active</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCloseChat}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white hover:bg-white/30"
                aria-label="Close Chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Tawk.to Chat Container - Widget will be injected here */}
          <div 
            ref={chatContainerRef}
            className="flex-1 relative overflow-hidden bg-gray-50"
            id="tawk-chat-popup-container"
          >
            {/* Tawk.to widget will be constrained to this container */}
            <div className="w-full h-full relative">
              {/* Loading state */}
              <div className="absolute inset-0 flex items-center justify-center z-0">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-3 animate-pulse" />
                  <p className="text-gray-500 text-sm">Connecting to support...</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with Close Chat Button */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Need help? Our support team is here for you.
            </p>
            <button
              onClick={handleCloseChat}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Close Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Extend Window interface for Tawk.to
declare global {
  interface Window {
    Tawk_API?: {
      maximize: () => void;
      minimize: () => void;
      toggle: () => void;
      showWidget: () => void;
      hideWidget: () => void;
      endChat: () => void;
      onMessageReceived?: (() => void) | null;
      onChatStarted?: (() => void) | null;
      onChatEnded?: (() => void) | null;
      onChatMinimized?: (() => void) | null;
      onChatMaximized?: (() => void) | null;
      [key: string]: any;
    };
  }
}

