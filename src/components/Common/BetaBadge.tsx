// src/components/Common/BetaBadge.tsx
import React from 'react';

interface BetaBadgeProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'gradient' | 'outline' | 'subtle';
  className?: string;
}

export const BetaBadge: React.FC<BetaBadgeProps> = ({
  size = 'small',
  variant = 'gradient',
  className = ''
}) => {
  const sizeClasses = {
    small: 'px-2 py-0.5 text-[10px]',
    medium: 'px-2.5 py-1 text-xs',
    large: 'px-3 py-1.5 text-sm'
  };

  const variantClasses = {
    gradient: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm',
    outline: 'border-2 border-purple-500 text-purple-600 bg-white',
    subtle: 'bg-purple-100 text-purple-700 border border-purple-200'
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold tracking-wide ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      BETA
    </span>
  );
};
