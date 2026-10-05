-- ============================================
-- Daily Journal
-- ============================================
-- Per-trade write-ups (Full / Basic template answers) and one note per user
-- per day. Idempotent: safe to re-run on the live DB (which has drifted from
-- these files).

ALTER TABLE public.trading_journal
    ADD COLUMN IF NOT EXISTS review_template TEXT;
ALTER TABLE public.trading_journal
    ADD COLUMN IF NOT EXISTS review_answers JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trading_journal_review_template_check') THEN
        ALTER TABLE public.trading_journal
            ADD CONSTRAINT trading_journal_review_template_check
            CHECK (review_template IS NULL OR review_template IN ('full', 'basic'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trading_journal_review_answers_size_check') THEN
        ALTER TABLE public.trading_journal
            ADD CONSTRAINT trading_journal_review_answers_size_check
            CHECK (octet_length(review_answers::text) <= 20000);
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.daily_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note_date DATE NOT NULL,
    note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 5000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, note_date)
);

ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own daily notes" ON public.daily_notes;
CREATE POLICY "Users can view their own daily notes"
    ON public.daily_notes FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own daily notes" ON public.daily_notes;
CREATE POLICY "Users can create their own daily notes"
    ON public.daily_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own daily notes" ON public.daily_notes;
CREATE POLICY "Users can update their own daily notes"
    ON public.daily_notes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_daily_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_daily_notes_updated_at ON public.daily_notes;
CREATE TRIGGER trigger_daily_notes_updated_at
    BEFORE UPDATE ON public.daily_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_daily_notes_updated_at();
