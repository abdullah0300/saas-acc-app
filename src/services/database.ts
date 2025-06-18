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
import { TeamMember, TeamInvite } from '../types/userManagement';
import { subscriptionService } from './subscriptionService';

// Team queries are now enabled
const BYPASS_TEAM_QUERIES = true;

// Cache for team IDs to prevent repeated queries
const teamIdCache = new Map<string, string>();

// Helper to get team ID for queries
export const getTeamId = async (userId: string): Promise<string> => {
  // Check cache first
  if (teamIdCache.has(userId)) {
    return teamIdCache.get(userId)!;
  }

  // If bypassed, return userId directly
  if (BYPASS_TEAM_QUERIES) {
    teamIdCache.set(userId, userId);
    return userId;
  }

  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<string>((resolve) => 
      setTimeout(() => resolve(userId), 3000)
    );

    const queryPromise = (async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no data
      
      if (error || !data) {
        return userId;
      }
      
      return data.team_id || userId;
    })();

    const teamId = await Promise.race([queryPromise, timeoutPromise]);
    
    // Cache the result
    teamIdCache.set(userId, teamId);
    return teamId;
  } catch (err) {
    console.error('Error getting team ID:', err);
    // Default to user's own ID on any error
    teamIdCache.set(userId, userId);
    return userId;
  }
};

// Function to clear the cache (useful after team changes)
export const clearTeamIdCache = () => {
  teamIdCache.clear();
};

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
  const teamId = await getTeamId(userId);
  
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', teamId)
    .single();
  
  if (error) throw error;
  return data as Subscription;
};

export const checkUserSubscriptionStatus = async (userId: string) => {
  try {
    // Skip team queries if bypassed
    if (BYPASS_TEAM_QUERIES) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Changed from .single()

      return {
        subscription,
        isTeamMember: false,
        teamId: userId,
        role: 'owner'
      };
    }

    // Use maybeSingle() to avoid errors when no data exists
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', userId)
      .maybeSingle(); // Changed from .single()

    if (teamMember && teamMember.team_id !== userId) {
      const { data: ownerSubscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', teamMember.team_id)
        .maybeSingle();

      return {
        subscription: ownerSubscription,
        isTeamMember: true,
        teamId: teamMember.team_id,
        role: teamMember.role
      };
    }

    // User is owner or not in a team
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      subscription,
      isTeamMember: false,
      teamId: userId,
      role: 'owner'
    };
  } catch (error) {
    console.error('Error checking subscription:', error);
    return {
      subscription: null,
      isTeamMember: false,
      teamId: userId,
      role: 'owner'
    };
  }
};

// Category functions - Team aware
export const getCategories = async (userId: string, type?: TransactionType) => {
  const teamId = await getTeamId(userId);
  
  let query = supabase
    .from('categories')
    .select('*')
    .eq('user_id', teamId);
  
  if (type) {
    query = query.eq('type', type);
  }
  
  const { data, error } = await query.order('name');
  
  if (error) throw error;
  return data as Category[];
};

