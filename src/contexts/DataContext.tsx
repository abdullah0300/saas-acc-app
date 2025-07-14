// src/contexts/DataContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { subscriptionService } from '../services/subscriptionService';
import { getEffectiveUserId } from '../services/database';
import { getIncomes, getExpenses, getInvoices, getClients, getCategories, getBudgets } from '../services/database';
import { format, startOfMonth, endOfMonth, subYears } from 'date-fns';

interface DataContextType {
  subscription: any;
  userRole: 'owner' | 'admin' | 'member';
  teamId: string | null;
  effectiveUserId: string | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  // Business data
  businessData: {
    incomes: any[];
    expenses: any[];
    invoices: any[];
    clients: any[];
    categories: { income: any[]; expense: any[] };
    budgets: any[]; 
  };
  businessDataLoading: boolean;
  refreshBusinessData: () => Promise<void>;
  addIncomeToCache: (income: any) => void;
  addExpenseToCache: (expense: any) => void;
  addInvoiceToCache: (invoice: any) => void;
  addClientToCache: (client: any) => void;
  addBudgetToCache: (budget: any) => void; // ✅ Add this
  updateBudgetInCache: (id: string, budget: any) => void; // ✅ Add this
  removeBudgetFromCache: (id: string) => void; // ✅ Add this
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member'>('owner');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Business data state
const [businessData, setBusinessData] = useState<{
  incomes: any[];
  expenses: any[];
  invoices: any[];
  clients: any[];
  categories: { income: any[]; expense: any[] };
  budgets: any[];
}>({
  incomes: [],
  expenses: [],
  invoices: [],
  clients: [],
  categories: { income: [], expense: [] },
  budgets: []
});

const [businessDataLoading, setBusinessDataLoading] = useState(false);
  
  const loadingRef = useRef(false);
  const lastLoadTime = useRef(0);

  const loadUserData = async () => {
    if (!user || loadingRef.current) return;
    
    const now = Date.now();
    if (now - lastLoadTime.current < 1000) return;
    
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Get effective user ID
      const effectiveId = await getEffectiveUserId(user.id);
      
      // Check if user is part of a team
      const { data: teamMember, error: teamError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      let actualTeamId = user.id;
      let role: 'owner' | 'admin' | 'member' = 'owner';

      if (teamMember && !teamError) {
        actualTeamId = teamMember.team_id;
        role = teamMember.role;
      }

      // Load subscription using effective user ID
      const subData = await subscriptionService.loadUserSubscription(effectiveId);
      setSubscription(subData);

      setUserRole(role);
      setTeamId(actualTeamId);
      setEffectiveUserId(effectiveId);
      lastLoadTime.current = Date.now();
      // Load business data after user data is loaded
await loadBusinessData();
      
      console.log('User data loaded:', {
        userId: user.id,
        role,
        teamId: actualTeamId,
        effectiveUserId: effectiveId
      });
      
      // Load business data after user data is loaded
      if (effectiveId) {
  loadBusinessData(effectiveId);
}
      
    } catch (err: any) {
      console.error('Error loading user data:', err);
      setError(err.message);
      setUserRole('owner');
      setTeamId(user?.id || null);
      setEffectiveUserId(user?.id || null);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      setSubscription(null);
      setUserRole('owner');
      setTeamId(null);
      setEffectiveUserId(null);
      setIsLoading(false);
    }
  }, [user?.id]);

  const refreshData = async () => {
    lastLoadTime.current = 0;
    await loadUserData();
  };
  const addBudgetToCache = (newBudget: any) => {
  setBusinessData(prev => ({
    ...prev,
    budgets: [newBudget, ...prev.budgets]
  }));
};

const updateBudgetInCache = (id: string, updatedBudget: any) => {
  setBusinessData(prev => ({
    ...prev,
    budgets: prev.budgets.map(budget => 
      budget.id === id ? updatedBudget : budget
    )
  }));
};

const removeBudgetFromCache = (id: string) => {
  setBusinessData(prev => ({
    ...prev,
    budgets: prev.budgets.filter(budget => budget.id !== id)
  }));
};

  const loadBusinessData = async (userId?: string) => {
  const userIdToUse = userId || effectiveUserId;
  if (!userIdToUse || businessDataLoading) return;

  setBusinessDataLoading(true);
  try {
    // Get current month date range
// Get 1 year of data for filters and charts
const currentDate = new Date();
const oneYearAgo = format(subYears(currentDate, 1), 'yyyy-MM-dd');
const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');

const [incomes, expenses, invoices, clients, incomeCategories, expenseCategories, budgetData] = await Promise.all([
  getIncomes(userIdToUse, oneYearAgo, endDate), // CHANGED: 1 year of data
  getExpenses(userIdToUse, oneYearAgo, endDate), // CHANGED: 1 year of data
  getInvoices(userIdToUse),
  getClients(userIdToUse),
  getCategories(userIdToUse, 'income'),
  getCategories(userIdToUse, 'expense'),
  getBudgets(userIdToUse)
]);
    
    setBusinessData({
      incomes,
      expenses, 
      invoices,
      clients,
      categories: { income: incomeCategories, expense: expenseCategories },
      budgets: budgetData 
    });
  } catch (err) {
    console.error('Error loading business data:', err);
  } finally {
    setBusinessDataLoading(false);
  }
};


const refreshBusinessData = async () => {
  await loadBusinessData();
};

const addIncomeToCache = (newIncome: any) => {
  setBusinessData(prev => ({
    ...prev,
    incomes: [newIncome, ...prev.incomes]
  }));
};

const addExpenseToCache = (newExpense: any) => {
  setBusinessData(prev => ({
    ...prev,
    expenses: [newExpense, ...prev.expenses]
  }));
};

const addInvoiceToCache = (newInvoice: any) => {
  setBusinessData(prev => ({
    ...prev,
    invoices: [newInvoice, ...prev.invoices]
  }));
};

const addClientToCache = (newClient: any) => {
  setBusinessData(prev => ({
    ...prev,
    clients: [newClient, ...prev.clients]
  }));
};

  return (
  <DataContext.Provider value={{
    subscription,
    userRole,
    teamId,
    effectiveUserId,
    isLoading,
    error,
    refreshData,
    businessData,
    businessDataLoading,
    refreshBusinessData,
    addIncomeToCache,
    addExpenseToCache,
    addInvoiceToCache,
    addClientToCache,
    addBudgetToCache,
    updateBudgetInCache,
    removeBudgetFromCache
  }}>
      {children}
    </DataContext.Provider>
  );
};