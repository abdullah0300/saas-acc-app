import React, { useState, useCallback } from 'react';
import { Upload, Download, FileText, AlertCircle, Check, X, Users, DollarSign, Receipt, FileSpreadsheet, Brain, Sparkles, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';

interface ImportAnalysis {
  businessType: string;
  dataType: 'income' | 'expenses' | 'mixed' | 'clients' | 'vendors';
  confidence: number;
  columnMapping: Record<string, string>;
  suggestedCategories: Array<{name: string, type: 'income' | 'expense'}>;
  suggestedClients: Array<{name: string, email?: string}>;
  suggestedVendors: Array<{name: string, email?: string}>;
  dataIssues: string[];
  cleaningSteps: string[];
  previewData: any[];
}

interface AIImportWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AIImportWizard: React.FC<AIImportWizardProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'importing' | 'success'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [error, setError] = useState<string>('');

  // Handle file upload
  const handleFiles = useCallback((files: FileList) => {
    const file = files[0];
    if (!file) return;

    // Check file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      setError('Please upload a CSV or Excel file');
      return;
    }

    setFile(file);
    setError('');
    analyzeFile(file);
  }, []);

  // Analyze file with AI
  const analyzeFile = async (file: File) => {
    if (!user) return;

    setStep('analyzing');
    setError('');

    try {
      // Read file content
      const text = await file.text();
      
      console.log('Sending file for analysis:', file.name);

      // Call AI analysis edge function
      const { data, error: functionError } = await supabase.functions.invoke('ai-import-analyzer', {
        body: {
          csvData: text,
          userId: user.id,
          fileName: file.name
        }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Analysis failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysis(data.analysis);
      setStep('review');

    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze file');
      setStep('upload');
    }
  };

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // Proceed with import
  const handleProceedImport = async () => {
    if (!analysis || !file || !user) return;

    setStep('importing');
    
    try {
      // Prepare import data based on analysis
      const importData = {
        userId: user.id,
        records: analysis.previewData || [],
        categories: analysis.suggestedCategories || [],
        clients: analysis.suggestedClients || [],
        vendors: analysis.suggestedVendors || []
      };

      console.log('Starting import with data:', {
        userId: importData.userId,
        recordsCount: importData.records.length,
        categoriesCount: importData.categories.length,
        clientsCount: importData.clients.length,
        vendorsCount: importData.vendors.length
      });

      console.log('Sample records:', importData.records.slice(0, 3));

      // Validate we have data to import
      if (!importData.records || importData.records.length === 0) {
        throw new Error('No records to import. Please try uploading the file again.');
      }

      // Call the import execution edge function
      const { data, error: importError } = await supabase.functions.invoke('execute-ai-import', {
        body: importData
      });

      console.log('Import response:', { data, importError });

      if (importError) {
        console.error('Import function error:', importError);
        throw new Error(importError.message || 'Import failed');
      }

      if (!data || !data.success) {
        console.error('Import unsuccessful:', data);
        throw new Error(data?.error || 'Import failed');
      }

      console.log('Import completed successfully:', data.results);
      
      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Import failed');
      setStep('review');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AI Data Import</h2>
              <p className="text-sm text-gray-500">Let AI organize your financial data automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* File Upload Area */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-blue-600" />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Drop your Excel or CSV file here
                    </h3>
                    <p className="text-gray-500 mt-1">
                      Or click to browse your files
                    </p>
                  </div>

                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                  >
                    Choose File
                  </label>
                </div>
              </div>

              {/* What AI Can Handle */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  What our AI can handle
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-green-800">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Create complete invoice records
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Extract client information
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Handle mixed date formats
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Calculate taxes and totals
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Auto-create categories
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Link expenses to invoices
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Upload Error</h4>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Analyzing Step */}
          {step === 'analyzing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="w-8 h-8 text-blue-600 animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                AI is analyzing your data...
              </h3>
              <p className="text-gray-500 mb-6">
                Understanding your business and organizing your invoices
              </p>
              <div className="w-64 bg-gray-200 rounded-full h-2 mx-auto">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && analysis && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  AI Analysis Complete!
                </h3>
                <p className="text-blue-800">
                  <strong>Business Type:</strong> {analysis.businessType}
                </p>
                <p className="text-blue-800">
                  <strong>Data Type:</strong> {analysis.dataType} 
                  <span className="text-sm">({Math.round(analysis.confidence * 100)}% confidence)</span>
                </p>
                <p className="text-blue-800">
                  <strong>Records to Import:</strong> {analysis.previewData?.length || 0} records
                </p>
              </div>

              {/* Suggested Categories */}
              {analysis.suggestedCategories.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Categories to Create</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {analysis.suggestedCategories.map((cat, index) => (
                      <div key={`${cat.type}-${cat.name}-${index}`} className="flex items-center gap-2 text-sm">
                        <div className={`w-3 h-3 rounded-full ${cat.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        {cat.name} ({cat.type})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Issues */}
              {analysis.dataIssues.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Issues Found (AI will fix these)</h4>
                  <div className="space-y-1">
                    {analysis.dataIssues.map((issue, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-orange-700">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        {issue}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep('upload')}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Try Different File
                </button>
                <button
                  onClick={handleProceedImport}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  Import {analysis.previewData?.length || 0} Records
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Download className="w-8 h-8 text-green-600 animate-bounce" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Importing your data...
              </h3>
              <p className="text-gray-500 mb-6">
                Creating invoices, organizing transactions, and setting up your books
              </p>
              <div className="w-64 bg-gray-200 rounded-full h-2 mx-auto">
                <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: '80%' }}></div>
              </div>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Import Complete!
              </h3>
              <p className="text-gray-500 mb-6">
                Your invoices and business data have been successfully imported
              </p>
              
              {/* Import Summary & Undo Option */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-medium text-gray-900 mb-2">Import Summary</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• {analysis?.previewData?.filter(r => r.type === 'invoice').length || 0} invoices created</p>
                  <p>• {analysis?.previewData?.filter(r => r.type === 'expense').length || 0} expense records created</p>
                  <p>• {analysis?.suggestedClients?.length || 0} clients added</p>
                  <p>• {analysis?.suggestedCategories?.length || 0} categories created</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="text-left">
                    <h4 className="font-medium text-amber-900">Need to undo this import?</h4>
                    <p className="text-amber-700 text-sm mt-1">
                      If something doesn't look right, you can undo this import within 48 hours from your settings.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  View My Data
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};