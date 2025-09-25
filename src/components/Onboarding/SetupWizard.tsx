import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Building2,
  Globe,
  Settings,
  Sparkles,
  User,
  Briefcase,
  DollarSign,
  Calendar,
  Loader2,
  ArrowRight,
  SkipForward,
  CreditCard,
  Star,
  Rocket,
  Check,
  Zap,
  Users,
  FileText,
  Gift,
} from 'lucide-react';
import { countries } from '../../data/countries';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  required: boolean;
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: 'industry',
    title: 'Tell us about your business',
    description: 'Help us personalize your experience',
    icon: Briefcase,
    required: false,
  },
  {
    id: 'business',
    title: 'Business details',
    description: 'Company information and location',
    icon: Building2,
    required: true,
  },
  {
    id: 'preferences',
    title: 'Your preferences',
    description: 'Currency and regional settings',
    icon: Settings,
    required: true,
  },
  {
    id: 'plan',
    title: 'Choose your plan',
    description: 'Select the perfect plan for your needs',
    icon: CreditCard,
    required: true,
  },
];

// Industry options matching your ai_user_context system
const INDUSTRIES = [
  { id: 'freelancer', name: 'Freelancer / Consultant', description: 'Individual services' },
  { id: 'agency', name: 'Creative Agency', description: 'Design, marketing, etc.' },
  { id: 'ecommerce', name: 'E-commerce', description: 'Online retail business' },
  { id: 'saas', name: 'Software / SaaS', description: 'Technology products' },
  { id: 'retail', name: 'Retail / Physical Goods', description: 'Physical products' },
  { id: 'consulting', name: 'Professional Services', description: 'Legal, accounting, etc.' },
  { id: 'healthcare', name: 'Healthcare', description: 'Medical services' },
  { id: 'education', name: 'Education', description: 'Training and education' },
  { id: 'nonprofit', name: 'Non-profit', description: 'Charitable organizations' },
  { id: 'other', name: 'Other', description: 'Something else' },
];

const BUSINESS_SIZES = [
  { id: 'solo', name: 'Just me', description: '1 person' },
  { id: 'small', name: 'Small team', description: '2-10 people' },
  { id: 'medium', name: 'Growing business', description: '11-50 people' },
  { id: 'established', name: 'Established company', description: '50+ people' },
];

// Plan options
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

const PLANS: Plan[] = [
  {
    id: "simple_start",
    name: "Simple Start",
    monthlyPrice: 5,
    yearlyPrice: 48,
    icon: Star,
    features: [
      "20 invoices/month",
      "Single user",
      "Basic reports",
      "Email support"
    ],
    highlighted: ["Perfect for freelancers"],
    limits: {
      users: 1,
      monthlyInvoices: 20,
    },
  },
  {
    id: "plus",
    name: "Plus",
    monthlyPrice: 25,
    yearlyPrice: 240,
    icon: Rocket,
    features: [
      "Unlimited invoices",
      "5 team members",
      "Advanced reports",
      "Priority support"
    ],
    highlighted: ["Most popular choice"],
    popular: true,
    limits: {
      users: 5,
      monthlyInvoices: -1,
    },
  },
];

