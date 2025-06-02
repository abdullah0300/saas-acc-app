import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Calendar, Printer } from 'lucide-react';
import { getIncomes, getExpenses, getProfile } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Income, Expense, User } from '../../types';

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
    window.print();
  };

  const handleExport = () => {
    // Create CSV content
    let csv = 'Profit & Loss Statement\n';
    csv += `Period: ${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}\n\n`;
    
    csv += 'INCOME\n';
    csv += 'Date,Description,Category,Amount\n';
    incomeByCategory.forEach(([category, items]) => {
      items.forEach(income => {
        csv += `${income.date},"${income.description}","${category}",${income.amount}\n`;
      });
    });
    csv += `\nTotal Income,,,$${totalIncome.toFixed(2)}\n\n`;

    csv += 'EXPENSES\n';
    csv += 'Date,Description,Category,Vendor,Amount\n';
    expenseByCategory.forEach(([category, items]) => {
      items.forEach(expense => {
        csv += `${expense.date},"${expense.description}","${category}","${expense.vendor || ''}",${expense.amount}\n`;
      });
    });
    csv += `\nTotal Expenses,,,,$${totalExpenses.toFixed(2)}\n`;
    csv += `\nNet Profit,,,,$${netProfit.toFixed(2)}\n`;

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

  const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Actions Bar */}
      <div className="mb-6 flex items-center justify-between no-print">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Reports
        </button>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Report Document */}
      <div className="bg-white rounded-lg shadow p-8 print:shadow-none">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {profile?.company_name || 'Your Company'}
          </h1>
          <h2 className="text-xl font-semibold text-gray-700 mt-2">
            Profit & Loss Statement
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            For the period from {format(new Date(startDate), 'MMMM dd, yyyy')} to {format(new Date(endDate), 'MMMM dd, yyyy')}
          </p>
        </div>

        {/* Income Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">INCOME</h3>
          {incomeByCategory.map(([category, items]) => (
            <div key={category} className="mb-4">
              <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((income) => (
                    <tr key={income.id}>
                      <td className="py-1 text-gray-600">{format(new Date(income.date), 'MMM dd')}</td>
                      <td className="py-1 text-gray-600">{income.description}</td>
                      <td className="py-1 text-right text-gray-900">${income.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td colSpan={2} className="pt-2 text-gray-700">Subtotal {category}</td>
                    <td className="pt-2 text-right text-gray-900">
                      ${items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between font-semibold text-lg">
              <span>Total Income</span>
              <span className="text-green-600">${totalIncome.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Expenses Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">EXPENSES</h3>
          {expenseByCategory.map(([category, items]) => (
            <div key={category} className="mb-4">
              <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((expense) => (
                    <tr key={expense.id}>
                      <td className="py-1 text-gray-600">{format(new Date(expense.date), 'MMM dd')}</td>
                      <td className="py-1 text-gray-600">{expense.description}</td>
                      <td className="py-1 text-right text-gray-900">${expense.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td colSpan={2} className="pt-2 text-gray-700">Subtotal {category}</td>
                    <td className="pt-2 text-right text-gray-900">
                      ${items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between font-semibold text-lg">
              <span>Total Expenses</span>
              <span className="text-red-600">${totalExpenses.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="pt-6 border-t-2 border-gray-300">
          <div className="flex justify-between text-xl font-bold">
            <span>NET PROFIT</span>
            <span className={netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
              ${netProfit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};