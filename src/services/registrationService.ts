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

      // 3. Create minimal profile only - let setup wizard handle the rest
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        setup_completed: false, // Always false for new registrations
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (profileError && profileError.code !== '23505') { // Ignore duplicate key error
        console.error('Profile creation error:', profileError);
        // Don't fail registration for profile creation issues
      }

      // 4. Create minimal user settings (will be updated in setup wizard)
      const { error: settingsError } = await supabase.from('user_settings').insert({
        user_id: authData.user.id,
        base_currency: 'USD', // Default, will be updated in setup
        date_format: 'MM/DD/YYYY', // Default, will be updated in setup
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (settingsError && settingsError.code !== '23505') { // Ignore duplicate key error
        console.error('Settings creation error:', settingsError);
        // Don't fail registration for settings creation issues
      }

      // 5. Only create subscription for team members (invited users get team access)
      if (isTeamMember && teamId) {
        console.log('User is joining team, skipping individual subscription');
      } else {
        // Create trial subscription (will be updated in setup wizard)
        const { error: subscriptionError } = await supabase.from('subscriptions').insert({
          user_id: authData.user.id,
          plan: 'simple_start', // Default trial plan
          interval: 'monthly', // Default interval
          status: 'trialing',
          trial_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        if (subscriptionError && subscriptionError.code !== '23505') { // Ignore duplicate key error
          console.error('Subscription creation error:', subscriptionError);
          // Don't fail registration for subscription creation issues
        }
      }

      // 6. Accept invitation if applicable
      if (isTeamMember && data.inviteCode && inviteValidation?.invitation) {
        await this.acceptInvitation(data.inviteCode, authData.user.id);
      }

      // 7. Send welcome email
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

  // Note: ensureUserSetupComplete is no longer needed
  // All users now go through the setup wizard after registration
}

export const registrationService = new RegistrationService();