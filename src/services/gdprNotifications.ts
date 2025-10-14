// src/services/gdprNotifications.ts
// GDPR Phase 2 Notification Helpers

import { supabase } from './supabaseClient';
import { createNotification } from './notifications';
import { NotificationType } from '../types/notification.types';

/**
 * Get all platform admin user IDs
 */
async function getPlatformAdminIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('platform_admins')
    .select('user_id');

  if (error) {
    console.error('Error fetching platform admins:', error);
    return [];
  }

  return data?.map(admin => admin.user_id) || [];
}

/**
 * Send notification to all platform admins
 */
async function notifyPlatformAdmins(
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    actionUrl?: string;
    actionLabel?: string;
    metadata?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }
) {
  const adminIds = await getPlatformAdminIds();

  if (adminIds.length === 0) {
    console.warn('No platform admins found to notify');
    return;
  }

  const promises = adminIds.map(adminId =>
    createNotification(adminId, type, title, message, options)
  );

  try {
    await Promise.all(promises);
    console.log(`Notified ${adminIds.length} platform admin(s)`);
  } catch (error) {
    console.error('Error notifying platform admins:', error);
    throw error;
  }
}

// ====================================
// BREACH NOTIFICATIONS
// ====================================

export async function notifyBreachReported(breachData: {
  incident_id: string;
  breach_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affected_users_count: number;
  detected_at: string;
}) {
  return notifyPlatformAdmins(
    'breach_reported',
    `🚨 Data Breach Reported - ${breachData.incident_id}`,
    `A ${breachData.severity} severity data breach has been detected. Incident ID: ${breachData.incident_id}. You have 72 hours to notify the ICO under GDPR Article 33.`,
    {
      actionUrl: '/settings/breach-management',
      actionLabel: 'View Breach Dashboard',
      metadata: breachData,
      priority: breachData.severity === 'critical' || breachData.severity === 'high' ? 'urgent' : 'high'
    }
  );
}

export async function notifyBreachDeadlineWarning(breachData: {
  incident_id: string;
  breach_type: string;
  severity: string;
  hours_remaining: number;
  affected_users_count?: number;
}) {
  return notifyPlatformAdmins(
    'breach_deadline_warning',
    `⚠️ URGENT: Breach ${breachData.incident_id} - ${Math.round(breachData.hours_remaining)} hours to ICO deadline`,
    `URGENT: Breach incident ${breachData.incident_id} has less than 24 hours remaining before the 72-hour ICO notification deadline. Immediate action required.`,
    {
      actionUrl: '/settings/breach-management',
      actionLabel: 'View Breach Details',
      metadata: breachData,
      priority: 'urgent'
    }
  );
}

export async function notifyBreachDeadlinePassed(breachData: {
  incident_id: string;
  breach_type: string;
  severity: string;
  hours_overdue: number;
}) {
  return notifyPlatformAdmins(
    'breach_deadline_passed',
    `🔴 CRITICAL: Breach ${breachData.incident_id} - ICO notification deadline MISSED`,
    `CRITICAL: The 72-hour ICO notification deadline for breach ${breachData.incident_id} has been exceeded by ${Math.round(breachData.hours_overdue)} hours. This is a serious GDPR violation.`,
    {
      actionUrl: '/settings/breach-management',
      actionLabel: 'Take Immediate Action',
      metadata: breachData,
      priority: 'urgent'
    }
  );
}

export async function notifyCustomerBreach(
  userId: string,
  breachData: {
    incident_description: string;
    data_types_affected: string;
    recommended_actions: string;
  }
) {
  return createNotification(
    userId,
    'breach_notification_customer',
    'Important Security Notice',
    'We are writing to inform you of a security incident that may affect your personal data.',
    {
      actionUrl: '/settings/data-protection',
      actionLabel: 'View Details',
      metadata: breachData,
      priority: 'urgent'
    }
  );
}

// ====================================
// DATA RETENTION NOTIFICATIONS
// ====================================

export async function notifyRetentionCleanupCompleted(cleanupData: {
  records_deleted: number;
  records_anonymized: number;
  execution_time: string;
  executed_at: string;
}) {
  return notifyPlatformAdmins(
    'retention_cleanup_completed',
    `✅ Data Retention Cleanup Completed`,
    `Automated data retention cleanup completed successfully. ${cleanupData.records_deleted} records deleted, ${cleanupData.records_anonymized} records anonymized.`,
    {
      actionUrl: '/settings/retention',
      actionLabel: 'View Retention Dashboard',
      metadata: cleanupData,
      priority: 'normal'
    }
  );
}

