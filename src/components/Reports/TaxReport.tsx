// src/components/Reports/TaxReport.tsx
import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  AlertCircle,
  ChevronDown,
  Calculator,
  Sparkles,
  RefreshCw,
  Shield
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getIncomes, getExpenses, getCreditNotes } from '../../services/database';
import { format, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subQuarters, subYears } from 'date-fns';

interface TaxPeriodData {
  period: string;
  startDate: string;
  endDate: string;
  taxCollected: number;
  creditNoteTaxAdjustment: number;  // Add this
  salesAmount: number;
  taxPaid: number;
  purchaseAmount: number;
  netTax: number;
  transactionCount: {
    income: number;
    expense: number;
    creditNotes: number;  // Add this
  };
}

interface TaxSummary {
  totalTaxCollected: number;
  totalTaxPaid: number;
  netTaxLiability: number;
  averageTaxRate: number;
  periods: TaxPeriodData[];
}

export const TaxReport: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency, defaultTaxRate } = useSettings();
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<'quarterly' | 'annual'>('quarterly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [taxSummary, setTaxSummary] = useState<TaxSummary>({
    totalTaxCollected: 0,
    totalTaxPaid: 0,
    netTaxLiability: 0,
    averageTaxRate: 0,
    periods: []
  });

  useEffect(() => {
    if (user) {
      loadTaxData();
    }
  }, [user, periodType, year]);

  const loadTaxData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Determine date range based on period type
      const periods = getPeriods();
      const startDate = periods[0].startDate;
      const endDate = periods[periods.length - 1].endDate;
      
      // Fetch all data for the selected period
      const [incomes, expenses, creditNotes] = await Promise.all([
        getIncomes(user.id, startDate, endDate),
        getExpenses(user.id, startDate, endDate),
        getCreditNotes(user.id, startDate, endDate)
      ]);
      
      // Process data by periods
      const periodData: TaxPeriodData[] = periods.map(period => {
        // Filter transactions for this period
        const periodIncomes = incomes.filter(inc => 
          inc.date >= period.startDate && inc.date <= period.endDate
        );
        const periodExpenses = expenses.filter(exp => 
          exp.date >= period.startDate && exp.date <= period.endDate
        );
        
        // Filter credit notes for this period
        const periodCreditNotes = creditNotes.filter(cn => 
          cn.date >= period.startDate && cn.date <= period.endDate && cn.applied_to_income
        );
        
        // Calculate tax adjustment from credit notes
        const creditNoteTaxAdjustment = periodCreditNotes.reduce((sum, cn) => {
          return sum + (cn.tax_amount || 0);
        }, 0);
                // Calculate tax collected (from income/sales) - using base amounts

          const taxCollected = periodIncomes.reduce((sum, inc) => {
            // If tax_amount exists, use it; otherwise calculate from base_amount
            const baseAmount = inc.base_amount || inc.amount;
            const taxAmount = inc.tax_amount || (baseAmount * (inc.tax_rate || defaultTaxRate || 0) / 100);
            return sum + taxAmount;
          }, 0);

          const salesAmount = periodIncomes.reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);
        
        // Calculate tax paid (from expenses/purchases) - using base amounts// Calculate tax paid (from expenses/purchases) - using base amounts
            const taxPaid = periodExpenses.reduce((sum, exp) => {
              // If tax_amount exists, use it; otherwise calculate from base_amount
              const baseAmount = exp.base_amount || exp.amount;
              const taxAmount = exp.tax_amount || (baseAmount * (exp.tax_rate || defaultTaxRate || 0) / 100);
              return sum + taxAmount;
            }, 0);

            const purchaseAmount = periodExpenses.reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);
        
        return {
          period: period.label,
          startDate: period.startDate,
          endDate: period.endDate,
          taxCollected,  // Keep original tax collected (don't subtract here)
          creditNoteTaxAdjustment,  // Add this field to track credit notes separately
          salesAmount,
          taxPaid,
          purchaseAmount,
          netTax: taxCollected - taxPaid - creditNoteTaxAdjustment,  // Subtract credit notes from net
          transactionCount: {
            income: periodIncomes.length,
            expense: periodExpenses.length,
            creditNotes: periodCreditNotes.length  // Add credit note count
          }
        };
      });
      
      // Calculate totals
      const totalTaxCollected = periodData.reduce((sum, p) => sum + p.taxCollected, 0);
      const totalCreditNoteAdjustment = periodData.reduce((sum, p) => sum + p.creditNoteTaxAdjustment, 0);
      const totalTaxPaid = periodData.reduce((sum, p) => sum + p.taxPaid, 0);
      const totalSales = periodData.reduce((sum, p) => sum + p.salesAmount, 0);
      
      setTaxSummary({
        totalTaxCollected: totalTaxCollected - totalCreditNoteAdjustment,  // Show net of credits
        totalTaxPaid,
        netTaxLiability: totalTaxCollected - totalTaxPaid - totalCreditNoteAdjustment,
        averageTaxRate: totalSales > 0 ? ((totalTaxCollected - totalCreditNoteAdjustment) / totalSales) * 100 : 0,
        periods: periodData
      });
      
    } catch (error) {
      console.error('Error loading tax data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriods = () => {
    const periods = [];
    
    if (periodType === 'quarterly') {
      // Get 4 quarters for the selected year
      for (let q = 0; q < 4; q++) {
        const quarterStart = startOfQuarter(new Date(year, q * 3, 1));
        const quarterEnd = endOfQuarter(quarterStart);
        
        periods.push({
          label: `Q${q + 1} ${year}`,
          startDate: format(quarterStart, 'yyyy-MM-dd'),
          endDate: format(quarterEnd, 'yyyy-MM-dd')
        });
      }
    } else {
      // Annual view - show current year and previous 2 years
      for (let y = 0; y < 3; y++) {
        const yearToShow = year - y;
        const yearStart = startOfYear(new Date(yearToShow, 0, 1));
        const yearEnd = endOfYear(yearStart);
        
        periods.unshift({
          label: `${yearToShow}`,
          startDate: format(yearStart, 'yyyy-MM-dd'),
          endDate: format(yearEnd, 'yyyy-MM-dd')
        });
      }
    }
    
    return periods;
  };

  const exportTaxReport = () => {
    // Generate CSV content
    let csv = 'Tax Report\n';
    csv += `Period: ${periodType === 'quarterly' ? `Year ${year}` : `${year - 2} - ${year}`}\n`;
    csv += `Generated: ${format(new Date(), 'MMMM dd, yyyy')}\n`;
    csv += `Currency: ${baseCurrency}\n`;
    csv += `Default Tax Rate: ${defaultTaxRate}%\n\n`;
    
    // Summary sectionf
    csv += 'SUMMARY\n';
    csv += `Total Tax Collected,${taxSummary.totalTaxCollected.toFixed(2)}\n`;
    csv += `Total Tax Paid,${taxSummary.totalTaxPaid.toFixed(2)}\n`;
    csv += `Net Tax Liability,${taxSummary.netTaxLiability.toFixed(2)}\n`;
    csv += `Average Tax Rate,${taxSummary.averageTaxRate.toFixed(2)}%\n\n`;
    
    // Period breakdown
    csv += 'PERIOD BREAKDOWN\n';
    csv += 'Period,Sales Amount,Tax Collected,Purchase Amount,Tax Paid,Net Tax,Income Transactions,Expense Transactions\n';
    
    taxSummary.periods.forEach(period => {
      csv += `${period.period},${period.salesAmount.toFixed(2)},${period.taxCollected.toFixed(2)},`;
      csv += `${period.purchaseAmount.toFixed(2)},${period.taxPaid.toFixed(2)},${period.netTax.toFixed(2)},`;
      csv += `${period.transactionCount.income},${period.transactionCount.expense}\n`;
    });
    
    // Download the file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${periodType}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 shadow-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  const netTaxColor = taxSummary.netTaxLiability >= 0 ? 'text-red-600' : 'text-green-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header - Enhanced with gradient and modern styling */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-start space-x-4">
              <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                <Calculator className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Advanced Tax Report ({baseCurrency})
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  Comprehensive tax summary for filing and compliance
                </p>
                <div className="flex items-center mt-3 text-sm text-gray-500">
                  <Shield className="h-4 w-4 mr-2" />
                  Professional tax reporting system
                </div>
              </div>
            </div>
            
            <button
              onClick={exportTaxReport}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Download className="h-5 w-5 mr-2" />
              Export Report
            </button>
          </div>
        </div>

        {/* Controls - Modern card styling */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Period Type</label>
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as 'quarterly' | 'annual')}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all duration-200"
              >
                <option value="quarterly">Quarterly View</option>
                <option value="annual">Annual Comparison</option>
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all duration-200"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={loadTaxData}
                disabled={loading}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50"
              >
                <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards - Enhanced with gradients and modern styling */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Tax Collected Card */}
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <Sparkles className="h-5 w-5 opacity-60" />
              </div>
              <p className="text-emerald-100 text-sm font-medium">Tax Collected ({baseCurrency})</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(taxSummary.totalTaxCollected, baseCurrency)}</p>
              <p className="text-emerald-100 text-sm mt-2">From sales</p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          {/* Tax Paid Card */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <TrendingDown className="h-6 w-6" />
                </div>
                <Sparkles className="h-5 w-5 opacity-60" />
              </div>
              <p className="text-orange-100 text-sm font-medium">Tax Paid ({baseCurrency})</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(taxSummary.totalTaxPaid, baseCurrency)}</p>
              <p className="text-orange-100 text-sm mt-2">On purchases</p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          {/* Net Tax Liability Card */}
          <div className={`bg-gradient-to-br ${taxSummary.netTaxLiability >= 0 ? 'from-red-500 to-red-600' : 'from-green-500 to-green-600'} rounded-2xl p-6 text-white relative overflow-hidden shadow-xl`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <DollarSign className="h-6 w-6" />
                </div>
                <Sparkles className="h-5 w-5 opacity-60" />
              </div>
              <p className="text-white/80 text-sm font-medium">Net Tax Liability ({baseCurrency})</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(Math.abs(taxSummary.netTaxLiability), baseCurrency)}</p>
              <p className="text-white/80 text-sm mt-2">
                {taxSummary.netTaxLiability >= 0 ? 'To remit' : 'Refundable'}
              </p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          {/* Average Rate Card */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <FileText className="h-6 w-6" />
                </div>
                <Sparkles className="h-5 w-5 opacity-60" />
              </div>
              <p className="text-indigo-100 text-sm font-medium">Avg Rate</p>
              <p className="text-3xl font-bold mt-1">{taxSummary.averageTaxRate.toFixed(2)}%</p>
              <p className="text-indigo-100 text-sm mt-2">Effective rate</p>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>
        </div>

        {/* Period Breakdown Table - Enhanced styling */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Period Breakdown</h2>
              <span className="text-sm text-gray-500">• Detailed tax analysis</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Period 
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Sales ({baseCurrency})
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Tax Collected ({baseCurrency})
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Purchases ({baseCurrency})
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Tax Paid ({baseCurrency})
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Net Tax ({baseCurrency})
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Transactions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {taxSummary.periods.map((period, index) => (
                  <tr key={period.period} className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-3 ${index % 4 === 0 ? 'bg-indigo-500' : index % 4 === 1 ? 'bg-purple-500' : index % 4 === 2 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                        <span className="text-sm font-semibold text-gray-900">{period.period}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(period.salesAmount, baseCurrency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600 text-right">
                      {formatCurrency(period.taxCollected - period.creditNoteTaxAdjustment, baseCurrency)}
                      {period.creditNoteTaxAdjustment > 0 && (
                        <span className="block text-xs text-orange-600">
                          (Credit: -{formatCurrency(period.creditNoteTaxAdjustment, baseCurrency)})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(period.purchaseAmount, baseCurrency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-amber-600 text-right">
                      {formatCurrency(period.taxPaid, baseCurrency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                      <span className={period.netTax >= 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(Math.abs(period.netTax), baseCurrency)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                      <div className="flex flex-col">
                        <span className="text-emerald-600 font-medium">{period.transactionCount.income} income</span>
                        <span className="text-amber-600 font-medium">{period.transactionCount.expense} expense</span>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {/* Summary Row */}
                <tr className="bg-gradient-to-r from-indigo-50 to-purple-50 border-t-2 border-indigo-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-gray-900 flex items-center">
                      <Calculator className="h-4 w-4 mr-2 text-indigo-600" />
                      TOTAL
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    {formatCurrency(taxSummary.periods.reduce((sum, p) => sum + p.salesAmount, 0))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600 text-right">
                    {formatCurrency(taxSummary.totalTaxCollected)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    {formatCurrency(taxSummary.periods.reduce((sum, p) => sum + p.purchaseAmount, 0))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-amber-600 text-right">
                    {formatCurrency(taxSummary.totalTaxPaid)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                    <span className={taxSummary.netTaxLiability >= 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(Math.abs(taxSummary.netTaxLiability))}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    -
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Information Alert - Enhanced styling */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 shadow-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-bold text-blue-900 flex items-center">
                Important Notes
                <Shield className="h-4 w-4 ml-2" />
              </h3>
              <div className="mt-3 text-sm text-blue-800">
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    This report is based on the tax rates applied to each transaction
                  </li>
                  <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  All amounts are shown in your base currency ({baseCurrency})
                </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Net tax liability shows the amount you need to remit to tax authorities
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Consult with a tax professional for accurate filing
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Export this report for your accountant or tax filing
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};