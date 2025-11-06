import React from 'react';
import { Zap, Loader2 } from 'lucide-react';

interface CreditsIndicatorProps {
  creditsRemaining: number;
  isLoading?: boolean;
}

export const CreditsIndicator: React.FC<CreditsIndicatorProps> = ({
  creditsRemaining,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading credits...</span>
      </div>
    );
  }

  // Assume default daily limit of 50 (can be made dynamic later)
  const dailyLimit = 50;
  const creditsUsed = dailyLimit - creditsRemaining;
  const percentageUsed = (creditsUsed / dailyLimit) * 100;

  const getColorClass = () => {
    if (percentageUsed >= 90) return 'bg-red-500';
    if (percentageUsed >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = () => {
    if (percentageUsed >= 90) return 'text-red-600';
    if (percentageUsed >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Zap className={`h-3 w-3 ${getTextColor()}`} />
          <span className="text-gray-600">AI Credits</span>
        </div>
        <span className={`font-semibold ${getTextColor()}`}>
          {creditsRemaining} / {dailyLimit} remaining
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${getColorClass()}`}
          style={{ width: `${Math.min(100, percentageUsed)}%` }}
        />
      </div>
      {percentageUsed >= 80 && creditsRemaining > 0 && (
        <p className="text-xs text-yellow-600 mt-1">
          {percentageUsed >= 90 ? 'Almost out of credits!' : 'Credits running low'}
        </p>
      )}
      {creditsRemaining === 0 && (
        <p className="text-xs text-red-600 mt-1">
          Credits exhausted. They reset daily.
        </p>
      )}
    </div>
  );
};
