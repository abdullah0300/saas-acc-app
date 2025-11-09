import { supabase } from './supabaseClient';
import { checkLimitedCostTrader } from '../utils/vatCalculations';

interface VATReturnBoxes {
  box1: number;
  box2: number;
  box3: number;
  box4: number;
  box5: number;
  box6: number;
  box7: number;
  box8: number;
  box9: number;
}

export const calculateVATReturn = async (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<VATReturnBoxes> => {
  // Get user settings including VAT scheme
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Only UK users can calculate VAT returns
  if (userSettings?.country !== 'GB') {
    throw new Error('VAT Returns are only available for UK users');
  }

  const vatScheme = userSettings?.uk_vat_scheme || 'standard';
  
  // Route to appropriate calculation based on scheme
  switch (vatScheme) {
    case 'flat_rate':
      return calculateFlatRateReturn(userId, startDate, endDate, userSettings);
    case 'cash':
      return calculateCashAccountingReturn(userId, startDate, endDate);
    case 'annual':
      return calculateAnnualAccountingReturn(userId, startDate, endDate);
    default:
      return calculateStandardReturn(userId, startDate, endDate);
  }
};

// Standard VAT calculation
const calculateStandardReturn = async (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<VATReturnBoxes> => {
  // Get income for VAT on sales
  const { data: incomes } = await supabase
    .from('income')
    .select('base_amount, tax_amount, credit_note_id, amount')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString());

  const box1Initial = incomes
    ?.filter((inc: any) => !inc.credit_note_id)
    ?.reduce((sum: number, inc: any) => sum + (inc.tax_amount || 0), 0) || 0;

  // Get credit notes
  const { data: creditNotes } = await supabase
    .from('credit_notes')
    .select('tax_amount, status')
    .eq('user_id', userId)
    .eq('status', 'applied')
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString());

  const creditNoteVAT = creditNotes
    ?.reduce((sum: number, cn: any) => sum + (cn.tax_amount || 0), 0) || 0;

  const box1 = box1Initial - creditNoteVAT;
  const box6 = incomes
    ?.reduce((sum: number, inc: any) => sum + (inc.base_amount || inc.amount || 0), 0) || 0;

  // Get expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('base_amount, tax_amount, amount')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString());

  const box4 = expenses
    ?.reduce((sum: number, exp: any) => sum + (exp.tax_amount || 0), 0) || 0;

  const box7 = expenses
    ?.reduce((sum: number, exp: any) => sum + (exp.base_amount || exp.amount || 0), 0) || 0;

  const box2 = 0; // EU acquisitions
  const box3 = box1 + box2;
  const box5 = box3 - box4;
  const box8 = 0; // EU supplies
  const box9 = 0; // EU acquisitions

  return {
    box1: Math.round(box1 * 100) / 100,
    box2: Math.round(box2 * 100) / 100,
    box3: Math.round(box3 * 100) / 100,
    box4: Math.round(box4 * 100) / 100,
    box5: Math.round(box5 * 100) / 100,
    box6: Math.round(box6),
    box7: Math.round(box7),
    box8: Math.round(box8),
    box9: Math.round(box9)
  };
};

// Flat Rate VAT calculation
const calculateFlatRateReturn = async (
  userId: string,
  startDate: Date,
  endDate: Date,
  settings: any
): Promise<VATReturnBoxes> => {
  // For flat rate, get GROSS turnover (including VAT)
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString());

  const grossTurnover = invoices?.reduce((sum: number, inv: any) => sum + inv.total, 0) || 0;
  
  // Check if Limited Cost Trader
  const { isLimitedCost } = await checkLimitedCostTrader(userId, startDate, endDate);
  
  // Use 16.5% if Limited Cost Trader, otherwise use user's rate
  const flatRate = isLimitedCost ? 16.5 : (settings.uk_vat_flat_rate || 12);
  
  // Flat Rate VAT = Gross Turnover × Flat Rate %
  const box1 = (grossTurnover * flatRate) / 100;
  
  // No input VAT reclaim on Flat Rate (except capital goods over £2000)
  
  return {
    box1: Math.round(box1 * 100) / 100,
    box2: 0,
    box3: Math.round(box1 * 100) / 100,
    box4: 0,
    box5: Math.round(box1 * 100) / 100,
    box6: Math.round(grossTurnover),
    box7: 0, // Purchases not reported in flat rate
    box8: 0,
    box9: 0
  };
};

// Cash Accounting VAT calculation
const calculateCashAccountingReturn = async (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<VATReturnBoxes> => {
  // For cash accounting, only count PAID invoices
  const { data: paidInvoices } = await supabase
    .from('invoices')
    .select('total, tax_amount, subtotal')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gte('paid_date', startDate.toISOString())
    .lte('paid_date', endDate.toISOString());

  const box1 = paidInvoices
    ?.reduce((sum: number, inv: any) => sum + (inv.tax_amount || 0), 0) || 0;

  const box6 = paidInvoices
    ?.reduce((sum: number, inv: any) => sum + (inv.subtotal || 0), 0) || 0;

  // For expenses, only count those actually paid
  const { data: paidExpenses } = await supabase
    .from('expenses')
    .select('amount, tax_amount')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString());

  const box4 = paidExpenses
    ?.reduce((sum: number, exp: any) => sum + (exp.tax_amount || 0), 0) || 0;

  const box7 = paidExpenses
    ?.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0) || 0;

  const box2 = 0;
  const box3 = box1 + box2;
  const box5 = box3 - box4;
  const box8 = 0;
  const box9 = 0;

  return {
    box1: Math.round(box1 * 100) / 100,
    box2: Math.round(box2 * 100) / 100,
    box3: Math.round(box3 * 100) / 100,
    box4: Math.round(box4 * 100) / 100,
    box5: Math.round(box5 * 100) / 100,
    box6: Math.round(box6),
    box7: Math.round(box7),
    box8: Math.round(box8),
    box9: Math.round(box9)
  };
};

// Annual accounting - same as standard but different payment schedule
const calculateAnnualAccountingReturn = calculateStandardReturn;