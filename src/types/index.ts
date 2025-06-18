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
  receipt_url?: string;
  created_at: string;
  updated_at: string;
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