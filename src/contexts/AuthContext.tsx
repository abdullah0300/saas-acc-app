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
        console.log('🔐 AuthContext: Initializing authentication');
        
        const rememberMe = localStorage.getItem('smartcfo-remember-me');
        const tempSession = sessionStorage.getItem('smartcfo-temp-session');
        
        console.log('🔐 Remember settings:', { rememberMe, tempSession });

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

        if (session) {
          // Apply remember-me logic to ALL users (OAuth and email/password)
          console.log('🔐 Session detected, checking remember preference');

          // OAuth users are treated the same as email users now
          const isOAuthSession = session.user?.app_metadata?.provider &&
                                session.user.app_metadata.provider !== 'email';

          // For OAuth users, assume they want to stay logged in (like "remember me")
          if (isOAuthSession || rememberMe || tempSession) {
            console.log('🔐 Remember preference found or OAuth user, maintaining session');
            if (mounted) {
              setUser(session.user);
              setLoading(false);
            }
          } else {
            console.log('🔐 No remember preference, signing out user');
            await supabase.auth.signOut();
            if (mounted) {
              setUser(null);
              setLoading(false);
            }
            return;
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
          sessionStorage.removeItem('smartcfo-temp-session');
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