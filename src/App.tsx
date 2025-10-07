// src/App.tsx
import React from 'react';
import { LandingPage } from './components/Landing/LandingPage';
import { LandingPageAwwrd } from './components/Landing/LandingPageAwwrd';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { DataProvider } from './contexts/DataContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Login } from './components/Auth/Login';
import { Register } from './components/Auth/Register';
import { ResetPassword } from './components/Auth/ResetPassword';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { IncomeList } from './components/Income/IncomeList';
import { IncomeForm } from './components/Income/IncomeForm';
import { ExpenseList } from './components/Expense/ExpenseList';
import { ExpenseForm } from './components/Expense/ExpenseForm';
import { InvoiceList } from './components/Invoice/InvoiceList';
import { InvoiceForm } from './components/Invoice/InvoiceForm';
import { InvoiceView } from './components/Invoice/InvoiceView';
import { PublicInvoiceView } from './components/Invoice/PublicInvoiceView';
import { InvoiceTemplatesPage } from './components/Invoice/InvoiceTemplatesPage';
import { ReportsOverview } from './components/Reports/ReportsOverview';
import { ProfitLossReport } from './components/Reports/ProfitLossReport';
import { VATReport } from './components/Reports/VATReport';
import { ClientList } from './components/Client/ClientList';
import { ClientForm } from './components/Client/ClientForm';
import { SettingsLayout } from './components/Settings/SettingsLayout';
import { ProfileSettings } from './components/Settings/ProfileSettings';
import { PaymentSettings } from './components/Settings/PaymentSettings';
import { TaxSettings } from './components/Settings/TaxSettings';
import { CurrencySettings } from './components/Settings/CurrencySettings';
import { InvoiceSettings } from './components/Invoice/InvoiceSettings';
import { TeamManagement } from './components/Settings/TeamManagement';
import { SubscriptionPlans } from './components/Subscription/SubscriptionPlans';
import { PaymentSuccess } from './components/Subscription/PaymentSuccess';
import { BudgetPlanning } from './components/Budget/BudgetPlanning';
import { NotificationCenter } from './components/Notifications/NotificationCenter';
import { NotificationPreferences } from './components/Settings/NotificationPreferences';
import { AuditLogs } from './components/Settings/AuditLogs';
import { CashFlowInsights } from './components/Reports/CashFlowInsights';
import { TaxReport } from './components/Reports/TaxReport';
import { SubscriptionEnforcer } from './components/Subscription/SubscriptionEnforcer';
import { PlanProtectedRoute } from './components/Auth/PlanProtectedRoute';
import { VendorList, VendorForm } from './components/Vendors';
import { LoanList } from './components/Loans/LoanList';
import { LoanForm } from './components/Loans/LoanForm';
import { LoanView } from './components/Loans/LoanView';
import { ClientProfitability } from './components/Reports/ClientProfitability';
import { SecuritySettings } from './components/Settings/SecuritySettings';
import { ImportHistorySettings } from './components/Settings/ImportHistorySettings';
import { CreditNoteList } from './components/CreditNote/CreditNoteList';
import { CreditNoteForm } from './components/CreditNote/CreditNoteForm';
import { CreditNoteView } from './components/CreditNote/CreditNoteView';
import { VATReturn } from './components/Reports/VATReturn';
import { RecurringInvoices } from './components/Invoice/RecurringInvoices';
import { RecurringInvoiceEdit } from './components/Invoice/RecurringInvoiceEdit';
import { RecurringInvoiceTemplateEdit } from './components/Invoice/RecurringInvoiceTemplateEdit';
import { SetupWizard } from './components/Onboarding/SetupWizard';
import { PrivacyPolicy } from './components/Legal/PrivacyPolicy';
import { TermsOfService } from './components/Legal/TermsOfService';
import { SmartRedirect } from './components/Auth/SmartRedirect';
import { OwnerOnlyRoute } from './components/Auth/OwnerOnlyRoute';
import { useSessionKeepAlive } from './hooks/useSessionKeepAlive';
import { useAuth } from './contexts/AuthContext';
import { Loader } from 'lucide-react';

