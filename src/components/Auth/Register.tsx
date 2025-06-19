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
  Loader2
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
    monthlyPrice: 15,
    yearlyPrice: 144, // 20% off
    icon: Star,
    features: [
      'Single user access',
      'Unlimited invoices',
      'Track income & expenses',
      'Basic financial reports',
      'Category management',
      'Client management',
      'Export to PDF',
      'Email support'
    ],
    highlighted: ['Single user access']
  },
  {
    id: 'essentials',
    name: 'Essentials',
    monthlyPrice: 30,
    yearlyPrice: 288,
    icon: Zap,
    popular: true,
    features: [
      'Up to 3 users',
      'Everything in Simple Start',
      'Advanced reports',
      'Tax management',
      'Multi-currency support',
      'Invoice templates',
      'Recurring invoices',
      'Priority email support'
    ],
    highlighted: ['Up to 3 users', 'Multi-currency support']
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: 45,
    yearlyPrice: 432,
    icon: Rocket,
    features: [
      'Up to 5 users',
      'Everything in Essentials',
      'Custom invoice branding',
      'Advanced tax reports',
      'Profit & loss statements',
      'Cash flow analysis',
      'Budget tracking',
      'Phone & email support'
    ],
    highlighted: ['Up to 5 users', 'Budget tracking']
  },
  {
    id: 'advanced',
    name: 'Advanced',
    monthlyPrice: 85,
    yearlyPrice: 816,
    icon: Building,
    features: [
      'Up to 25 users',
      'Everything in Plus',
      'Custom report builder',
      'API access',
      'Advanced analytics',
      'Team permissions',
      'Audit trail',
      'Dedicated account manager'
    ],
    highlighted: ['Up to 25 users', 'API access', 'Dedicated account manager']
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Checking invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">
            {inviteDetails ? 'Join Your Team' : 'Start Your Free Trial'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {inviteDetails 
              ? `You've been invited to join ${inviteDetails.teamName}`
              : '30-day free trial. No credit card required.'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="px-6 py-8 sm:p-10">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="John"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Doe"
                    />
                  </div>
                </div>
              </div>

              {/* Company Name */}
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name (Optional)
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    id="companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Inc."
                  />
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <select
                      id="country"
                      name="country"
                      required
                      value={formData.country}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                    >
                      {countries.map(country => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {hasStates && selectedCountry?.states && (
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                      State/Province
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select
                        id="state"
                        name="state"
                        required
                        value={formData.state}
                        onChange={handleChange}
                        className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                      >
                        <option value="">Select state/province</option>
                        {selectedCountry.states.map(state => (
                          <option key={state.code} value={state.code}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!!inviteDetails}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="john@example.com"
                  />
                </div>
                {inviteDetails && (
                  <p className="mt-1 text-sm text-gray-500">
                    Email address is fixed for this invitation
                  </p>
                )}
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      id="password"
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">At least 6 characters</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>
                </div>
              </div>

              {/* Subscription Plans - Only show if not a team member */}
              {!inviteDetails && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Choose Your Plan</h3>
                  
                  {/* Billing Toggle */}
                  <div className="flex justify-center mb-6">
                    <div className="bg-gray-100 p-1 rounded-lg flex">
                      <button
                        type="button"
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          formData.interval === 'monthly'
                            ? 'bg-white text-gray-900 shadow'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setFormData(prev => ({ ...prev, interval: 'monthly' }))}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          formData.interval === 'yearly'
                            ? 'bg-white text-gray-900 shadow'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setFormData(prev => ({ ...prev, interval: 'yearly' }))}
                      >
                        Yearly (Save 20%)
                      </button>
                    </div>
                  </div>

                  {/* Plan Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {PLANS.map((plan) => {
                      const Icon = plan.icon;
                      return (
                        <div
                          key={plan.id}
                          className={`relative rounded-lg border-2 p-6 cursor-pointer transition ${
                            formData.plan === plan.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setFormData(prev => ({ ...prev, plan: plan.id }))}
                        >
                          {plan.popular && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                                MOST POPULAR
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mb-4">
                            <Icon className="h-8 w-8 text-blue-600" />
                            {formData.plan === plan.id && (
                              <Check className="h-5 w-5 text-blue-500" />
                            )}
                          </div>
                          
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h4>
                          
                          <div className="mb-4">
                            <span className="text-3xl font-bold text-gray-900">
                              ${formData.interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                            </span>
                            <span className="text-gray-500">
                              /{formData.interval === 'monthly' ? 'month' : 'year'}
                            </span>
                          </div>
                          
                          <ul className="space-y-2">
                            {plan.features.slice(0, 5).map((feature, index) => {
                              const isHighlighted = plan.highlighted?.includes(feature);
                              return (
                                <li 
                                  key={index} 
                                  className={`flex items-start text-sm ${
                                    isHighlighted ? 'text-gray-900 font-medium' : 'text-gray-600'
                                  }`}
                                >
                                  <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                  {feature}
                                </li>
                              );
                            })}
                          </ul>
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
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150"
              >
                {loading ? (
                  <div className="flex items-center">
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Creating your account...
                  </div>
                ) : (
                  inviteDetails ? 'Join Team' : 'Start Free Trial'
                )}
              </button>

              {/* Sign In Link */}
              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};