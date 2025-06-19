// src/contexts/DataContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { subscriptionService } from '../services/subscriptionService';
import { getEffectiveUserId } from '../services/database';

interface DataContextType {
  subscription: any;
  userRole: 'owner' | 'admin' | 'member';
  teamId: string | null;
  effectiveUserId: string | null;
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
  const [subscription, setSubscription] = useState<any>(null);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member'>('owner');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadingRef = useRef(false);
  const lastLoadTime = useRef(0);

  const loadUserData = async () => {
    if (!user || loadingRef.current) return;
    
    const now = Date.now();
    if (now - lastLoadTime.current < 1000) return;
    
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Get effective user ID
      const effectiveId = await getEffectiveUserId(user.id);
      
      // Check if user is part of a team
      const { data: teamMember, error: teamError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      let actualTeamId = user.id;
      let role: 'owner' | 'admin' | 'member' = 'owner';

      if (teamMember && !teamError) {
        actualTeamId = teamMember.team_id;
        role = teamMember.role;
      }

      // Load subscription using effective user ID
      const subData = await subscriptionService.loadUserSubscription(effectiveId);
      setSubscription(subData);

      setUserRole(role);
      setTeamId(actualTeamId);
      setEffectiveUserId(effectiveId);
      lastLoadTime.current = Date.now();
      
      console.log('User data loaded:', {
        userId: user.id,
        role,
        teamId: actualTeamId,
        effectiveUserId: effectiveId
      });
      
    } catch (err: any) {
      console.error('Error loading user data:', err);
      setError(err.message);
      setUserRole('owner');
      setTeamId(user?.id || null);
      setEffectiveUserId(user?.id || null);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      setSubscription(null);
      setUserRole('owner');
      setTeamId(null);
      setEffectiveUserId(null);
      setIsLoading(false);
    }
  }, [user?.id]);

  const refreshData = async () => {
    lastLoadTime.current = 0;
    await loadUserData();
  };

  return (
    <DataContext.Provider value={{
      subscription,
      userRole,
      teamId,
      effectiveUserId,
      isLoading,
      error,
      refreshData
    }}>
      {children}
    </DataContext.Provider>
  );
};