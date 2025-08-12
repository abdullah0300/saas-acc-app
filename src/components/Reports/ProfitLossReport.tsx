// src/components/Reports/ProfitLossReport.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Calendar, Printer, Building, TrendingUp, TrendingDown } from 'lucide-react';
import { getIncomes, getExpenses, getProfile } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Income, Expense, User } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';

export const ProfitLossReport: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [profile, setProfile] = useState<User | null>(null);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatCurrency, baseCurrency } = useSettings();

  useEffect(() => {
    if (user) {
      loadReportData();
    }
  }, [user, startDate, endDate]);

  const loadReportData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [profileData, incomeData, expenseData] = await Promise.all([
        getProfile(user.id),
        getIncomes(user.id, startDate, endDate),
        getExpenses(user.id, startDate, endDate)
      ]);

      setProfile(profileData);
      setIncomes(incomeData);
      setExpenses(expenseData);
    } catch (err: any) {
      console.error('Error loading report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    // Hide all elements except the report content for printing
    const reportContent = document.getElementById('profit-loss-report');
    const originalContents = document.body.innerHTML;
    
    if (reportContent) {
      const printContents = reportContent.outerHTML;
      document.body.innerHTML = `
        <html>
          <head>
            <title>Profit & Loss Statement</title>
            <style>
              @media print {
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                  margin: 0;
                  padding: 20px;
                  font-size: 12px;
                  line-height: 1.4;
                  color: #000;
                }
                .print-container {
                  max-width: 100%;
                  margin: 0;
                  background: white;
                  padding: 0;
                  box-shadow: none;
                  border-radius: 0;
                }
                .print-header {
                  text-align: center;
                  margin-bottom: 30px;
                  border-bottom: 2px solid #000;
                  padding-bottom: 20px;
                }
                .print-header h1 {
                  font-size: 20px;
                  margin: 0 0 8px 0;
                  font-weight: bold;
                }
                .print-header h2 {
                  font-size: 16px;
                  margin: 0 0 8px 0;
                  font-weight: 600;
                }
                .print-header p {
                  font-size: 12px;
                  margin: 0;
                  color: #666;
                }
                .print-section {
                  margin-bottom: 25px;
                }
                .print-section h3 {
                  font-size: 14px;
                  font-weight: bold;
                  margin: 0 0 15px 0;
                  padding-bottom: 5px;
                  border-bottom: 1px solid #000;
                  text-transform: uppercase;
                }
                .print-category {
                  margin-bottom: 15px;
                }
                .print-category h4 {
                  font-size: 12px;
                  font-weight: 600;
                  margin: 0 0 8px 0;
                  color: #333;
                }
                .print-table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 10px;
                }
                .print-table td {
                  padding: 2px 0;
                  font-size: 11px;
                  vertical-align: top;
                }
                .print-table td:first-child {
                  width: 80px;
                }
                .print-table td:last-child {
                  text-align: right;
                  width: 100px;
                }
                .print-subtotal {
                  font-weight: 600;
                  border-top: 1px solid #ccc;
                  padding-top: 5px !important;
                }
                .print-total {
                  border-top: 1px solid #000;
                  padding-top: 10px;
                  margin-top: 15px;
                  font-weight: bold;
                  font-size: 14px;
                }
                .print-net-profit {
                  border-top: 2px solid #000;
                  padding-top: 15px;
                  margin-top: 20px;
                  font-weight: bold;
                  font-size: 16px;
                }
                .text-green { color: #059669; }
                .text-red { color: #DC2626; }
                .flex-between {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }
              }
            </style>
          </head>
          <body>
            ${printContents}
          </body>
        </html>
      `;
      
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload(); // Restore the page state
    }
  };

  const handleExport = () => {
    // Create CSV content
    let csv = 'Profit & Loss Statement\n';
    csv += `Period: ${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}\n\n`;
    
    csv += 'INCOME\n';
    csv += 'Date,Description,Category,Amount\n';
    incomeByCategory.forEach(([category, items]) => {
      items.forEach(income => {
        csv += `${income.date},"${income.description}","${category}",${income.base_amount || income.amount}\n`;
      });
    });
    csv += `\nTotal Income,,,${totalIncome}\n\n`;

    csv += 'EXPENSES\n';
    csv += 'Date,Description,Category,Vendor,Amount\n';
    expenseByCategory.forEach(([category, items]) => {
      items.forEach(expense => {
        csv += `${expense.date},"${expense.description}","${category}","${expense.vendor || ''}",${expense.base_amount || expense.amount}\n`;
      });
    });
    csv += `\nTotal Expenses,,,,${totalExpenses}\n`;
    csv += `\nNet Profit,,,,${netProfit}\n`;

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit-loss-${startDate}-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  

  // Group by category
  const incomeByCategory = Array.from(
    incomes.reduce((acc, income) => {
      const category = income.category?.name || 'Uncategorized';
      if (!acc.has(category)) acc.set(category, []);
      acc.get(category)!.push(income);
      return acc;
    }, new Map<string, Income[]>())
  );

  const expenseByCategory = Array.from(
    expenses.reduce((acc, expense) => {
      const category = expense.category?.name || 'Uncategorized';
      if (!acc.has(category)) acc.set(category, []);
      acc.get(category)!.push(expense);
      return acc;
    }, new Map<string, Expense[]>())
  );

  const totalIncome = incomes.reduce((sum, item) => sum + (item.base_amount || item.amount), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + (item.base_amount || item.amount), 0);
  const netProfit = totalIncome - totalExpenses;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="bg-white rounded-2xl p-8 space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
              <div className="space-y-3 mt-8">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Actions Bar - Hidden in Print */}
        <div className="no-print bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-100/50 border border-white/60 p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/reports')}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Reports
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-3">
                Profit & Loss Statement ({baseCurrency})
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
              {/* Date Range Selector */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50">
                <Calendar className="h-4 w-4 text-blue-600" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white/80 backdrop-blur-sm text-sm"
                />
                <span className="text-gray-500 font-medium">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white/80 backdrop-blur-sm text-sm"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm font-medium"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Report Document - Optimized for Print */}
        <div 
          id="profit-loss-report"
          className="print-container bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl shadow-gray-100/50 border border-white/60 p-8 sm:p-12"
        >
          {/* Header */}
          <div className="print-header text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <Building className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {profile?.company_name || 'Your Company'}
              </h1>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-3">
              Profit & Loss Statement
            </h2>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50">
              <Calendar className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-gray-700">
                For the period from <span className="font-semibold text-blue-700">{format(new Date(startDate), 'MMMM dd, yyyy')}</span> to <span className="font-semibold text-blue-700">{format(new Date(endDate), 'MMMM dd, yyyy')}</span>
              </p>
            </div>
          </div>

          {/* Income Section */}
          <div className="print-section mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg shadow-md">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 border-b-2 border-emerald-200 pb-2">INCOME</h3>
            </div>
            
            {incomeByCategory.map(([category, items]) => (
              <div key={category} className="print-category mb-6 p-4 bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl border border-emerald-100">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  {category}
                </h4>
                <table className="print-table w-full">
                  <tbody>
                    {items.map((income) => (
                      <tr key={income.id} className="hover:bg-white/50 transition-colors">
                        <td className="py-2 text-gray-600 font-medium">{format(new Date(income.date), 'MMM dd')}</td>
                        <td className="py-2 text-gray-700">{income.description}</td>
                        <td className="py-2 text-right font-semibold text-gray-900">
                        {formatCurrency(income.base_amount || income.amount, baseCurrency)}
                      </td>
                      </tr>
                    ))}
                    <tr className="print-subtotal border-t border-emerald-200">
                      <td colSpan={2} className="pt-3 font-semibold text-gray-800">Subtotal {category}</td>
                      <td className="pt-3 text-right font-bold text-emerald-700">
                        {formatCurrency(items.reduce((sum, item) => sum + (item.base_amount || item.amount), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
            
            <div className="print-total bg-gradient-to-r from-emerald-100 to-green-100 p-4 rounded-xl border border-emerald-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total Income</span>
                <span className="text-xl font-bold text-emerald-700">{formatCurrency(totalIncome)}</span>
              </div>
            </div>
          </div>

          {/* Expenses Section */}
          <div className="print-section mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg shadow-md">
                <TrendingDown className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 border-b-2 border-red-200 pb-2">EXPENSES</h3>
            </div>
            
            {expenseByCategory.map(([category, items]) => (
              <div key={category} className="print-category mb-6 p-4 bg-gradient-to-r from-red-50/50 to-pink-50/50 rounded-xl border border-red-100">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  {category}
                </h4>
                <table className="print-table w-full">
                  <tbody>
                    {items.map((expense) => (
                      <tr key={expense.id} className="hover:bg-white/50 transition-colors">
                        <td className="py-2 text-gray-600 font-medium">{format(new Date(expense.date), 'MMM dd')}</td>
                        <td className="py-2 text-gray-700">{expense.description}</td>
                        <td className="py-2 text-right font-semibold text-gray-900">{formatCurrency(expense.base_amount || expense.amount, baseCurrency)}</td>
                      </tr>
                    ))}
                    <tr className="print-subtotal border-t border-red-200">
                      <td colSpan={2} className="pt-3 font-semibold text-gray-800">Subtotal {category}</td>
                      <td className="pt-3 text-right font-bold text-red-700">
                        {formatCurrency(items.reduce((sum, item) => sum + (item.base_amount || item.amount), 0), baseCurrency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
            
            <div className="print-total bg-gradient-to-r from-red-100 to-pink-100 p-4 rounded-xl border border-red-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total Expenses</span>
                <span className="text-xl font-bold text-red-700">{formatCurrency(totalExpenses)}</span>
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className="print-net-profit bg-gradient-to-r from-gray-100 to-slate-100 p-6 rounded-xl border-2 border-gray-300">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-gray-900">NET PROFIT</span>
              <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {netProfit >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netProfit))}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Profit Margin: <span className="font-semibold">{totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0.0'}%</span>
            </div>
          </div>

          {/* Report Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>Generated on {format(new Date(), 'MMMM dd, yyyy')} at {format(new Date(), 'h:mm a')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};