// src/contexts/DataContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';

interface DataContextType {
  subscription: any | null;
  userRole: 'owner' | 'admin' | 'member' | null;
  teamId: string | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent multiple simultaneous loads
  const loadingRef = useRef(false);
  const lastLoadTime = useRef(0);
  const LOAD_COOLDOWN = 5000; // 5 seconds cooldown

  const loadUserData = async () => {
    // Check if already loading or if cooldown hasn't passed
    const now = Date.now();
    if (loadingRef.current || (now - lastLoadTime.current < LOAD_COOLDOWN)) {
      return;
    }

    if (!user) {
      setSubscription(null);
      setUserRole(null);
      setTeamId(null);
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // First, check if user is part of a team
      const { data: teamMember, error: teamError } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      let actualTeamId = user.id; // Default to user's own ID
      let role: 'owner' | 'admin' | 'member' = 'owner'; // Default role

      if (teamMember && !teamError) {
        // User is part of a team
        actualTeamId = teamMember.team_id;
        role = teamMember.role;
        
        // Get subscription for the team owner
        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', actualTeamId)
          .maybeSingle();

        if (subError) {
          console.error('Subscription error:', subError);
          // Create default subscription for team owner if none exists
          if (role === 'owner') {
            const { data: newSub } = await supabase
              .from('subscriptions')
              .insert([{
                user_id: actualTeamId,
                plan: 'simple_start',
                status: 'active'
              }])
              .select()
              .single();
            
            setSubscription(newSub);
          }
        } else {
          setSubscription(subData);
        }
      } else {
        // User is not part of a team, they own their own data
        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (subError) {
          console.error('Subscription error:', subError);
          // Create a default subscription if none exists
          const { data: newSub } = await supabase
            .from('subscriptions')
            .insert([{
              user_id: user.id,
              plan: 'simple_start',
              status: 'active'
            }])
            .select()
            .single();
          
          setSubscription(newSub);
        } else {
          setSubscription(subData);
        }
      }

      setUserRole(role);
      setTeamId(actualTeamId);
      lastLoadTime.current = Date.now();
    } catch (err: any) {
      console.error('Error loading user data:', err);
      setError(err.message);
      // Set defaults on error
      setUserRole('owner');
      setTeamId(user?.id || null);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  // Load data when user changes
  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user?.id]);

  // Handle visibility change without reloading
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Don't reload on tab change - just check if session is still valid
      if (document.visibilityState === 'visible' && user) {
        supabase.auth.getSession().catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  const refreshData = async () => {
    lastLoadTime.current = 0; // Reset cooldown
    await loadUserData();
  };

  return (
    <DataContext.Provider value={{
      subscription,
      userRole,
      teamId,
      isLoading,
      error,
      refreshData
    }}>
      {children}
    </DataContext.Provider>
  );
};