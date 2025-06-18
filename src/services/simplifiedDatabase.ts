// src/services/simplifiedDatabase.ts
import { supabase } from './supabaseClient';
import { 
  Income, 
  Expense, 
  Invoice, 
  InvoiceItem, 
  Client, 
  Category,
  User,
  TransactionType,
  InvoiceStatus
} from '../types';

// Simple helper - no team queries for now
export const getUserId = (userId: string): string => {
  return userId; // Just return the user ID directly
};

// Profile functions
export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  
  if (error) throw error;
  return data as User;
};

export const updateProfile = async (userId: string, updates: Partial<User>) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Category functions
export const getCategories = async (userId: string, type?: TransactionType) => {
  let query = supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId);
  
  if (type) {
    query = query.eq('type', type);
  }
  
  const { data, error } = await query.order('name');
  
  if (error) throw error;
  return data as Category[];
};

// Income functions
export const getIncomes = async (userId: string, startDate?: string, endDate?: string) => {
  let query = supabase
    .from('income')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('user_id', userId);
  
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  
  const { data, error } = await query.order('date', { ascending: false });
  
  if (error) throw error;
  return data as Income[];
};

// Expense functions
export const getExpenses = async (userId: string, startDate?: string, endDate?: string) => {
  let query = supabase
    .from('expenses')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('user_id', userId);
  
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  
  const { data, error } = await query.order('date', { ascending: false });
  
  if (error) throw error;
  return data as Expense[];
};

// Client functions
export const getClients = async (userId: string) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  
  if (error) throw error;
  return data as Client[];
};

// Invoice functions
export const getInvoices = async (userId: string, status?: InvoiceStatus) => {
  let query = supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('user_id', userId);
  
  if (status) query = query.eq('status', status);
  
  const { data, error } = await query.order('date', { ascending: false });
  
  if (error) throw error;
  return data as Invoice[];
};

// Dashboard statistics
export const getDashboardStats = async (userId: string, startDate: string, endDate: string) => {
  const [incomes, expenses, invoices] = await Promise.all([
    getIncomes(userId, startDate, endDate),
    getExpenses(userId, startDate, endDate),
    getInvoices(userId)
  ]);
  
  const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const pendingInvoices = invoices.filter(inv => 
    inv.status === 'sent' || inv.status === 'overdue'
  );
  const totalPending = pendingInvoices.reduce((sum, inv) => sum + inv.total, 0);
  
  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    pendingInvoices: pendingInvoices.length,
    totalPending,
    recentTransactions: [
      ...incomes.slice(0, 5).map(inc => ({ ...inc, type: 'income' as const })),
      ...expenses.slice(0, 5).map(exp => ({ ...exp, type: 'expense' as const }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)
  };
};

// Export all other functions from the original database.ts
export * from './database';