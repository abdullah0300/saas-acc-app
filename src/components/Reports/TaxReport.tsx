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
  Calculator
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getIncomes, getExpenses } from '../../services/database';
import { format, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subQuarters, subYears } from 'date-fns';

interface TaxPeriodData {
  period: string;
  startDate: string;
  endDate: string;
  taxCollected: number;
  salesAmount: number;
  taxPaid: number;
  purchaseAmount: number;
  netTax: number;
  transactionCount: {
    income: number;
    expense: number;
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
  const { formatCurrency, defaultTaxRate } = useSettings();
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
      const [incomes, expenses] = await Promise.all([
        getIncomes(user.id, startDate, endDate),
        getExpenses(user.id, startDate, endDate)
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
        
        // Calculate tax collected (from income/sales)
        const taxCollected = periodIncomes.reduce((sum, inc) => {
          const taxAmount = inc.tax_amount || (inc.amount * (inc.tax_rate || defaultTaxRate || 0) / 100);
          return sum + taxAmount;
        }, 0);
        
        const salesAmount = periodIncomes.reduce((sum, inc) => sum + inc.amount, 0);
        
        // Calculate tax paid (from expenses/purchases)
        const taxPaid = periodExpenses.reduce((sum, exp) => {
          const taxAmount = exp.tax_amount || (exp.amount * (exp.tax_rate || defaultTaxRate || 0) / 100);
          return sum + taxAmount;
        }, 0);
        
        const purchaseAmount = periodExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        return {
          period: period.label,
          startDate: period.startDate,
          endDate: period.endDate,
          taxCollected,
          salesAmount,
          taxPaid,
          purchaseAmount,
          netTax: taxCollected - taxPaid,
          transactionCount: {
            income: periodIncomes.length,
            expense: periodExpenses.length
          }
        };
      });
      
      // Calculate totals
      const totalTaxCollected = periodData.reduce((sum, p) => sum + p.taxCollected, 0);
      const totalTaxPaid = periodData.reduce((sum, p) => sum + p.taxPaid, 0);
      const totalSales = periodData.reduce((sum, p) => sum + p.salesAmount, 0);
      
      setTaxSummary({
        totalTaxCollected,
        totalTaxPaid,
        netTaxLiability: totalTaxCollected - totalTaxPaid,
        averageTaxRate: totalSales > 0 ? (totalTaxCollected / totalSales) * 100 : 0,
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
    csv += `Default Tax Rate: ${defaultTaxRate}%\n\n`;
    
    // Summary section
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const netTaxColor = taxSummary.netTaxLiability >= 0 ? 'text-red-600' : 'text-green-600';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Advanced Tax Report</h1>
            <p className="mt-1 text-sm text-gray-600">
              Comprehensive tax summary for filing and compliance
            </p>
          </div>
          <button
            onClick={exportTaxReport}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as 'quarterly' | 'annual')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {[0, 1, 2, 3, 4].map(y => {
                const yearOption = new Date().getFullYear() - y;
                return (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="h-5 w-5 text-green-600" />
            <span className="text-sm text-gray-500">Collected</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(taxSummary.totalTaxCollected)}
          </p>
          <p className="text-sm text-gray-600 mt-1">From sales</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-gray-500">Paid</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(taxSummary.totalTaxPaid)}
          </p>
          <p className="text-sm text-gray-600 mt-1">On purchases</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Calculator className="h-5 w-5 text-purple-600" />
            <span className="text-sm text-gray-500">Net Tax</span>
          </div>
          <p className={`text-2xl font-bold ${netTaxColor}`}>
            {formatCurrency(Math.abs(taxSummary.netTaxLiability))}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {taxSummary.netTaxLiability >= 0 ? 'To remit' : 'Refundable'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-5 w-5 text-orange-600" />
            <span className="text-sm text-gray-500">Avg Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {taxSummary.averageTaxRate.toFixed(2)}%
          </p>
          <p className="text-sm text-gray-600 mt-1">Effective rate</p>
        </div>
      </div>

      {/* Period Breakdown Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Period Breakdown</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sales
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax Collected
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchases
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax Paid
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Tax
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transactions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {taxSummary.periods.map((period, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {period.period}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(period.salesAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-medium">
                    {formatCurrency(period.taxCollected)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(period.purchaseAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right font-medium">
                    {formatCurrency(period.taxPaid)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                    <span className={period.netTax >= 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(Math.abs(period.netTax))}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-green-600">{period.transactionCount.income}</span>
                      <span>/</span>
                      <span className="text-blue-600">{period.transactionCount.expense}</span>
                    </div>
                  </td>
                </tr>
              ))}
              
              {/* Total Row */}
              <tr className="bg-gray-50 font-medium">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  Total
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {formatCurrency(taxSummary.periods.reduce((sum, p) => sum + p.salesAmount, 0))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">
                  {formatCurrency(taxSummary.totalTaxCollected)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {formatCurrency(taxSummary.periods.reduce((sum, p) => sum + p.purchaseAmount, 0))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right">
                  {formatCurrency(taxSummary.totalTaxPaid)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
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

      {/* Information Alert */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-900">Important Notes</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>This report is based on the tax rates applied to each transaction</li>
                <li>Net tax liability shows the amount you need to remit to tax authorities</li>
                <li>Consult with a tax professional for accurate filing</li>
                <li>Export this report for your accountant or tax filing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};