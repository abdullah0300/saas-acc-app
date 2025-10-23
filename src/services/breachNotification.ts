// src/services/breachNotification.ts
// 🔴 GDPR Articles 33 & 34: Data Breach Notification Service

import { supabase } from './supabaseClient';

export interface BreachIncident {
  id?: string;
  incident_id: string;
  detected_at: string;
  breach_type: string;
  affected_users: string[];
  affected_data_types: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ico_notified_at?: string;
  users_notified_at?: string;
  mitigation_steps?: string;
  status: 'investigating' | 'contained' | 'resolved';
}

export interface BreachNotificationEmail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Calculate hours remaining until 72-hour GDPR deadline
 */
export function getHoursUntilDeadline(detectedAt: string): number {
  const detected = new Date(detectedAt);
  const deadline = new Date(detected.getTime() + 72 * 60 * 60 * 1000);
  const now = new Date();
  const hoursRemaining = (deadline.getTime() - now.getTime()) / (60 * 60 * 1000);
  return Math.max(0, hoursRemaining);
}

/**
 * Check if breach notification deadline has passed
 */
export function isDeadlinePassed(detectedAt: string): boolean {
  return getHoursUntilDeadline(detectedAt) === 0;
}

/**
 * Generate breach incident ID
 */
export function generateIncidentId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BREACH-${timestamp}-${random}`;
}

/**
 * Create a new breach incident
 */
export async function createBreachIncident(
  incident: Omit<BreachIncident, 'id' | 'incident_id'>
): Promise<{ data: BreachIncident | null; error: any }> {
  try {
    const incidentId = generateIncidentId();

    const { data, error } = await supabase
      .from('data_breach_logs')
      .insert({
        incident_id: incidentId,
        ...incident,
      })
      .select()
      .single();

    if (error) throw error;

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      action: 'create',
      entity_type: 'breach_incident',
      entity_name: incidentId,
      metadata: {
        severity: incident.severity,
        breach_type: incident.breach_type,
        affected_users_count: incident.affected_users.length,
      },
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error creating breach incident:', error);
    return { data: null, error };
  }
}

/**
 * Update breach incident
 */
export async function updateBreachIncident(
  id: string,
  updates: Partial<BreachIncident>
): Promise<{ data: BreachIncident | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('data_breach_logs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      action: 'update',
      entity_type: 'breach_incident',
      entity_id: id,
      entity_name: data.incident_id,
      metadata: updates,
    });

    return { data, error: null };
  } catch (error) {
    console.error('Error updating breach incident:', error);
    return { data: null, error };
  }
}

/**
 * Mark ICO as notified
 */
export async function markICONotified(
  id: string
): Promise<{ data: BreachIncident | null; error: any }> {
  const now = new Date().toISOString();

  return updateBreachIncident(id, {
    ico_notified_at: now,
  });
}

/**
 * Mark users as notified
 */
export async function markUsersNotified(
  id: string
): Promise<{ data: BreachIncident | null; error: any }> {
  const now = new Date().toISOString();

  return updateBreachIncident(id, {
    users_notified_at: now,
  });
}

/**
 * Generate ICO notification report
 */
export function generateICOReport(incident: BreachIncident): string {
  const detectedDate = new Date(incident.detected_at).toLocaleString('en-GB');

  return `
DATA BREACH NOTIFICATION TO ICO
Incident Reference: ${incident.incident_id}

BREACH DETAILS:
---------------
Detected: ${detectedDate}
Breach Type: ${incident.breach_type}
Severity: ${incident.severity.toUpperCase()}
Status: ${incident.status}

AFFECTED DATA:
--------------
Number of Affected Users: ${incident.affected_users.length}
Data Types Affected: ${incident.affected_data_types.join(', ')}

DESCRIPTION:
------------
${incident.description}

MITIGATION MEASURES:
--------------------
${incident.mitigation_steps || 'Being assessed'}

