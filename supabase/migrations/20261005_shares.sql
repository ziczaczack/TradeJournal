-- ============================================
-- Share Cards
-- ============================================
-- Frozen, privacy-filtered snapshots of a trade or playbook setup, readable by
-- anyone holding the token via get_share(). Idempotent: safe to re-run on the
-- live DB (which has drifted from these files).

CREATE TABLE IF NOT EXISTS public.shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('trade', 'playbook')),
    source_id UUID NOT NULL,
    payload JSONB NOT NULL CHECK (octet_length(payload::text) <= 16384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shares_owner_source ON public.shares(user_id, kind, source_id);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own shares" ON public.shares;
CREATE POLICY "Users can view their own shares"
    ON public.shares FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own shares" ON public.shares;
CREATE POLICY "Users can create their own shares"
    ON public.shares FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can revoke their own shares" ON public.shares;
CREATE POLICY "Users can revoke their own shares"
    ON public.shares FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Owners may only change revoked_at; the snapshot itself is immutable.
REVOKE UPDATE ON public.shares FROM anon, authenticated;
GRANT UPDATE (revoked_at) ON public.shares TO authenticated;

-- The only public read path: exact token match, not revoked.
CREATE OR REPLACE FUNCTION public.get_share(p_token TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object('kind', s.kind, 'payload', s.payload, 'created_at', s.created_at)
    FROM public.shares s
    WHERE s.token = p_token AND s.revoked_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_share(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_share(TEXT) TO anon, authenticated;
