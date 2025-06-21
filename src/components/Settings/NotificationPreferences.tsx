// src/components/Settings/NotificationPreferences.tsx

import React, { useState, useEffect } from 'react';
import { Bell, Mail, MessageCircle, Save, Smartphone } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { NotificationType, notificationConfig } from '../../types';

interface NotificationPreference {
  type: NotificationType;
  email: boolean;
  inApp: boolean;
  push: boolean;
}

export const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    // Invoice notifications
    { type: 'invoice_sent', email: true, inApp: true, push: false },
    { type: 'invoice_viewed', email: false, inApp: true, push: false },
    { type: 'invoice_paid', email: true, inApp: true, push: true },
    { type: 'invoice_overdue', email: true, inApp: true, push: true },
    
    // Payment notifications
    { type: 'payment_received', email: true, inApp: true, push: true },
    { type: 'expense_added', email: false, inApp: true, push: false },
    { type: 'budget_exceeded', email: true, inApp: true, push: true },
    
    // Team notifications
    { type: 'team_invited', email: true, inApp: true, push: false },
    { type: 'team_joined', email: true, inApp: true, push: false },
    { type: 'team_removed', email: true, inApp: true, push: false },
    
    // Subscription notifications
    { type: 'subscription_upgraded', email: true, inApp: true, push: false },
    { type: 'subscription_downgraded', email: true, inApp: true, push: true },
    { type: 'subscription_expiring', email: true, inApp: true, push: true },
    
    // System notifications
    { type: 'system_update', email: false, inApp: true, push: false },
    { type: 'feature_announcement', email: true, inApp: true, push: false },
  ]);
  
  const [emailSettings, setEmailSettings] = useState({
    daily_summary: true,
    weekly_report: true,
    instant_notifications: true,
    marketing_emails: false,
  });

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('notification_preferences')
        .eq('user_id', user.id)
        .single();
      
      if (data?.notification_preferences) {
        // Merge saved preferences with defaults
        const savedPrefs = data.notification_preferences;
        if (savedPrefs.preferences) {
          setPreferences(prev => prev.map(pref => ({
            ...pref,
            ...(savedPrefs.preferences[pref.type] || {})
          })));
        }
        if (savedPrefs.emailSettings) {
          setEmailSettings(prev => ({ ...prev, ...savedPrefs.emailSettings }));
        }
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    setSuccess(false);
    
    try {
      // Convert preferences array to object
      const prefsObject = preferences.reduce((acc, pref) => {
        acc[pref.type] = {
          email: pref.email,
          inApp: pref.inApp,
          push: pref.push
        };
        return acc;
      }, {} as Record<NotificationType, Omit<NotificationPreference, 'type'>>);
      
      const { error } = await supabase
        .from('user_settings')
        .update({
          notification_preferences: {
            preferences: prefsObject,
            emailSettings
          }
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving preferences:', err);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (type: NotificationType, channel: 'email' | 'inApp' | 'push', value: boolean) => {
    setPreferences(prev => prev.map(pref => 
      pref.type === type ? { ...pref, [channel]: value } : pref
    ));
  };

  const toggleAllInCategory = (category: string, channel: 'email' | 'inApp' | 'push') => {
    const categoryTypes = preferences
      .filter(pref => pref.type.startsWith(category))
      .map(pref => pref.type);
    
    const allEnabled = categoryTypes.every(type => 
      preferences.find(p => p.type === type)?.[channel]
    );
    
    setPreferences(prev => prev.map(pref => 
      categoryTypes.includes(pref.type) ? { ...pref, [channel]: !allEnabled } : pref
    ));
  };

  const groupedPreferences = {
    'Invoice Notifications': preferences.filter(p => p.type.startsWith('invoice')),
    'Financial Notifications': preferences.filter(p => 
      p.type.startsWith('payment') || p.type.startsWith('expense') || p.type.startsWith('budget')
    ),
    'Team Notifications': preferences.filter(p => p.type.startsWith('team')),
    'Subscription Notifications': preferences.filter(p => p.type.startsWith('subscription')),
    'System Notifications': preferences.filter(p => 
      p.type.startsWith('system') || p.type.startsWith('feature')
    ),
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Notification Preferences</h2>
      
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          Preferences saved successfully!
        </div>
      )}

      {/* Email Settings */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Settings
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Daily Summary</span>
            <input
              type="checkbox"
              checked={emailSettings.daily_summary}
              onChange={(e) => setEmailSettings({ ...emailSettings, daily_summary: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Weekly Reports</span>
            <input
              type="checkbox"
              checked={emailSettings.weekly_report}
              onChange={(e) => setEmailSettings({ ...emailSettings, weekly_report: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Instant Notifications</span>
            <input
              type="checkbox"
              checked={emailSettings.instant_notifications}
              onChange={(e) => setEmailSettings({ ...emailSettings, instant_notifications: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Marketing & Updates</span>
            <input
              type="checkbox"
              checked={emailSettings.marketing_emails}
              onChange={(e) => setEmailSettings({ ...emailSettings, marketing_emails: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
            />
          </label>
        </div>
      </div>

      {/* Notification Types */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Types
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Choose how you want to receive different types of notifications
          </p>
        </div>

        {/* Headers */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center">
            <div className="flex-1"></div>
            <div className="flex gap-8 pr-4">
              <div className="w-16 text-center text-sm font-medium text-gray-700 flex items-center justify-center gap-1">
                <Mail className="h-4 w-4" />
                Email
              </div>
              <div className="w-16 text-center text-sm font-medium text-gray-700 flex items-center justify-center gap-1">
                <Bell className="h-4 w-4" />
                In-App
              </div>
              <div className="w-16 text-center text-sm font-medium text-gray-700 flex items-center justify-center gap-1">
                <Smartphone className="h-4 w-4" />
                Push
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Preferences */}
        <div className="divide-y divide-gray-200">
          {Object.entries(groupedPreferences).map(([category, prefs]) => (
            <div key={category}>
              <div className="px-6 py-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">{category}</h4>
                  <div className="flex gap-8 pr-4">
                    <button
                      onClick={() => toggleAllInCategory(
                        prefs[0].type.split('_')[0], 
                        'email'
                      )}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Toggle
                    </button>
                    <button
                      onClick={() => toggleAllInCategory(
                        prefs[0].type.split('_')[0], 
                        'inApp'
                      )}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Toggle
                    </button>
                    <button
                      onClick={() => toggleAllInCategory(
                        prefs[0].type.split('_')[0], 
                        'push'
                      )}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Toggle
                    </button>
                  </div>
                </div>
              </div>
              
              {prefs.map((pref) => {
                const config = notificationConfig[pref.type];
                const Icon = (Icons as any)[config.icon] || Bell;
                
                return (
                  <div key={pref.type} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-1.5 rounded ${config.bgColor}`}>
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                        <span className="text-sm text-gray-700">
                          {pref.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      
                      <div className="flex gap-8">
                        <div className="w-16 text-center">
                          <input
                            type="checkbox"
                            checked={pref.email}
                            onChange={(e) => updatePreference(pref.type, 'email', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                          />
                        </div>
                        <div className="w-16 text-center">
                          <input
                            type="checkbox"
                            checked={pref.inApp}
                            onChange={(e) => updatePreference(pref.type, 'inApp', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                          />
                        </div>
                        <div className="w-16 text-center">
                          <input
                            type="checkbox"
                            checked={pref.push}
                            onChange={(e) => updatePreference(pref.type, 'push', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
        >
          {saving ? (
            <span className="inline-flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
};