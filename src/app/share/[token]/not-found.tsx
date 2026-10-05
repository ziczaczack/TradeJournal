import Link from 'next/link';

export default function ShareNotFound() {
    return (
        <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <h1 className="text-2xl font-bold text-white">This link is no longer available</h1>
            <p className="text-zinc-400 text-sm">The owner may have revoked it, or the address is wrong.</p>
            <Link href="/" className="text-blue-400 text-sm hover:underline">Go to My Trading Journal</Link>
        </main>
    );
}
