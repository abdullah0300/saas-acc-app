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

      // Use pending_invites table with invite_code field
      const { data: invite, error: inviteError } = await supabase
        .from('pending_invites')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('accepted', false)
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

        // Check if team_members record already exists (pre-created during invitation)
        console.log('👥 Checking for existing team_members record...');
        const { data: existingMember } = await supabase
          .from('team_members')
          .select('*')
          .eq('email', data.email)
          .eq('team_id', validation.invitation.team_id)
          .maybeSingle();

        console.log('🔍 Existing member:', existingMember);

        let teamMemberData;
        let teamError;

        if (existingMember && !existingMember.user_id) {
          // Record exists but user_id is null - UPDATE it
          console.log('🔄 Updating existing team_members record...');
          const { error, data: updatedData } = await supabase
            .from('team_members')
            .update({
              user_id: authData.user.id,
              full_name: `${data.firstName} ${data.lastName}`.trim(),
              status: 'active',
              accepted_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingMember.id)
            .select();

          teamError = error;
          teamMemberData = updatedData;
        } else if (!existingMember) {
          // No existing record - INSERT new one
          console.log('➕ Inserting new team_members record...');
          console.log('📋 Team member data:', {
            user_id: authData.user.id,
            team_id: validation.invitation.team_id,
            email: data.email,
            role: validation.invitation.role,
            invited_by: validation.invitation.invited_by
          });

          const { error, data: insertedData } = await supabase
            .from('team_members')
            .insert({
              user_id: authData.user.id,
              team_id: validation.invitation.team_id,
              email: data.email,
              full_name: `${data.firstName} ${data.lastName}`.trim(),
              role: validation.invitation.role,
              status: 'active',
              invited_by: validation.invitation.invited_by,
              accepted_at: new Date().toISOString()
            })
            .select();

          teamError = error;
          teamMemberData = insertedData;
        } else {
          // Record exists and already has a user_id - this is a duplicate
          console.error('❌ Team member already exists with user_id');
          return {
            success: false,
            error: 'This email is already associated with a team member. Please contact the team owner.'
          };
        }

        if (teamError) {
          console.error('❌ Team member creation/update error:', teamError);
          console.error('❌ Error details:', {
            code: teamError.code,
            message: teamError.message,
            details: teamError.details,
            hint: teamError.hint
          });
          return {
            success: false,
            error: `Failed to join team: ${teamError.message}. Please contact the team owner.`
          };
        }

        console.log('✅ Team member created/updated:', teamMemberData);

        console.log('✅ User added to team successfully');

        // Mark invitation as accepted
        const { error: inviteUpdateError } = await supabase
          .from('pending_invites')
          .update({ accepted: true })
          .eq('invite_code', data.inviteCode);

        if (inviteUpdateError) {
          console.error('⚠️ Failed to mark invitation as accepted:', inviteUpdateError);
          // Don't fail - user is already in team
        }

        // Create profile for team member with setup_completed = true (they skip setup)
        console.log('👤 Creating team member profile...');
        const teamMemberProfile = {
          id: authData.user.id,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          full_name: `${data.firstName} ${data.lastName}`.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          setup_completed: true // Team members skip setup wizard
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .insert(teamMemberProfile);

        if (profileError && profileError.code !== '23505') {
          console.error('❌ Team member profile creation error:', profileError);
          return {
            success: false,
            error: `Failed to create profile: ${profileError.message}`
          };
        }

        console.log('✅ Team member profile created successfully');
        console.log('✅ Team member setup complete - skipping subscription creation');

        // Team members don't need their own subscription - they use owner's subscription
        return {
          success: true,
          user: authData.user,
          isTeamMember: true,
          teamId: validation.invitation.team_id
        };
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