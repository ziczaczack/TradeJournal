import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

export interface MistakeTag {
    id: string;
    user_id: string;
    name: string;
    sort_order: number;
    is_hidden: boolean;
    created_at: string;
}

export const MISTAKE_TAG_NAME_MAX = 40;
export const DUPLICATE_TAG_MESSAGE = 'A tag with that name already exists';
export const mistakeTagsQueryKey = ['mistakeTags'] as const;

const UNIQUE_VIOLATION = '23505';

/** Returns an error message, or null when the name is valid. */
export function validateMistakeTagName(
    name: string,
    existing: MistakeTag[],
    ignoreId?: string
): string | null {
    const trimmed = name.trim();
    if (!trimmed) return 'Name is required';
    if (trimmed.length > MISTAKE_TAG_NAME_MAX) return `Name must be ${MISTAKE_TAG_NAME_MAX} characters or fewer`;
    const lower = trimmed.toLowerCase();
    if (existing.some(t => t.id !== ignoreId && t.name.toLowerCase() === lower)) return DUPLICATE_TAG_MESSAGE;
    return null;
}

export function nextMistakeSortOrder(tags: MistakeTag[]): number {
    return tags.length ? Math.max(...tags.map(t => t.sort_order)) + 1 : 0;
}

function friendlyError(error: { code?: string }): Error {
    return error.code === UNIQUE_VIOLATION ? new Error(DUPLICATE_TAG_MESSAGE) : (error as Error);
}

/** All tags (hidden included), seeding the defaults first for new users. */
export async function fetchMistakeTags(client: SupabaseClient = getSupabase()): Promise<MistakeTag[]> {
    const { error: seedError } = await client.rpc('ensure_default_mistake_tags');
    if (seedError) {
        console.error('Error seeding mistake tags:', seedError);
        throw seedError;
    }

    const { data, error } = await client
        .from('mistake_tags')
        .select('*')
        .order('sort_order')
        .order('created_at');

    if (error) {
        console.error('Error fetching mistake tags:', error);
        throw error;
    }

    return data as MistakeTag[];
}

export async function createMistakeTag(
    userId: string,
    name: string,
    sortOrder: number,
    client: SupabaseClient = getSupabase()
): Promise<MistakeTag> {
    const { data, error } = await client
        .from('mistake_tags')
        .insert({ user_id: userId, name: name.trim(), sort_order: sortOrder })
        .select()
        .single();

    if (error) {
        console.error('Error creating mistake tag:', error);
        throw friendlyError(error);
    }

    return data as MistakeTag;
}

export async function renameMistakeTag(
    id: string,
    name: string,
    client: SupabaseClient = getSupabase()
): Promise<void> {
    const { error } = await client.from('mistake_tags').update({ name: name.trim() }).eq('id', id);
    if (error) {
        console.error('Error renaming mistake tag:', error);
        throw friendlyError(error);
    }
}

export async function setMistakeTagHidden(
    id: string,
    hidden: boolean,
    client: SupabaseClient = getSupabase()
): Promise<void> {
    const { error } = await client.from('mistake_tags').update({ is_hidden: hidden }).eq('id', id);
    if (error) {
        console.error('Error updating mistake tag:', error);
        throw error;
    }
}
