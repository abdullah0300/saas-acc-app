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
  InvoiceStatus,
  Vendor  
} from '../types';
import { TeamMember, TeamInvite } from '../types/userManagement';
import { subscriptionService } from './subscriptionService';
import { CreditNote, CreditNoteItem } from '../types';


// Helper to get the effective user ID for team data access
export const getEffectiveUserId = async (userId: string): Promise<string> => {
  try {
    // Check if user is part of a team
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    // If user is a team member, return the team_id (owner's ID)
    // Otherwise, return their own user_id
    return teamMember?.team_id || userId;
  } catch (err) {
    console.error('Error getting effective user ID:', err);
    return userId; // Fallback to user's own ID
  }
};

// Profile functions - Always use actual user ID
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

// Subscription functions - Team aware
export const getSubscription = async (userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  return subscriptionService.loadUserSubscription(effectiveUserId);
};

// Category functions - Team aware
export const getCategories = async (userId: string, type?: TransactionType) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  let query = supabase
    .from('categories')
    .select('*')
    .eq('user_id', effectiveUserId)
    .order('name');

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Category[];
};

export const createCategory = async (category: Omit<Category, 'id' | 'created_at'>) => {
  const effectiveUserId = await getEffectiveUserId(category.user_id);
  
  const { data, error } = await supabase
    .from('categories')
    .insert([{
      ...category,
      user_id: effectiveUserId
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateCategory = async (id: string, updates: Partial<Category>) => {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteCategory = async (id: string) => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Income functions - Team aware
export const getIncomes = async (userId: string, startDate?: string, endDate?: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  let query = supabase
  .from('income')
  .select(`
    *,
    category:categories(*),
    client:clients(*)
  `)
    .eq('user_id', effectiveUserId)
    .order('date', { ascending: false });

  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Income[];
};

export const createIncome = async (income: Omit<Income, 'id' | 'created_at' | 'updated_at'>) => {
  const effectiveUserId = await getEffectiveUserId(income.user_id);
  
  const { data, error } = await supabase
  .from('income')
  .insert([{
    ...income,
    user_id: effectiveUserId,
    category_id: income.category_id || null,
    client_id: income.client_id || null,
    reference_number: income.reference_number || null,
    tax_rate: income.tax_rate || null,
    tax_amount: income.tax_amount || null
  }])
    .select(`
      *,
      category:categories(*),
      client:clients(*)
    `) // ✅ Include related data
    .single();
  
  if (error) throw error;
  return data;
};

export const updateIncome = async (id: string, updates: Partial<Income>) => {
  // Check UK VAT lock first (only affects UK users)
  const { data: incomeData } = await supabase
    .from('income')
    .select('vat_return_id, vat_locked_at, user_id')
    .eq('id', id)
    .single();

  if (incomeData?.vat_return_id) {
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('country')
      .eq('user_id', incomeData.user_id)
      .single();
    
    if (userSettings?.country === 'GB') {
      throw new Error('Cannot modify this income entry - it has been included in a submitted UK VAT return');
    }
  }
  const updateData: any = { ...updates };
if ('category_id' in updates) updateData.category_id = updates.category_id || null;
if ('client_id' in updates) updateData.client_id = updates.client_id || null; // ADD THIS LINE
if ('reference_number' in updates) updateData.reference_number = updates.reference_number || null;
if ('tax_rate' in updates) updateData.tax_rate = updates.tax_rate || null; // ADD THIS LINE
if ('tax_amount' in updates) updateData.tax_amount = updates.tax_amount || null; // ADD THIS LINE

  const { data, error } = await supabase
    .from('income')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      category:categories(*),
      client:clients(*)
    `)
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

// Expense functions - Team aware
export const getExpenses = async (userId: string, startDate?: string, endDate?: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  let query = supabase
    .from('expenses')
    .select(`
      *,
      category:categories(*),
      vendor_detail:vendors(*)
    `)
    .eq('user_id', effectiveUserId)
    .order('date', { ascending: false });

  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Expense[];
};

export const createExpense = async (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
  const effectiveUserId = await getEffectiveUserId(expense.user_id);
  
  const { data, error } = await supabase
    .from('expenses')
    .insert([{
      ...expense,
      user_id: effectiveUserId,
      category_id: expense.category_id || null,
      vendor: expense.vendor || null,
      receipt_url: expense.receipt_url || null,
      is_vat_reclaimable: (expense as any).is_vat_reclaimable ?? true,
      base_tax_amount: (expense as any).base_tax_amount || 0,
      tax_point_date: (expense as any).tax_point_date || expense.date
    }])
    .select(`
      *,
      category:categories(*),
      vendor_detail:vendors(*)
    `) // ✅ Include related data
    .single();
  
  if (error) throw error;
  return data;
};

export const updateExpense = async (id: string, updates: Partial<Expense>) => {
  // Check UK VAT lock first (only affects UK users)
  const { data: expenseData } = await supabase
    .from('expenses')
    .select('vat_return_id, vat_locked_at, user_id')
    .eq('id', id)
    .single();

  if (expenseData?.vat_return_id) {
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('country')
      .eq('user_id', expenseData.user_id)
      .single();
    
    if (userSettings?.country === 'GB') {
      throw new Error('Cannot modify this expense - it has been included in a submitted UK VAT return');
    }
  }
  const updateData: any = { ...updates };
  if ('category_id' in updates) updateData.category_id = updates.category_id || null;
  if ('vendor' in updates) updateData.vendor = updates.vendor || null;
  if ('receipt_url' in updates) updateData.receipt_url = updates.receipt_url || null;
  if ('is_vat_reclaimable' in updates) updateData.is_vat_reclaimable = (updates as any).is_vat_reclaimable ?? true;
  if ('base_tax_amount' in updates) updateData.base_tax_amount = (updates as any).base_tax_amount || 0;
  if ('tax_point_date' in updates) updateData.tax_point_date = (updates as any).tax_point_date || updates.date;
  const { data, error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      category:categories(*),
      vendor_detail:vendors(*)
    `)
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

// Client functions - Team aware
export const getClients = async (userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', effectiveUserId)
    .order('name');
  
  if (error) throw error;
  return data as Client[];
};

export const createClient = async (client: Omit<Client, 'id' | 'created_at'>) => {
  const effectiveUserId = await getEffectiveUserId(client.user_id);
  
  const { data, error } = await supabase
    .from('clients')
    .insert([{
      ...client,
      user_id: effectiveUserId,
      email: client.email || null,
      phone: client.phone || null,
      phone_country_code: client.phone_country_code || null,
      address: client.address || null
    }])
    .select('*') // ✅ Explicit select
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

// Invoice functions - Team aware
export const getInvoices = async (userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('user_id', effectiveUserId)
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data as Invoice[];
};


// Vendor functions - Team aware
export const getVendors = async (userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('user_id', effectiveUserId)
    .order('name');
  
  if (error) throw error;
  return data as Vendor[];
};

export const createVendor = async (vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>) => {
  const effectiveUserId = await getEffectiveUserId(vendor.user_id);
  
  const { data, error } = await supabase
    .from('vendors')
    .insert([{
      ...vendor,
      user_id: effectiveUserId,
      email: vendor.email || null,
      phone: vendor.phone || null,
      address: vendor.address || null,
      tax_id: vendor.tax_id || null,
      notes: vendor.notes || null
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateVendor = async (id: string, updates: Partial<Vendor>) => {
  const updateData: any = { ...updates };
  if ('email' in updates) updateData.email = updates.email || null;
  if ('phone' in updates) updateData.phone = updates.phone || null;
  if ('address' in updates) updateData.address = updates.address || null;
  if ('tax_id' in updates) updateData.tax_id = updates.tax_id || null;
  if ('notes' in updates) updateData.notes = updates.notes || null;
  
  const { data, error } = await supabase
    .from('vendors')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteVendor = async (id: string) => {
  const { error } = await supabase
    .from('vendors')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
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
  userId: string, 
  invoice: Partial<Invoice>,
  items: Partial<InvoiceItem>[]
): Promise<Invoice> => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  // First check if user can create invoice
  const { data: limitCheck, error: limitError } = await supabase
    .rpc('check_invoice_limit', { p_user_id: effectiveUserId });
  
  if (limitError) throw limitError;
  
  if (!limitCheck.can_create) {
    throw new Error(
      limitCheck.limit === -1 
        ? 'Cannot create invoice: ' + limitCheck.reason
        : `Monthly invoice limit reached (${limitCheck.usage}/${limitCheck.limit})`
    );
  }
  
  // Use the new RPC function for plans with limits
  if (limitCheck.limit > 0) {
    const invoiceData: any = {
      p_user_id: effectiveUserId,
      p_invoice_data: {
        invoice_number: invoice.invoice_number,
        client_id: invoice.client_id,
        date: invoice.date,
        due_date: invoice.due_date,
        status: invoice.status || 'draft',
        subtotal: invoice.subtotal,
        tax_rate: invoice.tax_rate,
        tax_amount: invoice.tax_amount,
        total: invoice.total,
        notes: invoice.notes,
        currency: invoice.currency || 'USD'
      }
    };

    // Only include optional fields if they exist
    if ('discount_type' in invoice) invoiceData.p_invoice_data.discount_type = invoice.discount_type;
    if ('discount_value' in invoice) invoiceData.p_invoice_data.discount_value = invoice.discount_value;
    if ('exchange_rate' in invoice) invoiceData.p_invoice_data.exchange_rate = invoice.exchange_rate || 1;

    const { data: result, error: createError } = await supabase
      .rpc('create_invoice_with_limit', invoiceData);
    
    if (createError) throw createError;
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create invoice');
    }
    
    // Now add invoice items
    if (items.length > 0) {
      const invoiceItems = items.map(item => ({
        ...item,
        invoice_id: result.invoice_id
      }));
      
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);
      
      if (itemsError) throw itemsError;
    }
    
    // Fetch and return the complete invoice
    const { data: newInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', result.invoice_id)
      .single();
    
    if (fetchError) throw fetchError;
    // ADD THESE LINES:
// Check if we should show anticipation modal after successful creation
const currentUsage = limitCheck.usage + 1; // We just created one
const usagePercentage = (currentUsage / limitCheck.limit) * 100;
if (usagePercentage >= 80 && usagePercentage < 100) {
  // Dispatch custom event that SubscriptionContext will listen for
  window.dispatchEvent(new CustomEvent('invoiceCreated', { 
    detail: { 
      usage: currentUsage, 
      limit: limitCheck.limit 
    } 
  }));
}

return newInvoice;
    return newInvoice;
  } else {
    // For unlimited plans, use regular insert
    const { data, error } = await supabase
      .from('invoices')
      .insert({ ...invoice, user_id: effectiveUserId })
      .select()
      .single();
    
    if (error) throw error;
    
    // Add invoice items
    if (items.length > 0) {
      const invoiceItems = items.map(item => ({
        ...item,
        invoice_id: data.id
      }));
      
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);
      
      if (itemsError) throw itemsError;
    }
    
    return data;
  }
};

export const updateInvoice = async (id: string, updates: any, items?: any[]) => {
   // Check current invoice status
  const { data: currentInvoice, error: checkError } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', id)
    .single();
  
  if (checkError) throw checkError;
  
  // Prevent updates to paid/canceled invoices
  if (currentInvoice.status === 'paid' || currentInvoice.status === 'canceled') {
    throw new Error('Cannot modify paid or canceled invoices for legal compliance');
  }

  // UK VAT lock check - only for UK users
  const { data: vatCheck } = await supabase
    .from('invoices')
    .select('vat_return_id, vat_locked_at, user_id')
    .eq('id', id)
    .single();
  
  if (vatCheck?.vat_return_id) {
    // Get user settings to check if UK
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('country')
      .eq('user_id', vatCheck.user_id)
      .single();
    
    if (userSettings?.country === 'GB') {
      throw new Error('Cannot modify this invoice - it has been included in a submitted UK VAT return (HMRC compliance)');
    }
  }
  // Update invoice
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (invoiceError) throw invoiceError;

  // If items are provided, update them
  if (items !== undefined) {
    // Delete existing items
    const { error: deleteError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', id);

    if (deleteError) throw deleteError;

    // Insert new items
    if (items.length > 0) {
      const itemsWithInvoiceId = items.map(item => ({
        ...item,
        invoice_id: id
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsWithInvoiceId);

      if (itemsError) throw itemsError;
    }
  }

  return invoiceData;
};



export const deleteInvoice = async (id: string) => {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const getInvoiceByNumber = async (invoiceNumber: string) => {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('invoice_number', invoiceNumber)
    .single();
  
  if (error) throw error;
  return data as Invoice;
};

export const getNextInvoiceNumber = async (userId: string): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-next-invoice-number', {
      body: { userId }
    });

    if (error) throw error;
    
    return data.invoiceNumber;
  } catch (error) {
    console.error('Error getting next invoice number:', error);
    // Fallback to a timestamp-based number if edge function fails
    const now = new Date();
    const timestamp = now.getTime();
    return `INV-${timestamp}`;
  }
};

export const checkInvoiceNumberExists = async (
  userId: string, 
  invoiceNumber: string, 
  excludeId?: string
): Promise<boolean> => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  let query = supabase
    .from('invoices')
    .select('id')
    .eq('user_id', effectiveUserId)
    .eq('invoice_number', invoiceNumber);
  
  if (excludeId) {
    query = query.neq('id', excludeId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  return (data && data.length > 0);
};

// Dashboard statistics - Team aware
export const getDashboardStats = async (userId: string, startDate: string, endDate: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  const [incomes, expenses, invoices] = await Promise.all([
    getIncomes(effectiveUserId, startDate, endDate),
    getExpenses(effectiveUserId, startDate, endDate),
    getInvoices(effectiveUserId)
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

// Team Member Management - Always use actual user ID
export const getTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      profiles:user_id(
        email,
        full_name,
        company_name
      )
    `)
    .eq('team_id', teamId)
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return data as TeamMember[];
};

export const inviteTeamMember = async (teamId: string, email: string, role: 'admin' | 'member') => {
  const inviteCode = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

  const { data, error } = await supabase
    .from('pending_invites')
    .insert({
      team_id: teamId,
      email,
      role,
      invite_code: inviteCode,
      invited_by: teamId,
      expires_at: expiresAt.toISOString(),
      accepted: false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const removeTeamMember = async (teamId: string, userId: string) => {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);

  if (error) throw error;
};

export const updateTeamMemberRole = async (teamId: string, userId: string, role: 'admin' | 'member') => {
  const { data, error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getTeamInvites = async (teamId: string): Promise<TeamInvite[]> => {
  const { data, error } = await supabase
    .from('pending_invites')
    .select('*')
    .eq('team_id', teamId)
    .eq('accepted', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as TeamInvite[];
};

export const cancelInvite = async (inviteId: string) => {
  const { error } = await supabase
    .from('pending_invites')
    .delete()
    .eq('id', inviteId);

  if (error) throw error;
};

// Check if user is team admin
export const isTeamAdmin = async (userId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  return data?.role === 'admin' || false;
};

// Get user's team info
export const getUserTeamInfo = async (userId: string) => {
  const { data } = await supabase
    .from('team_members')
    .select(`
      team_id,
      role,
      status,
      joined_at,
      team:team_id(
        email,
        full_name,
        company_name
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  return data;
};

// Invoice Template functions
export const getInvoiceTemplates = async (userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('user_id', effectiveUserId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const createInvoiceTemplate = async (template: {
  user_id: string;
  name: string;
  template_data: any;
}) => {
  const effectiveUserId = await getEffectiveUserId(template.user_id);
  
  const { data, error } = await supabase
    .from('invoice_templates')
    .insert([{
      ...template,
      user_id: effectiveUserId
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteInvoiceTemplate = async (id: string) => {
  const { error } = await supabase
    .from('invoice_templates')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};


export const checkCategoryExists = async (
  userId: string, 
  name: string, 
  type: 'income' | 'expense'
) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', effectiveUserId)
    .eq('name', name)
    .eq('type', type)
    .single();
    
  return !!data;
};

// Budget functions
export const getBudgets = async (userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  const { data, error } = await supabase
    .from('budgets')
    .select(`
      *,
      category:categories(name, type)
    `)
    .eq('user_id', effectiveUserId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const createBudget = async (budget: {
  user_id: string;
  category_id: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
}) => {
  const effectiveUserId = await getEffectiveUserId(budget.user_id);
  
  const { data, error } = await supabase
    .from('budgets')
    .insert([{
      ...budget,
      user_id: effectiveUserId
    }])
    .select(`
      *,
      category:categories(name, type)
    `)
    .single();
  
  if (error) throw error;
  return data;
};

export const updateBudget = async (id: string, updates: {
  category_id?: string;
  amount?: number;
  period?: 'monthly' | 'quarterly' | 'yearly';
  start_date?: string;
}) => {
  const { data, error } = await supabase
    .from('budgets')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      category:categories(name, type)
    `)
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteBudget = async (id: string) => {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};



// Credit Note Functions

export const getCreditNotes = async (
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<CreditNote[]> => {
  let query = supabase
    .from('credit_notes')
    .select(`
      *,
      client:clients(*),
      invoice:invoices(*),
      items:credit_note_items(*)
    `)
    .eq('user_id', userId);

  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data as CreditNote[];
};

export const getCreditNote = async (id: string): Promise<CreditNote> => {
  const { data, error } = await supabase
    .from('credit_notes')
    .select(`
      *,
      client:clients(*),
      invoice:invoices(*),
      items:credit_note_items(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as CreditNote;
};

export const getNextCreditNoteNumber = async (userId: string): Promise<string> => {
  const { data, error } = await supabase
    .rpc('get_next_credit_note_number', { p_user_id: userId });

  if (error) throw error;
  return data || 'CN-0001';
};

export const createCreditNote = async (
  userId: string,
  creditNote: Partial<CreditNote>,
  items: Partial<CreditNoteItem>[]
): Promise<CreditNote> => {
  // Start a transaction
  // Get the invoice to inherit currency if not provided
let invoice = null;
if (creditNote.invoice_id) {
  const { data } = await supabase
    .from('invoices')
    .select('currency, exchange_rate')
    .eq('id', creditNote.invoice_id)
    .single();
  invoice = data;
}

// Get user's base currency
const { data: userSettings } = await supabase
  .from('user_settings')
  .select('base_currency')
  .eq('user_id', userId)
  .single();

const baseCurrency = userSettings?.base_currency || 'USD';

// Calculate totals
const subtotal = creditNote.subtotal || 0;
const tax_amount = creditNote.tax_amount || 0;
const total = creditNote.total || (subtotal + tax_amount);

const { data: creditNoteData, error: creditNoteError } = await supabase
  .from('credit_notes')
  .insert([{
    ...creditNote,
    user_id: userId,
    credit_note_number: creditNote.credit_note_number || await getNextCreditNoteNumber(userId),
    // Add currency fields
    currency: creditNote.currency || invoice?.currency || baseCurrency,
    exchange_rate: creditNote.exchange_rate || invoice?.exchange_rate || 1,
    base_amount: creditNote.base_amount || (total / (creditNote.exchange_rate || invoice?.exchange_rate || 1)),
    subtotal,
    tax_amount,
    total
  }])
    .select()
    .single();

  if (creditNoteError) throw creditNoteError;

  // Insert credit note items
  if (items && items.length > 0) {
    const creditNoteItems = items.map(item => ({
      ...item,
      credit_note_id: creditNoteData.id
    }));

    const { error: itemsError } = await supabase
      .from('credit_note_items')
      .insert(creditNoteItems);

    if (itemsError) throw itemsError;
  }

  // Update invoice to mark it has credit notes
if (creditNote.invoice_id) {
  // Get current credit info
  const { data: currentInvoice } = await supabase
    .from('invoices')
    .select('total_credited, has_credit_notes')
    .eq('id', creditNote.invoice_id)
    .single();
  
  const currentCredited = currentInvoice?.total_credited || 0;
  const newTotalCredited = currentCredited + (total || 0);
  
  // Update both invoice and tracking table
  const { error: updateError } = await supabase.rpc('update_invoice_credit_metadata', {
    p_invoice_id: creditNote.invoice_id,
    p_has_credit_notes: true,
    p_total_credited: newTotalCredited
  });
  
  if (updateError) {
    console.error('Failed to update invoice credit metadata:', updateError);
    // Don't throw - try direct update as fallback
    
    // Try direct update on invoice table
    await supabase
      .from('invoices')
      .update({
        has_credit_notes: true,
        total_credited: newTotalCredited
      })
      .eq('id', creditNote.invoice_id);
    
    // Also update tracking table
    await supabase
      .from('invoice_credit_tracking')
      .upsert({
        invoice_id: creditNote.invoice_id,
        total_credited: newTotalCredited,
        credit_note_count: 1,
        last_credit_date: new Date().toISOString()
      }, { onConflict: 'invoice_id' });
  }
}

  // If status is 'issued', create negative income entry
  if (creditNote.status === 'issued' && !creditNoteData.applied_to_income) {
  await applyCreditNote(creditNoteData.id, userId, 'refund');
}

  return creditNoteData;
};

export const updateCreditNote = async (
  id: string,
  updates: Partial<CreditNote>,
  items?: Partial<CreditNoteItem>[]
): Promise<CreditNote> => {
  // Update credit note
  const { data: creditNoteData, error: creditNoteError } = await supabase
    .from('credit_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (creditNoteError) throw creditNoteError;

  // If items are provided, update them
  if (items) {
    // Delete existing items
    await supabase
      .from('credit_note_items')
      .delete()
      .eq('credit_note_id', id);

    // Insert new items
    if (items.length > 0) {
      const creditNoteItems = items.map(item => ({
        ...item,
        credit_note_id: id
      }));

      const { error: itemsError } = await supabase
        .from('credit_note_items')
        .insert(creditNoteItems);

      if (itemsError) throw itemsError;
    }
  }

  return creditNoteData;
};

export const deleteCreditNote = async (id: string): Promise<void> => {
  // Only allow deletion of draft credit notes
  const { data: creditNote, error: fetchError } = await supabase
    .from('credit_notes')
    .select('status, invoice_id, total')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  if (creditNote.status !== 'draft') {
    throw new Error('Only draft credit notes can be deleted');
  }

  // Update invoice to reduce credited amount
  if (creditNote.invoice_id) {
    // First get current total_credited
    const { data: currentInvoice } = await supabase
      .from('invoices')
      .select('total_credited')
      .eq('id', creditNote.invoice_id)
      .single();
    
    const currentCredited = currentInvoice?.total_credited || 0;
    const newTotalCredited = Math.max(0, currentCredited - creditNote.total);
    
    // Use RPC function that bypasses HMRC restrictions for metadata
    const { error } = await supabase.rpc('update_invoice_credit_metadata', {
      p_invoice_id: creditNote.invoice_id,
      p_has_credit_notes: newTotalCredited > 0,
      p_total_credited: newTotalCredited
    });

    if (error) {
      console.warn('Could not update invoice credit metadata:', error);
    }
  }

  // Delete the credit note (items will cascade delete)
  const { error } = await supabase
    .from('credit_notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const applyCreditNote = async (
  creditNoteId: string,
  userId: string,
  action: 'refund' | 'credit' | 'apply' = 'refund'
): Promise<void> => {
  // Get complete credit note data with invoice
  const { data: creditNote, error: fetchError } = await supabase
    .from('credit_notes')
    .select(`
      *,
      invoice:invoices(invoice_number, currency, exchange_rate),
      client:clients(*)
    `)
    .eq('id', creditNoteId)
    .single();

  if (fetchError) throw fetchError;

  if (creditNote.applied_to_income) {
    throw new Error('Credit note already applied');
  }

  // Get user's base currency
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('base_currency')
    .eq('user_id', userId)
    .single();

  const baseCurrency = userSettings?.base_currency || 'USD';

  switch(action) {
    case 'refund':
      // Get or create the credit notes category
      const categoryId = await getOrCreateCreditNotesCategory(userId);

      // Create negative income entry with proper currency fields AND category
      const { error: incomeError } = await supabase
        .from('income')
        .insert([{
          user_id: userId,
          amount: -Math.abs(creditNote.total),
          description: `Credit Note ${creditNote.credit_note_number} for Invoice ${creditNote.invoice?.invoice_number || ''}`,
          date: creditNote.date,
          reference_number: creditNote.credit_note_number,
          credit_note_id: creditNoteId,
          client_id: creditNote.client_id || null,
          category_id: categoryId, // ✅ ADDED: Credit Notes category
          // IMPORTANT: Add currency fields
          currency: creditNote.currency || baseCurrency,
          exchange_rate: creditNote.exchange_rate || 1,
          base_amount: -Math.abs(creditNote.base_amount || (creditNote.total / (creditNote.exchange_rate || 1))),
          tax_rate: creditNote.tax_rate || 0,
          tax_amount: creditNote.tax_amount ? -Math.abs(creditNote.tax_amount) : 0
        }]);
      
      if (incomeError) throw incomeError;
      break;
      
    case 'credit':
      // Update client balance (if you have this feature)
      await supabase.rpc('update_client_credit_balance', {
        p_client_id: creditNote.client_id,
        p_amount: creditNote.total
      });
      break;
      
    case 'apply':
      // Apply to unpaid invoice
      const { data: unpaidInvoice } = await supabase
        .from('invoices')
        .select('id, total')
        .eq('client_id', creditNote.client_id)
        .eq('status', 'sent')
        .order('due_date')
        .limit(1)
        .single();
        
      if (unpaidInvoice) {
        if (creditNote.total >= unpaidInvoice.total) {
          await updateInvoice(unpaidInvoice.id, { status: 'paid' });
        }
        
        await supabase.from('income').insert([{
          user_id: userId,
          amount: Math.min(creditNote.total, unpaidInvoice.total),
          description: `Credit Note ${creditNote.credit_note_number} applied to Invoice`,
          date: creditNote.date,
          credit_note_id: creditNoteId,
          client_id: creditNote.client_id,
          category_id: await getOrCreateCreditNotesCategory(userId), // ADD category here too
          // Add currency fields
          currency: creditNote.currency || baseCurrency,
          exchange_rate: creditNote.exchange_rate || 1,
          base_amount: Math.min(creditNote.total, unpaidInvoice.total) / (creditNote.exchange_rate || 1)
        }]);
      }
      break;
  }

  // Mark credit note as applied
  await supabase
    .from('credit_notes')
    .update({ 
      applied_to_income: true, 
      status: 'applied' 
    })
    .eq('id', creditNoteId);
};

export const getCreditNotesByInvoice = async (invoiceId: string): Promise<CreditNote[]> => {
  const { data, error } = await supabase
    .from('credit_notes')
    .select(`
      *,
      items:credit_note_items(*)
    `)
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as CreditNote[];
};


// Helper function to get or create credit notes category
export const getOrCreateCreditNotesCategory = async (userId: string): Promise<string | null> => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  // Check if credit notes category exists
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', effectiveUserId)
    .eq('name', 'Credit Notes & Refunds')
    .eq('type', 'income')
    .single();
  
  if (existing) return existing.id;
  
  // Create it if it doesn't exist
  const { data: newCategory, error } = await supabase
    .from('categories')
    .insert({
      user_id: effectiveUserId,
      name: 'Credit Notes & Refunds',
      type: 'income',
      color: '#EF4444',
      description: 'Refunds and credit note adjustments'
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating credit notes category:', error);
    return null;
  }
  
  return newCategory?.id || null;
};

