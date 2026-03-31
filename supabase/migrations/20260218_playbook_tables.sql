-- ============================================
-- Playbook Tables
-- ============================================

-- Playbook Setups: Define your trading models/setups
CREATE TABLE IF NOT EXISTS playbook_setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    timeframe TEXT,
    win_rate_target NUMERIC DEFAULT 50,
    screenshot_url TEXT, -- Example of a perfect setup
    rules JSONB DEFAULT '[]'::jsonb, -- List of entry/exit rules
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user isolation
CREATE INDEX IF NOT EXISTS idx_playbook_setups_user_id ON playbook_setups(user_id);

-- RLS
ALTER TABLE playbook_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own playbook setups"
    ON playbook_setups FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_playbook_setups_updated_at
    BEFORE UPDATE ON playbook_setups
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Add playbook_setup_id to trading_journal and backtest_trades to link them
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trading_journal' AND column_name = 'playbook_setup_id') THEN
        ALTER TABLE trading_journal ADD COLUMN playbook_setup_id UUID REFERENCES playbook_setups(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backtest_trades' AND column_name = 'playbook_setup_id') THEN
        ALTER TABLE backtest_trades ADD COLUMN playbook_setup_id UUID REFERENCES playbook_setups(id) ON DELETE SET NULL;
    END IF;
END $$;
