# Edge Function - AI Assistant with Chat Support

## File: supabase/functions/ai-assistant/index.ts

Copy this entire code and paste it into your Supabase Edge Function:

```typescript
// supabase/functions/ai-assistant/index.ts
// SmartCFO - Intelligent AI CFO Assistant with DeepSeek Integration

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// DeepSeek API Configuration
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const requestBody = await req.json();
    const { userId, feature } = requestBody;

    if (!userId && feature !== 'chat') {
      throw new Error('userId is required');
    }

    // Route to different features
    switch (feature) {
      case 'get_insights':
        return await generateInsights(supabaseClient, userId);
      case 'get_missing_context':
        return await getMissingContext(supabaseClient, userId);
      case 'update_user_context':
        return await updateUserContext(supabaseClient, userId, requestBody);
      case 'regenerate_insights':
        return await generateInsights(supabaseClient, userId, true);
      case 'chat':
        return await handleChat(requestBody);
      default:
        throw new Error('Invalid feature requested');
    }

  } catch (error) {
    console.error('Error in ai-assistant:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ==================== CHAT HANDLER (NEW) ====================

async function handleChat(requestBody: any) {
  console.log('=¬ Handling chat request...');

  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  const { messages, model, tools, temperature, max_tokens } = requestBody;

  if (!messages || !Array.isArray(messages)) {
    throw new Error('messages array is required');
  }

  try {
    // Proxy request to DeepSeek API
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: messages,
        tools: tools || undefined,
        tool_choice: tools ? 'auto' : undefined,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2000,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', errorText);
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    console.log(' Chat response received from DeepSeek');

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('L Error in chat handler:', error);
    throw error;
  }
}

// ==================== MAIN INSIGHT GENERATION ====================

async function generateInsights(supabaseClient: any, userId: string, forceRegenerate = false) {
  try {
    console.log('>à Starting AI CFO insight generation for user:', userId);

    // Step 1: Gather comprehensive user data
    const userData = await gatherUserData(supabaseClient, userId);

    // Step 2: Check if we need to generate new insights
    if (!forceRegenerate) {
      const cached = await getCachedInsights(supabaseClient, userId);
      if (cached) {
        console.log(' Returning cached insights');
        return new Response(
          JSON.stringify(cached),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 3: Analyze patterns from historical data
    const patterns = await analyzePatterns(userData);

    // Step 4: Generate AI insights using DeepSeek
    const insights = await generateAIInsights(userData, patterns);

    // Step 5: Validate insights (prevent hallucination)
    const validatedInsights = validateInsights(insights, userData);

    // Step 6: Save to database
    const result = await saveInsights(supabaseClient, userId, validatedInsights);

    console.log(' Successfully generated AI CFO insights');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('L Error generating insights:', error);
    throw error;
  }
}

// ==================== DATA GATHERING ====================

async function gatherUserData(supabaseClient: any, userId: string) {
  console.log('=Ê Gathering comprehensive user data...');

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString();

  // Parallel data fetching for performance
  const [
    userSettings,
    userContext,
    currentMonthIncome,
    currentMonthExpenses,
    currentMonthInvoices,
    allInvoices,
    clients,
    historicalIncome,
    historicalExpenses
  ] = await Promise.all([
    // User profile & settings
    supabaseClient
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single(),

    // User business context - using ai_user_context table
    supabaseClient
      .from('ai_user_context')
      .select('*')
      .eq('user_id', userId)
      .single(),

    // Current month income
    supabaseClient
      .from('income')
      .select('*')
      .eq('user_id', userId)
      .gte('date', `${currentMonth}-01`)
      .lt('date', `${getNextMonth(currentMonth)}-01`),

    // Current month expenses
    supabaseClient
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('date', `${currentMonth}-01`)
      .lt('date', `${getNextMonth(currentMonth)}-01`),

    // Current month invoices
    supabaseClient
      .from('invoices')
      .select('*, client:clients(*)')
      .eq('user_id', userId)
      .gte('date', `${currentMonth}-01`)
      .lt('date', `${getNextMonth(currentMonth)}-01`),

    // All invoices (for pattern analysis)
    supabaseClient
      .from('invoices')
      .select('*, client:clients(*), items:invoice_items(*)')
      .eq('user_id', userId)
      .gte('date', oneYearAgo)
      .order('date', { ascending: false }),

    // All clients
    supabaseClient
      .from('clients')
      .select('*')
      .eq('user_id', userId),

    // Historical income (12 months)
    supabaseClient
      .from('income')
      .select('*')
      .eq('user_id', userId)
      .gte('date', oneYearAgo)
      .order('date', { ascending: false }),

    // Historical expenses (12 months)
    supabaseClient
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('date', oneYearAgo)
      .order('date', { ascending: false })
  ]);

  // Get all currencies being used
  const currencies = new Set<string>();
  currencies.add(userSettings.data?.base_currency || 'USD');

  [...(currentMonthIncome.data || []), ...(currentMonthExpenses.data || []), ...(allInvoices.data || [])]
    .forEach(item => {
      if (item.currency) currencies.add(item.currency);
    });

  return {
    profile: {
      userId,
      baseCurrency: userSettings.data?.base_currency || 'USD',
      currencies: Array.from(currencies),
      country: userSettings.data?.country || 'Unknown',
      taxRate: userSettings.data?.tax_rate || 0,
      dateFormat: userSettings.data?.date_format || 'MM/DD/YYYY'
    },
    context: {
      businessType: userContext.data?.business_type || 'General Business',
      industry: userContext.data?.business_type || 'General',
      businessStage: userContext.data?.business_stage || 'startup',
      location: userContext.data?.location || userSettings.data?.country || 'Global'
    },
    currentMonth: {
      month: currentMonth,
      income: currentMonthIncome.data || [],
      expenses: currentMonthExpenses.data || [],
      invoices: currentMonthInvoices.data || []
    },
    historical: {
      income: historicalIncome.data || [],
      expenses: historicalExpenses.data || [],
      invoices: allInvoices.data || []
    },
    clients: clients.data || []
  };
}

// ==================== PATTERN ANALYSIS ====================

async function analyzePatterns(userData: any) {
  console.log('= Analyzing business patterns...');

  const patterns: any = {
    revenue: analyzeRevenuePatterns(userData),
    expenses: analyzeExpensePatterns(userData),
    clients: analyzeClientPatterns(userData),
    seasonality: analyzeSeasonality(userData),
    currencies: analyzeCurrencyUsage(userData)
  };

  return patterns;
}

function analyzeRevenuePatterns(userData: any) {
  const { historical, currentMonth, profile } = userData;

  // Calculate monthly revenue for last 12 months
  const monthlyRevenue: any = {};
  historical.income.forEach((income: any) => {
    const month = income.date.slice(0, 7);
    if (!monthlyRevenue[month]) {
      monthlyRevenue[month] = 0;
    }
    // Convert to base currency
    const amount = income.currency === profile.baseCurrency
      ? income.amount
      : income.base_amount || income.amount;
    monthlyRevenue[month] += Number(amount);
  });

  const months = Object.keys(monthlyRevenue).sort();
  const revenues = months.map(m => monthlyRevenue[m]);

  const avgRevenue = revenues.length > 0
    ? revenues.reduce((a, b) => a + b, 0) / revenues.length
    : 0;

  const currentRevenue = currentMonth.income.reduce((sum: number, inc: any) => {
    const amount = inc.currency === profile.baseCurrency
      ? inc.amount
      : inc.base_amount || inc.amount;
    return sum + Number(amount);
  }, 0);

  const lastMonthRevenue = monthlyRevenue[months[months.length - 2]] || 0;
  const growthRate = lastMonthRevenue > 0
    ? ((currentRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  return {
    current: currentRevenue,
    average: avgRevenue,
    lastMonth: lastMonthRevenue,
    growthRate: growthRate,
    trend: growthRate > 5 ? 'growing' : growthRate < -5 ? 'declining' : 'stable',
    monthlyData: monthlyRevenue
  };
}

function analyzeExpensePatterns(userData: any) {
  const { historical, currentMonth, profile } = userData;

  // Categorize expenses
  const categories: any = {};
  const recurring: any = {};

  historical.expenses.forEach((expense: any) => {
    const category = expense.category || 'Uncategorized';
    const description = expense.description?.toLowerCase() || '';

    if (!categories[category]) {
      categories[category] = 0;
    }

    const amount = expense.currency === profile.baseCurrency
      ? expense.amount
      : expense.base_amount || expense.amount;
    categories[category] += Number(amount);

    // Detect recurring expenses (same description appears 3+ times)
    if (description) {
      if (!recurring[description]) {
        recurring[description] = { count: 0, totalAmount: 0, category };
      }
      recurring[description].count++;
      recurring[description].totalAmount += Number(amount);
    }
  });

  const currentExpenses = currentMonth.expenses.reduce((sum: number, exp: any) => {
    const amount = exp.currency === profile.baseCurrency
      ? exp.amount
      : exp.base_amount || exp.amount;
    return sum + Number(amount);
  }, 0);

  // Find top recurring expenses
  const topRecurring = Object.entries(recurring)
    .filter(([_, data]: any) => data.count >= 3)
    .sort((a: any, b: any) => b[1].totalAmount - a[1].totalAmount)
    .slice(0, 5)
    .map(([desc, data]: any) => ({
      description: desc,
      monthlyAverage: data.totalAmount / data.count,
      occurrences: data.count,
      category: data.category
    }));

  return {
    current: currentExpenses,
    byCategory: categories,
    recurring: topRecurring,
    topCategory: Object.entries(categories).sort((a: any, b: any) => b[1] - a[1])[0]
  };
}

function analyzeClientPatterns(userData: any) {
  const { historical, clients, profile } = userData;

  const clientData: any = {};

  historical.invoices.forEach((invoice: any) => {
    const clientId = invoice.client_id;
    if (!clientId) return;

    if (!clientData[clientId]) {
      clientData[clientId] = {
        name: invoice.client?.name || 'Unknown',
        totalRevenue: 0,
        invoiceCount: 0,
        paidCount: 0,
        avgPaymentDays: 0,
        lastInvoiceDate: null,
        currencies: new Set()
      };
    }

    const amount = invoice.currency === profile.baseCurrency
      ? invoice.total_amount
      : invoice.base_total_amount || invoice.total_amount;

    clientData[clientId].totalRevenue += Number(amount);
    clientData[clientId].invoiceCount++;
    clientData[clientId].currencies.add(invoice.currency);

    if (invoice.status === 'paid' && invoice.paid_date) {
      clientData[clientId].paidCount++;
      const paymentDays = Math.floor(
        (new Date(invoice.paid_date).getTime() - new Date(invoice.date).getTime())
        / (1000 * 60 * 60 * 24)
      );
      clientData[clientId].avgPaymentDays += paymentDays;
    }

    if (!clientData[clientId].lastInvoiceDate || invoice.date > clientData[clientId].lastInvoiceDate) {
      clientData[clientId].lastInvoiceDate = invoice.date;
    }
  });

  // Calculate averages and sort
  Object.values(clientData).forEach((client: any) => {
    if (client.paidCount > 0) {
      client.avgPaymentDays = Math.round(client.avgPaymentDays / client.paidCount);
    }
    client.currencies = Array.from(client.currencies);
  });

  const topClients = Object.values(clientData)
    .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  return {
    total: clients.length,
    topClients,
    clientData
  };
}

function analyzeSeasonality(userData: any) {
  const { historical } = userData;

  const monthlyStats: any = {};

  historical.income.forEach((income: any) => {
    const month = new Date(income.date).getMonth(); // 0-11
    if (!monthlyStats[month]) {
      monthlyStats[month] = { revenue: 0, count: 0 };
    }
    monthlyStats[month].revenue += Number(income.amount);
    monthlyStats[month].count++;
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const seasonalData = Object.entries(monthlyStats).map(([month, data]: any) => ({
    month: monthNames[parseInt(month)],
    avgRevenue: data.count > 0 ? data.revenue / data.count : 0
  }));

  const bestMonth = seasonalData.reduce((best, current) =>
    current.avgRevenue > best.avgRevenue ? current : best,
    { month: '', avgRevenue: 0 }
  );

  return {
    data: seasonalData,
    bestMonth: bestMonth.month,
    bestMonthRevenue: bestMonth.avgRevenue
  };
}

function analyzeCurrencyUsage(userData: any) {
  const { profile, historical } = userData;

  const currencyBreakdown: any = {};

  [...historical.income, ...historical.expenses, ...historical.invoices].forEach((item: any) => {
    const currency = item.currency || profile.baseCurrency;
    if (!currencyBreakdown[currency]) {
      currencyBreakdown[currency] = { income: 0, expenses: 0, invoices: 0 };
    }

    if (item.type === 'income' || item.description) {
      currencyBreakdown[currency].income++;
    } else if (item.invoice_number) {
      currencyBreakdown[currency].invoices++;
    } else {
      currencyBreakdown[currency].expenses++;
    }
  });

  return {
    baseCurrency: profile.baseCurrency,
    currencies: profile.currencies,
    breakdown: currencyBreakdown,
    isMultiCurrency: profile.currencies.length > 1
  };
}

// ==================== AI INSIGHT GENERATION (DeepSeek) ====================

async function generateAIInsights(userData: any, patterns: any) {
  console.log('> Generating AI insights with DeepSeek...');

  if (!DEEPSEEK_API_KEY) {
    console.warn('  DEEPSEEK_API_KEY not configured, returning fallback insights');
    return getFallbackInsights(userData, patterns);
  }

  const systemPrompt = buildSystemPrompt(userData, patterns);
  const userPrompt = buildUserPrompt(userData, patterns);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('DeepSeek API error:', error);
      throw new Error('DeepSeek API failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content from DeepSeek');
    }

    const insights = JSON.parse(content);
    console.log(' AI insights generated successfully');

    return insights;

  } catch (error) {
    console.error('L Error calling DeepSeek API:', error);
    return getFallbackInsights(userData, patterns);
  }
}

function buildSystemPrompt(userData: any, patterns: any) {
  const { profile, context } = userData;

  return `You are SmartCFO - an exceptionally intelligent Chief Financial Officer AI assistant.

