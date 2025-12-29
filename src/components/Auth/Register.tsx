// src/components/Auth/Register.tsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { registrationService } from "../../services/registrationService";
import { supabase } from "../../services/supabaseClient";
import { TeamJoinFlow } from "./TeamJoinFlow";
import { BetaBadge } from "../Common/BetaBadge";
import {
  AlertCircle,
  ArrowRight,
  Chrome,
  Facebook,
  Linkedin,
  Building,
  CheckCircle,
  Mail,
  Lock,
  Loader2,
  User,
  Users,
  ChevronRight,
  Eye,
  EyeOff,
  TrendingUp,
  PieChart,
  Receipt,
  Shield,
  Calculator,
  BarChart3,
  DollarSign,
  FileText,
  Coins,
  Wallet,
  CreditCard,
  Building2,
  Sparkles,
} from "lucide-react";

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [inviteCode] = useState(
    new URLSearchParams(location.search).get("invite") || undefined
  );
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [checkingInvite, setCheckingInvite] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  // Mobile animated background states
  const [currentThemeIndex, setCurrentThemeIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Theme configurations with brand colors
  const mobileThemes = [
    {
      background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)', // Purple
      text: "Join thousands of businesses",
      textColor: '#FFFFFF',
      accentColor: '#C4B5FD'
    },
    {
      background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)', // Dark slate
      text: "Start your free trial",
      textColor: '#F1F5F9',
      accentColor: '#C4B5FD'
    },
    {
      background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)', // Mint green
      text: "Save time, grow faster",
      textColor: '#EC4899',
      accentColor: '#EC4899'
    },
    {
      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', // Emerald green
      text: "Your AI CFO awaits",
      textColor: '#FDE68A',
      accentColor: '#FDE68A'
    },
    {
      background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', // Indigo
      text: "60 days free trial",
      textColor: '#FFFFFF',
      accentColor: '#A5B4FC'
    },
    {
      background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', // Amber/Orange
      text: "No credit card required",
      textColor: '#FFFFFF',
      accentColor: '#FCD34D'
    },
    {
      background: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)', // Teal
      text: "Setup in 5 minutes",
      textColor: '#FFFFFF',
      accentColor: '#5EEAD4'
    },
    {
      background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', // Violet
      text: "Bank-level security",
      textColor: '#FFFFFF',
      accentColor: '#DDD6FE'
    }
  ];

  // Cycle through themes every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentThemeIndex((prev) => (prev + 1) % mobileThemes.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [mobileThemes.length]);

  const currentTheme = mobileThemes[currentThemeIndex];

  useEffect(() => {
    if (inviteCode) {
      checkInvitation();
    }
  }, [inviteCode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const checkInvitation = async () => {
    if (!inviteCode) return;

    setCheckingInvite(true);
    try {
      // Query pending_invites table without joins
      const { data, error } = await supabase
        .from("pending_invites")
        .select("*")
        .eq("invite_code", inviteCode)
        .eq("accepted", false)
        .gte("expires_at", new Date().toISOString())
        .single();

      if (error || !data) {
        console.error("Invitation check error:", error);
        setError("Invalid or expired invitation code.");
        return;
      }

      // Get team owner's company name from profiles
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('company_name, full_name')
        .eq('id', data.team_id)
        .single();

      // Get inviter's profile
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', data.invited_by)
        .single();

      setInviteDetails({
        ...data,
        teamName: ownerProfile?.company_name || ownerProfile?.full_name || 'the team',
        inviterName: inviterProfile?.full_name || inviterProfile?.email || 'Team admin',
      });

      setFormData((prev) => ({
        ...prev,
        email: data.email,
      }));
    } catch (err: any) {
      console.error("Invitation check error:", err);
      setError("Failed to validate invitation. Please try again.");
    } finally {
      setCheckingInvite(false);
    }
  };

  // Social authentication handlers
  const handleSocialAuth = async (provider: 'google' | 'facebook' | 'linkedin_oidc') => {
    setSocialLoading(provider);
    try {
      // OAuth users are always "remembered" - set the flag before redirect
      // This ensures consistent behavior and the user stays logged in after page reload
      localStorage.setItem('smartcfo-remember-me', 'true');

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

      console.log(`🚀 Starting ${provider} authentication with redirect:`, redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: redirectUrl,
          queryParams: inviteCode ? { invite: inviteCode } : undefined,
        }
      });

      if (error) {
        console.error(`${provider} auth error:`, error);
        throw error;
      }

      console.log(`✅ ${provider} auth initiated successfully`);
    } catch (err: any) {
      console.error(`${provider} authentication error:`, err);
      setError(err.message || `${provider} authentication failed. Please try again.`);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      if (formData.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      if (inviteDetails && formData.email !== inviteDetails.email) {
        throw new Error(`This invitation is for ${inviteDetails.email}`);
      }

      // FIXED: Remove hardcoded defaults - let SetupWizard handle these
      const result = await registrationService.register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        plan: "simple_start", // Default plan
        interval: "monthly", // Default interval
        inviteCode: inviteCode || undefined,
        // REMOVED: hardcoded country, companyName, state
      });

      if (!result.success) {
        throw new Error(result.error || "Registration failed");
      }

      // All users go through SmartRedirect for proper routing
      navigate("/"); // SmartRedirect will handle setup vs dashboard routing
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || "Registration failed. Please try again.");
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

  // If user has valid invite, show simplified TeamJoinFlow
  if (inviteDetails && inviteCode) {
    return (
      <TeamJoinFlow
        inviteDetails={inviteDetails}
        inviteCode={inviteCode}
      />
    );
  }

  // Regular registration flow
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Registration Form */}
      <div
        className="flex-1 flex items-center justify-center lg:bg-gradient-to-br lg:from-indigo-50 lg:via-white lg:to-purple-50 p-8 relative overflow-hidden transition-all duration-700"
        style={{
          background: isMobile ? currentTheme.background : undefined
        }}
      >
        {/* Floating Background Elements - Desktop only */}
        <div className="hidden lg:block absolute inset-0 overflow-hidden pointer-events-none">
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

        {/* Mobile - Animated Text (ChatGPT style) - Centered in screen */}
        <div className="lg:hidden absolute inset-0 flex items-center justify-center pointer-events-none px-6" style={{ paddingBottom: '200px', perspective: '1000px' }}>
          <h1
            key={currentThemeIndex}
            className="text-4xl sm:text-5xl font-bold flex items-center justify-center gap-3 text-center leading-tight animate-split-flip"
            style={{
              color: currentTheme.textColor,
              transformStyle: 'preserve-3d'
            }}
          >
            {currentTheme.text}
            <span
              className="inline-block w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0 animate-dot-pulse"
              style={{ backgroundColor: currentTheme.accentColor }}
            ></span>
          </h1>
        </div>

        {/* Desktop - Full Form */}
        <div className="hidden lg:block w-full max-w-md relative">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
              <img src="https://ik.imagekit.io/mctozv7td/SmartCFO/smartcfo%20logo%20bg.png?updatedAt=1752387790717" alt="SmartCFO" className="h-8 w-8" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <h2 className="text-3xl font-bold text-gray-900">
                {inviteDetails ? `Join ${inviteDetails.teamName}` : "Create your account"}
              </h2>
              <BetaBadge size="medium" variant="subtle" />
            </div>
            <p className="mt-2 text-gray-600">
              {inviteDetails
                ? `You've been invited to join ${inviteDetails.teamName} as a ${inviteDetails.role}`
                : "Start your free 60-day trial"
              }
            </p>
          </div>

          {/* Registration Form Card */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white">
            {/* Invitation Banner */}
            {inviteDetails && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Team Invitation</p>
                    <p className="text-xs text-blue-700">Complete registration to join the team</p>
                  </div>
                </div>
              </div>
            )}

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

            {/* Social Auth Buttons */}
            {!showEmailForm && (
              <>
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
                        <span className="text-gray-600 font-medium text-lg">Creating account...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                        </div>
                        <span className="text-gray-700 font-medium text-lg group-hover:text-gray-900 transition-colors">
                          Sign up with Google
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
                        <span className="text-blue-600 font-medium text-lg">Creating account...</span>
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
                        <span className="text-blue-700 font-medium text-lg">Creating account...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 bg-[#0A66C2] rounded flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                          </svg>
                        </div>
                        <span className="text-gray-700 font-medium text-lg group-hover:text-blue-700 transition-colors">
                          Sign up with LinkedIn
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

                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-[1.02] shadow-lg shadow-indigo-500/25 font-medium"
                >
                  <Mail className="h-5 w-5" />
                  <span>Use Email Address</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Email Registration Form */}
            {showEmailForm && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      First Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        required
                        value={formData.firstName}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                        placeholder="John"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="lastName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Last Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        required
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!!inviteDetails}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                      placeholder="••••••••"
                      minLength={6}
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

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || checkingInvite}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-[1.02] shadow-lg shadow-indigo-500/25 font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Back to options
                  </button>
                </div>
              </form>
            )}

            {/* Terms and Sign In Link */}
            <div className="mt-6 text-center space-y-4">
              <p className="text-xs text-gray-600">
                By creating an account, you agree to our{" "}
                <Link
                  to="/terms"
                  className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  to="/privacy"
                  className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  Privacy Policy
                </Link>
              </p>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile - Bottom Container with Registration Options */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-black rounded-t-[2rem] px-6 pt-6 pb-safe shadow-2xl pointer-events-auto max-h-[85vh] overflow-y-auto" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!showEmailForm ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleSocialAuth('google')}
                disabled={socialLoading === 'google'}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white rounded-2xl hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {socialLoading === 'google' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                    <span className="text-gray-900 font-medium">Creating account...</span>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                    </div>
                    <span className="text-gray-900 font-medium flex-1 text-left">
                      Sign up with Google
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSocialAuth('linkedin_oidc')}
                disabled={socialLoading === 'linkedin'}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white rounded-2xl hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {socialLoading === 'linkedin' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                    <span className="text-gray-900 font-medium">Creating account...</span>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 bg-[#0A66C2] rounded flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                    </div>
                    <span className="text-gray-900 font-medium flex-1 text-left">
                      Sign up with LinkedIn
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowEmailForm(!showEmailForm)}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white rounded-2xl hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                <Mail className="h-5 w-5 text-gray-600" />
                <span className="text-gray-900 font-medium flex-1 text-left">
                  Sign up with Email
                </span>
              </button>

              <div className="pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400 text-center">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="font-semibold text-white hover:text-gray-200 transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div className="pt-4 pb-2 space-y-4 animate-slide-down">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-500"
                    placeholder="First name"
                  />
                  <input
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-500"
                    placeholder="Last name"
                  />
                </div>

                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-500"
                  placeholder="Email address"
                />

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-500"
                    placeholder="Password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-500"
                    placeholder="Confirm password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Creating account...
                    </div>
                  ) : (
                    'Create Account'
                  )}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  By signing up, you agree to our{" "}
                  <Link to="/terms" className="text-gray-300 hover:text-white transition-colors">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-gray-300 hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </p>

                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="w-full text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Back to options
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Features Panel (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-white/10 blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10">
          {/* <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Calculator className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">SmartCFO</h1>
          </div> */}

          <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
            Start Managing Your
            <br />
            Finances Smarter
          </h2>

          <p className="text-white/80 text-lg mb-12 leading-relaxed">
            Join thousands of businesses using AI-powered
            <br />
            accounting to save time and grow faster
          </p>

          <div className="space-y-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/15 transition-colors"
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-white/70 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-12">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Shield className="h-4 w-4" />
            <span>256-bit SSL Encryption</span>
            <span className="mx-2">•</span>
            <span>SOC 2 Compliant</span>
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
  @keyframes slide-down {
    from {
      opacity: 0;
      max-height: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      max-height: 800px;
      transform: translateY(0);
    }
  }
  @keyframes split-flip {
    0% {
      opacity: 0;
      transform: rotateY(-90deg) scale(0.8);
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 1;
      transform: rotateY(0deg) scale(1);
    }
  }
  @keyframes dot-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.8;
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
  .animate-slide-down {
    animation: slide-down 0.3s ease-out;
  }
  .animate-split-flip {
    animation: split-flip 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .animate-dot-pulse {
    animation: dot-pulse 0.8s ease-in-out;
  }
`}</style>
    </div>
  );
};