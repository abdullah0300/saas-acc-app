/**
 * UI Navigation Tools - Provides step-by-step UI guidance
 * Helps users understand how to navigate the SmartCFO interface
 */

export interface UIGuide {
  feature: string;
  route: string;
  description: string;
  steps: string[];
  tips: string[];
  relatedFeatures?: string[];
}

/**
 * Get detailed UI navigation guide for a specific feature
 * Returns step-by-step instructions for using the SmartCFO interface
 */
export const getUIGuideTool = async (
  feature: 'invoices' | 'expenses' | 'income' | 'clients' | 'projects' | 'reports' | 'dashboard' | 'settings' | 'overview'
): Promise<UIGuide> => {
  const guides: Record<string, UIGuide> = {
    overview: {
      feature: 'SmartCFO Overview',
      route: '/dashboard',
      description: 'Main navigation and feature overview',
      steps: [
        '1. Dashboard - View business metrics and KPIs at /dashboard',
        '2. Invoices - Create and manage invoices at /invoices',
        '3. Income - Track income records at /income',
        '4. Expenses - Monitor business expenses at /expenses',
        '5. Clients - Manage client information at /clients',
        '6. Projects - Track project profitability at /projects',
        '7. Reports - View financial reports at /reports',
        '8. Settings - Configure system (click profile icon, top right)'
      ],
      tips: [
        'All main features are in the left sidebar',
        'Click "+ New [Feature]" buttons to create records',
        'Use search bars at the top to find specific records',
        'Filter buttons let you narrow down lists by date, status, etc.',
        'Click any row in a table to view/edit details'
      ]
    },

    dashboard: {
      feature: 'Dashboard',
      route: '/dashboard',
      description: 'View business overview, KPIs, and quick actions',
      steps: [
        '1. Click "Dashboard" in the left sidebar',
        '2. View key metrics at the top (revenue, expenses, profit)',
        '3. Scroll to see charts (income trends, expense breakdown)',
        '4. Check "Recent Transactions" section for latest activity',
        '5. Use "Quick Actions" cards to create records'
      ],
      tips: [
        'Dashboard refreshes automatically when you create new records',
        'Metrics show data for current month by default',
        'Click chart sections for detailed breakdowns',
        'Use "View All" links to navigate to full feature pages'
      ],
      relatedFeatures: ['reports', 'income', 'expenses']
    },

    invoices: {
      feature: 'Invoices',
      route: '/invoices',
      description: 'Create, send, and track invoices to clients',
      steps: [
        '1. Click "Invoices" in the left sidebar to open /invoices',
        '2. Click "+ New Invoice" button (blue button, top right)',
        '3. Select client from dropdown (or click "+ Add New Client")',
        '4. Set invoice date and due date using date pickers',
        '5. Click "+ Add Item" to add line items',
        '6. For each item: enter description, quantity, and rate',
        '7. Tax is calculated automatically based on your settings',
        '8. Add optional notes in the text area at the bottom',
        '9. Click "Preview Invoice" to see how it looks',
        '10. Click "Save as Draft" or "Save & Send" (email/WhatsApp)'
      ],
      tips: [
        'Filter invoices by status: All, Draft, Sent, Paid, Overdue, Cancelled',
        'Click invoice number to view full details',
        'Use "..." menu on each row for quick actions (edit, send, delete)',
        'Enable payment methods in Settings → Payment Methods for online payments',
        'Set up recurring invoices by clicking "Make Recurring" after saving'
      ],
      relatedFeatures: ['clients', 'income', 'projects']
    },

    expenses: {
      feature: 'Expenses',
      route: '/expenses',
      description: 'Track business expenses and receipts',
      steps: [
        '1. Click "Expenses" in the left sidebar to open /expenses',
        '2. Click "+ Add Expense" button (top right)',
        '3. Enter the expense amount',
        '4. Select category from the dropdown',
        '5. Enter a description of the expense',
        '6. Select the date using the date picker',
        '7. (Optional) Select vendor from dropdown or type to create new',
        '8. (Optional) Click "Upload Receipt" to attach an image/PDF',
        '9. (Optional) Link to a project using the project dropdown',
        '10. Click "Save Expense" to create the record'
      ],
      tips: [
        'Upload receipts for better record keeping and tax compliance',
        'Link expenses to projects to track project profitability',
        'Use categories to organize and analyze spending patterns',
        'Filter by date range, category, vendor, or project',
        'Click any expense row to edit or view details'
      ],
      relatedFeatures: ['projects', 'clients', 'reports']
    },

    income: {
      feature: 'Income',
      route: '/income',
      description: 'Record and track income transactions',
      steps: [
        '1. Click "Income" in the left sidebar to open /income',
        '2. Click "+ Add Income" button (top right)',
        '3. Enter the income amount',
        '4. Enter a description',
        '5. Select the date using the date picker',
        '6. (Optional) Select category from dropdown',
        '7. (Optional) Select client from dropdown',
        '8. (Optional) Link to a project',
        '9. (Optional) Add reference number',
        '10. (Optional) Set tax rate if different from default',
        '11. Click "Save Income" to create the record'
      ],
      tips: [
        'Link income to clients to track revenue per client',
        'Use categories to organize income streams',
        'Link to projects to track project revenue',
        'Filter by date, client, category, or project',
        'Click any income row to edit details'
      ],
      relatedFeatures: ['clients', 'projects', 'invoices']
    },

    clients: {
      feature: 'Clients',
      route: '/clients',
      description: 'Manage client information and track transactions',
      steps: [
        '1. Click "Clients" in the left sidebar to open /clients',
        '2. Click "+ New Client" button (top right)',
        '3. Enter client name (required)',
        '4. (Optional) Enter company name',
        '5. (Optional) Add email address',
        '6. (Optional) Add phone number',
        '7. (Optional) Add physical address',
        '8. (Optional) Add notes about the client',
        '9. Click "Save Client" to create the record'
      ],
      tips: [
        'Click client name to view all transactions for that client',
        'See total revenue, outstanding invoices, and payment history',
        'Use search bar to quickly find clients',
        'Export client list using "Export" button',
        'Client data is used when creating invoices and income records'
      ],
      relatedFeatures: ['invoices', 'income', 'projects']
    },

    projects: {
      feature: 'Projects',
      route: '/projects',
      description: 'Track project profitability and manage tasks',
      steps: [
        '1. Click "Projects" in the left sidebar to open /projects',
        '2. Click "+ New Project" button (top right)',
        '3. Enter project name (required)',
        '4. (Optional) Select client from dropdown',
        '5. (Optional) Enter project description',
        '6. (Optional) Set start date and end date',
        '7. (Optional) Set budget amount',
        '8. (Optional) Choose a color for visual organization',
        '9. Click "Save Project" to create the record',
        '10. Click project name to manage milestones, goals, and time tracking'
      ],
      tips: [
        'Link income and expenses to projects to track profitability',
        'Budget usage shows: Budget vs Actual Spending with percentage',
        'View profit margin: (Income - Expenses) / Income × 100',
        'Add milestones to track project phases',
        'Use time tracking tab to log billable hours',
        'Filter projects by status: Active, Completed, On Hold, Cancelled'
      ],
      relatedFeatures: ['clients', 'income', 'expenses', 'invoices']
    },

    reports: {
      feature: 'Reports',
      route: '/reports',
      description: 'View financial reports and analytics',
      steps: [
        '1. Click "Reports" in the left sidebar to open /reports',
        '2. View the Reports Overview page with KPIs and charts',
        '3. Click specific report cards to view detailed reports:',
        '   - "Profit & Loss" - Detailed P&L statement',
        '   - "Tax Report" - Tax compliance report (quarterly/annual)',
        '   - "VAT Report" - VAT summary (UK/EU only)',
        '   - "Cash Flow" - Cash flow analysis (coming soon)',
        '4. Use date range selectors to filter data',
        '5. Click "Export" button to download CSV',
        '6. Use "Print" button for print-friendly view'
      ],
      tips: [
        'Reports Overview shows: revenue, expenses, profit, margins',
        'Charts update automatically when you create new records',
        'Tax Report available in quarterly or annual view',
        'VAT Report only shows for UK/EU country settings',
        'Export reports for accountant or tax filing',
        'Use comparison periods to see growth trends'
      ],
      relatedFeatures: ['dashboard', 'income', 'expenses', 'invoices']
    },

    settings: {
      feature: 'Settings',
      route: '/settings',
      description: 'Configure system preferences and integrations',
      steps: [
        '1. Click your profile icon (top right corner)',
        '2. Select "Settings" from the dropdown menu',
        '3. Navigate between tabs:',
        '   - Profile: Company name, currency, country, date format',
        '   - Categories: Manage income/expense categories',
        '   - Tax Settings: Default tax rate, VAT scheme',
        '   - Payment Methods: Stripe Connect setup for online payments',
        '   - Team: Add team members (Plus plan required)',
        '   - Subscription: Upgrade plan, view usage limits',
        '   - Notifications: Email and in-app notification preferences',
        '4. Make changes in any tab',
        '5. Click "Save Changes" at the bottom of each tab'
      ],
      tips: [
        'Set base currency carefully - affects all calculations',
        'Default tax rate applies to new invoices/income/expenses',
        'Stripe Connect required for accepting online payments',
        'Team members inherit owner\'s data and settings',
        'Subscription tab shows usage: invoices, users, storage',
        'Export all data from Data Protection tab (GDPR compliance)'
      ],
      relatedFeatures: ['invoices', 'income', 'expenses']
    }
  };

  return guides[feature] || guides.overview;
};
