'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import type { Transaction } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';
import { Wallet, CheckCircle2, AlertCircle, TrendingUp, Search, Filter } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ReceivablesPage() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToTransactions((data) => {
            // Filter only transactions that are NOT fully paid (pelunasan !== 'Lunas' - wait, check types)
            // Type CaraPelunasan = 'Cash' | 'TF' | 'Pending'.
            // Actually 'Pending' meant not yet paid.
            const unpaid = data.filter(t => t.pelunasan === 'Pending');
            setTransactions(unpaid);
            setLoading(false);
        }, user.uid);
        return () => unsubscribe();
    }, [user]);

    // Calculate Stats
    const totalPiutang = transactions.reduce((sum, t) => sum + t.jumlah, 0);
    const totalTransactions = transactions.length;

    // Group by Client for "Top Debtors"
    const clientDebts: Record<string, number> = {};
    transactions.forEach(t => {
        const clientName = t.pengirimName; // Assuming Pengirim pays? Or Receiver? Usually Pengirim or "Tagihan Ke"
        // For C2-MS simplified, let's assume 'Pembayaran' method determines who pays, but usually we tag 'Pengirim' for now.
        // Actually, if 'pembayaran' is 'Tunai', it shouldn't be here?
        // Wait, logic check: 'pembayaran' = 'Tunai' means paid upfront?
        // 'pelunasan' = 'Pending' implies it's NOT paid yet.
        // So we trust 'pelunasan' status.
        clientDebts[clientName] = (clientDebts[clientName] || 0) + t.jumlah;
    });

    const topDebtors = Object.entries(clientDebts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const filteredTransactions = transactions.filter(t =>
        t.noSTT.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.pengirimName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.penerimaName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data piutang...</div>;

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Dashboard Piutang</h1>
                    <p className="text-gray-500">Monitor tagihan yang belum dibayar</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium mb-1">Total Piutang Belum Tertagih</p>
                            <h2 className="text-3xl font-bold text-blue-600">{formatRupiah(totalPiutang)}</h2>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Wallet size={24} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium mb-1">Total Resi Gantung</p>
                            <h2 className="text-3xl font-bold text-orange-600">{totalTransactions}</h2>
                            <p className="text-xs text-gray-400 mt-1">Resi dengan status pembayaran Pending</p>
                        </div>
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                            <AlertCircle size={24} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main List */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
                            <h3 className="font-bold text-gray-800">Daftar Tagihan Pending</h3>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cari Resi / Client..."
                                    className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm w-48 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 rounded-tl-xl text-xs uppercase tracking-wider">Tanggal</th>
                                        <th className="px-6 py-4 text-xs uppercase tracking-wider">No STT</th>
                                        <th className="px-6 py-4 text-xs uppercase tracking-wider">Client</th>
                                        <th className="px-6 py-4 text-xs uppercase tracking-wider text-right">Jumlah</th>
                                        <th className="px-6 py-4 text-xs uppercase tracking-wider text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredTransactions.slice(0, 10).map((t) => (
                                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-gray-500">
                                                {new Date(t.tanggal).toLocaleDateString('id-ID')}
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    {Math.ceil((new Date().getTime() - new Date(t.tanggal).getTime()) / (1000 * 3600 * 24))} hari lalu
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono font-medium text-gray-700">{t.noSTT}</td>
                                            <td className="px-6 py-4 font-medium text-gray-800">{t.pengirimName}</td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-700">{formatRupiah(t.jumlah)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                    Pending
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-gray-400">Tidak ada data tagihan.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {filteredTransactions.length > 10 && (
                            <div className="p-4 border-t border-gray-100 text-center">
                                <button className="text-blue-600 text-sm font-medium hover:underline">Lihat Semua Tagihan</button>
                            </div>
                        )}
                    </div>

                    {/* Top Debtors Side Panel */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-fit">
                        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <TrendingUp className="text-blue-600" size={18} />
                            Top Debitur
                        </h3>
                        <div className="space-y-5">
                            {topDebtors.map(([name, amount], index) => (
                                <div key={name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${index === 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                            {index + 1}
                                        </div>
                                        <span className="font-medium text-gray-700 text-sm truncate max-w-[120px]" title={name}>{name}</span>
                                    </div>
                                    <span className="font-bold text-gray-800 text-sm">{formatRupiah(amount)}</span>
                                </div>
                            ))}
                            {topDebtors.length === 0 && (
                                <p className="text-gray-400 text-sm text-center">Belum ada data debitur.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
