-- ============================================
-- Migration: Add account_id to trading_journal
-- Date: 2026-02-06
-- Description: 
--   1. Add account_id column to trading_journal
--   2. Create default accounts for users with existing trades
--   3. Assign existing trades to default accounts
--   4. Make account_id NOT NULL
-- ============================================

-- Step 1: Add nullable account_id column
ALTER TABLE trading_journal 
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- Step 2: Create default accounts for users who have existing trades but no accounts
INSERT INTO accounts (user_id, account_name, broker_name, is_default)
SELECT DISTINCT tj.user_id, 'Default Account', 'Unknown', TRUE
FROM trading_journal tj
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.user_id = tj.user_id
)
ON CONFLICT DO NOTHING;

-- Step 3: Assign existing trades to their user's default account
UPDATE trading_journal tj
SET account_id = (
    SELECT a.id 
    FROM accounts a 
    WHERE a.user_id = tj.user_id 
    AND a.is_default = TRUE
    LIMIT 1
)
WHERE tj.account_id IS NULL;

-- Step 4: Make account_id NOT NULL after migration
-- Note: Only uncomment after verifying all trades have account_id
-- ALTER TABLE trading_journal ALTER COLUMN account_id SET NOT NULL;

-- Step 5: Create index for account queries
CREATE INDEX IF NOT EXISTS idx_trading_journal_account_id 
ON trading_journal(account_id);

-- Step 6: Create composite index for efficient filtered queries
CREATE INDEX IF NOT EXISTS idx_trading_journal_account_exit_time 
ON trading_journal(account_id, exit_time DESC);
