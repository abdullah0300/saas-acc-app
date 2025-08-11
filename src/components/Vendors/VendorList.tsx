import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin,
  TrendingUp,
  DollarSign,
  Receipt,
  Calendar,
  Building2
} from 'lucide-react';
import { getVendors, deleteVendor, getExpenses } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';
import { Vendor, Expense } from '../../types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useSettings } from '../../contexts/SettingsContext';

interface VendorWithMetrics extends Vendor {
  totalSpent: number;
  expenseCount: number;
  lastActivityDate: string;
  avgPaymentTerms: number;
  status: 'active' | 'inactive';
}

export const VendorList: React.FC = () => {
  const { formatCurrency, baseCurrency } = useSettings();
  const [vendors, setVendors] = useState<VendorWithMetrics[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<VendorWithMetrics[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const { user } = useAuth();

  // Stats
  const [stats, setStats] = useState({
    totalVendors: 0,
    activeVendors: 0,
    totalSpent: 0,
    avgVendorSpend: 0
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    filterVendors();
  }, [vendors, searchTerm, filterStatus]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const [vendorList, expenseList] = await Promise.all([
        getVendors(user.id),
        getExpenses(user.id)
      ]);
      
      setExpenses(expenseList);
      
      // Process vendors with metrics
      const enrichedVendors = processVendorMetrics(vendorList, expenseList);
      setVendors(enrichedVendors);
      setFilteredVendors(enrichedVendors);
      
      // Calculate stats
      calculateStats(enrichedVendors);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const processVendorMetrics = (
    vendorList: Vendor[], 
    expenseList: Expense[]
  ): VendorWithMetrics[] => {
    return vendorList.map(vendor => {
      const vendorExpenses = expenseList.filter(exp => exp.vendor_id === vendor.id);
      
      const totalSpent = vendorExpenses.reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0);
      
      // Get last activity
      const allDates = [
        ...vendorExpenses.map(exp => exp.date),
        vendor.created_at
      ];
      const lastActivityDate = allDates.sort((a, b) => 
        new Date(b).getTime() - new Date(a).getTime()
      )[0];
      
      // Determine status (active if any expense in last 90 days)
      const status: 'active' | 'inactive' = vendorExpenses.some(exp => 
        new Date(exp.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      ) ? 'active' : 'inactive';
      
      return {
        ...vendor,
        totalSpent,
        expenseCount: vendorExpenses.length,
        lastActivityDate,
        avgPaymentTerms: vendor.payment_terms || 30,
        status
      };
    });
  };

  const calculateStats = (vendorList: VendorWithMetrics[]) => {
    const activeVendors = vendorList.filter(v => v.status === 'active').length;
    const totalSpent = vendorList.reduce((sum, v) => sum + v.totalSpent, 0);
    const avgVendorSpend = vendorList.length > 0 ? totalSpent / vendorList.length : 0;
    
    setStats({
      totalVendors: vendorList.length,
      activeVendors,
      totalSpent,
      avgVendorSpend
    });
  };

  const filterVendors = () => {
    let filtered = vendors;
    
    if (searchTerm) {
      filtered = filtered.filter(vendor => 
        vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.phone?.includes(searchTerm)
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(vendor => vendor.status === filterStatus);
    }
    
    setFilteredVendors(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;
    
    try {
      await deleteVendor(id);
      await loadData();
    } catch (err: any) {
      alert('Error deleting vendor: ' + err.message);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64">Loading...</div>;
  if (error) return <div className="text-red-600 p-4">Error: {error}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
        <Link
          to="/vendors/new"
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Vendor
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Vendors</p>
              <p className="text-2xl font-bold">{stats.totalVendors}</p>
            </div>
            <Building2 className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Vendors</p>
              <p className="text-2xl font-bold">{stats.activeVendors}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Spent ({baseCurrency})</p> 
              <p className="text-2xl font-bold">{formatCurrency(stats.totalSpent, baseCurrency)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-indigo-500" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Spend/Vendor ({baseCurrency})</p>
             <p className="text-2xl font-bold">{formatCurrency(stats.avgVendorSpend, baseCurrency)}</p>
            </div>
            <Receipt className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Spent ({baseCurrency})
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expenses
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Activity
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredVendors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No vendors found. Add your first vendor to get started.
                </td>
              </tr>
            ) : (
              filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                      {vendor.tax_id && (
                        <div className="text-sm text-gray-500">Tax ID: {vendor.tax_id}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {vendor.email && (
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-1 text-gray-400" />
                          {vendor.email}
                        </div>
                      )}
                      {vendor.phone && (
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-1 text-gray-400" />
                          {vendor.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(vendor.totalSpent, baseCurrency)}
                  </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{vendor.expenseCount}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      vendor.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {vendor.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(parseISO(vendor.lastActivityDate), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/vendors/${vendor.id}/edit`}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <Edit className="h-4 w-4 inline" />
                    </Link>
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};