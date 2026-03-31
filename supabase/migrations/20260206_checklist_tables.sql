-- ============================================
-- Pre-Trade Checklist Tables
-- ============================================
-- checklist_templates: User's custom checklist rules
-- checklist_logs: Snapshots of each pre-trade check

-- ============================================
-- Checklist Templates Table
-- ============================================

CREATE TABLE IF NOT EXISTS checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('session', 'setup', 'execution', 'emotional')),
    item_text TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_checklist_templates_user_id ON checklist_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_account_id ON checklist_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_category ON checklist_templates(category);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_sort ON checklist_templates(user_id, account_id, category, sort_order);

-- RLS policies
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates"
    ON checklist_templates FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
    ON checklist_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
    ON checklist_templates FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
    ON checklist_templates FOR DELETE
    USING (auth.uid() = user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_checklist_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_checklist_templates_updated_at
    BEFORE UPDATE ON checklist_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_checklist_templates_updated_at();

-- ============================================
-- Checklist Logs Table
-- ============================================

CREATE TABLE IF NOT EXISTS checklist_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    trade_id UUID REFERENCES trading_journal(id) ON DELETE SET NULL,
    checked_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Format: [{template_id, item_text, checked, category}]
    all_passed BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checklist_logs_user_id ON checklist_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_logs_account_id ON checklist_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_checklist_logs_trade_id ON checklist_logs(trade_id);
CREATE INDEX IF NOT EXISTS idx_checklist_logs_created_at ON checklist_logs(created_at DESC);

-- RLS policies
ALTER TABLE checklist_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own logs"
    ON checklist_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own logs"
    ON checklist_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
    ON checklist_logs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
    ON checklist_logs FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- Default Template Seeding Function
-- ============================================
-- Call this function to seed default checklist items for a new user

CREATE OR REPLACE FUNCTION seed_default_checklist_templates(p_user_id UUID, p_account_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
    -- Session category
    INSERT INTO checklist_templates (user_id, account_id, category, item_text, sort_order)
    VALUES 
        (p_user_id, p_account_id, 'session', 'Trading session time is correct (London/NY overlap)', 1),
        (p_user_id, p_account_id, 'session', 'No major news events in next 30 minutes', 2),
        (p_user_id, p_account_id, 'session', 'Daily loss limit not reached', 3);

    -- Setup category
    INSERT INTO checklist_templates (user_id, account_id, category, item_text, sort_order)
    VALUES 
        (p_user_id, p_account_id, 'setup', 'Clear trend direction identified', 1),
        (p_user_id, p_account_id, 'setup', 'Key support/resistance levels marked', 2),
        (p_user_id, p_account_id, 'setup', 'Entry trigger confirmed', 3),
        (p_user_id, p_account_id, 'setup', 'Risk:Reward ratio >= 1:2', 4);

    -- Execution category
    INSERT INTO checklist_templates (user_id, account_id, category, item_text, sort_order)
    VALUES 
        (p_user_id, p_account_id, 'execution', 'Stop loss placed before entry', 1),
        (p_user_id, p_account_id, 'execution', 'Position size calculated correctly', 2),
        (p_user_id, p_account_id, 'execution', 'Take profit levels defined', 3);

    -- Emotional category
    INSERT INTO checklist_templates (user_id, account_id, category, item_text, sort_order)
    VALUES 
        (p_user_id, p_account_id, 'emotional', 'Feeling calm and focused', 1),
        (p_user_id, p_account_id, 'emotional', 'Not revenge trading', 2),
        (p_user_id, p_account_id, 'emotional', 'Following the plan, not FOMO', 3);
END;
$$ LANGUAGE plpgsql;
