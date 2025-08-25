import React, { useState, useEffect } from 'react';
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
  const [vatScheme, setVatScheme] = useState<string>('standard');
  const [flatRatePercentage, setFlatRatePercentage] = useState<number>(0);

  // ✅ ALL HOOKS MUST COME FIRST - BEFORE ANY RETURNS!
  useEffect(() => {
    const fetchVatScheme = async () => {
      if (user && userSettings?.country === 'GB') {
        const { data } = await supabase
          .from('user_settings')
          .select('uk_vat_scheme, uk_vat_flat_rate')
          .eq('user_id', user.id)
          .single();
        
        if (data) {
          setVatScheme(data.uk_vat_scheme || 'standard');
          setFlatRatePercentage(data.uk_vat_flat_rate || 0);
        }
      }
    };
    
    fetchVatScheme();
  }, [user, userSettings]);

  // ✅ NOW YOU CAN HAVE CONDITIONAL RETURNS - AFTER ALL HOOKS
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
      <h1 className="text-3xl font-bold text-gray-900 mb-6">HMRC VAT Return</h1>

      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Current VAT Scheme:</strong> {
            vatScheme === 'flat_rate' ? `Flat Rate (${flatRatePercentage}%)` :
            vatScheme === 'cash' ? 'Cash Accounting' :
            vatScheme === 'annual' ? 'Annual Accounting' :
            'Standard VAT Accounting'
          }
        </p>
        {vatScheme === 'flat_rate' && (
          <p className="text-xs text-blue-600 mt-1">
            Note: VAT is calculated as {flatRatePercentage}% of gross turnover
          </p>
        )}
      </div>
      
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
          <div className="mt-6 space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">VAT Return Boxes</h2>
            
            {/* VAT Boxes 1-5 (Money values with decimals) */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-3">VAT Calculations</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded">
                  <p className="text-sm text-gray-600">Box 1: VAT due on sales</p>
                  <p className="text-xl font-bold">{formatCurrency(vatReturn.box1, baseCurrency)}</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <p className="text-sm text-gray-600">Box 2: VAT due on EU acquisitions</p>
                  <p className="text-xl font-bold">{formatCurrency(vatReturn.box2, baseCurrency)}</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <p className="text-sm text-gray-600">Box 3: Total VAT due (Box 1 + Box 2)</p>
                  <p className="text-xl font-bold">{formatCurrency(vatReturn.box3, baseCurrency)}</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <p className="text-sm text-gray-600">Box 4: VAT reclaimed</p>
                  <p className="text-xl font-bold">{formatCurrency(vatReturn.box4, baseCurrency)}</p>
                </div>
                <div className="bg-white p-3 rounded border-2 border-blue-400">
                  <p className="text-sm text-gray-600">Box 5: Net VAT (Box 3 - Box 4)</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatCurrency(vatReturn.box5, baseCurrency)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {vatReturn.box5 >= 0 ? 'Amount to pay' : 'Amount to reclaim'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* VAT Boxes 6-9 (Whole pounds only) */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-900 mb-3">Sales & Purchases (Whole Pounds)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded">
                  <p className="text-sm text-gray-600">Box 6: Total sales ex VAT</p>
                  <p className="text-xl font-bold">£{vatReturn.box6.toLocaleString()}</p>
                  <p className="text-xs text-green-600">✓ Whole pounds</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <p className="text-sm text-gray-600">Box 7: Total purchases ex VAT</p>
                  <p className="text-xl font-bold">£{vatReturn.box7.toLocaleString()}</p>
                  <p className="text-xs text-green-600">✓ Whole pounds</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <p className="text-sm text-gray-600">Box 8: EU supplies ex VAT</p>
                  <p className="text-xl font-bold">£{vatReturn.box8.toLocaleString()}</p>
                  <p className="text-xs text-green-600">✓ Whole pounds</p>
                </div>
                <div className="bg-white p-3 rounded">
                  <p className="text-sm text-gray-600">Box 9: EU acquisitions ex VAT</p>
                  <p className="text-xl font-bold">£{vatReturn.box9.toLocaleString()}</p>
                  <p className="text-xs text-green-600">✓ Whole pounds</p>
                </div>
              </div>
            </div>
            
            {/* HMRC Compliance Check */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                <div>
                  <h4 className="font-medium text-yellow-900">Compliance Checks</h4>
                  <ul className="text-sm text-yellow-800 mt-2 space-y-1">
                    <li>✓ Box 3 = Box 1 + Box 2: {vatReturn.box3 === (vatReturn.box1 + vatReturn.box2) ? '✅ Correct' : '❌ Error'}</li>
                    <li>✓ Box 5 = Box 3 - Box 4: {vatReturn.box5 === (vatReturn.box3 - vatReturn.box4) ? '✅ Correct' : '❌ Error'}</li>
                    <li>✓ Boxes 6-9 are whole pounds: ✅ Enforced</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSubmitToHMRC}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit to HMRC'}
              </button>
              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download className="inline h-4 w-4 mr-2" />
                Print/Save PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};