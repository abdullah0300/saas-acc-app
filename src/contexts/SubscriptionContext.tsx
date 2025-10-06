// src/contexts/SubscriptionContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { getEffectiveUserId } from '../services/database';
import {
  PlanType,
  getPlanConfig,
  hasFeature,
  getPlanLimits,
  canAddMoreUsers,
  canCreateInvoice,
  PlanFeatures,
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD
} from '../config/subscriptionConfig';

interface Usage {
  users: number;
  monthlyInvoices: number;
  totalInvoices: number;
  totalClients: number;
}

interface SubscriptionData {
  id: string;
  user_id: string;
  plan: PlanType;
  interval: 'monthly' | 'yearly';
  status: string;
  trial_end: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  plan: PlanType;
  usage: Usage;
  limits: any;
  loading: boolean;
  error: string | null;
  
  // Feature checks
  hasFeature: (feature: keyof PlanFeatures) => boolean;
  canAddUsers: () => boolean;
  canCreateInvoice: () => boolean;
  canAddClients: () => boolean;
  
  // Usage checks
  isNearLimit: (type: 'users' | 'invoices' | 'clients') => boolean;
  isCriticalLimit: (type: 'users' | 'invoices' | 'clients') => boolean;
  getUsagePercentage: (type: 'users' | 'invoices' | 'clients') => number;
  
  // Status checks
  isTrialing: () => boolean;
  trialDaysLeft: () => number;
  isActive: () => boolean;
  hasPaidSubscription: () => boolean;  // 🔥 ADD THIS LINE

