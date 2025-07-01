// src/components/Settings/Security/PasswordChangeForm.tsx
import React, { useState, useEffect } from 'react';
import { Key, Save, Eye, EyeOff, CheckCircle, AlertCircle, Shield, Lock } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabaseClient';
import { auditService } from '../../../services/auditService';

export const PasswordChangeForm: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [hasMFA, setHasMFA] = useState(false);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: ''
  });

  // MFA reauthentication state
  const [showMFADialog, setShowMFADialog] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const mfaEnabled = factors?.all?.some(f => f.status === 'verified') || false;
      setHasMFA(mfaEnabled);
    } catch (err) {
      console.error('Error checking MFA status:', err);
    }
  };

  // Check password strength
  const checkPasswordStrength = (password: string) => {
    let score = 0;
    let feedback = '';

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;

    if (score === 0) feedback = 'Very weak';
    else if (score <= 2) feedback = 'Weak';
    else if (score === 3) feedback = 'Fair';
    else if (score === 4) feedback = 'Good';
    else feedback = 'Strong';

    setPasswordStrength({ score, feedback });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'newPassword') {
      checkPasswordStrength(value);
    }
  };

  const validateForm = () => {
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('All fields are required');
      return false;
    }

    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return false;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('New password must be different from current password');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!validateForm() || !user) return;

    setLoading(true);

    try {
      // First check if MFA is enabled
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasMFA = factors?.all?.some(f => f.status === 'verified') || false;

      if (hasMFA) {
        // For MFA-enabled accounts, we need to handle AAL2
        // First verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: formData.currentPassword
        });

        if (signInError) {
          setError('Current password is incorrect');
          setLoading(false);
          return;
        }

        // Check current AAL level
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        
        if (data?.currentLevel !== 'aal2') {
          // Need to show MFA dialog
          setError('');
          setLoading(false);
          setShowMFADialog(true);
          return;
        }
      } else {
        // No MFA - verify current password normally
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: formData.currentPassword
        });

        if (signInError) {
          setError('Current password is incorrect');
          setLoading(false);
          return;
        }
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (updateError) {
        // Check if it's an AAL2 error
        if (updateError.message.includes('AAL2')) {
          setError('');
          setShowMFADialog(true);
        } else {
          throw updateError;
        }
        return;
      }

      // Log the password change using your existing audit service
      await auditService.log({
        user_id: user.id,
        action: 'password_changed',
        entity_type: 'user',
        entity_id: user.id,
        entity_name: user.email || 'User Account',
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'security_settings'
        }
      });

      setSuccess(true);
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordStrength({ score: 0, feedback: '' });

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    const { score } = passwordStrength;
    if (score <= 2) return 'bg-red-500';
    if (score === 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleMFAReauthentication = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setMfaLoading(true);
    setError('');

    try {
      // Get MFA factors
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factors?.all?.find(f => f.status === 'verified');
      
      if (!verifiedFactor) {
        setError('No verified authentication method found');
        setMfaLoading(false);
        return;
      }

      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id
      });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: verifiedFactor.id,
        challengeId: challengeData.id,
        code: mfaCode
      });

      if (verifyError) throw verifyError;

      // Successfully verified - now immediately try to change the password
      setShowMFADialog(false);
      setMfaCode('');
      
      // Attempt password change now that we have AAL2
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Log the password change
      await auditService.log({
        user_id: user!.id,
        action: 'password_changed',
        entity_type: 'user',
        entity_id: user!.id,
        entity_name: user!.email || 'User Account',
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'security_settings',
          mfa_verified: true
        }
      });

      setSuccess(true);
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordStrength({ score: 0, feedback: '' });

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white shadow rounded-lg p-6 max-w-2xl">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Key className="h-5 w-5 mr-2 text-gray-400" />
            Change Password
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Update your password to keep your account secure
          </p>
        </div>

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-sm text-green-800">Password updated successfully!</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleInputChange}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.current ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            {formData.newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Password strength:</span>
                  <span className="text-xs font-medium text-gray-700">{passwordStrength.feedback}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()}`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Update Password
                </>
              )}
            </button>
          </div>
        </form>

        {/* 2FA Notice for users with 2FA enabled - Better UI */}
        {hasMFA && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <Lock className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900">Two-Step Verification Active</p>
                <p className="text-blue-700 mt-1">
                  Your account has an extra layer of security. If prompted, you'll need to enter a verification code from your authenticator app.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MFA Reauthentication Dialog - Enhanced UI */}
      {showMFADialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-white/20 backdrop-blur-md mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white">
                Verify Your Identity
              </h3>
              <p className="mt-2 text-sm text-blue-50">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              {!validateForm() && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-sm text-amber-800">Please ensure all password fields are filled correctly before proceeding.</p>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Code input with better styling */}
                <div className="relative">
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                    maxLength={6}
                    autoFocus
                  />
                  {/* Progress indicator */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-xl overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${(mfaCode.length / 6) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-gray-500 text-center flex items-center justify-center">
                  <Lock className="h-3 w-3 mr-1" />
                  Open your authenticator app to view your code
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={handleMFAReauthentication}
                  disabled={mfaLoading || mfaCode.length !== 6}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200 shadow-lg"
                >
                  {mfaLoading ? (
                    <span className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Verifying...
                    </span>
                  ) : (
                    'Verify & Continue'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowMFADialog(false);
                    setMfaCode('');
                    setError('');
                  }}
                  className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};