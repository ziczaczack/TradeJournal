-- ============================================
-- Fix: Assign account_id to existing trades
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Check if there are trades without account_id
SELECT COUNT(*) as trades_without_account
FROM trading_journal 
WHERE account_id IS NULL;

-- Step 2: Check if accounts table exists and has data
SELECT COUNT(*) as total_accounts FROM accounts;

-- Step 3: Create default accounts for users who have trades but no accounts
INSERT INTO accounts (user_id, account_name, broker_name, is_default)
SELECT DISTINCT tj.user_id, 'Default Account', 'Unknown', TRUE
FROM trading_journal tj
WHERE tj.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.user_id = tj.user_id
)
ON CONFLICT DO NOTHING;

-- Step 4: Assign trades to their user's default account
UPDATE trading_journal tj
SET account_id = (
    SELECT a.id 
    FROM accounts a 
    WHERE a.user_id = tj.user_id 
    AND a.is_default = TRUE
    LIMIT 1
)
WHERE tj.account_id IS NULL;

-- Step 5: Verify all trades now have account_id
SELECT 
    COUNT(*) as total_trades,
    COUNT(account_id) as trades_with_account,
    COUNT(*) - COUNT(account_id) as trades_without_account
FROM trading_journal;

-- Step 6: Show trades per account
SELECT 
    a.account_name,
    a.broker_name,
    COUNT(tj.id) as trade_count
FROM accounts a
LEFT JOIN trading_journal tj ON tj.account_id = a.id
GROUP BY a.id, a.account_name, a.broker_name;
