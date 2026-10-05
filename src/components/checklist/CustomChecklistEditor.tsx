'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import {
    ChecklistTemplate,
    ChecklistCategory,
    ChecklistTemplateCreate,
    CATEGORY_INFO,
    CATEGORY_ORDER,
    fetchChecklistTemplates,
    createChecklistTemplate,
    updateChecklistTemplate,
    deleteChecklistTemplate,
    reorderTemplates,
} from '@/lib/checklistQueries';
import { useAccount } from '@/components/providers/AccountContext';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    GripVertical,
    Plus,
    Pencil,
    Trash2,
    Save,
    X,
    ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

// ============================================
// Draggable Item Component
// ============================================

interface DraggableItemProps {
    template: ChecklistTemplate;
    onEdit: (template: ChecklistTemplate) => void;
    onDelete: (template: ChecklistTemplate) => void;
}

function DraggableItem({ template, onEdit, onDelete }: DraggableItemProps) {
    const info = CATEGORY_INFO[template.category];

    return (
        <Reorder.Item
            value={template}
            id={template.id}
            className="group"
        >
            <div className="flex items-center gap-3 p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg hover:border-zinc-600 transition-colors">
                <div className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300">
                    <GripVertical className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <p className="text-sm text-zinc-200">{template.item_text}</p>
                    <p className="text-xs text-zinc-500">{info.icon} {info.label}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(template)}
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                    >
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(template)}
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-400"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </Reorder.Item>
    );
}

// ============================================
// Add/Edit Dialog
// ============================================

interface ItemDialogProps {
    isOpen: boolean;
    onClose: () => void;
    template: ChecklistTemplate | null;
    onSave: (data: { item_text: string; category: ChecklistCategory }) => Promise<void>;
    isSaving: boolean;
}

