// src/components/Common/Loading/SkeletonTable.tsx
import React from 'react';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  hasActions?: boolean;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ 
  rows = 8, 
  columns = 5,
  hasActions = true 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="grid grid-cols-12 gap-4">
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="col-span-2">
              <div className="h-4 bg-gray-300 rounded animate-pulse" />
            </div>
          ))}
          {hasActions && (
            <div className="col-span-2">
              <div className="h-4 bg-gray-300 rounded animate-pulse" />
            </div>
          )}
        </div>
      </div>
      
      {/* Table Rows */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4 hover:bg-gray-50">
            <div className="grid grid-cols-12 gap-4 items-center">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className="col-span-2">
                  {colIndex === 0 ? (
                    // First column - usually has emphasis
                    <div className="h-5 bg-gray-400 rounded animate-pulse" />
                  ) : colIndex === columns - 1 ? (
                    // Last column - usually amounts
                    <div className="h-5 bg-gray-300 rounded animate-pulse w-20 ml-auto" />
                  ) : (
                    // Regular columns
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  )}
                </div>
              ))}
              
              {hasActions && (
                <div className="col-span-2 flex justify-end space-x-2">
                  <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                  <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                  <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Shimmer overlay for entire table */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
    </div>
  );
};