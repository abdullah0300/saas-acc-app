-- =====================================================
-- AI Learning System Migration
-- Adds conversational intelligence and smart suggestions
-- =====================================================

-- Step 1: Add AI columns to user_settings table
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS ai_preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ai_learned_patterns JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ai_shortcuts JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.ai_preferences IS 'User AI preferences: favorite_clients, frequent_categories, typical_amounts, payment_terms, etc.';
COMMENT ON COLUMN user_settings.ai_learned_patterns IS 'AI learned patterns: expense_patterns, income_patterns, common_queries, description_templates';
COMMENT ON COLUMN user_settings.ai_shortcuts IS 'User-defined AI shortcuts for quick commands';

-- Step 2: Create ai_user_interactions table
CREATE TABLE IF NOT EXISTS ai_user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Interaction details
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('query', 'correction', 'confirmation', 'rejection')),
  query_text TEXT,
  ai_response TEXT,

  -- Entity details
  entity_type TEXT CHECK (entity_type IN ('income', 'expense', 'invoice', 'client', 'category', 'project', 'budget', 'vendor')),
  entity_id UUID,

  -- Learning data
  ai_suggested_value JSONB,
  user_chosen_value JSONB,

  -- Context
  context_data JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_id ON ai_user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_type ON ai_user_interactions(user_id, interaction_type);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_entity ON ai_user_interactions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_created ON ai_user_interactions(created_at DESC);

-- Add comments
COMMENT ON TABLE ai_user_interactions IS 'Tracks all AI interactions for learning user patterns and improving suggestions';
COMMENT ON COLUMN ai_user_interactions.interaction_type IS 'Type of interaction: query (user asked), correction (user fixed AI), confirmation (user accepted), rejection (user cancelled)';
COMMENT ON COLUMN ai_user_interactions.ai_suggested_value IS 'What the AI suggested (for corrections/confirmations)';
COMMENT ON COLUMN ai_user_interactions.user_chosen_value IS 'What the user actually chose (for corrections)';
COMMENT ON COLUMN ai_user_interactions.context_data IS 'Additional context: conversation_id, client_id, vendor, etc.';

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE ai_user_interactions ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies
-- Policy: Users can only see their own interactions
CREATE POLICY ai_interactions_user_select_policy ON ai_user_interactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own interactions
CREATE POLICY ai_interactions_user_insert_policy ON ai_user_interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own interactions
CREATE POLICY ai_interactions_user_update_policy ON ai_user_interactions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own interactions
CREATE POLICY ai_interactions_user_delete_policy ON ai_user_interactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Step 5: Create helper function to clean old interactions (optional, for data retention)
CREATE OR REPLACE FUNCTION clean_old_ai_interactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete interactions older than 180 days (6 months)
  DELETE FROM ai_user_interactions
  WHERE created_at < NOW() - INTERVAL '180 days';

  RAISE NOTICE 'Cleaned old AI interactions';
END;
$$;

COMMENT ON FUNCTION clean_old_ai_interactions IS 'Deletes AI interactions older than 180 days to maintain database size';

-- Step 6: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_user_interactions TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- =====================================================
-- Migration Complete
-- =====================================================
--
-- What this migration adds:
-- 1. ai_preferences - Stores user preferences (favorite clients, typical amounts)
-- 2. ai_learned_patterns - Stores AI-learned patterns (vendor→category, client→amount)
-- 3. ai_shortcuts - Stores user-defined shortcuts ("my usual invoice")
-- 4. ai_user_interactions - Tracks all AI interactions for learning
-- 5. RLS policies - Ensures data privacy
-- 6. Indexes - Optimizes query performance
--
-- How it works:
-- - When user interacts with AI (creates income, confirms suggestion, corrects category)
-- - Interaction is logged to ai_user_interactions
-- - Pattern analysis runs periodically (daily or every N interactions)
-- - Patterns are saved to ai_learned_patterns in user_settings
-- - Next time user creates income/expense, AI suggests based on patterns
--
-- Example learned pattern:
-- {
--   "income_patterns": {
--     "client-abc-id": {
--       "typical_amount": 5000,
--       "typical_category_id": "cat-consulting",
--       "typical_description": "Monthly Consulting Services",
--       "confidence": 0.92,
--       "frequency": 12
--     }
--   },
--   "expense_patterns": {
--     "Starbucks": {
--       "category_id": "cat-meals",
--       "category_name": "Meals",
--       "confidence": 0.95,
--       "frequency": 23
--     }
--   }
-- }
-- =====================================================
