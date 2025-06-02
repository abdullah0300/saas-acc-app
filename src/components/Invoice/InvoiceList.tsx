
// src/components/Invoice/InvoiceList.tsx
import React, { useState, useEffect } from 'react';
import { InvoiceSettings } from './InvoiceSettings';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Trash2, 
  Send, 
  Check,
  Filter,
  Settings,
  Download,
  Mail,
  MessageCircle,
  RefreshCw,
  Calendar,
  Clock,
  Bell,
  MoreVertical,
  Copy,
  Printer,
  ChevronDown
} from 'lucide-react';
import { getInvoices, deleteInvoice, updateInvoice } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { Invoice, InvoiceStatus } from '../../types';
import { supabase } from '../../services/supabaseClient';

interface RecurringInvoice {
  id: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  next_date: string;
  is_active: boolean;
}

export const InvoiceList: React.FC = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [recurringInvoices, setRecurringInvoices] = useState<Map<string, RecurringInvoice>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'one-time' | 'recurring'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [showSendModal, setShowSendModal] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvoices();
    checkDueInvoices();
  }, [user]);

  useEffect(() => {
    filterInvoices();
  }, [searchTerm, statusFilter, typeFilter, invoices]);

  const loadInvoices = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load regular invoices
      const data = await getInvoices(user.id);
      
      // Load recurring invoice data
      const { data: recurringData, error: recurringError } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('user_id', user.id);
      
      if (!recurringError && recurringData) {
        const recurringMap = new Map();
        recurringData.forEach(rec => {
          recurringMap.set(rec.invoice_id, rec);
        });
        setRecurringInvoices(recurringMap);
      }
      
      setInvoices(data);
      setFilteredInvoices(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkDueInvoices = async () => {
    if (!user) return;
    
    const upcomingInvoices = invoices.filter(invoice => {
      if (invoice.status === 'paid' || invoice.status === 'canceled') return false;
      const daysUntilDue = differenceInDays(parseISO(invoice.due_date), new Date());
      return daysUntilDue <= 2 && daysUntilDue >= 0;
    });
    
    // Send notifications for upcoming due dates
    upcomingInvoices.forEach(invoice => {
      sendNotification(invoice, 'due_soon');
    });
  };

  const filterInvoices = () => {
    let filtered = invoices;

    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.client?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(invoice => {
        const isRecurring = recurringInvoices.has(invoice.id);
        return typeFilter === 'recurring' ? isRecurring : !isRecurring;
      });
    }

    setFilteredInvoices(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
      await deleteInvoice(id);
      await loadInvoices();
    } catch (err: any) {
      alert('Error deleting invoice: ' + err.message);
    }
  };

  const handleStatusChange = async (id: string, status: InvoiceStatus) => {
    try {
      await updateInvoice(id, { status });
      
      if (status === 'sent') {
        const invoice = invoices.find(inv => inv.id === id);
        if (invoice) {
          sendNotification(invoice, 'sent');
        }
      }
      
      await loadInvoices();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const sendInvoice = async (invoice: Invoice, method: 'email' | 'whatsapp') => {
    try {
      if (method === 'email') {
        const { error } = await supabase.functions.invoke('send-invoice-email', {
          body: {
            invoiceId: invoice.id,
            recipientEmail: invoice.client?.email,
            invoiceUrl: `${window.location.origin}/invoices/view/${invoice.id}`
          }
        });
        
        if (error) throw error;
        alert('Invoice sent via email successfully!');
      } else if (method === 'whatsapp') {
        const message = encodeURIComponent(
          `Invoice ${invoice.invoice_number}\n` +
          `Amount: $${invoice.total}\n` +
          `Due Date: ${format(parseISO(invoice.due_date), 'MMM dd, yyyy')}\n` +
          `View Invoice: ${window.location.origin}/invoices/view/${invoice.id}`
        );
        
        window.open(`https://wa.me/${invoice.client?.phone}?text=${message}`, '_blank');
      }
      
      if (invoice.status === 'draft') {
        await handleStatusChange(invoice.id, 'sent');
      }
    } catch (err: any) {
      alert('Error sending invoice: ' + err.message);
    }
  };

  const sendNotification = async (invoice: Invoice, type: 'sent' | 'due_soon' | 'overdue') => {
    // This would integrate with your notification service
    console.log(`Sending ${type} notification for invoice ${invoice.invoice_number}`);
  };

  const duplicateInvoice = async (invoice: Invoice) => {
    try {
      // Create a new invoice with same details but new invoice number
      const newInvoiceNumber = `INV-${Date.now()}`;
      await updateInvoice(invoice.id, { 
        invoice_number: newInvoiceNumber,
        status: 'draft',
        date: format(new Date(), 'yyyy-MM-dd')
      });
      await loadInvoices();
    } catch (err: any) {
      alert('Error duplicating invoice: ' + err.message);
    }
  };

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'canceled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    return differenceInDays(parseISO(dueDate), new Date());
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">Manage all your invoices in one place</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Settings className="h-4 w-4 mr-2" />
            Invoice Settings
          </button>
          <Link
            to="/invoices/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Link>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="canceled">Canceled</option>
          </select>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="one-time">One-time</option>
            <option value="recurring">Recurring</option>
          </select>
          
          <button
            onClick={() => {/* Export functionality */}}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
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
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => {
                  const isRecurring = recurringInvoices.has(invoice.id);
                  const recurringInfo = isRecurring ? recurringInvoices.get(invoice.id) : null;
                  const daysUntilDue = getDaysUntilDue(invoice.due_date);
                  
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {invoice.invoice_number}
                            </div>
                            {daysUntilDue <= 2 && daysUntilDue >= 0 && invoice.status !== 'paid' && (
                              <div className="flex items-center text-xs text-orange-600 mt-1">
                                <Bell className="h-3 w-3 mr-1" />
                                Due in {daysUntilDue} days
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.client?.name || 'No client'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(parseISO(invoice.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(parseISO(invoice.due_date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${invoice.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isRecurring ? (
                          <div className="flex items-center text-sm">
                            <RefreshCw className="h-4 w-4 text-blue-600 mr-1" />
                            <span className="text-blue-600">
                              {recurringInfo?.frequency}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">One-time</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/invoices/view/${invoice.id}`}
                            className="text-gray-600 hover:text-gray-900"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            to={`/invoices/edit/${invoice.id}`}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                          
                          {/* Action Menu */}
                          <div className="relative">
                            <button
                              onClick={() => setShowSendModal(invoice.id)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            
                            {showSendModal === invoice.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10 py-1">
                                <button
                                  onClick={() => {
                                    sendInvoice(invoice, 'email');
                                    setShowSendModal(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                                >
                                  <Mail className="h-4 w-4 mr-2" />
                                  Send via Email
                                </button>
                                <button
                                  onClick={() => {
                                    sendInvoice(invoice, 'whatsapp');
                                    setShowSendModal(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                                >
                                  <MessageCircle className="h-4 w-4 mr-2" />
                                  Send via WhatsApp
                                </button>
                                <button
                                  onClick={() => {
                                    window.print();
                                    setShowSendModal(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                                >
                                  <Printer className="h-4 w-4 mr-2" />
                                  Print
                                </button>
                                <button
                                  onClick={() => {
                                    duplicateInvoice(invoice);
                                    setShowSendModal(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate
                                </button>
                                {invoice.status === 'draft' && (
                                  <button
                                    onClick={() => {
                                      handleStatusChange(invoice.id, 'sent');
                                      setShowSendModal(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Mark as Sent
                                  </button>
                                )}
                                {invoice.status === 'sent' && (
                                  <button
                                    onClick={() => {
                                      handleStatusChange(invoice.id, 'paid');
                                      setShowSendModal(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    Mark as Paid
                                  </button>
                                )}
                                <hr className="my-1" />
                                <button
                                  onClick={() => {
                                    handleDelete(invoice.id);
                                    setShowSendModal(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Settings Modal */}
      {showSettings && (
        <InvoiceSettings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};