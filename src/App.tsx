import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { SettingsProvider } from './contexts/SettingsContext';
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

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <SettingsProvider>
          <Router>
            <Routes>
              {/* Auth Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Dashboard */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Income Routes */}
              <Route
                path="/income"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <IncomeList />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/income/new"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <IncomeForm />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/income/:id/edit"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <IncomeForm />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Expense Routes */}
              <Route
                path="/expenses"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ExpenseList />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/expenses/new"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ExpenseForm />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/expenses/:id/edit"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ExpenseForm />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Client Routes */}
              <Route
                path="/clients"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ClientList />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients/new"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ClientForm />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients/:id/edit"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ClientForm />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Invoice Routes */}
              <Route
                path="/invoices"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <InvoiceList />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices/new"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <InvoiceForm />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices/:id/edit"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <InvoiceForm />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices/:id/view"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <InvoiceView />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Budget Route */}
              <Route
                path="/budget"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <BudgetPlanning />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Reports Routes */}
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ReportsOverview />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/profit-loss"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProfitLossReport />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Settings Routes */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SettingsLayout />
                    </Layout>
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/settings/profile" replace />} />
                <Route path="profile" element={<ProfileSettings />} />
                <Route path="team" element={<TeamManagement />} />
                <Route path="subscription" element={<SubscriptionPlans />} />
                <Route path="tax" element={<TaxSettings />} />
                <Route path="currency" element={<CurrencySettings />} />
                {/* Invoice settings removed from here - it's a modal, not a page */}
              </Route>

              {/* Payment Success Route */}
              <Route
                path="/payment/success"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PaymentSuccess />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Catch all */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Router>
        </SettingsProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;