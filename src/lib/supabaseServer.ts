import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Create a per-request Supabase client bound to a user's access token.
 *
 * This app stores sessions client-side (localStorage), so server route handlers
 * have no auth context by default — the plain anon client sees no user and RLS
 * returns zero rows. Route handlers should forward the caller's access token
 * (sent as `Authorization: Bearer <token>`) into this helper so that RLS
 * evaluates `auth.uid()` correctly and scopes queries to that user.
 *
 * Never reuse the returned client across requests — it is bound to one token.
 */
export function getSupabaseForToken(accessToken: string): SupabaseClient {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
        );
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