export const createCategory = async (category: Omit<Category, 'id' | 'created_at'>) => {
  const teamId = await getTeamId(category.user_id);
  
  const { data, error } = await supabase
    .from('categories')
    .insert([{
      ...category,
      user_id: teamId
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Income functions - Team aware
export const getIncomes = async (userId: string, startDate?: string, endDate?: string) => {
  const teamId = await getTeamId(userId);
  
  let query = supabase
    .from('income')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('user_id', teamId);
  
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  
  const { data, error } = await query.order('date', { ascending: false });
  
  if (error) throw error;
  return data as Income[];
};

export const createIncome = async (income: Omit<Income, 'id' | 'created_at' | 'updated_at'>) => {
  const teamId = await getTeamId(income.user_id);
  
  const { data, error } = await supabase
    .from('income')
    .insert([{
      ...income,
      user_id: teamId,
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

// Expense functions - Team aware
export const getExpenses = async (userId: string, startDate?: string, endDate?: string) => {
  const teamId = await getTeamId(userId);
  
  let query = supabase
    .from('expenses')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('user_id', teamId);
  
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  
  const { data, error } = await query.order('date', { ascending: false });
  
  if (error) throw error;
  return data as Expense[];
};

export const createExpense = async (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
  const teamId = await getTeamId(expense.user_id);
  
  const { data, error } = await supabase
    .from('expenses')
    .insert([{
      ...expense,
      user_id: teamId,
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

// Client functions - Team aware
export const getClients = async (userId: string) => {
  const teamId = await getTeamId(userId);
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', teamId)
    .order('name');
  
  if (error) throw error;
  return data as Client[];
};

export const createClient = async (client: Omit<Client, 'id' | 'created_at'>) => {
  const teamId = await getTeamId(client.user_id);
  
  const { data, error } = await supabase
    .from('clients')
    .insert([{
      ...client,
      user_id: teamId,
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

// Invoice functions - Team aware
export const getInvoices = async (userId: string, status?: InvoiceStatus) => {
  const teamId = await getTeamId(userId);
  
  let query = supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('user_id', teamId);
  
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
  const teamId = await getTeamId(invoice.user_id);
  
  // Start a transaction
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .insert([{
      ...invoice,
      user_id: teamId,
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

// Dashboard statistics - Team aware
export const getDashboardStats = async (userId: string, startDate: string, endDate: string) => {
  const teamId = await getTeamId(userId);
  
  const [incomes, expenses, invoices] = await Promise.all([
    getIncomes(teamId, startDate, endDate),
    getExpenses(teamId, startDate, endDate),
    getInvoices(teamId)
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

// Team Member functions
export const getTeamMembers = async (teamId: string) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at');
    
    if (error) {
      console.error('Error fetching team members:', error);
      return [] as TeamMember[];
    }
    
    return (data || []) as TeamMember[];
  } catch (err) {
    console.error('Unexpected error in getTeamMembers:', err);
    return [] as TeamMember[];
  }
};

export const inviteTeamMember = async (
  teamId: string, 
  email: string, 
  role: 'admin' | 'member',
  invitedBy: string
) => {
  if (BYPASS_TEAM_QUERIES) {
    throw new Error('Team features are temporarily disabled. Please try again later.');
  }

  // First ensure the team owner exists in team_members
  const { data: ownerExists } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', teamId)
    .eq('team_id', teamId)
    .single();

  if (!ownerExists) {
    // Create the owner record if it doesn't exist
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', teamId)
      .single();

    if (ownerProfile) {
      await supabase
        .from('team_members')
        .insert([{
          user_id: teamId,
          team_id: teamId,
          email: ownerProfile.email,
          full_name: ownerProfile.full_name || 'Team Owner',
          role: 'owner',
          status: 'active',
          invited_by: teamId,
          joined_at: new Date().toISOString()
        }])
        .select();
    }
  }

  // Now check if user limit allows adding new member
  const { allowed, current, limit } = await subscriptionService.checkUserLimit(teamId);
  
  if (!allowed) {
    throw new Error(`Team member limit reached. Current plan allows ${limit} users.`);
  }

  // Check if already invited or member
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('email', email)
    .single();

  if (existing) {
    throw new Error('User is already a team member');
  }

  // Check if already has pending invite
  const { data: existingInvite } = await supabase
    .from('pending_invites')
    .select('id')
    .eq('team_id', teamId)
    .eq('email', email)
    .eq('accepted', false)
    .single();

  if (existingInvite) {
    throw new Error('User already has a pending invitation');
  }

  // Generate invite code
  const inviteCode = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  // Get inviter details
  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', invitedBy)
    .single();

  // Create invite in database
  const { data: invite, error } = await supabase
    .from('pending_invites')
    .insert([{
      team_id: teamId,
      email,
      role,
      invited_by: invitedBy,
      invite_code: inviteCode,
      expires_at: expiresAt.toISOString()
    }])
    .select()
    .single();

  if (error) throw error;

  // Send invitation email via Edge Function
  try {
    const { error: emailError } = await supabase.functions.invoke('send-team-invite', {
      body: {
        inviteId: invite.id,
        teamName: inviterProfile?.company_name,
        inviterName: inviterProfile?.full_name,
        inviteEmail: email,
        inviteCode: inviteCode
      }
    });

    if (emailError) {
      console.error('Failed to send invite email:', emailError);
      // Don't throw - invitation is created, just email failed
    }
  } catch (err) {
    console.error('Email service error:', err);
  }
  
  return invite;
};

export const removeTeamMember = async (teamId: string, memberId: string) => {
  if (BYPASS_TEAM_QUERIES) {
    throw new Error('Team features are temporarily disabled.');
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('id', memberId);
  
  if (error) throw error;
};

export const updateTeamMemberRole = async (
  teamId: string, 
  memberId: string, 
  role: 'admin' | 'member'
) => {
  if (BYPASS_TEAM_QUERIES) {
    throw new Error('Team features are temporarily disabled.');
  }

  const { data, error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('id', memberId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const acceptInvite = async (token: string, userId: string) => {
  // Get invite details
  const { data: invite, error: inviteError } = await supabase
    .from('pending_invites')
    .select('*')
    .eq('invite_code', token)
    .single();

  if (inviteError || !invite) {
    throw new Error('Invalid invitation');
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    throw new Error('Invitation has expired');
  }

  // Check user limit again
  const { allowed } = await subscriptionService.checkUserLimit(invite.team_id);
  if (!allowed) {
    throw new Error('Team has reached its member limit');
  }

  // Add as team member
  const { error: memberError } = await supabase
    .from('team_members')
    .insert([{
      user_id: userId,
      team_id: invite.team_id,
      email: invite.email,
      full_name: '', // Will be updated from profile
      role: invite.role,
      status: 'active',
      invited_by: invite.invited_by,
      joined_at: new Date().toISOString()
    }]);

  if (memberError) throw memberError;

  // Mark invite as accepted
  await supabase
    .from('pending_invites')
    .update({ accepted: true })
    .eq('id', invite.id);

  return invite.team_id;
};