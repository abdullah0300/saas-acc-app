// src/components/CreditNote/CreditNoteList.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Eye, Edit, Trash2, Download, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCreditNotes, deleteCreditNote, applyCreditNote } from '../../services/database';
import { CreditNote } from '../../types';
import { format } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';

export const CreditNoteList: React.FC = () => {
  const { user } = useAuth();
  const { baseCurrency } = useSettings();
  const navigate = useNavigate();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadCreditNotes();
    }
  }, [user]);

  const loadCreditNotes = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = await getCreditNotes(user.id);
      setCreditNotes(data);
    } catch (error) {
      console.error('Error loading credit notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this draft credit note?')) {
      return;
    }

    try {
      await deleteCreditNote(id);
      await loadCreditNotes();
    } catch (error: any) {
      alert(error.message || 'Error deleting credit note');
    }
  };

  const handleApplyToIncome = async (creditNote: CreditNote) => {
    if (!user) return;
    
    if (creditNote.applied_to_income) {
      alert('This credit note has already been applied to income');
      return;
    }

    if (!window.confirm('Apply this credit note to income? This will create a negative income entry and cannot be undone.')) {
      return;
    }

    try {
      await applyCreditNote(creditNote.id, user.id, 'refund');
      await loadCreditNotes();
      alert('Credit note applied to income successfully');
    } catch (error: any) {
      alert(error.message || 'Error applying credit note');
    }
  };

  const getStatusBadge = (status: string, appliedToIncome: boolean) => {
    const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full";
    
    if (appliedToIncome) {
      return `${baseClasses} bg-green-100 text-green-800`;
    }
    
    switch (status) {
      case 'draft':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      case 'issued':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'applied':
        return `${baseClasses} bg-green-100 text-green-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
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

  const filteredCreditNotes = creditNotes.filter(cn => {
    const matchesSearch = cn.credit_note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          cn.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          cn.invoice?.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || cn.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Credit Notes</h1>
        <Link
          to="/credit-notes/new"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Credit Note
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search credit notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="applied">Applied</option>
        </select>
      </div>

      {/* Credit Notes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Credit Note
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reason
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCreditNotes.map((creditNote) => (
              <tr key={creditNote.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {creditNote.credit_note_number}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    to={`/invoices/${creditNote.invoice_id}`}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {creditNote.invoice?.invoice_number || '-'}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {creditNote.client?.name || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {format(new Date(creditNote.date), 'MMM dd, yyyy')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {getReasonLabel(creditNote.reason)}
                  </div>
                  {creditNote.reason_description && (
                    <div className="text-xs text-gray-500">
                      {creditNote.reason_description}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-red-600">
                    -{creditNote.currency || baseCurrency} {creditNote.total.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={getStatusBadge(creditNote.status, creditNote.applied_to_income)}>
                    {creditNote.applied_to_income ? 'Applied' : creditNote.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/credit-notes/${creditNote.id}`}
                      className="text-blue-600 hover:text-blue-900"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    
                    {creditNote.status === 'draft' && (
                      <>
                        <Link
                          to={`/credit-notes/edit/${creditNote.id}`}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(creditNote.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    
                    {creditNote.status === 'issued' && !creditNote.applied_to_income && (
                      <button
                        onClick={() => handleApplyToIncome(creditNote)}
                        className="text-green-600 hover:text-green-900"
                        title="Apply to Income"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCreditNotes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No credit notes found</p>
          </div>
        )}
      </div>
    </div>
  );
};