'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Building2,
    Plus,
    Pencil,
    Trash2,
    Star,
    StarOff,
    ArrowLeft,
    DollarSign,
    Briefcase,
} from 'lucide-react';
import Link from 'next/link';
import { useAccount } from '@/components/providers/AccountContext';
import { getSupabase } from '@/lib/supabase';
import {
    Account,
    AccountCreate,
    createAccount,
    updateAccount,
    deleteAccount,
    setDefaultAccount,
} from '@/lib/accountQueries';

export default function AccountSettingsPage() {
    const { accounts, currentAccount, refreshAccounts, isLoading } = useAccount();
    const [isCreating, setIsCreating] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
    const [formData, setFormData] = useState<AccountCreate>({
        account_name: '',
        broker_name: '',
        initial_balance: 0,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetForm = () => {
        setFormData({
            account_name: '',
            broker_name: '',
            initial_balance: 0,
        });
        setError(null);
    };

    const handleCreate = async () => {
        if (!formData.account_name.trim()) {
            setError('Account name is required');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            const supabase = getSupabase();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setError('You must be logged in');
                return;
            }

            await createAccount(user.id, {
                ...formData,
                is_default: accounts.length === 0, // First account is default
            });

            await refreshAccounts();
            setIsCreating(false);
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create account');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingAccount) return;
        if (!formData.account_name.trim()) {
            setError('Account name is required');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            await updateAccount(editingAccount.id, formData);
            await refreshAccounts();
            setEditingAccount(null);
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update account');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingAccount) return;

        try {
            setSaving(true);
            await deleteAccount(deletingAccount.id);
            await refreshAccounts();
            setDeletingAccount(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete account');
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefault = async (account: Account) => {
        try {
            const supabase = getSupabase();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await setDefaultAccount(user.id, account.id);
            await refreshAccounts();
        } catch (err) {
            console.error('Failed to set default:', err);
        }
    };

    const openEditDialog = (account: Account) => {
        setFormData({
            account_name: account.account_name,
            broker_name: account.broker_name || '',
            initial_balance: account.initial_balance,
        });
        setEditingAccount(account);
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Dashboard</span>
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                Account Settings
                            </h1>
                            <p className="text-zinc-400">
                                Manage your trading accounts
                            </p>
                        </div>
                        <Dialog open={isCreating} onOpenChange={setIsCreating}>
                            <DialogTrigger asChild>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-500 btn-scale"
                                    onClick={resetForm}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Account
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-zinc-900 border-zinc-700">
                                <DialogHeader>
                                    <DialogTitle className="text-white">Create New Account</DialogTitle>
                                    <DialogDescription className="text-zinc-400">
                                        Add a new trading account to track separately.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    {error && (
                                        <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded">
                                            {error}
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-sm text-zinc-400 mb-1 block">
                                            Account Name *
                                        </label>
                                        <Input
                                            placeholder="e.g. Apex #1"
                                            value={formData.account_name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, account_name: e.target.value }))}
                                            className="bg-zinc-800 border-zinc-700 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-zinc-400 mb-1 block">
                                            Broker Name
                                        </label>
                                        <Input
                                            placeholder="e.g. Tradovate"
                                            value={formData.broker_name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, broker_name: e.target.value }))}
                                            className="bg-zinc-800 border-zinc-700 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-zinc-400 mb-1 block">
                                            Initial Balance
                                        </label>
                                        <Input
                                            type="number"
                                            placeholder="50000"
                                            value={formData.initial_balance || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, initial_balance: parseFloat(e.target.value) || 0 }))}
                                            className="bg-zinc-800 border-zinc-700 text-white"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsCreating(false)}
                                        className="border-zinc-700"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCreate}
                                        disabled={saving}
                                        className="bg-blue-600 hover:bg-blue-500"
                                    >
                                        {saving ? 'Creating...' : 'Create Account'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </motion.div>

                {/* Accounts List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-4"
                >
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2].map((i) => (
                                <div key={i} className="glass-card p-6 animate-pulse">
                                    <div className="h-6 w-48 bg-zinc-800 rounded mb-2" />
                                    <div className="h-4 w-32 bg-zinc-800 rounded" />
                                </div>
                            ))}
                        </div>
                    ) : accounts.length === 0 ? (
                        <Card className="bg-zinc-900/50 border-zinc-700/50">
                            <CardContent className="py-12 text-center">
                                <Building2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-white mb-2">
                                    No Accounts Yet
                                </h3>
                                <p className="text-zinc-400 mb-4">
                                    Create your first trading account to start tracking.
                                </p>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-500"
                                    onClick={() => setIsCreating(true)}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Account
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        accounts.map((account) => (
                            <Card
                                key={account.id}
                                className={`bg-zinc-900/50 border-zinc-700/50 hover:border-zinc-600/50 transition-colors ${account.is_default ? 'ring-1 ring-blue-500/30' : ''
                                    }`}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                                                <Briefcase className="w-6 h-6 text-blue-400" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-semibold text-white">
                                                        {account.account_name}
                                                    </h3>
                                                    {account.is_default && (
                                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                {account.broker_name && (
                                                    <p className="text-sm text-zinc-400 mb-2">
                                                        {account.broker_name}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-4 text-sm">
                                                    <span className="text-zinc-500 flex items-center gap-1">
                                                        <DollarSign className="w-3 h-3" />
                                                        Initial: ${account.initial_balance.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!account.is_default && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-zinc-400 hover:text-yellow-400"
                                                    onClick={() => handleSetDefault(account)}
                                                    title="Set as Default"
                                                >
                                                    <StarOff className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {account.is_default && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-yellow-400 cursor-default"
                                                    title="Default Account"
                                                >
                                                    <Star className="w-4 h-4 fill-current" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-zinc-400 hover:text-white"
                                                onClick={() => openEditDialog(account)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-zinc-400 hover:text-red-400"
                                                onClick={() => setDeletingAccount(account)}
                                                disabled={account.is_default}
                                                title={account.is_default ? "Can't delete default account" : 'Delete account'}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </motion.div>

                {/* Edit Dialog */}
                <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
                    <DialogContent className="bg-zinc-900 border-zinc-700">
                        <DialogHeader>
                            <DialogTitle className="text-white">Edit Account</DialogTitle>
                            <DialogDescription className="text-zinc-400">
                                Update account details.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {error && (
                                <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="text-sm text-zinc-400 mb-1 block">
                                    Account Name *
                                </label>
                                <Input
                                    placeholder="e.g. Apex #1"
                                    value={formData.account_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, account_name: e.target.value }))}
                                    className="bg-zinc-800 border-zinc-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-zinc-400 mb-1 block">
                                    Broker Name
                                </label>
                                <Input
                                    placeholder="e.g. Tradovate"
                                    value={formData.broker_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, broker_name: e.target.value }))}
                                    className="bg-zinc-800 border-zinc-700 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-zinc-400 mb-1 block">
                                    Initial Balance
                                </label>
                                <Input
                                    type="number"
                                    placeholder="50000"
                                    value={formData.initial_balance || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, initial_balance: parseFloat(e.target.value) || 0 }))}
                                    className="bg-zinc-800 border-zinc-700 text-white"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setEditingAccount(null)}
                                className="border-zinc-700"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleUpdate}
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-500"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <Dialog open={!!deletingAccount} onOpenChange={(open) => !open && setDeletingAccount(null)}>
                    <DialogContent className="bg-zinc-900 border-zinc-700">
                        <DialogHeader>
                            <DialogTitle className="text-white">Delete Account</DialogTitle>
                            <DialogDescription className="text-zinc-400">
                                Are you sure you want to delete "{deletingAccount?.account_name}"?
                                This will also delete all trades associated with this account.
                                This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setDeletingAccount(null)}
                                className="border-zinc-700"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDelete}
                                disabled={saving}
                                className="bg-red-600 hover:bg-red-500"
                            >
                                {saving ? 'Deleting...' : 'Delete Account'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
