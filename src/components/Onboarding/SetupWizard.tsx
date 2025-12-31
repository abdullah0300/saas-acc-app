// src/components/Onboarding/SetupWizard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { countries } from '../../data/countries';
import {
  Building,
  MapPin,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Globe,
  Calendar,
  Star,
  Rocket,
  Users,
  Zap,
  Shield,
  TrendingUp
} from 'lucide-react';

const SETUP_STEPS = [
  { id: 'business', title: 'Business Details', description: 'Tell us about your business' },
  { id: 'location', title: 'Location & Currency', description: 'Set your country and currency' },
  { id: 'plan', title: 'Choose Plan', description: 'Select your subscription plan' }
];

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  originalMonthlyPrice?: number;
  originalYearlyPrice?: number;
  icon: React.ComponentType;
  features: string[];
  highlighted?: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  // {
  //   id: 'simple_start',
  //   name: 'Simple Start',
  //   monthlyPrice: 5,
  //   yearlyPrice: 50,
  //   icon: Rocket,
  //   popular: true,
  //   features: [
  //     'AI-Powered Categorization',
  //     '20 Monthly Invoices',
  //     'Income & Expense Tracking',
  //     'Smart Financial Reports',
  //     'Client Management',
  //     'Email Support'
  //   ],
  //   highlighted: ['AI-Powered Categorization', 'Smart Financial Reports']
  // },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: 12,
    yearlyPrice: 120,
    originalMonthlyPrice: 25,
    originalYearlyPrice: 250,
    icon: Star,
    features: [
      'Everything in Simple Start',
      'Unlimited Invoices',
      '5 Team Members',
      'Advanced AI Insights',
      'Priority Phone Support',
      'Custom Invoice Branding',
      'Budget Tracking',
      'Stripe Payment Integration',
      'API Access'
    ],
    highlighted: ['Unlimited Invoices', 'Stripe Payment Integration', 'Priority Phone Support']
  }
];

