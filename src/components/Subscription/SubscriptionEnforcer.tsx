// src/components/Subscription/SubscriptionEnforcer.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { TrialExpiredModal } from './TrialExpiredModal';
import { SUBSCRIPTION_PLANS } from '../../config/subscriptionConfig';

export const SubscriptionEnforcer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscription, loading, plan, refreshSubscription } = useSubscription();
  const [showModal, setShowModal] = useState(false);
  
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
      
      // Debug logging
      console.log('Subscription check:', {
        trialExpired,
        hasNoStripeSubscription,
        isNotActive,
        status: subscription.status,
        stripe_subscription_id: subscription.stripe_subscription_id,
        trial_end: subscription.trial_end
      });
      
      // If trial expired and no payment method AND not active
      if (trialExpired && hasNoStripeSubscription && isNotActive) {
        if (isOnExemptPath) {
          // Hide modal on subscription/payment pages
          setShowModal(false);
        } else {
          // Show modal on all other pages
          console.log('Trial expired, showing modal');
          setShowModal(true);
        }
      } else {
        setShowModal(false);
      }
    }
  }, [subscription, loading, location]);
  
  const planDisplayName = SUBSCRIPTION_PLANS[plan]?.displayName || 'Simple Start';
  
  return (
    <>
      <TrialExpiredModal 
        isOpen={showModal} 
        planName={planDisplayName}
      />
      {children}
    </>
  );
};