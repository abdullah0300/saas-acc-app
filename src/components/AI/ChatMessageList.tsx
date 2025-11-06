import React from 'react';
import { User } from 'lucide-react';
import type { ChatMessage } from '../../services/ai/chatConversationService';
import { renderMarkdown } from '../../utils/markdownRenderer';

interface ChatMessageListProps {
  messages: ChatMessage[];
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages }) => {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {message.role === 'assistant' && (
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <img 
                src="/smartcfo logo bg.png" 
                alt="SmartCFO" 
                className="text-white font-bold text-xl"
              />
            </div>
          )}

          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              message.role === 'user'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            <div className="text-sm whitespace-pre-wrap break-words prose prose-sm max-w-none">
              {message.role === 'assistant' ? (
                <div className="markdown-content">
                  {renderMarkdown(message.content)}
                </div>
              ) : (
                <p>{message.content}</p>
              )}
            </div>
            <p
              className={`text-xs mt-1 ${
                message.role === 'user' ? 'text-white/70' : 'text-gray-500'
              }`}
            >
              {formatTime(message.timestamp)}
            </p>
          </div>

          {message.role === 'user' && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
