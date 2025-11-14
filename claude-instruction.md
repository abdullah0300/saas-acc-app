# PROJECTS FEATURE IMPLEMENTATION INSTRUCTIONS FOR CLAUDE CODE

## 🎯 CRITICAL: Read This First

**BEFORE YOU WRITE ANY CODE**, you MUST:

1. **Study the SmartCFO Design System** - Read these files to understand our aesthetic:
   - `/src/constants/Colors.ts` - Color palette (blue-purple gradient theme)
   - `/src/index.css` - Custom animations and scrollbar styles
   - `/src/components/Landing/LandingPage.tsx` - Modern gradient patterns
   - `/src/components/Invoice/InvoiceView.tsx` - Card-based layouts with gradients
   - `/src/components/Reports/TaxReport.tsx` - Professional dashboard styling

2. **Understand Our Current Architecture**:
   - Web: React + TypeScript + Tailwind CSS
   - Mobile: React Native + Expo + LinearGradient
   - Backend: Supabase (PostgreSQL)
   - We use **team-aware queries** via `getEffectiveUserId()`
   - All features support multi-currency
   - All financial data respects user's base currency settings

3. **Key Design Principles**:
   - ✨ **Gradient-heavy** aesthetic (purple-blue-pink combinations)
   - 🎴 **Card-based** layouts with subtle shadows
   - 🌊 **Smooth animations** for state changes
   - 📱 **Mobile-first** thinking (but web is primary)
   - 🎯 **3-tap rule** for mobile interactions
   - 💎 **Premium feel** - this is a paid SaaS, make it look expensive

---

## 📊 FEATURE OVERVIEW: Projects System

### What is it?
A **profitability tracking system** for service businesses (photographers, consultants, agencies) who need to answer: **"Did THIS specific job make money?"**

### Hot Selling Points:
1. **Real-time Profitability** - See profit margins instantly
2. **Smart Auto-Linking** - AI detects projects from descriptions
3. **Client Relationship View** - All projects per client in one place
4. **Budget Alerts** - Know when project is over budget
5. **Historical Insights** - Compare project performance over time

---

## 🗄️ DATABASE SCHEMA

### Step 1: Create Projects Table

```sql
-- Run this in Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
  
  -- Dates
  start_date DATE,
  end_date DATE,
  
  -- Budget
  budget_amount DECIMAL(15, 2),
  budget_currency VARCHAR(3) DEFAULT 'USD',
  
  -- Color for visual grouping (optional)
  color VARCHAR(7) DEFAULT '#6366F1',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT projects_user_id_name_unique UNIQUE(user_id, name, deleted_at)
);

-- Indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_client_id ON projects(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_dates ON projects(start_date, end_date) WHERE deleted_at IS NULL;

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies (team-aware)
CREATE POLICY "Users can view their own projects or team projects"
  ON projects FOR SELECT
  USING (
    user_id = auth.uid() OR
    user_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can soft delete their own projects"
  ON projects FOR DELETE
  USING (user_id = auth.uid());

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();
```

### Step 2: Add project_id to Existing Tables

```sql
-- Add project_id to income table
ALTER TABLE income ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX idx_income_project_id ON income(project_id) WHERE project_id IS NOT NULL;

-- Add project_id to expenses table
ALTER TABLE expenses ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX idx_expenses_project_id ON expenses(project_id) WHERE project_id IS NOT NULL;

-- Add project_id to invoices table
ALTER TABLE invoices ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX idx_invoices_project_id ON invoices(project_id) WHERE project_id IS NOT NULL;
```

### Step 3: Create Project Summary View (for performance)

