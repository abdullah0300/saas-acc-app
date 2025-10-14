// src/components/Settings/DataProtection/ConsentManagement.tsx
// 🔴 GDPR Article 7: Conditions for Consent

import React, { useState, useEffect } from "react";
import { CheckCircle, Info, Shield, X, Clock } from "lucide-react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../contexts/AuthContext";
import { format, parseISO } from "date-fns";

interface Consent {
  id: string;
  consent_type: string;
  version: string;
  granted: boolean;
  granted_at: string;
  withdrawn_at?: string;
}

export const ConsentManagement: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [preferences, setPreferences] = useState({
    analytics: false,
    marketing_email: false,
  });

  useEffect(() => {
    if (user?.id) {
      loadConsents();
    }
  }, [user?.id]);

  const loadConsents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', user?.id)
        .order('granted_at', { ascending: false });

      if (error) throw error;

      setConsents(data || []);

      // Get latest consent for each type
      const latestConsents = data?.reduce((acc: any, consent) => {
        if (!acc[consent.consent_type] || new Date(consent.granted_at) > new Date(acc[consent.consent_type].granted_at)) {
          acc[consent.consent_type] = consent;
        }
        return acc;
      }, {});

      setPreferences({
        analytics: latestConsents?.analytics?.granted && !latestConsents?.analytics?.withdrawn_at || false,
        marketing_email: latestConsents?.marketing_email?.granted && !latestConsents?.marketing_email?.withdrawn_at || false,
      });
    } catch (error) {
      console.error('Error loading consents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleConsent = async (type: 'analytics' | 'marketing_email', value: boolean) => {
    try {
      const now = new Date().toISOString();

      if (value) {
        // Grant consent
        await supabase.from('user_consents').insert({
          user_id: user?.id,
          consent_type: type,
          version: '1.0',
          granted: true,
          granted_at: now,
        });
      } else {
        // Withdraw consent
        const latestConsent = consents.find(
          c => c.consent_type === type && c.granted && !c.withdrawn_at
        );

        if (latestConsent) {
          await supabase
            .from('user_consents')
            .update({ withdrawn_at: now })
            .eq('id', latestConsent.id);
        }

        // Insert new withdrawn consent record
        await supabase.from('user_consents').insert({
          user_id: user?.id,
          consent_type: type,
          version: '1.0',
          granted: false,
          granted_at: now,
        });
      }

      // Log in audit trail
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: value ? 'grant' : 'withdraw',
        entity_type: 'consent',
        entity_name: type,
        metadata: {
          consent_type: type,
          granted: value,
          timestamp: now,
        },
      });

      // Update local state
      setPreferences({ ...preferences, [type]: value });

      // Reload consents
      await loadConsents();
    } catch (error: any) {
      console.error('Error updating consent:', error);
      alert('Error updating consent: ' + error.message);
    }
  };

  const getConsentHistory = (type: string) => {
    return consents
      .filter(c => c.consent_type === type)
      .sort((a, b) => new Date(b.granted_at).getTime() - new Date(a.granted_at).getTime())
      .slice(0, 5); // Last 5 changes
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h2 className="text-xl font-semibold text-gray-900">Consent Management</h2>
        <p className="mt-2 text-sm text-gray-600">
          Manage your consent preferences for data processing activities.
        </p>
      </div>

      {/* GDPR Info */}
      <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
        <div className="flex">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Your Rights (GDPR Article 7)</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>You can withdraw consent at any time</li>
                <li>Withdrawal does not affect the lawfulness of prior processing</li>
                <li>It must be as easy to withdraw as it was to give consent</li>
                <li>We keep a record of all consent changes for compliance</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Consent Preferences */}
      <div className="space-y-4">
        {/* Analytics Consent */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <Shield className="h-5 w-5 text-purple-600 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">Analytics & Performance</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Allow us to collect anonymous usage data to improve our service. This helps us understand
                how you use SmartCFO and identify areas for improvement.
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <p><strong>We collect:</strong> Page views, feature usage, error reports</p>
                <p><strong>We do NOT collect:</strong> Personal data, financial information, passwords</p>
              </div>
            </div>
            <div className="ml-6">
              <button
                onClick={() => handleToggleConsent('analytics', !preferences.analytics)}
                className={`w-16 h-8 rounded-full transition-colors flex items-center ${
                  preferences.analytics ? 'bg-green-600 justify-end' : 'bg-gray-300 justify-start'
                } px-1`}
              >
                <div className="w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                  {preferences.analytics ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>
              <p className="text-xs text-center mt-1 text-gray-500">
                {preferences.analytics ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>

          {/* Analytics History */}
          {getConsentHistory('analytics').length > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                Recent Changes
              </h4>
              <div className="space-y-2">
                {getConsentHistory('analytics').map((consent) => (
                  <div key={consent.id} className="text-xs text-gray-600 flex items-center">
                    {consent.granted && !consent.withdrawn_at ? (
                      <CheckCircle className="h-3 w-3 text-green-600 mr-2" />
                    ) : (
                      <X className="h-3 w-3 text-red-600 mr-2" />
                    )}
                    <span>
                      {consent.granted && !consent.withdrawn_at ? 'Granted' : 'Withdrawn'} on{' '}
                      {format(parseISO(consent.withdrawn_at || consent.granted_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Marketing Consent */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <Shield className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">Marketing Communications</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Receive updates about new features, tips, and special offers via email. You can unsubscribe
                at any time by clicking the link in our emails.
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <p><strong>We send:</strong> Product updates, feature announcements, educational content</p>
                <p><strong>Frequency:</strong> Maximum 2 emails per week</p>
              </div>
            </div>
            <div className="ml-6">
              <button
                onClick={() => handleToggleConsent('marketing_email', !preferences.marketing_email)}
                className={`w-16 h-8 rounded-full transition-colors flex items-center ${
                  preferences.marketing_email ? 'bg-green-600 justify-end' : 'bg-gray-300 justify-start'
                } px-1`}
              >
                <div className="w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                  {preferences.marketing_email ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>
              <p className="text-xs text-center mt-1 text-gray-500">
                {preferences.marketing_email ? 'Subscribed' : 'Unsubscribed'}
              </p>
            </div>
          </div>

          {/* Marketing History */}
          {getConsentHistory('marketing_email').length > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                Recent Changes
              </h4>
              <div className="space-y-2">
                {getConsentHistory('marketing_email').map((consent) => (
                  <div key={consent.id} className="text-xs text-gray-600 flex items-center">
                    {consent.granted && !consent.withdrawn_at ? (
                      <CheckCircle className="h-3 w-3 text-green-600 mr-2" />
                    ) : (
                      <X className="h-3 w-3 text-red-600 mr-2" />
                    )}
                    <span>
                      {consent.granted && !consent.withdrawn_at ? 'Subscribed' : 'Unsubscribed'} on{' '}
                      {format(parseISO(consent.withdrawn_at || consent.granted_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Always Active */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Always Active (Cannot Be Disabled)</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Essential Cookies:</strong> Required for authentication, security, and core functionality
            </div>
          </div>
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Legal Processing:</strong> Data required for contract performance and legal obligations (e.g., tax records)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
