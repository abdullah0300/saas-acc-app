// src/hooks/useTeamPermissions.ts
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

export const useTeamPermissions = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isSEOAdmin, setIsSEOAdmin] = useState(false);
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
    // Check if user is a platform admin and get their admin role
    const { data: platformAdminData, error: platformAdminError } = await supabase
      .from('platform_admins')
      .select('user_id, admin_role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!platformAdminError && platformAdminData !== null) {
      const adminRole = platformAdminData.admin_role || 'platform_admin';
      setIsPlatformAdmin(adminRole === 'platform_admin');
      setIsSEOAdmin(adminRole === 'seo_admin' || adminRole === 'platform_admin');
    } else {
      setIsPlatformAdmin(false);
      setIsSEOAdmin(false);
    }

    // Check if user is in team_members table
    const { data, error } = await supabase
      .from('team_members')
      .select('role, team_id')
      .eq('user_id', user.id)
      .maybeSingle();

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
    setIsPlatformAdmin(false);
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
    isMember: role === 'member',
    isPlatformAdmin,
    isSEOAdmin
  };
};