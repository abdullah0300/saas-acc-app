import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "../../contexts/DataContext";
import { ArrowLeft, Save, Upload, Plus, X, AlertCircle } from "lucide-react";
import { AIService, AISuggestion } from "../../services/aiService";
import { countries } from '../../data/countries';
import { AISuggestion as AISuggestionComponent } from "../AI/AISuggestion";
import {
  getVendors,
  createVendor,
  createExpense,
  updateExpense,
  getExpenses,
  getCategories,
} from "../../services/database";
import { Vendor, Category } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { supabase } from "../../services/supabaseClient";
import { AddCategoryModal } from "../Common/AddCategoryModal";

// Add this after your imports
declare global {
  interface Window {
    aiSuggestionTimeout?: NodeJS.Timeout;
  }
}

export const ExpenseForm: React.FC = () => {
  const { user } = useAuth();
  const { taxRates, defaultTaxRate, formatCurrency, baseCurrency, exchangeRates, convertCurrency, getCurrencySymbol, userSettings } = useSettings();
  const { addExpenseToCache } = useData();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const {  updateExpenseInCache } = useData(); // ADD updateExpenseInCache
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
  receipt_url: "",
  tax_rate: defaultTaxRate.toString(),
  tax_amount: "0",
  currency: baseCurrency, // ADD THIS LINE
});

  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
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
  // AI suggestion states
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [loadingAiSuggestion, setLoadingAiSuggestion] = useState(false);
  const [showAiSuggestion, setShowAiSuggestion] = useState(false);
  const [showRateWarning, setShowRateWarning] = useState(false);
