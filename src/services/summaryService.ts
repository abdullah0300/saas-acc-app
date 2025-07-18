// src/services/summaryService.ts
import { supabase } from './supabaseClient';
import { format } from 'date-fns';

export interface MonthlySummary {
  id: string;
  user_id: string;
  month: string;
  total_income: number;
  total_expenses: number;
  net_profit: number;
  invoice_count: number;
  client_count: number;
}

export interface CategorySummary {
  id: string;
  user_id: string;
  month: string;
  category_id: string;
  category_name: string;
  category_type: 'income' | 'expense';
  total_amount: number;
  transaction_count: number;
}

export interface ClientSummary {
  id: string;
  user_id: string;
  month: string;
  client_id: string;
  client_name: string;
  revenue: number;
  invoice_count: number;
  paid_invoices: number;
  pending_amount: number;
}

export const getMonthlySummaries = async (userId: string, startDate: Date, endDate: Date): Promise<MonthlySummary[]> => {
  const { data, error } = await supabase
    .from('monthly_summaries')
    .select('*')
    .eq('user_id', userId)
    .gte('month', format(startDate, 'yyyy-MM-01'))
    .lte('month', format(endDate, 'yyyy-MM-01'))
    .order('month', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const getCategorySummaries = async (userId: string, startDate: Date, endDate: Date): Promise<CategorySummary[]> => {
  const { data, error } = await supabase
    .from('category_summaries')
    .select('*')
    .eq('user_id', userId)
    .gte('month', format(startDate, 'yyyy-MM-01'))
    .lte('month', format(endDate, 'yyyy-MM-01'))
    .order('month', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const getClientSummaries = async (userId: string, startDate: Date, endDate: Date): Promise<ClientSummary[]> => {
  const { data, error } = await supabase
    .from('client_summaries')
    .select('*')
    .eq('user_id', userId)
    .gte('month', format(startDate, 'yyyy-MM-01'))
    .lte('month', format(endDate, 'yyyy-MM-01'))
    .order('month', { ascending: true });

  if (error) throw error;
  return data || [];
};