import React, { useState, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  creditsRemaining: number;
  isLoading?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled = false, creditsRemaining, isLoading = false }) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    // Don't send if loading, disabled, or empty
    if (message.trim() && !disabled && !isLoading && creditsRemaining > 0) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="space-y-2">
      {creditsRemaining === 0 && (
        <p className="text-xs text-red-500 text-center">
          No credits remaining. Credits reset daily.
        </p>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={disabled ? "No credits remaining" : isLoading ? "AI is thinking..." : "Type your message..."}
          disabled={disabled}
          rows={1}
          className="flex-1 px-4 py-2 border-2 border-purple-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:cursor-not-allowed scrollbar-hide"
          style={{
            minHeight: '40px',
            maxHeight: '120px',
            background: disabled ? 'rgba(243, 244, 246, 0.5)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(10px)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim() || creditsRemaining === 0 || isLoading}
          className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-600 disabled:hover:to-indigo-600 flex-shrink-0"
          aria-label="Send message"
          title={isLoading ? "Please wait for AI response" : "Send message"}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
    </>
  );
};
