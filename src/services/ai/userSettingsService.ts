/**
 * User Settings Service
 * Fetches user preferences and settings for AI assistant
 */

import { supabase } from '../supabaseClient';

export interface UserSettings {
  base_currency?: string;
  enabled_currencies?: string[];
  default_tax_rate?: number;
  country?: string;
  fiscal_year_start?: string;
  date_format?: string;
  // Add other user settings as needed
}

/**
 * Get user settings from database
 */
export const getUserSettings = async (userId: string): Promise<UserSettings> => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('base_currency, enabled_currencies, country, fiscal_year_start, date_format')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 means no rows returned, which is okay - we'll use defaults
      console.error('Error fetching user settings:', error);
    }

    return {
      base_currency: data?.base_currency || 'USD',
      enabled_currencies: data?.enabled_currencies || [data?.base_currency || 'USD'],
      default_tax_rate: 0, // default_tax_rate is in invoice_settings, not user_settings
      country: data?.country || null,
      fiscal_year_start: data?.fiscal_year_start || null,
      date_format: data?.date_format || 'YYYY-MM-DD',
      ...data,
    };
  } catch (error) {
    console.error('Error getting user settings:', error);
    // Return defaults on error
    return {
      base_currency: 'USD',
      enabled_currencies: ['USD'],
      default_tax_rate: 0,
    };
  }
};

/**
 * Get invoice settings (default tax rate, notes, etc.)
 */
export const getInvoiceSettings = async (userId: string): Promise<{ default_tax_rate?: number; invoice_notes?: string; payment_terms?: number }> => {
  try {
    // Get effective user ID (for team support)
    const { getEffectiveUserId } = await import('../database');
    const effectiveUserId = await getEffectiveUserId(userId);

    const { data, error } = await supabase
      .from('invoice_settings')
      .select('default_tax_rate, invoice_notes, payment_terms')
      .eq('user_id', effectiveUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching invoice settings:', error);
    }

    return {
      default_tax_rate: data?.default_tax_rate ?? undefined,
      invoice_notes: data?.invoice_notes ?? undefined,
      payment_terms: data?.payment_terms ?? undefined,
    };
  } catch (error) {
    console.error('Error getting invoice settings:', error);
    return {};
  }
};

/**
 * Get exchange rate for a currency (relative to base currency)
 */
export const getExchangeRate = async (userId: string, currency: string, baseCurrency: string): Promise<number> => {
  if (currency === baseCurrency) {
    return 1;
  }

  try {
    // Try to fetch exchange rates from Supabase Edge Function
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 1;

    // Get Supabase URL from environment
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    if (!supabaseUrl) {
      console.error('REACT_APP_SUPABASE_URL not found');
      return 1;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/get-exchange-rates`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      // Exchange rates are stored as baseCurrency -> targetCurrency
      // So if base is USD and currency is EUR, we need EUR/USD rate
      const rate = data.rates?.[currency] || 1;
      return rate;
    }

    // Fallback: check localStorage cache
    const cachedData = localStorage.getItem('exchangeRatesCache');
    if (cachedData) {
      try {
        const cache = JSON.parse(cachedData);
        const cachedRate = cache.rates?.[currency];
        if (cachedRate && Date.now() - cache.timestamp < 3600000) { // 1 hour cache
          return cachedRate;
        }
      } catch (e) {
        // Invalid cache
      }
    }

    return 1; // Default to 1 if can't fetch
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return 1;
  }
};

/**
 * Get current date in YYYY-MM-DD format
 */
export const getCurrentDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse relative dates like "yesterday", "today", "tomorrow"
 * Returns YYYY-MM-DD format
 */
export const parseRelativeDate = (dateString: string): string | null => {
  const today = new Date();
  const lowerDate = dateString.toLowerCase().trim();

  if (lowerDate === 'today') {
    return getCurrentDate();
  }

  if (lowerDate === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (lowerDate === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Try to parse as a date string
  // If it's just a date like "11-04" or "04-11", assume current year
  const dateMatch = dateString.match(/^(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{2,4}))?$/);
  if (dateMatch) {
    let month = parseInt(dateMatch[1]);
    let day = parseInt(dateMatch[2]);
    let year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear();

    // Handle 2-digit year
    if (dateMatch[3] && dateMatch[3].length === 2) {
      year = 2000 + parseInt(dateMatch[3]);
    }

    // Handle DD-MM vs MM-DD format (try to detect)
    if (day > 12 && month <= 12) {
      // Probably DD-MM format
      [month, day] = [day, month];
    }

    // Validate and format
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const formattedMonth = String(month).padStart(2, '0');
      const formattedDay = String(day).padStart(2, '0');
      return `${year}-${formattedMonth}-${formattedDay}`;
    }
  }

  // If it's already in YYYY-MM-DD format, return as-is
  const isoMatch = dateString.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return dateString;
  }

  return null; // Could not parse
};