NOTIFICATION TIMELINE:
---------------------
Detected: ${detectedDate}
ICO Notified: ${incident.ico_notified_at ? new Date(incident.ico_notified_at).toLocaleString('en-GB') : 'Pending'}
Users Notified: ${incident.users_notified_at ? new Date(incident.users_notified_at).toLocaleString('en-GB') : 'Pending'}

This notification is made in accordance with Article 33 of the UK GDPR.

Data Controller: SmartCFO
Contact: privacy@smartcfo.webcraftio.com
  `.trim();
}

/**
 * Generate user notification email template
 */
export function generateUserNotificationEmail(
  incident: BreachIncident,
  userName: string
): BreachNotificationEmail {
  const subject = `Important: Data Security Notification - ${incident.incident_id}`;

  const body = `
Dear ${userName},

We are writing to inform you of a data security incident that may have affected your personal information.

WHAT HAPPENED:
${incident.description}

WHAT INFORMATION WAS INVOLVED:
The following types of data may have been affected:
${incident.affected_data_types.map((type) => `- ${type}`).join('\n')}

WHAT WE ARE DOING:
${incident.mitigation_steps || 'We are taking immediate steps to investigate and secure our systems.'}

We have reported this incident to the Information Commissioner's Office (ICO) as required under UK GDPR Article 33.

WHAT YOU CAN DO:
- Monitor your accounts for any suspicious activity
- Change your password if you suspect unauthorized access
- Be cautious of phishing attempts
- Contact us if you have any concerns

YOUR RIGHTS:
Under UK GDPR, you have the right to:
- Request further information about this incident
- Lodge a complaint with the ICO (ico.org.uk)
- Request access to your personal data

CONTACT US:
If you have any questions or concerns, please contact us:
Email: privacy@smartcfo.webcraftio.com
Phone: [Your phone number]

We sincerely apologize for any inconvenience or concern this may cause. Protecting your data is our top priority, and we are committed to preventing such incidents in the future.

Yours sincerely,
SmartCFO Data Protection Team

Incident Reference: ${incident.incident_id}
Notification Date: ${new Date().toLocaleDateString('en-GB')}
  `.trim();

  return {
    to: '', // Will be filled with actual user email
    subject,
    body,
  };
}

/**
 * Get all breach incidents
 */
export async function getAllBreachIncidents(): Promise<{
  data: BreachIncident[] | null;
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('data_breach_logs')
      .select('*')
      .order('detected_at', { ascending: false });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching breach incidents:', error);
    return { data: null, error };
  }
}

/**
 * Get single breach incident
 */
export async function getBreachIncident(
  id: string
): Promise<{ data: BreachIncident | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('data_breach_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching breach incident:', error);
    return { data: null, error };
  }
}

/**
 * Get incidents requiring urgent action (within 24 hours of deadline)
 */
export async function getUrgentIncidents(): Promise<{
  data: BreachIncident[] | null;
  error: any;
}> {
  try {
    const { data, error } = await supabase
      .from('data_breach_logs')
      .select('*')
      .is('ico_notified_at', null)
      .order('detected_at', { ascending: true });

    if (error) throw error;

    // Filter incidents with less than 24 hours remaining
    const urgentIncidents = data?.filter((incident) => {
      const hoursRemaining = getHoursUntilDeadline(incident.detected_at);
      return hoursRemaining < 24 && hoursRemaining > 0;
    });

    return { data: urgentIncidents || [], error: null };
  } catch (error) {
    console.error('Error fetching urgent incidents:', error);
    return { data: null, error };
  }
}

/**
 * Delete breach incident (admin only)
 */
export async function deleteBreachIncident(id: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase.from('data_breach_logs').delete().eq('id', id);

    if (error) throw error;

    // Log deletion
    await supabase.from('audit_logs').insert({
      action: 'delete',
      entity_type: 'breach_incident',
      entity_id: id,
      metadata: { reason: 'Admin deletion' },
    });

    return { error: null };
  } catch (error) {
    console.error('Error deleting breach incident:', error);
    return { error };
  }
}
