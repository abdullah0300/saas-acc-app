// src/components/Notifications/NotificationBell.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { notificationConfig } from '../../types';
import * as Icons from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
const { formatCurrency, baseCurrency } = useSettings();

// Helper function to format notification messages with proper currency
const formatNotificationMessage = (notification: any) => {
  let message = notification.message;
  
  if (notification.metadata?.amount !== undefined) {
    const amount = notification.metadata.amount;
    const currency = notification.metadata.currency || baseCurrency;
    message = message.replace(/\$[\d,]+\.?\d*/g, () => {
      return formatCurrency(amount, currency);
    });
  } else {
    message = message.replace(/\$[\d,]+\.?\d*/g, (match: string) => {
      const amount = parseFloat(match.replace(/[$,]/g, ''));
      return formatCurrency(amount, baseCurrency);
    });
  }
  
  return message;
};
  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get icon component
  const getIcon = (iconName: string) => {
    const Icon = (Icons as any)[iconName] || Icons.Bell;
    return Icon;
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    if (notification.action_url) {
      setIsOpen(false);
      navigate(notification.action_url);
    }
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-gray-600 hover:text-gray-900 transition-colors p-2"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {recentNotifications.length > 0 ? (
              <>
                {recentNotifications.map((notification) => {
                  const config = notificationConfig[notification.type];
                  const Icon = getIcon(config.icon);
                  
                  return (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.is_read ? 'bg-blue-50 hover:bg-blue-100' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`p-2 rounded-full ${config.bgColor}`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div
                            onClick={() => handleNotificationClick(notification)}
                            className="group"
                          >
                            <p className={`text-sm font-medium text-gray-900 ${
                              !notification.is_read ? 'font-semibold' : ''
                            }`}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                              {formatNotificationMessage(notification)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </span>
                              {notification.action_url && (
                                <span className="text-xs text-blue-600 group-hover:text-blue-700 flex items-center gap-1">
                                  {notification.action_label || 'View'}
                                  <ExternalLink className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {!notification.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="px-4 py-8 text-center">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No notifications yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  We'll notify you when something important happens
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <Link
            to="/notifications"
            className="block px-4 py-3 text-center text-sm font-medium text-blue-600 hover:text-blue-700 border-t border-gray-200 hover:bg-gray-50"
            onClick={() => setIsOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
};