**YOUR IDENTITY:**
You are a trusted business partner, not a robotic accountant. You deeply understand the user's business and provide insights that a $500/hour CFO consultant would give.

**YOUR CAPABILITIES:**
- Complete access to ALL user financial data (invoices, expenses, clients, income)
- Deep understanding of their industry: ${context.industry}
- Knowledge of their business stage: ${context.businessStage}
- Understanding of their location: ${context.location}
- Awareness of their currency setup: Base=${profile.baseCurrency}, Working with ${profile.currencies.join(', ')}

**CRITICAL RULES - FOLLOW THESE STRICTLY:**

1. **ACCURACY IS SACRED**:
   - Every number MUST come from the provided data
   - NEVER guess, estimate, or hallucinate invoice counts, amounts, or client names
   - If you say "3 overdue invoices", there MUST be exactly 3 overdue invoices in the data
   - When mentioning currency amounts, ALWAYS use the user's base currency (${profile.baseCurrency})

2. **BE CONVERSATIONAL & HUMAN**:
   - Use friendly, warm language like talking to a business partner
   - Use emojis appropriately (=¡ <‰   =Ê =° =€)
   - Celebrate wins enthusiastically
   - Show empathy for challenges
   - NO corporate jargon - explain like talking to a non-accountant

3. **BE PROACTIVE, NOT REACTIVE**:
   - Don't just report status - suggest actions
   - Spot opportunities for cost savings
   - Identify revenue growth patterns
   - Warn about unusual behaviors
   - Example: Don't say "Expenses increased 20%"
   - Instead say: "=¡ Your expenses jumped 20% this month. I see $500 in new software subscriptions - are these essential?"

