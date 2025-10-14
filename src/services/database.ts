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
  Vendor,
  InvoicePayment
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

export const deleteIncome = async (id: string, userId: string, reason?: string) => {
  // 🔴 GDPR CRITICAL FIX: Fetch data BEFORE deleting for audit trail
  const { data: income, error: fetchError } = await supabase
    .from('income')
    .select(`
      *,
      client:clients(name, email),
      category:categories(name)
    `)
    .eq('id', id)
    .single();

  if (fetchError || !income) {
    throw new Error('Income entry not found');
  }

  // Delete the record
  const { error } = await supabase
    .from('income')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // ✅ GDPR Article 30 & 32: Log deletion for audit trail (WHO, WHAT, WHEN, WHY)
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'delete',
    entity_type: 'income',
    entity_id: id,
    entity_name: income.description,
    metadata: {
      deleted_at: new Date().toISOString(),
      amount: income.amount,
      currency: income.currency,
      date: income.date,
      // GDPR: Track personal data involved
      client_data: income.client ? {
        name: income.client.name,
        email: income.client.email
      } : null,
      category: income.category?.name,
      deletion_reason: reason || 'user_request',
      // Additional compliance fields
      tax_amount: income.tax_amount,
      reference_number: income.reference_number
    }
  });
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

export const deleteExpense = async (id: string, userId: string, reason?: string) => {
  // 🔴 GDPR CRITICAL FIX: Fetch data BEFORE deleting for audit trail
  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select(`
      *,
      vendor_detail:vendors(name, email),
      category:categories(name)
    `)
    .eq('id', id)
    .single();

  if (fetchError || !expense) {
    throw new Error('Expense not found');
  }

  // Delete the record
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // ✅ GDPR Article 30 & 32: Log deletion for audit trail (WHO, WHAT, WHEN, WHY)
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'delete',
    entity_type: 'expense',
    entity_id: id,
    entity_name: expense.description,
    metadata: {
      deleted_at: new Date().toISOString(),
      amount: expense.amount,
      currency: expense.currency,
      date: expense.date,
      // GDPR: Track personal data involved
      vendor_data: expense.vendor_detail ? {
        name: expense.vendor_detail.name,
        email: expense.vendor_detail.email
      } : null,
      vendor_name: expense.vendor,
      category: expense.category?.name,
      deletion_reason: reason || 'user_request',
      // Additional compliance fields
      tax_amount: expense.tax_amount,
      reference_number: expense.reference_number,
      receipt_url: expense.receipt_url
    }
  });
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
  
  // Check limits first (keep existing code)
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
  
  // Use atomic creation - DON'T pass invoice_number, it will be generated
  const invoiceData = { ...invoice };
  delete invoiceData.invoice_number; // Remove if exists
  
  const { data, error } = await supabase
    .rpc('create_invoice_atomic', {
      p_invoice: {
        ...invoiceData,
        user_id: effectiveUserId
      },
      p_items: items.map(item => ({
        description: item.description,
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: item.amount || 0,
        tax_rate: item.tax_rate || 0,
        tax_amount: item.tax_amount || 0,
        net_amount: item.net_amount || item.amount || 0,
        gross_amount: item.gross_amount || ((item.amount || 0) + (item.tax_amount || 0))
      }))
    });
  
  if (error) {
    console.error('Invoice creation error:', error);
    throw error;
  }
  
  // Check usage warning (keep existing code)
  const currentUsage = limitCheck.usage + 1;
  const usagePercentage = (currentUsage / limitCheck.limit) * 100;
  if (usagePercentage >= 80 && usagePercentage < 100) {
    window.dispatchEvent(new CustomEvent('invoiceCreated', { 
      detail: { 
        usage: currentUsage, 
        limit: limitCheck.limit 
      } 
    }));
  }
  
  return data as Invoice;
};

