-- ============================================
-- Backtesting Tables
-- ============================================

-- Backtest Sessions: Group individual backtests by strategy or period
CREATE TABLE IF NOT EXISTS backtest_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    initial_balance NUMERIC NOT NULL DEFAULT 10000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backtest Trades: Individual trades within a session
CREATE TABLE IF NOT EXISTS backtest_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES backtest_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol TEXT,
    entry_price NUMERIC,
    exit_price NUMERIC,
    pnl NUMERIC NOT NULL,
    rrr NUMERIC, -- Risk:Reward Ratio
    result TEXT CHECK (result IN ('win', 'loss', 'breakeven')),
    notes TEXT,
    screenshot_url TEXT,
    trade_time TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_backtest_sessions_user_id ON backtest_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_session_id ON backtest_trades(session_id);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_user_id ON backtest_trades(user_id);

-- RLS (Row Level Security)
ALTER TABLE backtest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_trades ENABLE ROW LEVEL SECURITY;

-- Sessions Policy
CREATE POLICY "Users can manage their own backtest sessions"
    ON backtest_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trades Policy
CREATE POLICY "Users can manage their own backtest trades"
    ON backtest_trades FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated at trigger for sessions
CREATE TRIGGER trigger_backtest_sessions_updated_at
    BEFORE UPDATE ON backtest_sessions
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();
