// src/components/Common/Loading/SmoothTransition.tsx
import React from 'react';

interface SmoothTransitionProps {
  children: React.ReactNode;
  loading: boolean;
  loadingComponent: React.ReactNode;
  className?: string;
}

export const SmoothTransition: React.FC<SmoothTransitionProps> = ({
  children,
  loading,
  loadingComponent,
  className = ""
}) => {
  return (
    <div className={`transition-all duration-300 ease-in-out ${className}`}>
      {loading ? (
        <div className="opacity-0 animate-pulse transition-opacity duration-300">
          {loadingComponent}
        </div>
      ) : (
        <div className="opacity-100 transition-all duration-300 ease-in-out">
          {children}
        </div>
      )}
    </div>
  );
};