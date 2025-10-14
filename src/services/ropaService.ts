// src/services/ropaService.ts
// 🔴 GDPR Article 30: Records of Processing Activities (RoPA) Service

import { supabase } from './supabaseClient';

export interface ProcessingActivity {
  id?: string;
  user_id?: string;
  name: string;
  purpose: string;
  legal_basis:
    | 'consent'
    | 'contract'
    | 'legal_obligation'
    | 'vital_interests'
    | 'public_task'
    | 'legitimate_interests';
  data_categories: string[];
  data_subjects: string[];
  recipients?: string[];
  retention_period: string;
  security_measures?: string;
  international_transfers: boolean;
  transfer_safeguards?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get all processing activities for the current user
 */
export async function getAllProcessingActivities(
  userId: string
): Promise<{ data: ProcessingActivity[] | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('processing_activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching processing activities:', error);
    return { data: null, error };
  }
}

/**
 * Get a single processing activity
 */
export async function getProcessingActivity(
  id: string
): Promise<{ data: ProcessingActivity | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('processing_activities')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching processing activity:', error);
    return { data: null, error };
  }
}

/**
 * Create a new processing activity
 */
export async function createProcessingActivity(
  activity: Omit<ProcessingActivity, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: ProcessingActivity | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('processing_activities')
      .insert(activity)
      .select()
      .single();

    if (error) throw error;

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      user_id: activity.user_id,
      action: 'create',
      entity_type: 'processing_activity',
      entity_name: activity.name,
      metadata: { purpose: activity.purpose },
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error creating processing activity:', error);
    return { data: null, error };
  }
}

/**
 * Update a processing activity
 */
export async function updateProcessingActivity(
  id: string,
  updates: Partial<ProcessingActivity>
): Promise<{ data: ProcessingActivity | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('processing_activities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      action: 'update',
      entity_type: 'processing_activity',
      entity_id: id,
      entity_name: data.name,
      metadata: updates,
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error updating processing activity:', error);
    return { data: null, error };
  }
}

/**
 * Delete a processing activity
 */
export async function deleteProcessingActivity(
  id: string
): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('processing_activities')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      action: 'delete',
      entity_type: 'processing_activity',
      entity_id: id,
    });

    return { error: null };
  } catch (error) {
    console.error('Error deleting processing activity:', error);
    return { error };
  }
}

/**
 * Get pre-populated RoPA templates
 */
export function getRoPATemplates(): ProcessingActivity[] {
  return [
    {
      name: 'Customer Invoicing',
      purpose: 'Creating and managing invoices for customers to facilitate payment processing',
      legal_basis: 'contract',
      data_categories: ['Personal Identification', 'Contact Information', 'Financial Data'],
      data_subjects: ['Customers', 'Clients'],
      recipients: ['Payment Processors (Stripe)', 'Accounting Software'],
      retention_period: '6 years (HMRC requirement)',
      security_measures:
        'Encryption at rest and in transit, access controls, regular backups, secure database with RLS',
      international_transfers: true,
      transfer_safeguards:
        'Standard Contractual Clauses (SCCs) with Stripe, data stored in EU/UK regions',
    },
    {
      name: 'Expense Tracking',
      purpose: 'Recording and managing business expenses for tax and accounting purposes',
      legal_basis: 'legal_obligation',
      data_categories: ['Financial Data', 'Transaction Details', 'Vendor Information'],
      data_subjects: ['Employees', 'Vendors', 'Business Owner'],
      recipients: ['HMRC (tax reporting)', 'External Accountants'],
      retention_period: '6 years (HMRC requirement)',
      security_measures:
        'Encryption, role-based access control, audit logging, secure cloud storage',
      international_transfers: false,
    },
    {
      name: 'User Authentication',
      purpose: 'Managing user accounts and authentication for secure access to the platform',
      legal_basis: 'contract',
      data_categories: ['Personal Identification', 'Authentication Data', 'Login History'],
      data_subjects: ['Platform Users', 'Team Members'],
      recipients: ['Supabase (authentication provider)', 'Email service provider'],
      retention_period: 'Active account + 30 days after deletion',
      security_measures:
        'Password hashing (bcrypt), 2FA optional, session management, rate limiting',
      international_transfers: true,
      transfer_safeguards: 'Data Processing Agreement with Supabase, EU/UK data centers',
    },
    {
      name: 'Marketing Communications',
      purpose: 'Sending product updates, newsletters, and promotional content to subscribers',
      legal_basis: 'consent',
      data_categories: ['Contact Information', 'Usage Preferences', 'Consent Records'],
      data_subjects: ['Newsletter Subscribers', 'Platform Users'],
      recipients: ['Email Marketing Platform', 'Analytics Services'],
      retention_period: 'Until consent withdrawal + 3 years for compliance records',
      security_measures: 'Encrypted storage, consent tracking, unsubscribe mechanism',
      international_transfers: false,
    },
    {
      name: 'Customer Support',
      purpose: 'Providing technical support and responding to customer inquiries',
      legal_basis: 'contract',
      data_categories: ['Contact Information', 'Support Tickets', 'Communication History'],
      data_subjects: ['Customers', 'Platform Users'],
      recipients: ['Support Team Members', 'Ticketing System'],
      retention_period: '3 years after case closure',
      security_measures: 'Access restricted to support staff, encrypted communications',
      international_transfers: false,
    },
  ];
}

/**
 * Export RoPA to CSV
 */
export function exportRoPAToCSV(activities: ProcessingActivity[]): string {
  const headers = [
    'Name',
    'Purpose',
    'Legal Basis',
    'Data Categories',
    'Data Subjects',
    'Recipients',
    'Retention Period',
    'Security Measures',
    'International Transfers',
    'Transfer Safeguards',
  ];

  const rows = activities.map((activity) => [
    activity.name,
    activity.purpose,
    activity.legal_basis,
    activity.data_categories.join('; '),
    activity.data_subjects.join('; '),
    activity.recipients?.join('; ') || 'N/A',
    activity.retention_period,
    activity.security_measures || 'N/A',
    activity.international_transfers ? 'Yes' : 'No',
    activity.transfer_safeguards || 'N/A',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
}

/**
 * Download RoPA as CSV
 */
export function downloadRoPACSV(
  activities: ProcessingActivity[],
  filename: string = 'ropa-register.csv'
): void {
  const csvContent = exportRoPAToCSV(activities);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
