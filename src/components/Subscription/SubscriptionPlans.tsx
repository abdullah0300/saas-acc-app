// src/components/Subscription/SubscriptionPlans.tsx
import React, { useState, useEffect } from 'react';
import { Check, X, Loader, CreditCard, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSubscription } from '../../services/database';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '../../services/supabaseClient';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY!);

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
  limitations: { [key: string]: number | boolean };
  stripePriceId: string;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: [
      'Up to 10 invoices/month',
      'Basic income & expense tracking',
      'Single user',
      'Basic reports',
      'Email support'
    ],
    limitations: {
      invoices_per_month: 10,
      users: 1,
      storage_gb: 1,
      multi_currency: false,
      recurring_invoices: false,
      advanced_reports: false
    },
    stripePriceId: ''
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 19,
    features: [
      'Up to 50 invoices/month',
      'Advanced income & expense tracking',
      'Up to 3 users',
      'Advanced reports',
      'Priority email support',
      'Receipt scanning'
    ],
    limitations: {
      invoices_per_month: 50,
      users: 3,
      storage_gb: 5,
      multi_currency: true,
      recurring_invoices: false,
      advanced_reports: true
    },
    stripePriceId: process.env.REACT_APP_STRIPE_BASIC_PRICE_ID!
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 49,
    features: [
      'Unlimited invoices',
      'All tracking features',
      'Up to 10 users',
      'Custom reports',
      'Priority support',
      'Recurring invoices',
      'Multi-currency support',
      'API access'
    ],
    limitations: {
      invoices_per_month: -1, // unlimited
      users: 10,
      storage_gb: 25,
      multi_currency: true,
      recurring_invoices: true,
      advanced_reports: true,
      api_access: true
    },
    stripePriceId: process.env.REACT_APP_STRIPE_PRO_PRICE_ID!,
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    features: [
      'Everything in Professional',
      'Unlimited users',
      'Unlimited storage',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
      'Custom training',
      'White-label options'
    ],
    limitations: {
      invoices_per_month: -1,
      users: -1,
      storage_gb: -1,
      multi_currency: true,
      recurring_invoices: true,
      advanced_reports: true,
      api_access: true,
      white_label: true
    },
    stripePriceId: process.env.REACT_APP_STRIPE_ENTERPRISE_PRICE_ID!
  }
];

export const SubscriptionPlans: React.FC = () => {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadCurrentSubscription();
    }
  }, [user]);

  const loadCurrentSubscription = async () => {
    if (!user) return;
    
    try {
      const subscription = await getSubscription(user.id);
      setCurrentPlan(subscription?.plan || 'free');
    } catch (err: any) {
      console.error('Error loading subscription:', err);
    }
  };

  const handleSubscribe = async (plan: Plan) => {
    if (!user || plan.id === 'free' || plan.id === currentPlan) return;
    
    setLoading(plan.id);
    setError('');
    
    try {
      // Create checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: plan.stripePriceId,
          userId: user.id,
          userEmail: user.email,
          planId: plan.id
        }
      });
      
      if (error) throw error;
      
      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe not loaded');
      
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId
      });
      
      if (stripeError) throw stripeError;
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    
    setLoading('manage');
    
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h1>
        <p className="text-xl text-gray-600">
          Start free, upgrade when you need more features
        </p>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl shadow-lg p-8 ${
              plan.popular ? 'ring-2 ring-blue-500 transform scale-105' : ''
            } ${currentPlan === plan.id ? 'bg-blue-50' : ''}`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
            )}
            
            {currentPlan === plan.id && (
              <div className="absolute -top-4 right-4">
                <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  Current Plan
                </span>
              </div>
            )}

            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-gray-500">/month</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            {currentPlan === plan.id ? (
              <button
                onClick={handleManageSubscription}
                disabled={loading === 'manage'}
                className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading === 'manage' ? (
                  <Loader className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  'Manage Subscription'
                )}
              </button>
            ) : plan.id === 'free' ? (
              <button
                disabled
                className="w-full py-3 px-4 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
              >
                Downgrade Not Available
              </button>
            ) : (
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={loading === plan.id}
                className={`w-full py-3 px-4 rounded-lg transition-colors disabled:opacity-50 ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {loading === plan.id ? (
                  <Loader className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  'Upgrade Now'
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-gray-600">
          All plans include SSL security, automatic backups, and GDPR compliance
        </p>
        <p className="text-sm text-gray-500 mt-2">
          <CreditCard className="inline h-4 w-4 mr-1" />
          Secure payment processing by Stripe
        </p>
      </div>
    </div>
  );
};