function ItemDialog({ isOpen, onClose, template, onSave, isSaving }: ItemDialogProps) {
    const [itemText, setItemText] = useState('');
    const [category, setCategory] = useState<ChecklistCategory>('setup');

    useEffect(() => {
        if (template) {
            setItemText(template.item_text);
            setCategory(template.category);
        } else {
            setItemText('');
            setCategory('setup');
        }
    }, [template, isOpen]);

    const handleSubmit = async () => {
        if (itemText.trim()) {
            await onSave({ item_text: itemText.trim(), category });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-zinc-900 border-zinc-700">
                <DialogHeader>
                    <DialogTitle className="text-white">
                        {template ? 'Edit Checklist Item' : 'Add Checklist Item'}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        {template ? 'Update the checklist item details.' : 'Add a new item to your pre-trade checklist.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <label className="text-sm text-zinc-400 mb-2 block">Item Text</label>
                        <Input
                            value={itemText}
                            onChange={(e) => setItemText(e.target.value)}
                            placeholder="e.g., Check market structure before entry"
                            className="bg-zinc-800 border-zinc-700 text-white"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-zinc-400 mb-2 block">Category</label>
                        <Select value={category} onValueChange={(v) => setCategory(v as ChecklistCategory)}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-700">
                                {CATEGORY_ORDER.map(cat => {
                                    const info = CATEGORY_INFO[cat];
                                    return (
                                        <SelectItem
                                            key={cat}
                                            value={cat}
                                            className="text-zinc-200 focus:bg-zinc-800 focus:text-white"
                                        >
                                            {info.icon} {info.label}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="border-zinc-700">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!itemText.trim() || isSaving}
                        className="bg-blue-600 hover:bg-blue-500"
                    >
                        {isSaving ? 'Saving...' : template ? 'Save Changes' : 'Add Item'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================
// Delete Confirmation Dialog
// ============================================

interface DeleteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    template: ChecklistTemplate | null;
    onConfirm: () => Promise<void>;
    isDeleting: boolean;
}

function DeleteDialog({ isOpen, onClose, template, onConfirm, isDeleting }: DeleteDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-zinc-900 border-zinc-700">
                <DialogHeader>
                    <DialogTitle className="text-white">Delete Checklist Item</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Are you sure you want to delete "{template?.item_text}"? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="border-zinc-700">
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="bg-rose-600 hover:bg-rose-500"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================
// Main Editor Component
// ============================================

export function CustomChecklistEditor() {
    const { currentAccount } = useAccount();
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Dialog states
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);

    // Load templates
    const loadTemplates = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await fetchChecklistTemplates(currentAccount?.id);
            setTemplates(data);
        } catch (error) {
            console.error('Error loading templates:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentAccount?.id]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    // Handle reorder
    const handleReorder = (category: ChecklistCategory, newOrder: ChecklistTemplate[]) => {
        setTemplates(prev => {
            const other = prev.filter(t => t.category !== category);
            return [...other, ...newOrder].sort((a, b) => {
                const catOrder = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
                if (catOrder !== 0) return catOrder;
                return a.sort_order - b.sort_order;
            });
        });
        setHasChanges(true);
    };

    // Save reorder
    const handleSaveOrder = async () => {
        try {
            setIsSaving(true);
            for (const category of CATEGORY_ORDER) {
                const categoryItems = templates.filter(t => t.category === category);
                const ids = categoryItems.map(t => t.id);
                await reorderTemplates(ids, category);
            }
            setHasChanges(false);
        } catch (error) {
            console.error('Error saving order:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Add/Edit item
    const handleOpenAddDialog = () => {
        setSelectedTemplate(null);
        setEditDialogOpen(true);
    };

    const handleOpenEditDialog = (template: ChecklistTemplate) => {
        setSelectedTemplate(template);
        setEditDialogOpen(true);
    };

    const handleSaveItem = async (data: { item_text: string; category: ChecklistCategory }) => {
        try {
            setIsSaving(true);
            const supabase = getSupabase();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return;

            if (selectedTemplate) {
                // Update existing
                await updateChecklistTemplate(selectedTemplate.id, {
                    item_text: data.item_text,
                    category: data.category,
                });
            } else {
                // Create new
                const categoryItems = templates.filter(t => t.category === data.category);
                await createChecklistTemplate(user.id, {
                    ...data,
                    account_id: currentAccount?.id || null,
                    sort_order: categoryItems.length,
                });
            }

            await loadTemplates();
            setEditDialogOpen(false);
        } catch (error) {
            console.error('Error saving item:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete item
    const handleOpenDeleteDialog = (template: ChecklistTemplate) => {
        setSelectedTemplate(template);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedTemplate) return;

        try {
            setIsDeleting(true);
            await deleteChecklistTemplate(selectedTemplate.id);
            await loadTemplates();
            setDeleteDialogOpen(false);
        } catch (error) {
            console.error('Error deleting item:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    // Group by category
    const templatesByCategory: Record<ChecklistCategory, ChecklistTemplate[]> = {
        session: templates.filter(t => t.category === 'session'),
        setup: templates.filter(t => t.category === 'setup'),
        execution: templates.filter(t => t.category === 'execution'),
        emotional: templates.filter(t => t.category === 'emotional'),
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="glass-card p-4 animate-pulse">
                        <div className="h-6 w-32 bg-zinc-800 rounded mb-3" />
                        <div className="space-y-2">
                            <div className="h-12 bg-zinc-800 rounded" />
                            <div className="h-12 bg-zinc-800 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/checklist">
                        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    </Link>
                    <h2 className="text-lg font-semibold text-white">Customize Checklist</h2>
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <Button
                            onClick={handleSaveOrder}
                            disabled={isSaving}
                            className="bg-blue-600 hover:bg-blue-500"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isSaving ? 'Saving...' : 'Save Order'}
                        </Button>
                    )}
                    <Button
                        onClick={handleOpenAddDialog}
                        className="bg-emerald-600 hover:bg-emerald-500"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Item
                    </Button>
                </div>
            </div>

            {/* Category Sections */}
            {CATEGORY_ORDER.map(category => {
                const info = CATEGORY_INFO[category];
                const items = templatesByCategory[category];

                return (
                    <motion.div
                        key={category}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-4"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl">{info.icon}</span>
                            <h3 className="font-semibold text-white">{info.label}</h3>
                            <span className="text-xs text-zinc-500">({items.length} items)</span>
                        </div>

                        {items.length === 0 ? (
                            <p className="text-sm text-zinc-500 text-center py-4">
                                No items in this category. Click "Add Item" to create one.
                            </p>
                        ) : (
                            <Reorder.Group
                                axis="y"
                                values={items}
                                onReorder={(newOrder) => handleReorder(category, newOrder)}
                                className="space-y-2"
                            >
                                {items.map(template => (
                                    <DraggableItem
                                        key={template.id}
                                        template={template}
                                        onEdit={handleOpenEditDialog}
                                        onDelete={handleOpenDeleteDialog}
                                    />
                                ))}
                            </Reorder.Group>
                        )}
                    </motion.div>
                );
            })}

            {/* Dialogs */}
            <ItemDialog
                isOpen={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                template={selectedTemplate}
                onSave={handleSaveItem}
                isSaving={isSaving}
            />

            <DeleteDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                template={selectedTemplate}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeleting}
            />
        </div>
    );
}

export default CustomChecklistEditor;
