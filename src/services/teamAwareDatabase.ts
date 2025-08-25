// src/services/teamAwareDatabase.ts
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

// Helper to get the actual team ID (for team queries)
export const getTeamId = async (userId: string): Promise<string> => {
 // Check if user is part of a team
 const { data: teamMember } = await supabase
   .from('team_members')
   .select('team_id')
   .eq('user_id', userId)
   .eq('status', 'active')
   .maybeSingle();

 // If user is part of a team, return team_id, otherwise return user_id
 return teamMember?.team_id || userId;
};

// Category functions - team aware
export const getCategories = async (userId: string, type?: TransactionType) => {
 const teamId = await getTeamId(userId);
 
 let query = supabase
   .from('categories')
   .select('*')
   .eq('user_id', teamId); // Use team ID for shared categories
 
 if (type) {
   query = query.eq('type', type);
 }
 
 const { data, error } = await query.order('name');
 
 if (error) throw error;
 return data as Category[];
};

// Income functions - team aware
export const getIncomes = async (userId: string, startDate?: string, endDate?: string) => {
 const teamId = await getTeamId(userId);
 
 let query = supabase
   .from('income')
   .select(`
     *,
     category:categories(*)
   `)
   .eq('user_id', teamId); // Use team ID for shared data
 
 if (startDate) query = query.gte('date', startDate);
 if (endDate) query = query.lte('date', endDate);
 
 const { data, error } = await query.order('date', { ascending: false });
 
 if (error) throw error;
 return data as Income[];
};

// Expense functions - team aware
export const getExpenses = async (userId: string, startDate?: string, endDate?: string) => {
 const teamId = await getTeamId(userId);
 
 let query = supabase
   .from('expenses')
   .select(`
     *,
     category:categories(*)
   `)
   .eq('user_id', teamId); // Use team ID for shared data
 
 if (startDate) query = query.gte('date', startDate);
 if (endDate) query = query.lte('date', endDate);
 
 const { data, error } = await query.order('date', { ascending: false });
 
 if (error) throw error;
 return data as Expense[];
};

// Client functions - team aware
export const getClients = async (userId: string) => {
 const teamId = await getTeamId(userId);
 
 const { data, error } = await supabase
   .from('clients')
   .select('*')
   .eq('user_id', teamId) // Use team ID for shared clients
   .order('name');
 
 if (error) throw error;
 return data as Client[];
};

// Invoice functions - team aware
export const getInvoices = async (userId: string, status?: InvoiceStatus) => {
 const teamId = await getTeamId(userId);
 
 let query = supabase
   .from('invoices')
   .select(`
     *,
     client:clients(*),
     items:invoice_items(*)
   `)
   .eq('user_id', teamId); // Use team ID for shared invoices
 
 if (status) query = query.eq('status', status);
 
 const { data, error } = await query.order('date', { ascending: false });
 
 if (error) throw error;
 return data as Invoice[];
};

// Dashboard statistics - team aware
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

// When creating new records, use teamId
export const createIncome = async (userId: string, income: Omit<Income, 'id' | 'created_at' | 'user_id'>) => {
 const teamId = await getTeamId(userId);
 
 const { data, error } = await supabase
   .from('income')
   .insert([{ ...income, user_id: teamId }])
   .select()
   .single();
 
 if (error) throw error;
 return data;
};

export const createExpense = async (userId: string, expense: Omit<Expense, 'id' | 'created_at' | 'user_id'>) => {
 const teamId = await getTeamId(userId);
 
 const { data, error } = await supabase
   .from('expenses')
   .insert([{ ...expense, user_id: teamId }])
   .select()
   .single();
 
 if (error) throw error;
 return data;
};

// Profile functions still use actual user ID
export const getProfile = async (userId: string) => {
 const { data, error } = await supabase
   .from('profiles')
   .select('*')
   .eq('id', userId) // Profile is per user, not per team
   .maybeSingle();
 
 if (error) throw error;
 return data as User;
};

