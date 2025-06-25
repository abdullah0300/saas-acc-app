// src/components/Auth/PlanProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { FeatureGate } from '../Subscription/FeatureGate';
import { PlanFeatures } from '../../config/subscriptionConfig';

interface PlanProtectedRouteProps {
  children: React.ReactNode;
  feature: keyof PlanFeatures;
  redirectTo?: string;
  showModal?: boolean;
}

export const PlanProtectedRoute: React.FC<PlanProtectedRouteProps> = ({ 
  children, 
  feature,
  redirectTo = '/settings/subscription',
  showModal = true
}) => {
  const { hasFeature, loading } = useSubscription();
  
  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  // Check if user has access to this feature
  if (!hasFeature(feature)) {
    if (showModal) {
      return (
        <>
          <Navigate to={redirectTo} />
          <FeatureGate feature={feature} variant="modal">
            {/* Empty fragment as children since we're just showing the modal */}
            <></>
          </FeatureGate>
        </>
      );
    }
    
    return <Navigate to={redirectTo} />;
  }
  
  // User has access, render the protected content
  return <>{children}</>;
};