export const SetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    industry: '',
    businessSize: '',
    companyName: '',
    country: 'US',
    state: '',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    taxRate: 0,
    plan: 'simple_start',
    interval: 'monthly' as 'monthly' | 'yearly',
  });

  // Get selected country data
  const selectedCountry = countries.find((c) => c.code === formData.country);
  const hasStates = selectedCountry?.states && selectedCountry.states.length > 0;

  // Update currency when country changes
  useEffect(() => {
    if (selectedCountry) {
      setFormData((prev) => ({
        ...prev,
        currency: selectedCountry.currency,
        dateFormat: selectedCountry.dateFormat,
        taxRate: selectedCountry.defaultTaxRate,
      }));
    }
  }, [selectedCountry]);

  const handleNext = async () => {
    if (currentStep < SETUP_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    if (currentStep === 0) {
      // Skip industry selection
      setCurrentStep(1);
    } else {
      // Skip to completion
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      // Update user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_name: formData.companyName || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update user settings (including country and state)
      const { error: settingsError } = await supabase
        .from('user_settings')
        .update({
          base_currency: formData.currency,
          date_format: formData.dateFormat,
          country: formData.country,
          state: formData.state || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (settingsError) throw settingsError;

      // Update subscription plan
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .update({
          plan: formData.plan,
          interval: formData.interval,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (subscriptionError) throw subscriptionError;

      // Save AI context if industry selected
      if (formData.industry) {
        const { error: contextError } = await supabase
          .from('ai_user_context')
          .upsert({
            user_id: user.id,
            business_type: formData.industry,
            business_stage: formData.businessSize || 'medium',
            location: formData.country,
            patterns_json: {
              setup_completed_at: new Date().toISOString(),
              setup_version: '1.0',
            },
            updated_at: new Date().toISOString(),
          });

        if (contextError) {
          console.error('Error saving AI context:', contextError);
          // Don't fail the whole setup for this
        }
      }

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  const renderIndustryStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl mb-4">
          <Briefcase className="h-8 w-8 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">What type of business are you?</h2>
        <p className="text-gray-600 mt-2">This helps us customize SmartCFO for your needs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INDUSTRIES.map((industry) => (
          <div
            key={industry.id}
            onClick={() => setFormData((prev) => ({ ...prev, industry: industry.id }))}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
              formData.industry === industry.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-300'
            }`}
          >
            <h3 className="font-medium text-gray-900">{industry.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{industry.description}</p>
            {formData.industry === industry.id && (
              <div className="mt-2">
                <CheckCircle className="h-5 w-5 text-indigo-600" />
              </div>
            )}
          </div>
        ))}
      </div>

      {formData.industry && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">How big is your team?</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BUSINESS_SIZES.map((size) => (
              <div
                key={size.id}
                onClick={() => setFormData((prev) => ({ ...prev, businessSize: size.id }))}
                className={`p-3 rounded-lg border cursor-pointer transition-all text-center ${
                  formData.businessSize === size.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                <div className="font-medium text-sm">{size.name}</div>
                <div className="text-xs text-gray-600 mt-1">{size.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderBusinessStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl mb-4">
          <Building2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Business details</h2>
        <p className="text-gray-600 mt-2">Tell us more about your business</p>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
            Company Name <span className="text-gray-400">(Optional)</span>
          </label>
          <input
            type="text"
            id="companyName"
            value={formData.companyName}
            onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"
            placeholder="Your company name"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
              Country *
            </label>
            <select
              id="country"
              value={formData.country}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, country: e.target.value, state: '' }));
              }}
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
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                State/Province *
              </label>
              <select
                id="state"
                value={formData.state}
                onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
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
      </div>
    </div>
  );

  const renderPreferencesStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl mb-4">
          <Settings className="h-8 w-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Your preferences</h2>
        <p className="text-gray-600 mt-2">Customize SmartCFO to work best for you</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Currency
            </label>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <DollarSign className="h-5 w-5 text-indigo-600" />
              <div>
                <div className="font-medium text-gray-900">{formData.currency}</div>
                <div className="text-sm text-gray-600">Based on your country</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Format
            </label>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <div>
                <div className="font-medium text-gray-900">{formData.dateFormat}</div>
                <div className="text-sm text-gray-600">Regional preference</div>
              </div>
            </div>
          </div>
        </div>

        {selectedCountry?.taxName && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Tax Rate
            </label>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {formData.taxRate}% {selectedCountry.taxName}
                </div>
                <div className="text-sm text-gray-600">
                  Standard rate for {selectedCountry.name}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-indigo-900">Almost there!</h3>
              <p className="text-sm text-indigo-700 mt-1">
                Next, you'll choose the perfect plan for your business needs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlanStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl mb-4">
          <CreditCard className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Choose your plan</h2>
        <p className="text-gray-600 mt-2">30-day free trial • No credit card required</p>
      </div>

      <div className="space-y-6">
        {/* Billing Toggle */}
        <div className="flex justify-center">
          <div className="bg-gray-100 p-1 rounded-lg inline-flex relative">
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  interval: "monthly",
                }))
              }
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
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
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                formData.interval === "yearly"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Yearly
            </button>
            {formData.interval === "yearly" && (
              <span className="absolute -top-2 right-0 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            )}
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
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
                className={`relative rounded-2xl cursor-pointer transition-all duration-300 p-6 group ${
                  plan.popular
                    ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl transform scale-105 ring-4 ring-indigo-200"
                    : isSelected
                      ? "border-2 border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg"
                      : "border-2 border-gray-200 bg-white hover:border-indigo-300 hover:shadow-xl hover:scale-[1.02]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-orange-400 to-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      MOST POPULAR
                    </div>
                  </div>
                )}

                {isSelected && !plan.popular && (
                  <div className="absolute top-4 right-4">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full p-2 shadow-lg">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <div className={`inline-flex p-4 rounded-2xl mb-4 ${
                    plan.popular
                      ? 'bg-white/20 backdrop-blur-sm'
                      : isSelected
                        ? 'bg-indigo-100'
                        : 'bg-gray-100 group-hover:bg-indigo-100'
                  } transition-colors`}>
                    <Icon className={`h-8 w-8 ${
                      plan.popular
                        ? 'text-white'
                        : isSelected
                          ? 'text-indigo-600'
                          : 'text-gray-600 group-hover:text-indigo-600'
                    } transition-colors`} />
                  </div>

                  <h4 className={`text-xl font-bold mb-3 ${
                    plan.popular
                      ? 'text-white'
                      : isSelected
                        ? 'text-gray-900'
                        : 'text-gray-900'
                  }`}>
                    {plan.name}
                  </h4>

                  <div className="mb-4">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className={`text-3xl font-bold ${
                        plan.popular
                          ? 'text-white'
                          : isSelected
                            ? 'text-gray-900'
                            : 'text-gray-900'
                      }`}>
                        ${formData.interval === "yearly" ? yearlyPrice : plan.monthlyPrice}
                      </span>
                      <span className={`text-sm ${
                        plan.popular
                          ? 'text-white/80'
                          : 'text-gray-600'
                      }`}>
                        /{formData.interval === "yearly" ? "year" : "month"}
                      </span>
                    </div>
                    {formData.interval === "yearly" && (
                      <p className={`text-sm mt-1 font-medium ${
                        plan.popular
                          ? 'text-white/90'
                          : 'text-emerald-600'
                      }`}>
                        Save ${savings}/year
                      </p>
                    )}
                  </div>

                  {/* User and Invoice Limits */}
                  <div className={`flex justify-center gap-6 mb-4 pb-4 border-b ${
                    plan.popular
                      ? 'border-white/20'
                      : isSelected
                        ? 'border-indigo-200'
                        : 'border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className={`text-sm ${
                        plan.popular ? 'text-white/90' : 'text-gray-600'
                      }`}>
                        {plan.limits.users === 1
                          ? "Just you"
                          : `${plan.limits.users} users`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className={`text-sm ${
                        plan.popular ? 'text-white/90' : 'text-gray-600'
                      }`}>
                        {plan.limits.monthlyInvoices === -1
                          ? "Unlimited"
                          : `${plan.limits.monthlyInvoices}/mo`}
                      </span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <div key={index} className={`flex items-center justify-start gap-2 text-sm ${
                        plan.popular
                          ? 'text-white/90'
                          : isSelected
                            ? 'text-gray-700'
                            : 'text-gray-600'
                      }`}>
                        <Check className={`h-4 w-4 flex-shrink-0 ${
                          plan.popular
                            ? 'text-white'
                            : 'text-emerald-500'
                        }`} />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Gift className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-indigo-900">Start your free trial</h3>
              <p className="text-sm text-indigo-700 mt-1">
                No credit card required. Cancel anytime during your 30-day trial.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (SETUP_STEPS[currentStep].id) {
      case 'industry':
        return renderIndustryStep();
      case 'business':
        return renderBusinessStep();
      case 'preferences':
        return renderPreferencesStep();
      case 'plan':
        return renderPlanStep();
      default:
        return null;
    }
  };

  const canProceed = () => {
    const step = SETUP_STEPS[currentStep];
    if (!step.required) return true;

    switch (step.id) {
      case 'business':
        return formData.country && (!hasStates || formData.state);
      case 'preferences':
        return true; // All auto-populated
      case 'plan':
        return formData.plan; // Plan must be selected
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center">
              {SETUP_STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      index <= currentStep
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {index < currentStep ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <span className="text-sm font-semibold">{index + 1}</span>
                    )}
                  </div>
                  {index < SETUP_STEPS.length - 1 && (
                    <div
                      className={`w-16 h-1 ${
                        index < currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to SmartCFO!
          </h1>
          <p className="text-gray-600">
            Step {currentStep + 1} of {SETUP_STEPS.length}
          </p>
        </div>

        {/* Setup Content */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="min-h-[400px]">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-8 border-t border-gray-200">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex gap-3">
              {!SETUP_STEPS[currentStep].required && (
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <SkipForward className="h-4 w-4" />
                  Skip
                </button>
              )}

              <button
                onClick={handleNext}
                disabled={!canProceed() || loading}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : currentStep === SETUP_STEPS.length - 1 ? (
                  <>
                    Complete Setup
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};