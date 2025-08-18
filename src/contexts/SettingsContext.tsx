// src/contexts/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { countries } from '../data/countries';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  is_default: boolean;
}

interface UserSettings {
  base_currency: string;
  enabled_currencies: string[];
  date_format: string;
  fiscal_year_start?: number;
  country?: string;
  state?: string;
}

interface SettingsContextType {
  taxRates: TaxRate[];
  userSettings: UserSettings | null;
  defaultTaxRate: number;
  taxName: string;
  userCountry: string;
  baseCurrency: string;
  currencySymbol: string;
  loading: boolean;
  exchangeRatesLoading: boolean; // ADD THIS
  refreshSettings: () => Promise<void>;
  formatCurrency: (amount: number, currency?: string) => string;
  getCurrencySymbol: (currency: string) => string;
  exchangeRates: { [key: string]: number };
  exchangeRateStatus: 'online' | 'offline' | 'manual' | 'loading';
  getExchangeRate: (from: string, to: string) => Promise<number>;
  convertCurrency: (amount: number, from: string, to: string) => Promise<number>;
  refreshExchangeRates: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

const CURRENCY_SYMBOLS: { [key: string]: string } = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  INR: '₹',
  PKR: 'Rs',
  AED: 'د.إ',
  SAR: '﷼',
  SGD: 'S$',
  MYR: 'RM',
  NZD: 'NZ$',
  ZAR: 'R'
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [exchangeRatesLoading, setExchangeRatesLoading] = useState(true); // ADD THIS
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({});
  const [exchangeRateStatus, setExchangeRateStatus] = useState<'online' | 'offline' | 'manual' | 'loading'>('loading');

  // REPLACE YOUR useEffect WITH THIS:
  useEffect(() => {
    if (user) {
      loadSettings();
    } else {
      setTaxRates([]);
      setUserSettings(null);
      setExchangeRates({});
      setExchangeRateStatus('loading');
      setLoading(false);
      setExchangeRatesLoading(false);
    }
  }, [user]);

