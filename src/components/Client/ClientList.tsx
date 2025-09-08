import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  Users,
  UserPlus,
  Building,
  TrendingUp,
  Calendar,
  DollarSign,
  FileText,
  Filter,
  Download,
  MoreVertical,
  ChevronDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity
} from 'lucide-react';
import { getClients, deleteClient, getInvoices, getIncomes } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Client, Invoice, Income } from '../../types';
import { format, parseISO, differenceInDays } from 'date-fns';

interface ClientWithMetrics extends Client {
  totalRevenue: number;
  invoiceCount: number;
  paidInvoices: number;
  pendingAmount: number;
  lastActivityDate: string | null;
  avgPaymentDays: number;
  status: 'active' | 'inactive' | 'overdue';
  creditAmount: number; // Added to track credit amounts
}

export const ClientList: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  const [filteredClients, setFilteredClients] = useState<ClientWithMetrics[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'overdue'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'revenue' | 'recent'>('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { businessData, businessDataLoading, refreshBusinessData } = useData();
const { clients: rawClients } = businessData;
const [clients, setClients] = useState<ClientWithMetrics[]>([]);
const loading = businessDataLoading;

  // Stats
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    totalRevenue: 0,
    avgClientValue: 0
  });

  useEffect(() => {
  if (rawClients.length > 0) {
    processClientData();
  }
}, [user, rawClients]); // Now depends on cached data

  useEffect(() => {
    filterAndSortClients();
  }, [searchTerm, statusFilter, sortBy, clients]);

  const processClientData = async () => {
  if (!user || !rawClients.length) return;
  
  try {
    // We don't need setLoading anymore since we use businessDataLoading
    // setLoading(true); // ❌ Remove this
    
    // Load additional data needed for metrics
    const [invoiceList, incomeList] = await Promise.all([
      getInvoices(user.id),
      getIncomes(user.id)
    ]);
    
    setInvoices(invoiceList); // Store for later use
    setIncomes(incomeList);   // Store for later use
    
    // Process client metrics using existing function
    const enrichedClients = processClientMetrics(rawClients, invoiceList, incomeList);
    setClients(enrichedClients);
    
    // Calculate stats
    calculateStats(enrichedClients);
  } catch (err: any) {
    setError(err.message);
  }
  // No finally block needed since we're not managing loading state
};

  const processClientMetrics = (
    clientList: Client[], 
    invoiceList: Invoice[], 
    incomeList: Income[]
  ): ClientWithMetrics[] => {
    return clientList.map(client => {
      const clientInvoices = invoiceList.filter(inv => inv.client_id === client.id);
      const clientIncomes = incomeList.filter(inc => inc.client_id === client.id);
      
      // FIXED: Calculate total revenue from income entries only (includes negatives for credits)
      // This avoids double-counting invoice revenue
      const totalRevenue = clientIncomes
        .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0);
      
      // Calculate credit amount separately for display
      const creditAmount = Math.abs(clientIncomes
        .filter(inc => inc.credit_note_id)
        .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0));
      
      // Calculate pending (unpaid invoice amounts)
      // Replace lines 119-136 with this:
const pendingAmount = clientInvoices
  .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
  .reduce((sum, inv) => sum + (inv.base_amount || inv.total), 0);
      
      const paidInvoices = clientInvoices.filter(inv => inv.status === 'paid').length;
      
      // Calculate average payment days
      const paidInvoicesWithDates = clientInvoices.filter(
        inv => inv.status === 'paid' && inv.paid_date
      );
      
      const avgPaymentDays = paidInvoicesWithDates.length > 0
        ? paidInvoicesWithDates.reduce((sum, inv) => {
            const days = differenceInDays(
              parseISO(inv.paid_date!),
              parseISO(inv.date)
            );
            return sum + days;
          }, 0) / paidInvoicesWithDates.length
        : 0;
      
      // Get last activity from both invoices and income
      const allDates = [
        ...clientInvoices.map(inv => inv.date),
        ...clientIncomes.map(inc => inc.date),
        client.created_at
      ];
      const lastActivityDate = allDates.sort((a, b) => 
        new Date(b).getTime() - new Date(a).getTime()
      )[0];
      
      // Determine status
      let status: 'active' | 'inactive' | 'overdue' = 'inactive';
      if (clientInvoices.some(inv => inv.status === 'overdue')) {
        status = 'overdue';
      } else if (
        clientInvoices.some(inv => 
          new Date(inv.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        ) || 
        clientIncomes.some(inc => 
          new Date(inc.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        )
      ) {
        status = 'active';
      }
      
      return {
        ...client,
        totalRevenue,
        invoiceCount: clientInvoices.length,
        paidInvoices,
        pendingAmount,
        lastActivityDate,
        avgPaymentDays,
        status,
        creditAmount
      };
    });
  };

  const calculateStats = (clientList: ClientWithMetrics[]) => {
    const activeClients = clientList.filter(c => c.status === 'active').length;
    const totalRevenue = clientList.reduce((sum, c) => sum + c.totalRevenue, 0);
    
    // FIXED: Calculate average only among clients with revenue
    const clientsWithRevenue = clientList.filter(c => c.totalRevenue > 0);
    const avgClientValue = clientsWithRevenue.length > 0 
      ? totalRevenue / clientsWithRevenue.length 
      : 0;
    
    setStats({
      totalClients: clientList.length,
      activeClients,
      totalRevenue,
      avgClientValue
    });
  };

  const filterAndSortClients = () => {
    let filtered = [...clients];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.includes(searchTerm)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(client => client.status === statusFilter);
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'revenue':
          return b.totalRevenue - a.totalRevenue;
        case 'recent':
          return new Date(b.lastActivityDate || 0).getTime() - 
                 new Date(a.lastActivityDate || 0).getTime();
        default:
          return 0;
      }
    });
    
    setFilteredClients(filtered);
  };

  const handleDelete = async (id: string) => {
  if (!window.confirm('Are you sure you want to delete this client? All associated data will be preserved.')) return;
  
  try {
    await deleteClient(id);
    await refreshBusinessData(); // ✅ Refresh cache instead
  } catch (err: any) {
    alert('Error deleting client: ' + err.message);
  }
};

  const exportClients = () => {
    // FIXED: Enhanced CSV export with more data
    const headers = [
      'Name', 
      'Company',
      'Email', 
      'Phone', 
      `Total Revenue (${baseCurrency})`,
      `Pending Amount (${baseCurrency})`,
      `Credits Applied (${baseCurrency})`,
      'Total Invoices',
      'Paid Invoices', 
      'Avg Payment Days',
      'Status', 
      'Last Activity'
    ];
    
    const data = filteredClients.map(client => [
      client.name,
      client.company_name || '',
      client.email || '',
      client.phone || '',
      client.totalRevenue.toFixed(2),
      client.pendingAmount.toFixed(2),
      client.creditAmount.toFixed(2),
      client.invoiceCount.toString(),
      client.paidInvoices.toString(),
      Math.round(client.avgPaymentDays).toString(),
      client.status,
      client.lastActivityDate ? format(parseISO(client.lastActivityDate), 'yyyy-MM-dd') : ''
    ]);
    
    const csv = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-3.5 w-3.5" />;
      case 'inactive':
        return <Clock className="h-3.5 w-3.5" />;
      case 'overdue':
        return <AlertCircle className="h-3.5 w-3.5" />;
      default:
        return <Clock className="h-3.5 w-3.5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading clients...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
              <p className="text-gray-600 mt-1">Manage your client relationships and track performance</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={exportClients}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
              <Link
                to="/clients/new"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Client
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                <Users className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold">{stats.totalClients}</span>
            </div>
            <p className="text-indigo-100 text-sm">Total Clients</p>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                <Activity className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold">{stats.activeClients}</span>
            </div>
            <p className="text-emerald-100 text-sm">Active Clients</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                <DollarSign className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold">{formatCurrency(stats.totalRevenue, baseCurrency)}</span>
            </div>
            <p className="text-purple-100 text-sm">Total Revenue ({baseCurrency})</p>
          </div>
          
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                <TrendingUp className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold">{formatCurrency(stats.avgClientValue, baseCurrency)}</span>
            </div>
            <p className="text-amber-100 text-sm">Avg Client Value ({baseCurrency})</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients by name, email, or phone..."
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="recent">Most Recent</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="revenue">Revenue (High to Low)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <div 
                key={client.id} 
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                {/* Client Header */}
                <div className="p-6 pb-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                          <h3 className="font-semibold text-gray-900 text-lg">{client.name}</h3>
                          {client.company_name && (
                            <p className="text-sm text-gray-600">{client.company_name}</p>
                          )}
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(client.status)}`}>
                          {getStatusIcon(client.status)}
                          {client.status}
                        </span>
                      </div>
                    </div>
                    
                    {/* Actions Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setSelectedClient(selectedClient === client.id ? null : client.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      
                      {selectedClient === client.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-10">
                          <Link
                            to={`/clients/edit/${client.id}`}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Client
                          </Link>
                          <Link
                            to={`/invoices/new?client=${client.id}`}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Create Invoice
                          </Link>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Contact Info */}
                  <div className="space-y-2">
                    {client.email && (
                      
                       <a href={`mailto:${client.email}`}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                      >
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{client.email}</span>
                      </a>
                    )}
                    {client.phone && (
                      
                       <a href={`tel:${client.phone}`}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                      >
                        <Phone className="h-4 w-4" />
                        <span>{client.phone}</span>
                      </a>
                    )}
                    {client.address && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{client.address}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Stats Section */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 pt-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Revenue</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(client.totalRevenue, baseCurrency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Invoices</p>
                      <p className="text-lg font-bold text-gray-900">
                        {client.invoiceCount}
                        <span className="text-sm text-gray-500 font-normal ml-1">
                          ({client.paidInvoices} paid)
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  {client.pendingAmount > 0 && (
                    <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-xs text-amber-600 font-medium">Pending Amount</p>
                      <p className="text-lg font-bold text-amber-700">{formatCurrency(client.pendingAmount, baseCurrency)}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {client.lastActivityDate 
                          ? `Active ${format(parseISO(client.lastActivityDate), 'MMM dd')}` 
                          : 'No activity'}
                      </span>
                    </div>
                    {client.avgPaymentDays > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{Math.round(client.avgPaymentDays)} days avg</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Quick Actions Bar */}
                <div className="bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between group-hover:bg-gray-50 transition-colors">
                  <Link
                    to={`/invoices?client=${client.id}`}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    View Invoices →
                  </Link>
                  <Link
                    to={`/invoices/new?client=${client.id}`}
                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                  >
                    <Plus className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No clients found</h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filters' 
                    : 'Get started by adding your first client'}
                </p>
                <Link
                  to="/clients/new"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 shadow-lg shadow-indigo-200"
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Add Your First Client
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};