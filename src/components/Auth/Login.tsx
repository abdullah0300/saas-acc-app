import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase, supabaseRecovery } from "../../services/supabaseClient";

import {
  Mail,
  Lock,
  Loader,
  Loader2,
  Eye,
  EyeOff,
  ChevronRight,
  Calculator,
  TrendingUp,
  PieChart,
  BarChart3,
  Receipt,
  DollarSign,
  FileText,
  Coins,
  Wallet,
  CreditCard,
  Building2,
  Sparkles,
  Shield,
  CheckCircle,
  Chrome,
  Facebook,
  Linkedin,
  AlertCircle
} from "lucide-react";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [socialLoading, setSocialLoading] = useState<string | null>(null); 

  // Replace the entire handleForgotPassword function with:
const handleForgotPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  setResetLoading(true);
  
  try {
    // Use supabaseRecovery instead of supabase for password reset
    const { error } = await supabaseRecovery.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${process.env.REACT_APP_SITE_URL || window.location.origin}/reset-password`,
    });
    
    if (error) throw error;
    
    // Show success message instead of alert
    setSuccessMessage('Password reset email sent! Check your inbox.');
    setShowSuccessMessage(true);
    setShowForgotModal(false);
    setResetEmail('');
    
    // Hide success message after 5 seconds
    setTimeout(() => setShowSuccessMessage(false), 5000);
  } catch (error: any) {
    // Keep alert for errors or create error state
    alert('Error: ' + error.message);
  } finally {
    setResetLoading(false);
  }
};

  // Social authentication handlers
  const handleSocialAuth = async (provider: 'google' | 'facebook' | 'linkedin_oidc') => {
    setSocialLoading(provider);
    try {
      // Ensure HTTPS redirect URL
      let redirectUrl = process.env.REACT_APP_SITE_URL || window.location.origin;

      // Force HTTPS for production only (keep HTTP for localhost)
      if (redirectUrl.startsWith('http://') && !redirectUrl.includes('localhost') && !redirectUrl.includes('127.0.0.1')) {
        redirectUrl = redirectUrl.replace('http://', 'https://');
        console.warn('⚠️ REACT_APP_SITE_URL should use HTTPS in production. Auto-correcting to:', redirectUrl);
      }

      // Ensure URL matches current origin if in production
      if (window.location.origin.startsWith('https://') && redirectUrl !== window.location.origin) {
        console.warn('⚠️ URL mismatch detected. Using current origin:', window.location.origin);
        redirectUrl = window.location.origin;
      }

      console.log('OAuth redirect URL:', redirectUrl); // Debug log

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: `${redirectUrl}/`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSocialLoading(null);
    }
  };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
    // Store remember me preference
    if (rememberMe) {
      // Set a flag in localStorage to indicate user wants to stay logged in
      localStorage.setItem('smartcfo-remember-me', 'true');
    } else {
      // Clear the flag if they don't want to be remembered
      localStorage.removeItem('smartcfo-remember-me');
      
      // Set up session to clear on browser close
      sessionStorage.setItem('smartcfo-temp-session', 'true');
    }

    await signIn(email, password);
    navigate("/"); // Let SmartRedirect handle routing
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
      };

  // Features for the side panel
  const features = [
    {
      icon: TrendingUp,
      title: "Track Growth",
      description: "Monitor your financial progress",
    },
    {
      icon: Receipt,
      title: "Smart Invoicing",
      description: "Create professional invoices",
    },
    {
      icon: PieChart,
      title: "Real-time Analytics",
      description: "Insights at your fingertips",
    },
    {
      icon: Shield,
      title: "Bank-level Security",
      description: "Your data is always protected",
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-delayed"></div>

          {/* Floating Icons */}
          <div className="absolute top-20 right-20 text-indigo-200 animate-spin-slow">
            <Calculator className="h-12 w-12" />
          </div>
          <div className="absolute bottom-20 left-20 text-purple-200 animate-bounce-slow">
            <Coins className="h-10 w-10" />
          </div>
          <div className="absolute top-40 left-32 text-pink-200 animate-pulse">
            <DollarSign className="h-8 w-8" />
          </div>
          <div className="absolute bottom-40 right-32 text-blue-200 animate-float">
            <FileText className="h-8 w-8" />
          </div>
        </div>

        <div className="w-full max-w-md relative">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
              <img src="https://ik.imagekit.io/mctozv7td/SmartCFO/smartcfo%20logo%20bg.png?updatedAt=1752387790717" className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
            <p className="mt-2 text-gray-600">
              Sign in to manage your finances
            </p>
          </div>

          {/* Login Form Card */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start animate-shake">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <p className="ml-3 text-sm">{error}</p>
              </div>
            )}

            {/* Social Login Buttons */}
            <div className="space-y-4 mb-6">
              <button
                type="button"
                onClick={() => handleSocialAuth('google')}
                disabled={socialLoading === 'google'}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {socialLoading === 'google' ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
                    <span className="text-gray-600 font-medium text-lg">Signing in...</span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <span className="text-gray-700 font-medium text-lg group-hover:text-gray-900 transition-colors">
                      Continue with Google
                    </span>
                  </>
                )}
              </button>

              {/* <button
                type="button"
                onClick={() => handleSocialAuth('facebook')}
                disabled={socialLoading === 'facebook'}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {socialLoading === 'facebook' ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="text-blue-600 font-medium text-lg">Signing in...</span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 bg-[#1877F2] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <span className="text-gray-700 font-medium text-lg group-hover:text-blue-600 transition-colors">
                      Continue with Facebook
                    </span>
                  </>
                )}
              </button> */}

              <button
                type="button"
                onClick={() => handleSocialAuth('linkedin_oidc')}
                disabled={socialLoading === 'linkedin'}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {socialLoading === 'linkedin' ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
                    <span className="text-blue-700 font-medium text-lg">Signing in...</span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 bg-[#0A66C2] rounded flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </div>
                    <span className="text-gray-700 font-medium text-lg group-hover:text-blue-700 transition-colors">
                      Continue with LinkedIn
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 font-medium">
                  or continue with email
                </span>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-gray-700"
                  >
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors bg-transparent border-none p-0 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-3 text-white font-semibold shadow-lg hover:shadow-xl transform transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="relative flex items-center justify-center">
                  {loading ? (
                    <>
                      <Loader className="animate-spin h-5 w-5 mr-2" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">
                    New to SmartCFO?
                  </span>
                </div>
              </div>

              <Link
                to="/register"
                className="w-full flex items-center justify-center px-8 py-3 border-2 border-indigo-600 rounded-xl text-indigo-600 font-semibold hover:bg-indigo-50 transition-all group"
              >
                Create an account
                <Sparkles className="ml-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
              </Link>
            </form>
          </div>

          {/* Trust Indicators */}
          <div className="mt-8 flex justify-center items-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              <span>Secure</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-500" />
              <span>Trusted by 10k+ businesses</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Feature Panel */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-12 items-center justify-center relative overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
        </div>

        <div className="relative max-w-lg">
          {/* Main Graphic */}
          <div className="mb-12 relative">
            <div className="absolute inset-0 bg-white/20 rounded-3xl blur-3xl"></div>
            <div className="relative bg-white/10 backdrop-blur rounded-3xl p-8 border border-white/20">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/20 backdrop-blur rounded-xl p-4 text-center">
                  <BarChart3 className="h-8 w-8 text-white mx-auto mb-2" />
                  <p className="text-white text-sm font-medium">
                    Real-time Reports
                  </p>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-xl p-4 text-center">
                  <CreditCard className="h-8 w-8 text-white mx-auto mb-2" />
                  <p className="text-white text-sm font-medium">
                    Easy Payments
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-white mb-2">
                  $124,847
                </div>
                <div className="text-white/80 text-sm">Monthly Revenue</div>
                <div className="mt-4 flex items-center justify-center gap-2 text-green-300">
                  <TrendingUp className="h-5 w-5" />
                  <span className="font-medium">+23.5% from last month</span>
                </div>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className="space-y-6">
            <h3 className="text-3xl font-bold text-white text-center mb-8">
              Everything you need to manage your finances
            </h3>
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 text-white">
                <div className="flex-shrink-0 p-3 bg-white/20 backdrop-blur rounded-xl">
                  <feature.icon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg">{feature.title}</h4>
                  <p className="text-white/80 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
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
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes bounce-slow {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
    20%, 40%, 60%, 80% { transform: translateX(2px); }
  }
  @keyframes modal-slide-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .animate-float {
    animation: float 6s ease-in-out infinite;
  }
  .animate-float-delayed {
    animation: float-delayed 6s ease-in-out infinite;
    animation-delay: 3s;
  }
  .animate-spin-slow {
    animation: spin-slow 20s linear infinite;
  }
  .animate-bounce-slow {
    animation: bounce-slow 3s ease-in-out infinite;
  }
  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }
  .animate-modal-slide-up {
    animation: modal-slide-up 0.3s ease-out;
  }
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
`}</style>
      {/* Forgot Password Modal */}
{/* Forgot Password Modal */}
{showForgotModal && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full transform transition-all animate-modal-slide-up">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 rounded-t-3xl">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-white/20 backdrop-blur mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white">Reset Your Password</h3>
          <p className="text-indigo-100 mt-2 text-sm">
            We'll send you a link to reset your password
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Spam notice */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-800 font-medium">Check your spam folder</p>
              <p className="text-xs text-amber-700 mt-1">
                Reset emails sometimes end up in spam. Make sure to check there and mark as "Not Spam" if you find it.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleForgotPassword}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                placeholder="Enter your email address"
                required
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 ml-1">
              Enter the email associated with your account
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(false);
                setResetEmail('');
              }}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetLoading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg transform transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {resetLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Sending...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Send Reset Link
                </div>
              )}
            </button>
          </div>
        </form>

        {/* Additional help text */}
        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Remember your password? {' '}
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="text-indigo-600 hover:text-indigo-500 font-medium"
            >
              Back to login
            </button>
          </p>
        </div>
      </div>
    </div>
  </div>
)}

{/* Success Message Toast - Update this too */}
{showSuccessMessage && (
  <div className="fixed top-4 right-4 z-50 transform transition-all duration-300 ease-in-out animate-slide-in">
    <div className="bg-white rounded-xl shadow-2xl border border-green-100 p-4 max-w-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-gray-900">Email Sent!</h3>
          <p className="text-sm text-gray-600 mt-1">{successMessage}</p>
          <p className="text-xs text-gray-500 mt-2">
            Don't forget to check your spam folder
          </p>
        </div>
        <button
          onClick={() => setShowSuccessMessage(false)}
          className="ml-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};
