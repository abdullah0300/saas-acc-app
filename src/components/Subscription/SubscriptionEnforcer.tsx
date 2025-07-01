// src/components/Subscription/SubscriptionEnforcer.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { TrialExpiredModal } from './TrialExpiredModal';
import { AnticipationModal } from './AnticipationModal';
import { SUBSCRIPTION_PLANS } from '../../config/subscriptionConfig';

export const SubscriptionEnforcer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    subscription, 
    loading, 
    plan, 
    refreshSubscription,
    anticipationModalState,
    setAnticipationModalState,
    trialDaysLeft,
    isTrialing
  } = useSubscription();
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);
  
  useEffect(() => {
    // Refresh subscription data when coming back from payment
    if (location.pathname === '/payment/success' || 
        (location.pathname === '/dashboard' && subscription?.status === 'trialing')) {
      refreshSubscription();
    }
  }, [location.pathname]);
  
  useEffect(() => {
    if (loading) return;
    
    // Check if we're on exempt paths
    const exemptPaths = ['/settings/subscription', '/payment/success', '/login', '/register'];
    const isOnExemptPath = exemptPaths.some(path => location.pathname.includes(path));
    
    if (subscription) {
      const trialExpired = subscription.trial_end && new Date(subscription.trial_end) < new Date();
      const hasNoStripeSubscription = !subscription.stripe_subscription_id;
      const isNotActive = subscription.status !== 'active';
      
      // If trial expired and no payment method AND not active
      if (trialExpired && hasNoStripeSubscription && isNotActive) {
        if (isOnExemptPath) {
          setShowTrialExpiredModal(false);
        } else {
          setShowTrialExpiredModal(true);
        }
      } else {
        setShowTrialExpiredModal(false);
      }
      
      // Check for trial ending soon (3 days or less)
      if (isTrialing() && trialDaysLeft() <= 3 && trialDaysLeft() > 0 && !isOnExemptPath) {
        setAnticipationModalState({
          isOpen: true,
          type: 'trial',
          context: { daysLeft: trialDaysLeft() }
        });
      }
    }
  }, [subscription, loading, location]);
  
  const planDisplayName = SUBSCRIPTION_PLANS[plan]?.displayName || 'Simple Start';
  
  return (
    <>
      <TrialExpiredModal 
        isOpen={showTrialExpiredModal} 
        planName={planDisplayName}
      />
      
      <AnticipationModal
        isOpen={anticipationModalState.isOpen}
        onClose={(action) => {
          setAnticipationModalState({ ...anticipationModalState, isOpen: false });
          
          // If this was a feature restriction modal and user dismissed it, redirect
          if (action === 'dismiss' && 
              anticipationModalState.type === 'feature' && 
              anticipationModalState.context?.fallbackPath) {
            navigate(anticipationModalState.context.fallbackPath);
          }
        }}
        type={anticipationModalState.type}
        context={anticipationModalState.context}
      />
      
      {children}
    </>
  );
};