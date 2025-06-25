// src/components/Auth/Register.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { registrationService } from '../../services/registrationService';
import { supabase } from '../../services/supabaseClient';
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
  Sparkles
} from 'lucide-react';
import { countries, CountryData } from '../../data/countries';

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  icon: any;
  features: string[];
  highlighted?: string[];
  popular?: boolean;
}

// Your actual plans matching subscription_plan_new enum
const PLANS: Plan[] = [
  {
    id: 'simple_start',
    name: 'Simple Start',
    monthlyPrice: 5,
    yearlyPrice: 48, // 20% off
    icon: Star,
    features: [
      'Single user access',
      'Up to 50 monthly invoices',
      'Income & expense tracking',
      'Basic financial reports',
      'Client management',
      'PDF export',
      'Email support'
    ],
    highlighted: ['Single user access', 'Up to 50 monthly invoices']
  },
  {
    id: 'essentials',
    name: 'Essentials',
    monthlyPrice: 25,
    yearlyPrice: 240, // 20% off
    icon: Zap,
    popular: true,
    features: [
      'Up to 3 team members',
      'Unlimited monthly invoices',
      'Everything in Simple Start',
      'Multi-currency support',
      'Recurring invoices',
      'Advanced reports',
      'Tax management',
      'Priority support'
    ],
    highlighted: ['Up to 3 team members', 'Unlimited monthly invoices']
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: 45,
    yearlyPrice: 432, // 20% off
    icon: Rocket,
    features: [
      'Up to 10 team members',
      'Unlimited monthly invoices',
      'Everything in Essentials',
      'Custom invoice branding',
      'Budget tracking',
      'Cash flow analysis',
      'Phone & email support'
    ],
    highlighted: ['Up to 10 team members']
  }
];

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [checkingInvite, setCheckingInvite] = useState(!!inviteCode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    companyName: '',
    country: 'US',
    state: '',
    plan: 'essentials',
    interval: 'monthly' as 'monthly' | 'yearly'
  });

  // Get selected country data
  const selectedCountry = countries.find(c => c.code === formData.country);
  const hasStates = selectedCountry?.states && selectedCountry.states.length > 0;

  useEffect(() => {
    if (inviteCode) {
      checkInvitation();
    }
  }, [inviteCode]);

  const checkInvitation = async () => {
    if (!inviteCode) return;
    
    setCheckingInvite(true);
    setError(''); // Clear any previous errors
    
    try {
      // Clear any stale auth sessions first
      await supabase.auth.signOut();
      
      const result = await registrationService.validateInvitation(inviteCode);
      
      console.log('Invitation validation result:', result);
      
      if (result.valid && result.invitation) {
        setInviteDetails({
          ...result.invitation,
          teamName: result.teamName
        });
        setFormData(prev => ({ ...prev, email: result.invitation.email }));
        setError('');
      } else {
        setError(result.error || 'Invalid invitation');
      }
    } catch (err) {
      console.error('Error checking invitation:', err);
      setError('Failed to validate invitation. Please try again.');
    } finally {
      setCheckingInvite(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate form
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      if (inviteDetails && formData.email !== inviteDetails.email) {
        throw new Error(`This invitation is for ${inviteDetails.email}`);
      }

      if (hasStates && !formData.state) {
        throw new Error('Please select a state/province');
      }

      // Register user
      const result = await registrationService.register({
        ...formData,
        inviteCode: inviteCode || undefined
      });

      if (!result.success) {
        throw new Error(result.error || 'Registration failed');
      }

      // Success - navigate to dashboard
      navigate('/dashboard');
      
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear state when country changes
    if (name === 'country' && value !== formData.country) {
      setFormData(prev => ({ ...prev, state: '' }));
    }
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
          <p className="mt-4 text-gray-600 font-medium">Checking invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {inviteDetails ? 'Join Your Team' : 'Start Your Free Trial'}
          </h2>
          <p className="mt-3 text-lg text-gray-600">
            {inviteDetails 
              ? `You've been invited to join ${inviteDetails.teamName}`
              : '30-day free trial • No credit card required • Cancel anytime'}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden border border-white">
          <div className="px-8 py-10 sm:p-12">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-xl flex items-start animate-shake">
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
                    <User className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
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
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
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

                {/* Company Name */}
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name <span className="text-gray-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
                      placeholder="Acme Inc."
                    />
                  </div>
                </div>
              </div>

              {/* Location Section */}
              <div className="space-y-6 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg">
                    <Globe className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Location</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
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
                      {countries.map(country => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {hasStates && (
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
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
                        {selectedCountry?.states?.map(state => (
                          <option key={state.code} value={state.code}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Section */}
              <div className="space-y-6 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg">
                    <Lock className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Account Details</h3>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
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
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
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
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
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
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription Plans - Only show if not invited */}
              {!inviteDetails && (
                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Choose Your Plan</h3>
                  </div>

                  {/* Billing Toggle */}
                  <div className="flex justify-center mb-6">
                    <div className="bg-gray-100 p-1 rounded-xl inline-flex">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, interval: 'monthly' }))}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                          formData.interval === 'monthly'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, interval: 'yearly' }))}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                          formData.interval === 'yearly'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Yearly
                        <span className="ml-2 text-xs bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2 py-0.5 rounded-full">
                          Save 20%
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Plans Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {PLANS.map((plan) => {
                      const isSelected = formData.plan === plan.id;
                      const Icon = plan.icon;
                      
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setFormData(prev => ({ ...prev, plan: plan.id }))}
                          className={`relative rounded-2xl p-6 cursor-pointer transition-all transform hover:scale-105 ${
                            isSelected
                              ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl'
                              : 'bg-white border-2 border-gray-200 hover:border-indigo-300'
                          }`}
                        >
                          {plan.popular && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                              <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                                MOST POPULAR
                              </span>
                            </div>
                          )}
                          
                          <div className="text-center mb-6">
                            <div className={`inline-flex p-3 rounded-2xl mb-4 ${
                              isSelected ? 'bg-white/20' : 'bg-gradient-to-br from-indigo-100 to-purple-100'
                            }`}>
                              <Icon className={`h-8 w-8 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                            </div>
                            
                            <h4 className={`text-xl font-bold mb-2 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                              {plan.name}
                            </h4>
                            
                            <div className="flex items-baseline justify-center gap-1">
                              <span className={`text-3xl font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                ${formData.interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                              </span>
                              <span className={`text-sm ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                                /{formData.interval === 'monthly' ? 'month' : 'year'}
                              </span>
                            </div>
                          </div>
                          
                          <ul className="space-y-3">
                            {plan.features.slice(0, 5).map((feature, index) => {
                              const isHighlighted = plan.highlighted?.includes(feature);
                              return (
                                <li 
                                  key={index} 
                                  className={`flex items-start text-sm ${
                                    isSelected 
                                      ? 'text-white' 
                                      : isHighlighted 
                                        ? 'text-gray-900 font-medium' 
                                        : 'text-gray-600'
                                  }`}
                                >
                                  <Check className={`h-5 w-5 mr-3 mt-0.5 flex-shrink-0 ${
                                    isSelected ? 'text-white' : 'text-emerald-500'
                                  }`} />
                                  {feature}
                                </li>
                              );
                            })}
                          </ul>
                          
                          {isSelected && (
                            <div className="absolute inset-0 rounded-2xl ring-2 ring-indigo-600 ring-offset-4"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-4 text-white font-semibold shadow-xl hover:shadow-2xl transform transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <div className="relative flex items-center justify-center">
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-3" />
                      Creating your account...
                    </>
                  ) : (
                    <>
                      {inviteDetails ? 'Join Team' : 'Start Free Trial'}
                      <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>

              {/* Sign In Link */}
              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link 
                  to="/login" 
                  className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all"
                >
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 mb-4">Trusted by thousands of businesses worldwide</p>
          <div className="flex justify-center items-center gap-8 opacity-60">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600" />
              <span className="text-sm text-gray-600">SSL Secured</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600" />
              <span className="text-sm text-gray-600">GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600" />
              <span className="text-sm text-gray-600">24/7 Support</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};