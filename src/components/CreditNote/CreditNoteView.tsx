// src/components/CreditNote/CreditNoteView.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../services/supabaseClient';
import { 
  ArrowLeft, 
  Download, 
  Mail, 
  Edit, 
  FileText,
  AlertCircle,
  CheckCircle,
  Calendar,
  User,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { pdfService } from '../../services/pdfService';
import { getCreditNote, applyCreditNote } from '../../services/database';
import { CreditNote } from '../../types';
import { format } from 'date-fns';

export const CreditNoteView: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { baseCurrency } = useSettings();
  const navigate = useNavigate();
  const [creditNote, setCreditNote] = useState<CreditNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
const [generatingPdf, setGeneratingPdf] = useState(false);
const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (id && user) {
      loadCreditNote();
    }
  }, [id, user]);

  const loadCreditNote = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await getCreditNote(id);
      setCreditNote(data);
    } catch (error) {
      console.error('Error loading credit note:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
  if (!creditNote || !user) return;
  
  const recipientEmail = prompt('Enter recipient email address:', creditNote.client?.email || '');
  if (!recipientEmail) return;
  
  const ccEmails = prompt('Enter CC email addresses (comma-separated, optional):');
  const message = prompt('Add a custom message (optional):');
  
  setSendingEmail(true);
  try {
    const { data, error } = await supabase.functions.invoke('send-credit-note-email', {
      body: {
        creditNoteId: creditNote.id,
        recipientEmail,
        ccEmails: ccEmails ? ccEmails.split(',').map(e => e.trim()) : [],
        message
      }
    });
    
    if (error) throw error;
    
    alert('Credit note email sent successfully!');
  } catch (error: any) {
    alert(error.message || 'Error sending email');
  } finally {
    setSendingEmail(false);
  }
};








  

  const handleApplyToIncome = async () => {
    if (!creditNote || !user) return;
    
    if (creditNote.applied_to_income) {
      alert('This credit note has already been applied');
      return;
    }

    if (!window.confirm('Apply this credit note to income? This will create a negative income entry and cannot be undone.')) {
      return;
    }

    setApplying(true);
    try {
      await applyCreditNote(creditNote.id, user.id, 'refund');
      await loadCreditNote();
      alert('Credit note applied to income successfully');
    } catch (error: any) {
      alert(error.message || 'Error applying credit note');
    } finally {
      setApplying(false);
    }
  };

  const handleDownloadPDF = async () => {
  if (!creditNote) return;
  
  setGeneratingPdf(true);
  try {
    const blob = await pdfService.generateCreditNotePDF(creditNote.id);
    pdfService.downloadBlob(blob, `credit-note-${creditNote.credit_note_number}.pdf`);
  } catch (error) {
    alert('Error generating PDF');
  } finally {
    setGeneratingPdf(false);
  }
};

  const getStatusBadge = (status: string, appliedToIncome: boolean) => {
    const baseClasses = "px-3 py-1 text-sm font-semibold rounded-full";
    
    if (appliedToIncome) {
      return (
        <span className={`${baseClasses} bg-green-100 text-green-800 flex items-center gap-1`}>
          <CheckCircle className="h-4 w-4" />
          Applied
        </span>
      );
    }
    
    switch (status) {
      case 'draft':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Draft</span>;
      case 'issued':
        return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>Issued</span>;
      case 'applied':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Applied</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'return':
        return 'Product Return';
      case 'adjustment':
        return 'Price Adjustment';
      case 'cancellation':
        return 'Order Cancellation';
      case 'other':
        return 'Other';
      default:
        return reason;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          Credit note not found
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <button
          onClick={() => navigate('/credit-notes')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Credit Notes
        </button>
        
        <div className="flex gap-2">
          {creditNote.status === 'draft' && (
            <Link
              to={`/credit-notes/edit/${creditNote.id}`}
              className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Edit className="h-5 w-5 mr-2" />
              Edit
            </Link>
          )}
          
          {creditNote.status === 'issued' && !creditNote.applied_to_income && (
            <button
              onClick={handleApplyToIncome}
              disabled={applying}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              {applying ? 'Applying...' : 'Apply to Income'}
            </button>
          )}
          
          <button
          onClick={handleDownloadPDF}
          disabled={generatingPdf}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {generatingPdf ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-5 w-5 mr-2" />
              Download PDF
            </>
          )}
        </button>
          
          <button
          onClick={handleSendEmail}
          disabled={sendingEmail}
          className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {sendingEmail ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 mr-2" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="h-5 w-5 mr-2" />
              Send Email
            </>
          )}
        </button>
        </div>
      </div>

      {/* Credit Note Document */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header Section */}
        <div className="bg-red-600 text-white p-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">CREDIT NOTE</h1>
              <p className="text-2xl">{creditNote.credit_note_number}</p>
            </div>
            <div className="text-right">
              {getStatusBadge(creditNote.status, creditNote.applied_to_income)}
            </div>
          </div>
        </div>

        {/* Related Invoice Alert */}
        {creditNote.invoice && (
          <div className="bg-blue-50 border-b border-blue-200 p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Credit Note for Invoice{' '}
                  <Link
                    to={`/invoices/${creditNote.invoice_id}`}
                    className="underline hover:text-blue-700"
                  >
                    #{creditNote.invoice.invoice_number}
                  </Link>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Original Invoice Amount: {creditNote.currency || baseCurrency} {creditNote.invoice.total?.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Details Section */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Client Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center">
                <User className="h-4 w-4 mr-2" />
                Credit To
              </h3>
              {creditNote.client ? (
                <div className="text-gray-900">
                  <p className="font-semibold">{creditNote.client.name}</p>
                  {creditNote.client.email && <p>{creditNote.client.email}</p>}
                  {creditNote.client.phone && <p>{creditNote.client.phone}</p>}
                  {creditNote.client.address && (
                    <p className="whitespace-pre-line">{creditNote.client.address}</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No client information</p>
              )}
            </div>

            {/* Credit Note Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Credit Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{format(new Date(creditNote.date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reason:</span>
                  <span className="font-medium">{getReasonLabel(creditNote.reason)}</span>
                </div>
                {creditNote.reason_description && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Description:</span>
                    <span className="font-medium">{creditNote.reason_description}</span>
                  </div>
                )}
                {creditNote.currency && creditNote.currency !== 'USD' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Currency:</span>
                      <span className="font-medium">{creditNote.currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Exchange Rate:</span>
                      <span className="font-medium">{creditNote.exchange_rate?.toFixed(4)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
              Credit Items
            </h3>
            <div className="overflow-hidden bg-white rounded-lg shadow-sm ring-1 ring-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {creditNote.items?.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {creditNote.currency || baseCurrency} {item.rate.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                        {creditNote.currency || baseCurrency} {(item.gross_amount || item.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-8">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{creditNote.currency || baseCurrency} {creditNote.subtotal.toFixed(2)}</span>
              </div>
              
              {creditNote.tax_amount > 0 && (
                <div className="flex justify-between items-center py-2 border-t border-gray-200">
                  <span className="text-gray-600">Tax ({creditNote.tax_rate}%)</span>
                  <span className="font-medium">{creditNote.currency || baseCurrency} {creditNote.tax_amount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-3 border-t-2 border-gray-900">
                <span className="text-lg font-semibold">Total Credit</span>
                <span className="text-lg font-bold text-red-600">
                  -{creditNote.currency || baseCurrency} {creditNote.total.toFixed(2)}
                </span>
              </div>
              
              {creditNote.base_amount && creditNote.currency !== baseCurrency && (
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Base Amount ({baseCurrency})</span>
                <span>-{baseCurrency} {creditNote.base_amount.toFixed(2)}</span>
              </div>
            )}
            </div>
          </div>

          {/* Notes Section */}
          {creditNote.notes && (
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
                Notes
              </h3>
              <p className="text-gray-700 whitespace-pre-line">{creditNote.notes}</p>
            </div>
          )}

          {/* Applied Status */}
          {creditNote.applied_to_income && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    This credit note has been applied to income
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    A negative income entry has been created for this credit note.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};