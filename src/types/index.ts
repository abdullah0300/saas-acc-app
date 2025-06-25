// src/types/index.ts

export interface User {
  id: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  company_logo?: string;
  company_address?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'basic' | 'professional' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  color: string;
  created_at: string;
}

// In your src/types/index.ts, update the Income and Expense interfaces:

export interface Income {
  id: string;
  user_id: string;
  amount: number;
  category_id?: string;
  category?: Category;
  description: string;
  date: string;
  reference_number?: string;
  created_at: string;
  updated_at: string;
  // Add these tax fields
  currency?: string;
  exchange_rate?: number;
  base_amount?: number;
  tax_rate?: number;
  tax_amount?: number;
  total_with_tax?: number;
  client_id?: string;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category_id?: string;
  category?: Category;
  description: string;
  date: string;
  vendor?: string;
  vendor_id?: string;  // Add this line
  vendor_detail?: Vendor;  // Add this line
  receipt_url?: string;
  created_at: string;
  updated_at: string;
  // Add these tax fields
  currency?: string;
  exchange_rate?: number;
  base_amount?: number;
  tax_rate?: number;
  tax_amount?: number;
  total_with_tax?: number;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  client_id?: string;
  client?: Client;
  date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  currency?: string;
  paid_date?: string;
  sent_date?: string;
  items?: InvoiceItem[];
  created_at: string;
  updated_at: string;
  income_category_id?: string; // Add this line
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  created_at: string;
}

export interface TaxRate {
  id: string;
  user_id: string;
  name: string;
  rate: number;
  is_default: boolean;
  created_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  base_currency: string;
  enabled_currencies: string[];
  date_format: string;
  fiscal_year_start: number;
  country?: string;
  state?: string;
  notification_preferences?: any;
  created_at: string;
  updated_at: string;
}

export interface InvoiceSettings {
  id: string;
  user_id: string;
  invoice_prefix: string;
  next_number: number;
  due_days: number;
  payment_terms: number;
  email_notifications: boolean;
  whatsapp_notifications: boolean;
  reminder_days: number;
  created_at: string;
  updated_at: string;
}

// Notification types
export type NotificationType = 
  | 'invoice_sent' 
  | 'invoice_viewed' 
  | 'invoice_generated'
  | 'invoice_paid' 
  | 'invoice_overdue'
  | 'payment_received' 
  | 'expense_added' 
  | 'budget_exceeded'
  | 'team_invited' 
  | 'team_joined' 
  | 'team_removed'
  | 'subscription_upgraded' 
  | 'subscription_downgraded' 
  | 'subscription_expiring'
  | 'system_update' 
  | 'feature_announcement';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_url?: string;
  action_label?: string;
  metadata?: Record<string, any>;
  priority: NotificationPriority;
  is_read: boolean;
  created_at: string;
  read_at?: string;
  expires_at?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
}

// Existing type exports
export type TransactionType = 'income' | 'expense';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled';

// Country configuration type
export interface CountryConfig {
  country_code: string;
  country_name: string;
  default_currency: string;
  default_tax_rate: number;
  default_tax_name: string;
  created_at: string;
}

// Icon and color mappings for notification types
export const notificationConfig: Record<NotificationType, {
  icon: string;
  color: string;
  bgColor: string;
}> = {
  invoice_sent: { icon: 'Send', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  invoice_viewed: { icon: 'Eye', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  invoice_paid: { icon: 'CheckCircle', color: 'text-green-600', bgColor: 'bg-green-100' },
  invoice_overdue: { icon: 'AlertCircle', color: 'text-red-600', bgColor: 'bg-red-100' },
  invoice_generated: { icon: 'RefreshCw', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  payment_received: { icon: 'DollarSign', color: 'text-green-600', bgColor: 'bg-green-100' },
  expense_added: { icon: 'Receipt', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  budget_exceeded: { icon: 'TrendingUp', color: 'text-red-600', bgColor: 'bg-red-100' },
  team_invited: { icon: 'UserPlus', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  team_joined: { icon: 'Users', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  team_removed: { icon: 'UserMinus', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  subscription_upgraded: { icon: 'Star', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  subscription_downgraded: { icon: 'TrendingDown', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  subscription_expiring: { icon: 'Clock', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  system_update: { icon: 'Info', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  feature_announcement: { icon: 'Sparkles', color: 'text-purple-600', bgColor: 'bg-purple-100' }
};


export interface Vendor {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  payment_terms?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}