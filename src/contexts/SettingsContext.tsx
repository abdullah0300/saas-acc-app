// src/contexts/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';

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
  baseCurrency: string;
  currencySymbol: string;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  formatCurrency: (amount: number, currency?: string) => string;
  getCurrencySymbol: (currency: string) => string;
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

  useEffect(() => {
    if (user) {
      loadSettings();
    } else {
      // Clear settings when user logs out
      setTaxRates([]);
      setUserSettings(null);
      setLoading(false);
    }
  }, [user]);

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
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 error
      
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
        
        console.log('Attempting to create settings with:', defaultSettings);
        
        const { data: newSettings, error: createError } = await supabase
          .from('user_settings')
          .insert([defaultSettings])
          .select()
          .single();
          
        if (createError) {
          console.error('Failed to create user settings:', createError);
          console.error('Error details:', {
            code: createError.code,
            message: createError.message,
            details: createError.details,
            hint: createError.hint
          });
          
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

  const formatCurrency = (amount: number, currency?: string) => {
    const curr = currency || baseCurrency;
    const symbol = getCurrencySymbol(curr);
    
    // Handle zero
    if (amount === 0) {
      return `${symbol}0.00`;
    }
    
    // For currencies with different formatting conventions
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

  return (
    <SettingsContext.Provider value={{
      taxRates,
      userSettings,
      defaultTaxRate,
      baseCurrency,
      currencySymbol,
      loading,
      refreshSettings,
      formatCurrency,
      getCurrencySymbol
    }}>
      {children}
    </SettingsContext.Provider>
  );
};