/**
 * Tax Rate Tools
 * Tools for fetching and creating tax rates
 */

import { supabase } from '../../../supabaseClient';

interface TaxRate {
  id: string;
  user_id: string;
  name: string;
  rate: number;
  is_default: boolean;
  created_at: string;
}

/**
 * Get all tax rates for a user
 */
export const getTaxRatesTool = async (userId: string): Promise<TaxRate[]> => {
  try {
    const { data, error } = await supabase
      .from('tax_rates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('[getTaxRatesTool] Error:', error);
    return [];
  }
};

/**
 * Search for a tax rate by percentage
 * Returns exact match or similar matches (within 0.5% tolerance)
 */
export const searchTaxRateByPercentage = async (
  userId: string,
  percentage: number
): Promise<{ exactMatch: TaxRate | null; similarRates: TaxRate[] }> => {
  try {
    const allRates = await getTaxRatesTool(userId);

    // Check for exact match (within 0.01% tolerance for floating point)
    const exactMatch = allRates.find(
      (rate) => Math.abs(rate.rate - percentage) < 0.01
    );

    if (exactMatch) {
      return { exactMatch, similarRates: [] };
    }

    // Find similar rates (within 0.5% tolerance)
    const similarRates = allRates.filter(
      (rate) => Math.abs(rate.rate - percentage) <= 0.5
    );

    return { exactMatch: null, similarRates };
  } catch (error: any) {
    console.error('[searchTaxRateByPercentage] Error:', error);
    return { exactMatch: null, similarRates: [] };
  }
};

/**
 * Create a new tax rate
 * Checks if rate already exists first
 */
export const createTaxRateTool = async (
  userId: string,
  data: {
    name: string;
    rate: number;
  }
): Promise<{ success: boolean; taxRate?: TaxRate; error?: string }> => {
  try {
    // Check if tax rate with same percentage already exists
    const { exactMatch } = await searchTaxRateByPercentage(userId, data.rate);

    if (exactMatch) {
      return {
        success: false,
        error: `A tax rate of ${data.rate}% already exists (${exactMatch.name}).`,
      };
    }

    // Check if user already has tax rates to determine if this should be default
    const existingRates = await getTaxRatesTool(userId);
    const isDefault = existingRates.length === 0;

    // Create the tax rate
    const { data: newTaxRate, error } = await supabase
      .from('tax_rates')
      .insert([
        {
          user_id: userId,
          name: data.name.trim(),
          rate: data.rate,
          is_default: isDefault,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return { success: true, taxRate: newTaxRate };
  } catch (error: any) {
    console.error('[createTaxRateTool] Error:', error);
    return { success: false, error: error.message };
  }
};