```sql
-- Materialized view for fast project stats
CREATE MATERIALIZED VIEW project_stats AS
SELECT 
  p.id as project_id,
  p.user_id,
  
  -- Income totals (converted to base currency)
  COALESCE(SUM(i.base_amount), 0) as total_income,
  COUNT(DISTINCT i.id) as income_count,
  
  -- Expense totals (converted to base currency)
  COALESCE(SUM(e.base_amount), 0) as total_expenses,
  COUNT(DISTINCT e.id) as expense_count,
  
  -- Invoice totals (converted to base currency)
  COALESCE(SUM(inv.base_total), 0) as invoice_total,
  COUNT(DISTINCT inv.id) as invoice_count,
  COUNT(DISTINCT CASE WHEN inv.status = 'paid' THEN inv.id END) as paid_invoice_count,
  
  -- Calculated fields
  COALESCE(SUM(i.base_amount), 0) - COALESCE(SUM(e.base_amount), 0) as profit,
  CASE 
    WHEN COALESCE(SUM(i.base_amount), 0) > 0 
    THEN ROUND(((COALESCE(SUM(i.base_amount), 0) - COALESCE(SUM(e.base_amount), 0)) / SUM(i.base_amount) * 100)::numeric, 2)
    ELSE 0
  END as profit_margin_percentage
  
FROM projects p
LEFT JOIN income i ON i.project_id = p.id AND i.deleted_at IS NULL
LEFT JOIN expenses e ON e.project_id = p.id AND e.deleted_at IS NULL
LEFT JOIN invoices inv ON inv.project_id = p.id AND inv.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.user_id;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_project_stats_project_id ON project_stats(project_id);
CREATE INDEX idx_project_stats_user_id ON project_stats(user_id);

-- Function to refresh stats (call after income/expense/invoice changes)
CREATE OR REPLACE FUNCTION refresh_project_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_stats;
END;
$$ LANGUAGE plpgsql;
```

---

## 🎨 WEB APP IMPLEMENTATION

### Phase 1: Core Database Service Functions

**File: `/src/services/database.ts`**

Add these functions to the existing file:

```typescript
import { getEffectiveUserId } from './database'; // Already exists

// ==========================================
// PROJECT FUNCTIONS
// ==========================================

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  client_id?: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  start_date?: string;
  end_date?: string;
  budget_amount?: number;
  budget_currency?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Populated from joins
  client?: any;
  stats?: {
    total_income: number;
    total_expenses: number;
    invoice_total: number;
    profit: number;
    profit_margin_percentage: number;
    income_count: number;
    expense_count: number;
    invoice_count: number;
    paid_invoice_count: number;
  };
}

/**
 * Get all projects for a user (team-aware)
 */
export const getProjects = async (
  userId: string,
  status?: 'active' | 'completed' | 'on_hold' | 'cancelled' | 'all'
): Promise<Project[]> => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  let query = supabase
    .from('projects')
    .select(`
      *,
      client:clients(id, name, email),
      stats:project_stats(*)
    `)
    .eq('user_id', effectiveUserId)
    .is('deleted_at', null);
  
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Project[];
};

/**
 * Get a single project by ID
 */
export const getProject = async (projectId: string): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      client:clients(*),
      stats:project_stats(*)
    `)
    .eq('id', projectId)
    .is('deleted_at', null)
    .single();
  
  if (error) throw error;
  return data as Project;
};

/**
 * Create a new project
 */
export const createProject = async (
  project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
): Promise<Project> => {
  const effectiveUserId = await getEffectiveUserId(project.user_id);
  
  const { data, error } = await supabase
    .from('projects')
    .insert([{
      ...project,
      user_id: effectiveUserId,
      client_id: project.client_id || null,
      description: project.description || null,
      start_date: project.start_date || null,
      end_date: project.end_date || null,
      budget_amount: project.budget_amount || null,
      budget_currency: project.budget_currency || null,
      color: project.color || '#6366F1'
    }])
    .select(`
      *,
      client:clients(*),
      stats:project_stats(*)
    `)
    .single();
  
  if (error) throw error;
  
  // Refresh project stats
  await supabase.rpc('refresh_project_stats');
  
  return data as Project;
};

/**
 * Update a project
 */
export const updateProject = async (
  projectId: string,
  updates: Partial<Project>
): Promise<Project> => {
  const updateData: any = { ...updates };
  
  // Handle nullable fields
  if ('client_id' in updates) updateData.client_id = updates.client_id || null;
  if ('description' in updates) updateData.description = updates.description || null;
  if ('start_date' in updates) updateData.start_date = updates.start_date || null;
  if ('end_date' in updates) updateData.end_date = updates.end_date || null;
  if ('budget_amount' in updates) updateData.budget_amount = updates.budget_amount || null;
  
  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', projectId)
    .select(`
      *,
      client:clients(*),
      stats:project_stats(*)
    `)
    .single();
  
  if (error) throw error;
  
  // Refresh project stats
  await supabase.rpc('refresh_project_stats');
  
  return data as Project;
};

