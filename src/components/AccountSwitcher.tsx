'use client';

import { useAccount } from '@/components/providers/AccountContext';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building2, ChevronDown, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function AccountSwitcher() {
    const { currentAccount, accounts, isLoading, setCurrentAccount } = useAccount();

    // Don't render if loading or no accounts
    if (isLoading) {
        return (
            <div className="h-9 w-36 bg-zinc-800/50 animate-pulse rounded-lg" />
        );
    }

    if (accounts.length === 0) {
        return (
            <Link href="/settings/accounts">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300"
                >
                    <Building2 className="w-4 h-4" />
                    <span>Add Account</span>
                </Button>
            </Link>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Select
                value={currentAccount?.id || ''}
                onValueChange={(value) => {
                    const account = accounts.find(a => a.id === value);
                    if (account) {
                        setCurrentAccount(account);
                    }
                }}
            >
                <SelectTrigger className="h-9 w-auto min-w-[140px] max-w-[200px] gap-2 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-200 focus:ring-blue-500/20">
                    <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                    <SelectValue placeholder="Select Account">
                        <span className="truncate">
                            {currentAccount?.account_name || 'Select Account'}
                        </span>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                    {accounts.map((account) => (
                        <SelectItem
                            key={account.id}
                            value={account.id}
                            className="text-zinc-200 focus:bg-zinc-800 focus:text-white cursor-pointer"
                        >
                            <div className="flex flex-col items-start">
                                <span className="font-medium">{account.account_name}</span>
                                {account.broker_name && (
                                    <span className="text-xs text-zinc-500">
                                        {account.broker_name}
                                    </span>
                                )}
                            </div>
                        </SelectItem>
                    ))}

                    {/* Separator */}
                    <div className="h-px bg-zinc-700 my-1" />

                    {/* Manage Accounts Link */}
                    <Link href="/settings/accounts" className="block">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded cursor-pointer">
                            <Settings className="w-4 h-4" />
                            <span>Manage Accounts</span>
                        </div>
                    </Link>
                </SelectContent>
            </Select>
        </div>
    );
}

export default AccountSwitcher;
