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

  // For exact date matches (single date), use .eq() instead of .gte()/.lte()
  // This is more accurate and follows Supabase best practices
  if (startDate && endDate && startDate === endDate) {
    // Extract just the date part (YYYY-MM-DD) to handle any timezone/time components
    const dateOnly = startDate.split('T')[0].split(' ')[0];
    query = query.eq('date', dateOnly);
  } else {
    // For date ranges, use .gte() and .lte()
    if (startDate) {
      const dateOnly = startDate.split('T')[0].split(' ')[0];
      query = query.gte('date', dateOnly);
    }
    if (endDate) {
      const dateOnly = endDate.split('T')[0].split(' ')[0];
      query = query.lte('date', dateOnly);
    }
  }

  const { data, error } = await query;

  // Debug logging for date queries
  if (startDate || endDate) {
    console.log('[getIncomes] Query params - startDate:', startDate, 'endDate:', endDate);
    console.log('[getIncomes] Query result - count:', data?.length || 0, 'error:', error);
    if (data && data.length > 0) {
      console.log('[getIncomes] Sample dates from results:', data.slice(0, 3).map((inc: any) => ({ id: inc.id, date: inc.date, description: inc.description })));
    }
  }

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
      tax_rate: income.tax_rate ?? null,
      tax_amount: income.tax_amount ?? null
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
  if ('client_id' in updates) updateData.client_id = updates.client_id || null;
  if ('reference_number' in updates) updateData.reference_number = updates.reference_number || null;
  if ('tax_rate' in updates) updateData.tax_rate = updates.tax_rate ?? null;
  if ('tax_amount' in updates) updateData.tax_amount = updates.tax_amount ?? null;

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
      tax_rate: expense.tax_rate ?? null,
      tax_amount: expense.tax_amount ?? null,
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
  if ('tax_rate' in updates) updateData.tax_rate = updates.tax_rate ?? null;
  if ('tax_amount' in updates) updateData.tax_amount = updates.tax_amount ?? null;
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

  // Clean invoice data - remove fields that will be generated/set
  const invoiceData = { ...invoice };
  delete invoiceData.invoice_number; // Will be generated
  delete invoiceData.status; // Will be set to 'draft' in direct insert

  // Get next invoice number
  const invoiceNumber = await getNextInvoiceNumber(userId);

  // Direct insert (same as InvoiceForm) - avoids RPC function enum issues
  const { data: newInvoice, error: insertError } = await supabase
    .from('invoices')
    .insert({
      ...invoiceData,
      user_id: effectiveUserId,
      invoice_number: invoiceNumber,
      status: 'draft', // Direct insert accepts string, database handles enum conversion
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .single();

  if (insertError) {
    console.error('Invoice creation error:', insertError);
    throw insertError;
  }

  // Insert invoice items if provided
  if (items && items.length > 0) {
    const invoiceItems = items.map(item => ({
      invoice_id: newInvoice.id,
      description: item.description,
      quantity: item.quantity || 1,
      rate: item.rate || 0,
      amount: item.amount || 0,
      tax_rate: item.tax_rate || 0,
      tax_amount: item.tax_amount || 0,
      net_amount: item.net_amount || item.amount || 0,
      gross_amount: item.gross_amount || ((item.amount || 0) + (item.tax_amount || 0))
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemsError) {
      // If items fail, try to clean up the invoice
      await supabase.from('invoices').delete().eq('id', newInvoice.id);
      throw itemsError;
    }

    // Fetch the complete invoice with items
    const { data: completeInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(*),
        items:invoice_items(*)
      `)
      .eq('id', newInvoice.id)
      .single();

    if (fetchError) throw fetchError;

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

    return completeInvoice as Invoice;
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

  return newInvoice as Invoice;
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
  // First, get the current credit note to check for invoice_id
  const { data: currentCreditNote, error: fetchError } = await supabase
    .from('credit_notes')
    .select('invoice_id, total, status')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Update credit note directly - no invoice_id modification needed
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

  // ✅ Use invoice_credit_tracking table instead of invoices table (avoids HMRC lock)
  if (currentCreditNote.invoice_id && updates.status === 'applied' && currentCreditNote.status !== 'applied') {
    const creditAmount = updates.total || currentCreditNote.total;

    // Check if tracking record exists
    const { data: existingTracking } = await supabase
      .from('invoice_credit_tracking')
      .select('id, total_credited, credit_note_count')
      .eq('invoice_id', currentCreditNote.invoice_id)
      .single();

    if (existingTracking) {
      // Update existing tracking record
      await supabase
        .from('invoice_credit_tracking')
        .update({
          total_credited: (existingTracking.total_credited || 0) + creditAmount,
          credit_note_count: (existingTracking.credit_note_count || 0) + 1,
          last_credit_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('invoice_id', currentCreditNote.invoice_id);
    } else {
      // Create new tracking record
      await supabase
        .from('invoice_credit_tracking')
        .insert({
          invoice_id: currentCreditNote.invoice_id,
          total_credited: creditAmount,
          credit_note_count: 1,
          last_credit_date: new Date().toISOString()
        });
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

  // ✅ Use invoice_credit_tracking table instead of invoices (avoids HMRC lock)
  if (creditNote.invoice_id) {
    // Get current tracking record
    const { data: tracking } = await supabase
      .from('invoice_credit_tracking')
      .select('id, total_credited, credit_note_count')
      .eq('invoice_id', creditNote.invoice_id)
      .single();

    if (tracking) {
      const newTotalCredited = Math.max(0, (tracking.total_credited || 0) - creditNote.total);
      const newCount = Math.max(0, (tracking.credit_note_count || 0) - 1);

      if (newCount === 0) {
        // Delete tracking record if no more credit notes
        await supabase
          .from('invoice_credit_tracking')
          .delete()
          .eq('invoice_id', creditNote.invoice_id);
      } else {
        // Update tracking record
        await supabase
          .from('invoice_credit_tracking')
          .update({
            total_credited: newTotalCredited,
            credit_note_count: newCount,
            updated_at: new Date().toISOString()
          })
          .eq('invoice_id', creditNote.invoice_id);
      }
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

  switch (action) {
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

// ==========================================
// PROJECT FUNCTIONS
// ==========================================

/**
 * Calculate project statistics on-the-fly
 * This is a fallback when materialized view doesn't exist
 */
const calculateProjectStats = async (projectId: string) => {
  try {
    // Get all transactions for this project
    const [incomeResult, expenseResult, invoiceResult] = await Promise.all([
      supabase
        .from('income')
        .select('base_amount')
        .eq('project_id', projectId)
        .is('deleted_at', null),
      supabase
        .from('expenses')
        .select('base_amount')
        .eq('project_id', projectId)
        .is('deleted_at', null),
      supabase
        .from('invoices')
        .select('base_amount, status')
        .eq('project_id', projectId)
        .is('deleted_at', null)
    ]);

    const incomes = incomeResult.data || [];
    const expenses = expenseResult.data || [];
    const invoices = invoiceResult.data || [];

    const total_income = incomes.reduce((sum, i) => sum + (i.base_amount || 0), 0);
    const total_expenses = expenses.reduce((sum, e) => sum + (e.base_amount || 0), 0);
    const invoice_total = invoices.reduce((sum, inv) => sum + (inv.base_amount || 0), 0);
    const profit = total_income - total_expenses;
    const profit_margin_percentage = total_income > 0 ? (profit / total_income) * 100 : 0;

    return {
      total_income,
      total_expenses,
      invoice_total,
      profit,
      profit_margin_percentage,
      income_count: incomes.length,
      expense_count: expenses.length,
      invoice_count: invoices.length,
      paid_invoice_count: invoices.filter(inv => inv.status === 'paid').length
    };
  } catch (error) {
    console.error('Error calculating project stats:', error);
    // Return zero stats on error
    return {
      total_income: 0,
      total_expenses: 0,
      invoice_total: 0,
      profit: 0,
      profit_margin_percentage: 0,
      income_count: 0,
      expense_count: 0,
      invoice_count: 0,
      paid_invoice_count: 0
    };
  }
};

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  client_id?: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  start_date?: string;
  end_date?: string;
  budget_amount?: number;
  budget_currency?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Populated from joins
  client?: any;
  stats?: {
    total_income: number;
    total_expenses: number;
    invoice_total: number;
    profit: number;
    profit_margin_percentage: number;
    income_count: number;
    expense_count: number;
    invoice_count: number;
    paid_invoice_count: number;
  };
}

/**
 * Get all projects for a user (team-aware)
 */
export const getProjects = async (
  userId: string,
  status?: 'active' | 'completed' | 'on_hold' | 'cancelled' | 'all'
): Promise<Project[]> => {
  const effectiveUserId = await getEffectiveUserId(userId);

  let query = supabase
    .from('projects')
    .select(`
      *,
      client:clients(id, name, email)
    `)
    .eq('user_id', effectiveUserId)
    .is('deleted_at', null);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  // Calculate stats for each project
  const projectsWithStats = await Promise.all(
    (data || []).map(async (project) => {
      const stats = await calculateProjectStats(project.id);
      return { ...project, stats };
    })
  );

  return projectsWithStats as Project[];
};

/**
 * Get a single project by ID
 */
export const getProject = async (projectId: string): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      client:clients(*)
    `)
    .eq('id', projectId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;

  // Calculate stats for the project
  const stats = await calculateProjectStats(projectId);

  return { ...data, stats } as Project;
};

/**
 * Create a new project
 */
export const createProject = async (
  project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
): Promise<Project> => {
  const effectiveUserId = await getEffectiveUserId(project.user_id);

  const { data, error } = await supabase
    .from('projects')
    .insert([{
      ...project,
      user_id: effectiveUserId,
      client_id: project.client_id || null,
      description: project.description || null,
      start_date: project.start_date || null,
      end_date: project.end_date || null,
      budget_amount: project.budget_amount || null,
      budget_currency: project.budget_currency || null,
      color: project.color || '#6366F1'
    }])
    .select(`
      *,
      client:clients(*)
    `)
    .single();

  if (error) throw error;

  // New projects have zero stats (no transactions yet)
  const stats = {
    total_income: 0,
    total_expenses: 0,
    invoice_total: 0,
    profit: 0,
    profit_margin_percentage: 0,
    income_count: 0,
    expense_count: 0,
    invoice_count: 0,
    paid_invoice_count: 0
  };

  return { ...data, stats } as Project;
};

/**
 * Update a project
 */
export const updateProject = async (
  projectId: string,
  updates: Partial<Project>
): Promise<Project> => {
  const updateData: any = { ...updates };

  // Handle nullable fields
  if ('client_id' in updates) updateData.client_id = updates.client_id || null;
  if ('description' in updates) updateData.description = updates.description || null;
  if ('start_date' in updates) updateData.start_date = updates.start_date || null;
  if ('end_date' in updates) updateData.end_date = updates.end_date || null;
  if ('budget_amount' in updates) updateData.budget_amount = updates.budget_amount || null;

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', projectId)
    .select(`
      *,
      client:clients(*)
    `)
    .single();

  if (error) throw error;

  // Calculate fresh stats
  const stats = await calculateProjectStats(projectId);

  return { ...data, stats } as Project;
};

/**
 * Soft delete a project
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', projectId);

  if (error) throw error;
};

/**
 * Get project transactions (income + expenses + invoices)
 */
export const getProjectTransactions = async (projectId: string) => {
  const [incomes, expenses, invoices] = await Promise.all([
    supabase
      .from('income')
      .select('*, category:categories(*)')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('date', { ascending: false }),
    supabase
      .from('expenses')
      .select('*, category:categories(*), vendor_detail:vendors(*)')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('date', { ascending: false }),
    supabase
      .from('invoices')
      .select('*, client:clients(*), items:invoice_items(*)')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
  ]);

  return {
    incomes: incomes.data || [],
    expenses: expenses.data || [],
    invoices: invoices.data || []
  };
};

/**
 * Get projects by client
 */
export const getProjectsByClient = async (
  userId: string,
  clientId: string
): Promise<Project[]> => {
  const effectiveUserId = await getEffectiveUserId(userId);

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', effectiveUserId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Calculate stats for each project
  const projectsWithStats = await Promise.all(
    (data || []).map(async (project) => {
      const stats = await calculateProjectStats(project.id);
      return { ...project, stats };
    })
  );

  return projectsWithStats as Project[];
};

/**
 * Check if project name already exists for user
 */
export const checkProjectNameExists = async (
  userId: string,
  name: string,
  excludeId?: string
): Promise<boolean> => {
  const effectiveUserId = await getEffectiveUserId(userId);

  let query = supabase
    .from('projects')
    .select('id')
    .eq('user_id', effectiveUserId)
    .eq('name', name)
    .is('deleted_at', null);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data && data.length > 0);
};

/**
 * Auto-suggest project from transaction description using AI
 * (Simple keyword matching for now, can be enhanced with AI later)
 */
export const suggestProjectFromDescription = async (
  userId: string,
  description: string,
  clientId?: string
): Promise<Project | null> => {
  const effectiveUserId = await getEffectiveUserId(userId);

  // Get active projects
  let query = supabase
    .from('projects')
    .select('*')
    .eq('user_id', effectiveUserId)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data: projects, error } = await query;

  if (error || !projects || projects.length === 0) return null;

  // Simple keyword matching (can be enhanced with AI)
  const descLower = description.toLowerCase();

  // Find project where description contains project name
  const match = projects.find(p =>
    descLower.includes(p.name.toLowerCase())
  );

  if (!match) return null;

  // Calculate stats for the matched project
  const stats = await calculateProjectStats(match.id);

  return { ...match, stats } as Project;
};

/**
 * Duplicate a project with its milestones and goals
 * Does NOT copy: time entries, files, activity log, income, expenses, invoices
 */
export const duplicateProject = async (
  projectId: string,
  userId: string
): Promise<Project> => {
  const effectiveUserId = await getEffectiveUserId(userId);

  // Get original project
  const { data: originalProject, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', effectiveUserId)
    .is('deleted_at', null)
    .single();

  if (projectError) throw projectError;
  if (!originalProject) throw new Error('Project not found');

  // Create new project with " - Copy" suffix
  const { data: newProject, error: newProjectError } = await supabase
    .from('projects')
    .insert([{
      user_id: effectiveUserId,
      name: `${originalProject.name} - Copy`,
      description: originalProject.description,
      client_id: originalProject.client_id,
      budget_amount: originalProject.budget_amount,
      budget_currency: originalProject.budget_currency,
      status: 'active', // Reset to active
      start_date: null, // Reset dates
      end_date: null
    }])
    .select()
    .single();

  if (newProjectError) throw newProjectError;

  // Get original milestones
  const { data: originalMilestones } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('due_date', { ascending: true });

  // Copy milestones if any exist
  if (originalMilestones && originalMilestones.length > 0) {
    const milestonesToInsert = originalMilestones.map(m => ({
      project_id: newProject.id,
      user_id: effectiveUserId,
      name: m.name,
      description: m.description,
      due_date: null, // Reset date
      target_amount: m.target_amount,
      currency: m.currency,
      status: 'pending' as const, // Reset to pending
      completion_date: null, // Clear completion
      invoice_id: null // Don't link to old invoice
    }));

    await supabase
      .from('project_milestones')
      .insert(milestonesToInsert);
  }

  // Get original goals
  const { data: originalGoals } = await supabase
    .from('project_goals')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });

  // Copy goals if any exist
  if (originalGoals && originalGoals.length > 0) {
    const goalsToInsert = originalGoals.map(g => ({
      project_id: newProject.id,
      user_id: effectiveUserId,
      title: g.title,
      description: g.description,
      status: 'todo' as const, // Reset to todo
      order_index: g.order_index
    }));

    await supabase
      .from('project_goals')
      .insert(goalsToInsert);
  }

  // Calculate stats for new project
  const stats = await calculateProjectStats(newProject.id);

  return { ...newProject, stats } as Project;
};

// ==========================================
// PROJECT MILESTONE FUNCTIONS
// ==========================================

export interface ProjectMilestone {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description?: string;
  due_date?: string;
  target_amount?: number;
  currency?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'paid';
  completion_date?: string;
  invoice_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Populated from joins
  invoice?: any;
}

/**
 * Get all milestones for a project
 */
export const getProjectMilestones = async (projectId: string): Promise<ProjectMilestone[]> => {
  const { data, error } = await supabase
    .from('project_milestones')
    .select(`
      *,
      invoice:invoices(id, invoice_number, total, status, currency)
    `)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('due_date', { ascending: true });

  if (error) throw error;
  return (data || []) as ProjectMilestone[];
};

/**
 * Get a single milestone by ID
 */
export const getMilestone = async (milestoneId: string): Promise<ProjectMilestone> => {
  const { data, error } = await supabase
    .from('project_milestones')
    .select(`
      *,
      invoice:invoices(id, invoice_number, total, status, currency)
    `)
    .eq('id', milestoneId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data as ProjectMilestone;
};

/**
 * Create a new milestone
 */
export const createMilestone = async (
  milestone: Omit<ProjectMilestone, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
): Promise<ProjectMilestone> => {
  const { data, error } = await supabase
    .from('project_milestones')
    .insert([{
      project_id: milestone.project_id,
      user_id: milestone.user_id,
      name: milestone.name,
      description: milestone.description || null,
      due_date: milestone.due_date || null,
      target_amount: milestone.target_amount || null,
      currency: milestone.currency || null,
      status: milestone.status || 'pending',
      completion_date: milestone.completion_date || null,
      invoice_id: milestone.invoice_id || null
    }])
    .select()
    .single();

  if (error) throw error;
  return data as ProjectMilestone;
};

/**
 * Update a milestone
 */
export const updateMilestone = async (
  milestoneId: string,
  updates: Partial<ProjectMilestone>
): Promise<ProjectMilestone> => {
  const { data, error } = await supabase
    .from('project_milestones')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', milestoneId)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectMilestone;
};

/**
 * Delete a milestone (soft delete)
 */
export const deleteMilestone = async (milestoneId: string): Promise<void> => {
  const { error } = await supabase
    .from('project_milestones')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', milestoneId);

  if (error) throw error;
};

// ==========================================
// PROJECT GOALS/DELIVERABLES FUNCTIONS
// ==========================================

export interface ProjectGoal {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  order_index: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Get all goals for a project
 */
export const getProjectGoals = async (projectId: string): Promise<ProjectGoal[]> => {
  const { data, error } = await supabase
    .from('project_goals')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return (data || []) as ProjectGoal[];
};

/**
 * Create a new goal
 */
export const createGoal = async (
  goal: Omit<ProjectGoal, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
): Promise<ProjectGoal> => {
  const { data, error } = await supabase
    .from('project_goals')
    .insert([{
      project_id: goal.project_id,
      user_id: goal.user_id,
      title: goal.title,
      description: goal.description || null,
      status: goal.status || 'todo',
      order_index: goal.order_index
    }])
    .select()
    .single();

  if (error) throw error;
  return data as ProjectGoal;
};

/**
 * Update a goal
 */
export const updateGoal = async (
  goalId: string,
  updates: Partial<ProjectGoal>
): Promise<ProjectGoal> => {
  const { data, error } = await supabase
    .from('project_goals')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', goalId)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectGoal;
};

/**
 * Delete a goal (soft delete)
 */
export const deleteGoal = async (goalId: string): Promise<void> => {
  const { error } = await supabase
    .from('project_goals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', goalId);

  if (error) throw error;
};

/**
 * Reorder goals
 */
export const reorderGoals = async (goals: { id: string; order_index: number }[]): Promise<void> => {
  const updates = goals.map(g =>
    supabase
      .from('project_goals')
      .update({ order_index: g.order_index })
      .eq('id', g.id)
  );

  await Promise.all(updates);
};

// ==========================================
// PROJECT TIME TRACKING FUNCTIONS
// ==========================================

export interface TimeEntry {
  id: string;
  project_id: string;
  user_id: string;
  date: string;
  hours: number;
  description?: string;
  billable: boolean;
  hourly_rate?: number;
  amount?: number; // hours * hourly_rate (if billable)
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Get all time entries for a project
 */
export const getProjectTimeEntries = async (projectId: string): Promise<TimeEntry[]> => {
  const { data, error } = await supabase
    .from('project_time_entries')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []) as TimeEntry[];
};

/**
 * Create a new time entry
 */
export const createTimeEntry = async (
  entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'amount'>
): Promise<TimeEntry> => {
  // Calculate amount if billable
  const amount = entry.billable && entry.hourly_rate
    ? entry.hours * entry.hourly_rate
    : null;

  const { data, error } = await supabase
    .from('project_time_entries')
    .insert([{
      project_id: entry.project_id,
      user_id: entry.user_id,
      date: entry.date,
      hours: entry.hours,
      description: entry.description || null,
      billable: entry.billable,
      hourly_rate: entry.hourly_rate || null,
      amount
    }])
    .select()
    .single();

  if (error) throw error;
  return data as TimeEntry;
};

/**
 * Update a time entry
 */
export const updateTimeEntry = async (
  entryId: string,
  updates: Partial<TimeEntry>
): Promise<TimeEntry> => {
  // Recalculate amount if hours, rate, or billable status changes
  const updateData: any = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  if (updates.hours !== undefined || updates.hourly_rate !== undefined || updates.billable !== undefined) {
    // Fetch current entry to get all values
    const { data: current } = await supabase
      .from('project_time_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (current) {
      const hours = updates.hours ?? current.hours;
      const rate = updates.hourly_rate ?? current.hourly_rate;
      const billable = updates.billable ?? current.billable;
      updateData.amount = billable && rate ? hours * rate : null;
    }
  }

  const { data, error } = await supabase
    .from('project_time_entries')
    .update(updateData)
    .eq('id', entryId)
    .select()
    .single();

  if (error) throw error;
  return data as TimeEntry;
};

/**
 * Delete a time entry (soft delete)
 */
export const deleteTimeEntry = async (entryId: string): Promise<void> => {
  const { error } = await supabase
    .from('project_time_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', entryId);

  if (error) throw error;
};

/**
 * Get time tracking summary for a project
 */
export const getProjectTimeStats = async (projectId: string) => {
  const entries = await getProjectTimeEntries(projectId);

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const billableHours = entries.filter(e => e.billable).reduce((sum, e) => sum + e.hours, 0);
  const nonBillableHours = entries.filter(e => !e.billable).reduce((sum, e) => sum + e.hours, 0);
  const totalAmount = entries.reduce((sum, e) => sum + (e.amount || 0), 0);

  return {
    totalHours,
    billableHours,
    nonBillableHours,
    totalAmount,
    entryCount: entries.length
  };
};

// ==========================================
// PROJECT FILE ATTACHMENTS FUNCTIONS
// ==========================================

export interface ProjectAttachment {
  id: string;
  project_id: string;
  user_id: string;
  file_name: string;
  file_path: string; // Path in Supabase storage
  file_size: number; // in bytes
  file_type: string; // MIME type
  description?: string;
  created_at: string;
  deleted_at?: string;
}

/**
 * Get all attachments for a project
 */
export const getProjectAttachments = async (projectId: string): Promise<ProjectAttachment[]> => {
  const { data, error } = await supabase
    .from('project_attachments')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ProjectAttachment[];
};

/**
 * Upload a file and create attachment record
 */
export const uploadProjectFile = async (
  projectId: string,
  userId: string,
  file: File,
  description?: string
): Promise<ProjectAttachment> => {
  // Generate unique file path
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${userId}/${projectId}/${fileName}`;

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from('project-files')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  // Create database record
  const { data, error } = await supabase
    .from('project_attachments')
    .insert([{
      project_id: projectId,
      user_id: userId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type,
      description: description || null
    }])
    .select()
    .single();

  if (error) throw error;
  return data as ProjectAttachment;
};

/**
 * Download/Get URL for a file
 */
export const getFileUrl = async (filePath: string): Promise<string> => {
  const { data } = await supabase.storage
    .from('project-files')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (!data) throw new Error('Failed to generate file URL');
  return data.signedUrl;
};

/**
 * Delete an attachment (soft delete + remove from storage)
 */
export const deleteAttachment = async (attachmentId: string): Promise<void> => {
  // Get attachment info
  const { data: attachment } = await supabase
    .from('project_attachments')
    .select('file_path')
    .eq('id', attachmentId)
    .single();

  if (!attachment) throw new Error('Attachment not found');

  // Delete from storage
  await supabase.storage
    .from('project-files')
    .remove([attachment.file_path]);

  // Soft delete from database
  const { error } = await supabase
    .from('project_attachments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', attachmentId);

  if (error) throw error;
};

// ==========================================
// PROJECT NOTES/ACTIVITY LOG FUNCTIONS
// ==========================================

export interface ProjectNote {
  id: string;
  project_id: string;
  user_id: string;
  type: 'note' | 'meeting' | 'call' | 'email' | 'change_request' | 'milestone' | 'other';
  title: string;
  content?: string;
  date: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Get all notes/activities for a project
 */
export const getProjectNotes = async (projectId: string): Promise<ProjectNote[]> => {
  const { data, error } = await supabase
    .from('project_notes')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []) as ProjectNote[];
};

/**
 * Create a new note/activity
 */
export const createNote = async (
  note: Omit<ProjectNote, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
): Promise<ProjectNote> => {
  const { data, error } = await supabase
    .from('project_notes')
    .insert([{
      project_id: note.project_id,
      user_id: note.user_id,
      type: note.type,
      title: note.title,
      content: note.content || null,
      date: note.date
    }])
    .select()
    .single();

  if (error) throw error;
  return data as ProjectNote;
};

/**
 * Update a note
 */
export const updateNote = async (
  noteId: string,
  updates: Partial<ProjectNote>
): Promise<ProjectNote> => {
  const { data, error } = await supabase
    .from('project_notes')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectNote;
};

/**
 * Delete a note (soft delete)
 */
export const deleteNote = async (noteId: string): Promise<void> => {
  const { error } = await supabase
    .from('project_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId);

  if (error) throw error;
};

