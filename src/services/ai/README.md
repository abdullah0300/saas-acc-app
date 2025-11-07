# AI Service Structure 🤖

This folder contains the AI chatbot system organized in a clean, modular way.

## 📁 Folder Structure

```
src/services/ai/
│
├── tools/                        # All AI tools
│   ├── shared/                   # Shared tools (used by multiple features)
│   │   ├── dateTools.ts         # Date parsing (today, November 5, etc.)
│   │   ├── clientTools.ts       # Client operations (get, create)
│   │   └── categoryTools.ts     # Category operations (get, create)
│   │
│   └── income/                   # Income-specific tools
│       └── incomeTools.ts       # Create, read, update income
│
├── instructions/                 # AI behavior instructions
│   ├── shared.ts                # General AI behavior (all features)
│   └── income.ts                # Income-specific instructions
│
├── deepseekService.ts           # Main AI service (registers tools)
├── chatConversationService.ts   # Chat conversation database
├── pendingActionsService.ts     # Preview actions before executing
└── userSettingsService.ts       # User context (currency, country, etc.)
```

## 🔧 How It Works

### 1. Tools
Tools are functions the AI can call to perform actions.

**Shared Tools** (in `tools/shared/`):
- Used by multiple features (income, expenses, invoices)
- Examples: date parsing, client management, categories

**Feature Tools** (in `tools/income/`, `tools/expenses/`, etc.):
- Specific to one feature
- Examples: create income, get income, update income

### 2. Instructions
Instructions tell the AI how to behave and when to use tools.

**Shared Instructions** (`instructions/shared.ts`):
- General behavior (be friendly, confirm before actions, etc.)
- Rules that apply everywhere

**Feature Instructions** (`instructions/income.ts`):
- Specific to one feature
- Examples: how to create income, what questions to ask

### 3. Main Service
`deepseekService.ts` is the main service that:
- Imports all tools
- Imports all instructions
- Registers tools with the AI
- Handles communication with DeepSeek API

## ✅ Current Features

### Income Management (Active)
- ✅ Create income records
- ✅ Search/filter income
- ✅ Update income
- ✅ Parse dates (natural language)
- ✅ Manage clients
- ✅ Manage categories

### Coming Soon
- ⏳ Expenses
- ⏳ Invoices
- ⏳ Reports

## 🚀 Adding New Features

To add expenses (for example):

1. **Create tools** in `tools/expenses/expenseTools.ts`
2. **Create instructions** in `instructions/expenses.ts`
3. **Update** `deepseekService.ts`:
   - Import the new tools
   - Import the new instructions
   - Register tools in `getToolsDefinition()`
   - Add cases in `executeToolCall()`
   - Include instructions in `buildSystemPrompt()`

That's it! The new feature will work with existing shared tools (dates, clients, categories).

## 📝 Important Notes

- Tools should be **simple** - just do one thing well
- Instructions should be **clear** - no "MUST", "CRITICAL", or complex rules
- Let the AI decide when to use tools - don't force workflows
- Optional fields should be **truly optional** - don't block on missing data
- Always show preview before executing actions
