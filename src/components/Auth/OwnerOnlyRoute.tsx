// src/components/Auth/OwnerOnlyRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { Loader2 } from 'lucide-react';

interface OwnerOnlyRouteProps {
  children: React.ReactNode;
}

export const OwnerOnlyRoute: React.FC<OwnerOnlyRouteProps> = ({ children }) => {
  const { userRole, isLoading } = useData();

  // Show loading state while checking user role
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect team members and admins to dashboard
  if (userRole !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }

  // Render children for owners
  return <>{children}</>;
};