export const SetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data state
  const [formData, setFormData] = useState({
    industry: '',
    businessSize: '',
    businessAge: '',
    companyName: '',
    country: '',
    state: '',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    taxRate: 0,
    plan: '', // Start with no plan selected - user must click to select
    interval: 'monthly' as 'monthly' | 'yearly',
  });

  // Get country data for states and currency
  const selectedCountry = countries.find(c => c.code === formData.country);
  const hasStates = selectedCountry?.states && selectedCountry.states.length > 0;

  // Auto-populate preferences based on country selection
  useEffect(() => {
    if (selectedCountry) {
      console.log('🌍 Country selected:', selectedCountry.name, 'Currency:', selectedCountry.currency);
      setFormData(prev => ({
        ...prev,
        currency: selectedCountry.currency || 'USD',
        dateFormat: selectedCountry.dateFormat || 'MM/DD/YYYY',
        taxRate: selectedCountry.defaultTaxRate || 0,
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
      // Skip to completion with defaults
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      console.log('🚀 Starting setup completion process...');
      console.log('📋 Form data:', formData);

      // Prepare enabled currencies array
      const enabledCurrencies = [formData.currency];
      if (formData.currency !== 'USD') {
        enabledCurrencies.push('USD'); // Always include USD as fallback
      }

      console.log('💰 Enabled currencies:', enabledCurrencies);

      // Step 1: Update user profile and mark setup as completed
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_name: formData.companyName || null,
          setup_completed: true,
          setup_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('❌ Profile update error:', profileError);
        throw profileError;
      }
      console.log('✅ Profile updated successfully');

      // Step 2: Create or update user settings with proper multi-currency setup
      const userSettingsData = {
        user_id: user.id,
        base_currency: formData.currency,
        enabled_currencies: enabledCurrencies,
        date_format: formData.dateFormat,
        country: formData.country,
        state: formData.state || null,
        fiscal_year_start: 1,
        updated_at: new Date().toISOString(),
      };

      console.log('⚙️ Creating user settings:', userSettingsData);

      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert(userSettingsData, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (settingsError) {
        console.error('❌ Settings upsert error:', settingsError);
        throw settingsError;
      }
      console.log('✅ User settings created/updated successfully');

      // Step 3: Create subscription record
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          plan: formData.plan,
          interval: formData.interval,
          status: 'trialing',
          trial_end: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (subscriptionError) {
        console.error('❌ Subscription error:', subscriptionError);
        throw subscriptionError;
      }
      console.log('✅ Subscription created successfully');

      // Step 4: Create default categories based on country/business type
      const defaultCategories = [
        // Income categories
        { name: 'Consulting', type: 'income', color: '#10B981' },
        { name: 'Sales', type: 'income', color: '#3B82F6' },
        { name: 'Other Income', type: 'income', color: '#8B5CF6' },

        // Expense categories
        { name: 'Office Supplies', type: 'expense', color: '#EF4444' },
        { name: 'Marketing', type: 'expense', color: '#F59E0B' },
        { name: 'Travel', type: 'expense', color: '#6366F1' },
        { name: 'Software', type: 'expense', color: '#EC4899' },
        { name: 'Other Expenses', type: 'expense', color: '#64748B' }
      ];

      const categoriesWithUserId = defaultCategories.map(cat => ({
        ...cat,
        user_id: user.id,
        created_at: new Date().toISOString()
      }));

      const { error: categoriesError } = await supabase
        .from('categories')
        .insert(categoriesWithUserId);

      if (categoriesError) {
        console.warn('⚠️ Categories creation error (non-critical):', categoriesError);
        // Don't throw - categories creation is non-critical
      } else {
        console.log('✅ Default categories created successfully');
      }

      // Step 5: Create default tax rate if needed
      if (formData.taxRate > 0) {
        const { error: taxRateError } = await supabase
          .from('tax_rates')
          .insert({
            user_id: user.id,
            name: selectedCountry?.taxName || 'Default Tax',
            rate: formData.taxRate,
            is_default: true,
            created_at: new Date().toISOString()
          });

        if (taxRateError) {
          console.warn('⚠️ Tax rate creation error (non-critical):', taxRateError);
        } else {
          console.log('✅ Default tax rate created successfully');
        }
      }

      // Step 6: Save AI user context (business type, size, stage)
      console.log('🤖 Saving AI user context...');
      const aiContextData = {
        user_id: user.id,
        business_type: formData.industry || null,
        business_stage: formData.businessAge || 'startup',
        location: formData.state ? `${formData.state}, ${formData.country}` : formData.country,
        preferences_json: {
          business_size: formData.businessSize || null,
          onboarding_completed: true,
          onboarding_date: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: aiContextError } = await supabase
        .from('ai_user_context')
        .upsert(aiContextData, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (aiContextError) {
        console.warn('⚠️ AI context creation error (non-critical):', aiContextError);
        // Don't throw - AI context is for enhancement, not critical
      } else {
        console.log('✅ AI user context saved successfully');
      }

      console.log('🎉 Setup completed successfully! Redirecting to dashboard...');

      // Redirect to dashboard
      navigate('/dashboard');

    } catch (err: any) {
      console.error('❌ Setup completion error:', err);
      setError(err.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Business Details
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Building className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about your business</h2>
              <p className="text-gray-600">This helps us customize your experience</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Acme Inc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What industry are you in? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.industry}
                onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="e.g., Photographer in New York"
              />
              <p className="text-xs text-gray-500 mt-1">
                Please describe your business type and location (e.g., "Photographer in New York", "Software Development in London")
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Business Size <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { value: 'solo', label: 'Solo', description: 'Just me', icon: '👤' },
                  { value: 'small', label: 'Small Team', description: '2-10 people', icon: '👥' },
                  { value: 'medium', label: 'Growing', description: '11-50 people', icon: '🚀' },
                  { value: 'large', label: 'Enterprise', description: '50+ people', icon: '🏢' }
                ].map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, businessSize: size.value }))}
                    className={`p-5 text-left border-2 rounded-2xl transition-all hover:shadow-lg ${formData.businessSize === size.value
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 ${formData.businessSize === size.value ? 'bg-indigo-500' : 'bg-gray-100'
                      }`}>
                      {size.icon}
                    </div>
                    <h3 className={`text-lg font-semibold mb-1 ${formData.businessSize === size.value ? 'text-indigo-900' : 'text-gray-900'
                      }`}>{size.label}</h3>
                    <p className={`text-sm ${formData.businessSize === size.value ? 'text-indigo-600' : 'text-gray-500'
                      }`}>{size.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                How long has your business been operating? <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { value: 'startup', label: 'Startup', description: '0-6 months', icon: '🌱' },
                  { value: 'new', label: 'New Business', description: '6 months - 2 years', icon: '📈' },
                  { value: 'established', label: 'Established', description: '2-5 years', icon: '⭐' },
                  { value: 'mature', label: 'Mature', description: '5+ years', icon: '🏆' }
                ].map((age) => (
                  <button
                    key={age.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, businessAge: age.value }))}
                    className={`p-5 text-left border-2 rounded-2xl transition-all hover:shadow-lg ${formData.businessAge === age.value
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 ${formData.businessAge === age.value ? 'bg-indigo-500' : 'bg-gray-100'
                      }`}>
                      {age.icon}
                    </div>
                    <h3 className={`text-lg font-semibold mb-1 ${formData.businessAge === age.value ? 'text-indigo-900' : 'text-gray-900'
                      }`}>{age.label}</h3>
                    <p className={`text-sm ${formData.businessAge === age.value ? 'text-indigo-600' : 'text-gray-500'
                      }`}>{age.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 1: // Location & Currency
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Globe className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Where are you located?</h2>
              <p className="text-gray-600">This sets your currency and tax settings</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.country}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, country: e.target.value, state: '' }));
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">Select your country</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            {hasStates && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State/Province <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
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
        );

      case 2: // Plan Selection
        return (
          <div className="space-y-6">
            {/* Prominent 60-Day Trial Banner */}
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200 rounded-2xl p-6 mb-6 text-center shadow-sm">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    60-Day Free Trial
                  </h3>
                </div>
              </div>
              <p className="text-indigo-700 font-medium">
                Start your journey risk-free! No credit card required.
              </p>
            </div>

            <div className="text-center mb-8">
              <Star className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose your plan</h2>
              <p className="text-gray-600 mb-1">
                60-day free trial included with every plan
              </p>
              <p className="text-sm text-red-500 font-medium">
                * Please select a plan to continue
              </p>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center mb-6">
              <span className={`text-sm ${formData.interval === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  interval: prev.interval === 'monthly' ? 'yearly' : 'monthly'
                }))}
                className="mx-3 relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.interval === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
              <span className={`text-sm ${formData.interval === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                Yearly
                <span className="ml-1 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                  Save 20%
                </span>
              </span>
            </div>

            {/* Plans */}
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                {PLANS.map((plan) => {
                  const IconComponent = plan.icon;
                  const price = formData.interval === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                  const originalPrice = formData.interval === 'yearly' ? plan.originalYearlyPrice : plan.originalMonthlyPrice;
                  const monthlyEquivalent = formData.interval === 'yearly' ? plan.yearlyPrice / 12 : plan.monthlyPrice;
                  const hasDiscount = !!originalPrice;

                  const isSelected = formData.plan === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={`relative p-6 border-2 rounded-xl transition-all cursor-pointer transform ${isSelected
                        ? 'border-indigo-500 bg-indigo-50 shadow-lg scale-[1.02] ring-2 ring-indigo-200'
                        : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                        }`}
                      onClick={() => setFormData(prev => ({ ...prev, plan: plan.id }))}
                    >
                      {/* Selection Indicator */}
                      {isSelected && (
                        <div className="absolute top-4 right-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                            <Check className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      )}

                      {/* Click to Select Indicator */}
                      {!isSelected && (
                        <div className="absolute top-4 right-4">
                          <div className="w-8 h-8 border-2 border-gray-300 rounded-full flex items-center justify-center bg-white">
                            <div className="w-3 h-3 border-2 border-gray-400 rounded-full"></div>
                          </div>
                        </div>
                      )}

                      {plan.popular && !isSelected && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-indigo-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                            Most Popular
                          </span>
                        </div>
                      )}

                      {isSelected && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-medium px-3 py-1 rounded-full shadow-md">
                            Selected
                          </span>
                        </div>
                      )}

                      <div className="text-center mb-4">
                        <div className="h-8 w-8 mx-auto mb-2 text-indigo-600 flex items-center justify-center">
                          <IconComponent />
                        </div>
                        <h3 className={`text-lg font-semibold ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                          {plan.name}
                        </h3>
                        <div className="mt-2">
                          {hasDiscount && (
                            <div className="text-lg text-gray-400 line-through mb-1">
                              ${originalPrice}
                            </div>
                          )}
                          <span className={`text-3xl font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                            ${price}
                          </span>
                          <span className="text-gray-500">
                            /{formData.interval === 'yearly' ? 'year' : 'month'}
                          </span>
                          {hasDiscount && (
                            <div className="text-sm text-green-600 font-semibold mt-1">
                              Special Offer - Limited Time!
                            </div>
                          )}
                          {formData.interval === 'yearly' && !hasDiscount && (
                            <div className="text-sm text-gray-500">
                              ${monthlyEquivalent.toFixed(2)}/month billed annually
                            </div>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-2 mb-4">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${plan.highlighted?.includes(feature)
                              ? isSelected ? 'text-indigo-600' : 'text-indigo-500'
                              : 'text-green-500'
                              }`} />
                            <span className={`text-sm ${plan.highlighted?.includes(feature)
                              ? isSelected ? 'text-indigo-800 font-medium' : 'text-indigo-700 font-medium'
                              : 'text-gray-600'
                              }`}>
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* Prominent Trial Badge */}
                      <div className="text-center mt-6 pt-4 border-t border-gray-200">
                        <div className={`inline-flex items-center gap-2 ${isSelected
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
                          : 'bg-gray-100'
                          } text-white px-4 py-2.5 rounded-xl shadow-md transition-colors`}>
                          <Calendar className="h-5 w-5" />
                          <span className="font-semibold text-sm">60-Day Free Trial</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">No credit card required • Cancel anytime</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {SETUP_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${index < SETUP_STEPS.length - 1 ? 'flex-1' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${index <= currentStep
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                    }`}
                >
                  {index < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < SETUP_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${index < currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <h1 className="text-lg font-medium text-gray-900">
              {SETUP_STEPS[currentStep].title}
            </h1>
            <p className="text-sm text-gray-600">
              {SETUP_STEPS[currentStep].description}
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}

            {/* {currentStep < 2 && (
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                disabled={loading}
              >
                Skip
              </button>
            )} */}
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={
              loading ||
              (currentStep === 0 && (!formData.companyName || !formData.industry || !formData.businessSize || !formData.businessAge)) ||
              (currentStep === 1 && (!formData.country || (hasStates && !formData.state))) ||
              (currentStep === 2 && !formData.plan)
            }
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {currentStep === SETUP_STEPS.length - 1 ? 'Complete Setup' : 'Continue'}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};