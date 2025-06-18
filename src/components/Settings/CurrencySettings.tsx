import React, { useState, useEffect } from 'react';
import { Save, Globe, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext'; // Added useSettings import
import { supabase } from '../../services/supabaseClient';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
}

const POPULAR_CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchange_rate: 1 },
  { code: 'EUR', name: 'Euro', symbol: '€', exchange_rate: 0.85 },
  { code: 'GBP', name: 'British Pound', symbol: '£', exchange_rate: 0.73 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', exchange_rate: 110.0 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', exchange_rate: 1.35 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', exchange_rate: 1.25 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', exchange_rate: 83.0 },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs', exchange_rate: 280.0 },
];

export const CurrencySettings: React.FC = () => {
  const { user } = useAuth();
  const { refreshSettings } = useSettings(); // Added refreshSettings
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(['USD']);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      loadCurrencySettings();
    }
  }, [user]);

  const loadCurrencySettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('base_currency, enabled_currencies')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setBaseCurrency(data.base_currency || 'USD');
        setEnabledCurrencies(data.enabled_currencies || ['USD']);
      }
    } catch (err: any) {
      console.error('Error loading currency settings:', err);
    }
  };

 const handleSave = async () => {
  if (!user) return;
  
  setLoading(true);
  setSuccess(false);
  
  try {
    // Change from insert to upsert
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        base_currency: baseCurrency,
        enabled_currencies: enabledCurrencies,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id' // Specify the conflict column
      });
    
    if (error) throw error;
    
    // Refresh settings after save
    if (refreshSettings) {
      await refreshSettings();
    }
    
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  } catch (err: any) {
    console.error('Error saving settings:', err);
  } finally {
    setLoading(false);
  }
};

  const toggleCurrency = (code: string) => {
    if (code === baseCurrency) return; // Can't disable base currency
    
    setEnabledCurrencies(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Currency Settings</h2>
      
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          Currency settings saved successfully!
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Base Currency</h3>
          <select
            value={baseCurrency}
            onChange={(e) => {
              setBaseCurrency(e.target.value);
              if (!enabledCurrencies.includes(e.target.value)) {
                setEnabledCurrencies([...enabledCurrencies, e.target.value]);
              }
            }}
            className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {POPULAR_CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code} - {currency.name} ({currency.symbol})
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-2">
            This will be your default currency for all transactions
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Enabled Currencies</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {POPULAR_CURRENCIES.map((currency) => (
              <label
                key={currency.code}
                className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                  currency.code === baseCurrency ? 'bg-blue-50 border-blue-300' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={enabledCurrencies.includes(currency.code)}
                    onChange={() => toggleCurrency(currency.code)}
                    disabled={currency.code === baseCurrency}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">
                      {currency.symbol} {currency.code}
                    </p>
                    <p className="text-sm text-gray-500">{currency.name}</p>
                  </div>
                </div>
                {currency.code !== baseCurrency && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600">1 {baseCurrency} =</p>
                    <p className="font-medium">
                      {(POPULAR_CURRENCIES.find(c => c.code === baseCurrency)?.exchange_rate! / currency.exchange_rate).toFixed(4)} {currency.code}
                    </p>
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};