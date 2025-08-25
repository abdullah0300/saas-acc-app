import React, { useState, useEffect } from 'react';
import { Save, Plus, X, Percent, Globe, AlertCircle, Calculator } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../services/supabaseClient';
import { countries } from '../../data/countries';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  is_default: boolean;
  created_at: string;
}

// UK Flat Rate percentages by business type
const UK_FLAT_RATE_CATEGORIES = [
  { category: 'Limited cost trader', rate: 16.5, description: 'If goods cost < 2% of turnover' },
  { category: 'Accountancy or book-keeping', rate: 14.5 },
  { category: 'Advertising', rate: 11.0 },
  { category: 'Agricultural services', rate: 11.0 },
  { category: 'Architecture, surveying', rate: 14.5 },
  { category: 'Business services', rate: 12.0 },
  { category: 'Catering services', rate: 12.5 },
  { category: 'Computer and IT consultancy', rate: 14.5 },
  { category: 'Construction', rate: 9.5 },
  { category: 'Consultancy', rate: 14.5 },
  { category: 'Estate agency', rate: 12.0 },
  { category: 'Financial services', rate: 13.5 },
  { category: 'General building', rate: 9.5 },
  { category: 'Hotel or accommodation', rate: 10.5 },
  { category: 'Labour-only building', rate: 14.5 },
  { category: 'Lawyer or legal services', rate: 14.5 },
  { category: 'Management consultancy', rate: 14.0 },
  { category: 'Manufacturing', rate: 9.5 },
  { category: 'Photography', rate: 11.0 },
  { category: 'Printing', rate: 8.5 },
  { category: 'Publishing', rate: 11.0 },
  { category: 'Retail - food, newspapers', rate: 4.0 },
  { category: 'Retail - other', rate: 7.5 },
  { category: 'Transport or storage', rate: 10.0 },
];

