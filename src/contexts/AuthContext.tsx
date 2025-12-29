// src/contexts/AuthContext.tsx - Enhanced session management
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { auditService } from '../services/auditService';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isImpersonating: boolean;
  impersonatedUser: User | null;
  realAdmin: User | null;
  exitImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [realAdmin, setRealAdmin] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    // Initialize session recovery
    const initializeAuth = async () => {
      try {
        console.log('🔐 AuthContext: Initializing authentication');

        // Get current session WITHOUT triggering a refresh
        const { data: { session }, error } = await supabase.auth.getSession();

        console.log('🔐 Session check:', {
          hasSession: !!session,
          provider: session?.user?.app_metadata?.provider,
          email: session?.user?.email,
          error
        });

        if (error) {
          console.error('Session recovery error:', error);
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        // Check for impersonation FIRST
        const impersonatingUserId = localStorage.getItem('impersonating_user_id');
        const adminUserId = localStorage.getItem('admin_user_id');

        if (session && impersonatingUserId && adminUserId) {
          console.log('🎭 Impersonation detected - admin:', adminUserId, 'impersonating:', impersonatingUserId);

          // SECURITY: Validate that adminUserId is actually a platform admin
          const { data: adminCheck } = await supabase
            .from('platform_admins')
            .select('user_id')
            .eq('user_id', adminUserId)
            .single();

          // If not a platform admin, clear localStorage and reject impersonation
          if (!adminCheck) {
            console.error('⛔ Security: Unauthorized impersonation attempt blocked. User is not a platform admin.');
            localStorage.removeItem('impersonating_user_id');
            localStorage.removeItem('admin_user_id');

            // Log security incident
            await supabase.from('audit_logs').insert({
              user_id: session.user.id,
              action: 'security_violation',
              entity_type: 'auth',
              entity_id: session.user.id,
              metadata: {
                violation_type: 'unauthorized_impersonation_attempt',
                attempted_admin_id: adminUserId,
                attempted_target_id: impersonatingUserId,
                timestamp: new Date().toISOString(),
              },
            });

            // Continue with normal auth flow (fall through to session check below)
          } else {
            // Platform admin validated - proceed with impersonation
            console.log('✅ Platform admin validated, proceeding with impersonation');

            // Fetch impersonated user settings
            const { data: impersonatedSettings } = await supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', impersonatingUserId)
              .single();

            if (impersonatedSettings && mounted) {
              // Create a mock user object for impersonated user
              const mockImpersonatedUser: User = {
                ...session.user,
                id: impersonatingUserId,
                email: impersonatedSettings.full_name || 'Impersonated User',
              } as User;

              setIsImpersonating(true);
              setRealAdmin(session.user);
              setImpersonatedUser(mockImpersonatedUser);
              setUser(mockImpersonatedUser);
              setLoading(false);
              return;
            }
          }
        }

        if (session) {
          // CRITICAL FIX: If Supabase says we have a valid session, TRUST IT
          // Never auto-logout a user who has a valid session
          // The remember-me feature works via browser storage persistence, not by actively logging out
          console.log('🔐 Valid session found, keeping user logged in');
          console.log('🔐 Session details:', {
            provider: session.user?.app_metadata?.provider || 'email',
            email: session.user?.email,
            userId: session.user?.id
          });

          if (mounted) {
            setUser(session.user);
            setLoading(false);
          }
        } else {
          console.log('🔐 No session found');
          if (mounted) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔄 Auth state change:', event, session?.user?.email);

        const currentUser = session?.user ?? null;
        const previousUser = user;

        setUser(currentUser);

        // Handle auth events
        if (event === 'SIGNED_IN' && currentUser && !previousUser) {
          console.log('✅ User signed in:', currentUser.email);

          // Check if this is an OAuth sign-in or regular sign-in
          const isOAuth = currentUser.app_metadata?.provider &&
            currentUser.app_metadata.provider !== 'email';

          await auditService.logLogin(currentUser.id, true, {
            method: isOAuth ? 'oauth' : 'password',
            email: currentUser.email
          });

          // All users go through SmartRedirect for setup check
          console.log('🔐 Sign-in complete, SmartRedirect will handle routing');

        } else if (event === 'SIGNED_OUT' && previousUser) {
          console.log('👋 User signed out');
          await auditService.logLogout(previousUser.id);
          // Clear remember me preference on sign out
          localStorage.removeItem('smartcfo-remember-me');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Session token refreshed successfully');
        } else if (event === 'USER_UPDATED') {
          console.log('👤 User updated');
          // Handle user updates if needed
          setUser(currentUser);
        }
      }
    );

    // Cleanup function
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Log failed login attempt
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();

        if (profiles?.id) {
          await auditService.logLogin(profiles.id, false, {
            email,
            error: error.message
          });
        }

        throw error;
      }

      // Successful login is logged by onAuthStateChange
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    // Clear remember me preference
    localStorage.removeItem('smartcfo-remember-me');

    // Logout is logged by onAuthStateChange
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const exitImpersonation = async () => {
    if (!realAdmin) return;

    const targetUserId = user?.id;

    // Log impersonation end
    await auditService.log({
      action: 'view',
      entity_type: 'user',
      entity_id: targetUserId || '',
      user_id: realAdmin.id,
      metadata: {
        impersonation_end: true,
        admin_id: realAdmin.id,
        timestamp: new Date().toISOString(),
      },
    });

    // Clear impersonation
    localStorage.removeItem('impersonating_user_id');
    localStorage.removeItem('admin_user_id');

    // Reset state
    setIsImpersonating(false);
    setImpersonatedUser(null);
    setUser(realAdmin);
    setRealAdmin(null);

    // Redirect to admin dashboard
    window.location.href = '/admin/dashboard';
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signOut,
      isImpersonating,
      impersonatedUser,
      realAdmin,
      exitImpersonation
    }}>
      {children}
    </AuthContext.Provider>
  );
};