import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "../../contexts/DataContext";
import { ArrowLeft, Save, Upload, Plus, X, AlertCircle, Sparkles } from "lucide-react";
import { countries } from '../../data/countries';
import {
  getVendors,
  createVendor,
  createExpense,
  updateExpense,
  getExpenses,
  getCategories,
  getProjects,
} from "../../services/database";
import { Vendor, Category } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { supabase } from "../../services/supabaseClient";
import { AddCategoryModal } from "../Common/AddCategoryModal";
import { ModernDropdown } from "../Common/ModernDropdown";
import { AILearningService } from "../../services/ai/learningService";
import { SmartSuggestionService, SmartSuggestion } from "../../services/ai/smartSuggestionService";

export const ExpenseForm: React.FC = () => {
  const { user } = useAuth();
  const { taxRates, defaultTaxRate, formatCurrency, baseCurrency, exchangeRates, convertCurrency, getCurrencySymbol, userSettings, isUserSettingsReady } = useSettings();
  const { addExpenseToCache } = useData();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { updateExpenseInCache } = useData(); // ADD updateExpenseInCache
  const userCountry = countries.find(c => c.code === userSettings?.country);
  const taxLabel = userCountry?.taxName || 'Tax';
  const [isVatReclaimable, setIsVatReclaimable] = useState(true);

  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category_id: "",
    date: new Date().toISOString().split("T")[0],
    vendor: "",
    vendor_id: "",
    project_id: "",
    receipt_url: "",
    tax_rate: defaultTaxRate.toString(),
    tax_amount: "0",
    currency: baseCurrency,
    reference_number: "",
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [error, setError] = useState("");
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [newVendorData, setNewVendorData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  // Smart AI Suggestion states (unified system)
  const [smartSuggestion, setSmartSuggestion] = useState<SmartSuggestion | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestedFields, setSuggestedFields] = useState<Set<string>>(new Set());

  const [showRateWarning, setShowRateWarning] = useState(false);
  const [originalRate, setOriginalRate] = useState<number | null>(null);
  const [useHistoricalRate, setUseHistoricalRate] = useState(true);

  // Add this useEffect after your existing ones
  useEffect(() => {
    if (isUserSettingsReady && baseCurrency && formData.currency !== baseCurrency) {
      setFormData(prev => ({
        ...prev,
        currency: baseCurrency
      }));
    }
  }, [isUserSettingsReady, baseCurrency]);

  useEffect(() => {
    loadCategories();
    loadProjects();

    if (isEdit && id) {
      loadExpense();
    }
  }, [id, isEdit]);

  useEffect(() => {
    if (user) {
      loadVendors();
    }
  }, [user]);


  useEffect(() => {
    if (formData.currency && formData.currency !== baseCurrency) {
      fetchExchangeRate();
    }
  }, [formData.currency]);

  // Smart AI Suggestions: Load when description changes (400ms debounce)
  useEffect(() => {
    const getSmartSuggestion = async () => {
      // Don't suggest if: no user, no description, editing existing expense, or description too short
      if (!user || !formData.description || formData.description.length < 5 || isEdit) {
        return;
      }

      setLoadingSuggestion(true);
      setShowSuggestion(true);

      try {
        console.log('[Smart Suggestion] Getting suggestion for:', formData.description);

        const suggestion = await SmartSuggestionService.getExpenseSuggestion(
          user.id,
          formData.description,
          formData.amount,
          formData.vendor,
          categories
        );

        console.log('[Smart Suggestion] Received:', suggestion);
        setSmartSuggestion(suggestion);

        // Auto-fill high-confidence suggestions (>85%)
        if (suggestion && suggestion.confidence > 85 && suggestion.category_id && !formData.category_id) {
          setFormData(prev => ({
            ...prev,
            category_id: suggestion.category_id!
          }));
          setSuggestedFields(new Set(['category_id']));
        }
      } catch (error) {
        console.error('[Smart Suggestion] Error:', error);
        setSmartSuggestion(null);
      } finally {
        setLoadingSuggestion(false);
      }
    };

    // Debounce: wait 400ms after user stops typing
    const timeout = setTimeout(getSmartSuggestion, 400);
    return () => clearTimeout(timeout);
  }, [formData.description, formData.amount, formData.vendor, user, isEdit, categories]);

  const loadVendors = async () => {
    if (!user) return;

    try {
      const vendorList = await getVendors(user.id);
      setVendors(vendorList);
    } catch (err) {
      console.error("Error loading vendors:", err);
    }
  };

  const loadCategories = async () => {
    if (!user) return;

    try {
      const data = await getCategories(user.id, "expense");
      setCategories(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadProjects = async () => {
    if (!user) return;

    try {
      const data = await getProjects(user.id, 'active');
      setProjects(data);
    } catch (err: any) {
      console.error('Error loading projects:', err);
    }
  };

  const loadExpense = async () => {
    if (!user || !id) return;

    try {
      const expenses = await getExpenses(user.id);
      const expense = expenses.find((e) => e.id === id);

      if (expense) {
        setFormData({
          amount: expense.amount.toString(),
          description: expense.description,
          category_id: expense.category_id || "",
          date: expense.date,
          vendor: expense.vendor || "",
          vendor_id: expense.vendor_id || "",
          project_id: (expense as any).project_id || "",
          receipt_url: expense.receipt_url || "",
          tax_rate: (expense.tax_rate ?? defaultTaxRate).toString(),
          tax_amount: (expense.tax_amount || 0).toString(),
          currency: expense.currency || baseCurrency,
          reference_number: expense.reference_number || "",
        });
        // Store original exchange rate for comparison
        if (expense.exchange_rate && expense.currency !== baseCurrency) {
          setOriginalRate(expense.exchange_rate);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchExchangeRate = async () => {
    if (!formData.currency || formData.currency === baseCurrency) {
      setShowRateWarning(false);
      return;
    }

    try {
      const currentRate = exchangeRates[formData.currency] || 1;

      // Check if we're editing and rates are different
      if (isEdit && originalRate && Math.abs(currentRate - originalRate) > 0.01) {
        setShowRateWarning(true);

        // Don't auto-update if user prefers historical rate
        if (useHistoricalRate) {
          return;
        }
      }
    } catch (error) {
      console.error('Failed to check exchange rate:', error);
    }
  };
  const handleCreateVendor = async () => {
    if (!user || !newVendorData.name.trim()) return;

    setIsAddingVendor(true);

    try {
      const vendor = await createVendor({
        user_id: user.id,
        name: newVendorData.name.trim(),
        email: newVendorData.email || undefined,
        phone: newVendorData.phone || undefined,
        address: newVendorData.address || undefined,
      });

      // Refresh vendors list
      await loadVendors();

      // Select the new vendor
      setFormData({
        // Changed from setExpense
        ...formData, // Changed from expense
        vendor_id: vendor.id,
        vendor: vendor.name,
      });

      // Close modal and reset
      setShowVendorModal(false);
      setNewVendorData({ name: "", email: "", phone: "", address: "" });
    } catch (err: any) {
      alert("Error creating vendor: " + err.message);
    } finally {
      setIsAddingVendor(false);
    }
  };

  const handleReceiptUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingReceipt(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from("receipts")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("receipts").getPublicUrl(fileName);

      setFormData({ ...formData, receipt_url: publicUrl });
    } catch (err: any) {
      setError("Error uploading receipt: " + err.message);
    } finally {
      setUploadingReceipt(false);
    }
  };

  // AI suggestion handler
  // Handle smart suggestion acceptance
  const handleAcceptSuggestion = async () => {
    if (!user || !smartSuggestion || !smartSuggestion.category_id) return;

    // Apply suggestion to form
    setFormData(prev => ({ ...prev, category_id: smartSuggestion.category_id! }));
    setSuggestedFields(new Set(['category_id']));

    // Log acceptance for AI learning
    await AILearningService.logInteraction({
      user_id: user.id,
      interaction_type: 'confirmation',
      entity_type: 'expense',
      ai_suggested_value: {
        category_id: smartSuggestion.category_id,
        category_name: smartSuggestion.category_name
      },
      user_chosen_value: {
        category_id: smartSuggestion.category_id,
        category_name: smartSuggestion.category_name
      },
      context_data: {
        description: formData.description,
        amount: formData.amount,
        vendor: formData.vendor
      }
    });

    setShowSuggestion(false);
    console.log('[Smart Suggestion] Accepted:', smartSuggestion.category_name);
  };

  // Handle smart suggestion rejection
  const handleRejectSuggestion = async () => {
    if (!user || !smartSuggestion) return;

    // Log rejection for AI learning
    await AILearningService.logInteraction({
      user_id: user.id,
      interaction_type: 'rejection',
      entity_type: 'expense',
      ai_suggested_value: {
        category_id: smartSuggestion.category_id,
        category_name: smartSuggestion.category_name
      },
      user_chosen_value: null,
      context_data: {
        description: formData.description,
        amount: formData.amount,
        vendor: formData.vendor
      }
    });

    setShowSuggestion(false);
    setSmartSuggestion(null);
    console.log('[Smart Suggestion] Rejected:', smartSuggestion.category_name);
  };

  const clearSuggestion = (field: string) => {
    setSuggestedFields(prev => {
      const newSet = new Set(prev);
      newSet.delete(field);
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      // Log AI interaction if suggestions were used
      if (suggestedFields.size > 0 && smartSuggestion) {
        await AILearningService.logInteraction({
          user_id: user.id,
          interaction_type: 'confirmation',
          entity_type: 'expense',
          ai_suggested_value: {
            category_id: smartSuggestion?.category_id,
            category_name: smartSuggestion?.category_name,
          },
          user_chosen_value: {
            category_id: formData.category_id,
            category_name: categories.find(c => c.id === formData.category_id)?.name
          },
          context_data: {
            description: formData.description,
            amount: formData.amount,
            vendor: formData.vendor,
            used_suggestions: Array.from(suggestedFields),
            source: 'expense_form'
          }
        });
      }

      // Calculate base amount if different currency
      const amount = parseFloat(formData.amount);
      const exchangeRate = formData.currency !== baseCurrency
        ? (useHistoricalRate && originalRate && isEdit ? originalRate : (exchangeRates[formData.currency] || 1))
        : 1;
      const baseAmount = formData.currency !== baseCurrency ? amount / exchangeRate : amount;

      // Calculate base tax amount for multi-currency
      const taxAmount = parseFloat(formData.tax_amount) || 0;
      const baseTaxAmount = formData.currency !== baseCurrency ? taxAmount / exchangeRate : taxAmount;

      const taxRateValue = parseFloat(formData.tax_rate);

      const expenseData = {
        user_id: user.id,
        amount: amount,
        description: formData.description,
        category_id: formData.category_id || undefined,
        date: formData.date,
        vendor: formData.vendor || undefined,
        vendor_id: formData.vendor_id || undefined,
        project_id: formData.project_id || undefined,
        receipt_url: formData.receipt_url || undefined,
        reference_number: formData.reference_number || undefined,
        tax_rate: isNaN(taxRateValue) ? undefined : taxRateValue,
        tax_amount: taxAmount,
        currency: formData.currency,
        exchange_rate: exchangeRate,
        base_amount: baseAmount,
        is_vat_reclaimable: isVatReclaimable,
        base_tax_amount: baseTaxAmount,
        tax_point_date: formData.date
      };

      if (isEdit && id) {
        const updatedExpense = await updateExpense(id, expenseData);
        updateExpenseInCache(id, updatedExpense);
      } else {
        const newExpense = await createExpense(expenseData);
        addExpenseToCache(newExpense);

        // Trigger pattern analysis
        AILearningService.maybeAnalyzePatterns(user.id).catch(err =>
          console.error('[AI Learning] Pattern analysis failed:', err)
        );
      }

      navigate("/expenses");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  // Add this before your main return
  if (!isUserSettingsReady) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-3 text-gray-600">Loading your settings...</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate("/expenses")}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Expenses
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEdit ? "Edit Expense" : "Add Expense"}
        </h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => {
                  const newAmount = e.target.value;
                  const rate = parseFloat(formData.tax_rate) || 0;
                  const netAmount = parseFloat(newAmount) || 0;

                  // Recalculate tax when amount changes
                  const taxAmount = ((netAmount * rate) / 100).toFixed(2);

                  setFormData({
                    ...formData,
                    amount: newAmount,
                    tax_amount: taxAmount
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => {
                const newDescription = e.target.value;
                console.log("📝 Description changed:", newDescription);
                console.log("💰 Current amount:", formData.amount);

                setFormData({ ...formData, description: newDescription });

                // Clear suggestion when user edits (useEffect will trigger new suggestion automatically)
                if (newDescription.length < 5) {
                  setShowSuggestion(false);
                  setSmartSuggestion(null);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Expense description"
            />
          </div>

          {/* Smart AI Suggestion Banner (Medium Confidence 50-85%) */}
          {showSuggestion && smartSuggestion && smartSuggestion.confidence >= 50 && smartSuggestion.confidence < 85 && (
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-purple-900 mb-1">
                    💡 AI Suggestion ({smartSuggestion.confidence}% confident)
                  </h4>
                  <p className="text-sm text-purple-700 mb-2">
                    {smartSuggestion.reason}
                  </p>
                  <div className="space-y-1 text-sm text-purple-800">
                    {smartSuggestion.category_name && <div>• Category: <strong>{smartSuggestion.category_name}</strong></div>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleAcceptSuggestion}
                      disabled={loadingSuggestion}
                      className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      ✓ Use This
                    </button>
                    <button
                      type="button"
                      onClick={handleRejectSuggestion}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      ✗ Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>

              <ModernDropdown
                label="Category"
                value={formData.category_id}
                onChange={async (value) => {
                  clearSuggestion('category_id');

                  // Log correction if user chose different category than AI suggested
                  if (user && smartSuggestion && smartSuggestion.category_id && value !== smartSuggestion.category_id) {
                    const selectedCategory = categories.find(cat => cat.id === value);

                    await AILearningService.logInteraction({
                      user_id: user.id,
                      interaction_type: 'correction',
                      entity_type: 'expense',
                      ai_suggested_value: {
                        category_id: smartSuggestion.category_id,
                        category_name: smartSuggestion.category_name
                      },
                      user_chosen_value: {
                        category_id: value,
                        category_name: selectedCategory?.name
                      },
                      context_data: {
                        description: formData.description,
                        amount: formData.amount,
                        vendor: formData.vendor
                      }
                    });
                  }

                  setFormData({ ...formData, category_id: value });
                  setShowSuggestion(false);
                }}
                options={categories.map(cat => ({
                  id: cat.id,
                  name: cat.name,
                }))}
                placeholder="Select category"
                aiSuggested={suggestedFields.has('category_id')}
                onAddNew={() => setShowAddCategory(true)}
                addNewLabel="➕ Add or delete category..."
              />
            </div>

            {/* Currency Selection */}
            <div>
              <ModernDropdown
                label="Currency"
                value={formData.currency}
                onChange={(value) => setFormData({ ...formData, currency: value })}
                options={userSettings?.enabled_currencies?.map(currency => ({
                  id: currency,
                  name: `${currency} - ${getCurrencySymbol(currency)}`,
                })) || []}
                placeholder="Select currency"
              />
              {formData.currency !== baseCurrency && exchangeRates[formData.currency] && (
                <p className="text-xs text-gray-500 mt-1">
                  Rate: 1 {baseCurrency} = {exchangeRates[formData.currency].toFixed(4)} {formData.currency}
                </p>
              )}
            </div>
            {/* Exchange Rate Warning */}
            {showRateWarning && isEdit && originalRate && (
              <div className="md:col-span-2 mt-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-yellow-800 mb-2">
                        Exchange Rate Changed
                      </h4>
                      <p className="text-sm text-yellow-700 mb-3">
                        The exchange rate has changed since this transaction was created:
                      </p>
                      <div className="text-sm space-y-1 mb-3">
                        <div>Original rate: <span className="font-medium">1 {baseCurrency} = {originalRate.toFixed(4)} {formData.currency}</span></div>
                        <div>Current rate: <span className="font-medium">1 {baseCurrency} = {exchangeRates[formData.currency]?.toFixed(4) || 'N/A'} {formData.currency}</span></div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            checked={useHistoricalRate}
                            onChange={() => setUseHistoricalRate(true)}
                            className="mr-2"
                          />
                          <span className="text-sm text-yellow-700">Use original rate (historical)</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            checked={!useHistoricalRate}
                            onChange={() => setUseHistoricalRate(false)}
                            className="mr-2"
                          />
                          <span className="text-sm text-yellow-700">Use current rate</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tax Rate - Added this section */}
            <div>
              <ModernDropdown
                label={`${taxLabel} Rate`}
                value={formData.tax_rate}
                onChange={(value) => {
                  const rate = parseFloat(value) || 0;
                  const amount = parseFloat(formData.amount) || 0;
                  const taxAmount = ((amount * rate) / 100).toFixed(2);
                  setFormData({
                    ...formData,
                    tax_rate: value,
                    tax_amount: taxAmount,
                  });
                }}
                options={[
                  { id: '0', name: `No ${taxLabel}` },
                  ...taxRates.map((tax) => ({
                    id: tax.rate.toString(),
                    name: `${tax.name} (${tax.rate}%)`,
                  }))
                ]}
                placeholder={`Select ${taxLabel} rate`}
              />
              {/* VAT Reclaimable Checkbox - Only for UK users */}
              {userCountry?.code === 'GB' && parseFloat(formData.tax_rate) > 0 && (
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVatReclaimable}
                      onChange={(e) => setIsVatReclaimable(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      VAT is reclaimable (can be offset against VAT due)
                    </span>
                  </label>
                </div>
              )}
            </div>
            <div>
              <ModernDropdown
                label="Vendor"
                value={formData.vendor_id}
                onChange={(value) => {
                  const selectedVendor = vendors.find((v) => v.id === value);
                  setFormData({
                    ...formData,
                    vendor_id: value,
                    vendor: selectedVendor?.name || "",
                  });
                }}
                options={vendors.map((vendor) => ({
                  id: vendor.id,
                  name: vendor.name,
                }))}
                placeholder="Select a vendor (optional)"
                onAddNew={() => setShowVendorModal(true)}
                addNewLabel="➕ Add new vendor..."
              />
            </div>
          </div>

          {/* Project Selection */}
          <div>
            <ModernDropdown
              label="Project (Optional)"
              value={formData.project_id}
              onChange={(value) => setFormData({ ...formData, project_id: value })}
              options={projects
                .filter(p => !formData.vendor_id || p.client_id === formData.vendor_id)
                .map((project) => ({
                  id: project.id,
                  name: project.name,
                }))}
              placeholder="No project"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference Number
            </label>
            <input
              type="text"
              value={formData.reference_number}
              onChange={(e) =>
                setFormData({ ...formData, reference_number: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Optional reference"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt
            </label>

            {/* Show upload area if no receipt */}
            {!formData.receipt_url ? (
              <label className="flex items-center justify-center px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-colors">
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    {uploadingReceipt ? "Uploading..." : "Click to upload receipt"}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF up to 10MB</p>
                </div>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleReceiptUpload}
                  className="hidden"
                  disabled={uploadingReceipt}
                />
              </label>
            ) : (
              /* Show receipt preview with remove/replace options */
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Thumbnail preview for images */}
                    {formData.receipt_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img
                        src={formData.receipt_url}
                        alt="Receipt"
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-gray-500 font-medium">PDF</span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-700">Receipt uploaded</p>
                      <a
                        href={formData.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        View full image →
                      </a>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {/* Replace button */}
                    <label className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors" title="Replace receipt">
                      <Upload className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleReceiptUpload}
                        className="hidden"
                        disabled={uploadingReceipt}
                      />
                    </label>
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, receipt_url: "" })}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove receipt"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Total Summary */}
          {formData.amount && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Net Amount:</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(parseFloat(formData.amount) || 0, formData.currency)}
                  </span>
                </div>

                {parseFloat(formData.tax_rate) > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{taxLabel} ({formData.tax_rate}%):</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(parseFloat(formData.tax_amount) || 0, formData.currency)}
                      </span>
                    </div>
                    <div className="border-t pt-2" />
                  </>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(
                        (parseFloat(formData.amount) || 0) + (parseFloat(formData.tax_amount) || 0),
                        formData.currency
                      )}
                    </div>
                    {formData.currency !== baseCurrency && exchangeRates[formData.currency] && (
                      <div className="text-sm text-gray-500">
                        ≈ {formatCurrency(
                          (parseFloat(formData.amount) || 0) / exchangeRates[formData.currency],
                          baseCurrency
                        )} (net)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate("/expenses")}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save Expense"}
            </button>
          </div>
        </form>
      </div>
      {/* Vendor Creation Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Add New Vendor</h3>
                <button
                  onClick={() => {
                    setShowVendorModal(false);
                    setNewVendorData({
                      name: "",
                      email: "",
                      phone: "",
                      address: "",
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Name *
                  </label>
                  <input
                    type="text"
                    value={newVendorData.name}
                    onChange={(e) =>
                      setNewVendorData({
                        ...newVendorData,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter vendor name"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newVendorData.email}
                    onChange={(e) =>
                      setNewVendorData({
                        ...newVendorData,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="vendor@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newVendorData.phone}
                    onChange={(e) =>
                      setNewVendorData({
                        ...newVendorData,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={newVendorData.address}
                    onChange={(e) =>
                      setNewVendorData({
                        ...newVendorData,
                        address: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Street address..."
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowVendorModal(false);
                  setNewVendorData({
                    name: "",
                    email: "",
                    phone: "",
                    address: "",
                  });
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVendor}
                disabled={!newVendorData.name.trim() || isAddingVendor}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {isAddingVendor ? "Creating..." : "Create Vendor"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Category Modal */}
      <AddCategoryModal
        isOpen={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        type="expense"
        currentCategories={categories}
        onCategoryAdded={(newCategory) => {
          setCategories([...categories, newCategory]);
          setFormData({ ...formData, category_id: newCategory.id });
        }}
        onCategoryDeleted={(categoryId) => {
          setCategories(categories.filter((cat) => cat.id !== categoryId));
          if (formData.category_id === categoryId) {
            setFormData({ ...formData, category_id: "" });
          }
        }}
      />
    </div>
  );
};
