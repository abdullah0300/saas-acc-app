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
      console.log('🚀 Starting registration process...');
      console.log('📧 Email:', data.email);
      console.log('👥 Invite code:', data.inviteCode ? 'Present' : 'None');

      // 1. Create auth user with minimal metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            full_name: `${data.firstName} ${data.lastName}`.trim(),
            // REMOVED: hardcoded company_name, country, state
            // Let SetupWizard handle these properly
          }
        }
      });

      if (authError) {
        console.error('❌ Auth error:', authError);
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        console.error('❌ No user returned from auth');
        return { success: false, error: 'Failed to create user' };
      }

      console.log('✅ User created successfully:', authData.user.id);

      // 2. Handle team invitation if present
      if (data.inviteCode) {
        console.log('🎟️ Processing team invitation...');
        
        const validation = await this.validateInvitation(data.inviteCode);
        if (!validation.valid || !validation.invitation) {
          console.error('❌ Invalid invitation');
          return { success: false, error: validation.error || 'Invalid invitation' };
        }

        // Add user to team
        try {
          const { error: teamError } = await supabase
            .from('team_members')
            .insert({
              user_id: authData.user.id,
              team_id: validation.invitation.team_id,
              email: data.email,
              full_name: `${data.firstName} ${data.lastName}`.trim(),
              role: validation.invitation.role,
              status: 'active',
              invited_by: validation.invitation.invited_by,
              joined_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            });

          if (teamError) {
            console.error('❌ Team member creation error:', teamError);
            // Don't fail the entire registration for team errors
            console.warn('⚠️ Failed to add to team, but user creation succeeded');
          } else {
            console.log('✅ User added to team successfully');
          }

          // Mark invitation as used (delete it)
          await supabase
            .from('team_invites')
            .delete()
            .eq('token', data.inviteCode);

          return { 
            success: true, 
            user: authData.user,
            isTeamMember: true,
            teamId: validation.invitation.team_id
          };
        } catch (teamErr) {
          console.error('❌ Team processing error:', teamErr);
          // Continue with regular registration if team processing fails
        }
      }

      // 3. Create basic profile (without setup_completed flag)
      console.log('👤 Creating user profile...');
      
      const profileData = {
        id: authData.user.id,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        full_name: `${data.firstName} ${data.lastName}`.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // CRITICAL: Don't set setup_completed here
        // Let SetupWizard handle this after proper country/currency selection
        setup_completed: false
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData);

      if (profileError && profileError.code !== '23505') {
        console.error('❌ Profile creation error:', profileError);
        // Don't fail registration for profile errors - auth user is already created
        console.warn('⚠️ Profile creation failed, but user auth succeeded');
      } else {
        console.log('✅ Profile created successfully');
      }

      // 4. Create subscription record (with plan info)
      console.log('💳 Creating subscription...');
      
      const subscriptionData = {
        user_id: authData.user.id,
        plan: data.plan,
        interval: data.interval,
        status: 'trialing',
        trial_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert(subscriptionData);

      if (subscriptionError) {
        console.error('❌ Subscription creation error:', subscriptionError);
        // Don't fail registration for subscription errors
        console.warn('⚠️ Subscription creation failed, but user auth succeeded');
      } else {
        console.log('✅ Subscription created successfully');
      }

      // CRITICAL: Don't create user_settings here!
      // Let SetupWizard handle this with proper country/currency selection
      console.log('⚠️ Skipping user_settings creation - SetupWizard will handle this');

      console.log('🎉 Registration completed successfully!');
      return { 
        success: true, 
        user: authData.user,
        isTeamMember: false
      };

    } catch (err: any) {
      console.error('❌ Registration error:', err);
      return { 
        success: false, 
        error: err.message || 'Registration failed. Please try again.' 
      };
    }
  }
}

export const registrationService = new RegistrationService();