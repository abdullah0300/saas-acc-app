import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

// Type definitions
type PlanType = 'free' | 'basic' | 'professional' | 'enterprise';
type FeatureType = 'invoices' | 'clients' | 'reports' | 'multi-currency' | 'api' | 'team';
type LimitType = 'invoices' | 'clients' | 'income' | 'expenses';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  feature: FeatureType;
  minPlan?: PlanType;
}

const PLAN_HIERARCHY: Record<PlanType, number> = {
  free: 0,
  basic: 1,
  professional: 2,
  enterprise: 3
};

const FEATURE_REQUIREMENTS: Record<FeatureType, PlanType> = {
  invoices: 'free',
  clients: 'free',
  reports: 'free',
  'multi-currency': 'basic',
  api: 'professional',
  team: 'professional'
};

const PLAN_LIMITS: Record<PlanType, Record<LimitType, number>> = {
  free: {
    invoices: 5,
    clients: 10,
    income: 50,
    expenses: 50
  },
  basic: {
    invoices: 50,
    clients: 100,
    income: 500,
    expenses: 500
  },
  professional: {
    invoices: -1, // unlimited
    clients: -1,
    income: -1,
    expenses: -1
  },
  enterprise: {
    invoices: -1,
    clients: -1,
    income: -1,
    expenses: -1
  }
};

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ 
  children, 
  feature, 
  minPlan = 'free' 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      setSubscription(data);
      
      // Check if user has access to this feature
      const userPlanLevel = PLAN_HIERARCHY[data.plan as PlanType] || 0;
      const requiredPlanLevel = PLAN_HIERARCHY[minPlan] || 0;
      const featureRequiredPlan = FEATURE_REQUIREMENTS[feature] || 'free';
      const featureRequiredLevel = PLAN_HIERARCHY[featureRequiredPlan as PlanType] || 0;
      
      const actualRequiredLevel = Math.max(requiredPlanLevel, featureRequiredLevel);
      
      setHasAccess(userPlanLevel >= actualRequiredLevel);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex">
            <AlertCircle className="h-6 w-6 text-yellow-600 mt-1" />
            <div className="ml-3">
              <h3 className="text-lg font-medium text-yellow-900">
                Upgrade Required
              </h3>
              <p className="mt-2 text-sm text-yellow-700">
                This feature requires a {minPlan === 'free' ? FEATURE_REQUIREMENTS[feature] : minPlan} plan or higher.
                You are currently on the {subscription?.plan || 'free'} plan.
              </p>
              <div className="mt-4">
                <button
                  onClick={() => navigate('/settings/subscription')}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors"
                >
                  Upgrade Now
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="ml-3 text-yellow-700 hover:text-yellow-800"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Usage Hook
export const useSubscriptionLimits = () => {
  const { user } = useAuth();
  const [limits, setLimits] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    if (user) {
      checkLimitsAndUsage();
    }
  }, [user]);

  const checkLimitsAndUsage = async () => {
    if (!user) return;

    try {
      // Get subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const plan = (subData?.plan || 'free') as PlanType;
      setLimits(PLAN_LIMITS[plan]);

      // Get current month usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Count invoices
      const { count: invoiceCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString());

      // Count other entities
      const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setUsage({
        invoices: invoiceCount || 0,
        clients: clientCount || 0
      });
    } catch (err) {
      console.error('Error checking limits:', err);
    }
  };

  const canCreate = (type: LimitType) => {
    if (!limits || !usage) return true;
    if (limits[type] === -1) return true; // Unlimited
    return usage[type] < limits[type];
  };

  return { limits, usage, canCreate };
};