export const TaxSettings: React.FC = () => {
  const { user } = useAuth();
  const { refreshSettings } = useSettings();
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTax, setNewTax] = useState({ name: '', rate: '' });
  const [error, setError] = useState('');
  const [userCountry, setUserCountry] = useState<string>('');
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState('');
  const [taxScheme, setTaxScheme] = useState('standard');
  const [taxReturnPeriod, setTaxReturnPeriod] = useState('quarterly');
  const [flatRatePercentage, setFlatRatePercentage] = useState<string>('');
  const [isTaxRegistered, setIsTaxRegistered] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  
  // UK VAT specific states
  const [ukVatScheme, setUkVatScheme] = useState<string>('standard');
  const [ukFlatRateCategory, setUkFlatRateCategory] = useState<string>('');
  const [ukVatRegistrationDate, setUkVatRegistrationDate] = useState<string>('');
  const [isLimitedCostTrader, setIsLimitedCostTrader] = useState(false);

  useEffect(() => {
    if (user) {
      loadTaxRates();
      loadUserTaxSettings();
    }
  }, [user]);

  const loadTaxRates = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTaxRates(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadUserTaxSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setUserCountry(data.country || '');
        setTaxRegistrationNumber(data.tax_id || data.tax_registration_number || '');
        setTaxScheme(data.tax_scheme || 'standard');
        setFlatRatePercentage(data.flat_rate_percentage?.toString() || '');
        setIsTaxRegistered(data.is_tax_registered || false);
        setTaxReturnPeriod(data.tax_return_period || 'quarterly');
        
        // UK specific settings
        setUkVatScheme(data.uk_vat_scheme || 'standard');
        setUkVatRegistrationDate(data.uk_vat_registration_date || '');
        setIsLimitedCostTrader(data.uk_flat_rate_limited_cost_trader || false);
        
        // Set flat rate if exists
        if (data.uk_vat_flat_rate) {
          setFlatRatePercentage(data.uk_vat_flat_rate.toString());
        }
      }
    } catch (err: any) {
      console.error('Error loading tax settings:', err);
    }
  };

  const handleSaveTaxSettings = async () => {
    if (!user) return;
    
    setSavingSettings(true);
    try {
      // Prepare the update data based on country
      const updateData: any = {
        tax_registration_number: taxRegistrationNumber,
        tax_id: taxRegistrationNumber, // Store in both fields for compatibility
        is_tax_registered: !!taxRegistrationNumber,
        updated_at: new Date().toISOString()
      };

      // Add UK-specific fields only for UK users
      if (userCountry === 'GB') {
        updateData.uk_vat_scheme = ukVatScheme;
        updateData.uk_vat_registration_date = ukVatRegistrationDate || null;
        updateData.uk_flat_rate_limited_cost_trader = isLimitedCostTrader;
        
        // Handle flat rate specific data
        if (ukVatScheme === 'flat_rate') {
          updateData.uk_vat_flat_rate = parseFloat(flatRatePercentage) || 16.5;
          updateData.uk_vat_cash_accounting = false; // Can't use both
          updateData.uk_vat_annual_accounting = false;
        } else if (ukVatScheme === 'cash') {
          updateData.uk_vat_cash_accounting = true;
          updateData.uk_vat_flat_rate = null;
          updateData.uk_vat_annual_accounting = false;
        } else if (ukVatScheme === 'annual') {
          updateData.uk_vat_annual_accounting = true;
          updateData.uk_vat_cash_accounting = false;
          updateData.uk_vat_flat_rate = null;
        } else {
          // Standard scheme
          updateData.uk_vat_cash_accounting = false;
          updateData.uk_vat_annual_accounting = false;
          updateData.uk_vat_flat_rate = null;
        }
      } else {
        // For non-UK countries, use generic tax settings
        updateData.tax_scheme = taxScheme;
        updateData.tax_return_period = taxReturnPeriod;
        updateData.flat_rate_percentage = taxScheme === 'flat_rate' ? parseFloat(flatRatePercentage) : null;
      }

      const { error } = await supabase
        .from('user_settings')
        .update(updateData)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      await refreshSettings();
      alert('Tax settings saved successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddTax = async () => {
    if (!user || !newTax.name || !newTax.rate) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tax_rates')
        .insert([{
          user_id: user.id,
          name: newTax.name,
          rate: parseFloat(newTax.rate),
          is_default: taxRates.length === 0
        }]);
      
      if (error) throw error;
      
      await loadTaxRates();
      await refreshSettings();
      setNewTax({ name: '', rate: '' });
      setShowAddForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .eq('user_id', user.id);
      
      await supabase
        .from('tax_rates')
        .update({ is_default: true })
        .eq('id', id);
      
      await loadTaxRates();
      await refreshSettings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this tax rate?')) return;
    
    try {
      const { error } = await supabase
        .from('tax_rates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      await loadTaxRates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFlatRateCategoryChange = (category: string) => {
    const selected = UK_FLAT_RATE_CATEGORIES.find(c => c.category === category);
    if (selected) {
      setUkFlatRateCategory(category);
      setFlatRatePercentage(selected.rate.toString());
      setIsLimitedCostTrader(category === 'Limited cost trader');
    }
  };

  const country = countries.find(c => c.code === userCountry);
  const taxFeatures = country?.taxFeatures;
  const isUK = userCountry === 'GB';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Tax Settings</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* UK VAT Settings Section - Only show for UK users */}
      {isUK && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                UK VAT Settings
              </h2>
            </div>
            <button
              onClick={handleSaveTaxSettings}
              disabled={savingSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="space-y-4">
            {/* VAT Registration Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                VAT Registration Number
              </label>
              <input
                type="text"
                value={taxRegistrationNumber}
                onChange={(e) => setTaxRegistrationNumber(e.target.value.toUpperCase())}
                placeholder="GB123456789"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                This will appear on all your invoices
              </p>
            </div>

            {/* VAT Registration Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                VAT Registration Date
              </label>
              <input
                type="date"
                value={ukVatRegistrationDate}
                onChange={(e) => setUkVatRegistrationDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Important for first year discount calculations
              </p>
            </div>

            {/* VAT Scheme Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                VAT Scheme
              </label>
              <select
                value={ukVatScheme}
                onChange={(e) => setUkVatScheme(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="standard">Standard VAT Accounting</option>
                <option value="flat_rate">Flat Rate Scheme</option>
                <option value="cash">Cash Accounting Scheme</option>
                <option value="annual">Annual Accounting Scheme</option>
              </select>
            </div>

            {/* Flat Rate Specific Settings */}
            {ukVatScheme === 'flat_rate' && (
              <>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
                    <div className="text-sm text-yellow-700">
                      <p className="font-medium mb-1">Flat Rate Scheme</p>
                      <ul className="list-disc ml-5 space-y-1">
                        <li>You charge VAT at standard rate (20%) to customers</li>
                        <li>You pay HMRC a fixed percentage of gross turnover</li>
                        <li>You cannot reclaim VAT on purchases (except capital goods over £2,000)</li>
                        <li>Limited Cost Traders must use 16.5% rate</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Your Business Category
                  </label>
                  <select
                    value={ukFlatRateCategory}
                    onChange={(e) => handleFlatRateCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Category --</option>
                    {UK_FLAT_RATE_CATEGORIES.map(cat => (
                      <option key={cat.category} value={cat.category}>
                        {cat.category} - {cat.rate}%
                        {cat.description && ` (${cat.description})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Flat Rate Percentage
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={flatRatePercentage}
                      onChange={(e) => setFlatRatePercentage(e.target.value)}
                      min="0"
                      max="20"
                      step="0.5"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-600">%</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    This percentage will be applied to your gross turnover
                  </p>
                </div>

                {/* Limited Cost Trader Check */}
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="limitedCostTrader"
                    checked={isLimitedCostTrader}
                    onChange={(e) => {
                      setIsLimitedCostTrader(e.target.checked);
                      if (e.target.checked) {
                        setFlatRatePercentage('16.5');
                      }
                    }}
                    className="mt-1"
                  />
                  <label htmlFor="limitedCostTrader" className="text-sm">
                    <span className="font-medium text-gray-700">I am a Limited Cost Trader</span>
                    <p className="text-gray-500 mt-1">
                      Check this if your goods cost is less than 2% of turnover or less than £1,000 per year
                    </p>
                  </label>
                </div>
              </>
            )}

            {/* Cash Accounting Scheme Info */}
            {ukVatScheme === 'cash' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">Cash Accounting Scheme</p>
                    <ul className="list-disc ml-5 space-y-1">
                      <li>Pay VAT only when customers pay you</li>
                      <li>Reclaim VAT only when you pay suppliers</li>
                      <li>Good for businesses with cash flow concerns</li>
                      <li>Turnover must be £1.35 million or less</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Annual Accounting Scheme Info */}
            {ukVatScheme === 'annual' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-green-600 mt-0.5 mr-2" />
                  <div className="text-sm text-green-700">
                    <p className="font-medium mb-1">Annual Accounting Scheme</p>
                    <ul className="list-disc ml-5 space-y-1">
                      <li>Submit one VAT return per year</li>
                      <li>Make advance payments throughout the year</li>
                      <li>Good for predictable businesses</li>
                      <li>Turnover must be £1.35 million or less</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generic Tax Registration for Non-UK Countries */}
      {!isUK && country && taxFeatures?.requiresRegistrationNumber && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                {country.taxName} Registration
              </h2>
            </div>
            <button
              onClick={handleSaveTaxSettings}
              disabled={savingSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {taxFeatures.registrationNumberLabel}
              </label>
              <input
                type="text"
                value={taxRegistrationNumber}
                onChange={(e) => setTaxRegistrationNumber(e.target.value.toUpperCase())}
                placeholder={taxFeatures.registrationNumberPlaceholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {taxFeatures.taxSchemes && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {country.taxName} Scheme
                </label>
                <select
                  value={taxScheme}
                  onChange={(e) => setTaxScheme(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {taxFeatures.taxSchemes.map(scheme => (
                    <option key={scheme} value={scheme}>
                      {scheme.charAt(0).toUpperCase() + scheme.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tax Rates Section - Same for all countries */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Tax Rates</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tax Rate
          </button>
        </div>

        {showAddForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Tax name (e.g., GST, VAT)"
                value={newTax.name}
                onChange={(e) => setNewTax({ ...newTax, name: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Rate (%)"
                value={newTax.rate}
                onChange={(e) => setNewTax({ ...newTax, rate: e.target.value })}
                step="0.01"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddTax}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewTax({ name: '', rate: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {taxRates.length > 0 ? (
            taxRates.map((tax) => (
              <div key={tax.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Percent className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{tax.name}</p>
                    <p className="text-sm text-gray-500">{tax.rate}%</p>
                  </div>
                  {tax.is_default && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!tax.is_default && (
                    <button
                      onClick={() => handleSetDefault(tax.id)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(tax.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-8">No tax rates configured</p>
          )}
        </div>
      </div>
    </div>
  );
};