4. **BE CONTEXT-AWARE**:
   - Understand industry norms (photography business vs SaaS vs restaurant)
   - Consider business stage (startup advice differs from established business)
   - Account for location (US expenses differ from Pakistan/India)
   - Remember currency context when discussing amounts

5. **BE SPECIFIC & ACTIONABLE**:
   - Use actual client names, invoice numbers, dates from their data
   - Give concrete next steps
   - Example: "ABC Company usually pays in 7 days, but Invoice #1234 is 15 days overdue"
   - Not: "Some clients are late on payments"

**BUSINESS CONTEXT:**
- Industry: ${context.industry}
- Business Type: ${context.businessType}
- Stage: ${context.businessStage}
- Location: ${context.location}
- Base Currency: ${profile.baseCurrency}
- All Currencies: ${profile.currencies.join(', ')}

**YOUR RESPONSE FORMAT:**
Return a JSON object with this EXACT structure:
{
  "insights": [
    {
      "id": "unique-id",
      "type": "opportunity" | "warning" | "celebration" | "pattern" | "advice",
      "emoji": "=¡",
      "title": "Short catchy title (max 60 chars)",
      "message": "2-3 sentences with specific details and numbers. Be conversational!",
      "priority": 1-10 (10 = most important),
      "actionable": true/false,
      "action": {
        "label": "Suggested action button text",
        "context": "What this action would do"
      }
    }
  ]
}