  // ADD THIS NEW useEffect FOR EXCHANGE RATES:
  useEffect(() => {
    // Load exchange rates after userSettings is loaded
    if (userSettings?.base_currency) {
      loadExchangeRates();
      
      // Set up interval to refresh exchange rates every 30 minutes
      const interval = setInterval(() => {
        loadExchangeRates();
      }, 30 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, [userSettings?.base_currency, userSettings?.enabled_currencies]);

  const loadSettings = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Load tax rates
      const { data: taxData, error: taxError } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (taxError) {
        console.error('Error loading tax rates:', taxError);
      } else {
        setTaxRates(taxData || []);
      }
      
      // Load user settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!settingsData) {
        // No settings found - create default settings
        console.log('No user settings found, creating defaults...');
        
        const defaultSettings = {
          user_id: user.id,
          base_currency: 'USD',
          enabled_currencies: ['USD'],
          date_format: 'MM/DD/YYYY',
          fiscal_year_start: 1,
          country: 'US'
        };
        
        const { data: newSettings, error: createError } = await supabase
          .from('user_settings')
          .insert([defaultSettings])
          .select()
          .single();
          
        if (createError) {
          console.error('Failed to create user settings:', createError);
          
          // Check if it's a unique constraint violation
          if (createError.code === '23505') {
            console.log('Settings already exist, trying to fetch again...');
            // Try to fetch again
            const { data: retryData } = await supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', user.id)
              .single();
              
            if (retryData) {
              setUserSettings(retryData);
              return;
            }
          }
          
          // Use defaults in memory
          setUserSettings({
            base_currency: 'USD',
            enabled_currencies: ['USD'],
            date_format: 'MM/DD/YYYY',
            fiscal_year_start: 1
          });
        } else {
          console.log('Settings created successfully:', newSettings);
          setUserSettings(newSettings);
        }
      } else if (settingsData) {
        setUserSettings(settingsData);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      // Set defaults on error
      setUserSettings({
        base_currency: 'USD',
        enabled_currencies: ['USD'],
        date_format: 'MM/DD/YYYY',
        fiscal_year_start: 1
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  const defaultTaxRate = taxRates.find(rate => rate.is_default)?.rate || 0;
  const baseCurrency = userSettings?.base_currency || 'USD';
  const currencySymbol = CURRENCY_SYMBOLS[baseCurrency] || '$';

  const getCurrencySymbol = (currency: string) => {
    return CURRENCY_SYMBOLS[currency] || currency;
  };

  // UPDATE YOUR formatCurrency FUNCTION:
  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || baseCurrency;
    const symbol = getCurrencySymbol(curr);
    
    // Handle loading state
    if (exchangeRatesLoading && curr !== baseCurrency) {
      return `${symbol} ${amount.toLocaleString()} (...)`;
    }
    
    switch (curr) {
      case 'INR':
        // Indian numbering system
        return `${symbol} ${amount.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`;
      
      case 'PKR':
        // Pakistani Rupee
        return `${symbol} ${amount.toLocaleString('en-PK', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`;
      
      case 'EUR':
        // Euro formatting (symbol after)
        return `${amount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} ${symbol}`;
      
      case 'JPY':
        // Japanese Yen (no decimals)
        return `${symbol}${amount.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        })}`;
      
      default:
        // Default formatting
        return `${symbol}${amount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`;
    }
  };

  // UPDATE YOUR loadExchangeRates FUNCTION:
  const loadExchangeRates = async () => {
    if (!user || !userSettings?.base_currency) return;
    
    setExchangeRateStatus('loading');
    setExchangeRatesLoading(true); // ADD THIS
    
    try {
      // First, try to get from localStorage cache
      const cachedData = localStorage.getItem('exchangeRatesCache');
      if (cachedData) {
        const { rates, timestamp, baseCurrency: cachedBase } = JSON.parse(cachedData);
        const cacheAge = Date.now() - timestamp;
        
        // Use cache if it's less than 5 minutes old and for the same base currency
        if (cacheAge < 5 * 60 * 1000 && cachedBase === userSettings.base_currency) {
          setExchangeRates(rates);
          setExchangeRateStatus('online');
          setExchangeRatesLoading(false);
          return;
        }
      }
      
      const { data, error } = await supabase.functions.invoke('currency-exchange', {
        body: {
          action: 'getRatesWithStatus',
          userId: user.id,
          baseCurrency: userSettings.base_currency,
          currencies: userSettings.enabled_currencies || ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR', 'CAD', 'AUD', 'JPY']
        }
      });

      if (!error && data) {
        setExchangeRates(data.rates || {});
        setExchangeRateStatus(data.status || 'offline');
        
        // Cache the rates
        localStorage.setItem('exchangeRatesCache', JSON.stringify({
          rates: data.rates || {},
          timestamp: Date.now(),
          baseCurrency: userSettings.base_currency
        }));
      } else {
        setExchangeRateStatus('offline');
      }
    } catch (err) {
      console.error('Error loading exchange rates:', err);
      setExchangeRateStatus('offline');
    } finally {
      setExchangeRatesLoading(false); // ADD THIS
    }
  };

  // UPDATE YOUR getExchangeRate FUNCTION:
  const getExchangeRate = async (from: string, to: string): Promise<number> => {
    if (from === to) return 1;
    
    // Check if we have the rate in memory
    if (from === baseCurrency && exchangeRates[to]) {
      return exchangeRates[to];
    }
    
    // Otherwise fetch it
    try {
      const { data } = await supabase.functions.invoke('currency-exchange', {
        body: {
          action: 'convert',
          userId: user?.id,
          amount: 1,
          from,
          to
        }
      });
      
      return data?.rate || 1;
    } catch (error) {
      console.error('Error getting exchange rate:', error);
      return 1;
    }
  };

  // UPDATE YOUR convertCurrency FUNCTION:
  const convertCurrency = async (amount: number, from: string, to: string): Promise<number> => {
    if (from === to) return amount;
    
    const rate = await getExchangeRate(from, to);
    return amount * rate;
  };

  const refreshExchangeRates = async () => {
    setExchangeRates({}); // Clear current rates to force refresh
    localStorage.removeItem('exchangeRatesCache'); // Clear cache
    await loadExchangeRates();
  };

  return (
    <SettingsContext.Provider value={{
      taxRates,
      userSettings,
      defaultTaxRate,
      taxName: countries.find(c => c.code === userSettings?.country)?.taxName || 'Tax',
      userCountry: userSettings?.country || '',
      baseCurrency,
      currencySymbol,
      loading,
      exchangeRatesLoading, // ADD THIS
      refreshSettings,
      formatCurrency,
      getCurrencySymbol,
      exchangeRates,
      exchangeRateStatus,
      getExchangeRate,
      convertCurrency,
      refreshExchangeRates
    }}>
      {children}
    </SettingsContext.Provider>
  );
};