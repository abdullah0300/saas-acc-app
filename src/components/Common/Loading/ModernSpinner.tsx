// src/components/Common/Loading/ModernSpinner.tsx
import React from 'react';

interface ModernSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  variant?: 'primary' | 'success' | 'financial';
}

export const ModernSpinner: React.FC<ModernSpinnerProps> = ({ 
  size = 'md', 
  message = '',
  variant = 'primary'
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12', 
    lg: 'w-16 h-16'
  };

  const colorClasses = {
    primary: 'border-blue-600',
    success: 'border-green-600', 
    financial: 'border-emerald-600'
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      {/* Modern Spinner */}
      <div className="relative">
        <div className={`
          ${sizeClasses[size]} 
          border-4 border-gray-200 border-t-transparent rounded-full animate-spin
        `} />
        <div className={`
          absolute inset-0 
          ${sizeClasses[size]} 
          border-4 border-transparent ${colorClasses[variant]}
          rounded-full animate-pulse
        `} />
      </div>
      
      {/* Financial Icon Animation */}
      {variant === 'financial' && (
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
      
      {/* Message */}
      {message && (
        <p className="text-sm font-medium text-gray-600 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};