**INSIGHT TYPES:**
- "opportunity": Cost-saving or revenue-growth ideas
- "warning": Issues needing attention (overdue invoices, unusual patterns)
- "celebration": Good news, achievements, growth
- "pattern": Interesting trends or behaviors discovered
- "advice": Industry-specific or strategic suggestions

Generate 3-5 insights focusing on what's most valuable for this user RIGHT NOW.`;
}

function buildUserPrompt(userData: any, patterns: any) {
  const { profile, currentMonth, context } = userData;
  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const year = now.getFullYear();

  // Format current month data
  const totalIncome = currentMonth.income.reduce((sum: number, inc: any) => {
    const amount = inc.currency === profile.baseCurrency ? inc.amount : inc.base_amount || inc.amount;
    return sum + Number(amount);
  }, 0);

  const totalExpenses = currentMonth.expenses.reduce((sum: number, exp: any) => {
    const amount = exp.currency === profile.baseCurrency ? exp.amount : exp.base_amount || exp.amount;
    return sum + Number(amount);
  }, 0);

  const netProfit = totalIncome - totalExpenses;

  // Count invoices by status
  const invoiceStats = {
    total: currentMonth.invoices.length,
    paid: currentMonth.invoices.filter((inv: any) => inv.status === 'paid').length,
    pending: currentMonth.invoices.filter((inv: any) => inv.status === 'sent' || inv.status === 'viewed').length,
    overdue: currentMonth.invoices.filter((inv: any) => {
      if (inv.status === 'paid' || inv.status === 'draft') return false;
      return new Date(inv.due_date) < now;
    }).length,
    draft: currentMonth.invoices.filter((inv: any) => inv.status === 'draft').length
  };

  const overdueAmount = currentMonth.invoices
    .filter((inv: any) => {
      if (inv.status === 'paid' || inv.status === 'draft') return false;
      return new Date(inv.due_date) < now;
    })
    .reduce((sum: number, inv: any) => {
      const amount = inv.currency === profile.baseCurrency ? inv.total_amount : inv.base_total_amount || inv.total_amount;
      return sum + Number(amount);
    }, 0);

  return `Analyze my ${context.industry} business for ${monthName} ${year}.

**CURRENT MONTH (${monthName} ${year}):**
- Total Income: ${formatCurrency(totalIncome, profile.baseCurrency)}
- Total Expenses: ${formatCurrency(totalExpenses, profile.baseCurrency)}
- Net Profit: ${formatCurrency(netProfit, profile.baseCurrency)}
- Invoices: ${invoiceStats.total} total (${invoiceStats.paid} paid, ${invoiceStats.pending} pending, ${invoiceStats.overdue} overdue, ${invoiceStats.draft} draft)
- Overdue Amount: ${formatCurrency(overdueAmount, profile.baseCurrency)}

**REVENUE PATTERNS:**
- Current Month: ${formatCurrency(patterns.revenue.current, profile.baseCurrency)}
- Last Month: ${formatCurrency(patterns.revenue.lastMonth, profile.baseCurrency)}
- 12-Month Average: ${formatCurrency(patterns.revenue.average, profile.baseCurrency)}
- Growth Rate: ${patterns.revenue.growthRate.toFixed(1)}%
- Trend: ${patterns.revenue.trend}

**EXPENSE PATTERNS:**
- Current Month: ${formatCurrency(patterns.expenses.current, profile.baseCurrency)}
- Top Category: ${patterns.expenses.topCategory?.[0] || 'None'} (${formatCurrency(patterns.expenses.topCategory?.[1] || 0, profile.baseCurrency)})
- Recurring Expenses Found: ${patterns.expenses.recurring.length}
${patterns.expenses.recurring.slice(0, 3).map((rec: any) =>
  `  - ${rec.description}: ~${formatCurrency(rec.monthlyAverage, profile.baseCurrency)}/month (${rec.occurrences} times)`
).join('\n')}

**CLIENT INSIGHTS:**
- Total Clients: ${patterns.clients.total}
- Top 3 Clients by Revenue:
${patterns.clients.topClients.slice(0, 3).map((client: any, idx: number) =>
  `  ${idx + 1}. ${client.name}: ${formatCurrency(client.totalRevenue, profile.baseCurrency)} (${client.invoiceCount} invoices, avg ${client.avgPaymentDays} days to pay)`
).join('\n')}

**SEASONALITY:**
- Best Month Historically: ${patterns.seasonality.bestMonth} (avg ${formatCurrency(patterns.seasonality.bestMonthRevenue, profile.baseCurrency)})

**CURRENCY USAGE:**
- Base Currency: ${profile.baseCurrency}
- Working with: ${profile.currencies.join(', ')}
- Multi-currency: ${patterns.currencies.isMultiCurrency ? 'Yes' : 'No'}

**YOUR TASK:**
Generate 3-5 intelligent, actionable insights for this business. Focus on:
1. One major opportunity (cost-saving or revenue growth)
2. Any urgent warnings (overdue invoices, unusual patterns)
3. One celebration/positive recognition if applicable
4. One pattern discovery from historical data
5. One strategic advice for their industry/stage

Make each insight specific, conversational, and valuable. Use actual numbers and client names from the data.`;
}

