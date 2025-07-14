import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DeleteInvoiceWarning } from './DeleteInvoiceWarning';
import { useData } from '../../contexts/DataContext';
import { SkeletonTable } from '../Common/Loading';
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
  Activity,
  X
} from 'lucide-react';
import { getInvoices, deleteInvoice, updateInvoice } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { Invoice, InvoiceStatus } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { formatPhoneForWhatsApp } from '../../utils/phoneUtils';

interface RecurringInvoice {
  id: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  next_date: string;
  is_active: boolean;
}

export const InvoiceList: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const queryClient = useQueryClient();
  const { refreshBusinessData } = useData();
  
  // State for filters and UI
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'one-time' | 'recurring'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'dueDate'>('date');
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
// Pagination states
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage] = useState(50); // 50 items per page

// Bulk selection states
const [selectedItems, setSelectedItems] = useState<string[]>([]);
const [selectAll, setSelectAll] = useState(false);

  // Fetch invoices with React Query
  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ['invoices', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const data = await getInvoices(user.id);
      
      // Check for overdue invoices
      const now = new Date();
      data.forEach(async (invoice) => {
        if (invoice.status === 'sent' && new Date(invoice.due_date) < now) {
          await updateInvoice(invoice.id, { status: 'overdue' });
        }
      });
      
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Fetch recurring invoices data
  const { data: recurringData = [] } = useQuery({
    queryKey: ['recurring-invoices', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Process recurring invoices into a Map
  const recurringInvoices = React.useMemo(() => {
    const map = new Map<string, RecurringInvoice>();
    recurringData.forEach(rec => {
      map.set(rec.invoice_id, rec);
    });
    return map;
  }, [recurringData]);

  // Delete mutation
 const deleteMutation = useMutation({
  mutationFn: deleteInvoice,
  onSuccess: async () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    await refreshBusinessData(); // ✅ Refresh DataContext cache
  },
  onError: (error: any) => {
    alert('Error deleting invoice: ' + error.message);
  }
});

  // Update mutation
  const updateMutation = useMutation({
  mutationFn: ({ id, updates }: { id: string; updates: Partial<Invoice> }) => 
    updateInvoice(id, updates),
  onSuccess: async () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    await refreshBusinessData(); // ✅ Refresh DataContext cache
  },
  onError: (error: any) => {
    alert('Error updating invoice: ' + error.message);
  }
});

  // Filter and sort invoices
  const filteredInvoices = React.useMemo(() => {
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

    return filtered;
  }, [invoices, searchTerm, statusFilter, typeFilter, sortBy, recurringInvoices]);


  // ADD THIS RIGHT AFTER filteredInvoices useMemo:

// Pagination logic
const getPaginatedInvoices = () => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return filteredInvoices.slice(startIndex, endIndex);
};

const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
const paginatedInvoices = getPaginatedInvoices();

// Selection helper functions
const handleSelectAll = (checked: boolean) => {
  setSelectAll(checked);
  if (checked) {
    const currentPageIds = paginatedInvoices.map(invoice => invoice.id);
    setSelectedItems(currentPageIds);
  } else {
    setSelectedItems([]);
  }
};

const handleSelectItem = (invoiceId: string, checked: boolean) => {
  if (checked) {
    setSelectedItems(prev => [...prev, invoiceId]);
  } else {
    setSelectedItems(prev => prev.filter(id => id !== invoiceId));
    setSelectAll(false);
  }
};

const clearSelections = () => {
  setSelectedItems([]);
  setSelectAll(false);
};

// Reset pagination when filters change
React.useEffect(() => {
  setCurrentPage(1);
  clearSelections();
}, [searchTerm, statusFilter, typeFilter, sortBy]);


// ADD THESE BULK OPERATION FUNCTIONS:

// Bulk delete function
const handleBulkDelete = async () => {
  if (selectedItems.length === 0) return;
  
  const confirmed = window.confirm(
    `Are you sure you want to delete ${selectedItems.length} invoice(s)? This action cannot be undone.`
  );
  
  if (!confirmed) return;
  
  try {
    // Delete each selected item
    await Promise.all(
      selectedItems.map(id => deleteMutation.mutateAsync(id))
    );
    
    clearSelections();
    alert(`Successfully deleted ${selectedItems.length} invoice(s)`);
  } catch (error) {
    console.error('Error deleting invoices:', error);
    alert('Error deleting some records. Please try again.');
  }
};

// Bulk export function
const handleBulkExport = () => {
  if (selectedItems.length === 0) {
    alert('Please select items to export');
    return;
  }
  
  const selectedInvoices = filteredInvoices.filter(invoice => 
    selectedItems.includes(invoice.id)
  );
  
  const headers = ['Invoice #', 'Date', 'Due Date', 'Client', 'Amount', 'Status', 'Type'];
  const csvData = selectedInvoices.map(invoice => [
    invoice.invoice_number,
    format(parseISO(invoice.date), 'yyyy-MM-dd'),
    format(parseISO(invoice.due_date), 'yyyy-MM-dd'),
    invoice.client?.name || 'No client',
    invoice.total.toString(),
    invoice.status,
    recurringInvoices.has(invoice.id) ? 'Recurring' : 'One-time'
  ]);
  
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `selected-invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  
  alert(`Exported ${selectedItems.length} invoice(s)`);
};

  // Calculate stats
  const stats = React.useMemo(() => {
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
    const pendingAmount = invoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + inv.total, 0);
    const overdueAmount = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.total, 0);
    
    return {
      totalInvoices: invoices.length,
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      averageInvoiceValue: invoices.length > 0 ? totalAmount / invoices.length : 0
    };
  }, [invoices]);

  const handleDelete = (id: string) => {
  const invoice = invoices.find(inv => inv.id === id);
  if (!invoice) return;

  // Check if user has disabled warnings for paid invoices
  const hideWarning = localStorage.getItem('hideInvoiceDeleteWarning') === 'true';
  
  // Show warning for paid invoices (unless user disabled it)
  if (invoice.status === 'paid' && !hideWarning) {
    setInvoiceToDelete(invoice);
    setShowDeleteWarning(true);
  } else {
    // Show simple confirmation for unpaid invoices or if warning is disabled
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      deleteMutation.mutate(id);
    }
  }
};

const handleConfirmDelete = () => {
  if (invoiceToDelete) {
    deleteMutation.mutate(invoiceToDelete.id);
  }
  setShowDeleteWarning(false);
  setInvoiceToDelete(null);
};

const handleCancelDelete = () => {
  setShowDeleteWarning(false);
  setInvoiceToDelete(null);
};

  const handleStatusChange = (id: string, status: InvoiceStatus) => {
    updateMutation.mutate({ id, updates: { status } });
  };

  const sendInvoice = async (invoice: Invoice, method: 'email' | 'whatsapp') => {
  try {
    // First, fetch the complete invoice data
    const { data: fullInvoiceData, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(*),
        items:invoice_items(*)
      `)
      .eq('id', invoice.id)
      .single();

    if (fetchError) throw fetchError;

    // Fetch profile and invoice settings separately using the invoice's user_id
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', fullInvoiceData.user_id)
      .single();

    const { data: settingsData } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', fullInvoiceData.user_id)
      .single();

    if (fetchError) throw fetchError;

    // Get company info from either profile or invoice settings
    const companyName = profileData?.company_name || 
                       settingsData?.company_name || 
                       'Your Company';
    const companyAddress = profileData?.company_address || 
                          settingsData?.company_address || '';
    const companyPhone = profileData?.phone || 
                        settingsData?.company_phone || '';

    if (method === 'email') {
      const { error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId: invoice.id,
          recipientEmail: invoice.client?.email,
          invoiceUrl: `${window.location.origin}/invoices/${invoice.id}/view`
        }
      });
      
      if (error) throw error;
      alert('Invoice sent via email successfully!');
    } else if (method === 'whatsapp') {
  // Check if client has phone number
  if (!invoice.client?.phone) {
    alert('Client phone number is required to send via WhatsApp');
    return;
  }

  try {
    // Use the new utility function with client's country code
    const phoneNumber = formatPhoneForWhatsApp(
      invoice.client.phone, 
      invoice.client.phone_country_code
    );

    // Build line items summary if available
    let itemsSummary = '';
    if (fullInvoiceData?.items && fullInvoiceData.items.length > 0) {
      itemsSummary = '\n📋 *ITEMS:*\n';
      fullInvoiceData.items.forEach((item: any) => {
        itemsSummary += `• ${item.description} - ${formatCurrency(item.amount)}\n`;
      });
    }

    // Professional invoice message format with company info
    const message = encodeURIComponent(
      `🏢 *${companyName}*\n` +
      (companyAddress ? `📍 ${companyAddress}\n` : '') +
      (companyPhone ? `☎️ ${companyPhone}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📄 *INVOICE*\n\n` +
      `*To:* ${invoice.client?.name}\n` +
      (invoice.client?.address ? `${invoice.client.address}\n` : '') +
      `\n*Invoice #:* ${invoice.invoice_number}\n` +
      `*Date:* ${format(parseISO(invoice.date), 'MMM dd, yyyy')}\n` +
      `*Due Date:* ${format(parseISO(invoice.due_date), 'MMM dd, yyyy')}\n` +
      itemsSummary +
      `\n━━━━━━━━━━━━━━━━━━━━\n` +
      `*Subtotal:* ${formatCurrency(invoice.subtotal)}\n` +
      (invoice.tax_rate > 0 ? `*Tax (${invoice.tax_rate}%):* ${formatCurrency(invoice.tax_amount)}\n` : '') +
      `💰 *TOTAL DUE:* ${formatCurrency(invoice.total)}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📱 *View Full Invoice:*\n` +
      `${window.location.origin}/invoices/${invoice.id}/view\n\n` +
      `💳 *Payment Options:*\n` +
      `• Bank Transfer\n` +
      `• Credit/Debit Card\n` +
      `• PayPal\n` +
      (settingsData?.payment_instructions ? 
        `\n📝 *Payment Instructions:*\n${settingsData.payment_instructions}\n\n` : '\n') +
      `Thank you for your business! 🙏\n\n` +
      `_Please save this number to receive future updates._`
    );
    
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
    
  } catch (error: any) {
    alert(`Error: ${error.message}\nPlease update the client's country code.`);
    return;
  }
}
    
    // Update invoice status to 'sent' if it was draft
    if (invoice.status === 'draft') {
      await handleStatusChange(invoice.id, 'sent');
      
      // Track activity
      if (user?.id) {
        await supabase.from('invoice_activities').insert({
          invoice_id: invoice.id,
          user_id: user.id,
          action: 'sent',
          details: { 
            method, 
            timestamp: new Date().toISOString(),
            sent_to: method === 'email' ? invoice.client?.email : invoice.client?.phone
          }
        });
      }
    }
  } catch (err: any) {
    console.error('Error sending invoice:', err);
    alert('Error sending invoice: ' + (err.message || 'Unknown error'));
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

  if (isLoading) return <SkeletonTable rows={8} columns={7} hasActions={true} />;

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Error loading invoices</p>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['invoices'] })}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
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
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden ">
          {/* ADD THIS BULK ACTION TOOLBAR: */}
        {selectedItems.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4 ">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-indigo-700 font-medium">
                  {selectedItems.length} invoice(s) selected
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleBulkExport}
                  className="inline-flex items-center px-3 py-2 border border-indigo-300 shadow-sm text-sm leading-4 font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </button>
                <button
                  onClick={clearSelections}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden "></div>
          <div className="overflow-x-auto min-h-[300px]">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="relative w-12 px-6 sm:w-16 sm:px-8">
                    <input
                      type="checkbox"
                      className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
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
                {paginatedInvoices.length > 0 ? (
                  paginatedInvoices.map((invoice) => {
                    const isRecurring = recurringInvoices.has(invoice.id);
                    const recurringInfo = isRecurring ? recurringInvoices.get(invoice.id) : null;
                    const daysUntilDue = getDaysUntilDue(invoice.due_date);
                    
                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                          <input
                            type="checkbox"
                            className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                            checked={selectedItems.includes(invoice.id)}
                            onChange={(e) => handleSelectItem(invoice.id, e.target.checked)}
                          />
                        </td>
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
                              to={`/invoices/${invoice.id}/view`}
                              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <Link
                              to={`/invoices/${invoice.id}/edit`}
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
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-1 transform -translate-x-2">
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
                    <td colSpan={9} className="px-6 py-12 text-center">
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
        
{/* ADD THIS PAGINATION SECTION: */}
        {filteredInvoices.length > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => {
                  setCurrentPage(Math.max(1, currentPage - 1));
                  clearSelections();
                }}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setCurrentPage(Math.min(totalPages, currentPage + 1));
                  clearSelections();
                }}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, filteredInvoices.length)}
                  </span> of{' '}
                  <span className="font-medium">{filteredInvoices.length}</span> results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => {
                      setCurrentPage(Math.max(1, currentPage - 1));
                      clearSelections();
                    }}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:bg-gray-100"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Page Numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber: number;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => {
                          setCurrentPage(pageNumber);
                          clearSelections();
                        }}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                          currentPage === pageNumber
                            ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                            : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => {
                      setCurrentPage(Math.min(totalPages, currentPage + 1));
                      clearSelections();
                    }}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:bg-gray-100"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

      </div>
      {/* Delete Warning Dialog */}
     
<DeleteInvoiceWarning
  isOpen={showDeleteWarning}
  invoiceNumber={invoiceToDelete?.invoice_number || ''}
  invoiceStatus={invoiceToDelete?.status || ''}
  onConfirm={handleConfirmDelete}
  onCancel={handleCancelDelete}
/>
    </div>
  );
};