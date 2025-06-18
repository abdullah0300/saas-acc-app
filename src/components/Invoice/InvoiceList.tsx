import React, { useState, useEffect } from 'react';
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
  ChevronDown,
  FileText,
  DollarSign,
  Users,
  AlertCircle,
  TrendingUp,
  Activity
} from 'lucide-react';
import { getInvoices, deleteInvoice, updateInvoice } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
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
  const { formatCurrency } = useSettings();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [recurringInvoices, setRecurringInvoices] = useState<Map<string, RecurringInvoice>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'one-time' | 'recurring'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'dueDate'>('date');

  // Stats
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    averageInvoiceValue: 0
  });

  useEffect(() => {
    loadInvoices();
    checkDueInvoices();
  }, [user]);

  useEffect(() => {
    filterInvoices();
    calculateStats();
  }, [searchTerm, statusFilter, typeFilter, sortBy, invoices]);

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

  const calculateStats = () => {
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
    const pendingAmount = invoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + inv.total, 0);
    const overdueAmount = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.total, 0);
    
    setStats({
      totalInvoices: invoices.length,
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      averageInvoiceValue: invoices.length > 0 ? totalAmount / invoices.length : 0
    });
  };

  const checkDueInvoices = async () => {
    if (!user) return;
    
    const upcomingInvoices = invoices.filter(invoice => {
      if (invoice.status === 'paid' || invoice.status === 'canceled') return false;
      const daysUntilDue = differenceInDays(parseISO(invoice.due_date), new Date());
      return daysUntilDue <= 2 && daysUntilDue >= 0;
    });
    
    // Update status to overdue if needed
    const now = new Date();
    invoices.forEach(async (invoice) => {
      if (invoice.status === 'sent' && new Date(invoice.due_date) < now) {
        await updateInvoice(invoice.id, { status: 'overdue' });
      }
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

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.total - a.total;
        case 'dueDate':
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

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
          `*Invoice ${invoice.invoice_number}*\n\n` +
          `Amount: *${formatCurrency(invoice.total)}*\n` +
          `Due Date: ${format(parseISO(invoice.due_date), 'MMM dd, yyyy')}\n\n` +
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

  const copyInvoiceLink = async (invoice: Invoice) => {
    const url = `${window.location.origin}/invoices/view/${invoice.id}`;
    await navigator.clipboard.writeText(url);
    alert('Invoice link copied to clipboard!');
  };

  const exportToCSV = () => {
    const headers = ['Invoice Number', 'Client', 'Date', 'Due Date', 'Status', 'Amount'];
    
    const data = filteredInvoices.map(invoice => [
      invoice.invoice_number,
      invoice.client?.name || 'No client',
      format(parseISO(invoice.date), 'yyyy-MM-dd'),
      format(parseISO(invoice.due_date), 'yyyy-MM-dd'),
      invoice.status,
      invoice.total.toFixed(2)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'sent': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'overdue': return 'bg-red-100 text-red-700 border-red-200';
      case 'canceled': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: InvoiceStatus) => {
    switch (status) {
      case 'draft': return <Edit className="h-3.5 w-3.5" />;
      case 'sent': return <Send className="h-3.5 w-3.5" />;
      case 'paid': return <Check className="h-3.5 w-3.5" />;
      case 'overdue': return <AlertCircle className="h-3.5 w-3.5" />;
      case 'canceled': return <Clock className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    return differenceInDays(parseISO(dueDate), new Date());
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
              <p className="text-gray-600 mt-1">Manage your invoices and track payments</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
              <Link
                to="/invoices/new"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                <FileText className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold">{stats.totalInvoices}</span>
            </div>
            <p className="text-indigo-100 text-sm">Total Invoices</p>
            <p className="text-indigo-200 text-xs mt-1">Avg: {formatCurrency(stats.averageInvoiceValue)}</p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                <DollarSign className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold">{formatCurrency(stats.paidAmount)}</span>
            </div>
            <p className="text-emerald-100 text-sm">Paid</p>
            <p className="text-emerald-200 text-xs mt-1">
              {stats.totalAmount > 0 ? Math.round((stats.paidAmount / stats.totalAmount) * 100) : 0}% collected
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                <Clock className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold">{formatCurrency(stats.pendingAmount)}</span>
            </div>
            <p className="text-amber-100 text-sm">Pending</p>
            <p className="text-amber-200 text-xs mt-1">Awaiting payment</p>
          </div>
          
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                <AlertCircle className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold">{formatCurrency(stats.overdueAmount)}</span>
            </div>
            <p className="text-red-100 text-sm">Overdue</p>
            <p className="text-red-200 text-xs mt-1">Requires attention</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by invoice number or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all"
            >
              <Filter className="h-5 w-5 mr-2" />
              Filters
              <ChevronDown className={`h-4 w-4 ml-2 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Types</option>
                  <option value="one-time">One-time</option>
                  <option value="recurring">Recurring</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="date">Date (Newest)</option>
                  <option value="dueDate">Due Date</option>
                  <option value="amount">Amount</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
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
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{invoice.client?.name || 'No client'}</div>
                          {invoice.client?.email && (
                            <div className="text-xs text-gray-500">{invoice.client.email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                            {format(parseISO(invoice.date), 'MMM dd, yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(parseISO(invoice.due_date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {formatCurrency(invoice.total)}
                          </div>
                          {invoice.tax_rate > 0 && (
                            <div className="text-xs text-gray-500">
                              Incl. {invoice.tax_rate}% tax
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(invoice.status)}`}>
                            {getStatusIcon(invoice.status)}
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isRecurring ? (
                            <div className="flex items-center text-sm">
                              <RefreshCw className={`h-4 w-4 mr-1 ${recurringInfo?.is_active ? 'text-indigo-600' : 'text-gray-400'}`} />
                              <span className={recurringInfo?.is_active ? 'text-indigo-600' : 'text-gray-500'}>
                                {recurringInfo?.frequency}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">One-time</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center justify-center space-x-2">
                            <Link
                              to={`/invoices/view/${invoice.id}`}
                              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <Link
                              to={`/invoices/edit/${invoice.id}`}
                              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                            
                            {/* Action Menu */}
                            <div className="relative">
                              <button
                                onClick={() => setShowActionMenu(showActionMenu === invoice.id ? null : invoice.id)}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              
                              {showActionMenu === invoice.id && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-10 py-1">
                                  {invoice.client?.email && (
                                    <button
                                      onClick={() => {
                                        sendInvoice(invoice, 'email');
                                        setShowActionMenu(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                                    >
                                      <Mail className="h-4 w-4 mr-3 text-gray-500" />
                                      Send via Email
                                    </button>
                                  )}
                                  {invoice.client?.phone && (
                                    <button
                                      onClick={() => {
                                        sendInvoice(invoice, 'whatsapp');
                                        setShowActionMenu(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                                    >
                                      <MessageCircle className="h-4 w-4 mr-3 text-gray-500" />
                                      Send via WhatsApp
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      copyInvoiceLink(invoice);
                                      setShowActionMenu(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                                  >
                                    <Copy className="h-4 w-4 mr-3 text-gray-500" />
                                    Copy Link
                                  </button>
                                  
                                  <hr className="my-1" />
                                  
                                  {invoice.status === 'draft' && (
                                    <button
                                      onClick={() => {
                                        handleStatusChange(invoice.id, 'sent');
                                        setShowActionMenu(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                                    >
                                      <Send className="h-4 w-4 mr-3 text-gray-500" />
                                      Mark as Sent
                                    </button>
                                  )}
                                  {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                                    <button
                                      onClick={() => {
                                        handleStatusChange(invoice.id, 'paid');
                                        setShowActionMenu(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                                    >
                                      <Check className="h-4 w-4 mr-3 text-gray-500" />
                                      Mark as Paid
                                    </button>
                                  )}
                                  
                                  <hr className="my-1" />
                                  
                                  <button
                                    onClick={() => {
                                      handleDelete(invoice.id);
                                      setShowActionMenu(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                                  >
                                    <Trash2 className="h-4 w-4 mr-3" />
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
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <FileText className="h-16 w-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg">No invoices found</p>
                        <p className="text-gray-400 text-sm mt-1">
                          {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Create your first invoice to get started'}
                        </p>
                        {!searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
                          <Link
                            to="/invoices/new"
                            className="mt-6 inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Your First Invoice
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};