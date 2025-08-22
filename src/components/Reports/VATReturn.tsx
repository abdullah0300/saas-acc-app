import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { calculateVATReturn } from '../../services/vatReturn';
import { Calendar, Download, AlertCircle } from 'lucide-react';
import { format, startOfQuarter, endOfQuarter } from 'date-fns';
import { supabase } from '../../services/supabaseClient';
export const VATReturn: React.FC = () => {
  const { user } = useAuth();
  const { userSettings, formatCurrency, baseCurrency } = useSettings();
  const [loading, setLoading] = useState(false);
  const [vatReturn, setVatReturn] = useState<any>(null);
  const [period, setPeriod] = useState('current');

  // Check if UK user
  if (userSettings?.country !== 'GB') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-900">UK Only Feature</h3>
              <p className="text-yellow-800 mt-1">
                VAT Returns are only available for UK businesses.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCalculate = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const now = new Date();
      const startDate = startOfQuarter(now);
      const endDate = endOfQuarter(now);
      
      const boxes = await calculateVATReturn(user.id, startDate, endDate);
      setVatReturn(boxes);
    } catch (error) {
      console.error('Error calculating VAT return:', error);
      alert('Error calculating VAT return');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToHMRC = async () => {
  if (!vatReturn || !user) return;
  
  const confirmed = window.confirm(
    'Are you sure you want to submit this VAT return to HMRC? ' +
    'Once submitted, all related records will be locked and cannot be edited.'
  );
  
  if (!confirmed) return;
  
  setLoading(true);
  try {
    // Save VAT return to database
    const { data: savedReturn, error } = await supabase
      .from('uk_vat_returns')
      .insert({
        user_id: user.id,
        period_start: startOfQuarter(new Date()),
        period_end: endOfQuarter(new Date()),
        box1_vat_due_sales: vatReturn.box1,
        box2_vat_due_acquisitions: vatReturn.box2,
        box3_total_vat_due: vatReturn.box3,
        box4_vat_reclaimed: vatReturn.box4,
        box5_net_vat_due: vatReturn.box5,
        box6_total_sales_ex_vat: vatReturn.box6,
        box7_total_purchases_ex_vat: vatReturn.box7,
        box8_total_supplies_ex_vat: vatReturn.box8,
        box9_total_acquisitions_ex_vat: vatReturn.box9,
        base_currency: baseCurrency,
        status: 'submitted',
        submitted_at: new Date()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Lock all related records
    const startDate = startOfQuarter(new Date()).toISOString();
    const endDate = endOfQuarter(new Date()).toISOString();
    
    // Lock invoices
    await supabase
      .from('invoices')
      .update({ 
        vat_return_id: savedReturn.id,
        vat_locked_at: new Date()
      })
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate);
    
    // Lock expenses
    await supabase
      .from('expenses')
      .update({ 
        vat_return_id: savedReturn.id,
        vat_locked_at: new Date()
      })
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate);
    
    alert('VAT Return submitted successfully! Related records have been locked.');
  } catch (error) {
    console.error('Error submitting VAT return:', error);
    alert('Error submitting VAT return');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">UK VAT Return</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <button
          onClick={handleCalculate}
          disabled={loading}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {loading ? 'Calculating...' : 'Calculate VAT Return'}
        </button>
        {vatReturn && (
  <button
    onClick={handleSubmitToHMRC}
    disabled={loading}
    className="ml-3 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
  >
    {loading ? 'Submitting...' : 'Submit to HMRC'}
  </button>
)}

        {vatReturn && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Box 1: VAT due on sales</p>
                <p className="text-xl font-bold">{formatCurrency(vatReturn.box1, baseCurrency)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Box 4: VAT reclaimed</p>
                <p className="text-xl font-bold">{formatCurrency(vatReturn.box4, baseCurrency)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Box 5: Net VAT</p>
                <p className="text-xl font-bold">{formatCurrency(vatReturn.box5, baseCurrency)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Box 6: Total sales</p>
                <p className="text-xl font-bold">{formatCurrency(vatReturn.box6, baseCurrency)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};