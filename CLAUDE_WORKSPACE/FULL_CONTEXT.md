# 🚨 COMPLETE CONTEXT FOR CLAUDE - ALWAYS PASTE THIS FIRST

## 📁 Project Info
- **Repo:** https://github.com/abdullah0300/saas-acc-app.git
- **Tech Stack:** React, TypeScript, Supabase, Tailwind
- **Status:** Testing phase (NO real customers yet)
- **Location:** Pakistan (PKT timezone)

## 🔴 THE 247 CRITICAL ISSUES (From Audit Report)

### Database Architecture Crisis
1. **Missing Primary Keys** - Tables without primary keys preventing replication
2. **No Foreign Keys** - Orphaned records everywhere (invoices without clients)
3. **Missing Unique Constraints** - Duplicate invoice numbers possible
4. **No Cascade Deletes** - Related data persists after parent deletion
5. **Missing Audit Columns** - No created_at, updated_at, created_by tracking
6. **No Indexes** - Queries timing out, full table scans
7. **RLS Bypass** - Service role keys allow cross-tenant data access
8. **SQL Injection** - Dynamic tenant filtering vulnerable

### Invoice System Failures
1. **Race Conditions** - Duplicate invoice numbers generated
2. **Illegal State Transitions** - Invoices jump from draft to paid
3. **Data Loss** - VAT amounts different between invoice and income
4. **Multi-Currency Errors** - Different exchange rates for same invoice
5. **Recurring Invoice Bugs** - Templates don't update, timezone issues
6. **Credit Notes** - Showing as positive cash flow instead of reversals

### VAT/Tax Calculation Errors
1. **HMRC Non-Compliance** - Boxes 6-9 accept decimals (must be whole pounds)
2. **Multi-Line VAT** - Incorrect aggregation with different tax rates
3. **Flat Rate Scheme** - Not detecting limited cost trader (16.5% rate)
4. **Credit Notes** - VAT amounts don't match original invoices
5. **Digital Links Broken** - Manual copy-paste violates MTD requirements
6. **14-Day Rule** - Credit note issuance timing not enforced

### Financial Reporting Disasters
1. **Revenue Recognition** - Violates ASC 606/IFRS 15 standards
2. **Multi-Currency** - 15% variance in reported profits
3. **Exchange Rates** - Different sources, inconsistent timing
4. **Cash Flow** - Material misstatements exceeding $1.2M
5. **Deferred Revenue** - Not tracking properly

### Edge Functions Breaking
1. **Memory Leaks** - PDF generation accumulates 50MB per invoice
2. **Race Conditions** - Multiple withdrawals from same account
3. **Timeout Issues** - Lambda 15-minute limit hit
4. **Template Errors** - Crash on null values
5. **Subscription Billing** - Duplicate charges on renewals

### Security Vulnerabilities
1. **GDPR Violations** - Personal data persists after deletion
2. **Cross-Tenant Access** - RLS policies misconfigured
3. **JWT Issues** - Sensitive data in user-modifiable claims
4. **Session Management** - Not invalidated on role changes
5. **Privilege Escalation** - Users can gain admin access

### Notification System
1. **Email Deliverability** - SPF/DKIM misconfigured, marked as spam
2. **WhatsApp Rate Limits** - 1000 recipients daily limit hit
3. **Scheduling Logic** - Timezone calculations wrong
4. **Infinite Loops** - Escalation rules create reminder spam

### AI Implementation
1. **Hallucinations** - Claiming revenue that doesn't exist
2. **OCR Errors** - 60% accuracy on receipts
3. **Cache Issues** - Outdated suggestions retained
4. **Field Mapping** - MM/DD vs DD/MM confusion

## 📊 PRIORITY ORDER TO FIX

### Phase 1: Database Foundation (Weeks 1-3)
- Add all primary keys
- Add foreign key constraints
- Add audit columns
- Fix RLS policies
- Add unique constraints

### Phase 2: Financial Core (Weeks 4-6)
- Fix VAT calculations
- Fix multi-currency
- Fix exchange rates
- Fix credit notes

### Phase 3: Business Logic (Weeks 7-9)
- Fix invoice generation
- Fix recurring invoices
- Fix revenue recognition
- Fix subscription billing

### Phase 4: Edge Functions (Weeks 10-11)
- Fix memory leaks
- Fix race conditions
- Fix PDF generation
- Fix notification system

