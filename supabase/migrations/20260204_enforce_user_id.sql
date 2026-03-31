-- ============================================
-- Migration: Enforce Multi-tenant Isolation
-- Date: 2026-02-04
-- Description: 
--   1. Set user_id NOT NULL
--   2. Enable strict RLS policies
-- ============================================

-- Step 1: 清理任何无 user_id 的孤立数据（如果存在）
DELETE FROM trading_journal WHERE user_id IS NULL;

-- Step 2: 添加 NOT NULL 约束
ALTER TABLE trading_journal 
ALTER COLUMN user_id SET NOT NULL;

-- Step 3: 添加外键约束（如果尚未存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'trading_journal_user_id_fkey'
    ) THEN
        ALTER TABLE trading_journal
        ADD CONSTRAINT trading_journal_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: 启用 RLS（如果尚未启用）
ALTER TABLE trading_journal ENABLE ROW LEVEL SECURITY;

-- Step 5: 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can view own trades" ON trading_journal;
DROP POLICY IF EXISTS "Users can insert own trades" ON trading_journal;
DROP POLICY IF EXISTS "Users can update own trades" ON trading_journal;
DROP POLICY IF EXISTS "Users can delete own trades" ON trading_journal;

-- Step 6: 创建严格的 RLS 策略
CREATE POLICY "Users can view own trades"
ON trading_journal FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
ON trading_journal FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
ON trading_journal FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
ON trading_journal FOR DELETE
USING (auth.uid() = user_id);

-- Step 7: 添加索引以优化 RLS 查询性能
CREATE INDEX IF NOT EXISTS idx_trading_journal_user_id 
ON trading_journal(user_id);
