import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Star, Zap, Rocket, Building, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../services/supabaseClient';

interface PlanType {
  id: string;
  name: string;
  price: number;
  yearlyPrice: number;
  features: string[];
  highlighted?: string[];
  popular?: boolean;
  icon: any;
}

const PLANS: PlanType[] = [
  {
    id: 'simple_start',
    name: 'Simple Start',
    price: 15,
    yearlyPrice: 144, // 20% off
    icon: Star,
    features: [
      'Single user access',
      'Unlimited invoices',
      'Track income & expenses',
      'Basic financial reports',
      'Category management',
      'Client management',
      'Export to PDF',
      'Email support'
    ],
    highlighted: ['Single user access']
  },
  {
    id: 'essentials',
    name: 'Essentials',
    price: 30,
    yearlyPrice: 288,
    icon: Zap,
    popular: true,
    features: [
      'Up to 3 users',
      'Everything in Simple Start',
      'Advanced reports',
      'Tax management',
      'Multi-currency support',
      'Invoice templates',
      'Recurring invoices',
      'Priority email support'
    ],
    highlighted: ['Up to 3 users', 'Multi-currency support']
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 45,
    yearlyPrice: 432,
    icon: Rocket,
    features: [
      'Up to 5 users',
      'Everything in Essentials',
      'Custom invoice branding',
      'Advanced tax reports',
      'Profit & loss statements',
      'Cash flow analysis',
      'Budget tracking',
      'Phone & email support'
    ],
    highlighted: ['Up to 5 users', 'Budget tracking']
  },
  {
    id: 'advanced',
    name: 'Advanced',
    price: 85,
    yearlyPrice: 816,
    icon: Building,
    features: [
      'Up to 25 users',
      'Everything in Plus',
      'Custom report builder',
      'API access',
      'Advanced analytics',
      'Team permissions',
      'Audit trail',
      'Dedicated account manager'
    ],
    highlighted: ['Up to 25 users', 'API access', 'Dedicated account manager']
  }
];

export const SubscriptionPlans: React.FC = () => {
  const { user } = useAuth();
  const { subscription, refreshData } = useData();
  const navigate = useNavigate();
  const currentPlan = subscription?.plan || 'simple_start';
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);

  useEffect(() => {
    if (user) {
      if (subscription?.status === 'trialing') {
        const created = new Date(subscription.created_at);
        const trialEnd = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 day trial
        const now = new Date();
        const diffTime = trialEnd.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setTrialDaysLeft(diffDays > 0 ? diffDays : 0);
      }
    }
  }, [user, subscription]);

  const handleUpgrade = async (planId: string) => {
    if (!user || planId === currentPlan) return;
    
    setLoading(true);
    
    try {
      // For now, just update the plan in the database
      // Later you'll integrate Stripe here
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan: planId,
          interval: billingInterval,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      // Reload subscription
      await refreshData();
      
      // Show success message
      alert('Plan updated successfully!');
      
    } catch (err: any) {
      console.error('Error updating plan:', err);
      alert('Error updating plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPlanIndex = (planId: string) => {
    return PLANS.findIndex(p => p.id === planId);
  };

  const isDowngrade = (planId: string) => {
    if (!currentPlan) return false;
    return getPlanIndex(planId) < getPlanIndex(currentPlan);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header with back button */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Settings
        </button>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Choose Your Plan</h1>
            <p className="mt-2 text-lg text-gray-600">
              Select the plan that best fits your business needs
            </p>
          </div>
          
          {trialDaysLeft > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-blue-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Trial Period
                  </p>
                  <p className="text-sm text-blue-700">
                    {trialDaysLeft} days left
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current plan indicator */}
      {currentPlan && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            Current plan: <span className="font-semibold text-gray-900">
              {PLANS.find(p => p.id === currentPlan)?.name || currentPlan}
            </span>
            {' '}({billingInterval === 'yearly' ? 'Yearly' : 'Monthly'} billing)
          </p>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingInterval === 'monthly'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Monthly billing
          </button>
          <button
            onClick={() => setBillingInterval('yearly')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingInterval === 'yearly'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Yearly billing
            <span className="ml-2 text-green-600 text-xs">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const price = billingInterval === 'yearly' ? plan.yearlyPrice : plan.price;
          const isCurrentPlan = currentPlan === plan.id;
          const isDowngradePlan = isDowngrade(plan.id);
          
          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-lg shadow-lg overflow-hidden ${
                plan.popular ? 'ring-2 ring-blue-500' : ''
              } ${isCurrentPlan ? 'border-2 border-green-500' : ''}`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-3 py-1 rounded-bl-lg">
                  Most Popular
                </div>
              )}
              
              {isCurrentPlan && (
                <div className="absolute top-0 left-0 bg-green-500 text-white text-xs px-3 py-1 rounded-br-lg">
                  Current Plan
                </div>
              )}
              
              <div className="p-6">
                <div className="text-center mb-4">
                  <Icon className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                  <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                  <div className="mt-3">
                    <span className="text-4xl font-bold text-gray-900">${price}</span>
                    <span className="text-gray-600">
                      /{billingInterval === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  {billingInterval === 'yearly' && (
                    <p className="text-sm text-green-600 mt-1">
                      Save ${plan.price * 12 - plan.yearlyPrice} per year
                    </p>
                  )}
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => {
                    const isHighlighted = plan.highlighted?.includes(feature);
                    return (
                      <li key={index} className="flex items-start">
                        <Check className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${
                          isHighlighted ? 'text-blue-600' : 'text-green-500'
                        }`} />
                        <span className={`text-sm ${
                          isHighlighted ? 'font-medium text-gray-900' : 'text-gray-600'
                        }`}>
                          {feature}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading || isCurrentPlan}
                  className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                    isCurrentPlan
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDowngradePlan
                      ? 'bg-gray-600 text-white hover:bg-gray-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {isCurrentPlan 
                    ? 'Current Plan' 
                    : isDowngradePlan 
                    ? 'Downgrade' 
                    : 'Upgrade'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional info */}
      <div className="mt-12 text-center text-sm text-gray-600">
        <p>All plans include automatic backups, SSL security, and 24/7 system monitoring.</p>
        <p className="mt-2">
          Need help choosing? <a href="mailto:support@accubooks.com" className="text-blue-600 hover:underline">
            Contact our sales team
          </a>
        </p>
      </div>
    </div>
  );
};