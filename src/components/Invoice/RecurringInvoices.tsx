// src/components/Invoice/RecurringInvoices.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, RefreshCw, Play, Pause, Edit, Trash2, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { format, addDays, addWeeks, addMonths, parseISO } from 'date-fns';

interface RecurringInvoice {
  id: string;
  user_id: string;
  client_id: string;
  client?: { name: string };
  template_data: any;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  next_date: string;
  last_generated: string | null;
  is_active: boolean;
  created_at: string;
}

export const RecurringInvoices: React.FC = () => {
  const { user } = useAuth();
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  useEffect(() => {
    if (user) {
      loadRecurringInvoices();
    }
  }, [user]);

  const loadRecurringInvoices = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from('recurring_invoices')
        .select(`
          *,
          client:clients(name)
        `)
        .eq('user_id', user.id)
        .order('next_date', { ascending: true });
      
      if (filter === 'active') {
        query = query.eq('is_active', true);
      } else if (filter === 'paused') {
        query = query.eq('is_active', false);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setRecurringInvoices(data || []);
    } catch (err: any) {
      console.error('Error loading recurring invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('recurring_invoices')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      await loadRecurringInvoices();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const deleteRecurring = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this recurring invoice?')) return;
    
    try {
      const { error } = await supabase
        .from('recurring_invoices')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      await loadRecurringInvoices();
    } catch (err: any) {
      alert('Error deleting recurring invoice: ' + err.message);
    }
  };

  const getNextInvoiceDate = (lastDate: string, frequency: string) => {
    const date = parseISO(lastDate);
    switch (frequency) {
      case 'weekly': return addWeeks(date, 1);
      case 'biweekly': return addWeeks(date, 2);
      case 'monthly': return addMonths(date, 1);
      case 'quarterly': return addMonths(date, 3);
      case 'yearly': return addMonths(date, 12);
      default: return date;
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: { [key: string]: string } = {
      weekly: 'Every Week',
      biweekly: 'Every 2 Weeks',
      monthly: 'Every Month',
      quarterly: 'Every 3 Months',
      yearly: 'Every Year'
    };
    return labels[frequency] || frequency;
  };

  const filteredInvoices = recurringInvoices.filter(inv => {
    if (filter === 'all') return true;
    if (filter === 'active') return inv.is_active;
    if (filter === 'paused') return !inv.is_active;
    return true;
  });

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Recurring Invoices</h1>
        <Link
          to="/invoices/recurring/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Recurring Invoice
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow p-1 inline-flex">
        {['all', 'active', 'paused'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-4 py-2 rounded-md capitalize transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Recurring Invoices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInvoices.length > 0 ? (
          filteredInvoices.map((recurring) => (
            <div
              key={recurring.id}
              className={`bg-white rounded-lg shadow p-6 ${
                !recurring.is_active ? 'opacity-75' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {recurring.client?.name || 'No Client'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {getFrequencyLabel(recurring.frequency)}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    recurring.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {recurring.is_active ? 'Active' : 'Paused'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm">
                  <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Next Invoice:</span>
                  <span className="ml-2 font-medium">
                    {format(parseISO(recurring.next_date), 'MMM dd, yyyy')}
                  </span>
                </div>
                {recurring.last_generated && (
                  <div className="flex items-center text-sm">
                    <Clock className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Last Generated:</span>
                    <span className="ml-2">
                      {format(parseISO(recurring.last_generated), 'MMM dd, yyyy')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleStatus(recurring.id, recurring.is_active)}
                    className={`p-2 rounded-lg transition-colors ${
                      recurring.is_active
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {recurring.is_active ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <Link
                    to={`/invoices/recurring/edit/${recurring.id}`}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => deleteRecurring(recurring.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    ${recurring.template_data.total || 0}
                  </p>
                  <p className="text-xs text-gray-500">per invoice</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recurring invoices found</p>
            <Link
              to="/invoices/recurring/new"
              className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-700"
            >
              Create your first recurring invoice
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
