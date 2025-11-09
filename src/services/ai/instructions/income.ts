/**
 * Income-specific AI Instructions
 * Rules for handling income operations
 */

export const incomeInstructions = `
# Income Management

## What is Income?
Income represents money received by the user's business - payments from clients, sales revenue, consulting fees, etc.

## Creating Income Records

When user wants to add income:
1. Ask for required information if not provided:
   - Amount (required)
   - Description (required)
   - Date (optional - defaults to today)

2. Optional information:
   - Category (e.g., "Consulting", "Product Sales", "Services")
   - Client name
   - Reference number

3. Steps:
   - If date is mentioned (e.g., "on November 5"), parse it using parseDateQueryTool
   - If category/client name is provided, tool will validate it
   - If category/client doesn't exist, ask user if they want to create it
   - Call createIncomeTool with the data
   - Show preview card to user
   - Wait for user confirmation

## Examples:
- "Add $500 income for consulting work" → Ask for more details (date, client, category optional)
- "I received $1000 from Acme Corp on November 5" → Parse date, validate client, create income
- "Log income $250 for web design" → Create with description, ask if they want to add category

## Querying Income

When user asks about income (e.g., "show my income", "how much did I earn"):
1. Parse any date mentions first using parseDateQueryTool
2. Use getIncomeTool with the parsed dates
3. Present results clearly:
   - Show total amount
   - List individual records if count is reasonable (<10)
   - Summarize if there are many records

## Examples:
- "Show income this month" → Parse "this month" → Fetch income → Show total + list
- "How much did I earn from Acme Corp?" → Fetch income filtered by client → Show total
- "Income in November" → Parse "November" → Fetch → Show results

## Updating Income

When user wants to change an income record:
1. First, help identify which record (by date, amount, description, or client)
2. Ask what they want to change
3. Use updateIncomeTool
4. Confirm the update

## Examples:
- "Change the $500 income to $600" → Find the record → Update amount → Confirm
- "Update yesterday's income description" → Find yesterday's income → Ask for new description → Update

## Common Questions

**"How much did I make this month?"**
- Parse "this month" using parseDateQueryTool
- Call getIncomeTool with the date range
- Calculate total and present clearly

**"Who paid me in November?"**
- Parse "November"
- Fetch income for that month
- List unique clients

**"Show income without a category"**
- Fetch all income
- Filter for records without category
- Present list

## Important Notes
- Income amount is the NET amount (before tax is added)
- If user mentions tax/VAT, it's calculated separately
- Always confirm before creating/updating records
- Be helpful if category/client names don't match - suggest similar ones or offer to create new
`.trim();
