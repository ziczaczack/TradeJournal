-- ============================================
-- Mistake Tags
-- ============================================
-- Per-user list of mistakes a trader can tag on a trade, plus the per-trade
-- tag ids and a reviewed flag. Idempotent: safe to re-run on the live DB
-- (which has drifted from these files).

CREATE TABLE IF NOT EXISTS public.mistake_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness; also what makes default seeding race-safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mistake_tags_user_name
    ON public.mistake_tags (user_id, (lower(name)));

ALTER TABLE public.mistake_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own mistake tags" ON public.mistake_tags;
CREATE POLICY "Users can view their own mistake tags"
    ON public.mistake_tags FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own mistake tags" ON public.mistake_tags;
CREATE POLICY "Users can create their own mistake tags"
    ON public.mistake_tags FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own mistake tags" ON public.mistake_tags;
CREATE POLICY "Users can update their own mistake tags"
    ON public.mistake_tags FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- No delete policy: tags are hidden, never deleted, so old trades keep meaning.

ALTER TABLE public.trading_journal
    ADD COLUMN IF NOT EXISTS mistake_tag_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.trading_journal
    ADD COLUMN IF NOT EXISTS mistakes_reviewed BOOLEAN NOT NULL DEFAULT false;

-- Seed the default tags for the calling user, only if they have none.
-- ON CONFLICT on the unique index makes concurrent calls safe (no
-- check-then-insert duplicates).
CREATE OR REPLACE FUNCTION public.ensure_default_mistake_tags()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM public.mistake_tags WHERE user_id = auth.uid()) THEN
        RETURN;
    END IF;

    INSERT INTO public.mistake_tags (user_id, name, sort_order)
    SELECT auth.uid(), d.name, d.ord
    FROM (VALUES
        ('Moved stop', 0),
        ('Oversized', 1),
        ('Chased entry', 2),
        ('Early exit', 3),
        ('Revenge trade', 4),
        ('No valid setup', 5),
        ('Overtrading', 6),
        ('Ignored checklist', 7)
    ) AS d(name, ord)
    ON CONFLICT (user_id, (lower(name))) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_mistake_tags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_mistake_tags() TO authenticated;
