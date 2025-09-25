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
      console.log('🔍 User metadata:', {
        provider: user.app_metadata?.provider,
        email: user.email,
        user_metadata: user.user_metadata
      });

      try {
        // First, ensure OAuth user has proper setup (this may take a moment)
        if (user.app_metadata?.provider && user.app_metadata.provider !== 'email') {
          console.log('🔐 OAuth user detected, ensuring setup completion...');
          try {
            const { registrationService } = await import('../../services/registrationService');
            await registrationService.ensureUserSetupComplete(user.id);
            console.log('✅ OAuth user setup completed');
          } catch (setupError) {
            console.warn('OAuth setup error (will retry):', setupError);
            // Don't fail here - continue with check
          }
        }

        // Check if user has completed profile setup
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('company_name, country_code, setup_completed, first_name, last_name')
          .eq('id', user.id)
          .maybeSingle();

        console.log('📋 Profile data:', profile);
        if (profileError) console.error('Profile error:', profileError);

        // Check if user has a subscription
        const { data: subscription, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('id, plan_name, status')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('💳 Subscription data:', subscription);
        if (subscriptionError) console.error('Subscription error:', subscriptionError);

        // More lenient checks for OAuth users
        const isOAuthUser = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
        let profileIncomplete, noSubscription;

        if (isOAuthUser) {
          // For OAuth users, just check if they have a profile at all
          profileIncomplete = !profile || (!profile.first_name && !profile.company_name);
          noSubscription = !subscription || subscription.status !== 'active';
        } else {
          // For email users, require complete setup
          profileIncomplete = !profile || !profile.company_name || !profile.setup_completed;
          noSubscription = !subscription;
        }

        const needsSetupResult = profileIncomplete || noSubscription;
        console.log('📝 Setup check result:', {
          isOAuthUser,
          profileIncomplete,
          noSubscription,
          needsSetup: needsSetupResult
        });

        setNeedsSetup(needsSetupResult);
      } catch (error) {
        console.error('Error checking user setup:', error);
        // For OAuth users, don't assume setup needed if check fails
        const isOAuthUser = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
        if (isOAuthUser) {
          console.log('OAuth user - proceeding to dashboard despite check error');
          setNeedsSetup(false);
        } else {
          setNeedsSetup(true);
        }
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