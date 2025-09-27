# 🔒 Stripe Connect Security Setup Guide

This guide explains how to properly configure your Stripe Connect implementation with the security fixes applied.

## 🚨 Critical Security Changes Made

### Before (Insecure)
- ❌ Stripe secret key exposed in frontend
- ❌ All Stripe operations happening client-side
- ❌ Webhook verification in browser

### After (Secure)
- ✅ All sensitive operations moved to backend
- ✅ Frontend uses API calls only
- ✅ Proper webhook verification on server

## 🛠️ Environment Variables Setup

### Backend Environment Variables (Required)
```bash
# Stripe Configuration (BACKEND ONLY)
STRIPE_SECRET_KEY=sk_test_51...  # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook endpoint secret

# Application URLs
SITE_URL=https://yourdomain.com  # Your production domain
```

### Frontend Environment Variables
```bash
# API Configuration (FRONTEND)
REACT_APP_API_URL=https://api.yourdomain.com/api  # Your backend API URL

# Site URLs (FRONTEND)
REACT_APP_SITE_URL=https://yourdomain.com  # Your frontend domain
```

### ⚠️ REMOVE These Dangerous Variables
Remove these from your frontend `.env` file:
```bash
# ❌ REMOVE - SECURITY RISK
REACT_APP_STRIPE_SECRET_KEY=...  # DELETE THIS
```

## 🏗️ Deployment Architecture

### Required Backend Endpoints
Your backend must implement these API endpoints:

```
POST   /api/stripe-connect/accounts
GET    /api/stripe-connect/accounts/:accountId/status
POST   /api/stripe-connect/accounts/:accountId/login-link
POST   /api/stripe-connect/payment-sessions
GET    /api/stripe-connect/payment-sessions/:sessionId/status
POST   /api/stripe-connect/invoices/:invoiceId/payment-session
POST   /api/webhooks/stripe
```

### Backend Implementation Options

#### Option 1: Express.js Server
```javascript
import express from 'express';
import {
  createConnectedAccount,
  getAccountStatus,
  getAccountLoginLink
} from './api/stripe-connect/accounts';
import {
  createPaymentSession,
  getPaymentStatus,
  createInvoicePaymentSession
} from './api/stripe-connect/payments';
import {
  stripeWebhookHandler,
  parseRawBody
} from './api/webhooks/stripe';

const app = express();

// Webhook endpoint (raw body required)
app.use('/api/webhooks/stripe', parseRawBody);
app.post('/api/webhooks/stripe', stripeWebhookHandler);

// JSON middleware for other routes
app.use(express.json());

// Stripe Connect routes
app.post('/api/stripe-connect/accounts', createConnectedAccount);
app.get('/api/stripe-connect/accounts/:accountId/status', getAccountStatus);
app.post('/api/stripe-connect/accounts/:accountId/login-link', getAccountLoginLink);
app.post('/api/stripe-connect/payment-sessions', createPaymentSession);
app.get('/api/stripe-connect/payment-sessions/:sessionId/status', getPaymentStatus);
app.post('/api/stripe-connect/invoices/:invoiceId/payment-session', createInvoicePaymentSession);

app.listen(3001);
```

#### Option 2: Serverless Functions (Vercel/Netlify)
Deploy each endpoint as a separate serverless function:
- `api/stripe-connect/accounts.js`
- `api/stripe-connect/payments.js`
- `api/webhooks/stripe.js`

#### Option 3: Supabase Edge Functions
```javascript
// supabase/functions/stripe-connect-accounts/index.ts
import { createConnectedAccount } from '../../../src/api/stripe-connect/accounts.ts';
serve(createConnectedAccount);
```

## 🔧 Database Schema Updates

Add these fields to your `user_payment_accounts` table:
```sql
ALTER TABLE user_payment_accounts
ADD COLUMN IF NOT EXISTS requirements JSONB,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
```

Add to your `payment_webhooks` table:
```sql
ALTER TABLE payment_webhooks
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
```

## 🔗 Stripe Webhook Configuration

### 1. Create Webhook Endpoint in Stripe Dashboard
- Go to Stripe Dashboard → Developers → Webhooks
- Add endpoint: `https://api.yourdomain.com/api/webhooks/stripe`
- Select these events:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `account.updated`
  - `account.application.deauthorized`

### 2. Copy Webhook Secret
- Copy the webhook signing secret (`whsec_...`)
- Add to your backend environment as `STRIPE_WEBHOOK_SECRET`

## 🧪 Testing Your Setup

### 1. Test Account Creation
```javascript
// Frontend test
const result = await paymentService.createPaymentAccount(
  'user123',
  'stripe_connect',
  {
    email: 'test@example.com',
    country: 'US',
    businessType: 'individual',
    defaultCurrency: 'USD',
    requestedCapabilities: ['card_payments', 'transfers']
  }
);
console.log(result.onboardingUrl); // Should get Stripe onboarding URL
```

### 2. Test Webhook Processing
```bash
# Use Stripe CLI to forward webhooks to local development
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

## 🔍 Security Checklist

- [ ] Stripe secret key only in backend environment
- [ ] Frontend uses `REACT_APP_API_URL` for API calls
- [ ] Webhook signature verification enabled
- [ ] All payment operations go through backend
- [ ] No Stripe imports in frontend code
- [ ] HTTPS enabled for production
- [ ] Environment variables properly configured
- [ ] Database permissions restricted
- [ ] API authentication implemented (recommended)

## 🚨 Security Best Practices

1. **Never commit secrets**: Use `.env` files and `.gitignore`
2. **Use HTTPS**: All communication must be encrypted
3. **Validate inputs**: Sanitize all user inputs
4. **Rate limiting**: Implement API rate limits
5. **Authentication**: Add user authentication to API endpoints
6. **Monitoring**: Log all payment operations
7. **Regular updates**: Keep Stripe SDK updated

## 🆘 Troubleshooting

### Frontend Still Has Stripe Imports
```bash
# Search for problematic imports
grep -r "import.*stripe" src/
# Should only show interfaces, not actual Stripe SDK usage
```

### Webhook Verification Failing
```bash
# Check webhook secret format
echo $STRIPE_WEBHOOK_SECRET | head -c 10  # Should show "whsec_"
```

### API Calls Failing
```bash
# Check API URL configuration
echo $REACT_APP_API_URL  # Should point to your backend
```

This security overhaul ensures your Stripe Connect implementation follows industry best practices and protects your sensitive data.