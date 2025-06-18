import React, { useState, useEffect } from 'react';
import { Save, Plus, X, Percent, Globe } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext'; // Added useSettings import
import { supabase } from '../../services/supabaseClient';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  is_default: boolean;
  created_at: string;
}

export const TaxSettings: React.FC = () => {
  const { user } = useAuth();
  const { refreshSettings } = useSettings(); // Added refreshSettings
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTax, setNewTax] = useState({ name: '', rate: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadTaxRates();
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
      await refreshSettings(); // Added refreshSettings
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
      // First, unset all defaults
      await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .eq('user_id', user.id);
      
      // Then set the new default
      await supabase
        .from('tax_rates')
        .update({ is_default: true })
        .eq('id', id);
      
      await loadTaxRates();
      await refreshSettings(); // Added refreshSettings
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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Tax Settings</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

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