// src/components/Auth/PlanProtectedRoute.tsx
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PlanFeatures } from '../../config/subscriptionConfig';

interface PlanProtectedRouteProps {
  children: React.ReactNode;
  feature: keyof PlanFeatures;
  featureName?: string;
  fallbackPath?: string; // Where to redirect if no access
}

export const PlanProtectedRoute: React.FC<PlanProtectedRouteProps> = ({ 
  children, 
  feature,
  featureName,
  fallbackPath = '/dashboard' // Default fallback
}) => {
  const navigate = useNavigate();
  const { hasFeature, setAnticipationModalState } = useSubscription();
  const hasAccess = hasFeature(feature);
  const hasCheckedAccess = useRef(false);
  
  useEffect(() => {
    if (!hasAccess && !hasCheckedAccess.current) {
      hasCheckedAccess.current = true;
      
      // Show the modal with a custom onClose handler
      setAnticipationModalState({
        isOpen: true,
        type: 'feature',
        context: {
          featureName: featureName || feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          fallbackPath: fallbackPath // Pass the fallback path to the modal
        }
      });
    }
  }, [hasAccess, feature, featureName, setAnticipationModalState, fallbackPath]);
  
  // Don't render restricted content
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return <>{children}</>;
};