  // Actions
  refreshUsage: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
   showAnticipationModal: (type: 'usage' | 'feature' | 'trial', context?: any) => void;
  anticipationModalState: {
    isOpen: boolean;
    type: 'usage' | 'feature' | 'trial';
    context?: any;
  };
  setAnticipationModalState: (state: any) => void;

}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<Usage>({
    users: 1,
    monthlyInvoices: 0,
    totalInvoices: 0,
    totalClients: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
// ADD THESE NEW LINES:
const [lastModalShown, setLastModalShown] = useState<{
  [key: string]: Date;
}>({});
const [anticipationModalState, setAnticipationModalState] = useState<{
  isOpen: boolean;
  type: 'usage' | 'feature' | 'trial';
  context?: any;
}>({ isOpen: false, type: 'usage' });

  const plan = (subscription?.plan || 'simple_start') as PlanType;
  const limits = getPlanLimits(plan);

  // ADD THIS NEW FUNCTION:
const shouldShowAnticipationModal = (key: string): boolean => {
  const lastShown = lastModalShown[key];
  if (!lastShown) return true;
  
  const daysSinceLastShown = (new Date().getTime() - lastShown.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLastShown >= 7; // Show again after 7 days
};

const showAnticipationModal = (type: 'usage' | 'feature' | 'trial', context?: any) => {
  const modalKey = `${type}-${context?.itemType || context?.featureName || 'default'}`;
  
  if (shouldShowAnticipationModal(modalKey)) {
    setAnticipationModalState({ isOpen: true, type, context });
    setLastModalShown({ ...lastModalShown, [modalKey]: new Date() });
  }
};

// Existing loadSubscription function continues here...
  // Load subscription data
  const loadSubscription = useCallback(async () => {
    if (!user) return;

    try {
      // Get effective user ID (owner's ID for team members, own ID for owners/solo users)
      const effectiveUserId = await getEffectiveUserId(user.id);

      const { data, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', effectiveUserId)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      // If no subscription exists, create a trial (only for owners, not team members)
      if (!data && effectiveUserId === user.id) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);

        const { data: newSub, error: createError } = await supabase
          .from('subscriptions')
          .insert([{
            user_id: user.id,
            plan: 'simple_start',
            interval: 'monthly',
            status: 'trialing',
            trial_end: trialEnd.toISOString(),
            current_period_start: new Date().toISOString(),
            current_period_end: trialEnd.toISOString()
          }])
          .select()
          .single();

        if (createError) throw createError;
        setSubscription(newSub);
      } else {
        setSubscription(data);
      }
    } catch (err: any) {
      console.error('Error loading subscription:', err);
      setError(err.message);
    }
  }, [user]);

  // Load usage data
  const loadUsage = useCallback(async () => {
    if (!user) return;

    try {
      // Get effective user ID (owner's ID for team members, own ID for owners/solo users)
      const effectiveUserId = await getEffectiveUserId(user.id);

      // Get team members count
      const { count: teamCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', effectiveUserId)
        .eq('status', 'active');

      // Get clients count
      const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId);

      // Get total invoices
      const { count: totalInvoiceCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId);

      // Get monthly invoices (current month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: monthlyInvoiceCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId)
        .gte('created_at', startOfMonth.toISOString());

      setUsage({
        users: (teamCount || 0) + 1, // +1 for the owner
        monthlyInvoices: monthlyInvoiceCount || 0,
        totalInvoices: totalInvoiceCount || 0,
        totalClients: clientCount || 0
      });
    } catch (err: any) {
      console.error('Error loading usage:', err);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await loadSubscription();
      await loadUsage();
      setLoading(false);
    };

    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, loadSubscription, loadUsage]);

  // Subscribe to subscription changes
  useEffect(() => {
    if (!user) return;

    const setupSubscription = async () => {
      // Get effective user ID to listen for the right subscription changes
      const effectiveUserId = await getEffectiveUserId(user.id);

      const subscription = supabase
        .channel('subscription_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscriptions',
            filter: `user_id=eq.${effectiveUserId}`
          },
          () => {
            loadSubscription();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    };

    const cleanup = setupSubscription();

    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [user, loadSubscription]);

  // Listen for invoice creation events
useEffect(() => {
  const handleInvoiceCreated = (event: CustomEvent) => {
    const { usage, limit } = event.detail;
    showAnticipationModal('usage', {
      currentUsage: usage,
      limit: limit,
      itemType: 'invoices'
    });
  };
  
  window.addEventListener('invoiceCreated', handleInvoiceCreated as EventListener);
  return () => {
    window.removeEventListener('invoiceCreated', handleInvoiceCreated as EventListener);
  };
}, [showAnticipationModal]);

  // Feature checks
  const checkFeature = (feature: keyof PlanFeatures): boolean => {
    return hasFeature(plan, feature);
  };

  const checkCanAddUsers = (): boolean => {
    return canAddMoreUsers(plan, usage.users);
  };

  const checkCanCreateInvoice = (): boolean => {
  const canCreate = canCreateInvoice(plan, usage.monthlyInvoices);
  
  // ADD THESE NEW LINES:
  // Check if we should show anticipation modal (at 80% usage)
  if (limits.monthlyInvoices > 0) {
    const usagePercentage = (usage.monthlyInvoices / limits.monthlyInvoices) * 100;
    if (usagePercentage >= 80 && usagePercentage < 100 && canCreate) {
      showAnticipationModal('usage', {
        currentUsage: usage.monthlyInvoices,
        limit: limits.monthlyInvoices,
        itemType: 'invoices'
      });
    }
  }
  
  return canCreate;
};
  const checkCanAddClients = (): boolean => {
    if (limits.totalClients === -1) return true;
    return usage.totalClients < limits.totalClients;
  };

  // Usage percentage checks
  const getUsagePercentage = (type: 'users' | 'invoices' | 'clients'): number => {
    switch (type) {
      case 'users':
        if (limits.users === -1) return 0;
        return (usage.users / limits.users) * 100;
      
      case 'invoices':
        if (limits.monthlyInvoices === -1) return 0;
        return (usage.monthlyInvoices / limits.monthlyInvoices) * 100;
      
      case 'clients':
        if (limits.totalClients === -1) return 0;
        return (usage.totalClients / limits.totalClients) * 100;
      
      default:
        return 0;
    }
  };

  const isNearLimit = (type: 'users' | 'invoices' | 'clients'): boolean => {
    const percentage = getUsagePercentage(type) / 100;
    return percentage >= WARNING_THRESHOLD && percentage < 1;
  };

  const isCriticalLimit = (type: 'users' | 'invoices' | 'clients'): boolean => {
    const percentage = getUsagePercentage(type) / 100;
    return percentage >= CRITICAL_THRESHOLD && percentage < 1;
  };

  // Status checks
  const isTrialing = (): boolean => {
    if (!subscription) return false;
    return subscription.status === 'trialing' && 
           subscription.trial_end !== null &&
           new Date(subscription.trial_end) > new Date();
  };

  const trialDaysLeft = (): number => {
    if (!isTrialing() || !subscription?.trial_end) return 0;
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };

  const isActive = (): boolean => {
  if (!subscription) return false;
  
  // 🔥 FIXED: Properly check for active subscription
  // User is active if:
  // 1. They have 'active' status (paid subscription), OR
  // 2. They are currently in a valid trial
  return subscription.status === 'active' || 
         (subscription.status === 'trialing' && isTrialing());
};

// 🔥 NEW: Add helper to check if user has paid subscription
const hasPaidSubscription = (): boolean => {
  if (!subscription) return false;
  return subscription.status === 'active' && !!subscription.stripe_subscription_id;
};

  // Actions
  const refreshUsage = async () => {
    await loadUsage();
  };

  const refreshSubscription = async () => {
    await loadSubscription();
  };

  const value: SubscriptionContextType = {
    subscription,
    plan,
    usage,
    limits,
    loading,
    error,
    hasFeature: checkFeature,
    canAddUsers: checkCanAddUsers,
    canCreateInvoice: checkCanCreateInvoice,
    canAddClients: checkCanAddClients,
    isNearLimit,
    isCriticalLimit,
    getUsagePercentage,
    isTrialing,
    trialDaysLeft,
    isActive,
    hasPaidSubscription,
    refreshUsage,
    refreshSubscription,
    showAnticipationModal,
    anticipationModalState,
    setAnticipationModalState
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};