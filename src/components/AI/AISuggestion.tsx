import React from 'react';
import { Brain, Check, X } from 'lucide-react';

interface AISuggestionProps {
  suggestion: {
    category?: string;
    confidence: number;
    reason: string;   
    
  };
  onAccept: (category: string) => void;
  onReject: () => void;
  loading?: boolean;
}

export const AISuggestion: React.FC<AISuggestionProps> = ({
  suggestion,
  onAccept,
  onReject,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <Brain className="h-4 w-4 animate-pulse text-blue-600" />
        <span>AI is analyzing...</span>
      </div>
    );
  }

  if (!suggestion.category || suggestion.confidence < 0.5) {
    return null; // Don't show low-confidence suggestions
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              AI suggests: <span className="font-semibold">{suggestion.category}</span>
            </p>
            <p className="text-xs text-blue-700">{suggestion.reason}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAccept(suggestion.category!)}
            className="p-1 text-green-600 hover:bg-green-100 rounded"
            title="Accept suggestion"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onReject}
            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-1 text-xs text-blue-600">
        <span>Confidence:</span>
        <div className="flex-1 bg-blue-200 rounded-full h-1">
          <div 
            className="bg-blue-600 h-1 rounded-full" 
            style={{ width: `${suggestion.confidence * 100}%` }}
          />
        </div>
        <span>{Math.round(suggestion.confidence * 100)}%</span>
      </div>
    </div>
  );
};