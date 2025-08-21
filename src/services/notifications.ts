// src/services/notifications.ts

import { supabase } from './supabaseClient';
import { Notification, NotificationType, NotificationPriority } from '../types/notification.types';

// Currency symbols mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  PKR: 'Rs',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  NGN: '₦',
  BRL: 'R$',
  AED: 'د.إ'
};

// Format currency helper function
const formatCurrencyAmount = (amount: number, currency: string = 'USD'): string => {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const absAmount = Math.abs(amount); // Handle negative amounts properly
  
  switch(currency) {
    case 'EUR':
      return `${absAmount.toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} ${symbol}`;
    case 'JPY':
      return `${symbol}${Math.round(absAmount).toLocaleString()}`;
    case 'INR':
    case 'PKR':
      return `${symbol} ${absAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    case 'AED':
    case 'NGN':
      return `${symbol} ${absAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    default:
      return `${symbol}${absAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
  }
};

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

// Create a notification (for internal use) - UPDATED WITH CURRENCY FORMATTING
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
  try {
    // Fetch user's base currency settings
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('base_currency')
      .eq('user_id', userId)
      .single();

    const baseCurrency = userSettings?.base_currency || 'USD';

    // Format the message with proper currency
    let formattedMessage = message;
    
    // Handle special cases for credit notes (negative amounts)
    if (type === 'credit_note_applied' || type === 'credit_note_issued' || type === 'credit_note_created') {
      if (options?.metadata?.amount !== undefined) {
        const amount = Math.abs(options.metadata.amount); // Always show positive for credit notes
        const currency = options.metadata.currency || baseCurrency;
        const formattedAmount = formatCurrencyAmount(amount, currency);
        
        // Replace any placeholder or dollar amounts
        formattedMessage = message
          .replace(/\$-?\d+[\d,]*\.?\d*/g, formattedAmount)
          .replace('{amount}', formattedAmount);
      }
    } 
    // Handle payment notifications (check for refunds)
    else if (type === 'payment_received' && options?.metadata?.is_refund) {
      if (options?.metadata?.amount !== undefined) {
        const amount = Math.abs(options.metadata.amount); // Show positive for refunds
        const currency = options.metadata.currency || baseCurrency;
        const formattedAmount = formatCurrencyAmount(amount, currency);
        
        formattedMessage = message
          .replace(/\$-?\d+[\d,]*\.?\d*/g, formattedAmount)
          .replace('{amount}', formattedAmount);
      }
    }
    // Handle regular notifications with amounts
    else if (options?.metadata?.amount !== undefined) {
      const amount = options.metadata.amount;
      const currency = options.metadata.currency || baseCurrency;
      const formattedAmount = formatCurrencyAmount(amount, currency);
      
      // Replace dollar signs and amount placeholders
      formattedMessage = message
        .replace(/\$-?\d+[\d,]*\.?\d*/g, formattedAmount)
        .replace('{amount}', formattedAmount);
    }

    // Replace any remaining dollar signs with base currency symbol
    const baseSymbol = CURRENCY_SYMBOLS[baseCurrency] || baseCurrency;
    formattedMessage = formattedMessage.replace(/\$/g, baseSymbol);

    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: formattedMessage,
      p_action_url: options?.actionUrl || null,
      p_action_label: options?.actionLabel || 'View',
      p_metadata: {
        ...options?.metadata,
        user_base_currency: baseCurrency,
        formatted_at_creation: true
      },
      p_priority: options?.priority || 'normal'
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
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

// Create welcome notification
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

    // Get user's base currency for welcome message
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('base_currency')
      .eq('user_id', userId)
      .single();

    const baseCurrency = userSettings?.base_currency || 'USD';

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
          welcome_step: 'account_created',
          user_base_currency: baseCurrency
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

// Create credit note notification - NEW FUNCTION
export const createCreditNoteNotification = async (
  userId: string,
  creditNoteData: {
    credit_note_number: string;
    invoice_number?: string;
    amount: number;
    currency: string;
    client_name?: string;
    reason?: string;
    credit_note_id: string;
    action: 'created' | 'issued' | 'applied';
  }
) => {
  const { action, ...data } = creditNoteData;
  const amount = Math.abs(data.amount); // Always positive for display
  
  let title = '';
  let message = '';
  let type: NotificationType;
  
  switch (action) {
    case 'created':
      type = 'credit_note_created';
      title = `Credit Note ${data.credit_note_number} Created`;
      message = `Credit note for {amount} has been created${data.invoice_number ? ` for invoice ${data.invoice_number}` : ''}`;
      break;
    
    case 'issued':
      type = 'credit_note_issued';
      title = `Credit Note ${data.credit_note_number} Issued`;
      message = `Credit note for {amount} has been issued to ${data.client_name || 'client'}`;
      break;
    
    case 'applied':
      type = 'credit_note_applied';
      title = `Credit Note Applied to Income`;
      message = `Credit note ${data.credit_note_number} for {amount} has been applied as a refund`;
      break;
    
    default:
      type = 'credit_note_created';
      title = `Credit Note Activity`;
      message = `Credit note ${data.credit_note_number} has been updated`;
  }
  
  return createNotification(userId, type, title, message, {
    actionUrl: `/credit-notes/${data.credit_note_id}`,
    actionLabel: 'View Credit Note',
    metadata: {
      ...data,
      amount: amount, // Positive amount for display
      is_credit_note: true
    },
    priority: action === 'applied' ? 'high' : 'normal'
  });
};

// Create invoice notification - NEW HELPER FUNCTION
export const createInvoiceNotification = async (
  userId: string,
  invoiceData: {
    invoice_id: string;
    invoice_number: string;
    amount: number;
    currency: string;
    client_name?: string;
    action: 'sent' | 'viewed' | 'paid' | 'overdue';
  }
) => {
  const { action, ...data } = invoiceData;
  
  const typeMap: Record<string, NotificationType> = {
    sent: 'invoice_sent',
    viewed: 'invoice_viewed',
    paid: 'invoice_paid',
    overdue: 'invoice_overdue'
  };
  
  const titleMap = {
    sent: `Invoice ${data.invoice_number} Sent`,
    viewed: `Invoice ${data.invoice_number} Viewed`,
    paid: `Invoice ${data.invoice_number} Paid`,
    overdue: `Invoice ${data.invoice_number} Overdue`
  };
  
  const messageMap = {
    sent: `Invoice for {amount} has been sent to ${data.client_name || 'client'}`,
    viewed: `${data.client_name || 'Client'} has viewed invoice ${data.invoice_number}`,
    paid: `Payment of {amount} received for invoice ${data.invoice_number}`,
    overdue: `Invoice ${data.invoice_number} for {amount} is now overdue`
  };
  
  return createNotification(
    userId,
    typeMap[action],
    titleMap[action],
    messageMap[action],
    {
      actionUrl: `/invoices/${data.invoice_id}`,
      actionLabel: 'View Invoice',
      metadata: data,
      priority: action === 'overdue' ? 'high' : 'normal'
    }
  );
};

// Create payment notification - NEW HELPER FUNCTION  
export const createPaymentNotification = async (
  userId: string,
  paymentData: {
    amount: number;
    currency: string;
    description?: string;
    payment_method?: string;
    reference?: string;
    is_refund?: boolean;
  }
) => {
  // Handle refunds (from credit notes) specially
  if (paymentData.is_refund) {
    const amount = Math.abs(paymentData.amount);
    return createNotification(
      userId,
      'payment_received',
      'Refund Processed',
      `Refund of {amount} has been processed${paymentData.description ? ` for ${paymentData.description}` : ''}`,
      {
        metadata: {
          ...paymentData,
          amount: amount, // Positive for display
          is_refund: true
        },
        priority: 'normal'
      }
    );
  }
  
  return createNotification(
    userId,
    'payment_received',
    'Payment Received',
    `Payment of {amount} received${paymentData.description ? ` for ${paymentData.description}` : ''}`,
    {
      metadata: paymentData,
      priority: 'normal'
    }
  );
};