// src/components/Reports/VATReport.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../services/supabaseClient';
import { format, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns';
import { CreditNote, CreditNoteItem } from '../../types';
import { getCreditNotes } from '../../services/database';
import { 
  FileText, 
  Download, 
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Building2,
  CreditCard
} from 'lucide-react';
import { countries } from '../../data/countries';

interface VATData {
  outputVAT: number;  // VAT collected from sales
  inputVAT: number;   // VAT paid on purchases
  netVAT: number;     // Amount owed/refundable
  creditNoteAdjustment: number; // Credit note VAT adjustments
  byRate: {
    [rate: string]: {
      sales: { net: number; vat: number };
      purchases: { net: number; vat: number };
      creditNotes: { net: number; vat: number };
    };
  };
}

export const VATReport: React.FC = () => {
  const { user } = useAuth();
  const { userSettings, formatCurrency, baseCurrency } = useSettings();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: format(startOfQuarter(new Date()), 'yyyy-MM-dd'),
    end: format(endOfQuarter(new Date()), 'yyyy-MM-dd')
  });
  const [vatData, setVatData] = useState<VATData>({
    outputVAT: 0,
    inputVAT: 0,
    netVAT: 0,
    creditNoteAdjustment: 0,
    byRate: {}
  });

  const userCountry = countries.find(c => c.code === userSettings?.country);
  const taxLabel = userCountry?.taxName || 'Tax';
  const isUK = userSettings?.country === 'GB';

  useEffect(() => {
    if (user) {
      loadVATData();
    }
  }, [user, dateRange]);

  const loadVATData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load INCOME entries for output VAT
      const { data: incomes, error: incomeError } = await supabase
        .from('income')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      if (incomeError) throw incomeError;

      // Load expenses for input VAT
      const { data: expenses, error: expenseError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      if (expenseError) throw expenseError;

      // NEW: Load credit notes that have been applied
      const { data: creditNotes, error: creditNoteError } = await supabase
        .from('credit_notes')
        .select('*, items:credit_note_items(*)')
        .eq('user_id', user.id)
        .eq('applied_to_income', true)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      if (creditNoteError) throw creditNoteError;

      // Calculate VAT data
      const data: VATData = {
        outputVAT: 0,
        inputVAT: 0,
        netVAT: 0,
        creditNoteAdjustment: 0,
        byRate: {}
      };

      // Process INCOME entries for output VAT
      incomes?.forEach(income => {
        // Skip credit note refunds (negative income entries)
        if (income.credit_note_id) {
          return; // These are handled separately
        }

        // Check if this income has line-item VAT breakdown
        if (income.tax_metadata?.tax_breakdown && typeof income.tax_metadata.tax_breakdown === 'object') {
          Object.entries(income.tax_metadata.tax_breakdown).forEach(([rate, breakdown]: [string, any]) => {
            const rateNum = parseFloat(rate);
            
            data.outputVAT += breakdown.tax_amount || 0;
            
            if (!data.byRate[rateNum]) {
              data.byRate[rateNum] = {
                sales: { net: 0, vat: 0 },
                purchases: { net: 0, vat: 0 },
                creditNotes: { net: 0, vat: 0 }
              };
            }
            data.byRate[rateNum].sales.net += breakdown.net_amount || 0;
            data.byRate[rateNum].sales.vat += breakdown.tax_amount || 0;
          });
        } else {
          // Regular income entry
          const rate = income.tax_rate || 0;
          const vatAmount = income.tax_amount || 0;
          const netAmount = income.amount || 0;
          
          if (rate > 0 || vatAmount > 0) {
            data.outputVAT += vatAmount;
            
            if (!data.byRate[rate]) {
              data.byRate[rate] = {
                sales: { net: 0, vat: 0 },
                purchases: { net: 0, vat: 0 },
                creditNotes: { net: 0, vat: 0 }
              };
            }
            data.byRate[rate].sales.net += netAmount;
            data.byRate[rate].sales.vat += vatAmount;
          }
        }
      });

      // Process expenses for input VAT
      expenses?.forEach(expense => {
        const rate = expense.tax_rate || 0;
        const vatAmount = expense.tax_amount || 0;
        const netAmount = expense.amount || 0;

        if (rate > 0 || vatAmount > 0) {
          data.inputVAT += vatAmount;

          if (!data.byRate[rate]) {
            data.byRate[rate] = {
              sales: { net: 0, vat: 0 },
              purchases: { net: 0, vat: 0 },
              creditNotes: { net: 0, vat: 0 }
            };
          }
          data.byRate[rate].purchases.net += netAmount;
          data.byRate[rate].purchases.vat += vatAmount;
        }
      });

      // NEW: Process credit notes for VAT adjustments
      creditNotes?.forEach(creditNote => {
        // For UK/EU with line-item VAT
        if (creditNote.items && creditNote.items.length > 0) {
          creditNote.items.forEach((item: CreditNoteItem) => {
            const rate = item.tax_rate || 0;
            const vatAmount = item.tax_amount || 0;
            const netAmount = item.net_amount || item.amount || 0;

            if (rate > 0 || vatAmount > 0) {
              data.creditNoteAdjustment += vatAmount;
              
              if (!data.byRate[rate]) {
                data.byRate[rate] = {
                  sales: { net: 0, vat: 0 },
                  purchases: { net: 0, vat: 0 },
                  creditNotes: { net: 0, vat: 0 }
                };
              }
              data.byRate[rate].creditNotes.net += netAmount;
              data.byRate[rate].creditNotes.vat += vatAmount;
            }
          });
        } else {
          // Simple credit note with overall tax
          const rate = creditNote.tax_rate || 0;
          const vatAmount = creditNote.tax_amount || 0;
          const netAmount = creditNote.subtotal || 0;

          if (rate > 0 || vatAmount > 0) {
            data.creditNoteAdjustment += vatAmount;
            
            if (!data.byRate[rate]) {
              data.byRate[rate] = {
                sales: { net: 0, vat: 0 },
                purchases: { net: 0, vat: 0 },
                creditNotes: { net: 0, vat: 0 }
              };
            }
            data.byRate[rate].creditNotes.net += netAmount;
            data.byRate[rate].creditNotes.vat += vatAmount;
          }
        }
      });

      // Calculate net VAT (output - input - credit note adjustments)
      data.netVAT = data.outputVAT - data.inputVAT - data.creditNoteAdjustment;

      setVatData(data);
    } catch (error) {
      console.error('Error loading VAT data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csvData = [
      [`${taxLabel} Report`],
      [`Period: ${dateRange.start} to ${dateRange.end}`],
      [''],
      ['Summary'],
      [`Output ${taxLabel}`, vatData.outputVAT.toFixed(2)],
      [`Input ${taxLabel}`, vatData.inputVAT.toFixed(2)],
      [`Credit Note Adjustments`, vatData.creditNoteAdjustment.toFixed(2)],
      [`Net ${taxLabel}`, vatData.netVAT.toFixed(2)],
      [''],
      [`${taxLabel} Breakdown by Rate`],
      ['Rate', 'Sales Net', `Sales ${taxLabel}`, 'Purchases Net', `Purchases ${taxLabel}`, 'Credit Notes Net', `Credit Notes ${taxLabel}`, `Net ${taxLabel}`]
    ];

    Object.entries(vatData.byRate).forEach(([rate, data]) => {
      const netVat = data.sales.vat - data.purchases.vat - data.creditNotes.vat;
      csvData.push([
        `${rate}%`,
        data.sales.net.toFixed(2),
        data.sales.vat.toFixed(2),
        data.purchases.net.toFixed(2),
        data.purchases.vat.toFixed(2),
        data.creditNotes.net.toFixed(2),
        data.creditNotes.vat.toFixed(2),
        netVat.toFixed(2)
      ]);
    });

    if (isUK) {
      csvData.push(['']);
      csvData.push(['HMRC VAT Return Boxes']);
      csvData.push([`Box 1: VAT due on sales`, vatData.outputVAT.toFixed(2)]);
      csvData.push([`Box 2: VAT due on EU acquisitions`, '0.00']);
      csvData.push([`Box 3: Total VAT due`, vatData.outputVAT.toFixed(2)]);
      csvData.push([`Box 4: VAT reclaimed on purchases`, vatData.inputVAT.toFixed(2)]);
      csvData.push([`Box 5: Net VAT`, Math.abs(vatData.netVAT).toFixed(2)]);
    }

    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vat-report-${dateRange.start}-${dateRange.end}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {isUK ? 'VAT Return' : `${taxLabel} Report`}
            </h1>
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="h-5 w-5 mr-2" />
              Export Report
            </button>
          </div>

          {/* Date Range Selector */}
          <div className="flex gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  const start = startOfQuarter(new Date());
                  const end = endOfQuarter(new Date());
                  setDateRange({
                    start: format(start, 'yyyy-MM-dd'),
                    end: format(end, 'yyyy-MM-dd')
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                This Quarter
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading {taxLabel} data...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Output VAT */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-100 rounded-full">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Output {taxLabel}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(vatData.outputVAT, baseCurrency)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Collected from sales
                </p>
              </div>

              {/* Input VAT */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-100 rounded-full">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Input {taxLabel}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(vatData.inputVAT, baseCurrency)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Paid on purchases
                </p>
              </div>

              {/* Credit Note Adjustments */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-100 rounded-full">
                    <CreditCard className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Credit Note {taxLabel}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(vatData.creditNoteAdjustment, baseCurrency)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Adjustments from credit notes
                </p>
              </div>

              {/* Net VAT */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-full ${
                    vatData.netVAT >= 0 ? 'bg-blue-100' : 'bg-purple-100'
                  }`}>
                    <Building2 className={`h-6 w-6 ${
                      vatData.netVAT >= 0 ? 'text-blue-600' : 'text-purple-600'
                    }`} />
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">Net {taxLabel}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(Math.abs(vatData.netVAT), baseCurrency)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {vatData.netVAT >= 0 ? 'Amount owed' : 'Amount to reclaim'}
                </p>
              </div>
            </div>

            {/* VAT Breakdown by Rate */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">
                  {taxLabel} Breakdown by Rate
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sales Net
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sales {taxLabel}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Purchases Net
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Purchases {taxLabel}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credit Notes Net
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credit Notes {taxLabel}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Net {taxLabel}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(vatData.byRate).map(([rate, data]) => {
                      const netVat = data.sales.vat - data.purchases.vat - data.creditNotes.vat;
                      return (
                        <tr key={rate}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {rate}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(data.sales.net, baseCurrency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(data.sales.vat, baseCurrency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(data.purchases.net, baseCurrency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(data.purchases.vat, baseCurrency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(data.creditNotes.net, baseCurrency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(data.creditNotes.vat, baseCurrency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(netVat, baseCurrency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HMRC Reference for UK */}
            {isUK && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">HMRC VAT Return Boxes</p>
                    <ul className="space-y-1">
                      <li>Box 1: VAT due on sales = {formatCurrency(vatData.outputVAT, baseCurrency)}</li>
                      <li>Box 2: VAT due on EU acquisitions = {formatCurrency(0, baseCurrency)}</li>
                      <li>Box 3: Total VAT due = {formatCurrency(vatData.outputVAT, baseCurrency)}</li>
                      <li>Box 4: VAT reclaimed on purchases = {formatCurrency(vatData.inputVAT, baseCurrency)}</li>
                      <li>Box 5: Net VAT = {formatCurrency(Math.abs(vatData.netVAT), baseCurrency)}</li>
                      <li>Box 6: Total sales ex VAT = (calculated from income)</li>
                      <li>Box 7: Total purchases ex VAT = (calculated from expenses)</li>
                      <li className="text-orange-700">
                        Note: Credit note adjustments of {formatCurrency(vatData.creditNoteAdjustment, baseCurrency)} have been applied
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};