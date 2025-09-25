import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { Loader2 } from 'lucide-react';

interface SmartRedirectProps {
  fallback: React.ReactNode;
}

export const SmartRedirect: React.FC<SmartRedirectProps> = ({ fallback }) => {
  const { user, loading: authLoading } = useAuth();
  const [checkingSetup, setCheckingSetup] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (!user || authLoading) return;

    const checkUserSetup = async () => {
      setCheckingSetup(true);
      console.log('🔍 SmartRedirect: Checking user setup for user:', user.id);

      try {
        // Check if user has completed profile setup
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('company_name, country_code, setup_completed')
          .eq('id', user.id)
          .maybeSingle();

        console.log('📋 Profile data:', profile);
        if (profileError) console.error('Profile error:', profileError);

        // Check if user has a subscription
        const { data: subscription, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('💳 Subscription data:', subscription);
        if (subscriptionError) console.error('Subscription error:', subscriptionError);

        // If no profile or incomplete setup, needs setup wizard
        const profileIncomplete = !profile || !profile.company_name || !profile.setup_completed;
        const noSubscription = !subscription;

        const needsSetupResult = profileIncomplete || noSubscription;
        console.log('📝 Setup check result:', {
          profileIncomplete,
          noSubscription,
          needsSetup: needsSetupResult
        });

        setNeedsSetup(needsSetupResult);
      } catch (error) {
        console.error('Error checking user setup:', error);
        // If we can't check, assume setup is needed for new OAuth users
        setNeedsSetup(true);
      } finally {
        setCheckingSetup(false);
      }
    };

    checkUserSetup();
  }, [user, authLoading]);

  // Show loading while checking auth or setup status
  if (authLoading || (user && checkingSetup)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading SmartCFO...</p>
        </div>
      </div>
    );
  }

  // If no user, show fallback (LandingPage)
  if (!user) {
    return <>{fallback}</>;
  }

  // If user needs setup, redirect to setup wizard
  if (needsSetup) {
    console.log('🚀 SmartRedirect: Redirecting to setup wizard');
    return <Navigate to="/setup" replace />;
  }

  // Otherwise, redirect to dashboard
  console.log('🏠 SmartRedirect: Redirecting to dashboard');
  return <Navigate to="/dashboard" replace />;
};