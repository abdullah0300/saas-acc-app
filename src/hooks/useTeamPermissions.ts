// src/hooks/useTeamPermissions.ts
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

export const useTeamPermissions = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkPermissions();
    }
  }, [user]);

  // Replace the checkPermissions function in useTeamPermissions.ts with this:

const checkPermissions = async () => {
  if (!user) return;
  
  try {
    // Check if user is in team_members table
    const { data, error } = await supabase
      .from('team_members')
      .select('role, team_id')
      .eq('user_id', user.id) // Changed from 'id' to 'user_id'
      .maybeSingle(); // Use maybeSingle instead of single

    if (error || !data) {
      // User is not in a team - they are the owner
      setRole('owner');
      setTeamId(user.id);
    } else {
      setRole(data.role as 'owner' | 'admin' | 'member');
      setTeamId(data.team_id);
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
    // Default to owner if error
    setRole('owner');
    setTeamId(user?.id || null);
  } finally {
    setLoading(false);
  }
};

  const canEdit = role === 'owner' || role === 'admin';
  const canDelete = role === 'owner' || role === 'admin';
  const canInvite = role === 'owner';
  const canManageTeam = role === 'owner';

  return {
    role,
    teamId,
    loading,
    canEdit,
    canDelete,
    canInvite,
    canManageTeam,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isMember: role === 'member'
  };
};