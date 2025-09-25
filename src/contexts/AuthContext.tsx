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

  useEffect(() => {
    let mounted = true;

    // Initialize session recovery
const initializeAuth = async () => {
  try {
    const rememberMe = localStorage.getItem('smartcfo-remember-me');
    const tempSession = sessionStorage.getItem('smartcfo-temp-session');

    // Get current session WITHOUT triggering a refresh
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Session recovery error:', error);
      if (mounted) {
        setLoading(false);
      }
      return;
    }

    if (session) {
      // Check if this is an OAuth session (don't apply remember-me logic to OAuth)
      const isOAuthSession = session.user?.app_metadata?.provider &&
                            session.user.app_metadata.provider !== 'email';

      if (isOAuthSession) {
        // OAuth users are always "remembered" - don't sign them out
        console.log('🔐 OAuth session detected, maintaining session');
        console.log('🔐 OAuth user details:', {
          id: session.user.id,
          email: session.user.email,
          provider: session.user.app_metadata?.provider
        });
        if (mounted) {
          setUser(session.user);
          setLoading(false);
        }
      } else {
        // Apply remember-me logic only to email/password users
        if (!rememberMe && !tempSession) {
          await supabase.auth.signOut();
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setUser(session.user);
          setLoading(false);
        }
      }

      // Don't refresh here - let the keep-alive hook handle it
    } else {
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

        const currentUser = session?.user ?? null;
        const previousUser = user;
        
        setUser(currentUser);
        
        // Handle auth events
        if (event === 'SIGNED_IN' && currentUser && !previousUser) {
          // Check if this is an OAuth sign-in or regular sign-in
          const isOAuth = session?.access_token && !previousUser;

          await auditService.logLogin(currentUser.id, true, {
            method: isOAuth ? 'oauth' : 'password',
            email: currentUser.email
          });

          // For OAuth users, ensure they have proper setup
          if (isOAuth) {
            try {
              const { registrationService } = await import('../services/registrationService');
              await registrationService.ensureUserSetupComplete(currentUser.id);
            } catch (error) {
              console.error('Error ensuring OAuth user setup:', error);
            }
          }
        } else if (event === 'SIGNED_OUT' && previousUser) {
          await auditService.logLogout(previousUser.id);
          // Clear remember me preference on sign out
          localStorage.removeItem('smartcfo-remember-me');
          sessionStorage.removeItem('smartcfo-temp-session');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Session token refreshed successfully');
        } else if (event === 'USER_UPDATED') {
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
    sessionStorage.removeItem('smartcfo-temp-session');
    
    // Logout is logged by onAuthStateChange
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};