export const updateInvoice = async (id: string, updates: any, items?: any[]) => {
  // Check if this is ONLY updating credit metadata
  const isCreditUpdate = Object.keys(updates).every(key => 
    ['has_credit_notes', 'total_credited'].includes(key)
  );
  
  if (!isCreditUpdate) {
    // Only check status for non-credit updates
    const { data: currentInvoice, error: checkError } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', id)
      .single();
    
    if (checkError) throw checkError;
    
    // Block modifications to canceled invoices
    if (currentInvoice.status === 'canceled') {
      throw new Error('Cannot modify canceled invoices');
    }
    
    // Block non-credit modifications to paid invoices
    if (currentInvoice.status === 'paid') {
      throw new Error('Cannot modify paid invoices except for credit notes');
    }
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



export const deleteInvoice = async (id: string): Promise<{ success: boolean; hadRecurring: boolean }> => {
  try {
    // 1. Start a transaction-like approach
    let hadRecurring = false;
    
    // 2. Check if invoice exists and user has permission
    const { data: invoice, error: checkError } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, user_id, payment_locked_at')
      .eq('id', id)
      .single();

    if (checkError || !invoice) {
      throw new Error('Invoice not found or you do not have permission to delete it');
    }

    // 3. Check if invoice is locked (paid or has payments)
    if (invoice.status === 'paid') {
      throw new Error('Cannot delete paid invoices for compliance reasons');
    }

    // Check if invoice has any payments recorded
    if (invoice.payment_locked_at) {
      throw new Error('This invoice has payments and cannot be deleted for compliance reasons');
    }
    
    // 4. Check for credit notes
    const { data: creditNotes } = await supabase
      .from('credit_notes')
      .select('id')
      .eq('invoice_id', id)
      .limit(1);
    
    if (creditNotes && creditNotes.length > 0) {
      throw new Error('Cannot delete invoice with credit notes. Delete credit notes first.');
    }
    
    // 5. Check and delete recurring invoice if exists
    const { data: recurringData } = await supabase
      .from('recurring_invoices')
      .select('id')
      .eq('invoice_id', id)
      .single();
    
    if (recurringData) {
      hadRecurring = true;
      const { error: recurringError } = await supabase
        .from('recurring_invoices')
        .delete()
        .eq('invoice_id', id);
      
      if (recurringError) {
        console.error('Failed to delete recurring invoice:', recurringError);
        throw new Error('Failed to delete recurring invoice schedule');
      }
    }
    
    // 6. Delete related records in correct order
    
    // Delete invoice activities
    await supabase
      .from('invoice_activities')
      .delete()
      .eq('invoice_id', id);
    
    // Delete invoice reminders
    await supabase
      .from('invoice_reminders')
      .delete()
      .eq('invoice_id', id);
    
    // Delete email logs
    await supabase
      .from('email_logs')
      .delete()
      .eq('invoice_id', id);
    
    // Delete invoice items
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', id);
    
    if (itemsError) {
      throw new Error('Failed to delete invoice items');
    }
    
    // 7. Finally delete the invoice
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      throw new Error(`Failed to delete invoice: ${deleteError.message}`);
    }
    
    // 8. Log the deletion for audit trail
    await supabase
      .from('audit_logs')
      .insert({
        user_id: invoice.user_id,
        action: 'delete',
        entity_type: 'invoice',
        entity_id: id,
        entity_name: invoice.invoice_number,
        metadata: { 
          deleted_at: new Date().toISOString(),
          had_recurring: hadRecurring 
        }
      });
    
    return { success: true, hadRecurring };
    
  } catch (error) {
    console.error('Error in deleteInvoice:', error);
    throw error;
  }
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
  const effectiveUserId = await getEffectiveUserId(userId);
  
  try {
    // Call the SQL function directly (no edge function needed)
    const { data, error } = await supabase
      .rpc('get_next_invoice_number', { p_user_id: effectiveUserId });
    
    if (error) throw error;
    return data;
    
  } catch (error) {
    console.error('Error getting next invoice number:', error);
    // Fallback to timestamp-based number
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
    .order('accepted_at', { ascending: false });

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
      accepted_at,
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
  
  const cleanItems = items.map(item => ({
    invoice_item_id: item.invoice_item_id || null,
    description: item.description || '',
    quantity: item.quantity || 1,
    rate: item.rate || 0,
    amount: item.amount || 0,
    tax_rate: item.tax_rate || 0,
    tax_amount: item.tax_amount || 0,
    net_amount: item.net_amount || item.amount || 0,
    gross_amount: item.gross_amount || ((item.amount || 0) + (item.tax_amount || 0))
  }));

  const { data, error } = await supabase
    .rpc('create_credit_note_with_items', {
      p_credit_note: {
        ...creditNote,
        user_id: userId
      },
      p_items: cleanItems
    });

  if (error) {
    console.error('Credit note creation failed:', error);
    throw error;
  }

  return data as CreditNote;
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
  // 🔴 CRITICAL FIX: Use effectiveUserId for team support
  const effectiveUserId = await getEffectiveUserId(userId);

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

  // Get user's base currency using effectiveUserId
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('base_currency')
    .eq('user_id', effectiveUserId)
    .single();

  const baseCurrency = userSettings?.base_currency || 'USD';

  switch(action) {
    case 'refund':
      // Get or create the credit notes category using effectiveUserId
      const categoryId = await getOrCreateCreditNotesCategory(effectiveUserId);

      // Create negative income entry with proper currency fields AND category
      const { error: incomeError } = await supabase
        .from('income')
        .insert([{
          user_id: effectiveUserId,  // 🔴 FIX: Use effectiveUserId for team support
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
          base_amount: -Math.abs(creditNote.base_amount || (creditNote.subtotal / (creditNote.exchange_rate || 1))),
          tax_rate: creditNote.tax_rate || 0,
          tax_amount: creditNote.tax_amount ? -Math.abs(creditNote.tax_amount) : 0,
          tax_metadata: creditNote.tax_metadata || null  // 🔴 CRITICAL FIX: Include VAT breakdown for HMRC compliance
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
        .select('id, total, currency, exchange_rate')  // 🔴 FIX: Get currency info
        .eq('client_id', creditNote.client_id)
        .eq('status', 'sent')
        .order('due_date')
        .limit(1)
        .single();

      if (unpaidInvoice) {
        if (creditNote.total >= unpaidInvoice.total) {
          await updateInvoice(unpaidInvoice.id, { status: 'paid' });
        }

        // 🔴 FIX: Proper currency conversion for cross-currency applications
        const applyAmount = Math.min(creditNote.total, unpaidInvoice.total);
        const creditNoteCurrency = creditNote.currency || baseCurrency;
        const invoiceCurrency = unpaidInvoice.currency || baseCurrency;

        let baseAmount: number;

        if (creditNoteCurrency === invoiceCurrency) {
          // Same currency - simple conversion
          baseAmount = applyAmount / (creditNote.exchange_rate || 1);
        } else {
          // Different currencies - convert credit note amount to base, then to invoice currency
          // Credit note in base currency
          const creditNoteInBase = creditNote.total / (creditNote.exchange_rate || 1);
          // Invoice amount in base currency
          const invoiceInBase = unpaidInvoice.total / (unpaidInvoice.exchange_rate || 1);
          // Use the smaller amount in base currency
          baseAmount = Math.min(creditNoteInBase, invoiceInBase);
        }

        await supabase.from('income').insert([{
          user_id: effectiveUserId,  // 🔴 FIX: Use effectiveUserId for team support
          amount: applyAmount,
          description: `Credit Note ${creditNote.credit_note_number} applied to Invoice`,
          date: creditNote.date,
          credit_note_id: creditNoteId,
          client_id: creditNote.client_id,
          category_id: await getOrCreateCreditNotesCategory(effectiveUserId), // 🔴 FIX: Use effectiveUserId
          // Add currency fields with proper conversion
          currency: creditNoteCurrency,
          exchange_rate: creditNote.exchange_rate || 1,
          base_amount: baseAmount
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

  // 🟡 HIGH PRIORITY FIX: Add audit trail for compliance
  await supabase
    .from('audit_logs')
    .insert({
      user_id: effectiveUserId,  // Use effectiveUserId for team ownership
      action: 'apply',
      entity_type: 'credit_note',
      entity_id: creditNoteId,
      entity_name: creditNote.credit_note_number,
      metadata: {
        action_type: action,
        applied_at: new Date().toISOString(),
        invoice_id: creditNote.invoice_id,
        amount: creditNote.total,
        currency: creditNote.currency,
        performed_by: userId  // Track who actually performed the action
      }
    });
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
  
  // Create it if it doesn't exist - WITH description now that column exists
  const { data: newCategory, error } = await supabase
    .from('categories')
    .insert({
      user_id: effectiveUserId,
      name: 'Credit Notes & Refunds',
      type: 'income',
      color: '#EF4444',
      description: 'Refunds and credit note adjustments' // Can include now!
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating credit notes category:', error);
    return null;
  }
  
  return newCategory?.id || null;
};

// ============================================================
// LOAN MANAGEMENT FUNCTIONS - Team Aware
// ============================================================

// Get all loans for user (team-aware)
export const getLoans = async (userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      vendor:vendors(*)
    `)
    .eq('user_id', effectiveUserId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

// Get single loan by ID
export const getLoan = async (loanId: string, userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      vendor:vendors(*),
      payments:loan_payments(*),
      schedule:loan_schedules(*)
    `)
    .eq('id', loanId)
    .eq('user_id', effectiveUserId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data;
};

// Create new loan
export const createLoan = async (
  loan: Omit<any, 'id' | 'created_at' | 'updated_at'>,
  userId: string
) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  const { data, error } = await supabase
    .from('loans')
    .insert([{
      ...loan,
      user_id: effectiveUserId,
      created_by: userId
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Update loan
export const updateLoan = async (
  loanId: string,
  updates: Partial<any>,
  userId: string
) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  const { data, error } = await supabase
    .from('loans')
    .update({
      ...updates,
      updated_by: userId,
      updated_at: new Date().toISOString()
    })
    .eq('id', loanId)
    .eq('user_id', effectiveUserId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Soft delete loan
export const deleteLoan = async (loanId: string, userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  const { error } = await supabase
    .from('loans')
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: userId
    })
    .eq('id', loanId)
    .eq('user_id', effectiveUserId);

  if (error) throw error;
};

// Get loan payments
export const getLoanPayments = async (loanId: string, userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  const { data, error } = await supabase
    .from('loan_payments')
    .select(`
      *,
      loan:loans!inner(*),
      expense:expenses(*)
    `)
    .eq('loan_id', loanId)
    .eq('user_id', effectiveUserId)
    .order('payment_number', { ascending: true });

  if (error) throw error;
  return data || [];
};

// Create loan payment
export const createLoanPayment = async (
  payment: Omit<any, 'id' | 'created_at' | 'updated_at'>,
  userId: string
) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  // Create the loan payment record
  const { data, error } = await supabase
    .from('loan_payments')
    .insert([{
      ...payment,
      user_id: effectiveUserId,
      created_by: userId
    }])
    .select()
    .single();

  if (error) throw error;

  // Auto-create expense entry for interest portion (if interest > 0)
  if (data && payment.interest_amount > 0) {
    try {
      // Get or create the "Loan Interest" category
      const categoryId = await getOrCreateLoanInterestCategory(userId);

      if (categoryId) {
        // Get loan details for description
        const { data: loan } = await supabase
          .from('loans')
          .select('loan_number, lender_name, currency')
          .eq('id', payment.loan_id)
          .single();

        // Create expense entry for interest
        const expenseData = {
          user_id: effectiveUserId,
          category_id: categoryId,
          amount: payment.interest_amount,
          currency: loan?.currency || 'USD',
          description: `Loan interest payment #${payment.payment_number} - ${loan?.lender_name || 'Loan'} (${loan?.loan_number || ''})`,
          date: payment.payment_date,
          vendor: loan?.lender_name || null,
        };

        const { data: expense } = await supabase
          .from('expenses')
          .insert([expenseData])
          .select()
          .single();

        // Link expense to payment
        if (expense) {
          await supabase
            .from('loan_payments')
            .update({ expense_id: expense.id })
            .eq('id', data.id);
        }
      }
    } catch (expenseError) {
      console.error('Failed to create interest expense:', expenseError);
      // Don't fail the whole payment if expense creation fails
    }
  }

  return data;
};

// Update loan payment
export const updateLoanPayment = async (
  paymentId: string,
  updates: Partial<any>,
  userId: string
) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  const { data, error } = await supabase
    .from('loan_payments')
    .update({
      ...updates,
      updated_by: userId,
      updated_at: new Date().toISOString()
    })
    .eq('id', paymentId)
    .eq('user_id', effectiveUserId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Save loan schedule (amortization)
export const saveLoanSchedule = async (
  loanId: string,
  scheduleData: any[],
  userId: string
) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  // Check if schedule exists
  const { data: existing } = await supabase
    .from('loan_schedules')
    .select('id')
    .eq('loan_id', loanId)
    .maybeSingle();

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('loan_schedules')
      .update({
        schedule_data: scheduleData,
        updated_at: new Date().toISOString()
      })
      .eq('loan_id', loanId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Create new
    const { data, error } = await supabase
      .from('loan_schedules')
      .insert([{
        loan_id: loanId,
        schedule_data: scheduleData
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// Get loan schedule
export const getLoanSchedule = async (loanId: string, userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  const { data, error } = await supabase
    .from('loan_schedules')
    .select('*')
    .eq('loan_id', loanId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

// Delete loan payment
export const deleteLoanPayment = async (paymentId: string, userId: string) => {
  const effectiveUserId = await getEffectiveUserId(userId);

  // Get payment details before deleting
  const { data: payment } = await supabase
    .from('loan_payments')
    .select('*, loan:loans(*)')
    .eq('id', paymentId)
    .single();

  if (!payment) throw new Error('Payment not found');

  // Delete associated expense if exists
  if (payment.expense_id) {
    await supabase
      .from('expenses')
      .delete()
      .eq('id', payment.expense_id);
  }

  // Delete the payment
  const { error } = await supabase
    .from('loan_payments')
    .delete()
    .eq('id', paymentId);

  if (error) throw error;

  // Recalculate loan totals
  const { data: allPayments } = await supabase
    .from('loan_payments')
    .select('*')
    .eq('loan_id', payment.loan_id)
    .eq('status', 'paid');

  const totalPaid = allPayments?.reduce((sum, p) => sum + p.total_payment, 0) || 0;
  const totalPrincipalPaid = allPayments?.reduce((sum, p) => sum + p.principal_amount, 0) || 0;
  const totalInterestPaid = allPayments?.reduce((sum, p) => sum + p.interest_amount, 0) || 0;
  const currentBalance = payment.loan.principal_amount - totalPrincipalPaid;

  // Update loan
  await supabase
    .from('loans')
    .update({
      current_balance: currentBalance,
      total_paid: totalPaid,
      total_principal_paid: totalPrincipalPaid,
      total_interest_paid: totalInterestPaid,
      status: currentBalance <= 0 ? 'paid_off' : 'active',
      updated_by: userId,
    })
    .eq('id', payment.loan_id);

  return true;
};

// Get or create 'Loan Interest' expense category
export const getOrCreateLoanInterestCategory = async (userId: string): Promise<string | null> => {
  const effectiveUserId = await getEffectiveUserId(userId);

  // Try to find existing category
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', effectiveUserId)
    .eq('name', 'Loan Interest')
    .eq('type', 'expense')
    .single();

  if (existing) return existing.id;

  // Create it if it doesn't exist
  const { data: newCategory, error } = await supabase
    .from('categories')
    .insert({
      user_id: effectiveUserId,
      name: 'Loan Interest',
      type: 'expense',
      color: '#DC2626',
      description: 'Interest payments on business loans'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating loan interest category:', error);
    return null;
  }

  return newCategory?.id || null;
};

// ============================================================
// INVOICE PAYMENT TRACKING FUNCTIONS
// ============================================================

// Record a payment for an invoice
export const recordInvoicePayment = async (
  invoiceId: string,
  paymentDetails: {
    amount: number;
    payment_date: string;
    payment_method: 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'other';
    reference_number?: string;
    notes?: string;
  },
  userId: string
): Promise<InvoicePayment> => {
  const effectiveUserId = await getEffectiveUserId(userId);

  // Check if payment already exists for this invoice to prevent duplicates
  const { data: existingPayment } = await supabase
    .from('invoice_payments')
    .select('id')
    .eq('invoice_id', invoiceId)
    .eq('amount', paymentDetails.amount)
    .eq('payment_date', paymentDetails.payment_date)
    .maybeSingle();

  if (existingPayment) {
    throw new Error('A payment with the same amount and date already exists for this invoice');
  }

  // Insert payment record
  const { data, error } = await supabase
    .from('invoice_payments')
    .insert([{
      invoice_id: invoiceId,
      user_id: effectiveUserId,
      amount: paymentDetails.amount,
      payment_date: paymentDetails.payment_date,
      payment_method: paymentDetails.payment_method,
      reference_number: paymentDetails.reference_number || null,
      notes: paymentDetails.notes || null
    }])
    .select()
    .single();

  if (error) throw error;
  return data as InvoicePayment;
};

// Get all payments for an invoice
export const getInvoicePayments = async (invoiceId: string): Promise<InvoicePayment[]> => {
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false });

  if (error) throw error;
  return data as InvoicePayment[];
};

// Calculate invoice balance (total paid and balance due)
export const calculateInvoiceBalance = async (
  invoiceId: string
): Promise<{ total_paid: number; balance_due: number; invoice_total: number }> => {
  // Get invoice total
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('total')
    .eq('id', invoiceId)
    .single();

  if (invoiceError) throw invoiceError;

  // Get all payments for this invoice
  const { data: payments, error: paymentsError } = await supabase
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId);

  if (paymentsError) throw paymentsError;

  const total_paid = payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
  const balance_due = invoice.total - total_paid;

  return {
    total_paid,
    balance_due,
    invoice_total: invoice.total
  };
};