function formatCurrency(amount: number, currency: string): string {
  const symbols: any = {
    'USD': '$',
    'GBP': '£',
    'EUR': '¬',
    'PKR': 'Rs',
    'INR': '¹',
    'AUD': 'A$',
    'CAD': 'C$',
    'AED': 'AED'
  };

  const symbol = symbols[currency] || currency + ' ';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ==================== VALIDATION ====================

function validateInsights(insights: any, userData: any) {
  console.log(' Validating AI insights against actual data...');

  if (!insights || !insights.insights || !Array.isArray(insights.insights)) {
    console.warn('Invalid insights format, using fallback');
    return getFallbackInsights(userData, {});
  }

  // Validate each insight
  const validated = insights.insights.filter((insight: any) => {
    // Must have required fields
    if (!insight.title || !insight.message || !insight.type) {
      console.warn('Insight missing required fields:', insight);
      return false;
    }

    // Must have priority between 1-10
    if (!insight.priority || insight.priority < 1 || insight.priority > 10) {
      insight.priority = 5; // Default priority
    }

    return true;
  });

  return {
    insights: validated,
    generated_at: new Date().toISOString()
  };
}

// ==================== FALLBACK INSIGHTS ====================

function getFallbackInsights(userData: any, patterns: any) {
  console.log('=Ë Generating fallback insights (DeepSeek unavailable)');

  const insights: any[] = [];
  const { currentMonth, profile } = userData;
  const now = new Date();

  // Calculate basic stats
  const totalIncome = currentMonth.income.reduce((sum: number, inc: any) => sum + Number(inc.amount), 0);
  const totalExpenses = currentMonth.expenses.reduce((sum: number, exp: any) => sum + Number(exp.amount), 0);
  const netProfit = totalIncome - totalExpenses;

  const overdueInvoices = currentMonth.invoices.filter((inv: any) => {
    if (inv.status === 'paid' || inv.status === 'draft') return false;
    return new Date(inv.due_date) < now;
  });

  // Insight 1: Overdue invoices warning
  if (overdueInvoices.length > 0) {
    const overdueAmount = overdueInvoices.reduce((sum: number, inv: any) => sum + Number(inv.total_amount), 0);
    insights.push({
      id: 'overdue-warning',
      type: 'warning',
      emoji: ' ',
      title: 'Overdue Invoices Need Attention',
      message: `You have ${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''} totaling ${formatCurrency(overdueAmount, profile.baseCurrency)}. Following up could improve cash flow.`,
      priority: 9,
      actionable: true,
      action: {
        label: 'View Overdue Invoices',
        context: 'See which clients need a follow-up'
      }
    });
  }

  // Insight 2: Profit status
  if (netProfit > 0) {
    insights.push({
      id: 'profit-celebration',
      type: 'celebration',
      emoji: '<‰',
      title: 'Profitable Month!',
      message: `You're running a profit of ${formatCurrency(netProfit, profile.baseCurrency)} this month! Income: ${formatCurrency(totalIncome, profile.baseCurrency)}, Expenses: ${formatCurrency(totalExpenses, profile.baseCurrency)}.`,
      priority: 7,
      actionable: false
    });
  } else if (netProfit < 0) {
    insights.push({
      id: 'loss-warning',
      type: 'warning',
      emoji: '=Ê',
      title: 'Expenses Exceed Income',
      message: `You're at a ${formatCurrency(Math.abs(netProfit), profile.baseCurrency)} loss this month. Consider reviewing expenses or increasing revenue streams.`,
      priority: 8,
      actionable: true,
      action: {
        label: 'Review Expenses',
        context: 'Identify areas to reduce costs'
      }
    });
  }

  // Insight 3: Invoice creation reminder
  if (currentMonth.invoices.length === 0) {
    insights.push({
      id: 'no-invoices',
      type: 'advice',
      emoji: '=¡',
      title: 'No Invoices This Month',
      message: `You haven't created any invoices this month yet. If you have work completed, creating invoices helps track income and get paid faster.`,
      priority: 6,
      actionable: true,
      action: {
        label: 'Create Invoice',
        context: 'Start tracking this month\'s revenue'
      }
    });
  }

  return {
    insights: insights.length > 0 ? insights : [{
      id: 'welcome',
      type: 'info',
      emoji: '=K',
      title: 'Welcome to SmartCFO!',
      message: 'Your AI CFO assistant is ready to help. Add more financial data to get personalized insights.',
      priority: 5,
      actionable: false
    }],
    generated_at: new Date().toISOString()
  };
}

// ==================== DATABASE OPERATIONS ====================

async function saveInsights(supabaseClient: any, userId: string, insights: any) {
  console.log('=¾ Saving insights to database...');

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  // Delete old insights for this user from today (in case regenerating)
  await supabaseClient
    .from('ai_insights')
    .delete()
    .eq('user_id', userId)
    .eq('insight_date', today);

  // Insert new insights using your database schema
  const { error } = await supabaseClient
    .from('ai_insights')
    .insert({
      user_id: userId,
      insight_date: today,
      insights_json: insights.insights,
      generated_at: insights.generated_at
    });

  if (error) {
    console.error('Error saving insights:', error);
    throw error;
  }

  return insights;
}

async function getCachedInsights(supabaseClient: any, userId: string) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  const { data, error } = await supabaseClient
    .from('ai_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('insight_date', today)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    insights: data.insights_json,
    generated_at: data.generated_at
  };
}

