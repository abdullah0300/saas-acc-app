// src/components/Common/CookieConsent.tsx
// 🔴 GDPR Article 6 & 7: Lawful Basis and Consent

import React, { useState, useEffect } from "react";
import { CheckCircle, Cookie, Settings, X } from "lucide-react";
import { supabase } from "../../services/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";

// Extend Window interface for Google Analytics
declare global {
  interface Window {
    gtag?: (
      command: string,
      action: string,
      params: Record<string, string>
    ) => void;
  }
}

interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

export const CookieConsent: React.FC = () => {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    checkConsent();
  }, [user]);

  const checkConsent = async () => {
    // Check localStorage for non-authenticated users
    const localConsent = localStorage.getItem('cookie_consent');

    if (user?.id) {
      // Check database for authenticated users
      const { data: consents } = await supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', user.id)
        .eq('consent_type', 'analytics')
        .eq('granted', true)
        .is('withdrawn_at', null);

      if (!consents || consents.length === 0) {
        // No consent recorded, show banner
        setShowBanner(!localConsent);
      }
    } else {
      // Not logged in, check localStorage
      if (!localConsent) {
        setShowBanner(true);
      }
    }
  };

  const handleAcceptAll = async () => {
    await saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
    });
    setShowBanner(false);
  };

  const handleRejectAll = async () => {
    await saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
    });
    setShowBanner(false);
  };

  const handleSavePreferences = async () => {
    await saveConsent(preferences);
    setShowBanner(false);
    setShowDetails(false);
  };

  const saveConsent = async (prefs: ConsentPreferences) => {
    const now = new Date().toISOString();
    const version = '1.0';

    if (user?.id) {
      // Save to database for authenticated users
      const consents = [];

      // Necessary cookies (always granted)
      consents.push({
        user_id: user.id,
        consent_type: 'terms_of_service',
        version: version,
        granted: true,
        granted_at: now,
      });

      // Analytics consent
      consents.push({
        user_id: user.id,
        consent_type: 'analytics',
        version: version,
        granted: prefs.analytics,
        granted_at: now,
      });

      // Marketing consent
      consents.push({
        user_id: user.id,
        consent_type: 'marketing_email',
        version: version,
        granted: prefs.marketing,
        granted_at: now,
      });

      // Insert consents
      await supabase.from('user_consents').insert(consents);

      // Log in audit trail
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'update',
        entity_type: 'consent',
        entity_name: 'Cookie Consent',
        metadata: {
          analytics: prefs.analytics,
          marketing: prefs.marketing,
          timestamp: now,
        },
      });
    }

    // Also save to localStorage
    localStorage.setItem('cookie_consent', JSON.stringify({
      ...prefs,
      timestamp: now,
      version: version,
    }));

    // Apply preferences
    if (!prefs.analytics) {
      // Disable analytics tracking
      window.gtag?.('consent', 'update', {
        analytics_storage: 'denied'
      });
    } else {
      window.gtag?.('consent', 'update', {
        analytics_storage: 'granted'
      });
    }

    if (!prefs.marketing) {
      // Disable marketing cookies
      window.gtag?.('consent', 'update', {
        ad_storage: 'denied'
      });
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t-2 border-gray-200 shadow-2xl">
      <div className="max-w-7xl mx-auto">
        {!showDetails ? (
          // Simple Banner
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start flex-1">
              <Cookie className="h-8 w-8 text-blue-600 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  We Value Your Privacy
                </h3>
                <p className="text-sm text-gray-600">
                  We use cookies to enhance your experience, analyze site traffic, and for marketing purposes.
                  By clicking "Accept All", you consent to our use of cookies. {' '}
                  <Link to="/privacy" className="text-blue-600 hover:underline">
                    Read our Privacy Policy
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <button
                onClick={handleRejectAll}
                className="flex-1 md:flex-none px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="flex-1 md:flex-none px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center"
              >
                <Settings className="h-4 w-4 mr-2" />
                Customize
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 md:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Accept All
              </button>
            </div>
          </div>
        ) : (
          // Detailed Preferences
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Cookie className="h-6 w-6 text-blue-600 mr-2" />
                Cookie Preferences
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Necessary Cookies */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Strictly Necessary Cookies
                    </h4>
                    <p className="text-sm text-gray-600">
                      Required for the website to function. These cookies enable core functionality such as security,
                      authentication, and session management. Cannot be disabled.
                    </p>
                  </div>
                  <div className="ml-4">
                    <div className="w-12 h-6 bg-blue-600 rounded-full flex items-center justify-end px-1">
                      <div className="w-4 h-4 bg-white rounded-full"></div>
                    </div>
                    <span className="text-xs text-gray-500 mt-1 block">Always On</span>
                  </div>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Analytics & Performance Cookies
                    </h4>
                    <p className="text-sm text-gray-600">
                      Help us understand how visitors interact with our website by collecting anonymous information.
                      This helps us improve our service.
                    </p>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => setPreferences({ ...preferences, analytics: !preferences.analytics })}
                      className={`w-12 h-6 rounded-full transition-colors flex items-center ${
                        preferences.analytics ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'
                      } px-1`}
                    >
                      <div className="w-4 h-4 bg-white rounded-full"></div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Marketing Cookies */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Marketing & Advertising Cookies
                    </h4>
                    <p className="text-sm text-gray-600">
                      Used to track visitors across websites to display relevant advertisements and email campaigns.
                      Based on your browsing history and interests.
                    </p>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => setPreferences({ ...preferences, marketing: !preferences.marketing })}
                      className={`w-12 h-6 rounded-full transition-colors flex items-center ${
                        preferences.marketing ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'
                      } px-1`}
                    >
                      <div className="w-4 h-4 bg-white rounded-full"></div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRejectAll}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={handleSavePreferences}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
