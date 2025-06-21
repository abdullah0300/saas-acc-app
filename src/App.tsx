// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Login } from './components/Auth/Login';
import { Register } from './components/Auth/Register';
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
import { ReportsOverview } from './components/Reports/ReportsOverview';
import { ProfitLossReport } from './components/Reports/ProfitLossReport';
import { ClientList } from './components/Client/ClientList';
import { ClientForm } from './components/Client/ClientForm';
import { SettingsLayout } from './components/Settings/SettingsLayout';
import { ProfileSettings } from './components/Settings/ProfileSettings';
import { TaxSettings } from './components/Settings/TaxSettings';
import { CurrencySettings } from './components/Settings/CurrencySettings';
import { InvoiceSettings } from './components/Invoice/InvoiceSettings';
import { TeamManagement } from './components/Settings/TeamManagement';
import { SubscriptionPlans } from './components/Subscription/SubscriptionPlans';
import { PaymentSuccess } from './components/Subscription/PaymentSuccess';
import { BudgetPlanning } from './components/Budget/BudgetPlanning';
import { NotificationCenter } from './components/Notifications/NotificationCenter';
import { NotificationPreferences } from './components/Settings/NotificationPreferences';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/invoices/:id/public" element={<PublicInvoiceView />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes */}
          <Route element={
            <ProtectedRoute>
              <DataProvider>
                <SettingsProvider>
                  <NotificationProvider>
                    <Layout />
                  </NotificationProvider>
                </SettingsProvider>
              </DataProvider>
            </ProtectedRoute>
          }>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Income */}
            <Route path="/income" element={<IncomeList />} />
            <Route path="/income/new" element={<IncomeForm />} />
            <Route path="/income/:id/edit" element={<IncomeForm />} />
            
            {/* Expenses */}
            <Route path="/expenses" element={<ExpenseList />} />
            <Route path="/expenses/new" element={<ExpenseForm />} />
            <Route path="/expenses/:id/edit" element={<ExpenseForm />} />
            
            {/* Invoices */}
            <Route path="/invoices" element={<InvoiceList />} />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
            <Route path="/invoices/:id/view" element={<InvoiceView />} />
            
            {/* Notifications */}
            <Route path="/notifications" element={<NotificationCenter />} />
            
            {/* Clients */}
            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/new" element={<ClientForm />} />
            <Route path="/clients/:id/edit" element={<ClientForm />} />
            
            {/* Reports */}
            <Route path="/reports" element={<ReportsOverview />} />
            <Route path="/reports/profit-loss" element={<ProfitLossReport />} />
            
            {/* Budget */}
            <Route path="/budget" element={<BudgetPlanning />} />
            
            {/* Settings */}
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="/settings/profile" replace />} />
              <Route path="profile" element={<ProfileSettings />} />
              <Route path="tax" element={<TaxSettings />} />
              <Route path="currency" element={<CurrencySettings />} />
              <Route path="invoice" element={<InvoiceSettings onClose={() => {}} />} />
              <Route path="notifications" element={<NotificationPreferences />} />
              <Route path="team" element={<TeamManagement />} />
              <Route path="subscription" element={<SubscriptionPlans />} />
            </Route>
            
            <Route path="/payment/success" element={<PaymentSuccess />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;