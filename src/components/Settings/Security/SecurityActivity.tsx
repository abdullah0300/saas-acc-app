// src/components/Settings/Security/SecurityActivity.tsx
import React, { useState, useEffect } from 'react';
import { Activity, Monitor, Smartphone, Globe, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { auditService } from '../../../services/auditService';
import { format } from 'date-fns';

interface SecurityEvent {
  id: string;
  action: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
}

export const SecurityActivity: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'login' | 'security'>('all');

  useEffect(() => {
    if (user) {
      loadSecurityEvents();
    }
  }, [user, filter]);

  const loadSecurityEvents = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      let allEvents: SecurityEvent[] = [];
      
      if (filter === 'all' || filter === 'login') {
        // Get login-related events
        const loginEvents = await auditService.getAuditLogs({
          userId: user.id,
          action: 'login' as any,
          limit: 25
        });
        
        const logoutEvents = await auditService.getAuditLogs({
          userId: user.id,
          action: 'logout' as any,
          limit: 25
        });
        
        const failedEvents = await auditService.getAuditLogs({
          userId: user.id,
          action: 'login_failed' as any,
          limit: 25
        });
        
        allEvents = [...allEvents, ...loginEvents, ...logoutEvents, ...failedEvents];
      }
      
      if (filter === 'all' || filter === 'security') {
        // Get security-related events
        const passwordEvents = await auditService.getAuditLogs({
          userId: user.id,
          action: 'password_changed' as any,
          limit: 25
        });
        
        const settingsEvents = await auditService.getAuditLogs({
          userId: user.id,
          action: 'settings_updated' as any,
          entityType: 'user',
          limit: 25
        });
        
        allEvents = [...allEvents, ...passwordEvents, ...settingsEvents];
      }
      
      // Sort by date and limit to 50 most recent
      const sortedEvents = allEvents
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50);
      
      setEvents(sortedEvents);
    } catch (err: any) {
      console.error('Error loading security events:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'logout':
        return <Activity className="h-5 w-5 text-blue-500" />;
      case 'login_failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'password_changed':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'settings_updated':
        return <Activity className="h-5 w-5 text-purple-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getEventTitle = (action: string) => {
    switch (action) {
      case 'login':
        return 'Successful login';
      case 'logout':
        return 'Logged out';
      case 'login_failed':
        return 'Failed login attempt';
      case 'password_changed':
        return 'Password changed';
      case 'settings_updated':
        return 'Security settings updated';
      default:
        return action;
    }
  };

  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) return <Globe className="h-4 w-4" />;
    
    const lowerAgent = userAgent.toLowerCase();
    if (lowerAgent.includes('mobile') || lowerAgent.includes('android') || lowerAgent.includes('iphone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const formatIpAddress = (ip?: string) => {
    if (!ip) return 'Unknown location';
    // In production, you might want to use a geolocation service
    return ip;
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Activity className="h-5 w-5 mr-2 text-gray-400" />
          Security Activity
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Recent security-related activities on your account
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          All Activity
        </button>
        <button
          onClick={() => setFilter('login')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            filter === 'login'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Login Activity
        </button>
        <button
          onClick={() => setFilter('security')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            filter === 'security'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Security Changes
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No security events found
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getEventIcon(event.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {getEventTitle(event.action)}
                  </p>
                  <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center">
                      {getDeviceIcon(event.user_agent)}
                      <span className="ml-1">{formatIpAddress(event.ip_address)}</span>
                    </span>
                    <span>
                      {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  {event.metadata?.entity_name && (
                    <p className="mt-1 text-xs text-gray-600">
                      Changed: {event.metadata.entity_name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            Showing recent {events.length} activities
          </p>
        </div>
      )}
    </div>
  );
};