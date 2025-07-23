// src/config/subscriptionConfig.ts

export type PlanType = 'simple_start' | 'plus';
export type BillingInterval = 'monthly' | 'yearly';

export interface PlanLimits {
  users: number;              // Team member limit
  monthlyInvoices: number;    // Monthly invoice creation limit (-1 for unlimited)
  totalClients: number;       // Total clients limit (-1 for unlimited)
  totalInvoices: number;      // Total invoices stored (-1 for unlimited)
}

export interface PlanFeatures {
  // Basic features (all plans have these)
  income_expense_tracking: boolean;
  basic_reports: boolean;
  invoice_creation: boolean;
  client_management: boolean;
  category_management: boolean;
  export_pdf: boolean;
  email_support: boolean;
  
  // Advanced features (Plus only)
  multi_currency: boolean;
  recurring_invoices: boolean;
  invoice_templates: boolean;
  advanced_reports: boolean;
  tax_management: boolean;
  priority_support: boolean;
  advanced_exports: boolean;
  unlimited_invoices: boolean;
  custom_invoice_branding: boolean;
  advanced_tax_reports: boolean;
  profit_loss_statements: boolean;
  cash_flow_analysis: boolean;
  budget_tracking: boolean;
  phone_support: boolean;
  api_access: boolean;
  audit_trail: boolean;
  team_permissions: boolean;
  dedicated_support: boolean;
}

export interface PlanConfig {
  id: PlanType;
  name: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  limits: PlanLimits;
  features: PlanFeatures;
}

// Complete plan configuration
export const SUBSCRIPTION_PLANS: Record<PlanType, PlanConfig> = {
  simple_start: {
    id: 'simple_start',
    name: 'simple_start',
    displayName: 'Simple Start',
    description: 'Perfect for freelancers and solopreneurs',
    monthlyPrice: 5,
    yearlyPrice: 48, // 20% discount
    trialDays: 30,
    limits: {
      users: 1,
      monthlyInvoices: 20, // CHANGED FROM 50 TO 20
      totalClients: -1, // unlimited
      totalInvoices: -1  // unlimited storage
    },
    features: {
      // Basic features only
      income_expense_tracking: true,
      basic_reports: true,
      invoice_creation: true,
      client_management: true,
      category_management: true,
      export_pdf: true,
      email_support: true,
      
      // Advanced features - not available
      multi_currency: false,
      recurring_invoices: false,
      invoice_templates: false,
      advanced_reports: false,
      tax_management: false,
      priority_support: false,
      advanced_exports: false,
      unlimited_invoices: false,
      custom_invoice_branding: false,
      advanced_tax_reports: false,
      profit_loss_statements: false,
      cash_flow_analysis: false,
      budget_tracking: false,
      phone_support: false,
      api_access: false,
      audit_trail: false,
      team_permissions: false,
      dedicated_support: false
    }
  },
  
  plus: {
    id: 'plus',
    name: 'plus',
    displayName: 'Plus',
    description: 'Complete business solution with all features',
    monthlyPrice: 25, // CHANGED FROM 45 TO 25
    yearlyPrice: 240, // 20% discount (25 * 12 * 0.8)
    trialDays: 30,
    limits: {
      users: 5, // unlimited users
      monthlyInvoices: -1, // unlimited
      totalClients: -1,
      totalInvoices: -1
    },
    features: {
      // All features enabled
      income_expense_tracking: true,
      basic_reports: true,
      invoice_creation: true,
      client_management: true,
      category_management: true,
      export_pdf: true,
      email_support: true,
      multi_currency: true,
      recurring_invoices: true,
      invoice_templates: true,
      advanced_reports: true,
      tax_management: true,
      priority_support: true,
      unlimited_invoices: true,
      custom_invoice_branding: true,
      advanced_tax_reports: true,
      profit_loss_statements: true,
      cash_flow_analysis: true,
      budget_tracking: true,
      phone_support: true,
      advanced_exports: true,
      api_access: true,
      audit_trail: true,
      team_permissions: true,
      dedicated_support: true
    }
  }
};

// Helper functions
export const getPlanConfig = (plan: PlanType): PlanConfig => {
  return SUBSCRIPTION_PLANS[plan];
};

export const getPlanByStripePrice = (priceId: string): PlanType | null => {
  const priceMap = Object.entries(STRIPE_PRICE_IDS).reduce((acc, [plan, prices]) => {
    acc[prices.monthly] = plan as PlanType;
    acc[prices.yearly] = plan as PlanType;
    return acc;
  }, {} as Record<string, PlanType>);
  
  return priceMap[priceId] || null;
};

export const hasFeature = (plan: PlanType, feature: keyof PlanFeatures): boolean => {
  return SUBSCRIPTION_PLANS[plan]?.features[feature] || false;
};

export const getPlanLimits = (plan: PlanType): PlanLimits => {
  return SUBSCRIPTION_PLANS[plan]?.limits || SUBSCRIPTION_PLANS.simple_start.limits;
};

export const canAddMoreUsers = (plan: PlanType, currentUsers: number): boolean => {
  const limits = getPlanLimits(plan);
  if (limits.users === -1) return true;
  return currentUsers < limits.users;
};

export const canCreateInvoice = (plan: PlanType, currentMonthlyInvoices: number): boolean => {
  const limits = getPlanLimits(plan);
  if (limits.monthlyInvoices === -1) return true;
  return currentMonthlyInvoices < limits.monthlyInvoices;
};

// Stripe Price IDs - UPDATE THESE WITH YOUR ACTUAL STRIPE PRICE IDS
export const STRIPE_PRICE_IDS = {
  simple_start: {
    monthly: 'price_1RcoIWGO7FUbyUUTISN9YYXC',
    yearly: 'price_1RcoIWGO7FUbyUUTE4NsZ1Kk'
  },
  plus: {
    monthly: 'price_1RoAIJGO7FUbyUUTJ3j20InB',  // ✅ NEW
    yearly: 'price_1RoAIyGO7FUbyUUTvCuhXEid'   // ✅ NEW
  }
};

// Usage warning thresholds
export const WARNING_THRESHOLD = 0.8; // Show warning at 80% usage
export const CRITICAL_THRESHOLD = 0.95; // Show critical warning at 95% usage