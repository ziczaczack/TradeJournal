import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { generateShareToken, SharedCard, ShareKind } from './sharePayload';
import { supabaseImageHost, validateSharedCard } from './shareValidation';

export interface ShareLink {
    id: string;
    token: string;
    kind: ShareKind;
    source_id: string;
    created_at: string;
    revoked_at: string | null;
}

const LINK_COLUMNS = 'id, token, kind, source_id, created_at, revoked_at';
const UNIQUE_VIOLATION = '23505';

/**
 * Store a share snapshot under a new random token. Retries once on the
 * (astronomically unlikely) token collision.
 */
export async function createShare(
    userId: string,
    sourceId: string,
    card: SharedCard,
    client: SupabaseClient = getSupabase()
): Promise<ShareLink> {
    const validated = validateSharedCard(card, supabaseImageHost());
    if (!validated.ok) {
        throw new Error(`Cannot share: ${validated.error}`);
    }

    for (let attempt = 0; ; attempt++) {
        const { data, error } = await client
            .from('shares')
            .insert({
                token: generateShareToken(),
                user_id: userId,
                kind: validated.card.kind,
                source_id: sourceId,
                payload: validated.card.payload,
            })
            .select(LINK_COLUMNS)
            .single();

        if (!error) return data as ShareLink;
        if (error.code !== UNIQUE_VIOLATION || attempt >= 1) {
            console.error('Error creating share:', error);
            throw error;
        }
    }
}

/** Active (non-revoked) links for one trade or setup, newest first. */
export async function listSharesForSource(
    kind: ShareKind,
    sourceId: string,
    client: SupabaseClient = getSupabase()
): Promise<ShareLink[]> {
    const { data, error } = await client
        .from('shares')
        .select(LINK_COLUMNS)
        .eq('kind', kind)
        .eq('source_id', sourceId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error listing shares:', error);
        throw error;
    }

    return data as ShareLink[];
}

export async function revokeShare(
    shareId: string,
    client: SupabaseClient = getSupabase()
): Promise<void> {
    const { error } = await client
        .from('shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', shareId);

    if (error) {
        console.error('Error revoking share:', error);
        throw error;
    }
}

/**
 * Public read by token via the get_share RPC. Returns null for unknown,
 * revoked, or invalid (tampered) snapshots.
 */
export async function fetchSharedCard(
    token: string,
    client: SupabaseClient = getSupabase()
): Promise<SharedCard | null> {
    const { data, error } = await client.rpc('get_share', { p_token: token });

    if (error) {
        console.error('Error fetching shared card:', error);
        throw error;
    }
    if (!data) return null;

    const validated = validateSharedCard(data, supabaseImageHost());
    return validated.ok ? validated.card : null;
}
