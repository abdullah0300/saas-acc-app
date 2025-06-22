// src/types/notification.types.ts

export type NotificationType = 
  | 'invoice_sent' 
  | 'invoice_viewed' 
  | 'invoice_paid' 
  | 'invoice_overdue'
  | 'invoice_generated'  // NEW TYPE
  | 'payment_received' 
  | 'expense_added' 
  | 'budget_exceeded'
  | 'team_invited' 
  | 'team_joined' 
  | 'team_removed'
  | 'subscription_upgraded' 
  | 'subscription_downgraded' 
  | 'subscription_expiring'
  | 'system_update' 
  | 'feature_announcement';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_url?: string;
  action_label?: string;
  metadata?: Record<string, any>;
  priority: NotificationPriority;
  is_read: boolean;
  created_at: string;
  read_at?: string;
  expires_at?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
}

// Icon and color mappings for notification types
export const notificationConfig: Record<NotificationType, {
  icon: string;
  color: string;
  bgColor: string;
}> = {
  invoice_sent: { icon: 'Send', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  invoice_viewed: { icon: 'Eye', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  invoice_paid: { icon: 'CheckCircle', color: 'text-green-600', bgColor: 'bg-green-100' },
  invoice_overdue: { icon: 'AlertCircle', color: 'text-red-600', bgColor: 'bg-red-100' },
  invoice_generated: { icon: 'RefreshCw', color: 'text-blue-600', bgColor: 'bg-blue-100' },  // NEW CONFIG
  payment_received: { icon: 'DollarSign', color: 'text-green-600', bgColor: 'bg-green-100' },
  expense_added: { icon: 'Receipt', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  budget_exceeded: { icon: 'TrendingUp', color: 'text-red-600', bgColor: 'bg-red-100' },
  team_invited: { icon: 'UserPlus', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  team_joined: { icon: 'Users', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  team_removed: { icon: 'UserMinus', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  subscription_upgraded: { icon: 'Star', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  subscription_downgraded: { icon: 'TrendingDown', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  subscription_expiring: { icon: 'Clock', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  system_update: { icon: 'Info', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  feature_announcement: { icon: 'Sparkles', color: 'text-purple-600', bgColor: 'bg-purple-100' }
};