### Phase 5: Compliance (Week 12)
- HMRC compliance
- GDPR compliance
- Security fixes
- Audit trail

## 🎯 CURRENT STATUS

**Phase:** 1 - Database Foundation
**Current Task:**  completed
**Last Completed:** Database Foundation
**Current Error:** None yet
**What I Need:** please check it i added dataase sql below 

sql 

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ai_insights (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  insight_date date NOT NULL DEFAULT CURRENT_DATE,
  insights_json jsonb NOT NULL,
  generated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_insights_pkey PRIMARY KEY (id),
  CONSTRAINT ai_insights_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ai_interactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  context_data jsonb DEFAULT '{}'::jsonb,
  ai_suggestion text,
  user_choice text,
  outcome text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_interactions_pkey PRIMARY KEY (id),
  CONSTRAINT ai_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ai_suggestions_cache (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  feature_type text NOT NULL,
  context_hash text NOT NULL,
  suggestions_json jsonb NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_suggestions_cache_pkey PRIMARY KEY (id),
  CONSTRAINT ai_suggestions_cache_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ai_user_context (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  business_type text,
  location text,
  business_stage text DEFAULT 'startup'::text,
  monthly_revenue_range text,
  patterns_json jsonb DEFAULT '{}'::jsonb,
  preferences_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_user_context_pkey PRIMARY KEY (id),
  CONSTRAINT ai_user_context_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  team_id uuid,
  action text NOT NULL CHECK (action = ANY (ARRAY['login'::text, 'logout'::text, 'login_failed'::text, 'create'::text, 'update'::text, 'delete'::text, 'view'::text, 'export'::text, 'invite_sent'::text, 'invite_accepted'::text, 'invite_rejected'::text, 'subscription_changed'::text, 'payment_processed'::text, 'settings_updated'::text, 'password_changed'::text])),
  entity_type text CHECK (entity_type = ANY (ARRAY['income'::text, 'expense'::text, 'invoice'::text, 'client'::text, 'category'::text, 'team_member'::text, 'subscription'::text, 'settings'::text, 'report'::text, 'recurring_invoice'::text, 'budget'::text, 'tax_rate'::text, 'user'::text])),
  entity_id uuid,
  entity_name text,
  changes jsonb,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT audit_logs_team_id_fkey FOREIGN KEY (team_id) REFERENCES auth.users(id)
);
CREATE TABLE public.budgets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  category_id uuid,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  period text NOT NULL CHECK (period = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text])),
  start_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT budgets_pkey PRIMARY KEY (id),
  CONSTRAINT budgets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type USER-DEFINED NOT NULL,
  color text DEFAULT '#3B82F6'::text,
  created_at timestamp with time zone DEFAULT now(),
  import_session_id uuid,
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.category_summaries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  month date NOT NULL,
  category_id uuid,
  category_name text NOT NULL,
  category_type text NOT NULL CHECK (category_type = ANY (ARRAY['income'::text, 'expense'::text])),
  total_amount numeric DEFAULT 0,
  transaction_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT category_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT category_summaries_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT category_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.client_summaries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  client_id uuid,
  month date NOT NULL,
  client_name text NOT NULL,
  revenue numeric DEFAULT 0,
  invoice_count integer DEFAULT 0,
  paid_invoices integer DEFAULT 0,
  pending_amount numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT client_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT client_summaries_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT client_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  phone_country_code text DEFAULT '+1'::text,
  import_session_id uuid,
  vat_number character varying,
  country_code character varying,
  is_vat_registered boolean DEFAULT false,
  credit_balance numeric DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT clients_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.country_configs (
  country_code character varying NOT NULL,
  country_name text NOT NULL,
  default_currency character varying NOT NULL,
  default_tax_rate numeric DEFAULT 0,
  default_tax_name text DEFAULT 'Tax'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT country_configs_pkey PRIMARY KEY (country_code)
);
CREATE TABLE public.credit_note_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  credit_note_id uuid NOT NULL,
  invoice_item_id uuid,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  tax_rate numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  net_amount numeric NOT NULL,
  gross_amount numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT credit_note_items_pkey PRIMARY KEY (id),
  CONSTRAINT credit_note_items_credit_note_id_fkey FOREIGN KEY (credit_note_id) REFERENCES public.credit_notes(id),
  CONSTRAINT credit_note_items_invoice_item_id_fkey FOREIGN KEY (invoice_item_id) REFERENCES public.invoice_items(id)
);
CREATE TABLE public.credit_notes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  credit_note_number text NOT NULL,
  invoice_id uuid NOT NULL,
  client_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  reason text CHECK (reason = ANY (ARRAY['return'::text, 'adjustment'::text, 'cancellation'::text, 'other'::text])),
  reason_description text,
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0::numeric),
  tax_rate numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0 CHECK (total >= 0::numeric),
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'issued'::text, 'applied'::text])),
  notes text,
  currency text DEFAULT 'USD'::text,
  exchange_rate numeric DEFAULT 1,
  base_amount numeric,
  applied_to_income boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tax_metadata jsonb,
  vat_return_id uuid,
  vat_locked_at timestamp without time zone,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  version integer DEFAULT 1,
  CONSTRAINT credit_notes_pkey PRIMARY KEY (id),
  CONSTRAINT credit_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT credit_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT credit_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT credit_notes_vat_return_id_fkey FOREIGN KEY (vat_return_id) REFERENCES public.uk_vat_returns(id),
  CONSTRAINT credit_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT credit_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.email_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  invoice_id uuid,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  status text DEFAULT 'sent'::text CHECK (status = ANY (ARRAY['sent'::text, 'failed'::text, 'bounced'::text, 'opened'::text, 'clicked'::text])),
  sent_at timestamp with time zone DEFAULT now(),
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone,
  error_message text,
  metadata jsonb,
  CONSTRAINT email_logs_pkey PRIMARY KEY (id),
  CONSTRAINT email_logs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  template_type text DEFAULT 'invoice'::text CHECK (template_type = ANY (ARRAY['invoice'::text, 'reminder'::text, 'receipt'::text, 'custom'::text])),
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT email_templates_pkey PRIMARY KEY (id),
  CONSTRAINT email_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.exchange_rates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL CHECK (rate > 0::numeric),
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exchange_rates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  category_id uuid,
  description text NOT NULL,
  date date NOT NULL,
  vendor text,
  receipt_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  currency text DEFAULT 'USD'::text,
  exchange_rate numeric DEFAULT 1,
  base_amount numeric,
  tax_rate numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total_with_tax numeric DEFAULT (amount + COALESCE(tax_amount, (0)::numeric)),
  vendor_id uuid,
  import_session_id uuid,
  tax_metadata jsonb DEFAULT '{}'::jsonb,
  ec_acquisition boolean DEFAULT false,
  reverse_charge_applicable boolean DEFAULT false,
  base_tax_amount numeric DEFAULT 0,
  is_tax_deductible boolean DEFAULT true,
  tax_point_date date,
  vat_return_id uuid,
  vat_locked_at timestamp without time zone,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  version integer DEFAULT 1,
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT expenses_vat_return_id_fkey FOREIGN KEY (vat_return_id) REFERENCES public.uk_vat_returns(id),
  CONSTRAINT expenses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id),
  CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT expenses_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
  CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.import_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  import_session_id uuid NOT NULL UNIQUE,
  import_date timestamp with time zone NOT NULL,
  file_name text,
  import_type text NOT NULL DEFAULT 'ai_csv_import'::text,
  import_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  can_undo_until timestamp with time zone NOT NULL,
  is_undone boolean DEFAULT false,
  undone_at timestamp with time zone,
  undo_results jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT import_history_pkey PRIMARY KEY (id),
  CONSTRAINT import_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.income (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0::numeric),
  category_id uuid,
  description text NOT NULL,
  date date NOT NULL,
  reference_number text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  currency text DEFAULT 'USD'::text,
  exchange_rate numeric DEFAULT 1,
  base_amount numeric,
  tax_rate numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total_with_tax numeric DEFAULT (amount + COALESCE(tax_amount, (0)::numeric)),
  client_id uuid,
  import_session_id uuid,
  tax_metadata jsonb DEFAULT '{}'::jsonb,
  credit_note_id uuid,
  vat_return_id uuid,
  vat_locked_at timestamp without time zone,
  is_credit_adjustment boolean DEFAULT false,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  version integer DEFAULT 1,
  CONSTRAINT income_pkey PRIMARY KEY (id),
  CONSTRAINT income_credit_note_id_fkey FOREIGN KEY (credit_note_id) REFERENCES public.credit_notes(id),
  CONSTRAINT income_vat_return_id_fkey FOREIGN KEY (vat_return_id) REFERENCES public.uk_vat_returns(id),
  CONSTRAINT income_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT income_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id),
  CONSTRAINT income_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT income_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT income_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.invoice_access_tokens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  token uuid NOT NULL UNIQUE,
  invoice_id uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  can_accept boolean DEFAULT false,
  accepted_at timestamp with time zone,
  CONSTRAINT invoice_access_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_access_tokens_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.invoice_activities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoice_activities_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_activities_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT invoice_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.invoice_credit_tracking (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL UNIQUE,
  total_credited numeric DEFAULT 0,
  credit_note_count integer DEFAULT 0,
  last_credit_date timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT invoice_credit_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_credit_tracking_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.invoice_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  invoice_id uuid,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  tax_metadata jsonb DEFAULT '{}'::jsonb,
  tax_rate numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  net_amount numeric NOT NULL,
  gross_amount numeric NOT NULL,
  CONSTRAINT invoice_items_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.invoice_payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_date timestamp with time zone DEFAULT now(),
  payment_method text,
  reference_number text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoice_payments_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.invoice_reminders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  invoice_id uuid NOT NULL,
  reminder_type text CHECK (reminder_type = ANY (ARRAY['due_soon'::text, 'overdue'::text, 'sent'::text, 'paid'::text])),
  sent_date timestamp with time zone DEFAULT now(),
  sent_via text CHECK (sent_via = ANY (ARRAY['email'::text, 'whatsapp'::text, 'both'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoice_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_reminders_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.invoice_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  company_name text,
  company_logo text,
  company_address text,
  company_phone text,
  company_email text,
  company_website text,
  tax_number text,
  invoice_prefix text DEFAULT 'INV-'::text,
  invoice_color text DEFAULT '#3B82F6'::text,
  payment_terms integer DEFAULT 30,
  invoice_notes text,
  invoice_footer text,
  default_tax_rate numeric DEFAULT 0,
  email_notifications boolean DEFAULT true,
  whatsapp_notifications boolean DEFAULT false,
  notification_email text,
  notification_phone text,
  reminder_days integer DEFAULT 3,
  payment_instructions text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  next_number integer DEFAULT 1,
  due_days integer DEFAULT 30,
  auto_send_recurring boolean DEFAULT false,
  payment_info jsonb DEFAULT '{}'::jsonb,
  bank_name text,
  account_number text,
  routing_number text,
  paypal_email text,
  fill_number_gaps boolean DEFAULT true,
  CONSTRAINT invoice_settings_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.invoice_templates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  template_data jsonb NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoice_templates_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  invoice_number text NOT NULL,
  client_id uuid,
  date date NOT NULL,
  due_date date NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::invoice_status,
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0::numeric),
  tax_rate numeric DEFAULT 0 CHECK (tax_rate >= 0::numeric AND tax_rate <= 100::numeric),
  tax_amount numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0 CHECK (total >= 0::numeric),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  currency text DEFAULT 'USD'::text,
  exchange_rate numeric DEFAULT 1,
  template_id uuid,
  sent_date timestamp with time zone,
  viewed_date timestamp with time zone,
  paid_date timestamp with time zone,
  last_emailed_at timestamp with time zone,
  email_count integer DEFAULT 0,
  income_category_id uuid,
  invoice_type text DEFAULT 'simple'::text CHECK (invoice_type = ANY (ARRAY['simple'::text, 'detailed'::text])),
  detailed_data jsonb DEFAULT '{}'::jsonb,
  has_discount boolean DEFAULT false,
  discount_type text CHECK (discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])),
  discount_value numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  shipping_amount numeric DEFAULT 0,
  has_payment_schedule boolean DEFAULT false,
  payment_schedule jsonb,
  amount_paid numeric DEFAULT 0,
  balance_due numeric DEFAULT 0,
  additional_charges jsonb DEFAULT '[]'::jsonb,
  viewed_at timestamp with time zone,
  partially_paid_at timestamp with time zone,
  draft_accepted_at timestamp with time zone,
  draft_accepted_by text,
  import_session_id uuid,
  base_amount numeric,
  tax_metadata jsonb DEFAULT '{}'::jsonb,
  tax_scheme text,
  is_reverse_charge boolean DEFAULT false,
  intra_eu_supply boolean DEFAULT false,
  has_credit_notes boolean DEFAULT false,
  total_credited numeric DEFAULT 0,
  tax_point_date date,
  actual_paid_date date,
  vat_return_id uuid,
  vat_locked_at timestamp without time zone,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  version integer DEFAULT 1,
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_vat_return_id_fkey FOREIGN KEY (vat_return_id) REFERENCES public.uk_vat_returns(id),
  CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT invoices_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id),
  CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT invoices_income_category_id_fkey FOREIGN KEY (income_category_id) REFERENCES public.categories(id),
  CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.manual_exchange_rates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  CONSTRAINT manual_exchange_rates_pkey PRIMARY KEY (id),
  CONSTRAINT manual_exchange_rates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.monthly_summaries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  month date NOT NULL,
  total_income numeric DEFAULT 0,
  total_expenses numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  invoice_count integer DEFAULT 0,
  client_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT monthly_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT monthly_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.mtd_credentials (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  access_token text,
  refresh_token text,
  expires_at timestamp without time zone,
  vrn text,
  test_mode boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT mtd_credentials_pkey PRIMARY KEY (id),
  CONSTRAINT mtd_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notification_email_queue (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  notification_id uuid,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])),
  attempts integer DEFAULT 0,
  last_attempt_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_email_queue_pkey PRIMARY KEY (id),
  CONSTRAINT notification_email_queue_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['welcome'::text, 'invoice_sent'::text, 'invoice_viewed'::text, 'invoice_paid'::text, 'invoice_overdue'::text, 'invoice_generated'::text, 'payment_received'::text, 'expense_added'::text, 'budget_exceeded'::text, 'team_invited'::text, 'team_joined'::text, 'team_removed'::text, 'subscription_upgraded'::text, 'subscription_downgraded'::text, 'subscription_expiring'::text, 'system_update'::text, 'feature_announcement'::text])),
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  action_label text DEFAULT 'View'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  priority text DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone,
  expires_at timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text CHECK (payment_method = ANY (ARRAY['cash'::text, 'bank_transfer'::text, 'credit_card'::text, 'paypal'::text, 'other'::text])),
  reference_number text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.pending_invites (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['admin'::text, 'member'::text])),
  invited_by uuid NOT NULL,
  invite_code text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  accepted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pending_invites_pkey PRIMARY KEY (id),
  CONSTRAINT pending_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id),
  CONSTRAINT pending_invites_team_id_fkey FOREIGN KEY (team_id) REFERENCES auth.users(id)
);
CREATE TABLE public.plan_features (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  feature_key text NOT NULL,
  feature_value text NOT NULL,
  feature_limit integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plan_features_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  company_name text,
  company_logo text,
  company_address text,
  phone text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  first_name text,
  last_name text,
  tax_regime character varying,
  tax_registration_number text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.recurring_invoices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  client_id uuid,
  template_data jsonb NOT NULL,
  frequency text NOT NULL CHECK (frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text])),
  next_date date NOT NULL,
  last_generated date,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  invoice_id uuid,
  end_date date,
  CONSTRAINT recurring_invoices_pkey PRIMARY KEY (id),
  CONSTRAINT recurring_invoices_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT recurring_invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT recurring_invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  interval USER-DEFINED NOT NULL DEFAULT 'monthly'::subscription_interval,
  status text NOT NULL DEFAULT 'trialing'::text,
  trial_end timestamp with time zone DEFAULT (now() + '30 days'::interval),
  current_period_start timestamp with time zone DEFAULT now(),
  current_period_end timestamp with time zone DEFAULT (now() + '30 days'::interval),
  cancel_at_period_end boolean DEFAULT false,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  plan USER-DEFINED NOT NULL DEFAULT 'simple_start'::subscription_plan_new,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.subscriptions_backup_advanced (
  id uuid,
  user_id uuid,
  plan text,
  interval text,
  status text,
  trial_end timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  backed_up_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.tax_audit_trail (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  country_code text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  transformation text,
  metadata jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT tax_audit_trail_pkey PRIMARY KEY (id),
  CONSTRAINT tax_audit_trail_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tax_rates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  rate numeric NOT NULL CHECK (rate >= 0::numeric AND rate <= 100::numeric),
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tax_rates_pkey PRIMARY KEY (id),
  CONSTRAINT tax_rates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.team_invites (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['admin'::text, 'member'::text])),
  invited_by uuid NOT NULL,
  token uuid NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_invites_pkey PRIMARY KEY (id),
  CONSTRAINT team_invites_team_id_fkey FOREIGN KEY (team_id) REFERENCES auth.users(id),
  CONSTRAINT team_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id)
);
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  team_id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])),
  status text NOT NULL DEFAULT 'invited'::text CHECK (status = ANY (ARRAY['active'::text, 'invited'::text, 'disabled'::text])),
  invited_by uuid NOT NULL,
  joined_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id),
  CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES auth.users(id)
);
CREATE TABLE public.uk_vat_returns (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_key text,
  box1_vat_due_sales numeric DEFAULT 0,
  box2_vat_due_acquisitions numeric DEFAULT 0,
  box3_total_vat_due numeric DEFAULT 0,
  box4_vat_reclaimed numeric DEFAULT 0,
  box5_net_vat_due numeric DEFAULT 0,
  box6_total_sales_ex_vat numeric DEFAULT 0 CHECK (box6_total_sales_ex_vat = round(box6_total_sales_ex_vat)),
  box7_total_purchases_ex_vat numeric DEFAULT 0 CHECK (box7_total_purchases_ex_vat = round(box7_total_purchases_ex_vat)),
  box8_total_supplies_ex_vat numeric DEFAULT 0,
  box9_total_acquisitions_ex_vat numeric DEFAULT 0,
  base_currency text NOT NULL,
  status text DEFAULT 'draft'::text,
  submitted_at timestamp without time zone,
  hmrc_receipt text,
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  mtd_submission_id text,
  mtd_correlation_id text,
  mtd_response jsonb,
  CONSTRAINT uk_vat_returns_pkey PRIMARY KEY (id),
  CONSTRAINT uk_vat_returns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  date_format text DEFAULT 'MM/DD/YYYY'::text,
  time_zone text DEFAULT 'America/New_York'::text,
  fiscal_year_start integer DEFAULT 1,
  notification_preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  country character varying,
  state character varying,
  mfa_backup_codes ARRAY,
  security_notifications boolean DEFAULT true,
  base_currency text DEFAULT 'USD'::text,
  enabled_currencies ARRAY DEFAULT ARRAY['USD'::text],
  vat_registration_number character varying,
  vat_scheme character varying DEFAULT 'standard'::character varying CHECK (vat_scheme::text = ANY (ARRAY['standard'::character varying, 'flat_rate'::character varying, 'cash'::character varying]::text[])),
  flat_rate_percentage numeric,
  vat_period_type character varying DEFAULT 'quarterly'::character varying CHECK (vat_period_type::text = ANY (ARRAY['monthly'::character varying, 'quarterly'::character varying]::text[])),
  mtd_enabled boolean DEFAULT false,
  tax_registration_number text,
  tax_scheme text DEFAULT 'standard'::text,
  tax_return_period text DEFAULT 'quarterly'::text,
  is_tax_registered boolean DEFAULT false,
  uk_vat_scheme text DEFAULT 'standard'::text,
  uk_vat_flat_rate numeric DEFAULT 0,
  uk_vat_registration_date date,
  us_tax_id text,
  au_abn text,
  ca_gst_number text,
  tax_id text,
  CONSTRAINT user_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_settings_backup_before_revert (
  id uuid,
  user_id uuid,
  date_format text,
  time_zone text,
  fiscal_year_start integer,
  notification_preferences jsonb,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  country character varying,
  state character varying,
  mfa_backup_codes ARRAY,
  security_notifications boolean,
  base_currency text,
  enabled_currencies jsonb
);
CREATE TABLE public.vat_periods (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status character varying DEFAULT 'open'::character varying CHECK (status::text = ANY (ARRAY['open'::character varying, 'locked'::character varying, 'submitted'::character varying]::text[])),
  locked_at timestamp with time zone,
  vat_return_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vat_periods_pkey PRIMARY KEY (id),
  CONSTRAINT vat_periods_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.vat_submissions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  period_id uuid NOT NULL,
  submission_date timestamp with time zone DEFAULT now(),
  boxes_data jsonb NOT NULL,
  mtd_receipt character varying,
  status character varying DEFAULT 'draft'::character varying CHECK (status::text = ANY (ARRAY['draft'::character varying, 'submitted'::character varying, 'accepted'::character varying, 'rejected'::character varying]::text[])),
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vat_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT vat_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT vat_submissions_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.vat_periods(id)
);
CREATE TABLE public.vendors (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  tax_id text,
  payment_terms integer DEFAULT 30,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  import_session_id uuid,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamp with time zone,
  CONSTRAINT vendors_pkey PRIMARY KEY (id),
  CONSTRAINT vendors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT vendors_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);