// Debug: Log environment variables
console.log('🔧 App.tsx Environment Debug:');
console.log('REACT_APP_SITE_URL:', process.env.REACT_APP_SITE_URL);
console.log('window.location.origin:', window.location.origin);

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes (gcTime in v5)
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Refetch on window focus
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});   

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
      
      {/* React Query DevTools - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

// Internal component that has access to auth context
function AppRoutes() {
  useSessionKeepAlive();
  const { user, loading } = useAuth();
  
  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading SmartCFO...</p>
        </div>
      </div>
    );
  }
  
  return (
    <Routes>
      {/* Public routes */}
      {/* Landing Page with smart redirect logic */}
      <Route path="/" element={<SmartRedirect fallback={<LandingPageAwwrd />} />} />
      <Route path="/invoice/public/:id" element={<PublicInvoiceView />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/setup" element={
        <ProtectedRoute>
          <SetupWizard />
        </ProtectedRoute>
      } />

      {/* Legal pages - public access */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />

      {/* Protected routes */}
      <Route element={
        <ProtectedRoute>
          <SubscriptionProvider>
            <SubscriptionEnforcer>
            <DataProvider>
              <SettingsProvider>
                <NotificationProvider>
                  <Layout />
                </NotificationProvider>
              </SettingsProvider>
            </DataProvider>
            </SubscriptionEnforcer>
          </SubscriptionProvider>
        </ProtectedRoute>
      }>
        <Route path="/app" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Income */}
        <Route path="/income" element={<IncomeList />} />
        <Route path="/income/new" element={<IncomeForm />} />
        <Route path="/income/edit/:id" element={<IncomeForm />} />
        
        {/* Expenses */}
        <Route path="/expenses" element={<ExpenseList />} />
        <Route path="/expenses/new" element={<ExpenseForm />} />
        <Route path="/expenses/edit/:id" element={<ExpenseForm />} />
        
        {/* Invoices */}
        <Route path="/invoices" element={<InvoiceList />} />
        <Route path="/invoices/new" element={<InvoiceForm />} />
        <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
        <Route path="/invoices/:id/view" element={<InvoiceView />} />
        <Route path="/invoices/templates" element={<InvoiceTemplatesPage />} />
        <Route path="/reports/vat-return" element={<VATReturn />} />
        {/* Recurring */}
        <Route path="/invoices/recurring" element={<RecurringInvoices />} />
        <Route path="/invoices/recurring/edit/:id" element={<RecurringInvoiceEdit />} />
        <Route path="/invoices/recurring/template/:id" element={<RecurringInvoiceTemplateEdit />} />
        
        {/* Notifications */}
        <Route path="/notifications" element={<NotificationCenter />} />
        
        {/* Clients */}
        <Route path="/clients" element={<ClientList />} />
        <Route path="/clients/new" element={<ClientForm />} />
        <Route path="/clients/edit/:id" element={<ClientForm />} />

        {/* Credit Notes */}
        <Route path="/credit-notes" element={<CreditNoteList />} />
        <Route path="/credit-notes/new/:invoiceId?" element={<CreditNoteForm />} />
        <Route path="/credit-notes/edit/:id" element={<CreditNoteForm />} />
        <Route path="/credit-notes/:id" element={<CreditNoteView />} />
        
        {/* Vendors */}
        <Route path="/vendors" element={<VendorList />} />
        <Route path="/vendors/new" element={<VendorForm />} />
        <Route path="/vendors/:id/edit" element={<VendorForm />} />

        {/* Loans */}
        <Route path="/loans" element={<LoanList />} />
        <Route path="/loans/new" element={<LoanForm />} />
        <Route path="/loans/:id" element={<LoanView />} />
        <Route path="/loans/:id/edit" element={<LoanForm />} />

        {/* Reports */}
        <Route path="/reports" element={<ReportsOverview />} />
        <Route path="/reports/profit-loss" element={
          <PlanProtectedRoute feature="profit_loss_statements"
            featureName="Profit & Loss Statements"
            fallbackPath="/reports">
            <ProfitLossReport />
          </PlanProtectedRoute>
        } />
        <Route path="/reports/client-profitability" element={
          <PlanProtectedRoute feature="advanced_reports"
            featureName="Client Profitability Analysis"
            fallbackPath="/reports">
            <ClientProfitability />
          </PlanProtectedRoute>
        } />
        <Route path="/reports/cash-flow" element={
          <PlanProtectedRoute feature="cash_flow_analysis"
            featureName="Cash Flow Analysis"
            fallbackPath="/reports">
            <CashFlowInsights />
          </PlanProtectedRoute>
        } />
        <Route path="/reports/vat" element={
          <PlanProtectedRoute feature="advanced_reports"
            featureName="VAT/Tax Report"
            fallbackPath="/reports">
            <VATReport />
          </PlanProtectedRoute>
        } />
        <Route path="/reports/tax" element={
          <PlanProtectedRoute feature="advanced_tax_reports"
            featureName="Advanced Tax Reports"
            fallbackPath="/reports">
            <TaxReport />
          </PlanProtectedRoute>
        } />
        
        {/* Budget Planning - Plus only */}
        <Route path="/budget" element={
          <PlanProtectedRoute feature="budget_tracking">
            <BudgetPlanning />
          </PlanProtectedRoute>
        } />
        
        {/* Settings */}
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="/settings/profile" replace />} />
          {/* Personal Settings - Accessible to all */}
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="notifications" element={<NotificationPreferences />} />
          <Route path="security" element={<SecuritySettings />} />
          {/* Company Settings - Owner only */}
          <Route path="team" element={<OwnerOnlyRoute><TeamManagement /></OwnerOnlyRoute>} />
          <Route path="subscription" element={<OwnerOnlyRoute><SubscriptionPlans /></OwnerOnlyRoute>} />
          <Route path="payment-accounts" element={<OwnerOnlyRoute><PaymentSettings /></OwnerOnlyRoute>} />
          <Route path="tax" element={<OwnerOnlyRoute><TaxSettings /></OwnerOnlyRoute>} />
          <Route path="currency" element={<OwnerOnlyRoute><CurrencySettings /></OwnerOnlyRoute>} />
          <Route path="import-history" element={<OwnerOnlyRoute><ImportHistorySettings /></OwnerOnlyRoute>} />
          <Route path="invoice" element={<OwnerOnlyRoute><InvoiceSettings onClose={() => {}} /></OwnerOnlyRoute>} />
          <Route path="audit" element={<OwnerOnlyRoute><AuditLogs /></OwnerOnlyRoute>} />
        </Route>
        
        <Route path="/payment/success" element={<PaymentSuccess />} />
      </Route>
    </Routes>
  );
}

export default App;