const [originalRate, setOriginalRate] = useState<number | null>(null);
const [useHistoricalRate, setUseHistoricalRate] = useState(true);

  useEffect(() => {
  loadCategories();
  // Preload user's learning patterns for instant suggestions
  AIService.preloadUserPatterns();
  
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
    receipt_url: expense.receipt_url || "",
    tax_rate: (expense.tax_rate || defaultTaxRate).toString(),
    tax_amount: (expense.tax_amount || 0).toString(),
    currency: expense.currency || baseCurrency, // ADD THIS LINE
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
  // AI suggestion handler
  const getAISuggestion = async (
    amount: string,
    description: string,
    vendor?: string
  ) => {
    console.log("🤖 getAISuggestion called with:", {
      amount,
      description,
      vendor,
    });

    if (!amount || !description || description.length < 3) {
      console.log("❌ Not enough data for AI suggestion");
      return;
    }

    console.log("✅ Starting AI suggestion request...");
    console.log(
      "📁 Available categories:",
      categories.map((cat) => cat.name)
    );

    setLoadingAiSuggestion(true);
    setShowAiSuggestion(true);

    try {
      console.log("📡 Calling AIService...");
      const suggestion = await AIService.getExpenseCategorySuggestions(
        parseFloat(amount),
        description,
        vendor || "",
        categories // Pass existing categories
      );

      console.log("🎯 AI suggestion received:", suggestion);
      setAiSuggestion(suggestion);
    } catch (error) {
      console.error("💥 Error getting AI suggestion:", error);
      setAiSuggestion(null);
    } finally {
      setLoadingAiSuggestion(false);
      console.log("🏁 AI suggestion request finished");
    }
  };

  // Handle AI suggestion acceptance
  // Handle AI suggestion acceptance
  const handleAcceptAiSuggestion = (category: string) => {
    const categoryObj = categories.find((cat) => cat.name === category);
    if (categoryObj) {
      setFormData({ ...formData, category_id: categoryObj.id });

      // Log ACCEPTANCE for learning
      AIService.logUserChoice(
        "expense_category",
        category,
        category, // User accepted the suggestion
        {
          amount: formData.amount,
          description: formData.description,
          outcome: "accepted",
        }
      );
    }

    setShowAiSuggestion(false);
    setAiSuggestion(null);
  };

  // Handle AI suggestion rejection
  const handleRejectAiSuggestion = () => {
    if (aiSuggestion?.category) {
      // Log REJECTION for learning
      AIService.logUserChoice(
        "expense_category",
        aiSuggestion.category,
        "rejected", // User rejected the suggestion
        {
          amount: formData.amount,
          description: formData.description,
          outcome: "rejected",
        }
      );
    }

    setShowAiSuggestion(false);
    setAiSuggestion(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      // Calculate base amount if different currency
const amount = parseFloat(formData.amount);
const exchangeRate = formData.currency !== baseCurrency 
  ? (useHistoricalRate && originalRate && isEdit ? originalRate : (exchangeRates[formData.currency] || 1)) 
  : 1;
const baseAmount = formData.currency !== baseCurrency ? amount / exchangeRate : amount;

// Calculate base tax amount for multi-currency
const taxAmount = parseFloat(formData.tax_amount) || 0;
const baseTaxAmount = formData.currency !== baseCurrency ? taxAmount / exchangeRate : taxAmount;

const expenseData = {
  user_id: user.id,
  amount: amount,
  description: formData.description,
  category_id: formData.category_id || undefined,
  date: formData.date,
  vendor: formData.vendor || undefined,
  vendor_id: formData.vendor_id || undefined,
  receipt_url: formData.receipt_url || undefined,
  tax_rate: parseFloat(formData.tax_rate) || 0,
  tax_amount: taxAmount,
  currency: formData.currency,
  exchange_rate: exchangeRate,
  base_amount: baseAmount,
  is_vat_reclaimable: isVatReclaimable, // ADD THIS
  base_tax_amount: baseTaxAmount, // ADD THIS
  tax_point_date: formData.date // ADD THIS
};

      if (isEdit && id) {
        const updatedExpense = await updateExpense(id, expenseData);
    updateExpenseInCache(id, updatedExpense); 
      } else {
        const newExpense = await createExpense(expenseData);
        addExpenseToCache(newExpense); // ✅ Add to cache
      }

      navigate("/expenses");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
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

                // Clear any existing suggestion when user is typing
                setShowAiSuggestion(false);
                setAiSuggestion(null);

                // Clear any existing timeout
                if (window.aiSuggestionTimeout) {
                  clearTimeout(window.aiSuggestionTimeout);
                }

                // Trigger AI suggestion after user stops typing
                if (newDescription.length >= 3 && formData.amount) {
                  console.log("⏰ Setting timeout for AI suggestion...");
                  window.aiSuggestionTimeout = setTimeout(() => {
                    console.log("✅ Triggering AI suggestion");
                    getAISuggestion(
                      formData.amount,
                      newDescription,
                      formData.vendor
                    );
                  }, 1500); // Increased to 1.5 seconds
                } else {
                  console.log("❌ Not enough data for AI suggestion");
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Expense description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              {/* AI Suggestion Component */}
              {showAiSuggestion && (
                <div className="mb-3">
                  <AISuggestionComponent
                    suggestion={aiSuggestion || { confidence: 0, reason: "" }}
                    onAccept={handleAcceptAiSuggestion}
                    onReject={handleRejectAiSuggestion}
                    loading={loadingAiSuggestion}
                  />
                </div>
              )}
              <select
                value={formData.category_id}
               onChange={(e) => {
    const newCategoryId = e.target.value;
    
    // ✅ CORRECT: Update category_id field
    setFormData({ ...formData, category_id: newCategoryId });
    
    // ✅ TRAINING: If AI had a suggestion and user picks different category, log rejection
    if (aiSuggestion && aiSuggestion.category && newCategoryId) {
      const selectedCategory = categories.find(cat => cat.id === newCategoryId);
      
      // If user picked different category than AI suggested, log as rejection
      if (selectedCategory && selectedCategory.name !== aiSuggestion.category) {
        AIService.logUserChoice(
          "expense_category",
          aiSuggestion.category, // What AI suggested
          selectedCategory.name,  // What user actually chose
          {
            amount: formData.amount,
            description: formData.description,
            outcome: "manual_override", // User manually overrode AI
          }
        );
      }
    }
    
    // Clear AI suggestion display
    setShowAiSuggestion(false);
    setAiSuggestion(null);
    
    // Clear any pending AI timeouts
    if (window.aiSuggestionTimeout) {
      clearTimeout(window.aiSuggestionTimeout);
    }
  }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option
                  value="new"
                  className="font-semibold text-blue-600 border-t"
                >
                  ➕ Add or delete category ...
                </option>
              </select>
            </div>

            {/* Currency Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {userSettings?.enabled_currencies?.map(currency => (
                    <option key={currency} value={currency}>
                      {currency} - {getCurrencySymbol(currency)}
                    </option>
                  ))}
                </select>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {taxLabel} Rate
              </label>
              <select
                value={formData.tax_rate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value) || 0;
                  const amount = parseFloat(formData.amount) || 0;
                  const taxAmount = ((amount * rate) / 100).toFixed(2);
                  setFormData({
                    ...formData,
                    tax_rate: e.target.value,
                    tax_amount: taxAmount,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">No {taxLabel}</option>
                {taxRates.map((tax) => (
                  <option key={tax.id} value={tax.rate}>
                    {tax.name} ({tax.rate}%)
                  </option>
                ))}
              </select>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.vendor_id} // Changed from expense.vendor_id
                  onChange={(e) => {
                    const selectedVendor = vendors.find(
                      (v) => v.id === e.target.value
                    );
                    setFormData({
                      // Changed from setExpense
                      ...formData, // Changed from expense
                      vendor_id: e.target.value,
                      vendor: selectedVendor?.name || "",
                    });
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a vendor (optional)</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowVendorModal(true)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  title="Add new vendor"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt
            </label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                {uploadingReceipt ? "Uploading..." : "Upload Receipt"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleReceiptUpload}
                  className="hidden"
                  disabled={uploadingReceipt}
                />
              </label>
              {formData.receipt_url && (
                <a
                  href={formData.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  View Receipt
                </a>
              )}
            </div>
          </div>
          {/* Total Summary */}
{formData.amount && (
  <div className="bg-gray-50 rounded-lg p-4">
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium text-gray-700">Total Amount:</span>
      <div className="text-right">
        <div className="text-lg font-semibold text-gray-900">
          {formatCurrency(parseFloat(formData.amount) || 0, formData.currency)}
        </div>
        {formData.currency !== baseCurrency && exchangeRates[formData.currency] && (
          <div className="text-sm text-gray-500">
            ≈ {formatCurrency((parseFloat(formData.amount) || 0) / exchangeRates[formData.currency], baseCurrency)}
          </div>
        )}
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
