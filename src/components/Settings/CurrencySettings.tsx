import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Check, RefreshCw, Globe, Loader2, Plus, X } from 'lucide-react';

// Available currencies constant
const AVAILABLE_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs', flag: '🇵🇰' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦' }
];

export const CurrencySettings: React.FC = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useData();
  const {
    userSettings,
    baseCurrency,
    exchangeRates,
    exchangeRatesLoading,
    exchangeRateStatus,
    refreshExchangeRates,
    refreshSettings
  } = useSettings();

  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(
    userSettings?.enabled_currencies || []
  );

  // Update selectedCurrencies when userSettings changes
  useEffect(() => {
    if (userSettings?.enabled_currencies) {
      setSelectedCurrencies(userSettings.enabled_currencies);
    }
  }, [userSettings?.enabled_currencies]);

  // Get only enabled currencies for display
  const enabledCurrencies = AVAILABLE_CURRENCIES.filter(
    currency => selectedCurrencies.includes(currency.code)
  );

  // Get available currencies for the add modal (excluding already enabled ones)
  const availableCurrenciesToAdd = AVAILABLE_CURRENCIES.filter(
    currency => !selectedCurrencies.includes(currency.code)
  );

  const handleAddCurrency = (currencyCode: string) => {
    setSelectedCurrencies([...selectedCurrencies, currencyCode]);
    setShowAddCurrency(false);
  };

  const handleRemoveCurrency = (currencyCode: string) => {
    // Don't allow removing base currency
    if (currencyCode === baseCurrency) {
      alert("You cannot remove your base currency.");
      return;
    }
    
    setSelectedCurrencies(selectedCurrencies.filter(code => code !== currencyCode));
  };

  const handleSave = async () => {
    if (!user || !effectiveUserId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          enabled_currencies: selectedCurrencies,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', effectiveUserId);

      if (error) throw error;
      
      await refreshSettings();
      alert('Currency settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving currency settings:', error);
      alert('Error saving settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshRates = async () => {
    setRefreshing(true);
    try {
      await refreshExchangeRates();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Currency Settings</h2>
        <p className="text-sm text-gray-600">
          Manage currencies for your invoices and transactions
        </p>
      </div>

      {/* Base Currency Display */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">Base Currency</p>
            <p className="text-lg font-semibold text-blue-700">{baseCurrency}</p>
          </div>
          <Globe className="h-8 w-8 text-blue-600" />
        </div>
      </div>

      {/* Exchange Rate Status */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            exchangeRateStatus === 'online' ? 'bg-green-500' : 
            exchangeRateStatus === 'offline' ? 'bg-red-500' : 
            'bg-yellow-500'
          }`} />
          <span className="text-sm text-gray-600">
            Rates: {exchangeRateStatus === 'online' ? 'Live' : 
                   exchangeRateStatus === 'offline' ? 'Cached' : 
                   'Manual'}
          </span>
        </div>
        <button
          onClick={handleRefreshRates}
          disabled={refreshing || exchangeRatesLoading}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Rates
        </button>
      </div>

      {/* Enabled Currencies */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Enabled Currencies</h3>
          <button
            onClick={() => setShowAddCurrency(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Currency
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enabledCurrencies.map((currency) => (
            <div
              key={currency.code}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{currency.flag}</span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {currency.symbol} {currency.code}
                    </p>
                    <p className="text-sm text-gray-500">{currency.name}</p>
                  </div>
                </div>
                {currency.code !== baseCurrency && (
                  <button
                    onClick={() => handleRemoveCurrency(currency.code)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Remove currency"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                {currency.code === baseCurrency ? (
                  <span className="text-indigo-600 font-medium">Base Currency</span>
                ) : exchangeRatesLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading rate...
                  </span>
                ) : (
                  <span>
                    1 {baseCurrency} = {exchangeRates[currency.code]?.toFixed(4) || '...'} {currency.code}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {enabledCurrencies.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No currencies enabled. Add currencies to get started.</p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Add Currency Modal */}
      {showAddCurrency && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add Currency</h3>
                <button
                  onClick={() => setShowAddCurrency(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-2">
                {availableCurrenciesToAdd.map((currency) => (
                  <button
                    key={currency.code}
                    onClick={() => handleAddCurrency(currency.code)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  >
                    <span className="text-2xl">{currency.flag}</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {currency.code} - {currency.symbol}
                      </p>
                      <p className="text-sm text-gray-500">{currency.name}</p>
                    </div>
                    <Plus className="h-5 w-5 text-gray-400" />
                  </button>
                ))}
                
                {availableCurrenciesToAdd.length === 0 && (
                  <p className="text-center py-4 text-gray-500">
                    All available currencies are already enabled.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};