/**
 * Soft delete a project
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', projectId);
  
  if (error) throw error;
};

/**
 * Get project transactions (income + expenses + invoices)
 */
export const getProjectTransactions = async (projectId: string) => {
  const [incomes, expenses, invoices] = await Promise.all([
    supabase
      .from('income')
      .select('*, category:categories(*)')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('date', { ascending: false }),
    supabase
      .from('expenses')
      .select('*, category:categories(*), vendor_detail:vendors(*)')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('date', { ascending: false }),
    supabase
      .from('invoices')
      .select('*, client:clients(*), items:invoice_items(*)')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
  ]);
  
  return {
    incomes: incomes.data || [],
    expenses: expenses.data || [],
    invoices: invoices.data || []
  };
};

/**
 * Get projects by client
 */
export const getProjectsByClient = async (
  userId: string,
  clientId: string
): Promise<Project[]> => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      stats:project_stats(*)
    `)
    .eq('user_id', effectiveUserId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Project[];
};

/**
 * Check if project name already exists for user
 */
export const checkProjectNameExists = async (
  userId: string,
  name: string,
  excludeId?: string
): Promise<boolean> => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  let query = supabase
    .from('projects')
    .select('id')
    .eq('user_id', effectiveUserId)
    .eq('name', name)
    .is('deleted_at', null);
  
  if (excludeId) {
    query = query.neq('id', excludeId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return (data && data.length > 0);
};

/**
 * Auto-suggest project from transaction description using AI
 * (Simple keyword matching for now, can be enhanced with AI later)
 */
export const suggestProjectFromDescription = async (
  userId: string,
  description: string,
  clientId?: string
): Promise<Project | null> => {
  const effectiveUserId = await getEffectiveUserId(userId);
  
  // Get active projects
  let query = supabase
    .from('projects')
    .select('*, stats:project_stats(*)')
    .eq('user_id', effectiveUserId)
    .eq('status', 'active')
    .is('deleted_at', null);
  
  if (clientId) {
    query = query.eq('client_id', clientId);
  }
  
  const { data: projects, error } = await query;
  
  if (error || !projects || projects.length === 0) return null;
  
  // Simple keyword matching (can be enhanced with AI)
  const descLower = description.toLowerCase();
  
  // Find project where description contains project name
  const match = projects.find(p => 
    descLower.includes(p.name.toLowerCase())
  );
  
  return match as Project || null;
};
```

---

### Phase 2: Web UI Components

#### 2.1: Projects List Page

**File: `/src/components/Projects/ProjectsList.tsx`** (NEW FILE)

