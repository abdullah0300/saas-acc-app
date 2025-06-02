import { supabase } from './supabaseClient';
import { 
  Income, 
  Expense, 
  Invoice, 
  InvoiceItem, 
  Client, 
  Category,
  User,
  Subscription,
  TransactionType,
  InvoiceStatus
} from '../types';

// Profile functions
export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
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

// Subscription functions
export const getSubscription = async (userId: string) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data as Subscription;
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

export const createCategory = async (category: Omit<Category, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('categories')
    .insert([category])
    .select()
    .single();
  
  if (error) throw error;
  return data;
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

export const createIncome = async (income: Omit<Income, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('income')
    .insert([{
      ...income,
      category_id: income.category_id || null,
      reference_number: income.reference_number || null
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateIncome = async (id: string, updates: Partial<Income>) => {
  const updateData: any = { ...updates };
  if ('category_id' in updates) updateData.category_id = updates.category_id || null;
  if ('reference_number' in updates) updateData.reference_number = updates.reference_number || null;
  
  const { data, error } = await supabase
    .from('income')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteIncome = async (id: string) => {
  const { error } = await supabase
    .from('income')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
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

export const createExpense = async (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('expenses')
    .insert([{
      ...expense,
      category_id: expense.category_id || null,
      vendor: expense.vendor || null,
      receipt_url: expense.receipt_url || null
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateExpense = async (id: string, updates: Partial<Expense>) => {
  const updateData: any = { ...updates };
  if ('category_id' in updates) updateData.category_id = updates.category_id || null;
  if ('vendor' in updates) updateData.vendor = updates.vendor || null;
  if ('receipt_url' in updates) updateData.receipt_url = updates.receipt_url || null;
  
  const { data, error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteExpense = async (id: string) => {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
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

export const createClient = async (client: Omit<Client, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('clients')
    .insert([{
      ...client,
      email: client.email || null,
      phone: client.phone || null,
      address: client.address || null
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateClient = async (id: string, updates: Partial<Client>) => {
  const updateData: any = { ...updates };
  if ('email' in updates) updateData.email = updates.email || null;
  if ('phone' in updates) updateData.phone = updates.phone || null;
  if ('address' in updates) updateData.address = updates.address || null;
  
  const { data, error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteClient = async (id: string) => {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
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

export const getInvoice = async (id: string) => {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Invoice;
};

export const createInvoice = async (
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'items'>,
  items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[]
) => {
  // Start a transaction
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .insert([{
      ...invoice,
      client_id: invoice.client_id || null,
      notes: invoice.notes || null
    }])
    .select()
    .single();
  
  if (invoiceError) throw invoiceError;
  
  // Insert invoice items
  const invoiceItems = items.map(item => ({
    ...item,
    invoice_id: invoiceData.id
  }));
  
  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(invoiceItems);
  
  if (itemsError) throw itemsError;
  
  return invoiceData;
};

export const updateInvoice = async (
  id: string, 
  updates: Partial<Invoice>,
  items?: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[]
) => {
  const updateData: any = { ...updates };
  if ('client_id' in updates) updateData.client_id = updates.client_id || null;
  if ('notes' in updates) updateData.notes = updates.notes || null;
  
  // Update invoice
  const { data, error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // If items provided, replace them
  if (items) {
    // Delete existing items
    await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', id);
    
    // Insert new items
    const invoiceItems = items.map(item => ({
      ...item,
      invoice_id: id
    }));
    
    await supabase
      .from('invoice_items')
      .insert(invoiceItems);
  }
  
  return data;
};

export const deleteInvoice = async (id: string) => {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
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