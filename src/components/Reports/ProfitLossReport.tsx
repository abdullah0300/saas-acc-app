// src/components/Reports/ProfitLossReport.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Calendar, Printer, Building, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';
import { getIncomes, getExpenses, getProfile, getCreditNotes } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Income, Expense, User, CreditNote } from '../../types';
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
 const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
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
     const [profileData, incomeData, expenseData, creditNoteData] = await Promise.all([
       getProfile(user.id),
       getIncomes(user.id, startDate, endDate),
       getExpenses(user.id, startDate, endDate),
       getCreditNotes(user.id, startDate, endDate)
     ]);

     setProfile(profileData);
     setIncomes(incomeData);
     setExpenses(expenseData);
     // Only include applied credit notes
     setCreditNotes(creditNoteData.filter(cn => cn.applied_to_income));
   } catch (err: any) {
     console.error('Error loading report data:', err);
   } finally {
     setLoading(false);
   }
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

 // Group credit notes by client
 const creditNotesByClient = Array.from(
   creditNotes.reduce((acc, cn) => {
     const clientName = cn.client?.name || 'Direct';
     if (!acc.has(clientName)) acc.set(clientName, []);
     acc.get(clientName)!.push(cn);
     return acc;
   }, new Map<string, CreditNote[]>())
 );

 // Calculate totals
 const totalGrossIncome = incomes.reduce((sum, item) => {
   // Skip negative entries from credit notes
   if (item.credit_note_id) return sum;
   return sum + (item.base_amount || item.amount);
 }, 0);
 
 const totalCreditNotes = creditNotes.reduce((sum, cn) => 
   sum + (cn.base_amount || cn.total), 0
 );
 
 const totalNetIncome = totalGrossIncome - totalCreditNotes;
 const totalExpenses = expenses.reduce((sum, item) => sum + (item.base_amount || item.amount), 0);
 const netProfit = totalNetIncome - totalExpenses;

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
       if (!income.credit_note_id) {
         csv += `${income.date},"${income.description}","${category}",${income.base_amount || income.amount}\n`;
       }
     });
   });
   csv += `\nGross Income,,,${totalGrossIncome}\n\n`;

   csv += 'CREDIT NOTES (DEDUCTIONS)\n';
   csv += 'Date,Number,Client,Reason,Amount\n';
   creditNotesByClient.forEach(([client, notes]) => {
     notes.forEach(cn => {
       csv += `${cn.date},"${cn.credit_note_number}","${client}","${cn.reason}",${cn.base_amount || cn.total}\n`;
     });
   });
   csv += `\nTotal Credit Notes,,,${totalCreditNotes}\n`;
   csv += `\nNet Income,,,${totalNetIncome}\n\n`;

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
       {/* Actions Bar */}
       <div className="no-print bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-100/50 border border-white/60 p-6">
         <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
           <div className="flex items-center gap-4">
             <button
               onClick={() => navigate('/reports')}
               className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
             >
               <ArrowLeft className="h-5 w-5 mr-1" />
               Back to Reports
             </button>
           </div>
           
           <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
               <label className="text-sm text-gray-600">From:</label>
               <input
                 type="date"
                 value={startDate}
                 onChange={(e) => setStartDate(e.target.value)}
                 className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
               />
             </div>
             
             <div className="flex items-center gap-2">
               <label className="text-sm text-gray-600">To:</label>
               <input
                 type="date"
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
                 className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
               />
             </div>
             
             <button
               onClick={handlePrint}
               className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
             >
               <Printer className="h-5 w-5" />
             </button>
             
             <button
               onClick={handleExport}
               className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
             >
               <Download className="h-4 w-4 mr-2" />
               Export CSV
             </button>
           </div>
         </div>
       </div>

       {/* Report Document */}
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
             <div key={category} className="print-category mb-6 p-4 bg-gradient-to-r from-emerald-50/50 to-green-50/30 rounded-lg">
               <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">{category}</h4>
               <div className="space-y-2">
                 {items.filter(income => !income.credit_note_id).map((income, index) => (
                   <div key={index} className="flex justify-between items-start text-sm">
                     <div className="flex-1">
                       <span className="text-gray-700">{income.description}</span>
                       <span className="text-gray-500 ml-2 text-xs">({format(new Date(income.date), 'MMM dd')})</span>
                     </div>
                     <span className="font-mono font-medium text-gray-900 ml-4">
                       {formatCurrency(income.base_amount || income.amount, baseCurrency)}
                     </span>
                   </div>
                 ))}
               </div>
               <div className="mt-3 pt-3 border-t border-emerald-200/50 flex justify-between">
                 <span className="font-medium text-gray-700">Subtotal:</span>
                 <span className="font-mono font-semibold text-gray-900">
                   {formatCurrency(
                     items.filter(i => !i.credit_note_id).reduce((sum, item) => sum + (item.base_amount || item.amount), 0),
                     baseCurrency
                   )}
                 </span>
               </div>
             </div>
           ))}
           
           <div className="print-total mt-6 p-4 bg-gradient-to-r from-emerald-100 to-green-100 rounded-lg flex justify-between items-center">
             <span className="text-lg font-bold text-gray-900">GROSS INCOME:</span>
             <span className="text-xl font-mono font-bold text-emerald-700">
               {formatCurrency(totalGrossIncome, baseCurrency)}
             </span>
           </div>
         </div>

         {/* Credit Notes Section (if any) */}
         {creditNotes.length > 0 && (
           <div className="print-section mb-10">
             <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg shadow-md">
                 <CreditCard className="h-5 w-5 text-white" />
               </div>
               <h3 className="text-xl font-bold text-gray-900 border-b-2 border-orange-200 pb-2">CREDIT NOTES (DEDUCTIONS)</h3>
             </div>
             
             {creditNotesByClient.map(([client, notes]) => (
               <div key={client} className="print-category mb-6 p-4 bg-gradient-to-r from-orange-50/50 to-red-50/30 rounded-lg">
                 <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">{client}</h4>
                 <div className="space-y-2">
                   {notes.map((cn, index) => (
                     <div key={index} className="flex justify-between items-start text-sm">
                       <div className="flex-1">
                         <span className="text-gray-700">
                           CN #{cn.credit_note_number} - {cn.reason}
                           {cn.reason_description && ` (${cn.reason_description})`}
                         </span>
                         <span className="text-gray-500 ml-2 text-xs">({format(new Date(cn.date), 'MMM dd')})</span>
                       </div>
                       <span className="font-mono font-medium text-red-600 ml-4">
                         -{formatCurrency(cn.base_amount || cn.total, baseCurrency)}
                       </span>
                     </div>
                   ))}
                 </div>
               </div>
             ))}
             
             <div className="print-total mt-6 p-4 bg-gradient-to-r from-orange-100 to-red-100 rounded-lg flex justify-between items-center">
               <span className="text-lg font-bold text-gray-900">TOTAL CREDIT NOTES:</span>
               <span className="text-xl font-mono font-bold text-red-600">
                 -{formatCurrency(totalCreditNotes, baseCurrency)}
               </span>
             </div>
             
             <div className="print-total mt-4 p-4 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg flex justify-between items-center">
               <span className="text-lg font-bold text-gray-900">NET INCOME:</span>
               <span className="text-xl font-mono font-bold text-blue-700">
                 {formatCurrency(totalNetIncome, baseCurrency)}
               </span>
             </div>
           </div>
         )}

         {/* Expense Section */}
         <div className="print-section mb-10">
           <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg shadow-md">
               <TrendingDown className="h-5 w-5 text-white" />
             </div>
             <h3 className="text-xl font-bold text-gray-900 border-b-2 border-red-200 pb-2">EXPENSES</h3>
           </div>
           
           {expenseByCategory.map(([category, items]) => (
             <div key={category} className="print-category mb-6 p-4 bg-gradient-to-r from-red-50/50 to-pink-50/30 rounded-lg">
               <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">{category}</h4>
               <div className="space-y-2">
                 {items.map((expense, index) => (
                   <div key={index} className="flex justify-between items-start text-sm">
                     <div className="flex-1">
                       <span className="text-gray-700">{expense.description}</span>
                       <span className="text-gray-500 ml-2 text-xs">({format(new Date(expense.date), 'MMM dd')})</span>
                       {expense.vendor && (
                         <span className="text-gray-500 ml-2 text-xs">• {expense.vendor}</span>
                       )}
                     </div>
                     <span className="font-mono font-medium text-gray-900 ml-4">
                       {formatCurrency(expense.base_amount || expense.amount, baseCurrency)}
                     </span>
                   </div>
                 ))}
               </div>
               <div className="mt-3 pt-3 border-t border-red-200/50 flex justify-between">
                 <span className="font-medium text-gray-700">Subtotal:</span>
                 <span className="font-mono font-semibold text-gray-900">
                   {formatCurrency(
                     items.reduce((sum, item) => sum + (item.base_amount || item.amount), 0),
                     baseCurrency
                   )}
                 </span>
               </div>
             </div>
           ))}
           
           <div className="print-total mt-6 p-4 bg-gradient-to-r from-red-100 to-pink-100 rounded-lg flex justify-between items-center">
             <span className="text-lg font-bold text-gray-900">TOTAL EXPENSES:</span>
             <span className="text-xl font-mono font-bold text-red-700">
               {formatCurrency(totalExpenses, baseCurrency)}
             </span>
           </div>
         </div>

         {/* Net Profit/Loss */}
         <div className="print-net-profit mt-8 p-6 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl shadow-xl">
           <div className="flex justify-between items-center">
             <span className="text-xl font-bold text-white">NET {netProfit >= 0 ? 'PROFIT' : 'LOSS'}:</span>
             <span className={`text-3xl font-mono font-bold ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
               {formatCurrency(Math.abs(netProfit), baseCurrency)}
             </span>
           </div>
           <div className="mt-4 pt-4 border-t border-gray-700">
             <div className="grid grid-cols-3 gap-4 text-center">
               <div>
                 <p className="text-gray-400 text-xs uppercase">Gross Margin</p>
                 <p className="text-white font-bold mt-1">
                   {totalGrossIncome > 0 ? ((totalNetIncome / totalGrossIncome) * 100).toFixed(1) : 0}%
                 </p>
               </div>
               <div>
                 <p className="text-gray-400 text-xs uppercase">Expense Ratio</p>
                 <p className="text-white font-bold mt-1">
                   {totalNetIncome > 0 ? ((totalExpenses / totalNetIncome) * 100).toFixed(1) : 0}%
                 </p>
               </div>
               <div>
                 <p className="text-gray-400 text-xs uppercase">Net Margin</p>
                 <p className="text-white font-bold mt-1">
                   {totalNetIncome > 0 ? ((netProfit / totalNetIncome) * 100).toFixed(1) : 0}%
                 </p>
               </div>
             </div>
           </div>
         </div>
       </div>
     </div>
   </div>
 );
};