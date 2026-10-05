import { getSupabase } from './supabase';

// ============================================
// Types
// ============================================

export type ChecklistCategory = 'session' | 'setup' | 'execution' | 'emotional';

export interface ChecklistTemplate {
    id: string;
    user_id: string;
    account_id: string | null;
    category: ChecklistCategory;
    item_text: string;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ChecklistTemplateCreate {
    category: ChecklistCategory;
    item_text: string;
    sort_order?: number;
    account_id?: string | null;
}

export interface ChecklistTemplateUpdate {
    item_text?: string;
    sort_order?: number;
    is_active?: boolean;
    category?: ChecklistCategory;
}

export interface CheckedItem {
    template_id: string;
    item_text: string;
    checked: boolean;
    category: ChecklistCategory;
}

export interface ChecklistLog {
    id: string;
    user_id: string;
    account_id: string | null;
    trade_id: string | null;
    checked_items: CheckedItem[];
    all_passed: boolean;
    notes: string | null;
    created_at: string;
}

export interface ChecklistLogCreate {
    account_id?: string | null;
    trade_id?: string | null;
    checked_items: CheckedItem[];
    all_passed: boolean;
    notes?: string | null;
}

// Category display info
export const CATEGORY_INFO: Record<ChecklistCategory, { label: string; icon: string; color: string }> = {
    session: { label: 'Session', icon: '🕐', color: 'blue' },
    setup: { label: 'Setup', icon: '📊', color: 'purple' },
    execution: { label: 'Execution', icon: '🎯', color: 'amber' },
    emotional: { label: 'Emotional', icon: '🧠', color: 'emerald' },
};

export const CATEGORY_ORDER: ChecklistCategory[] = ['session', 'setup', 'execution', 'emotional'];

// ============================================
// Template Queries
// ============================================

/**
 * Fetch all active templates for the current user
 */
export async function fetchChecklistTemplates(accountId?: string): Promise<ChecklistTemplate[]> {
    let query = getSupabase()
        .from('checklist_templates')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('sort_order');

    if (accountId) {
        query = query.or(`account_id.eq.${accountId},account_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching checklist templates:', error);
        throw error;
    }

    return data as ChecklistTemplate[];
}

/**
 * Create a new checklist template
 */
export async function createChecklistTemplate(
    userId: string,
    template: ChecklistTemplateCreate
): Promise<ChecklistTemplate> {
    const { data, error } = await getSupabase()
        .from('checklist_templates')
        .insert({
            user_id: userId,
            ...template,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating checklist template:', error);
        throw error;
    }

    return data as ChecklistTemplate;
}

/**
 * Update a checklist template
 */
export async function updateChecklistTemplate(
    templateId: string,
    updates: ChecklistTemplateUpdate
): Promise<ChecklistTemplate> {
    const { data, error } = await getSupabase()
        .from('checklist_templates')
        .update(updates)
        .eq('id', templateId)
        .select()
        .single();

    if (error) {
        console.error('Error updating checklist template:', error);
        throw error;
    }

    return data as ChecklistTemplate;
}

/**
 * Delete a checklist template (soft delete by setting is_active = false)
 */
export async function deleteChecklistTemplate(templateId: string): Promise<void> {
    const { error } = await getSupabase()
        .from('checklist_templates')
        .update({ is_active: false })
        .eq('id', templateId);

    if (error) {
        console.error('Error deleting checklist template:', error);
        throw error;
    }
}

/**
 * Permanently delete a template
 */
export async function hardDeleteTemplate(templateId: string): Promise<void> {
    const { error } = await getSupabase()
        .from('checklist_templates')
        .delete()
        .eq('id', templateId);

    if (error) {
        console.error('Error hard deleting template:', error);
        throw error;
    }
}

/**
 * Reorder templates within a category
 */
export async function reorderTemplates(
    templateIds: string[],
    category: ChecklistCategory
): Promise<void> {
    const updates = templateIds.map((id, index) => ({
        id,
        sort_order: index,
        category,
    }));

    for (const update of updates) {
        const { error } = await getSupabase()
            .from('checklist_templates')
            .update({ sort_order: update.sort_order })
            .eq('id', update.id);

        if (error) {
            console.error('Error reordering template:', error);
            throw error;
        }
    }
}

/**
 * Seed default templates for a new user
 */
export async function seedDefaultTemplates(userId: string, accountId?: string): Promise<void> {
    const defaultItems: ChecklistTemplateCreate[] = [
        // Session
        { category: 'session', item_text: 'Trading session time is correct (London/NY overlap)', sort_order: 0 },
        { category: 'session', item_text: 'No major news events in next 30 minutes', sort_order: 1 },
        { category: 'session', item_text: 'Daily loss limit not reached', sort_order: 2 },
        // Setup
        { category: 'setup', item_text: 'Clear trend direction identified', sort_order: 0 },
        { category: 'setup', item_text: 'Key support/resistance levels marked', sort_order: 1 },
        { category: 'setup', item_text: 'Entry trigger confirmed', sort_order: 2 },
        { category: 'setup', item_text: 'Risk:Reward ratio >= 1:2', sort_order: 3 },
        // Execution
        { category: 'execution', item_text: 'Stop loss placed before entry', sort_order: 0 },
        { category: 'execution', item_text: 'Position size calculated correctly', sort_order: 1 },
        { category: 'execution', item_text: 'Take profit levels defined', sort_order: 2 },
        // Emotional
        { category: 'emotional', item_text: 'Feeling calm and focused', sort_order: 0 },
        { category: 'emotional', item_text: 'Not revenge trading', sort_order: 1 },
        { category: 'emotional', item_text: 'Following the plan, not FOMO', sort_order: 2 },
    ];

    for (const item of defaultItems) {
        await createChecklistTemplate(userId, { ...item, account_id: accountId || null });
    }
}

// In-flight seeding checks, keyed by user + account. The check-then-insert below
// is not atomic, so overlapping calls (e.g. React StrictMode running effects
// twice) would each see zero templates and seed the defaults twice.
const pendingEnsures = new Map<string, Promise<void>>();

/**
 * Check if user has any templates, if not seed defaults
 */
export function ensureTemplatesExist(userId: string, accountId?: string): Promise<void> {
    const key = `${userId}:${accountId ?? ''}`;
    const pending = pendingEnsures.get(key);
    if (pending) return pending;

    const ensure = (async () => {
        const templates = await fetchChecklistTemplates(accountId);
        if (templates.length === 0) {
            await seedDefaultTemplates(userId, accountId);
        }
    })().finally(() => pendingEnsures.delete(key));

    pendingEnsures.set(key, ensure);
    return ensure;
}

// ============================================
// Log Queries
// ============================================

/**
 * Create a checklist log (snapshot of a pre-trade check)
 */
export async function createChecklistLog(
    userId: string,
    log: ChecklistLogCreate
): Promise<ChecklistLog> {
    const { data, error } = await getSupabase()
        .from('checklist_logs')
        .insert({
            user_id: userId,
            ...log,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating checklist log:', error);
        throw error;
    }

    return data as ChecklistLog;
}

/**
 * Fetch checklist logs for the user
 */
export async function fetchChecklistLogs(
    accountId?: string,
    limit: number = 50
): Promise<ChecklistLog[]> {
    let query = getSupabase()
        .from('checklist_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (accountId) {
        query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching checklist logs:', error);
        throw error;
    }

    return data as ChecklistLog[];
}

/**
 * Fetch checklist log for a specific trade
 */
export async function fetchChecklistLogForTrade(tradeId: string): Promise<ChecklistLog | null> {
    const { data, error } = await getSupabase()
        .from('checklist_logs')
        .select('*')
        .eq('trade_id', tradeId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching checklist log for trade:', error);
        throw error;
    }

    return data as ChecklistLog | null;
}

/**
 * Link a checklist log to a trade
 */
export async function linkLogToTrade(logId: string, tradeId: string): Promise<void> {
    const { error } = await getSupabase()
        .from('checklist_logs')
        .update({ trade_id: tradeId })
        .eq('id', logId);

    if (error) {
        console.error('Error linking log to trade:', error);
        throw error;
    }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format checklist results for export to notes
 */
export function formatChecklistForExport(checkedItems: CheckedItem[]): string {
    const lines: string[] = ['📋 Pre-Trade Checklist', ''];

    for (const category of CATEGORY_ORDER) {
        const categoryItems = checkedItems.filter(item => item.category === category);
        if (categoryItems.length === 0) continue;

        const info = CATEGORY_INFO[category];
        lines.push(`${info.icon} ${info.label}:`);

        for (const item of categoryItems) {
            const status = item.checked ? '✅' : '❌';
            lines.push(`  ${status} ${item.item_text}`);
        }
        lines.push('');
    }

    const allPassed = checkedItems.every(item => item.checked);
    lines.push(allPassed ? '✨ READY TO TRADE' : '⚠️ FAILED - NO TRADE');

    return lines.join('\n');
}
