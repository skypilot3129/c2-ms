'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import type { Transaction } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';
import { ArrowLeft, CheckSquare, Search, Printer } from 'lucide-react';
import Link from 'next/link';

export default function CekHargaPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToTransactions((data) => {
            // Sort by date descending
            const sorted = [...data].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
            setTransactions(sorted);
            setLoading(false);
        }, user.uid);

        return () => unsubscribe();
    }, [user]);

    const filteredTransactions = transactions.filter(t => 
        t.noSTT.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.pengirimName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.tujuan.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(filteredTransactions.map(t => t.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handlePrint = () => {
        if (selectedIds.length === 0) return;
        router.push(`/finance/invoices/cek-harga/print?ids=${selectedIds.join(',')}`);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/finance/invoices" className="p-2 hover:bg-white rounded-lg transition-colors text-gray-500">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Cek Harga Barang</h1>
                            <p className="text-gray-500 text-sm">Pilih transaksi untuk dicetak sebagai checklist</p>
                        </div>
                    </div>
                    <button
                        onClick={handlePrint}
                        disabled={selectedIds.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                    >
                        <Printer size={18} />
                        Cetak Checklist ({selectedIds.length})
                    </button>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
                    <div className="p-4 border-b border-gray-100">
                        <div className="relative max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari STT, Pengirim, Tujuan..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">Memuat transaksi...</div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 w-12 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={filteredTransactions.length > 0 && selectedIds.length === filteredTransactions.length}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th className="px-4 py-3 uppercase tracking-wider">Tanggal</th>
                                        <th className="px-4 py-3 uppercase tracking-wider">No STT</th>
                                        <th className="px-4 py-3 uppercase tracking-wider">Pengirim</th>
                                        <th className="px-4 py-3 uppercase tracking-wider">Tujuan</th>
                                        <th className="px-4 py-3 uppercase tracking-wider">Koli / Berat</th>
                                        <th className="px-4 py-3 uppercase tracking-wider text-right">Harga</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredTransactions.map((tx) => (
                                        <tr 
                                            key={tx.id} 
                                            className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${selectedIds.includes(tx.id) ? 'bg-blue-50/30' : ''}`}
                                            onClick={() => handleSelect(tx.id)}
                                        >
                                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectedIds.includes(tx.id)}
                                                    onChange={() => handleSelect(tx.id)}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{new Date(tx.tanggal).toLocaleDateString('id-ID')}</td>
                                            <td className="px-4 py-3 font-mono font-medium text-gray-800">{tx.noSTT}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800">{tx.pengirimName}</td>
                                            <td className="px-4 py-3 text-gray-600">{tx.tujuan}</td>
                                            <td className="px-4 py-3 text-gray-600">
                                                <span className="font-medium">{tx.koli}</span> koli / <span className="font-medium">{tx.berat}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-800">
                                                {formatRupiah(tx.jumlah)}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                                                Tidak ada transaksi ditemukan.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