export const updateProfile = async (userId: string, updates: Partial<User>) => {
 const { data, error } = await supabase
   .from('profiles')
   .update(updates)
   .eq('id', userId) // Profile is per user, not per team
   .select()
   .single();
 
 if (error) throw error;
 return data;
};

// ============= TEAM INVITATION FUNCTIONS =============

// Create team invitation
export const inviteTeamMember = async (
 teamId: string,
 email: string,
 role: 'admin' | 'member',
 invitedBy: string
) => {
 const token = crypto.randomUUID();
 const expiresAt = new Date();
 expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

 const { data, error } = await supabase
   .from('team_invites')
   .insert({
     team_id: teamId,
     email: email,
     role: role,
     invited_by: invitedBy,
     token: token,
     expires_at: expiresAt.toISOString()
   })
   .select()
   .single();

 if (error) throw error;

 return {
   token,
   inviteUrl: `${window.location.origin}/register?invite=${token}`,
   invitation: data
 };
};

// Get all pending invites for a team
export const getTeamInvites = async (teamId: string) => {
 const { data, error } = await supabase
   .from('team_invites')
   .select('*')
   .eq('team_id', teamId)
   .gte('expires_at', new Date().toISOString())
   .order('created_at', { ascending: false });

 if (error) throw error;
 return data;
};

// Cancel a team invite
export const cancelTeamInvite = async (inviteId: string, userId: string) => {
 const { error } = await supabase
   .from('team_invites')
   .delete()
   .eq('id', inviteId)
   .eq('invited_by', userId); // Ensure user can only cancel their own invites

 if (error) throw error;
};

// Get team members
export const getTeamMembers = async (teamId: string) => {
 const { data, error } = await supabase
   .from('team_members')
   .select(`
     *,
     user:user_id(email, full_name)
   `)
   .eq('team_id', teamId)
   .order('created_at', { ascending: false });

 if (error) throw error;
 return data;
};

// Update team member role
export const updateTeamMemberRole = async (
 teamId: string,
 memberId: string,
 newRole: 'admin' | 'member',
 updatedBy: string
) => {
 // Check if updater has permission (must be owner or admin)
 const { data: updater } = await supabase
   .from('team_members')
   .select('role')
   .eq('team_id', teamId)
   .eq('user_id', updatedBy)
   .single();

 if (!updater || (updater.role !== 'owner' && updater.role !== 'admin')) {
   throw new Error('Insufficient permissions to update team member role');
 }

 const { data, error } = await supabase
   .from('team_members')
   .update({ role: newRole })
   .eq('team_id', teamId)
   .eq('id', memberId)
   .select()
   .single();

 if (error) throw error;
 return data;
};

// Remove team member
export const removeTeamMember = async (
 teamId: string,
 memberId: string,
 removedBy: string
) => {
 // Check if remover has permission (must be owner)
 const { data: remover } = await supabase
   .from('team_members')
   .select('role')
   .eq('team_id', teamId)
   .eq('user_id', removedBy)
   .single();

 if (!remover || remover.role !== 'owner') {
   throw new Error('Only team owner can remove members');
 }

 const { error } = await supabase
   .from('team_members')
   .delete()
   .eq('team_id', teamId)
   .eq('id', memberId);

 if (error) throw error;
};

// Check if user is team owner
export const isTeamOwner = async (userId: string, teamId: string): Promise<boolean> => {
 // If teamId equals userId, they are the owner (solo account)
 if (teamId === userId) return true;

 const { data } = await supabase
   .from('team_members')
   .select('role')
   .eq('team_id', teamId)
   .eq('user_id', userId)
   .eq('role', 'owner')
   .maybeSingle();

 return !!data;
};

// Check if user is team admin or owner
export const isTeamAdmin = async (userId: string, teamId: string): Promise<boolean> => {
 // If teamId equals userId, they are the owner (solo account)
 if (teamId === userId) return true;

 const { data } = await supabase
   .from('team_members')
   .select('role')
   .eq('team_id', teamId)
   .eq('user_id', userId)
   .in('role', ['owner', 'admin'])
   .maybeSingle();

 return !!data;
};

// Export all other functions from the original database.ts that don't need team awareness
export * from './database';