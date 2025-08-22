import { supabase } from './supabaseClient';

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
  // Get user settings
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('country, base_currency')
    .eq('user_id', userId)
    .single();

  // Only UK users can calculate VAT returns
  if (userSettings?.country !== 'GB') {
    throw new Error('VAT Returns are only available for UK users');
  }

  // Get income for VAT on sales
  const { data: incomes } = await supabase
    .from('income')
    .select('base_amount, tax_amount, credit_note_id, amount')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString());

  const box1 = incomes
    ?.filter((inc: any) => !inc.credit_note_id)
    ?.reduce((sum: number, inc: any) => sum + (inc.tax_amount || 0), 0) || 0;

  const box6 = incomes
    ?.reduce((sum: number, inc: any) => sum + (inc.base_amount || inc.amount || 0), 0) || 0;

  // Get expenses for VAT reclaimed
  const { data: expenses } = await supabase
    .from('expenses')
    .select('base_amount, tax_amount, amount, is_vat_reclaimable')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString());

  const box4 = expenses
    ?.filter((exp: any) => exp.is_vat_reclaimable !== false)
    ?.reduce((sum: number, exp: any) => sum + (exp.tax_amount || 0), 0) || 0;

  const box7 = expenses
    ?.reduce((sum: number, exp: any) => sum + (exp.base_amount || exp.amount || 0), 0) || 0;

  // Calculate totals
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
    box6: Math.round(box6 * 100) / 100,
    box7: Math.round(box7 * 100) / 100,
    box8: Math.round(box8 * 100) / 100,
    box9: Math.round(box9 * 100) / 100
  };
};