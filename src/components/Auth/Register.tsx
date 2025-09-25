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

  // Social authentication handlers
  const handleSocialAuth = async (provider: 'google' | 'facebook' | 'linkedin') => {
    setSocialLoading(provider);
    try {
      // Use environment variable for redirect URL, fallback to current origin
      const redirectUrl = process.env.REACT_APP_SITE_URL || window.location.origin;
      console.log('OAuth redirect URL:', redirectUrl); // Debug log

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
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

  // Accounting feature highlights
  const features = [
    {
      icon: TrendingUp,
      title: "Track Growth",
      description: "Real-time financial insights",
    },
    {
      icon: Receipt,
      title: "Smart Invoicing",
      description: "Professional invoices in seconds",
    },
    {
      icon: PieChart,
      title: "Visual Reports",
      description: "Beautiful charts & analytics",
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Bank-level encryption",
    },
  ];

  useEffect(() => {
    if (inviteCode) {
      checkInvitation();
    }
  }, [inviteCode]);

  const checkInvitation = async () => {
    if (!inviteCode) return;

    setCheckingInvite(true);
    setError("");

    try {
      await supabase.auth.signOut();

      const result = await registrationService.validateInvitation(inviteCode);

      if (result.valid && result.invitation) {
        setInviteDetails({
          ...result.invitation,
          teamName: result.teamName,
        });
        setFormData((prev) => ({ ...prev, email: result.invitation.email }));
        setShowEmailForm(true); // Show email form for invited users
        setError("");
      } else {
        setError(result.error || "Invalid invitation");
      }
    } catch (err) {
      console.error("Error checking invitation:", err);
      setError("Failed to validate invitation. Please try again.");
    } finally {
      setCheckingInvite(false);
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

      const result = await registrationService.register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        // Default values - will be set in setup wizard
        companyName: "",
        country: "US",
        state: "",
        plan: "simple_start", // Default plan
        interval: "monthly", // Default interval
        inviteCode: inviteCode || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || "Registration failed");
      }

      // Redirect to setup wizard for new users, dashboard for invited users
      if (inviteDetails) {
        navigate("/dashboard");
      } else {
        navigate("/setup");
      }
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
              {inviteDetails ? "Join Your Team" : "Create Your Account"}
            </h2>
            <p className="mt-3 text-lg text-gray-600">
              {inviteDetails
                ? `You've been invited to join ${inviteDetails.teamName}`
                : "Start your 30-day free trial today"}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-xl flex items-start animate-shake">
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {!showEmailForm && !inviteDetails ? (
              /* Social Login Options */
              <div className="space-y-6">
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => handleSocialAuth('google')}
                    disabled={socialLoading === 'google'}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {socialLoading === 'google' ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
                        <span className="text-gray-600 font-medium text-lg">Connecting...</span>
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

                  <button
                    type="button"
                    onClick={() => handleSocialAuth('facebook')}
                    disabled={socialLoading === 'facebook'}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {socialLoading === 'facebook' ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="text-blue-600 font-medium text-lg">Connecting...</span>
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
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialAuth('linkedin')}
                    disabled={socialLoading === 'linkedin'}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {socialLoading === 'linkedin' ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
                        <span className="text-blue-700 font-medium text-lg">Connecting...</span>
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

                {/* Continue with Email Button */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500 font-medium">
                      or
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-indigo-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-200 group"
                >
                  <Mail className="h-6 w-6 text-indigo-600" />
                  <span className="text-indigo-700 font-medium text-lg group-hover:text-indigo-800 transition-colors">
                    Continue with Email
                  </span>
                  <ChevronRight className="h-5 w-5 text-indigo-600 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ) : (
              /* Email Registration Form */
              <form onSubmit={handleSubmit} className="space-y-6">
                {!inviteDetails && (
                  <div className="flex items-center justify-between mb-6">
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back to options
                    </button>
                    <h3 className="text-lg font-semibold text-gray-900">Create Account</h3>
                    <div></div>
                  </div>
                )}

                <div className="space-y-6">
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
                          placeholder="Min 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                          placeholder="Confirm password"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button for Email Form */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-4 text-white font-bold shadow-2xl hover:shadow-3xl transform transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <div className="relative flex items-center justify-center">
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin h-5 w-5 mr-3" />
                          <span className="text-lg">
                            {inviteDetails ? 'Joining your team...' : 'Creating your account...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-lg mr-3">
                            {inviteDetails ? 'Join Team' : 'Create Account'}
                          </span>
                          <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </form>
            )}

            {/* Sign In Link */}
            <p className="text-center text-sm text-gray-600 mt-6">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Trust Indicators */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 mb-4">
              Join 10,000+ businesses managing their finances with SmartCFO
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span className="text-xs sm:text-sm text-gray-600">30-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                <span className="text-xs sm:text-sm text-gray-600">
                  No credit card required
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-emerald-600" />
                <span className="text-xs sm:text-sm text-gray-600">Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Feature Showcase */}
      <div className="hidden xl:flex xl:flex-1 lg:max-w-md bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 lg:p-12 items-center justify-center relative overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.41l-2.83 2.83-1.41-1.41L38.59 0H40v1.41zM20 18.6l2.83-2.83 1.41 1.41L21.41 20l2.83 2.83-1.41 1.41L20 21.41l-2.83 2.83-1.41-1.41L18.59 20l-2.83-2.83 1.41-1.41L20 18.59z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          ></div>
        </div>

        <div className="relative max-w-sm">
          {/* Animated Dashboard Preview */}
          <div className="mb-12 relative">
            <div className="absolute inset-0 bg-white/20 rounded-3xl blur-3xl"></div>
            <div className="relative bg-white/10 backdrop-blur rounded-3xl p-8 border border-white/20">
              {/* Mock Dashboard Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/20 backdrop-blur rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="h-5 w-5 text-emerald-300" />
                    <span className="text-xs text-emerald-300">+15.3%</span>
                  </div>
                  <p className="text-2xl font-bold text-white">$48,574</p>
                  <p className="text-xs text-white/70">Monthly Revenue</p>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Receipt className="h-5 w-5 text-blue-300" />
                    <span className="text-xs text-blue-300">+8 new</span>
                  </div>
                  <p className="text-2xl font-bold text-white">142</p>
                  <p className="text-xs text-white/70">Total Invoices</p>
                </div>
              </div>

              {/* Mock Chart */}
              <div className="bg-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-white">
                    Revenue Growth
                  </h4>
                  <BarChart3 className="h-4 w-4 text-white/70" />
                </div>
                <div className="flex items-end gap-1 h-24">
                  {[40, 65, 45, 75, 55, 85, 70, 90].map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-indigo-400 to-purple-400 rounded-t opacity-80"
                      style={{ height: `${height}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className="space-y-6">
            <h3 className="text-3xl font-bold text-white text-center mb-8">
              Everything you need to succeed
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
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-blob {
          animation: blob 10s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
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
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        .shadow-3xl {
          box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  );
};