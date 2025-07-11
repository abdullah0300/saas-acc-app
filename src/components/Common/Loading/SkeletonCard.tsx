// src/components/Common/Loading/SkeletonCard.tsx
import React from 'react';

interface SkeletonCardProps {
  count?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  count = 1, 
  className = "" 
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div 
          key={index}
          className={`bg-white rounded-2xl shadow-xl p-6 border border-gray-100 ${className}`}
        >
          {/* Icon placeholder */}
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl animate-pulse" />
            <div className="w-20 h-6 bg-gray-200 rounded-full animate-pulse" />
          </div>
          
          {/* Title */}
          <div className="w-24 h-4 bg-gray-200 rounded animate-pulse mb-2" />
          
          {/* Main amount */}
          <div className="w-32 h-8 bg-gray-300 rounded animate-pulse mb-2" />
          
          {/* Subtitle */}
          <div className="w-28 h-3 bg-gray-200 rounded animate-pulse" />
          
          {/* Shimmer effect overlay */}
          <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        </div>
      ))}
    </>
  );
};