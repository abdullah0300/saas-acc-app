// src/components/Auth/ResetPassword.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseRecovery } from '../../services/supabaseClient';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Shield, 
  Smartphone,
  CheckCircle,
  ChevronRight,
  Mail,
  Loader2
} from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  
  // MFA states
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [showMFADialog, setShowMFADialog] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const initializeRecovery = async () => {
      try {
        console.log('Initializing recovery...');
        
        if (window.location.hash) {
          console.log('Hash detected, waiting for Supabase to process...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        const { data: { session }, error } = await supabaseRecovery.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          if (mounted) {
            setError('Failed to validate reset link');
            setCheckingSession(false);
          }
          return;
        }
        
        if (session && mounted) {
          console.log('Recovery session found:', session.user?.email);
          setUserEmail(session.user?.email || '');
          setIsRecoveryMode(true);
          
          // Check if user has MFA enabled
          try {
            const { data: factors } = await supabaseRecovery.auth.mfa.listFactors();
            const verifiedFactor = factors?.all?.find(f => f.status === 'verified');
            
            if (verifiedFactor) {
              console.log('MFA is enabled for this account');
              setRequiresMFA(true);
            }
          } catch (err) {
            console.log('Could not check MFA status:', err);
          }
          
          setCheckingSession(false);
          
          if (window.location.hash) {
            window.history.replaceState(null, '', '/reset-password');
          }
        } else if (mounted) {
          console.log('No recovery session');
          setError('Invalid or expired reset link. Please request a new one.');
          setCheckingSession(false);
        }
      } catch (err) {
        console.error('Recovery initialization error:', err);
        if (mounted) {
          setError('Unable to process reset link');
          setCheckingSession(false);
        }
      }
    };

    const { data: authListener } = supabaseRecovery.auth.onAuthStateChange((event, session) => {
      console.log('Recovery auth event:', event);
      
      if (event === 'PASSWORD_RECOVERY' && session && mounted) {
        console.log('PASSWORD_RECOVERY mode activated');
        setUserEmail(session.user?.email || '');
        setIsRecoveryMode(true);
        
        // Check MFA status
        supabaseRecovery.auth.mfa.listFactors().then(({ data: factors }) => {
          const verifiedFactor = factors?.all?.find(f => f.status === 'verified');
          if (verifiedFactor) {
            setRequiresMFA(true);
          }
        }).catch(console.error);
        
        setCheckingSession(false);
        
        if (window.location.hash) {
          window.history.replaceState(null, '', '/reset-password');
        }
      }
    });

    initializeRecovery();

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (requiresMFA && !showMFADialog) {
      setShowMFADialog(true);
      return;
    }
    
    if (showMFADialog && requiresMFA) {
      await handleMFAVerificationAndPasswordChange();
      return;
    }
    
    await changePassword();
  };

  const changePassword = async () => {
    setLoading(true);
    setError('');

    try {
      const { error } = await supabaseRecovery.auth.updateUser({ password });

      if (error) throw error;

      await supabaseRecovery.auth.signOut();
      
      setSuccessMessage('Your password has been successfully reset!');
      setShowSuccessScreen(true);
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (error: any) {
      console.error('Password update error:', error);
      setError(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerificationAndPasswordChange = async () => {
    if (mfaCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    
    setMfaLoading(true);
    setError('');
    
    try {
      const { data: factors } = await supabaseRecovery.auth.mfa.listFactors();
      const verifiedFactor = factors?.all?.find(f => f.status === 'verified');
      
      if (!verifiedFactor) {
        setError('No verified MFA factor found');
        setMfaLoading(false);
        return;
      }
      
      const { data: challengeData, error: challengeError } = 
        await supabaseRecovery.auth.mfa.challenge({ factorId: verifiedFactor.id });
      
      if (challengeError) throw challengeError;
      
      const { error: verifyError } = await supabaseRecovery.auth.mfa.verify({
        factorId: verifiedFactor.id,
        challengeId: challengeData.id,
        code: mfaCode
      });
      
      if (verifyError) throw verifyError;
      
      const { error: updateError } = await supabaseRecovery.auth.updateUser({ password });
      
      if (updateError) throw updateError;
      
      await supabaseRecovery.auth.signOut();
      
      setSuccessMessage('Your password has been successfully reset!');
      setShowSuccessScreen(true);
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (err: any) {
      console.error('MFA verification or password update error:', err);
      setError(err.message || 'Invalid verification code');
    } finally {
      setMfaLoading(false);
    }
  };

  // Success Screen
  if (showSuccessScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-delayed"></div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 max-w-md w-full relative border border-white">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 mb-4">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful!</h2>
            <p className="text-gray-600 mb-4">{successMessage}</p>
            <p className="text-sm text-gray-500 mb-6">Redirecting you to login page in a moment...</p>
            
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform transition-all hover:scale-[1.02] flex items-center justify-center"
            >
              Go to Login Now
              <ChevronRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading Screen
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-delayed"></div>
        </div>
        
        <div className="text-center relative">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Processing your reset link...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait a moment</p>
        </div>
      </div>
    );
  }

  // Invalid Link Screen
  if (!isRecoveryMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-delayed"></div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 max-w-md w-full relative border border-white">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-red-400 to-pink-600 mb-4">
              <AlertCircle className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Reset Link</h2>
            <p className="text-gray-600 mb-6">{error || 'This password reset link is invalid or has expired.'}</p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start">
                <Mail className="h-5 w-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-amber-800 font-medium">Check your spam folder</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Sometimes reset emails end up in spam. Make sure to check there and mark as "Not Spam"
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform transition-all hover:scale-[1.02]"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MFA Verification Screen
  if (showMFADialog && requiresMFA) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-delayed"></div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative border border-white">
          {/* Header Gradient */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center p-3 bg-white/20 backdrop-blur rounded-2xl mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Two-Factor Authentication</h2>
              <p className="text-indigo-100 mt-2 text-sm">
                Extra security for your account
              </p>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-8">
            <div className="mb-6 p-4 bg-blue-50 rounded-xl">
              <div className="flex items-start">
                <Smartphone className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-900 font-medium">Verification Required</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Open your authenticator app and enter the 6-digit code for {userEmail}
                  </p>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start animate-shake">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="hidden" value={password} />
              <input type="hidden" value={confirmPassword} />
              
              <div>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  maxLength={6}
                  autoFocus
                />
                <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300"
                    style={{ width: `${(mfaCode.length / 6) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowMFADialog(false);
                    setMfaCode('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={mfaLoading || mfaCode.length !== 6}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {mfaLoading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Verifying...
                    </span>
                  ) : (
                    'Verify & Reset'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Main Password Reset Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-delayed"></div>
      </div>
      
      <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 max-w-md w-full relative border border-white">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Create New Password</h2>
          <p className="text-gray-600 mt-2">Choose a strong password for your account</p>
          {requiresMFA && (
            <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
              <Shield className="h-4 w-4 mr-1 text-blue-600" />
              <span className="text-sm text-blue-700 font-medium">2FA Protected Account</span>
            </div>
          )}
        </div>
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start animate-shake">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                required
                minLength={6}
                autoFocus
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1 ml-1">Minimum 6 characters required</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                required
                minLength={6}
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Updating Password...
              </>
            ) : (
              <>
                {requiresMFA ? 'Continue to Verification' : 'Reset Password'}
                <ChevronRight className="ml-2 h-5 w-5" />
              </>
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-indigo-600 hover:text-indigo-500 font-medium transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 6s ease-in-out infinite;
          animation-delay: 3s;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};