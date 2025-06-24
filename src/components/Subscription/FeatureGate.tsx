// src/components/Subscription/FeatureGate.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Zap, AlertCircle } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PlanFeatures } from '../../config/subscriptionConfig';

interface FeatureGateProps {
  feature: keyof PlanFeatures;
  children: React.ReactNode;
  // Optional props for customization
  showUpgradePrompt?: boolean;
  customMessage?: string;
  customTitle?: string;
  variant?: 'block' | 'inline' | 'modal';
  className?: string;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  showUpgradePrompt = true,
  customMessage,
  customTitle,
  variant = 'block',
  className = ''
}) => {
  const { hasFeature, plan } = useSubscription();
  
  // Check if user has access to this feature
  const hasAccess = hasFeature(feature);
  
  // If user has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // Otherwise, show upgrade prompt based on variant
  if (!showUpgradePrompt) {
    return null;
  }
  
  // Feature display names for better UX
  const featureNames: Partial<Record<keyof PlanFeatures, string>> = {
    multi_currency: 'Multi-Currency Support',
    recurring_invoices: 'Recurring Invoices',
    advanced_reports: 'Advanced Reports',
    tax_management: 'Tax Management',
    custom_invoice_branding: 'Custom Invoice Branding',
    budget_tracking: 'Budget Tracking',
    cash_flow_analysis: 'Cash Flow Analysis',
    phone_support: 'Phone Support',
    api_access: 'API Access',
    audit_trail: 'Audit Trail',
    team_permissions: 'Team Permissions'
  };
  
  const title = customTitle || `${featureNames[feature] || feature} Required`;
  const message = customMessage || `Upgrade your plan to access ${featureNames[feature] || 'this feature'}.`;
  
  // Inline variant - small lock icon with tooltip
  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center text-gray-400 ${className}`}>
        <Lock className="h-4 w-4 mr-1" />
        <span className="text-sm">Premium</span>
      </div>
    );
  }
  
  // Modal variant - for blocking important actions
  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mx-auto mb-4">
            <Lock className="h-6 w-6 text-yellow-600" />
          </div>
          <h3 className="text-lg font-semibold text-center mb-2">{title}</h3>
          <p className="text-gray-600 text-center mb-6">{message}</p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Go Back
            </button>
            <Link
              to="/settings/subscription"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View Plans
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // Default block variant - replaces the component
  return (
    <div className={`bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center ${className}`}>
      <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4">
        <Lock className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{message}</p>
      <Link
        to="/settings/subscription"
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Zap className="h-4 w-4 mr-2" />
        Upgrade Plan
      </Link>
    </div>
  );
};

// Usage Limit Gate - specifically for checking usage-based limits
interface UsageLimitGateProps {
  type: 'invoices' | 'clients';
  children: React.ReactNode;
  showWarning?: boolean;
  onLimitReached?: () => void;
}

export const UsageLimitGate: React.FC<UsageLimitGateProps> = ({
  type,
  children,
  showWarning = true,
  onLimitReached
}) => {
  const { canCreateInvoice, canAddClients, getUsagePercentage, limits } = useSubscription();
  
  const canCreate = type === 'invoices' ? canCreateInvoice() : canAddClients();
  const usagePercentage = getUsagePercentage(type);
  const limit = type === 'invoices' ? limits.monthlyInvoices : limits.totalClients;
  
  // If unlimited (-1), always allow
  if (limit === -1) {
    return <>{children}</>;
  }
  
  // If at limit, show upgrade prompt
  if (!canCreate) {
    if (onLimitReached) {
      onLimitReached();
    }
    
    if (!showWarning) {
      return null;
    }
    
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              {type === 'invoices' ? 'Monthly Invoice Limit Reached' : 'Client Limit Reached'}
            </h3>
            <p className="mt-1 text-sm text-red-700">
              You've reached your limit of {limit} {type}. Upgrade your plan to add more.
            </p>
            <Link
              to="/settings/subscription"
              className="mt-2 inline-block text-sm font-medium text-red-700 hover:text-red-800"
            >
              Upgrade Now →
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // If approaching limit (>80%), show warning
  if (showWarning && usagePercentage > 80) {
    return (
      <>
        {children}
        <div className="mt-2 text-sm text-orange-600 flex items-center">
          <AlertCircle className="h-4 w-4 mr-1" />
          You're using {Math.round(usagePercentage)}% of your {type} limit
        </div>
      </>
    );
  }
  
  return <>{children}</>;
};