export async function notifyRetentionCleanupFailed(errorData: {
  error_message: string;
  failed_at: string;
}) {
  return notifyPlatformAdmins(
    'retention_cleanup_failed',
    `❌ Data Retention Cleanup Failed`,
    `The automated data retention cleanup job has failed. Error: ${errorData.error_message}`,
    {
      actionUrl: '/settings/retention',
      actionLabel: 'View Error Details',
      metadata: errorData,
      priority: 'high'
    }
  );
}

// ====================================
// SUSPICIOUS ACTIVITY NOTIFICATIONS
// ====================================

export async function notifySuspiciousActivity(activityData: {
  pattern: string;
  user_email: string;
  action_count: number;
  detected_at: string;
}) {
  return notifyPlatformAdmins(
    'suspicious_activity_detected',
    `⚠️ Suspicious Activity Detected - ${activityData.pattern}`,
    `Suspicious pattern "${activityData.pattern}" detected for user ${activityData.user_email}. ${activityData.action_count} actions flagged.`,
    {
      actionUrl: '/settings/audit-analytics',
      actionLabel: 'View Audit Analytics',
      metadata: activityData,
      priority: 'high'
    }
  );
}

// ====================================
// ROPA NOTIFICATIONS
// ====================================

export async function notifyRoPAEntryAdded(ropaData: {
  activity_name: string;
  legal_basis: string;
  added_by: string;
}) {
  return notifyPlatformAdmins(
    'ropa_entry_added',
    `New Processing Activity Added - ${ropaData.activity_name}`,
    `A new processing activity "${ropaData.activity_name}" has been added to the RoPA register with legal basis: ${ropaData.legal_basis}.`,
    {
      actionUrl: '/settings/ropa',
      actionLabel: 'View RoPA Register',
      metadata: ropaData,
      priority: 'normal'
    }
  );
}

// ====================================
// DATA EXPORT & DELETION NOTIFICATIONS
// ====================================

export async function notifyDataExportRequested(requestData: {
  customer_email: string;
  requested_at: string;
  request_id: string;
}) {
  return notifyPlatformAdmins(
    'customer_data_export_requested',
    `Customer Data Export Requested`,
    `Customer ${requestData.customer_email} has requested a data export under GDPR Article 15. You have 30 days to fulfill this request.`,
    {
      actionUrl: '/settings/data-protection',
      actionLabel: 'View Request',
      metadata: requestData,
      priority: 'normal'
    }
  );
}

export async function notifyDataExportReady(
  userId: string,
  exportData: {
    file_size: string;
    expires_at: string;
    download_url: string;
  }
) {
  return createNotification(
    userId,
    'data_export_ready',
    'Your Data Export is Ready',
    `Your requested data export is now available for download. The download link will expire on ${new Date(exportData.expires_at).toLocaleDateString()}.`,
    {
      actionUrl: exportData.download_url,
      actionLabel: 'Download Your Data',
      metadata: exportData,
      priority: 'normal'
    }
  );
}

export async function notifyAccountDeletionRequested(requestData: {
  customer_email: string;
  requested_at: string;
  request_id: string;
}) {
  return notifyPlatformAdmins(
    'customer_account_deletion_requested',
    `⚠️ Customer Account Deletion Requested`,
    `Customer ${requestData.customer_email} has requested account deletion under GDPR Article 17 (Right to Erasure).`,
    {
      actionUrl: '/settings/data-protection',
      actionLabel: 'View Request',
      metadata: requestData,
      priority: 'high'
    }
  );
}

export async function notifyAccountDeletionScheduled(
  userId: string,
  deletionData: {
    deletion_date: string;
    days_remaining: number;
  }
) {
  return createNotification(
    userId,
    'account_deletion_scheduled',
    'Your Account Deletion is Scheduled',
    `Your account deletion has been scheduled for ${new Date(deletionData.deletion_date).toLocaleDateString()}. You have ${deletionData.days_remaining} days to cancel if you change your mind.`,
    {
      actionUrl: '/settings/data-protection',
      actionLabel: 'Manage Request',
      metadata: deletionData,
      priority: 'high'
    }
  );
}
