import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../services/supabaseClient';
import { format, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns';
import { 
  FileText, 
  Download, 
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Building2
} from 'lucide-react';
import { countries } from '../../data/countries';

interface VATData {
  outputVAT: number;  // VAT collected from sales
  inputVAT: number;   // VAT paid on purchases
  netVAT: number;     // Amount owed/refundable
  byRate: {
    [rate: string]: {
      sales: { net: number; vat: number };
      purchases: { net: number; vat: number };
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
    // Load INCOME entries for output VAT (not invoices!)
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

    // Calculate VAT data
    const data: VATData = {
      outputVAT: 0,
      inputVAT: 0,
      netVAT: 0,
      byRate: {}
    };

    // Process INCOME entries for output VAT
    incomes?.forEach(income => {
      // Check if this income has line-item VAT breakdown in tax_metadata
      if (income.tax_metadata?.tax_breakdown && typeof income.tax_metadata.tax_breakdown === 'object') {
        // This is from an invoice with line-item VAT
        Object.entries(income.tax_metadata.tax_breakdown).forEach(([rate, breakdown]: [string, any]) => {
          const rateNum = parseFloat(rate);
          
          data.outputVAT += breakdown.tax_amount || 0;
          
          if (!data.byRate[rateNum]) {
            data.byRate[rateNum] = {
              sales: { net: 0, vat: 0 },
              purchases: { net: 0, vat: 0 }
            };
          }
          data.byRate[rateNum].sales.net += breakdown.net_amount || 0;
          data.byRate[rateNum].sales.vat += breakdown.tax_amount || 0;
        });
      } else {
        // Regular income entry (not from invoice or simple tax)
        const rate = income.tax_rate || 0;
        const vatAmount = income.tax_amount || 0;
        const netAmount = income.amount || 0; // amount is already the net amount
        
        if (rate > 0 || vatAmount > 0) {
          data.outputVAT += vatAmount;
          
          if (!data.byRate[rate]) {
            data.byRate[rate] = {
              sales: { net: 0, vat: 0 },
              purchases: { net: 0, vat: 0 }
            };
          }
          data.byRate[rate].sales.net += netAmount;
          data.byRate[rate].sales.vat += vatAmount;
        }
      }
    });

    // Process expenses for input VAT (unchanged)
    expenses?.forEach(expense => {
      const rate = expense.tax_rate || 0;
      const vatAmount = expense.tax_amount || 0;
      const netAmount = expense.amount || 0; // Expenses store net amount

      if (rate > 0 || vatAmount > 0) {
        data.inputVAT += vatAmount;

        if (!data.byRate[rate]) {
          data.byRate[rate] = {
            sales: { net: 0, vat: 0 },
            purchases: { net: 0, vat: 0 }
          };
        }
        data.byRate[rate].purchases.net += netAmount;
        data.byRate[rate].purchases.vat += vatAmount;
      }
    });

    // Calculate net VAT
    data.netVAT = data.outputVAT - data.inputVAT;

    setVatData(data);
  } catch (error) {
    console.error('Error loading VAT data:', error);
  } finally {
    setLoading(false);
  }
};

  const exportToCSV = () => {
    const rows = [
      [`${taxLabel} Report`, `${dateRange.start} to ${dateRange.end}`],
      [],
      ['Summary'],
      [`Output ${taxLabel} (Sales)`, formatCurrency(vatData.outputVAT, baseCurrency)],
      [`Input ${taxLabel} (Purchases)`, formatCurrency(vatData.inputVAT, baseCurrency)],
      [`Net ${taxLabel}`, formatCurrency(vatData.netVAT, baseCurrency)],
      [],
      [`${taxLabel} Breakdown by Rate`],
      ['Rate', 'Sales Net', `Sales ${taxLabel}`, 'Purchases Net', `Purchases ${taxLabel}`]
    ];

    Object.entries(vatData.byRate).forEach(([rate, data]) => {
      rows.push([
        `${rate}%`,
        formatCurrency(data.sales.net, baseCurrency),
        formatCurrency(data.sales.vat, baseCurrency),
        formatCurrency(data.purchases.net, baseCurrency),
        formatCurrency(data.purchases.vat, baseCurrency)
      ]);
    });

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${taxLabel}-Report-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
  };

  const setQuarterDates = (quarterOffset: number) => {
    const date = quarterOffset === 0 ? new Date() : subQuarters(new Date(), -quarterOffset);
    setDateRange({
      start: format(startOfQuarter(date), 'yyyy-MM-dd'),
      end: format(endOfQuarter(date), 'yyyy-MM-dd')
    });
  };

  if (!userCountry?.taxFeatures?.requiresInvoiceTaxBreakdown) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-yellow-900">
                {taxLabel} Report Not Available
              </h3>
              <p className="mt-2 text-sm text-yellow-700">
                Detailed {taxLabel} reporting is only available for countries that require line-item tax breakdown.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isUK ? 'VAT Return' : `${taxLabel} Report`}
            </h1>
            <p className="text-gray-600 mt-1">
              {isUK ? 'HMRC VAT Return Summary' : `${taxLabel} summary for your records`}
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Calendar className="h-5 w-5 text-gray-400" />
            <div>
              <label className="text-sm font-medium text-gray-700">Period</label>
              <div className="flex items-center space-x-4 mt-1">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setQuarterDates(0)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Current Quarter
            </button>
            <button
              onClick={() => setQuarterDates(-1)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Last Quarter
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Output {taxLabel}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(vatData.outputVAT, baseCurrency)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">From sales</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Input {taxLabel}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(vatData.inputVAT, baseCurrency)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">From purchases</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Net {taxLabel} {vatData.netVAT >= 0 ? 'Payable' : 'Refundable'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(Math.abs(vatData.netVAT), baseCurrency)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {vatData.netVAT >= 0 ? 'Amount owed' : 'Amount to reclaim'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${
                  vatData.netVAT >= 0 ? 'bg-blue-100' : 'bg-purple-100'
                }`}>
                  <Building2 className={`h-6 w-6 ${
                    vatData.netVAT >= 0 ? 'text-blue-600' : 'text-purple-600'
                  }`} />
                </div>
              </div>
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
                      Net {taxLabel}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(vatData.byRate).map(([rate, data]) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(data.sales.vat - data.purchases.vat, baseCurrency)}
                      </td>
                    </tr>
                  ))}
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
                    <li>Box 4: VAT reclaimed on purchases = {formatCurrency(vatData.inputVAT, baseCurrency)}</li>
                    <li>Box 5: Net VAT = {formatCurrency(Math.abs(vatData.netVAT), baseCurrency)}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};