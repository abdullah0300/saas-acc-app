// src/services/registrationService.ts
import { supabase } from './supabaseClient';

interface RegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  country?: string;
  state?: string;
  plan: string;
  interval: 'monthly' | 'yearly';
  inviteCode?: string;
}

interface RegistrationResult {
  success: boolean;
  user?: any;
  error?: string;
  teamId?: string;
  isTeamMember?: boolean;
}

interface InvitationValidation {
  valid: boolean;
  invitation?: any;
  teamName?: string;
  error?: string;
}

export class RegistrationService {
  async validateInvitation(inviteCode: string): Promise<InvitationValidation> {
    try {
      console.log('Validating invitation with code:', inviteCode);
      
      // Use team_invites table with token field
      const { data: invite, error: inviteError } = await supabase
        .from('team_invites')
        .select('*')
        .eq('token', inviteCode)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      console.log('Invitation query result:', { invite, inviteError });

      if (inviteError) {
        console.error('Error fetching invitation:', inviteError);
        return { valid: false, error: 'Failed to validate invitation' };
      }

      if (!invite) {
        return { valid: false, error: 'Invalid or expired invitation' };
      }

      // Get team owner's profile for company name
      const { data: teamProfile } = await supabase
        .from('profiles')
        .select('company_name')
        .eq('id', invite.team_id)
        .maybeSingle();

      console.log('Team profile:', teamProfile);

      return {
        valid: true,
        invitation: invite,
        teamName: teamProfile?.company_name || 'the team'
      };
    } catch (err) {
      console.error('Error validating invitation:', err);
      return { valid: false, error: 'Failed to validate invitation' };
    }
  }

  async register(data: RegistrationData): Promise<RegistrationResult> {
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            full_name: `${data.firstName} ${data.lastName}`.trim(),
            company_name: data.companyName,
            country: data.country,
            state: data.state
          }
        }
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Failed to create user' };
      }

      // 2. Determine if this is a team member registration
      let isTeamMember = false;
      let teamId = null;
      let invitedBy = null;
      let inviteValidation: any = null;

      if (data.inviteCode) {
        inviteValidation = await this.validateInvitation(data.inviteCode);
        if (inviteValidation.valid && inviteValidation.invitation) {
          isTeamMember = true;
          teamId = inviteValidation.invitation.team_id;
          invitedBy = inviteValidation.invitation.invited_by;
        }
      }

      // 3. Call the setup function with proper parameters
      const { data: setupResult, error: setupError } = await supabase.rpc('setup_new_user', {
        p_user_id: authData.user.id,
        p_email: data.email,
        p_first_name: data.firstName,
        p_last_name: data.lastName,
        p_company_name: data.companyName || null,
        p_country_code: data.country || 'US', // Default to US
        p_state_code: data.state || null,
        p_plan: isTeamMember ? null : data.plan,
        p_interval: isTeamMember ? null : data.interval,
        p_is_team_member: isTeamMember,
        p_team_id: teamId,
        p_invited_by: invitedBy
      });

      if (setupError) {
        console.error('Setup error:', setupError);
        // Don't fail registration if setup has issues - we can retry later
      }

      // 4. Accept invitation if applicable
      if (isTeamMember && data.inviteCode && inviteValidation?.invitation) {
        await this.acceptInvitation(data.inviteCode, authData.user.id);
      }

      // 5. Send welcome email
      try {
        const { createWelcomeNotification } = await import('../services/notifications');
        await createWelcomeNotification(authData.user.id, {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          companyName: data.companyName
        });
      } catch (welcomeError) {
        console.error('Welcome email error (non-critical):', welcomeError);
      }

      return {
        success: true,
        user: authData.user,
        teamId: teamId || authData.user.id,
        isTeamMember
      };

    } catch (err: any) {
      console.error('Registration error:', err);
      return { success: false, error: err.message || 'Registration failed' };
    }
  }

  async acceptInvitation(inviteCode: string, userId: string) {
    // First get the invitation details
    const { data: invite } = await supabase
      .from('team_invites')
      .select('*')
      .eq('token', inviteCode)
      .single();

    if (!invite) throw new Error('Invalid invitation');

    // Add to team_members
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        user_id: userId,
        team_id: invite.team_id,
        email: invite.email,
        role: invite.role,
        status: 'active',
        invited_by: invite.invited_by,
        joined_at: new Date().toISOString()
      });

    if (memberError) throw memberError;

    // Delete the used invite
    await supabase
      .from('team_invites')
      .delete()
      .eq('id', invite.id);
  }

  async ensureUserSetupComplete(userId: string) {
    try {
      // Add a flag to prevent multiple simultaneous checks
      const checkKey = `setup_check_${userId}`;
      if ((window as any)[checkKey]) {
        console.log('Setup check already in progress');
        return;
      }
      (window as any)[checkKey] = true;

      // Check what's missing
      const { data: checks, error: checkError } = await supabase.rpc('verify_user_setup', {
        p_user_id: userId
      });

      // If RPC doesn't exist yet, skip
      if (checkError) {
        console.log('verify_user_setup not available yet');
        delete (window as any)[checkKey];
        return;
      }

      // Only proceed if something is actually missing
      if (checks && (!checks.has_profile || !checks.has_subscription || !checks.has_categories)) {
        console.log('Missing setup detected, running setup_new_user');
        
        // Get user data from the current session
        const { data: { user } } = await supabase.auth.getUser();
        
        // If we can't get the current user, try to get from profiles
        let userEmail = '';
        if (user && user.id === userId) {
          userEmail = user.email || '';
        } else {
          // Fallback: try to get email from profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .maybeSingle();
          
          userEmail = profile?.email || '';
        }

        // Only run setup if we have an email
        if (userEmail) {
          // Re-run setup with defaults (for incomplete setups)
          const { error: setupError } = await supabase.rpc('setup_new_user', {
            p_user_id: userId,
            p_email: userEmail,
            p_first_name: '',
            p_last_name: '',
            p_company_name: null,
            p_country_code: 'US', // Default country
            p_state_code: null,
            p_plan: 'simple_start', // Default plan
            p_interval: 'monthly', // Default billing
            p_is_team_member: false,
            p_team_id: null,
            p_invited_by: null
          });

          if (setupError) {
            console.error('Error in setup_new_user:', setupError);
          }
        }
      }

      // Clean up flag
      delete (window as any)[checkKey];
    } catch (err) {
      console.error('Error ensuring user setup:', err);
      // Clean up flag on error too
      const checkKey = `setup_check_${userId}`;
      delete (window as any)[checkKey];
    }
  }
}

export const registrationService = new RegistrationService();