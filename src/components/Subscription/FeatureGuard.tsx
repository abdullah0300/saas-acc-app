// src/components/Subscription/FeatureGuard.tsx

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Lock, Crown } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PlanFeatures } from '../../config/subscriptionConfig';

interface FeatureGuardProps {
  feature: keyof PlanFeatures;
  children: React.ReactNode;
  fallback?: 'hide' | 'blur' | 'message' | 'redirect';
  customMessage?: string;
  showUpgradeButton?: boolean;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ 
  feature, 
  children, 
  fallback = 'message',
  customMessage,
  showUpgradeButton = true
}) => {
  const { hasFeature, plan } = useSubscription();
  const navigate = useNavigate();
  
  const hasAccess = hasFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Get feature display name
  const getFeatureDisplayName = (feature: keyof PlanFeatures): string => {
    const featureNames: Record<keyof PlanFeatures, string> = {
      income_expense_tracking: 'Income & Expense Tracking',
      basic_reports: 'Basic Reports',
      invoice_creation: 'Invoice Creation',
      client_management: 'Client Management',
      category_management: 'Category Management',
      export_pdf: 'PDF Export',
      email_support: 'Email Support',
      multi_currency: 'Multi-Currency Support',
      recurring_invoices: 'Recurring Invoices',
      invoice_templates: 'Invoice Templates',
      advanced_reports: 'Advanced Reports',
      tax_management: 'Tax Management',
      priority_support: 'Priority Support',
          advanced_exports: 'Advanced Export Options', // Add this line
      unlimited_invoices: 'Unlimited Invoices',
      custom_invoice_branding: 'Custom Invoice Branding',
      advanced_tax_reports: 'Advanced Tax Reports',
      profit_loss_statements: 'Profit & Loss Statements',
      cash_flow_analysis: 'Cash Flow Analysis',
      budget_tracking: 'Budget Tracking',
      phone_support: 'Phone Support',
      api_access: 'API Access',
      audit_trail: 'Audit Trail',
      team_permissions: 'Team Permissions',
      dedicated_support: 'Dedicated Support'
      
    };
    return featureNames[feature] || feature;
  };

  const featureName = getFeatureDisplayName(feature);

  // Handle different fallback types
  switch (fallback) {
    case 'hide':
      return null;
      
    case 'blur':
      return (
        <div className="relative">
          <div className="filter blur-sm pointer-events-none select-none opacity-50">
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg backdrop-blur-sm">
            <div className="text-center p-6 max-w-sm">
              <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Premium Feature
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {customMessage || `${featureName} is not available in your current plan`}
              </p>
              {showUpgradeButton && (
                <Link
                  to="/settings/subscription"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Link>
              )}
            </div>
          </div>
        </div>
      );
      
    case 'redirect':
      navigate('/settings/subscription');
      return null;
      
    case 'message':
    default:
      return (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <Crown className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-medium text-blue-900">
                Upgrade Required
              </h3>
              <p className="mt-2 text-sm text-blue-700">
                {customMessage || `${featureName} requires an upgraded plan. You are currently on the ${plan} plan.`}
              </p>
              {showUpgradeButton && (
                <div className="mt-4">
                  <Link
                    to="/settings/subscription"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                  >
                    View Available Plans
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      );
  }
};

// Usage Limit Warning Component
interface UsageLimitWarningProps {
  type: 'users' | 'invoices' | 'clients';
  className?: string;
}

export const UsageLimitWarning: React.FC<UsageLimitWarningProps> = ({ type, className = '' }) => {
  const { usage, limits, isNearLimit, isCriticalLimit, getUsagePercentage, plan } = useSubscription();
  
  const nearLimit = isNearLimit(type);
  const criticalLimit = isCriticalLimit(type);
  const percentage = getUsagePercentage(type);
  const atLimit = percentage >= 100;
  
  if (!nearLimit && !criticalLimit && !atLimit) return null;
  
  const getTypeText = () => {
    switch (type) {
      case 'users': 
        return { 
          single: 'team member', 
          plural: 'team members', 
          current: usage.users, 
          limit: limits.users 
        };
      case 'invoices': 
        return { 
          single: 'invoice', 
          plural: 'invoices', 
          current: usage.monthlyInvoices, 
          limit: limits.monthlyInvoices,
          period: 'this month'
        };
      case 'clients': 
        return { 
          single: 'client', 
          plural: 'clients', 
          current: usage.totalClients, 
          limit: limits.totalClients 
        };
    }
  };
  
  const typeText = getTypeText();
  const bgColor = atLimit ? 'bg-red-50 border-red-200' : criticalLimit ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200';
  const iconColor = atLimit ? 'text-red-600' : criticalLimit ? 'text-orange-600' : 'text-yellow-600';
  const textColor = atLimit ? 'text-red' : criticalLimit ? 'text-orange' : 'text-yellow';
  
  return (
    <div className={`rounded-lg p-4 border ${bgColor} ${className}`}>
      <div className="flex items-start">
        <AlertCircle className={`h-5 w-5 mt-0.5 ${iconColor}`} />
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${textColor}-900`}>
            {atLimit 
              ? `${typeText.single} limit reached` 
              : criticalLimit 
                ? `Almost at ${typeText.single} limit`
                : `Approaching ${typeText.single} limit`}
          </h3>
          <p className={`mt-1 text-sm ${textColor}-700`}>
            You're using {typeText.current} of {typeText.limit} {typeText.plural} 
            {typeText.period ? ` ${typeText.period}` : ''} ({Math.round(percentage)}%).
            {atLimit && ` Upgrade your plan to add more ${typeText.plural}.`}
          </p>
          <Link
            to="/settings/subscription"
            className={`mt-2 inline-block text-sm font-medium ${textColor}-700 hover:${textColor}-800`}
          >
            View upgrade options →
          </Link>
        </div>
      </div>
    </div>
  );
};

// Quick check helper component
interface CanCreateCheckProps {
  type: 'invoice' | 'user' | 'client';
  children: (canCreate: boolean) => React.ReactNode;
}

export const CanCreateCheck: React.FC<CanCreateCheckProps> = ({ type, children }) => {
  const { canAddUsers, canCreateInvoice, canAddClients } = useSubscription();
  
  const canCreate = type === 'invoice' ? canCreateInvoice() :
                    type === 'user' ? canAddUsers() :
                    canAddClients();
  
  return <>{children(canCreate)}</>;
};