import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  UserPlus,
  Search,
  Crown,
  LogIn,
  Calendar,
  CreditCard
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

interface UserWithSubscription {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  user_metadata: any;
  subscription?: {
    plan: string;
    status: string;
  };
  profile?: {
    full_name: string;
    company_name: string;
  };
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  newThisMonth: number;
  freeUsers: number;
  paidUsers: number;
  mrr: number;
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    newThisMonth: 0,
    freeUsers: 0,
    paidUsers: 0,
    mrr: 0,
  });
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    console.log('[AdminDashboard] 🚀 Starting to load dashboard data...');
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadUsers(),
      ]);
      console.log('[AdminDashboard] ✅ Dashboard data loaded successfully');
    } catch (error) {
      console.error('[AdminDashboard] ❌ Error loading admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    console.log('[AdminDashboard] 📊 Loading stats...');

    // Get user settings count as proxy for total users
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('user_id, created_at');

    console.log('[AdminDashboard] User settings response:', {
      count: userSettings?.length,
      error: settingsError,
      sample: userSettings?.[0]
    });

    if (settingsError) {
      console.error('[AdminDashboard] ❌ Error fetching user settings:', settingsError);
      return;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalUsers = userSettings?.length || 0;
    console.log('[AdminDashboard] Total users:', totalUsers);

    // Get subscription stats
    const { data: subscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select('plan, status, user_id, created_at');

    console.log('[AdminDashboard] Subscriptions response:', {
      count: subscriptions?.length,
      error: subsError,
      sample: subscriptions?.[0]
    });

    const newThisMonth = subscriptions?.filter(s =>
      new Date(s.created_at) > firstOfMonth
    ).length || 0;

    const freeUsers = subscriptions?.filter(s => s.plan === 'simple_start').length || 0;
    const paidUsers = subscriptions?.filter(s => s.plan === 'plus' && s.status === 'active').length || 0;

    console.log('[AdminDashboard] Subscription breakdown:', {
      newThisMonth,
      freeUsers,
      paidUsers
    });

    // Calculate MRR based on actual plan prices
    const planPrices: Record<string, number> = {
      'simple_start': 0,
      'plus': 25,
    };

    const mrr = subscriptions?.reduce((sum, sub) => {
      if (sub.status === 'active') {
        return sum + (planPrices[sub.plan] || 0);
      }
      return sum;
    }, 0) || 0;

    // Estimate active users (users with data in last 30 days)
    // Get actual user_ids to count DISTINCT users
    const { data: recentIncomes } = await supabase
      .from('income')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { data: recentExpenses } = await supabase
      .from('expenses')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Create a Set to get unique user IDs
    const activeUserIds = new Set<string>();
    recentIncomes?.forEach(income => activeUserIds.add(income.user_id));
    recentExpenses?.forEach(expense => activeUserIds.add(expense.user_id));

    const activeUsers = activeUserIds.size;
    const inactiveUsers = totalUsers - activeUsers;

    console.log('[AdminDashboard] Active users calculation:', {
      recentIncomeRecords: recentIncomes?.length || 0,
      recentExpenseRecords: recentExpenses?.length || 0,
      uniqueActiveUsers: activeUsers,
      activeUserIds: Array.from(activeUserIds)
    });

    const finalStats = {
      totalUsers,
      activeUsers,
      inactiveUsers,
      newThisMonth,
      freeUsers,
      paidUsers,
      mrr,
    };

    console.log('[AdminDashboard] ✅ Final stats calculated:', finalStats);

    setStats(finalStats);
  };

  const loadUsers = async () => {
    console.log('[AdminDashboard] 👥 Loading users...');

    // Get user settings (just to get list of user IDs)
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('user_id, created_at');

    console.log('[AdminDashboard] User settings:', {
      count: userSettings?.length,
      error: settingsError,
      sample: userSettings?.[0]
    });

    // Get profiles (where name and company are stored)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, email');

    console.log('[AdminDashboard] Profiles:', {
      count: profiles?.length,
      error: profilesError,
      sample: profiles?.[0],
      allProfiles: profiles
    });

    // Get subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select('user_id, plan, status');

    console.log('[AdminDashboard] Subscriptions:', {
      count: subscriptions?.length,
      error: subsError,
      sample: subscriptions?.[0]
    });

    // Combine data from all tables
    const combinedUsers: UserWithSubscription[] = (userSettings || []).map(setting => {
      const profile = profiles?.find(p => p.id === setting.user_id);
      const subscription = subscriptions?.find(s => s.user_id === setting.user_id);

      console.log('[AdminDashboard] Matching user:', {
        user_id: setting.user_id,
        foundProfile: !!profile,
        profileData: profile,
        foundSubscription: !!subscription
      });

      return {
        id: setting.user_id,
        email: profile?.email || '',
        created_at: setting.created_at,
        last_sign_in_at: '',
        user_metadata: {},
        profile: {
          full_name: profile?.full_name || '',
          company_name: profile?.company_name || '',
        },
        subscription: subscription,
      };
    });

    console.log('[AdminDashboard] ✅ Combined users array:', {
      count: combinedUsers.length,
      sample: combinedUsers[0]
    });

    setUsers(combinedUsers);
  };

  const handleImpersonate = async (targetUserId: string) => {
    if (!user) return;

    // Log impersonation start
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'impersonation_start',
      entity_type: 'user',
      entity_id: targetUserId,
      metadata: {
        admin_id: user.id,
        reason: 'customer_support',
        timestamp: new Date().toISOString(),
      },
    });

    // Store impersonation in localStorage
    localStorage.setItem('impersonating_user_id', targetUserId);
    localStorage.setItem('admin_user_id', user.id);

    // Redirect to dashboard
    window.location.href = '/dashboard';
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.profile?.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  console.log('[AdminDashboard] 🎨 Rendering with:', {
    loading,
    statsTotal: stats.totalUsers,
    usersCount: users.length,
    filteredUsersCount: filteredUsers.length,
    searchQuery
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
        <p className="text-gray-600">Platform overview and user management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500 rounded-xl">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-blue-900 mb-1">Total Users</h3>
          <p className="text-3xl font-bold text-blue-900">{stats.totalUsers}</p>
        </div>

        {/* Active Users */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500 rounded-xl">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-green-900 mb-1">Active Users</h3>
          <p className="text-3xl font-bold text-green-900">{stats.activeUsers}</p>
          <p className="text-xs text-green-700 mt-1">Activity last 30 days</p>
        </div>

        {/* New This Month */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500 rounded-xl">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-purple-900 mb-1">New This Month</h3>
          <p className="text-3xl font-bold text-purple-900">{stats.newThisMonth}</p>
        </div>

        {/* MRR */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-500 rounded-xl">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-amber-900 mb-1">MRR</h3>
          <p className="text-3xl font-bold text-amber-900">${stats.mrr}</p>
          <p className="text-xs text-amber-700 mt-1">{stats.paidUsers} paying users</p>
        </div>
      </div>

      {/* User List */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Plan</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Created</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {u.profile?.full_name || 'No name'}
                      </p>
                      <p className="text-sm text-gray-600">{u.email || u.id}</p>
                      {u.profile?.company_name && (
                        <p className="text-xs text-gray-500">{u.profile.company_name}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      u.subscription?.plan === 'plus'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {u.subscription?.plan || 'simple_start'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      u.subscription?.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {u.subscription?.status || 'inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600">
                    {u.created_at
                      ? format(new Date(u.created_at), 'MMM dd, yyyy')
                      : 'Unknown'}
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => handleImpersonate(u.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium"
                    >
                      <LogIn className="h-4 w-4" />
                      Login as User
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No users found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
