// src/services/notifications.ts

import { supabase } from './supabaseClient';
import { Notification, NotificationType, NotificationPriority } from '../types/notification.types';

// Process email queue - call this after creating notifications or periodically
export const processEmailQueue = async () => {
  try {
    // Get pending emails
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('notification_email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching email queue:', fetchError);
      return;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return;
    }

    // Process each pending email
    for (const emailRecord of pendingEmails) {
      try {
        // Update attempt count
        await supabase
          .from('notification_email_queue')
          .update({ 
            attempts: emailRecord.attempts + 1,
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', emailRecord.id);

        // Call edge function to send email
        const { data, error } = await supabase.functions.invoke('send-notification-email', {
          body: { notification_id: emailRecord.notification_id }
        });

        if (error) throw error;

        // Mark as sent
        await supabase
          .from('notification_email_queue')
          .update({ status: 'sent' })
          .eq('id', emailRecord.id);

        console.log('Email sent successfully for notification:', emailRecord.notification_id);
      } catch (error: any) {
        console.error('Error sending email:', error);
        
        // Mark as failed if max attempts reached
        if (emailRecord.attempts >= 2) {
          await supabase
            .from('notification_email_queue')
            .update({ 
              status: 'failed',
              error_message: error.message || 'Unknown error'
            })
            .eq('id', emailRecord.id);
        }
      }
    }
  } catch (error) {
    console.error('Error processing email queue:', error);
  }
};

// Fetch all notifications for a user
export const getNotifications = async (userId: string, limit = 50, offset = 0) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data as Notification[];
};

// Fetch unread notifications count
export const getUnreadNotificationsCount = async (userId: string) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
};

// Mark a notification as read
export const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId
  });

  if (error) throw error;
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async () => {
  const { data, error } = await supabase.rpc('mark_all_notifications_read');

  if (error) throw error;
  return data;
};

// Delete a notification
export const deleteNotification = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
};

// Delete all read notifications
export const deleteReadNotifications = async (userId: string) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('is_read', true);

  if (error) throw error;
};

// Create a notification (for internal use)
export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    actionUrl?: string;
    actionLabel?: string;
    metadata?: Record<string, any>;
    priority?: NotificationPriority;
  }
) => {
  const { data, error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_action_url: options?.actionUrl || null,
    p_action_label: options?.actionLabel || 'View',
    p_metadata: options?.metadata || {},
    p_priority: options?.priority || 'normal'
  });

  if (error) throw error;
  return data;
};

// Subscribe to real-time notifications
export const subscribeToNotifications = (
  userId: string,
  callback: (notification: Notification) => void
) => {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload.new as Notification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Get notification statistics
export const getNotificationStats = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('type, is_read')
    .eq('user_id', userId);

  if (error) throw error;

  const stats = {
    total: data.length,
    unread: data.filter(n => !n.is_read).length,
    byType: {} as Record<NotificationType, number>
  };

  data.forEach(notification => {
    stats.byType[notification.type as NotificationType] = 
      (stats.byType[notification.type as NotificationType] || 0) + 1;
  });

  return stats;
};
// Add this function to src/services/notifications.ts
export const createWelcomeNotification = async (userId: string, userDetails: {
  firstName?: string;
  lastName?: string;
  email: string;
  companyName?: string;
}) => {
  try {
    const userName = userDetails.firstName ? 
      `${userDetails.firstName}${userDetails.lastName ? ' ' + userDetails.lastName : ''}` : 
      userDetails.email.split('@')[0];

    // Create the welcome notification
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        type: 'welcome',
        title: `Welcome to Smart CFO, ${userName}! 🎉`,
        message: `We're thrilled to have you on board! Your Smart CFO account is ready, and we're here to help you take control of your finances with intelligent insights and streamlined financial management.`,
        action_url: '/dashboard',
        action_label: 'Explore Dashboard',
        metadata: {
          user_name: userName,
          company_name: userDetails.companyName,
          email: userDetails.email,
          welcome_step: 'account_created'
        },
        priority: 'normal',
        is_read: false
      }])
      .select()
      .single();

    if (notificationError) {
      console.error('Error creating welcome notification:', notificationError);
      return;
    }

    // Queue the welcome email to be sent
    const { error: queueError } = await supabase
      .from('notification_email_queue')
      .insert([{
        notification_id: notification.id,
        status: 'pending',
        attempts: 0,
        created_at: new Date().toISOString()
      }]);

    if (queueError) {
      console.error('Error queueing welcome email:', queueError);
    }

    // Process email queue immediately for welcome emails
    await processEmailQueue();

    console.log('Welcome notification created and email queued successfully');
  } catch (error) {
    console.error('Error in createWelcomeNotification:', error);
  }
};