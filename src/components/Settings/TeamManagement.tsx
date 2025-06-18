// src/components/Settings/TeamManagement.tsx
import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shield, Trash2, Crown, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../services/supabaseClient';

interface TeamMember {
  id: string;
  user_id: string | null;
  team_id: string;
  email: string;
  full_name: string | null;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'invited' | 'disabled';
  invited_by: string;
  joined_at: string | null;
  created_at: string;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: 'admin' | 'member';
  invite_code: string;
  expires_at: string;
  accepted: boolean;
  created_at: string;
}

export const TeamManagement: React.FC = () => {
  const { user } = useAuth();
  const { subscription, userRole, teamId, refreshData } = useData();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');

  // Calculate limits based on subscription
  const getUserLimit = () => {
    return subscription?.plan === 'simple_start' ? 1 : 
           subscription?.plan === 'essentials' ? 3 :
           subscription?.plan === 'plus' ? 5 : 25;
  };

  useEffect(() => {
    if (user && teamId) {
      loadTeamData();
    }
  }, [user, teamId]);

  const loadTeamData = async () => {
    if (!user || !teamId) return;
    
    try {
      setLoading(true);
      setError('');
      
      // Load team members - they already have email and full_name
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'active')
        .order('created_at');

      if (membersError) throw membersError;
      setMembers(membersData || []);

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Load pending invitations
      const { data: invitesData, error: invitesError } = await supabase
        .from('pending_invites')
        .select('*')
        .eq('team_id', teamId)
        .eq('accepted', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;
      setInvitations(invitesData || []);

    } catch (err: any) {
      console.error('Error loading team data:', err);
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const canManageTeam = userRole === 'owner' || userRole === 'admin';
  const canAddUsers = () => {
    const limit = getUserLimit();
    const currentCount = members.length + invitations.length;
    return currentCount < limit && canManageTeam;
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !teamId || !canManageTeam) return;

    setInviting(true);
    setError('');
    setSuccess('');

    try {
      // Check user limit
      const limit = getUserLimit();
      const currentCount = members.length + invitations.length;
      
      if (currentCount >= limit) {
        throw new Error(`You've reached the ${limit} user limit for your ${subscription?.plan} plan. Upgrade to add more team members.`);
      }

      // Check if email already invited or member
      const existingMember = members.find(m => m.email === inviteEmail);
      const existingInvite = invitations.find(i => i.email === inviteEmail);
      
      if (existingMember) {
        throw new Error('This user is already a team member');
      }
      
      if (existingInvite) {
        throw new Error('An invitation is already pending for this email');
      }

      // Create invitation with invite code
      const inviteCode = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const { error: inviteError } = await supabase
        .from('pending_invites')
        .insert([{
          team_id: teamId,
          email: inviteEmail,
          role: inviteRole,
          invited_by: user.id,
          invite_code: inviteCode,
          expires_at: expiresAt.toISOString(),
          accepted: false
        }]);

      if (inviteError) throw inviteError;

      // TODO: Send invitation email here

      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setShowInviteForm(false);
      await loadTeamData();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberRole: string) => {
    if (!canManageTeam || memberRole === 'owner') {
      setError("You cannot remove the team owner");
      return;
    }

    if (window.confirm('Are you sure you want to remove this team member?')) {
      try {
        const { error } = await supabase
          .from('team_members')
          .update({ status: 'disabled' })
          .eq('id', memberId);

        if (error) throw error;

        await loadTeamData();
        setSuccess('Team member removed successfully');
      } catch (err: any) {
        setError('Failed to remove team member');
      }
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member') => {
    if (!canManageTeam) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      await loadTeamData();
      setSuccess('Role updated successfully');
    } catch (err: any) {
      setError('Failed to update role');
    }
  };

  const handleCancelInvitation = async (inviteId: string) => {
    if (!canManageTeam) return;

    try {
      const { error } = await supabase
        .from('pending_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;

      await loadTeamData();
      setSuccess('Invitation cancelled');
    } catch (err: any) {
      setError('Failed to cancel invitation');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Crown className="h-3 w-3 mr-1" />
            Owner
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Member
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const userLimit = getUserLimit();
  const currentCount = members.length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Team Management</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage your team members and permissions
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
          <XCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
          <CheckCircle className="h-4 w-4 mr-2" />
          {success}
        </div>
      )}

      {/* User Limit Info */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-blue-600 mr-2" />
            <span className="text-sm font-medium text-blue-900">
              Team Members: {currentCount} / {userLimit}
            </span>
          </div>
          {canManageTeam && (
            <button
              onClick={() => setShowInviteForm(true)}
              disabled={!canAddUsers()}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Invite Member
            </button>
          )}
        </div>
        {currentCount >= userLimit && (
          <p className="mt-2 text-xs text-blue-700">
            Upgrade your plan to add more team members
          </p>
        )}
      </div>

      {/* Team Members List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {member.full_name?.charAt(0) || member.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {member.full_name || 'No name'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {member.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getRoleBadge(member.role)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(member.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {canManageTeam && member.role !== 'owner' && (
                    <div className="flex items-center justify-end space-x-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as 'admin' | 'member')}
                        className="text-sm border-gray-300 rounded-md"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.id, member.role)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Invitations</h3>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invitation.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(invitation.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(invitation.created_at).toLocaleDateString()}
                      <span className="text-xs text-gray-400 block">
                        Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canManageTeam && (
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Invite Team Member</h3>
            <form onSubmit={handleInvite}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="member">Member - Can view and add data</option>
                    <option value="admin">Admin - Can manage team and data</option>
                  </select>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                  <p className="font-medium mb-1">Role Permissions:</p>
                  <ul className="text-xs space-y-0.5">
                    <li>• <strong>Member:</strong> View and manage transactions</li>
                    <li>• <strong>Admin:</strong> All member permissions + manage team</li>
                    <li>• <strong>Owner:</strong> All permissions + billing management</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};