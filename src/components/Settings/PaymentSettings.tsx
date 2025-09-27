import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Globe, DollarSign, AlertCircle, Check, ExternalLink } from 'lucide-react';
import { paymentService } from '../../services/payment/PaymentService';
import { useAuth } from '../../contexts/AuthContext';
import { countries } from '../../data/countries';

export const PaymentSettings: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('stripe_connect');
  const [formData, setFormData] = useState({
    country: '',
    businessType: 'individual' as 'individual' | 'company',
    businessName: '',
    defaultCurrency: 'USD',
  });

  useEffect(() => {
    loadAccounts();
  }, [user]);

  const loadAccounts = async () => {
    if (!user) return;
    try {
      const data = await paymentService.getUserPaymentAccounts(user.id);
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    }
  };

  const handleAddAccount = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await paymentService.createPaymentAccount(
        user.id,
        selectedProvider,
        {
          email: user.email!,
          ...formData,
          requestedCapabilities: ['card_payments', 'transfers'],
        }
      );

      // Redirect to Stripe onboarding
      window.location.href = result.onboardingUrl;
    } catch (error: any) {
      alert(`Error creating payment account: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManageAccount = async (account: any) => {
    try {
      const provider = paymentService.getProvider(account.provider);
      const loginUrl = await provider.getAccountLoginLink(account.provider_account_id);
      window.open(loginUrl, '_blank');
    } catch (error) {
      console.error('Error getting login link:', error);
    }
  };

  // Get Stripe Connect supported countries only
  const getStripeConnectSupportedCountries = () => {
    const provider = paymentService.getProvider('stripe_connect');
    return countries.filter(country => {
      const supportedCurrencies = provider.getSupportedCurrencies(country.code);
      return supportedCurrencies.length > 0;
    });
  };

  // Auto-set currency based on country
  useEffect(() => {
    if (formData.country) {
      const country = countries.find(c => c.code === formData.country);
      if (country?.currency) {
        setFormData(prev => ({ ...prev, defaultCurrency: country.currency }));
      }
    }
  }, [formData.country]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Accounts</h1>
        <p className="text-gray-600">
          Connect payment providers to accept payments from your customers
        </p>
      </div>

      {/* Existing Accounts */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Connected Accounts</h2>
        </div>

        <div className="p-6">
          {accounts.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No payment accounts connected yet</p>
              <button
                onClick={() => setShowAddAccount(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4 inline mr-2" />
                Add Payment Account
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {account.business_name || 'Individual Account'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {account.provider === 'stripe_connect' ? 'Stripe' : account.provider}
                        {' • '}
                        {account.country}
                        {' • '}
                        {account.default_currency}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {account.onboarding_completed ? (
                      <span className="flex items-center text-sm text-green-600">
                        <Check className="h-4 w-4 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center text-sm text-yellow-600">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Setup Required
                      </span>
                    )}

                    <button
                      onClick={() => handleManageAccount(account)}
                      className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 inline mr-1" />
                      Manage
                    </button>
                  </div>
                </div>
              ))}

              {!accounts.find(a => a.provider === 'stripe_connect') && (
                <button
                  onClick={() => setShowAddAccount(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  <Plus className="h-4 w-4 inline mr-2" />
                  Add Another Account
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Payment Account
            </h3>

            <div className="space-y-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Provider
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="stripe_connect">Stripe</option>
                  {/* Add more providers as they become available */}
                </select>
              </div>

              {/* Country Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Globe className="h-4 w-4 inline mr-1" />
                  Country
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Country</option>
                  {getStripeConnectSupportedCountries().map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Only countries supported by Stripe Connect are shown
                </p>
              </div>

              {/* Business Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, businessType: 'individual' }))}
                    className={`px-3 py-2 border rounded-lg transition-colors ${
                      formData.businessType === 'individual'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, businessType: 'company' }))}
                    className={`px-3 py-2 border rounded-lg transition-colors ${
                      formData.businessType === 'company'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Company
                  </button>
                </div>
              </div>

              {/* Business Name (if company) */}
              {formData.businessType === 'company' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
              )}

              {/* Default Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="h-4 w-4 inline mr-1" />
                  Default Currency
                </label>
                <select
                  value={formData.defaultCurrency}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultCurrency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                  <option value="INR">INR - Indian Rupee</option>
                  {/* Add more currencies */}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddAccount(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={loading || !formData.country}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Connecting...' : 'Connect Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};