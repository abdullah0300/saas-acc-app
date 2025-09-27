// src/components/Auth/Register.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { registrationService } from "../../services/registrationService";
import { supabase } from "../../services/supabaseClient";
import {
  Mail,
  Lock,
  User,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Shield,
  Calculator,
  TrendingUp,
  PieChart,
  BarChart3,
  Receipt,
  DollarSign,
  FileText,
  Coins,
  Wallet,
  Users,
  CheckCircle,
  Gift,
  Chrome,
  Facebook,
  Linkedin,
} from "lucide-react";

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [checkingInvite, setCheckingInvite] = useState(!!inviteCode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Simplified form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });

  // Check invitation on mount
  useEffect(() => {
    if (inviteCode) {
      checkInvitation();
    }
  }, [inviteCode]);

  const checkInvitation = async () => {
    if (!inviteCode) return;

    setCheckingInvite(true);
    try {
      const validation = await registrationService.validateInvitation(inviteCode);
      if (validation.valid && validation.invitation) {
        setInviteDetails({
          email: validation.invitation.email,
          teamName: validation.teamName,
          role: validation.invitation.role
        });
        setFormData(prev => ({ ...prev, email: validation.invitation.email }));
      } else {
        setError(validation.error || "Invalid invitation. Please try again.");
      }
    } catch (err: any) {
      console.error("Invitation check error:", err);
      setError("Failed to validate invitation. Please try again.");
    } finally {
      setCheckingInvite(false);
    }
  };

  // Social authentication handlers
  const handleSocialAuth = async (provider: 'google' | 'facebook' | 'linkedin') => {
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (checkingInvite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse">
              <div className="h-16 w-16 mx-auto rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 opacity-20 blur-xl"></div>
            </div>
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto relative" />
          </div>
          <p className="mt-4 text-gray-600 font-medium">
            Checking invitation...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Registration Form */}
      <div className="flex-1 lg:flex-[2] flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-1/2 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

          {/* Floating Icons */}
          <div className="absolute top-10 right-10 text-indigo-200 animate-spin-slow">
            <Calculator className="h-10 w-10" />
          </div>
          <div className="absolute bottom-10 left-10 text-purple-200 animate-bounce-slow">
            <Coins className="h-8 w-8" />
          </div>
          <div className="absolute top-1/2 right-20 text-pink-200 animate-float">
            <Receipt className="h-6 w-6" />
          </div>
        </div>

        <div className="w-full max-w-md relative">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {inviteDetails ? `Join ${inviteDetails.teamName}` : "Start Your Journey"}
            </h2>
            <p className="text-gray-600 mt-2 font-medium">
              {inviteDetails 
                ? `You've been invited to join ${inviteDetails.teamName} as a ${inviteDetails.role}`
                : "AI-powered accounting made simple"
              }
            </p>
          </div>

          {/* Invitation Banner */}
          {inviteDetails && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
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

          {/* Social Auth Buttons */}
          {!showEmailForm && (
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => handleSocialAuth('google')}
                disabled={socialLoading === 'google'}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {socialLoading === 'google' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                ) : (
                  <Chrome className="h-5 w-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                )}
                <span className="font-medium text-gray-700">Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialAuth('facebook')}
                disabled={socialLoading === 'facebook'}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {socialLoading === 'facebook' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                ) : (
                  <Facebook className="h-5 w-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                )}
                <span className="font-medium text-gray-700">Continue with Facebook</span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialAuth('linkedin')}
                disabled={socialLoading === 'linkedin'}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {socialLoading === 'linkedin' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                ) : (
                  <Linkedin className="h-5 w-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
                )}
                <span className="font-medium text-gray-700">Continue with LinkedIn</span>
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-500 font-medium">
                    or continue with email
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg shadow-indigo-500/25"
              >
                <Mail className="h-5 w-5" />
                <span>Use Email Address</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Email Registration Form */}
          {showEmailForm && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="John"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="Doe"
                  />
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
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
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
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-indigo-500/25"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                  <span>{loading ? "Creating Account..." : "Create Account"}</span>
                  {!loading && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </form>
          )}

          {/* Sign In Link */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Feature Showcase (Desktop Only) */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20"></div>
          <div className="grid grid-cols-8 grid-rows-8 gap-4 h-full p-8">
            {Array.from({ length: 64 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/5 rounded-lg animate-pulse"
                style={{ animationDelay: `${i * 0.1}s` }}
              ></div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <div className="max-w-lg">
            <h3 className="text-3xl font-bold mb-6">
              Smart Accounting for Modern Businesses
            </h3>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-indigo-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2">AI-Powered Insights</h4>
                  <p className="text-gray-300 leading-relaxed">
                    Get intelligent recommendations and automated categorization to save hours of manual work.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <PieChart className="h-6 w-6 text-purple-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2">Real-time Reports</h4>
                  <p className="text-gray-300 leading-relaxed">
                    Track your financial health with live dashboards and detailed analytics.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="h-6 w-6 text-indigo-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg mb-2">Bank-Level Security</h4>
                  <p className="text-gray-300 leading-relaxed">
                    Your data is protected with enterprise-grade encryption and security measures.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full border-2 border-white"></div>
                <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full border-2 border-white"></div>
                <div className="w-8 h-8 bg-gradient-to-r from-pink-400 to-red-400 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <p className="text-sm text-gray-300">
                  Join 10,000+ businesses already using SmartCFO
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};