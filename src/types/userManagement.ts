// src/types/userManagement.ts

export interface TeamMember {
  id: string;
  email: string;
  full_name?: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'invited' | 'disabled';
  invited_by: string;
  accepted_at?: string; // ✅ Fixed: was joined_at
  created_at: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: 'admin' | 'member';
  invited_by: string;
  token: string;
  expires_at: string;
  created_at: string;
}