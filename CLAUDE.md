# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-tenant B2B SaaS accounting platform built with React 19, TypeScript, Supabase, and Stripe. The application serves freelancers and small businesses with invoicing, expense tracking, financial reporting, and team collaboration features.

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
npm start

# Run all tests in watch mode
npm test

# Run tests for a specific file
npm test -- ExpenseForm.test.tsx

# Build for production
npm run build
```

## Architecture Overview

### Multi-Tenancy Pattern

The application uses a **team owner as root** pattern:
- Owner's user ID = team ID
- Team members reference owner via `team_members.team_id`
- All data queries use `getEffectiveUserId(userId)` which returns:
  - Team owner's ID if user is a team member
  - User's own ID if owner or solo user
- This pattern enables automatic data sharing across teams while maintaining Row-Level Security (RLS) in Supabase

**Critical**: Always use `effectiveUserId` from `DataContext` when querying business data (invoices, expenses, clients, etc.). Never use raw `user.id` for business entity queries.

### Context Architecture

The app uses 5 main React contexts that must be nested in this order:
1. `AuthContext` - Authentication state and user session
2. `SubscriptionContext` - Plan limits, feature flags, usage tracking
3. `DataContext` - Business data (invoices, expenses, clients, etc.)
4. `SettingsContext` - Tax rates, currencies, user preferences
5. `NotificationContext` - In-app and email notifications

**Critical**: `DataContext` loads all business data for the effective user on mount and maintains it in memory with a cache. When modifying data, always use the context's update methods (`addIncome`, `updateExpense`, etc.) to keep the cache synchronized.

### Role-Based Access Control (RBAC)

Four role types exist:
- **Owner**: Team lead with full access (identified by absence in `team_members` table)
- **Team Member** (Member/Admin): Limited access based on subscription tier
- **Platform Admin**: Global system administration across all users
- **SEO Admin**: Content/blog management specific role

Use these helper components for access control:
- `ProtectedRoute` - Requires authentication
- `OwnerOnlyRoute` - Owner or solo user only
- `PlatformAdminRoute` - Platform admin verification
- `SEOAdminRoute` - SEO admin check
- `PlanProtectedRoute` - Feature gating by subscription plan

### Subscription System

Two tiers defined in `src/config/subscriptionConfig.ts`:
- **Simple Start**: 1 user, 20 monthly invoices, basic features
- **Plus**: 5 users, unlimited invoices, all features

Feature checks are done via `SubscriptionContext`:
```typescript
const { hasFeature, canCreateInvoice, canAddUsers } = useSubscription();

if (!hasFeature('advanced_reports')) {
  // Show upgrade prompt
}
```

Usage limits are checked before operations and enforced at 100%. Warning modals appear at 80% usage.

### Payment Integration

Payment flow uses a service pattern:
1. `PaymentService` - Registry managing payment providers
2. `StripeConnectProvider` - Stripe Connect implementation
3. Edge functions handle sensitive operations:
   - `stripe-connect-create-account` - Merchant onboarding
   - `stripe-connect-create-payment` - Payment session creation
   - `stripe-connect-account-status` - Account verification status

**Important**: Never handle Stripe secret keys in frontend. All sensitive operations go through Supabase Edge Functions.

Invoices can accept payments when:
- Payment methods are configured in `PaymentSettings`
- Invoice has `enable_payment_methods: true`
- User has completed Stripe Connect onboarding

### Data Service Layer

All database operations go through `src/services/database.ts`. This service:
- Automatically includes `effectiveUserId` in queries
- Handles team-aware data access
- Manages RLS policy compliance
- Returns typed results

When creating/updating records:
```typescript
import { createInvoice, updateInvoice } from '../services/database';

// Correct - service handles team logic
await createInvoice(userId, invoiceData);

// Wrong - direct Supabase queries bypass team logic
await supabase.from('invoices').insert(invoiceData); // Don't do this
```

### Audit Logging

All significant actions must be logged via `AuditService`:
```typescript
import { AuditService } from '../services/auditService';

