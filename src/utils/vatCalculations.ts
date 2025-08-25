// src/utils/vatSchemeCalculations.ts
import { supabase } from '../services/supabaseClient';

export interface VATCalculation {
  net: number;
  vat: number;
  gross: number;
  scheme: 'standard' | 'flat_rate' | 'cash' | 'annual';
  flatRatePercentage?: number;
  vatToPayHMRC?: number; // For flat rate - different from VAT charged
}

/**
 * Calculate VAT based on user's selected scheme
 */
export const calculateVATByScheme = async (
  userId: string,
  netAmount: number,
  standardRate: number = 20
): Promise<VATCalculation> => {
  // Get user's VAT settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('uk_vat_scheme, uk_vat_flat_rate, uk_flat_rate_limited_cost_trader')
    .eq('user_id', userId)
    .single();

  const scheme = settings?.uk_vat_scheme || 'standard';

  switch (scheme) {
    case 'flat_rate':
      // For flat rate, you still charge customers standard VAT
      // But you pay HMRC a flat percentage of gross turnover
      const standardCalc = calculateStandardVAT(netAmount, standardRate);
      const flatRatePercentage = settings?.uk_vat_flat_rate || 16.5;
      const vatToPayHMRC = (standardCalc.gross * flatRatePercentage) / 100;
      
      return {
        ...standardCalc,
        scheme: 'flat_rate',
        flatRatePercentage,
        vatToPayHMRC: Math.round(vatToPayHMRC * 100) / 100
      };
    
    case 'cash':
      // Cash accounting - same calculation, different timing
      return {
        ...calculateStandardVAT(netAmount, standardRate),
        scheme: 'cash'
      };
    
    case 'annual':
      // Annual accounting - same calculation, different reporting
      return {
        ...calculateStandardVAT(netAmount, standardRate),
        scheme: 'annual'
      };
    
    default:
      return calculateStandardVAT(netAmount, standardRate);
  }
};

// Add these functions to src/utils/vatCalculations.ts

/**
 * Calculate VAT from net amount (for line items)
 * This is the original function your InvoiceForm expects
 */
export const calculateVATFromNet = (netAmount: number, rate: number) => {
  const vat = (netAmount * rate) / 100;
  return {
    net: Math.round(netAmount * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    gross: Math.round((netAmount + vat) * 100) / 100
  };
};

/**
 * Aggregate VAT by rate for proper breakdown
 * Groups invoice items by their VAT rate
 */
export const aggregateVATByRate = (items: any[]): Record<string, any> => {
  const breakdown: Record<string, any> = {};
  
  items.forEach(item => {
    const rate = item.tax_rate || 0;
    
    if (!breakdown[rate]) {
      breakdown[rate] = {
        net: 0,
        vat: 0,
        gross: 0,
        rate: rate
      };
    }
    
    breakdown[rate].net += item.net_amount || 0;
    breakdown[rate].vat += item.tax_amount || 0;
    breakdown[rate].gross += item.gross_amount || 0;
  });
  
  // Round all values
  Object.keys(breakdown).forEach(rate => {
    breakdown[rate].net = Math.round(breakdown[rate].net * 100) / 100;
    breakdown[rate].vat = Math.round(breakdown[rate].vat * 100) / 100;
    breakdown[rate].gross = Math.round(breakdown[rate].gross * 100) / 100;
  });
  
  return breakdown;
};

/**
 * Standard VAT calculation
 */
export const calculateStandardVAT = (netAmount: number, rate: number): VATCalculation => {
  const vat = (netAmount * rate) / 100;
  return {
    net: Math.round(netAmount * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    gross: Math.round((netAmount + vat) * 100) / 100,
    scheme: 'standard'
  };
};

/**
 * Check if business qualifies as Limited Cost Trader
 * Must use 16.5% flat rate if:
 * - Goods cost < 2% of turnover
 * - OR goods cost < £1000 per year (£250 per quarter)
 */
export const checkLimitedCostTrader = async (
  userId: string,
  quarterStart: Date,
  quarterEnd: Date
): Promise<{ isLimitedCost: boolean; reason?: string }> => {
  // Get total goods purchases (not services)
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, category:categories(name)')
    .eq('user_id', userId)
    .gte('date', quarterStart.toISOString())
    .lte('date', quarterEnd.toISOString());

  // Filter for goods only (you may need to adjust based on your category structure)
const goodsExpenses = expenses?.filter((exp: any) => {
  // Check if category exists and is an object with name property
  const categoryName = exp.category && typeof exp.category === 'object' ? exp.category.name : '';
  return !['Services', 'Consultancy', 'Software', 'Subscriptions'].includes(categoryName);
}) || [];

  const totalGoods = goodsExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  // Get total turnover
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gte('date', quarterStart.toISOString())
    .lte('date', quarterEnd.toISOString());

  const totalTurnover = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;

  // Check conditions
  const goodsPercentage = totalTurnover > 0 ? (totalGoods / totalTurnover) * 100 : 0;
  const isUnderPercentageThreshold = goodsPercentage < 2;
  const isUnderAmountThreshold = totalGoods < 250; // £250 per quarter

  if (isUnderPercentageThreshold && isUnderAmountThreshold) {
    return {
      isLimitedCost: true,
      reason: `Goods cost is ${goodsPercentage.toFixed(1)}% of turnover (below 2%) and £${totalGoods.toFixed(2)} (below £250/quarter)`
    };
  }

  return { isLimitedCost: false };
};

/**
 * Auto-detect best VAT scheme for user
 */
export const recommendVATScheme = async (
  userId: string,
  annualTurnover: number
): Promise<{ scheme: string; reason: string; savings?: number }> => {
  // Basic thresholds
  if (annualTurnover > 1350000) {
    return {
      scheme: 'standard',
      reason: 'Turnover exceeds £1.35m - must use standard VAT accounting'
    };
  }

  if (annualTurnover < 150000) {
    // Small business - flat rate might be beneficial
    const { isLimitedCost } = await checkLimitedCostTrader(
      userId,
      new Date(new Date().getFullYear(), 0, 1),
      new Date()
    );

    if (isLimitedCost) {
      return {
        scheme: 'standard',
        reason: 'As a Limited Cost Trader, flat rate (16.5%) may not be beneficial'
      };
    }

    return {
      scheme: 'flat_rate',
      reason: 'Small turnover - flat rate scheme could simplify VAT and may reduce payments'
    };
  }

  // Check cash flow patterns
  const { data: unpaidInvoices } = await supabase
    .from('invoices')
    .select('total')
    .eq('user_id', userId)
    .in('status', ['sent', 'overdue']);

  const unpaidTotal = unpaidInvoices?.reduce((sum, inv) => sum + inv.total, 0) || 0;

  if (unpaidTotal > annualTurnover * 0.2) {
    return {
      scheme: 'cash',
      reason: 'High unpaid invoices - cash accounting helps with cash flow'
    };
  }

  return {
    scheme: 'standard',
    reason: 'Standard VAT accounting recommended for your business profile'
  };
};

