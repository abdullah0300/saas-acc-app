import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../services/supabaseClient";
import {
  Mail,
  Lock,
  Loader,
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

  const handleForgotPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  setResetLoading(true);
  
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
  redirectTo: `${process.env.REACT_APP_SITE_URL || window.location.origin}/reset-password`,
});
    
    if (error) throw error;
    
    alert('Password reset email sent! Check your inbox.');
    setShowForgotModal(false);
    setResetEmail('');
  } catch (error: any) {  // Fix error type
    alert('Error: ' + error.message);
  } finally {
    setResetLoading(false);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      navigate("/dashboard");
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
      `}</style>
      {/* Forgot Password Modal */}
{showForgotModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
      <div className="text-center mb-6">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-4">
          <Mail className="h-6 w-6 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
        <p className="text-sm text-gray-600 mt-2">
          Enter your email and we'll send you a link to reset your password
        </p>
      </div>

      <form onSubmit={handleForgotPassword}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter your email address"
              required
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setShowForgotModal(false);
              setResetEmail('');
            }}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
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
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                Sending...
              </div>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
    </div>
  );
};
