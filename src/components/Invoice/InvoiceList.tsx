import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom'; 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DeleteInvoiceWarning } from './DeleteInvoiceWarning';
import { useData } from '../../contexts/DataContext';
import { SkeletonTable } from '../Common/Loading';
import { VATAuditService } from '../../services/vatAuditService';
import { InvoiceSettings } from './InvoiceSettings';
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
  X,
  Shield,
  CalendarSync,
  CreditCard,
  Globe,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Tag,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getInvoices, deleteInvoice, updateInvoice, getCategories } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { format, addDays, differenceInDays, parseISO, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, startOfYear, endOfYear, subYears } from 'date-fns';
import { Invoice, InvoiceStatus, Client, Category } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { formatPhoneForWhatsApp } from '../../utils/phoneUtils';

interface RecurringInvoice {
  id: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  next_date: string;
  is_active: boolean;
}

// Currency flags mapping
const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  GBP: '🇬🇧',
  EUR: '🇪🇺',
  CAD: '🇨🇦',
  AUD: '🇦🇺',
  INR: '🇮🇳',
  PKR: '🇵🇰',
  JPY: '🇯🇵',
  CNY: '🇨🇳',
  AED: '🇦🇪',
  SAR: '🇸🇦'
};

export const InvoiceList: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency, userSettings } = useSettings();
  const queryClient = useQueryClient();
  const { refreshBusinessData, effectiveUserId } = useData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Helper function to calculate total tax from items with proper fallback
  const calculateInvoiceTaxTotal = (invoice: Invoice): number => {
    if (invoice.items && invoice.items.length > 0) {
      // Sum up all item-level taxes
      const itemTaxTotal = invoice.items.reduce((total, item) => 
        total + (item.tax_amount || 0), 0
      );
      // Return item tax total if available, otherwise fall back to invoice-level tax
      return itemTaxTotal > 0 ? itemTaxTotal : (invoice.tax_amount || 0);
    }
    return invoice.tax_amount || 0;
  };

  // Helper function to convert amount to base currency
  const convertToBaseCurrency = (amount: number, currency: string, exchangeRate: number = 1): number => {
    if (currency === baseCurrency) return amount;
    // If converting FROM foreign currency TO base currency, divide by exchange rate
    return amount / exchangeRate;
  };

  // Helper function to convert from base currency to foreign currency
  const convertFromBaseCurrency = (baseAmount: number, exchangeRate: number = 1): number => {
    // If converting FROM base currency TO foreign currency, multiply by exchange rate
    return baseAmount * exchangeRate;
  };
  
  // State for filters and UI - Initialize from URL params
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>((searchParams.get('status') as InvoiceStatus) || 'all');
  const [currencyFilter, setCurrencyFilter] = useState<string>(searchParams.get('currency') || 'all');
  const [clientFilter, setClientFilter] = useState<string>(searchParams.get('client') || 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('category') || 'all');
  const [showSettings, setShowSettings] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'one-time' | 'recurring'>((searchParams.get('type') as 'all' | 'one-time' | 'recurring') || 'all');
  const [showFilters, setShowFilters] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'dueDate'>((searchParams.get('sort') as 'date' | 'amount' | 'dueDate') || 'date');
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [itemsPerPage] = useState(50);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Date range filter states - Initialize from URL
  const [dateRange, setDateRange] = useState<string>(searchParams.get('date') || 'this-month');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(searchParams.get('start') || '');
  const [customEndDate, setCustomEndDate] = useState(searchParams.get('end') || '');

  // Check if UK user for VAT features - based on country, not currency
  const isUKUser = userSettings?.country === 'GB';

  // Sync filters to URL params
  useEffect(() => {
    const params = new URLSearchParams();

    // Only add non-default values to keep URL clean
    if (searchTerm) params.set('q', searchTerm);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (currencyFilter !== 'all') params.set('currency', currencyFilter);
    if (clientFilter !== 'all') params.set('client', clientFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (dateRange !== 'this-month') params.set('date', dateRange);
    if (sortBy !== 'date') params.set('sort', sortBy);
    if (currentPage !== 1) params.set('page', currentPage.toString());
    if (customStartDate) params.set('start', customStartDate);
    if (customEndDate) params.set('end', customEndDate);

    // Update URL without causing navigation
    setSearchParams(params, { replace: true });
  }, [searchTerm, statusFilter, currencyFilter, clientFilter, categoryFilter, typeFilter, dateRange, sortBy, currentPage, customStartDate, customEndDate]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if the click is outside both the menu and the trigger button
      if (!target.closest('.action-menu-container') && !target.closest('.action-menu-trigger')) {
        setShowActionMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch invoices with React Query
  const { data: invoices = [], isLoading, error, refetch } = useQuery({
    queryKey: ['invoices', effectiveUserId],
    queryFn: async () => {
      if (!user || !effectiveUserId) return [];
      const data = await getInvoices(effectiveUserId);

      // Check for overdue invoices
      const now = new Date();
      const overdueUpdates = data
        .filter(invoice =>
          invoice.status === 'sent' &&
          new Date(invoice.due_date) < now
        )
        .map(invoice => updateInvoice(invoice.id, { status: 'overdue' }));

      if (overdueUpdates.length > 0) {
        await Promise.all(overdueUpdates);
        // Refetch to get updated statuses
        return await getInvoices(effectiveUserId);
      }

      return data;
    },
    enabled: !!user && !!effectiveUserId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user?.id, 'income'],
    queryFn: async () => {
      if (!user) return [];
      return await getCategories(user.id, 'income');
    },
    enabled: !!user,
  });

  // Fetch recurring invoices data
  const { data: recurringData = [] } = useQuery({
    queryKey: ['recurring-invoices', effectiveUserId],
    queryFn: async () => {
      if (!user || !effectiveUserId) return [];
      const { data, error } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('user_id', effectiveUserId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!effectiveUserId,
  });

  // Process recurring invoices into a Map with null checks
  const recurringInvoices = React.useMemo(() => {
    const map = new Map<string, RecurringInvoice>();
    recurringData.forEach(rec => {
      if (rec.invoice_id) {
        map.set(rec.invoice_id, rec);
      }
    });
    return map;
  }, [recurringData]);

  // Get unique clients from invoices with proper null handling
  const uniqueClients = React.useMemo(() => {
    const clientsMap = new Map<string, Client>();
    invoices.forEach(invoice => {
      if (invoice.client?.id && invoice.client?.name) {
        clientsMap.set(invoice.client.id, invoice.client);
      }
    });
    return Array.from(clientsMap.values()).sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    );
  }, [invoices]);

  // Delete mutation with error recovery
  const deleteMutation = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await refreshBusinessData();
    },
    onError: (error: any) => {
      alert('Error deleting invoice: ' + error.message);
    }
  });

  // Generate public link function with deduplication
  const generatePublicLink = async (invoiceId: string) => {
    if (!user) return '';
    
    try {
      // Check for existing valid token first
      const { data: existingToken } = await supabase
        .from('invoice_access_tokens')
        .select('token')
        .eq('invoice_id', invoiceId)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();
      
      if (existingToken?.token) {
        const baseUrl = window.location.origin;
        return `${baseUrl}/invoice/public/${invoiceId}?token=${existingToken.token}`;
      }
      
      // Create new token only if no valid token exists
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const { error } = await supabase
        .from('invoice_access_tokens')
        .insert({
          token,
          invoice_id: invoiceId,
          expires_at: expiresAt.toISOString()
        });
      
      if (error) throw error;
      
      const baseUrl = window.location.origin;
      return `${baseUrl}/invoice/public/${invoiceId}?token=${token}`;
    } catch (err: any) {
      console.error('Error generating public link:', err);
      alert('Failed to generate public link. Please try again.');
      return '';
    }
  };

  // Get unique currencies from invoices
  const uniqueCurrencies = React.useMemo(() => {
    const currencies = new Set<string>();
    invoices.forEach(invoice => {
      if (invoice.currency) currencies.add(invoice.currency);
    });
    return Array.from(currencies).sort();
  }, [invoices]);

  // Filter and sort invoices with proper null handling
  const filteredInvoices = React.useMemo(() => {
    let filtered = invoices;

    // Date Range Filter - SAME AS IncomeList
    if (dateRange !== 'all') {
      const now = new Date();
      filtered = filtered.filter(invoice => {
        const invoiceDate = parseISO(invoice.date);

        switch (dateRange) {
          case 'today':
            return format(invoiceDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');

          case 'this-week':
            const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
            const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
            return invoiceDate >= weekStart && invoiceDate <= weekEnd;

          case 'this-month':
            const monthStart = startOfMonth(now);
            const monthEnd = endOfMonth(now);
            return invoiceDate >= monthStart && invoiceDate <= monthEnd;

          case 'last-month':
            const lastMonth = subMonths(now, 1);
            const lastMonthStart = startOfMonth(lastMonth);
            const lastMonthEnd = endOfMonth(lastMonth);
            return invoiceDate >= lastMonthStart && invoiceDate <= lastMonthEnd;

          case 'this-year':
            const yearStart = startOfYear(now);
            const yearEnd = endOfYear(now);
            return invoiceDate >= yearStart && invoiceDate <= yearEnd;

          case 'last-year':
            const lastYear = subYears(now, 1);
            const lastYearStart = startOfYear(lastYear);
            const lastYearEnd = endOfYear(lastYear);
            return invoiceDate >= lastYearStart && invoiceDate <= lastYearEnd;

          case 'custom':
            if (customStartDate && customEndDate) {
              const customStart = parseISO(customStartDate);
              const customEnd = parseISO(customEndDate);
              return invoiceDate >= customStart && invoiceDate <= customEnd;
            }
            return true;

          default:
            return true;
        }
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (invoice.client?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === statusFilter);
    }

    if (currencyFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.currency === currencyFilter);
    }

    if (clientFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.client?.id === clientFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.income_category_id === categoryFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(invoice => {
        const isRecurring = recurringInvoices.has(invoice.id);
        return typeFilter === 'recurring' ? isRecurring : !isRecurring;
      });
    }

    // Sort with proper null handling
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          const aAmount = a.base_amount || convertToBaseCurrency(a.total, a.currency || baseCurrency, a.exchange_rate || 1);
          const bAmount = b.base_amount || convertToBaseCurrency(b.total, b.currency || baseCurrency, b.exchange_rate || 1);
          return bAmount - aAmount;
        case 'dueDate':
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

    return filtered;
  }, [invoices, searchTerm, statusFilter, currencyFilter, clientFilter, categoryFilter, typeFilter, sortBy, recurringInvoices, baseCurrency, dateRange, customStartDate, customEndDate]);

  // Pagination logic
  const getPaginatedInvoices = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredInvoices.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = getPaginatedInvoices();

  // Reset pagination when data changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

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

  // Helper functions for date ranges (same as IncomeList)
  const getDateRangeDisplayName = (range: string) => {
    const currentYear = new Date().getFullYear();

    switch (range) {
      case 'today':
        return 'Today';
      case 'this-week':
        return 'This Week';
      case 'this-month':
        return 'This Month';
      case 'last-month':
        return 'Last Month';
      case 'this-year':
        return `This Year (${currentYear})`;
      case 'last-year':
        return `Last Year (${currentYear - 1})`;
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${format(parseISO(customStartDate), 'MMM dd, yyyy')} - ${format(parseISO(customEndDate), 'MMM dd, yyyy')}`;
        }
        return 'Custom Range';
      case 'all':
        return 'All Time';
      default:
        return 'Selected Period';
    }
  };

  // Function to search all time when user wants to expand
  const searchAllTime = () => {
    setDateRange('all');
  };

  // Handle custom date range
  const handleCustomDateRange = () => {
    if (!customStartDate || !customEndDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (new Date(customStartDate) > new Date(customEndDate)) {
      alert('Start date cannot be after end date');
      return;
    }

    setDateRange('custom');
    setShowCustomDatePicker(false);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCurrencyFilter('all');
    setClientFilter('all');
    setCategoryFilter('all');
    setTypeFilter('all');
    setDateRange('this-month');
    setSortBy('date');
    setCurrentPage(1);
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return searchTerm !== '' ||
           statusFilter !== 'all' ||
           currencyFilter !== 'all' ||
           clientFilter !== 'all' ||
           categoryFilter !== 'all' ||
           typeFilter !== 'all' ||
           dateRange !== 'this-month' ||
           sortBy !== 'date';
  };

  // Reset custom date picker
  const resetCustomDatePicker = () => {
    setCustomStartDate('');
    setCustomEndDate('');
    setShowCustomDatePicker(false);
  };

  // Helper function to get search results count message
  const getSearchResultsMessage = () => {
    const totalInvoices = invoices.length;
    const filteredCount = filteredInvoices.length;
    const isSearching = searchTerm.length > 0;
    const scopeName = getDateRangeDisplayName(dateRange);

    if (isSearching) {
      return {
        primary: `Found ${filteredCount} result${filteredCount !== 1 ? 's' : ''}`,
        secondary: `Searching in: ${scopeName}`,
        showExpandOption: filteredCount < 5 && dateRange !== 'all' && totalInvoices > filteredCount
      };
    }

    return {
      primary: `Showing ${filteredCount} invoice${filteredCount !== 1 ? 's' : ''}`,
      secondary: `From: ${scopeName}`,
      showExpandOption: false
    };
  };

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
    clearSelections();
  }, [searchTerm, statusFilter, currencyFilter, clientFilter, categoryFilter, typeFilter, sortBy, dateRange, customStartDate, customEndDate]);

  // Bulk delete function with loading state
  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    
    const selectedInvoiceData = filteredInvoices.filter(
      invoice => selectedItems.includes(invoice.id)
    );
    
    const lockedInvoices = selectedInvoiceData.filter(
      invoice => invoice.status === 'paid' || 
                 invoice.status === 'canceled' ||
                 invoice.vat_locked_at
    );
    
    if (lockedInvoices.length > 0) {
      alert(`Cannot delete ${lockedInvoices.length} locked invoice(s). These are locked for legal compliance.`);
      return;
    }
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedItems.length} invoice(s)? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    setBulkActionLoading(true);
    try {
      await Promise.all(
        selectedItems.map(id => deleteMutation.mutateAsync(id))
      );
      
      clearSelections();
      alert(`Successfully deleted ${selectedItems.length} invoice(s)`);
    } catch (error) {
      console.error('Error deleting invoices:', error);
      alert('Error deleting some records. Please try again.');
    } finally {
      setBulkActionLoading(false);
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
    
    const headers = ['Invoice #', 'Date', 'Due Date', 'Client', 'Amount', 'Currency', 'Exchange Rate', 'Base Amount', 'Status', 'Type', 'Has Credits'];
    const csvData = selectedInvoices.map(invoice => [
      invoice.invoice_number,
      format(parseISO(invoice.date), 'yyyy-MM-dd'),
      format(parseISO(invoice.due_date), 'yyyy-MM-dd'),
      invoice.client?.name || 'No client',
      invoice.total.toString(),
      invoice.currency || baseCurrency,
      (invoice.exchange_rate || 1).toString(),
      (invoice.base_amount || convertToBaseCurrency(invoice.total, invoice.currency || baseCurrency, invoice.exchange_rate || 1)).toString(),
      invoice.status,
      recurringInvoices.has(invoice.id) ? 'Recurring' : 'One-time',
      invoice.has_credit_notes ? 'Yes' : 'No'
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

  // Calculate enhanced stats with proper currency conversion
  const stats = React.useMemo(() => {
    // Convert all amounts to base currency for accurate totals
    const getBaseAmount = (invoice: Invoice) => {
      if (invoice.base_amount) return invoice.base_amount;
      return convertToBaseCurrency(
        invoice.total,
        invoice.currency || baseCurrency,
        invoice.exchange_rate || 1
      );
    };

    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + getBaseAmount(inv), 0);
    const paidAmount = filteredInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + getBaseAmount(inv), 0);
    const pendingAmount = filteredInvoices
      .filter(inv => inv.status === 'sent')
      .reduce((sum, inv) => sum + getBaseAmount(inv), 0);
    const overdueAmount = filteredInvoices
      .filter(inv => inv.status === 'overdue')
      .reduce((sum, inv) => sum + getBaseAmount(inv), 0);

    // Draft invoices
    const draftInvoices = filteredInvoices.filter(inv => inv.status === 'draft');
    const draftAmount = draftInvoices.reduce((sum, inv) => sum + getBaseAmount(inv), 0);

    // Credit notes totals (already in base currency)
    const totalCredited = filteredInvoices.reduce((sum, inv) =>
      sum + (inv.total_credited || 0), 0
    );
    const invoicesWithCredits = filteredInvoices.filter(inv => inv.has_credit_notes).length;

    // Currency breakdown (in original currency)
    const currencyBreakdown = filteredInvoices.reduce((acc, inv) => {
      const currency = inv.currency || baseCurrency;
      if (!acc[currency]) acc[currency] = { total: 0, count: 0 };
      acc[currency].total += inv.total;
      acc[currency].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    return {
      totalInvoices: filteredInvoices.length,
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      draftAmount,
      draftCount: draftInvoices.length,
      totalCredited,
      invoicesWithCredits,
      currencyBreakdown,
      averageInvoiceValue: filteredInvoices.length > 0 ? totalAmount / filteredInvoices.length : 0
    };
  }, [filteredInvoices, baseCurrency]);

  const handleDelete = (id: string) => {
    const invoice = invoices.find(inv => inv.id === id);
    if (!invoice) return;

    if (invoice.status === 'paid' || invoice.status === 'canceled' || invoice.vat_locked_at) {
      alert('Cannot delete this invoice. It is locked for legal compliance.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this invoice?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleStatusChange = async (id: string, newStatus: InvoiceStatus) => {
    try {
      await updateInvoice(id, { status: newStatus });
      
      // Handle automatic income creation when marking as paid
      if (newStatus === 'paid' && user) {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', id)
          .single();
        
        if (!invoice) return;
        
        // Check if income already exists
        const { data: existingIncome } = await supabase
          .from('income')
          .select('id')
          .eq('reference_number', invoice.invoice_number)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!existingIncome) {
          let totalNetAmount = 0;
          let totalTaxAmount = 0;
          let taxBreakdown: Record<string, any> = {};
          
          // Fetch invoice items for VAT breakdown
          const { data: items } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoice.id);
          
          // Check if this is a UK VAT invoice (based on user country, not currency)
          const isUKVAT = isUKUser && 
                         items && items.length > 0 &&
                         items.some(item => (item.tax_rate || 0) > 0);
         
          if (isUKVAT && items && items.length > 0) {
            // Build VAT breakdown from items
            items.forEach(item => {
              const rate = (item.tax_rate || 0).toString();
              const netAmount = item.net_amount || item.amount || 0;
              const taxAmount = item.tax_amount || 0;
              
              if (!taxBreakdown[rate]) {
                taxBreakdown[rate] = {
                  net_amount: 0,
                  tax_amount: 0,
                  gross_amount: 0
                };
              }
              
              taxBreakdown[rate].net_amount += netAmount;
              taxBreakdown[rate].tax_amount += taxAmount;
              taxBreakdown[rate].gross_amount += netAmount + taxAmount;
              
              totalNetAmount += netAmount;
              totalTaxAmount += taxAmount;
            });
          } else {
            // Non-VAT invoice
            totalNetAmount = invoice.subtotal;
            totalTaxAmount = invoice.tax_amount || 0;
            
            if (invoice.tax_rate > 0) {
              taxBreakdown[invoice.tax_rate.toString()] = {
                net_amount: invoice.subtotal,
                tax_amount: invoice.tax_amount,
                gross_amount: invoice.total
              };
            }
          }
          
          // Calculate base amount correctly
          const baseAmount = invoice.currency === baseCurrency
            ? totalNetAmount
            : convertToBaseCurrency(totalNetAmount, invoice.currency || baseCurrency, invoice.exchange_rate || 1);
          
          const { error: incomeError } = await supabase
            .from('income')
            .insert([{
              user_id: user.id,
              amount: totalNetAmount,
              description: `Payment for Invoice #${invoice.invoice_number}`,
              date: new Date().toISOString().split('T')[0],
              client_id: invoice.client_id || null,
              category_id: invoice.income_category_id || null,
              reference_number: invoice.invoice_number,
              currency: invoice.currency || baseCurrency,
              exchange_rate: invoice.exchange_rate || 1,
              base_amount: baseAmount,
              tax_rate: invoice.tax_rate || 0,
              tax_amount: totalTaxAmount,
              tax_metadata: {
                tax_breakdown: taxBreakdown,
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                created_from_invoice: true,
                is_uk_vat: isUKVAT
              }
            }]);
            
          if (incomeError) throw incomeError;
          
          // Log VAT link if applicable
          if (isUKVAT && !incomeError) {
            const { data: newIncome } = await supabase
              .from('income')
              .select('id')
              .eq('reference_number', invoice.invoice_number)
              .eq('user_id', user.id)
              .single();
            
            if (newIncome) {
              await VATAuditService.logVATLink(
                user.id,
                'invoice',
                invoice.id,
                'income',
                newIncome.id,
                { 
                  invoice_number: invoice.invoice_number, 
                  amount: totalNetAmount, 
                  vat: totalTaxAmount,
                  vat_breakdown: taxBreakdown 
                }
              );
            }
          }
        }
      }
      
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['income'] });
      await refreshBusinessData();
      
    } catch (error: any) {
      console.error('Error updating invoice status:', error);
      alert('Error updating invoice status: ' + error.message);
      // Refetch to ensure UI is in sync
      await refetch();
    }
  };

  const sendInvoice = async (invoice: Invoice, method: 'email' | 'whatsapp') => {
    try {
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

      const companyName = profileData?.company_name || 
                         settingsData?.company_name || 
                         'Your Company';
      const companyAddress = profileData?.company_address || 
                            settingsData?.company_address || '';
      const companyPhone = profileData?.phone || 
                          settingsData?.company_phone || '';

      if (method === 'email') {
        if (!invoice.client?.email) {
          alert('Client email is required to send via email');
          return;
        }
        
        const { error } = await supabase.functions.invoke('send-invoice-email', {
          body: {
            invoiceId: invoice.id,
            recipientEmail: invoice.client.email,
            invoiceUrl: `${window.location.origin}/invoices/${invoice.id}/view`
          }
        });
        
        if (error) throw error;
        alert('Invoice sent via email successfully!');
      } else if (method === 'whatsapp') {
        if (!invoice.client?.phone) {
          alert('Client phone number is required to send via WhatsApp');
          return;
        }

        try {
          const phoneNumber = formatPhoneForWhatsApp(
            invoice.client.phone, 
            invoice.client.phone_country_code
          );

          const publicLink = await generatePublicLink(invoice.id);
          if (!publicLink) return;

          let itemsSummary = '';
          if (fullInvoiceData?.items && fullInvoiceData.items.length > 0) {
            itemsSummary = '\n📋 *ITEMS:*\n';
            fullInvoiceData.items.forEach((item: any) => {
              itemsSummary += `• ${item.description} - ${formatCurrency(item.amount, invoice.currency || baseCurrency)}\n`;
            });
          }

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
            `*Subtotal:* ${formatCurrency(invoice.subtotal, invoice.currency || baseCurrency)}\n` +
            (invoice.tax_rate > 0 ? `*Tax (${invoice.tax_rate}%):* ${formatCurrency(invoice.tax_amount, invoice.currency || baseCurrency)}\n` : '') +
            `💰 *TOTAL DUE:* ${formatCurrency(invoice.total, invoice.currency || baseCurrency)}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📱 *View Full Invoice:*\n` +
            `${publicLink}\n\n` +
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
      
      // Update status if sending from draft
      if (invoice.status === 'draft') {
        await handleStatusChange(invoice.id, 'sent');
        
        // Log activity
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
    const publicUrl = await generatePublicLink(invoice.id);
    if (publicUrl) {
      await navigator.clipboard.writeText(publicUrl);
      alert('Public invoice link copied to clipboard!');
    }
  };

  const exportToCSV = () => {
    const headers = ['Invoice Number', 'Client', 'Date', 'Due Date', 'Status', 'Amount', 'Currency', 'Exchange Rate'];
    
    const data = filteredInvoices.map(invoice => [
      invoice.invoice_number,
      invoice.client?.name || 'No client',
      format(parseISO(invoice.date), 'yyyy-MM-dd'),
      format(parseISO(invoice.due_date), 'yyyy-MM-dd'),
      invoice.status,
      invoice.total.toFixed(2),
      invoice.currency || baseCurrency,
      (invoice.exchange_rate || 1).toString()
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

  const handleStatsScroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('stats-container');
    if (container) {
      const scrollAmount = 320;
      if (direction === 'left') {
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
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
              <p className="text-gray-600 mt-1">
                Manage your invoices and track payments
                {isUKUser && ' • UK VAT compliant'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Link
                to="/invoices/new"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Link>

              {/* Quick Action Icons */}
              <button
                onClick={() => navigate('/invoices/templates')}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm"
                title="Invoice Templates"
              >
                <FileText className="h-5 w-5 text-gray-600" />
              </button>

              <button
                onClick={() => navigate('/invoices/recurring')}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm"
                title="Recurring Invoices"
              >
                <CalendarSync className="h-5 w-5 text-gray-600" />
              </button>

              <button
                onClick={() => navigate('/credit-notes')}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm"
                title="Credit Notes"
              >
                <CreditCard className="h-5 w-5 text-gray-600" />
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm"
                title="Invoice Settings"
              >
                <Settings className="h-5 w-5 text-gray-600" />
              </button>

              {/* More Actions Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm"
                >
                  <span className="text-gray-700">More</span>
                  <ChevronDown className={`h-4 w-4 ml-2 text-gray-500 transition-transform ${
                    showActionsDropdown ? 'rotate-180' : ''
                  }`} />
                </button>
                
                {showActionsDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowActionsDropdown(false)}
                    />

                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                      <button
                        onClick={() => {
                          navigate('/invoices/templates');
                          setShowActionsDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center transition-colors"
                      >
                        <FileText className="h-4 w-4 mr-3 text-gray-500" />
                        <span className="text-gray-700">Invoice Templates</span>
                      </button>

                      <button
                        onClick={() => {
                          navigate('/invoices/recurring');
                          setShowActionsDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center transition-colors"
                      >
                        <CalendarSync className="h-4 w-4 mr-3 text-gray-500" />
                        <span className="text-gray-700">Recurring Invoices</span>
                      </button>

                      <button
                        onClick={() => {
                          navigate('/credit-notes');
                          setShowActionsDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center transition-colors"
                      >
                        <CreditCard className="h-4 w-4 mr-3 text-gray-500" />
                        <span className="text-gray-700">Credit Notes</span>
                      </button>

                      <div className="border-t border-gray-100"></div>

                      <button
                        onClick={() => {
                          setShowSettings(true);
                          setShowActionsDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center transition-colors"
                      >
                        <Settings className="h-4 w-4 mr-3 text-gray-500" />
                        <span className="text-gray-700">Invoice Settings</span>
                      </button>

                      <button
                        onClick={() => {
                          exportToCSV();
                          setShowActionsDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center transition-colors"
                      >
                        <Download className="h-4 w-4 mr-3 text-gray-500" />
                        <span className="text-gray-700">Export All</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Stats Cards - Swipeable on mobile */}
        <div className="relative">
          <div className="flex items-center">
            <button
              onClick={() => handleStatsScroll('left')}
              className="hidden lg:block absolute left-0 z-10 p-2 bg-white rounded-full shadow-lg hover:shadow-xl transition-all"
              style={{ transform: 'translateX(-50%)' }}
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            
            <div 
              id="stats-container"
              className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white flex-shrink-0 snap-start" style={{ minWidth: '300px' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                    <FileText className="h-6 w-6" />
                  </div>
                  <span className="text-2xl font-bold">{stats.totalInvoices}</span>
                </div>
                <p className="text-indigo-100 text-sm">Total Invoices</p>
                <p className="text-indigo-200 text-xs mt-1">
                  Avg: {formatCurrency(stats.averageInvoiceValue, baseCurrency)}
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white flex-shrink-0 snap-start" style={{ minWidth: '300px' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <span className="text-xl font-bold">
                    {formatCurrency(stats.paidAmount, baseCurrency)}
                  </span>
                </div>
                <p className="text-emerald-100 text-sm">Paid</p>
                <p className="text-emerald-200 text-xs mt-1">
                  {stats.totalAmount > 0 ? Math.round((stats.paidAmount / stats.totalAmount) * 100) : 0}% collected
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white flex-shrink-0 snap-start" style={{ minWidth: '300px' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                    <Clock className="h-6 w-6" />
                  </div>
                  <span className="text-xl font-bold">
                    {formatCurrency(stats.pendingAmount, baseCurrency)}
                  </span>
                </div>
                <p className="text-amber-100 text-sm">Pending</p>
                <p className="text-amber-200 text-xs mt-1">Awaiting payment</p>
              </div>
              
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white flex-shrink-0 snap-start" style={{ minWidth: '300px' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <span className="text-xl font-bold">
                    {formatCurrency(stats.overdueAmount, baseCurrency)}
                  </span>
                </div>
                <p className="text-red-100 text-sm">Overdue</p>
                <p className="text-red-200 text-xs mt-1">Requires attention</p>
              </div>
              
              {/* Draft Invoices Card */}
              <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl p-6 text-white flex-shrink-0 snap-start" style={{ minWidth: '300px' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                    <Edit className="h-6 w-6" />
                  </div>
                  <span className="text-xl font-bold">
                    {formatCurrency(stats.draftAmount, baseCurrency)}
                  </span>
                </div>
                <p className="text-gray-100 text-sm">Draft</p>
                <p className="text-gray-200 text-xs mt-1">
                  {stats.draftCount} invoice{stats.draftCount !== 1 ? 's' : ''}
                </p>
              </div>
              
              {/* Credit Notes Card - Only show if there are credits */}
              {stats.totalCredited > 0 && (
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white flex-shrink-0 snap-start" style={{ minWidth: '300px' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                      <ArrowDownLeft className="h-6 w-6" />
                    </div>
                    <span className="text-xl font-bold">
                      {formatCurrency(stats.totalCredited, baseCurrency)}
                    </span>
                  </div>
                  <p className="text-purple-100 text-sm">Total Credited</p>
                  <p className="text-purple-200 text-xs mt-1">
                    {stats.invoicesWithCredits} invoices
                  </p>
                </div>
              )}
            </div>
            
            <button
              onClick={() => handleStatsScroll('right')}
              className="hidden lg:block absolute right-0 z-10 p-2 bg-white rounded-full shadow-lg hover:shadow-xl transition-all"
              style={{ transform: 'translateX(50%)' }}
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Multi-Currency Summary */}
        {uniqueCurrencies.length > 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Globe className="h-5 w-5 mr-2 text-indigo-600" />
              Multi-Currency Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Object.entries(stats.currencyBreakdown).map(([currency, data]) => (
                <div key={currency} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{CURRENCY_FLAGS[currency] || '🌍'}</span>
                    <span className="text-sm font-semibold text-gray-700">{currency}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(data.total, currency)}
                  </p>
                  <p className="text-xs text-gray-500">{data.count} invoice(s)</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search invoices in ${getDateRangeDisplayName(dateRange)}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />

              {/* Search Scope Badge */}
              {searchTerm && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm font-medium border border-indigo-200">
                    <Calendar className="h-3 w-3" />
                    <span className="hidden sm:inline">{getDateRangeDisplayName(dateRange)}</span>
                    <span className="sm:hidden">Period</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all relative"
            >
              <Filter className="h-5 w-5 mr-2" />
              Filters
              {hasActiveFilters() && (
                <span className="ml-2 px-2 py-0.5 bg-indigo-600 text-white text-xs font-semibold rounded-full">
                  {[searchTerm, statusFilter !== 'all', currencyFilter !== 'all', clientFilter !== 'all', categoryFilter !== 'all', typeFilter !== 'all', dateRange !== 'this-month', sortBy !== 'date'].filter(Boolean).length}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 ml-2 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Clear All Filters Button */}
            {hasActiveFilters() && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-200"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </button>
            )}
          </div>

          {/* Active Filter Chips */}
          {hasActiveFilters() && (
            <div className="flex flex-wrap gap-2 mt-4">
              {searchTerm && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm">
                  <Search className="h-3 w-3" />
                  <span className="font-medium">Search:</span>
                  <span>{searchTerm}</span>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-1 hover:bg-indigo-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {statusFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm">
                  <span className="font-medium">Status:</span>
                  <span className="capitalize">{statusFilter}</span>
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="ml-1 hover:bg-indigo-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {currencyFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm">
                  <span className="font-medium">Currency:</span>
                  <span>{currencyFilter}</span>
                  <button
                    onClick={() => setCurrencyFilter('all')}
                    className="ml-1 hover:bg-indigo-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {clientFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm">
                  <Users className="h-3 w-3" />
                  <span className="font-medium">Client:</span>
                  <span>{uniqueClients.find(c => c.id === clientFilter)?.name}</span>
                  <button
                    onClick={() => setClientFilter('all')}
                    className="ml-1 hover:bg-indigo-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {categoryFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm">
                  <Tag className="h-3 w-3" />
                  <span className="font-medium">Category:</span>
                  <span>{categories.find(c => c.id === categoryFilter)?.name}</span>
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className="ml-1 hover:bg-indigo-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {typeFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm">
                  <RefreshCw className="h-3 w-3" />
                  <span className="font-medium">Type:</span>
                  <span className="capitalize">{typeFilter}</span>
                  <button
                    onClick={() => setTypeFilter('all')}
                    className="ml-1 hover:bg-indigo-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {dateRange !== 'this-month' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm">
                  <Calendar className="h-3 w-3" />
                  <span className="font-medium">Date:</span>
                  <span>{getDateRangeDisplayName(dateRange)}</span>
                  <button
                    onClick={() => setDateRange('this-month')}
                    className="ml-1 hover:bg-indigo-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {sortBy !== 'date' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm">
                  <TrendingUp className="h-3 w-3" />
                  <span className="font-medium">Sort:</span>
                  <span className="capitalize">{sortBy === 'dueDate' ? 'Due Date' : sortBy}</span>
                  <button
                    onClick={() => setSortBy('date')}
                    className="ml-1 hover:bg-indigo-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Search Results Indicator */}
          {(searchTerm || filteredInvoices.length !== invoices.length) && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200/50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-indigo-700">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                  <span className="font-semibold text-sm">
                    {getSearchResultsMessage().primary}
                  </span>
                </div>
                <div className="text-sm text-indigo-600">
                  {getSearchResultsMessage().secondary}
                </div>
              </div>

              {/* Expand Search Option */}
              {getSearchResultsMessage().showExpandOption && (
                <button
                  onClick={searchAllTime}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm text-indigo-600 rounded-lg hover:bg-white transition-all text-sm font-medium shadow-sm hover:shadow-md border border-indigo-200/50"
                >
                  <Search className="h-3 w-3" />
                  <span>Search All Time</span>
                </button>
              )}
            </div>
          )}
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7 gap-4 mt-4 pt-4 border-t">
              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDateRange(value);
                    if (value === 'custom') {
                      setShowCustomDatePicker(true);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="today">Today</option>
                  <option value="this-week">This Week</option>
                  <option value="this-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="this-year">This Year</option>
                  <option value="last-year">Last Year</option>
                  <option value="custom">Custom Range</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              {/* Custom Date Range Picker */}
              {showCustomDatePicker && (
                <div className="col-span-full">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-blue-900">Select Custom Date Range</h4>
                      <button
                        onClick={() => {
                          setShowCustomDatePicker(false);
                          setDateRange('this-month');
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCustomDateRange}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => {
                          setCustomStartDate('');
                          setCustomEndDate('');
                          setShowCustomDatePicker(false);
                          setDateRange('this-month');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Clients</option>
                  {uniqueClients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Currencies</option>
                  {uniqueCurrencies.map(currency => (
                    <option key={currency} value={currency}>
                      {CURRENCY_FLAGS[currency]} {currency}
                    </option>
                  ))}
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
                  <option value="amount">Amount (Base)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Action Toolbar */}
        {selectedItems.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
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

        {/* Enhanced Invoice Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
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
                    const totalTax = calculateInvoiceTaxTotal(invoice);
                    
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
                              {invoice.has_credit_notes && (
                                <div className="flex items-center text-xs text-purple-600 mt-1">
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Has credit notes
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
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              {invoice.currency && invoice.currency !== baseCurrency && (
                                <span className="text-lg" title={invoice.currency}>
                                  {CURRENCY_FLAGS[invoice.currency] || '🌍'}
                                </span>
                              )}
                              <span className="text-sm font-semibold text-gray-900">
                                {formatCurrency(invoice.total, invoice.currency || baseCurrency)}
                              </span>
                            </div>
                            {invoice.currency && invoice.currency !== baseCurrency && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                ≈ {formatCurrency(invoice.base_amount || invoice.total, baseCurrency)}
                                {invoice.exchange_rate && invoice.exchange_rate !== 1 && (
                                  <span className="ml-1 text-gray-400">
                                    (@{invoice.exchange_rate})
                                  </span>
                                )}   
                              </div>
                            )}
                            {totalTax > 0 && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {isUKUser ? 'VAT' : 'Tax'}: {formatCurrency(totalTax, invoice.currency || baseCurrency)}
                                {invoice.tax_rate > 0 && ` (${invoice.tax_rate}%)`}
                              </div>
                            )}
                            {invoice.has_credit_notes && (
  <div className="flex items-center text-xs text-purple-600 mt-0.5">
    <ArrowDownLeft className="h-3 w-3 mr-1" />
    {formatCurrency(invoice.total_credited || 0, invoice.currency || baseCurrency)} credited
  </div>
)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(invoice.status)}`}>
                              {getStatusIcon(invoice.status)}
                              {invoice.status}
                            </span>
                            {(invoice.status === 'paid' || invoice.status === 'canceled') && (
                              <span title="Locked for compliance">
                                <Shield className="h-3.5 w-3.5 text-gray-400" />
                              </span>
                            )}
                            {isUKUser && invoice.vat_locked_at && (
                              <span title="Submitted in VAT return">
                                <Lock className="h-3.5 w-3.5 text-gray-400" />
                              </span>
                            )}
                          </div>
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
                            {invoice.status !== 'paid' && invoice.status !== 'canceled' && !invoice.vat_locked_at ? (
                              <Link
                                to={`/invoices/${invoice.id}/edit`}
                                className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Link>
                            ) : (
                              <span 
                                className="p-2 text-gray-400 cursor-not-allowed" 
                                title="Locked for compliance"
                              >
                                <Edit className="h-4 w-4" />
                              </span>
                            )}
                            
                            {/* Action Menu */}
                            <div className="relative action-menu-container">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowActionMenu(showActionMenu === invoice.id ? null : invoice.id);
                                }}
                                className="action-menu-trigger p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
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
                                  
                                  {invoice.has_credit_notes && (
                                    <>
                                      <hr className="my-1" />
                                      <button
                                        onClick={() => {
                                          navigate(`/credit-notes?invoice=${invoice.id}`);
                                          setShowActionMenu(null);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                                      >
                                        <CreditCard className="h-4 w-4 mr-3 text-gray-500" />
                                        View Credit Notes
                                      </button>
                                    </>
                                  )}
                                  
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
                                    disabled={invoice.status === 'paid' || invoice.status === 'canceled' || !!invoice.vat_locked_at}
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center ${
                                      invoice.status === 'paid' || invoice.status === 'canceled' || invoice.vat_locked_at
                                        ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                                        : 'text-red-600 hover:bg-red-50'
                                    }`}
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
                          {searchTerm || statusFilter !== 'all' || currencyFilter !== 'all' || clientFilter !== 'all' || categoryFilter !== 'all' || typeFilter !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Create your first invoice to get started'}
                        </p>
                        {!searchTerm && statusFilter === 'all' && currencyFilter === 'all' && clientFilter === 'all' && categoryFilter === 'all' && typeFilter === 'all' && (
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
        
        {/* Pagination */}
        {filteredInvoices.length > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-6 rounded-lg">
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
        onConfirm={() => {
          if (invoiceToDelete) {
            deleteMutation.mutate(invoiceToDelete.id);
          }
          setShowDeleteWarning(false);
          setInvoiceToDelete(null);
        }}
        onCancel={() => {
          setShowDeleteWarning(false);
          setInvoiceToDelete(null);
        }}
      />
      
      {/* Settings Modal */}
      {showSettings && (
        <InvoiceSettings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};