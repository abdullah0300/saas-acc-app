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
  { id: 'preferences', title: 'Preferences', description: 'Configure your settings' },
  { id: 'plan', title: 'Choose Plan', description: 'Select your subscription plan' }
];

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  icon: React.ComponentType;
  features: string[];
  highlighted?: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'simple_start',
    name: 'Simple Start',
    monthlyPrice: 5,
    yearlyPrice: 50,
    icon: Rocket,
    popular: true,
    features: [
      'AI-Powered Categorization',
      '20 Monthly Invoices',
      'Income & Expense Tracking',
      'Smart Financial Reports',
      'Client Management',
      'Email Support'
    ],
    highlighted: ['AI-Powered Categorization', 'Smart Financial Reports']
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: 25,
    yearlyPrice: 250,
    icon: Star,
    features: [
      'Everything in Simple Start',
      'Unlimited Invoices',
      '5 Team Members',
      'Advanced AI Insights',
      'Priority Phone Support',
      'Custom Invoice Branding',
      'Budget Tracking',
      'API Access'
    ],
    highlighted: ['Unlimited Invoices', 'Advanced AI Insights', 'Priority Phone Support']
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
    companyName: '',
    country: '',
    state: '',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    taxRate: 0,
    plan: 'simple_start',
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
          trial_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
                Company Name (Optional)
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Acme Inc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What industry are you in?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Consulting',
                  'E-commerce',
                  'Software/SaaS',
                  'Healthcare',
                  'Construction',
                  'Marketing',
                  'Education',
                  'Other'
                ].map((industry) => (
                  <button
                    key={industry}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, industry }))}
                    className={`p-3 text-left border rounded-lg transition-colors ${
                      formData.industry === industry
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {industry}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Business size
              </label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { value: 'solo', label: 'Just me (Solo entrepreneur)' },
                  { value: 'small', label: 'Small team (2-10 people)' },
                  { value: 'medium', label: 'Growing business (11-50 people)' },
                  { value: 'large', label: 'Large company (50+ people)' }
                ].map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, businessSize: size.value }))}
                    className={`p-3 text-left border rounded-lg transition-colors ${
                      formData.businessSize === size.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {size.label}
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
                Country
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
                  State/Province
                </label>
                <select
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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

            {selectedCountry && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-900 mb-3">Automatic Settings</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Currency:</span>
                    <span className="font-medium text-green-900">{formData.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Date Format:</span>
                    <span className="font-medium text-green-900">{formData.dateFormat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Default Tax Rate:</span>
                    <span className="font-medium text-green-900">{formData.taxRate}%</span>
                  </div>
                  {selectedCountry.taxName && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Tax Name:</span>
                      <span className="font-medium text-green-900">{selectedCountry.taxName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 2: // Preferences
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Calendar className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Set your preferences</h2>
              <p className="text-gray-600">Customize how you want to work</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base Currency
              </label>
              <input
                type="text"
                value={formData.currency}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Based on your country selection. You can add more currencies later.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Format
              </label>
              <select
                value={formData.dateFormat}
                onChange={(e) => setFormData(prev => ({ ...prev, dateFormat: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY (US Format)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (UK Format)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Format)</option>
              </select>
            </div>

            {formData.taxRate > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={formData.taxRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  min="0"
                  max="100"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be your default {selectedCountry?.taxName || 'tax'} rate for invoices.
                </p>
              </div>
            )}
          </div>
        );

      case 3: // Plan Selection
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Star className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose your plan</h2>
              <p className="text-gray-600">Start with a 30-day free trial</p>
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
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.interval === 'yearly' ? 'translate-x-6' : 'translate-x-1'
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PLANS.map((plan) => {
                const IconComponent = plan.icon;
                const price = formData.interval === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                const monthlyEquivalent = formData.interval === 'yearly' ? plan.yearlyPrice / 12 : plan.monthlyPrice;
                
                return (
                  <div
                    key={plan.id}
                    className={`relative p-6 border-2 rounded-xl transition-all cursor-pointer ${
                      formData.plan === plan.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${plan.popular ? 'ring-2 ring-indigo-500 ring-opacity-20' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, plan: plan.id }))}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-indigo-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center mb-4">
<div className="h-8 w-8 mx-auto mb-2 text-indigo-600 flex items-center justify-center">
                        <IconComponent  />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                      <div className="mt-2">
                        <span className="text-3xl font-bold text-gray-900">
                          ${price}
                        </span>
                        <span className="text-gray-500">
                          /{formData.interval === 'yearly' ? 'year' : 'month'}
                        </span>
                        {formData.interval === 'yearly' && (
                          <div className="text-sm text-gray-500">
                            ${monthlyEquivalent.toFixed(2)}/month billed annually
                          </div>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                            plan.highlighted?.includes(feature) 
                              ? 'text-indigo-600' 
                              : 'text-green-500'
                          }`} />
                          <span className={`text-sm ${
                            plan.highlighted?.includes(feature) 
                              ? 'text-indigo-700 font-medium' 
                              : 'text-gray-600'
                          }`}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="text-center">
                      <span className="text-xs text-gray-500">30-day free trial included</span>
                    </div>
                  </div>
                );
              })}
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStep
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
                    className={`flex-1 h-0.5 mx-4 ${
                      index < currentStep ? 'bg-indigo-600' : 'bg-gray-200'
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
            
            {currentStep < 2 && (
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                disabled={loading}
              >
                Skip
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={loading || (currentStep === 1 && !formData.country)}
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