-- ============================================
-- Migration: Create Accounts Table
-- Date: 2026-02-06
-- Description: 
--   Create accounts table for multi-account management
--   with RLS policies for user isolation
-- ============================================

-- Step 1: Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    broker_name TEXT,
    initial_balance DECIMAL(12,2) DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create unique partial index for one default per user
CREATE UNIQUE INDEX idx_accounts_one_default_per_user 
ON accounts (user_id) 
WHERE is_default = TRUE;

-- Step 3: Create index for user queries
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Step 4: Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Users can view own accounts"
ON accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
ON accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
ON accounts FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
ON accounts FOR DELETE
USING (auth.uid() = user_id);

-- Step 6: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger for updated_at
DROP TRIGGER IF EXISTS accounts_updated_at_trigger ON accounts;
CREATE TRIGGER accounts_updated_at_trigger
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION update_accounts_updated_at();
