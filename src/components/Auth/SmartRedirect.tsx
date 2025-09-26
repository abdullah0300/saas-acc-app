// src/components/Auth/SmartRedirect.tsx
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
  const [setupCheckComplete, setSetupCheckComplete] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);

  // Safety timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('⏰ SmartRedirect timeout reached - forcing redirect to dashboard');
      setTimeoutReached(true);
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!user || authLoading) return;

    const checkUserSetup = async () => {
      setCheckingSetup(true);
      console.log('🔍 SmartRedirect: Starting setup check for:', user.id);

      try {
        // Unified setup check for ALL users (OAuth and email/password)
        console.log('🔍 Checking setup completion for user:', user.id);

        // Clear any stuck setup flags first
        const checkKey = `setup_check_${user.id}`;
        delete (window as any)[checkKey];

        // Check if user has completed onboarding setup
        // Handle case where setup_completed column doesn't exist yet
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('company_name, first_name, last_name')
          .eq('id', user.id)
          .maybeSingle();

        // If profile query fails, try without setup_completed column
        let setupCompleted = false;
        if (!profileError && profile) {
          // Try to get setup_completed separately to handle column not existing
          try {
            const { data: setupData } = await supabase
              .from('profiles')
              .select('setup_completed')
              .eq('id', user.id)
              .maybeSingle();
            setupCompleted = setupData?.setup_completed || false;
          } catch (err) {
            console.warn('setup_completed column not found, treating as false');
            setupCompleted = false;
          }
        }

        if (!profile) {
          // Create minimal profile for new users (OAuth or email)
          console.log('📝 Creating minimal profile for new user');
          const profileData: any = {
            id: user.id,
            email: user.email,
            first_name: user.user_metadata?.full_name?.split(' ')[0] ||
                        user.user_metadata?.first_name ||
                        'User',
            last_name: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') ||
                       user.user_metadata?.last_name ||
                       '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // Only add setup_completed if column exists
          try {
            const { error: insertError } = await supabase.from('profiles').insert({
              ...profileData,
              setup_completed: false // All new users need setup
            });
            if (insertError) throw insertError;
          } catch (insertError: any) {
            if (insertError.message?.includes('setup_completed')) {
              // Column doesn't exist, insert without it
              const { error: fallbackError } = await supabase.from('profiles').insert(profileData);
              if (fallbackError && fallbackError.code !== '23505') {
                console.error('Profile creation error:', fallbackError);
              }
            } else if (insertError.code !== '23505') { // Ignore duplicate key error
              console.error('Profile creation error:', insertError);
            }
          }

          // New users always need setup
          setNeedsSetup(true);
        } else {
          // Check if setup is completed
          const needsSetup = !setupCompleted;
          setNeedsSetup(needsSetup);
        }

        console.log('📝 Setup check result:', {
          hasProfile: !!profile,
          setupCompleted: setupCompleted,
          needsSetup: !setupCompleted,
          userType: user.app_metadata?.provider || 'email',
          profile: profile,
          userId: user.id,
          willRedirectTo: !setupCompleted ? '/setup' : 'dashboard'
        });

        // FORCE DEBUG - Always log the decision
        console.log(`🚨 ROUTING DECISION: User ${user.email} will go to ${!setupCompleted ? 'SETUP WIZARD' : 'DASHBOARD'}`);
        console.log(`🚨 needsSetup value: ${!setupCompleted}`);
      } catch (error) {
        console.error('Setup check error:', error);

        // Clear any stuck flags
        const checkKey = `setup_check_${user.id}`;
        delete (window as any)[checkKey];

        // On error, assume user needs setup (safer option)
        setNeedsSetup(true);
      } finally {
        setCheckingSetup(false);
        setSetupCheckComplete(true); // Mark check as complete
      }
    };

    checkUserSetup();
  }, [user, authLoading]);

  // Show loading while checking auth or setup status
  // IMPORTANT: Wait for setup check to complete before making routing decisions
  if (authLoading || (user && !setupCheckComplete && !timeoutReached)) {
    console.log('🔄 SmartRedirect loading state:', {
      authLoading,
      user: !!user,
      checkingSetup,
      setupCheckComplete,
      needsSetup,
      userId: user?.id,
      timeoutReached
    });

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading SmartCFO...</p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 text-xs text-gray-500">
              <p>Auth Loading: {authLoading ? 'Yes' : 'No'}</p>
              <p>User: {user ? 'Found' : 'None'}</p>
              <p>Checking Setup: {checkingSetup ? 'Yes' : 'No'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If no user, show fallback (LandingPage)
  if (!user) {
    return <>{fallback}</>;
  }

  // Safety timeout - force redirect to dashboard
  if (timeoutReached && user) {
    console.log('⏰ SmartRedirect: Timeout reached, forcing redirect to dashboard');
    return <Navigate to="/dashboard" replace />;
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