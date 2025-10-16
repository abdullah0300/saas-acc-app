// src/components/Auth/SEOAdminRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTeamPermissions } from '../../hooks/useTeamPermissions';
import { Loader2 } from 'lucide-react';

interface SEOAdminRouteProps {
  children: React.ReactNode;
}

/**
 * SEOAdminRoute - Protects routes that should only be accessible to SEO Admins or Platform Admins
 *
 * This route guard allows:
 * - Platform Admins (full access to everything)
 * - SEO Admins (access to SEO Manager and Blog Manager only)
 *
 * Regular users (account owners and team members) are redirected to dashboard.
 */
export const SEOAdminRoute: React.FC<SEOAdminRouteProps> = ({ children }) => {
  const { isSEOAdmin, loading } = useTeamPermissions();

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

  // Redirect non-SEO-admins to dashboard
  if (!isSEOAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render children for SEO admins and platform admins
  return <>{children}</>;
};
