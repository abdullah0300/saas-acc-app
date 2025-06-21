// src/services/notifications.ts

import { supabase } from './supabaseClient';
import { Notification, NotificationType, NotificationPriority } from '../types';

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