import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { AddCategoryModal } from "../Common/AddCategoryModal";
import { getClients, createClient } from "../../services/database";
import { Client } from "../../types";
import { Plus, X } from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { countries } from '../../data/countries';
import {
  createIncome,
  updateIncome,
  getIncomes,
  getCategories,
} from "../../services/database";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext"; // Added useSettings import
import { Category } from "../../types";

export const IncomeForm: React.FC = () => {
  const { user } = useAuth();
  const { taxRates, defaultTaxRate, formatCurrency, baseCurrency, exchangeRates, convertCurrency, getCurrencySymbol, userSettings, isUserSettingsReady } = useSettings();
  const { addIncomeToCache,  addClientToCache , updateIncomeInCache } = useData();
  const userCountry = countries.find(c => c.code === userSettings?.country);
  const taxLabel = userCountry?.taxName || 'Tax';
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
  amount: "",
  description: "",
  category_id: "",
  client_id: "",
  date: new Date().toISOString().split("T")[0],
  reference_number: "",
  tax_rate: defaultTaxRate.toString(),
  tax_amount: "0",
  currency: baseCurrency, // ADD THIS LINE
});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRateWarning, setShowRateWarning] = useState(false);
const [originalRate, setOriginalRate] = useState<number | null>(null);
const [useHistoricalRate, setUseHistoricalRate] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [isAddingClient, setIsAddingClient] = useState(false);

  useEffect(() => {
    loadCategories();
    loadClients();
    if (isEdit && id) {
      loadIncome();
    }
  }, [id, isEdit]);

  useEffect(() => {
  if (isUserSettingsReady && baseCurrency && formData.currency !== baseCurrency) {
    setFormData(prev => ({
      ...prev,
      currency: baseCurrency
    }));
  }
}, [isUserSettingsReady, baseCurrency]);

  useEffect(() => {
  if (formData.currency && formData.currency !== baseCurrency) {
    fetchExchangeRate();
  }
}, [formData.currency]);

  const [showAddCategory, setShowAddCategory] = useState(false);

  const loadCategories = async () => {
    if (!user) return;

    try {
      const data = await getCategories(user.id, "income");
      setCategories(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadClients = async () => {
    if (!user) return;

    try {
      const data = await getClients(user.id);
      setClients(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadIncome = async () => {
    if (!user || !id) return;

    try {
      const incomes = await getIncomes(user.id);
      const income = incomes.find((i) => i.id === id);

      if (income) {
  setFormData({
    amount: income.amount.toString(),
    description: income.description,
    category_id: income.category_id || "",
    client_id: income.client_id || "",
    date: income.date,
    reference_number: income.reference_number || "",
    tax_rate: (income.tax_rate || defaultTaxRate).toString(),
    tax_amount: (income.tax_amount || 0).toString(),
    currency: income.currency || baseCurrency,
  });
  
  // Store original exchange rate for comparison
  if (income.exchange_rate && income.currency !== baseCurrency) {
    setOriginalRate(income.exchange_rate);
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

  const handleCreateClient = async () => {
    if (!user || !newClientData.name.trim()) return;

    setIsAddingClient(true);

    try {
      const client = await createClient({
        user_id: user.id,
        name: newClientData.name.trim(),
        company_name: newClientData.company_name || undefined,
        email: newClientData.email || undefined,
        phone: newClientData.phone || undefined,
        address: newClientData.address || undefined,
      });

      // Add to local clients list
      setClients([...clients, client]);

      // Add to global cache
      addClientToCache(client); // ✅ Add this line

      // Select the new client
      setFormData({ ...formData, client_id: client.id });

      // Close modal and reset
      setShowClientModal(false);
      setNewClientData({ name: "", company_name: "", email: "", phone: "", address: "" });
    } catch (err: any) {
      setError("Error creating client: " + err.message);
    } finally {
      setIsAddingClient(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      // Calculate base amount CORRECTLY (excluding VAT)
     // REPLACE Lines 186-203 with:
// Calculate amounts correctly for VAT-exclusive entry
const netAmount = parseFloat(formData.amount) || 0;  // User enters NET
const taxAmount = parseFloat(formData.tax_amount) || 0;
const grossAmount = netAmount + taxAmount;  // Total includes tax

const exchangeRate = formData.currency !== baseCurrency 
  ? (useHistoricalRate && originalRate && isEdit ? originalRate : (exchangeRates[formData.currency] || 1)) 
  : 1;

// Convert NET amount to base currency (excluding VAT)
const baseAmount = netAmount / exchangeRate;
const baseTaxAmount = taxAmount / exchangeRate;

const incomeData = {
  user_id: user.id,
  amount: netAmount,  // Store NET amount (matching invoice behavior)
  description: formData.description,
  category_id: formData.category_id || undefined,
  client_id: formData.client_id || undefined,
  date: formData.date,
  reference_number: formData.reference_number || undefined,
  tax_rate: parseFloat(formData.tax_rate) || undefined,
  tax_amount: taxAmount,
  currency: formData.currency,
  exchange_rate: exchangeRate,
  base_amount: baseAmount,  // NET in base currency
  base_tax_amount: baseTaxAmount,  // Tax in base currency
};

      if (isEdit && id) {
        const updatedIncome = await updateIncome(id, incomeData);
        updateIncomeInCache(id, updatedIncome); 
      } else {
        const newIncome = await createIncome(incomeData);

        // Add to cache instantly!
        addIncomeToCache(newIncome);
      }

      navigate("/income");
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
          onClick={() => navigate("/income")}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Income
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isEdit ? "Edit Income" : "Add Income"}
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
                 Amount (excluding {taxLabel}) *
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
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Income description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>

                  <select
  value={formData.category_id}
  onChange={(e) => {
    if (e.target.value === "new") {
      setShowAddCategory(true);
    } else {
      setFormData({ ...formData, category_id: e.target.value });
    }
  }}
  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="new" className="font-semibold text-blue-600 border-t">
    ➕ Add or delete category ...
  </option>
  <option value="">Select category</option>
  {categories.map((category) => (
    <option key={category.id} value={category.id}>
      {category.name}
    </option>
  ))}
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
              {parseFloat(formData.tax_rate) > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                {taxLabel} Amount: {formatCurrency(parseFloat(formData.tax_amount) || 0, formData.currency)}
              </p>
              )}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional reference"
              />
            </div>
          </div>

          {/* Client Selection - ADD THIS ENTIRE BLOCK */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client
            </label>
            <div className="flex gap-2">
              <select
                value={formData.client_id}
                onChange={(e) =>
                  setFormData({ ...formData, client_id: e.target.value })
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a client (optional)</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              {/* // In your client selection field, update the button: */}
              <button
                type="button"
                onClick={() => {
                  console.log("Button clicked!"); // Add this for debugging
                  setShowClientModal(true);
                }}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
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
              onClick={() => navigate("/income")}
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
              {loading ? "Saving..." : "Save Income"}
            </button>
          </div>
        </form>
      </div>
      {/* Add Category Modal */}
      <AddCategoryModal
        isOpen={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        type="income"
        currentCategories={categories}
        onCategoryAdded={(newCategory) => {
          setCategories([...categories, newCategory]);
          setFormData({ ...formData, category_id: newCategory.id });
        }}
        onCategoryDeleted={(categoryId) => {
          // Remove from categories list
          setCategories(categories.filter((cat) => cat.id !== categoryId));
          // Clear selection if deleted category was selected
          if (formData.category_id === categoryId) {
            setFormData({ ...formData, category_id: "" });
          }
        }}
      />
      {/* Client Creation Modal - ADD THIS ENTIRE BLOCK */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Add New Client</h3>
                <button
                  onClick={() => {
                    setShowClientModal(false);
                    setNewClientData({
                      name: "",
                      company_name: "",
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
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={newClientData.name}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Client name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={newClientData.company_name}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        company_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Company name (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="client@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newClientData.phone}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={newClientData.address}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        address: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Street address..."
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowClientModal(false);
                  setNewClientData({
                    name: "",
                    company_name: "",
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
                onClick={handleCreateClient}
                disabled={!newClientData.name.trim() || isAddingClient}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isAddingClient ? "Creating..." : "Create Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
