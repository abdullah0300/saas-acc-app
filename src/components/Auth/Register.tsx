import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { registrationService } from "../../services/registrationService";
import { supabase } from "../../services/supabaseClient";
import {
  Building2,
  Mail,
  Lock,
  User,
  Globe,
  MapPin,
  CreditCard,
  Check,
  AlertCircle,
  Star,
  Zap,
  Rocket,
  Building,
  Loader2,
  Eye,
  EyeOff,
  ChevronRight,
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
  Phone,
  CheckCircle,
  Trophy,
  Gift,
} from "lucide-react";
import { countries, CountryData } from "../../data/countries";

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  icon: any;
  features: string[];
  highlighted?: string[];
  popular?: boolean;
  limits: {
    users: number;
    monthlyInvoices: number;
  };
}

// Your actual plans matching subscription_plan_new enum
const PLANS: Plan[] = [
  {
    id: "simple_start",
    name: "Simple Start",
    monthlyPrice: 5,
    yearlyPrice: 48, // 20% off
    icon: Star,
    features: [
      "Single user access",
      "Up to 50 monthly invoices",
      "Income & expense tracking",
      "Basic financial reports",
      "Client management",
      "PDF export",
      "Email support",
    ],
    highlighted: ["Single user access", "Up to 50 monthly invoices"],
    limits: {
      users: 1,
      monthlyInvoices: 50,
    },
  },
  {
    id: "essentials",
    name: "Essentials",
    monthlyPrice: 25,
    yearlyPrice: 240, // 20% off
    icon: Zap,
    popular: true,
    features: [
      "Up to 3 team members",
      "Unlimited monthly invoices",
      "Everything in Simple Start",
      "Multi-currency support",
      "Recurring invoices",
      "Advanced reports",
      "Tax management",
      "Priority support",
    ],
    highlighted: ["Up to 3 team members", "Unlimited monthly invoices"],
    limits: {
      users: 3,
      monthlyInvoices: -1,
    },
  },
  {
    id: "plus",
    name: "Plus",
    monthlyPrice: 45,
    yearlyPrice: 432, // 20% off
    icon: Rocket,
    features: [
      "Up to 10 team members",
      "Unlimited monthly invoices",
      "Everything in Essentials",
      "Custom invoice branding",
      "Budget tracking",
      "Cash flow analysis",
      "Phone & email support",
      "Audit trail",
      "Team permissions",
    ],
    highlighted: ["Up to 10 team members", "Phone & email support"],
    limits: {
      users: 10,
      monthlyInvoices: -1,
    },
  },
];

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
  const [currentStep, setCurrentStep] = useState(1); // Multi-step form

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    companyName: "",
    country: "US",
    state: "",
    plan: "essentials",
    interval: "monthly" as "monthly" | "yearly",
  });

  // Get selected country data
  const selectedCountry = countries.find((c) => c.code === formData.country);
  const hasStates =
    selectedCountry?.states && selectedCountry.states.length > 0;

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

      // Skip state validation for invited users
      if (!inviteDetails && hasStates && !formData.state) {
        throw new Error("Please select a state/province");
      }

      const result = await registrationService.register({
        ...formData,
        inviteCode: inviteCode || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || "Registration failed");
      }

      navigate("/dashboard");
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

    if (name === "country" && value !== formData.country) {
      setFormData((prev) => ({ ...prev, state: "" }));
    }
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
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

  // If this is a team member registration, show simplified form
  if (inviteDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Join {inviteDetails.teamName}</h2>
              <p className="text-gray-600 mt-2">
                You've been invited as a {inviteDetails.role} to join the team
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
                />
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all transform hover:scale-[1.02]"
                >
                  {loading ? "Creating Account..." : "Join Team"}
                </button>
              </div>
            </form>

            <p className="text-center text-sm text-gray-600 mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
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

        <div className="w-full max-w-4xl relative">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {inviteDetails ? "Join Your Team" : "Start Your Free Trial"}
            </h2>
            <p className="mt-3 text-lg text-gray-600">
              {inviteDetails
                ? `You've been invited to join ${inviteDetails.teamName}`
                : "30-day free trial • No credit card required • Cancel anytime"}
            </p>
          </div>

          {/* Progress Steps */}
          {!inviteDetails && (
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    currentStep >= 1
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  <span className="text-sm font-semibold">1</span>
                </div>
                <div
                  className={`w-24 h-1 ${currentStep >= 2 ? "bg-indigo-600" : "bg-gray-200"}`}
                ></div>
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    currentStep >= 2
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  <span className="text-sm font-semibold">2</span>
                </div>
                <div
                  className={`w-24 h-1 ${currentStep >= 3 ? "bg-indigo-600" : "bg-gray-200"}`}
                ></div>
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    currentStep >= 3
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  <span className="text-sm font-semibold">3</span>
                </div>
              </div>
            </div>
          )}

          {/* Form Card */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-xl flex items-start animate-shake">
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Account Details */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
                      <User className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Create Your Account
                    </h3>
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

                  {!inviteDetails && (
                    <button
                      type="button"
                      onClick={nextStep}
                      className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-3 text-white font-semibold shadow-lg hover:shadow-xl transform transition-all hover:scale-[1.02]"
                    >
                      <div className="relative flex items-center justify-center">
                        Next: Personal Info
                        <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Step 2: Personal Information */}
              {currentStep === 2 && !inviteDetails && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Personal Information
                    </h3>
                  </div>

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
                      htmlFor="companyName"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Company Name{" "}
                      <span className="text-gray-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                      placeholder="Acme Inc."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label
                        htmlFor="country"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Country
                      </label>
                      <select
                        id="country"
                        name="country"
                        required
                        value={formData.country}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all appearance-none"
                      >
                        {countries.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {hasStates && (
                      <div>
                        <label
                          htmlFor="state"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          State/Province
                        </label>
                        <select
                          id="state"
                          name="state"
                          required
                          value={formData.state}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all appearance-none"
                        >
                          <option value="">Select state/province</option>
                          {selectedCountry?.states?.map((state) => (
                            <option key={state.code} value={state.code}>
                              {state.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="flex-1 px-8 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={nextStep}
                      className="flex-1 group relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-3 text-white font-semibold shadow-lg hover:shadow-xl transform transition-all hover:scale-[1.02]"
                    >
                      <div className="relative flex items-center justify-center">
                        Next: Choose Plan
                        <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Plan Selection */}
              {currentStep === 3 && !inviteDetails && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Choose Your Plan
                    </h3>
                  </div>

                  {/* Billing Toggle */}
                  <div className="flex justify-center mb-8">
                    <div className="bg-gray-100 p-1 rounded-lg inline-flex relative">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            interval: "monthly",
                          }))
                        }
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                          formData.interval === "monthly"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            interval: "yearly",
                          }))
                        }
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                          formData.interval === "yearly"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        Yearly
                      </button>
                      {formData.interval === "yearly" && (
                        <span className="absolute -top-3 right-0 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          Save 20%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Plans Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                    {PLANS.map((plan) => {
                      const isSelected = formData.plan === plan.id;
                      const Icon = plan.icon;
                      const price =
                        formData.interval === "monthly"
                          ? plan.monthlyPrice
                          : plan.yearlyPrice;
                      const yearlyPrice = plan.yearlyPrice;
                      const savings = plan.monthlyPrice * 12 - yearlyPrice;

                      return (
                        <div
                          key={plan.id}
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, plan: plan.id }))
                          }
                          className={`relative rounded-2xl cursor-pointer transition-all ${
                            plan.popular
                              ? "bg-gradient-to-b from-indigo-500 to-purple-600 text-white shadow-xl transform scale-105 p-1"
                              : isSelected && !plan.popular
                                ? "border-2 border-indigo-500 bg-white"
                                : "border border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          {plan.popular && (
                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                              <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                MOST POPULAR
                              </div>
                            </div>
                          )}

                          <div
                            className={`${plan.popular ? "bg-white rounded-xl" : ""} p-4 lg:p-6`}
                          >
                            {/* Icon and Name */}
                            <div className="text-center mb-6">
                              <div
                                className={`inline-flex p-3 rounded-full mb-4 ${
                                  plan.popular ? "bg-indigo-100" : "bg-gray-100"
                                }`}
                              >
                                <Icon
                                  className={`h-6 w-6 ${plan.popular ? "text-indigo-600" : "text-gray-700"}`}
                                />
                              </div>

                              <h4
                                className={`text-xl font-bold ${plan.popular ? "text-gray-900" : "text-gray-900"}`}
                              >
                                {plan.name}
                              </h4>
                            </div>

                            {/* Pricing */}
                            <div className="text-center mb-6">
                              <div className="flex items-baseline justify-center gap-1">
                                <span className="text-4xl font-bold text-gray-900">
                                  $
                                  {formData.interval === "yearly"
                                    ? yearlyPrice
                                    : plan.monthlyPrice}
                                </span>
                                <span className="text-gray-500">
                                  /
                                  {formData.interval === "yearly"
                                    ? "year"
                                    : "month"}
                                </span>
                              </div>

                              {formData.interval === "yearly" && (
                                <p className="text-sm text-emerald-600 mt-2">
                                  Save ${savings} per year
                                </p>
                              )}
                            </div>

                            {/* User and Invoice Limits */}
                            <div className="flex justify-center gap-6 mb-6 pb-6 border-b border-gray-200">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-600">
                                  {plan.limits.users === 1
                                    ? "Just you"
                                    : `${plan.limits.users} users`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-600">
                                  {plan.limits.monthlyInvoices === -1
                                    ? "Unlimited"
                                    : `${plan.limits.monthlyInvoices}/mo`}
                                </span>
                              </div>
                            </div>

                            {/* Features List */}
                            <ul className="space-y-3">
                              {plan.features
                                .slice(0, 5)
                                .map((feature, index) => {
                                  const isHighlighted =
                                    plan.highlighted?.includes(feature);
                                  return (
                                    <li
                                      key={index}
                                      className="flex items-start text-sm"
                                    >
                                      <Check className="h-5 w-5 mr-2 text-emerald-500 flex-shrink-0" />
                                      <span
                                        className={
                                          isHighlighted
                                            ? "text-gray-900 font-medium"
                                            : "text-gray-600"
                                        }
                                      >
                                        {feature}
                                      </span>
                                    </li>
                                  );
                                })}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="flex-1 px-8 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 group relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-3 text-white font-semibold shadow-lg hover:shadow-xl transform transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      <div className="relative flex items-center justify-center">
                        {loading ? (
                          <>
                            <Loader2 className="animate-spin h-5 w-5 mr-3" />
                            Creating account...
                          </>
                        ) : (
                          <>
                            Start Free Trial
                            <Gift className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Sign In Link */}
              <p className="text-center text-sm text-gray-600">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all"
                >
                  Sign in
                </Link>
              </p>
            </form>

            {/* Trust Indicators */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500 mb-4">
                Join 10,000+ businesses managing their finances with SmartCFO
              </p>
              <div className="flex justify-center items-center gap-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm text-gray-600">30-day free trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm text-gray-600">
                    No credit card required
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm text-gray-600">Cancel anytime</span>
                </div>
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
            {features.map((feature: { icon: React.ComponentType<any>; title: string; description: string }, index: number) => (
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
      `}</style>
    </div>
  );
};