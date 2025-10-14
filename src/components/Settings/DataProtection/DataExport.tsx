// src/components/Settings/DataProtection/DataExport.tsx
// 🔴 GDPR Article 15 & 20: Right to Access and Data Portability

import React, { useState } from "react";
import { AlertCircle, CheckCircle, Download, FileText, Info, Loader } from "lucide-react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../contexts/AuthContext";
import { format } from "date-fns";

type ExportFormat = 'json' | 'csv';

interface ExportRequest {
  id: string;
  format: ExportFormat;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requested_at: string;
  file_url?: string;
}

export const DataExport: React.FC = () => {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [exportStatus, setExportStatus] = useState<string>('');
  const [recentExports, setRecentExports] = useState<ExportRequest[]>([]);

  const handleExportData = async () => {
    if (!user?.id) return;

    setExporting(true);
    setExportStatus('Preparing your data export...');

    try {
      // Step 1: Fetch all user data
      setExportStatus('Fetching your personal information...');
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setExportStatus('Fetching income records...');
      const { data: income } = await supabase
        .from('income')
        .select('*, client:clients(*), category:categories(*)')
        .eq('user_id', user.id);

      setExportStatus('Fetching expense records...');
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*, vendor_detail:vendors(*), category:categories(*)')
        .eq('user_id', user.id);

      setExportStatus('Fetching invoices...');
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*, client:clients(*), items:invoice_items(*)')
        .eq('user_id', user.id);

      setExportStatus('Fetching clients...');
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id);

      setExportStatus('Fetching vendors...');
      const { data: vendors } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id);

      setExportStatus('Fetching categories...');
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);

      setExportStatus('Fetching audit logs...');
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000); // Last 1000 audit logs

      setExportStatus('Fetching complaints...');
      const { data: complaints } = await supabase
        .from('data_protection_complaints')
        .select('*')
        .eq('user_id', user.id);

      setExportStatus('Fetching consent records...');
      const { data: consents } = await supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', user.id);

      // Step 2: Build export data structure
      const exportData = {
        export_metadata: {
          generated_at: new Date().toISOString(),
          user_id: user.id,
          email: user.email,
          format: exportFormat,
          gdpr_compliance: {
            article_15: 'Right to Access',
            article_20: 'Data Portability',
          },
        },
        personal_information: {
          profile: profile || {},
          email: user.email,
          user_id: user.id,
        },
        financial_data: {
          income: income || [],
          expenses: expenses || [],
          invoices: invoices || [],
          summary: {
            total_income_records: income?.length || 0,
            total_expense_records: expenses?.length || 0,
            total_invoices: invoices?.length || 0,
          },
        },
        business_contacts: {
          clients: clients || [],
          vendors: vendors || [],
          summary: {
            total_clients: clients?.length || 0,
            total_vendors: vendors?.length || 0,
          },
        },
        settings: {
          categories: categories || [],
        },
        compliance_data: {
          audit_logs: auditLogs || [],
          complaints: complaints || [],
          consents: consents || [],
          summary: {
            total_audit_logs: auditLogs?.length || 0,
            total_complaints: complaints?.length || 0,
            total_consents: consents?.length || 0,
          },
        },
      };

      // Step 3: Generate file
      setExportStatus('Generating export file...');

      if (exportFormat === 'json') {
        // JSON export
        const jsonBlob = new Blob(
          [JSON.stringify(exportData, null, 2)],
          { type: 'application/json' }
        );
        const url = URL.createObjectURL(jsonBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `smartcfo-data-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV export (flattened data)
        await generateCSVExport(exportData);
      }

      // Step 4: Log the export in audit trail
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'export',
        entity_type: 'user_data',
        entity_name: 'GDPR Data Export',
        metadata: {
          format: exportFormat,
          exported_at: new Date().toISOString(),
          record_counts: {
            income: income?.length || 0,
            expenses: expenses?.length || 0,
            invoices: invoices?.length || 0,
            clients: clients?.length || 0,
            vendors: vendors?.length || 0,
            audit_logs: auditLogs?.length || 0,
          },
        },
      });

      // Step 5: Log to data_export_requests table
      await supabase.from('data_export_requests').insert({
        user_id: user.id,
        format: exportFormat,
        status: 'completed',
        requested_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

      setExportStatus('Export completed successfully!');
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error: any) {
      console.error('Export error:', error);
      setExportStatus('');
      alert('Error exporting data: ' + error.message);

      // Log failed export
      await supabase.from('data_export_requests').insert({
        user_id: user?.id,
        format: exportFormat,
        status: 'failed',
        requested_at: new Date().toISOString(),
        error_message: error.message,
      });
    } finally {
      setExporting(false);
    }
  };

  const generateCSVExport = async (data: any) => {
    const csvFiles: { [key: string]: string } = {};

    // Generate CSV for income
    if (data.financial_data.income.length > 0) {
      const incomeHeaders = ['Date', 'Description', 'Amount', 'Currency', 'Category', 'Client', 'Reference', 'Tax Amount', 'Created At'];
      const incomeRows = data.financial_data.income.map((record: any) => [
        record.date,
        record.description,
        record.amount,
        record.currency || '',
        record.category?.name || '',
        record.client?.name || '',
        record.reference_number || '',
        record.tax_amount || 0,
        record.created_at,
      ]);
      csvFiles['income'] = [incomeHeaders, ...incomeRows].map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');
    }

    // Generate CSV for expenses
    if (data.financial_data.expenses.length > 0) {
      const expenseHeaders = ['Date', 'Description', 'Amount', 'Currency', 'Category', 'Vendor', 'Reference', 'Tax Amount', 'Receipt URL', 'Created At'];
      const expenseRows = data.financial_data.expenses.map((record: any) => [
        record.date,
        record.description,
        record.amount,
        record.currency || '',
        record.category?.name || '',
        record.vendor || '',
        record.reference_number || '',
        record.tax_amount || 0,
        record.receipt_url || '',
        record.created_at,
      ]);
      csvFiles['expenses'] = [expenseHeaders, ...expenseRows].map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');
    }

    // Generate CSV for clients
    if (data.business_contacts.clients.length > 0) {
      const clientHeaders = ['Name', 'Email', 'Phone', 'Company', 'Address', 'City', 'Country', 'Created At'];
      const clientRows = data.business_contacts.clients.map((record: any) => [
        record.name,
        record.email || '',
        record.phone || '',
        record.company_name || '',
        record.address || '',
        record.city || '',
        record.country || '',
        record.created_at,
      ]);
      csvFiles['clients'] = [clientHeaders, ...clientRows].map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');
    }

    // Generate CSV for vendors
    if (data.business_contacts.vendors.length > 0) {
      const vendorHeaders = ['Name', 'Email', 'Phone', 'Company', 'Address', 'Created At'];
      const vendorRows = data.business_contacts.vendors.map((record: any) => [
        record.name,
        record.email || '',
        record.phone || '',
        record.company || '',
        record.address || '',
        record.created_at,
      ]);
      csvFiles['vendors'] = [vendorHeaders, ...vendorRows].map(row => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');
    }

    // Download each CSV file
    Object.entries(csvFiles).forEach(([filename, content]) => {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smartcfo-${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h2 className="text-xl font-semibold text-gray-900">Export Your Data</h2>
        <p className="mt-2 text-sm text-gray-600">
          Download all your personal data in a portable format as required by GDPR Articles 15 & 20.
        </p>
      </div>

      {/* GDPR Info */}
      <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
        <div className="flex">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Your GDPR Rights</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p className="mb-2">
                <strong>Article 15 - Right to Access:</strong> You have the right to obtain a copy of all personal data we hold about you.
              </p>
              <p>
                <strong>Article 20 - Data Portability:</strong> You can receive your data in a structured, machine-readable format to transfer it to another service.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Export Options</h3>

        {/* Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Export Format
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setExportFormat('json')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                exportFormat === 'json'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-2">
                <FileText className="h-5 w-5 text-blue-600 mr-2" />
                <span className="font-semibold text-gray-900">JSON (Recommended)</span>
              </div>
              <p className="text-sm text-gray-600">
                Complete data export including all relationships. Best for technical users and data migration.
              </p>
            </button>

            <button
              onClick={() => setExportFormat('csv')}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                exportFormat === 'csv'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-2">
                <FileText className="h-5 w-5 text-green-600 mr-2" />
                <span className="font-semibold text-gray-900">CSV (Multiple Files)</span>
              </div>
              <p className="text-sm text-gray-600">
                Separate CSV files for each data type. Easy to open in Excel or Google Sheets.
              </p>
            </button>
          </div>
        </div>

        {/* What's Included */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">What's Included in Your Export:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span>Personal profile information</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span>All income records</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span>All expense records</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span>All invoices and items</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span>Client information</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span>Vendor information</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span>Categories and settings</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span>Audit logs (last 1000)</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span>Complaint records</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
              <span>Consent history</span>
            </div>
          </div>
        </div>

        {/* Export Status */}
        {exportStatus && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              {exporting ? (
                <Loader className="h-5 w-5 text-blue-600 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              )}
              <span className="text-sm font-medium text-blue-900">{exportStatus}</span>
            </div>
          </div>
        )}

        {/* Export Button */}
        <button
          onClick={handleExportData}
          disabled={exporting}
          className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? (
            <>
              <Loader className="h-5 w-5 mr-2 animate-spin" />
              Exporting Data...
            </>
          ) : (
            <>
              <Download className="h-5 w-5 mr-2" />
              Export My Data ({exportFormat.toUpperCase()})
            </>
          )}
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-200">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Privacy Notice</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                The exported file will contain all your personal and financial data. Please store it securely
                and do not share it with unauthorized parties. The export action will be logged in your audit trail.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