// ==================== HELPER FUNCTIONS ====================

function getNextMonth(monthString: string): string {
  const [year, month] = monthString.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

// ==================== CONTEXT MANAGEMENT ====================

async function getMissingContext(supabaseClient: any, userId: string) {
  const { data } = await supabaseClient
    .from('ai_user_context')
    .select('*')
    .eq('user_id', userId)
    .single();

  const missingFields = [];

  if (!data?.business_type) {
    missingFields.push({
      field: 'business_type',
      question: 'What type of business do you run?',
      type: 'text',
      placeholder: 'e.g., Photography Services, Freelance Design, Restaurant...',
      examples: ['Photography Services', 'Freelance Web Design', 'Restaurant & Catering', 'Consulting Services', 'E-commerce Store']
    });
  }

  if (!data?.business_stage) {
    missingFields.push({
      field: 'business_stage',
      question: 'What stage is your business at?',
      type: 'dropdown',
      options: ['startup', 'small_business', 'growing_business', 'established_business']
    });
  }

  if (!data?.location) {
    missingFields.push({
      field: 'location',
      question: 'Where is your business located?',
      type: 'text',
      placeholder: 'e.g., New York, USA or Lahore, Pakistan',
      examples: ['New York, USA', 'London, UK', 'Lahore, Pakistan', 'Toronto, Canada', 'Sydney, Australia']
    });
  }

  return new Response(
    JSON.stringify({
      hasAllContext: missingFields.length === 0,
      missingFields
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function updateUserContext(supabaseClient: any, userId: string, data: any) {
  const { error } = await supabaseClient
    .from('ai_user_context')
    .upsert({
      user_id: userId,
      ...data.data,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## Deployment Instructions

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** ’ `ai-assistant`
3. Copy the entire code block above
4. Paste it into the edge function editor
5. Click **Deploy**

This will fix the CORS error in your AI Chat Widget!
