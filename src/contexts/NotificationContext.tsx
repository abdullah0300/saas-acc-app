// src/contexts/NotificationContext.tsx

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { Notification } from '../types/notification.types';
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  subscribeToNotifications
} from '../services/notifications';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [notificationsList, count] = await Promise.all([
        getNotifications(user.id),
        getUnreadNotificationsCount(user.id)
      ]);
      
      setNotifications(notificationsList);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }, []);

  // Delete notification
  const handleDeleteNotification = useCallback(async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      
      setNotifications(prev => {
        const notification = prev.find(n => n.id === notificationId);
        if (notification && !notification.is_read) {
          setUnreadCount(count => Math.max(0, count - 1));
        }
        return prev.filter(n => n.id !== notificationId);
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }, []);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications(user.id, (notification) => {
      setNotifications(prev => [notification, ...prev]);
      if (!notification.is_read) {
        setUnreadCount(prev => prev + 1);
      }
      
      // Show browser notification if permitted
      if ('Notification' in window && window.Notification.permission === 'granted') {
        new window.Notification(notification.title, {
          body: notification.message,
          icon: '/logo192.png', // Add your app icon
          tag: notification.id,
        });
      }
    });

    return unsubscribe;
  }, [user]);

  // Load notifications on mount and user change
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && window.Notification.permission === 'default') {
      window.Notification.requestPermission();
    }
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification: handleDeleteNotification,
    refreshNotifications: loadNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};