```typescript
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Briefcase, TrendingUp, TrendingDown, Calendar, Users, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getProjects } from '../../services/database';
import type { Project } from '../../services/database';

export const ProjectsList: React.FC = () => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold' | 'cancelled'>('active');

  useEffect(() => {
    loadProjects();
  }, [user, statusFilter]);

  const loadProjects = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getProjects(user.id, statusFilter);
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'from-green-500 to-emerald-600',
      completed: 'from-blue-500 to-indigo-600',
      on_hold: 'from-yellow-500 to-orange-600',
      cancelled: 'from-gray-500 to-slate-600'
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  const getStatusBadgeColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      on_hold: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  const getProfitColor = (margin: number) => {
    if (margin >= 50) return 'text-green-600';
    if (margin >= 25) return 'text-blue-600';
    if (margin >= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-start space-x-4">
              <div className="p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg">
                <Briefcase className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Projects
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  Track profitability across all your projects
                </p>
              </div>
            </div>
            
            <Link
              to="/projects/new"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Project
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects, clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'active', 'completed', 'on_hold', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    statusFilter === status
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
            <Briefcase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No projects found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm ? 'Try adjusting your search' : 'Get started by creating your first project'}
            </p>
            {!searchTerm && (
              <Link
                to="/projects/new"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Project
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const stats = project.stats || {
                total_income: 0,
                total_expenses: 0,
                profit: 0,
                profit_margin_percentage: 0,
                invoice_total: 0,
                income_count: 0,
                expense_count: 0,
                invoice_count: 0
              };

              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="group"
                >
                  <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-purple-200 transform hover:scale-[1.02]">
                    {/* Card Header with Gradient */}
                    <div
                      className={`p-6 bg-gradient-to-r ${getStatusColor(project.status)} text-white relative overflow-hidden`}
                    >
                      {/* Background Pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-2xl"></div>
                      </div>

                      <div className="relative">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold mb-2 truncate">
                              {project.name}
                            </h3>
                            {project.client && (
                              <div className="flex items-center gap-2 text-white/90">
                                <Users className="h-4 w-4" />
                                <span className="text-sm">{project.client.name}</span>
                              </div>
                            )}
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(project.status)}`}
                          >
                            {project.status}
                          </span>
                        </div>

                        {/* Project Timeline */}
                        {(project.start_date || project.end_date) && (
                          <div className="flex items-center gap-2 text-white/80 text-sm">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {project.start_date && new Date(project.start_date).toLocaleDateString()}
                              {project.start_date && project.end_date && ' - '}
                              {project.end_date && new Date(project.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-6 space-y-4">
                      {/* Profit Display */}
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Net Profit</span>
                          <span className={`text-xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(stats.profit, baseCurrency)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {stats.profit >= 0 ? (
                            <TrendingUp className={`h-4 w-4 ${getProfitColor(stats.profit_margin_percentage)}`} />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={`text-sm font-semibold ${getProfitColor(stats.profit_margin_percentage)}`}>
                            {stats.profit_margin_percentage.toFixed(1)}% margin
                          </span>
                        </div>
                      </div>

                      {/* Revenue & Expenses */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                          <div className="text-xs text-green-600 font-medium mb-1">Revenue</div>
                          <div className="text-lg font-bold text-green-700">
                            {formatCurrency(stats.total_income, baseCurrency)}
                          </div>
                          <div className="text-xs text-green-600 mt-1">
                            {stats.income_count} transaction{stats.income_count !== 1 ? 's' : ''}
                          </div>
                        </div>

                        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                          <div className="text-xs text-red-600 font-medium mb-1">Expenses</div>
                          <div className="text-lg font-bold text-red-700">
                            {formatCurrency(stats.total_expenses, baseCurrency)}
                          </div>
                          <div className="text-xs text-red-600 mt-1">
                            {stats.expense_count} transaction{stats.expense_count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      {/* Budget Progress (if budget exists) */}
                      {project.budget_amount && project.budget_amount > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-600">Budget Usage</span>
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(stats.total_expenses, project.budget_currency || baseCurrency)} / {formatCurrency(project.budget_amount, project.budget_currency || baseCurrency)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                (stats.total_expenses / project.budget_amount) * 100 > 90
                                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                                  : (stats.total_expenses / project.budget_amount) * 100 > 75
                                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                                  : 'bg-gradient-to-r from-green-500 to-emerald-600'
                              }`}
                              style={{
                                width: `${Math.min(100, (stats.total_expenses / project.budget_amount) * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
```

#### 2.2: Project Form Component

**File: `/src/components/Projects/ProjectForm.tsx`** (NEW FILE)

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { 
  createProject, 
  updateProject, 
  getProject, 
  deleteProject,
  checkProjectNameExists,
  getClients 
} from '../../services/database';

export const ProjectForm: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { baseCurrency, enabledCurrencies } = useSettings();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: '',
    status: 'active' as 'active' | 'completed' | 'on_hold' | 'cancelled',
    start_date: '',
    end_date: '',
    budget_amount: '',
    budget_currency: baseCurrency,
    color: '#6366F1'
  });

  useEffect(() => {
    loadData();
  }, [projectId, user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const clientsData = await getClients(user.id);
      setClients(clientsData);

      if (projectId) {
        const project = await getProject(projectId);
        setFormData({
          name: project.name,
          description: project.description || '',
          client_id: project.client_id || '',
          status: project.status,
          start_date: project.start_date || '',
          end_date: project.end_date || '',
          budget_amount: project.budget_amount?.toString() || '',
          budget_currency: project.budget_currency || baseCurrency,
          color: project.color || '#6366F1'
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const validate = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (user) {
      const exists = await checkProjectNameExists(user.id, formData.name, projectId);
      if (exists) {
        newErrors.name = 'A project with this name already exists';
      }
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.start_date) > new Date(formData.end_date)) {
        newErrors.end_date = 'End date must be after start date';
      }
    }

    if (formData.budget_amount && parseFloat(formData.budget_amount) < 0) {
      newErrors.budget_amount = 'Budget must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !(await validate())) return;

    try {
      setSaving(true);
      
      const projectData = {
        user_id: user.id,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        client_id: formData.client_id || undefined,
        status: formData.status,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : undefined,
        budget_currency: formData.budget_currency,
        color: formData.color
      };

      if (projectId) {
        await updateProject(projectId, projectData);
      } else {
        await createProject(projectData as any);
      }

      navigate('/projects');
    } catch (error) {
      console.error('Error saving project:', error);
      setErrors({ submit: 'Failed to save project. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId || !window.confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      await deleteProject(projectId);
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      setErrors({ submit: 'Failed to delete project. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const colorOptions = [
    { value: '#6366F1', label: 'Indigo' },
    { value: '#8B5CF6', label: 'Purple' },
    { value: '#EC4899', label: 'Pink' },
    { value: '#10B981', label: 'Green' },
    { value: '#F59E0B', label: 'Amber' },
    { value: '#EF4444', label: 'Red' },
    { value: '#3B82F6', label: 'Blue' },
    { value: '#14B8A6', label: 'Teal' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/projects')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-6 w-6 text-gray-600" />
              </button>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                {projectId ? 'Edit Project' : 'New Project'}
              </h1>
            </div>
            
            {projectId && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 className="h-5 w-5" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">Basic Information</h2>
            
            <div className="space-y-4">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.name ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="e.g., Sarah's Wedding Photography"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Brief description of the project..."
                />
              </div>

              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client
                </label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No client linked</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Color
                </label>
                <div className="flex gap-3 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-12 h-12 rounded-xl transition-all ${
                        formData.color === color.value
                          ? 'ring-4 ring-purple-300 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">Timeline</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.end_date ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
                {errors.end_date && <p className="mt-1 text-sm text-red-600">{errors.end_date}</p>}
              </div>
            </div>
          </div>

          {/* Budget */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">Budget</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.budget_amount}
                  onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.budget_amount ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="0.00"
                />
                {errors.budget_amount && <p className="mt-1 text-sm text-red-600">{errors.budget_amount}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={formData.budget_currency}
                  onChange={(e) => setFormData({ ...formData, budget_currency: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {enabledCurrencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  {projectId ? 'Update Project' : 'Create Project'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

---

### Phase 3: Add Project Selection to Transaction Forms

**Update these existing files to add project selection:**

#### 3.1: Income Form

**File: `/src/components/Income/IncomeForm.tsx`**

Add this import:
```typescript
import { getProjects } from '../../services/database';
```

Add to state:
```typescript
const [projects, setProjects] = useState<any[]>([]);
const [selectedProjectId, setSelectedProjectId] = useState('');
```

In the `loadData` function:
```typescript
const projectsData = await getProjects(user.id, 'active');
setProjects(projectsData);
```

Add this field in the form (after client selector):
```tsx
{/* Project */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Project (Optional)
  </label>
  <select
    value={selectedProjectId}
    onChange={(e) => setSelectedProjectId(e.target.value)}
    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
  >
    <option value="">No project</option>
    {projects
      .filter(p => !selectedClientId || p.client_id === selectedClientId)
      .map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
  </select>
  <p className="mt-1 text-sm text-gray-500">
    {selectedClientId 
      ? 'Showing projects for selected client'
      : 'Select a client to filter projects'}
  </p>
</div>
```

Update the submit handler to include `project_id: selectedProjectId || null`

#### 3.2: Expense Form

**File: `/src/components/Expense/ExpenseForm.tsx`**

Apply the same changes as Income Form.

#### 3.3: Invoice Form

**File: `/src/components/Invoice/InvoiceForm.tsx`**

Apply similar changes, with project selector after client selection.

---

### Phase 4: Add Routes

**File: `/src/App.tsx`**

Add these routes:
```tsx
import { ProjectsList } from './components/Projects/ProjectsList';
import { ProjectForm } from './components/Projects/ProjectForm';
import { ProjectDetail } from './components/Projects/ProjectDetail'; // We'll create this next

// Inside your Routes:
<Route path="/projects" element={<ProtectedRoute><ProjectsList /></ProtectedRoute>} />
<Route path="/projects/new" element={<ProtectedRoute><ProjectForm /></ProtectedRoute>} />
<Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
<Route path="/projects/:projectId/edit" element={<ProtectedRoute><ProjectForm /></ProtectedRoute>} />
```

---

## 📱 MOBILE APP IMPLEMENTATION

*(Due to length constraints, I'll provide the key mobile components structure)*

### Mobile Project Components Structure:

1. **`/src/screens/ProjectsScreen.tsx`** - Main projects list (similar to web but with mobile UI)
2. **`/src/screens/ProjectDetailScreen.tsx`** - Project detail view
3. **`/src/screens/CreateProjectScreen.tsx`** - Project form
4. **`/src/components/projects/ProjectCard.tsx`** - Reusable project card component
5. **`/src/components/projects/ProjectSelector.tsx`** - Project picker for transaction forms

### Key Mobile Design Patterns:

```typescript
// Use LinearGradient for headers
<LinearGradient
  colors={['#6366F1', '#8B5CF6']}
  start={{x: 0, y: 0}}
  end={{x: 1, y: 1}}
  style={styles.header}
>
  // Header content
</LinearGradient>

// Use card-based layouts with shadows
const styles = StyleSheet.create({
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  // ... more styles following existing pattern
});
```

---

## 🎯 IMPLEMENTATION CHECKLIST

### Phase 1: Database (Day 1)
- [ ] Run all SQL migrations in Supabase
- [ ] Verify RLS policies work
- [ ] Test materialized view refresh

### Phase 2: Backend (Day 2)
- [ ] Add project functions to `database.ts`
- [ ] Test all CRUD operations
- [ ] Verify team-aware queries work

### Phase 3: Web UI (Days 3-4)
- [ ] Create ProjectsList component
- [ ] Create ProjectForm component
- [ ] Create ProjectDetail component
- [ ] Add project selectors to Income/Expense/Invoice forms
- [ ] Add routes to App.tsx
- [ ] Test all flows

### Phase 4: Mobile UI (Days 5-6)
- [ ] Create mobile project screens
- [ ] Add project selectors to mobile transaction forms
- [ ] Test on iOS and Android
- [ ] Verify data sync with web

### Phase 5: Testing & Polish (Day 7)
- [ ] Test edge cases (deleted projects, budget alerts, etc.)
- [ ] Add loading states and error handling
- [ ] Performance testing with 100+ projects
- [ ] Final UI polish and animations

---

## 🚀 QUICK START COMMANDS

```bash
# 1. Create the database tables
# Run SQL in Supabase Dashboard → SQL Editor

# 2. Update database service
# Add functions to /src/services/database.ts

# 3. Create components
mkdir -p src/components/Projects
touch src/components/Projects/ProjectsList.tsx
touch src/components/Projects/ProjectForm.tsx
touch src/components/Projects/ProjectDetail.tsx

# 4. Update routes
# Edit src/App.tsx

# 5. Test locally
npm run dev

# 6. Deploy
git add .
git commit -m "feat: Add Projects feature"
git push
```

---

## 💡 SMART FEATURES TO IMPLEMENT LATER

1. **AI Auto-Linking**: Use AI to detect projects from transaction descriptions
2. **Budget Alerts**: Notify when project exceeds 80% of budget
3. **Time Tracking**: Add hours worked per project
4. **Profitability Forecasting**: Predict final profit based on current trajectory
5. **Client Lifetime Value**: Show total value from all client projects

---

## ⚠️ CRITICAL REMINDERS

1. **ALWAYS use `getEffectiveUserId()`** for team support
2. **ALWAYS handle multi-currency** conversions
3. **ALWAYS add loading states** for async operations
4. **ALWAYS validate user input** before database operations
5. **ALWAYS maintain aesthetic consistency** with existing components
6. **NEVER break existing functionality** - test thoroughly
7. **ALWAYS refresh project_stats** after transaction changes
 
---

## 📞 SUPPORT

If you encounter issues:
1. Check Supabase logs for SQL errors
2. Verify RLS policies are correct
3. Test with simple data first
4. Use browser DevTools to debug React components

<!-- **Good luck! Make it look amazing! 🎨✨** -->