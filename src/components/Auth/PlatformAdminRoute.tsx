// src/components/Auth/PlatformAdminRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTeamPermissions } from '../../hooks/useTeamPermissions';
import { Loader2 } from 'lucide-react';

interface PlatformAdminRouteProps {
  children: React.ReactNode;
}

export const PlatformAdminRoute: React.FC<PlatformAdminRouteProps> = ({ children }) => {
  const { isPlatformAdmin, loading } = useTeamPermissions();

  // Show loading state while checking permissions
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect non-platform-admins to dashboard
  if (!isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render children for platform admins
  return <>{children}</>;
};
