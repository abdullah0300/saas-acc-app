// src/contexts/AuthContext.tsx - Updated with audit logging
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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      const previousUser = user;
      
      setUser(currentUser);
      
      // Log auth events
      if (event === 'SIGNED_IN' && currentUser && !previousUser) {
        await auditService.logLogin(currentUser.id, true, {
          method: 'password',
          email: currentUser.email
        });
      } else if (event === 'SIGNED_OUT' && previousUser) {
        await auditService.logLogout(previousUser.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Log failed login attempt
        // Try to get user id from email
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