await AuditService.log({
  action: 'create' | 'update' | 'delete' | 'view' | 'export',
  entity_type: 'invoice' | 'expense' | 'client' | ...,
  entity_id: recordId,
  userId: user.id,
  metadata: { /* relevant context */ }
});
```

The audit service uses a batch queue pattern - logs are collected and flushed every 5 seconds or when 10 entries accumulate.

### Real-Time Subscriptions

The app uses Supabase real-time subscriptions in several contexts:
- `DataContext` - Business data changes
- `NotificationContext` - New notifications
- `SubscriptionContext` - Subscription updates

When data changes from other clients, the cache updates automatically. Avoid creating duplicate subscriptions in components.

### Recurring Invoices

Recurring invoices use a template system:
- Templates stored in `recurring_invoice_templates`
- Schedule defined by `frequency` (weekly/biweekly/monthly/quarterly/yearly)
- Auto-generation occurs when current date >= `next_generation_date`
- After generation, `last_generated` and `next_generation_date` update
- Manual generation available via "Generate Now" button

### Tax & VAT Handling

Tax calculations consider:
- Tax rates from `tax_rates` table (category-based)
- VAT scheme (standard/cash/flat-rate for UK users)
- Multi-country rules in `src/data/countries.ts`
- Exchange rates for multi-currency transactions

VAT-locked entries cannot be modified after creation (UK compliance requirement).

### Multi-Currency Support

Currency handling:
- Base currency set in user settings
- Exchange rates refreshed every 30 minutes via `currency-exchange` edge function
- Rates cached in localStorage as fallback
- All amounts stored with original currency + converted amount
- Use `SettingsContext.formatCurrency(amount, currency)` for display

### Email System

Email delivery via Resend API through Supabase edge function `send-invoice-email`:
- Queue-based delivery (processed every 30 seconds)
- Email templates stored in `email_templates` table
- Invoice emails support PDF attachments
- Team invitations, password resets, notifications all queued

## Testing Guidelines

Tests use React Testing Library with Jest:
- Mock `useAuth` hook for authenticated state
- Mock `useSubscription` for feature flags
- Mock Supabase client for database calls
- Use `waitFor` for async state updates
- Test user interactions with `userEvent`

Example:
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../contexts/AuthContext');

test('creates invoice', async () => {
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'user-1' },
    loading: false
  });

  render(<InvoiceForm />);
  await userEvent.type(screen.getByLabelText(/client/i), 'Test Client');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(screen.getByText(/invoice created/i)).toBeInTheDocument();
  });
});
```

## Environment Variables

Frontend (bundled into build):
- `REACT_APP_SUPABASE_URL` - Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Supabase anonymous key (public)
- `REACT_APP_SITE_URL` - Application URL for redirects

Backend (Supabase Edge Functions only):
- `STRIPE_SECRET_KEY` - Stripe API secret
- `SUPABASE_SERVICE_ROLE_KEY` - Service role for privileged operations

Never expose backend secrets in frontend code or environment variables.

## Important Patterns & Conventions

### File Organization
- Components organized by feature: `/components/[Feature]/[Component].tsx`
- Shared components in `/components/Common/`
- Services in `/services/`
- Types in `/types/`
- Hooks in `/hooks/`

### Naming Conventions
- Components: PascalCase (e.g., `InvoiceForm`)
- Services: camelCase files, named exports (e.g., `database.ts` exports `createInvoice`)
- Hooks: camelCase with `use` prefix (e.g., `useTeamPermissions`)
- Types: PascalCase interfaces/types (e.g., `Invoice`, `ExpenseFormData`)

### State Management
- Use contexts for global state (auth, data, settings, subscription, notifications)
- Use local state for component-specific UI state
- Use React Query for server state (not currently used extensively, but configured)
- Avoid prop drilling - use context or composition

### Error Handling
- Display user-friendly error messages
- Log errors to console in development
- Use audit trail for security-relevant errors
- Validate on client and server (RLS policies)

### Performance Considerations
- `DataContext` caches business data - use it instead of refetching
- Reports cache for 5 minutes
- AI insights cache for 1 hour
- Exchange rates cache for 30 minutes
- Audit logs batch-insert every 5 seconds

### GDPR Compliance Features
- Data export functionality in Settings > Data Protection
- Data deletion with audit trail
- RoPA (Records of Processing Activities) management for platform admins
- Breach incident tracking with 72-hour notification deadline
- Consent management
- Data retention policies

## Common Pitfalls

1. **Using raw `user.id` for business queries** - Always use `effectiveUserId` from `DataContext`
2. **Bypassing service layer** - Always use `database.ts` services, never direct Supabase calls in components
3. **Forgetting audit logs** - Log all create/update/delete operations
4. **Not checking subscription limits** - Use `SubscriptionContext.canCreateInvoice()` etc before operations
5. **Hardcoding Stripe keys** - Use environment variables and edge functions
6. **Creating duplicate real-time subscriptions** - Check if context already subscribes before adding component subscriptions
7. **Not handling offline state** - Exchange rates and AI features degrade gracefully when offline

## Key Files to Reference

- `src/App.tsx` - Main routing and context provider nesting
- `src/contexts/DataContext.tsx` - Business data management patterns
- `src/services/database.ts` - All CRUD operations and team-aware queries
- `src/config/subscriptionConfig.ts` - Feature flags and plan limits
- `src/services/payment/StripeConnectProvider.ts` - Payment flow implementation
- `src/hooks/useTeamPermissions.ts` - Role checking logic

## Database Schema Notes

Key tables:
- `users` - Supabase auth users
- `user_settings` - Tax, currency, formatting preferences
- `team_members` - Team membership (owner has no entry)
- `platform_admins` - Platform/SEO admin roles
- `subscriptions` - Subscription tier and Stripe IDs
- `incomes` / `expenses` / `invoices` / `clients` - Business entities
- `audit_logs` - Complete audit trail (GDPR Article 32)
- `notifications` / `email_queue` - Notification system
- `recurring_invoice_templates` - Recurring invoice definitions
- `user_payment_accounts` - Stripe Connect account IDs

All business tables include:
- `user_id` - Owner's user ID (never team member's ID)
- `created_at` / `updated_at` - Timestamps

RLS policies enforce data isolation by `user_id` matching authenticated user or their team owner.
