'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToTransactions, searchTransactions } from '@/lib/firestore-transactions';
import type { Transaction, StatusTransaksi } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';
import { Package } from 'lucide-react';

function PrintReportContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const filterStatus = searchParams.get('status') as StatusTransaksi | 'all' || 'all';
    const filterSearch = searchParams.get('search') || '';
    const filterSort = searchParams.get('sort') || 'date-newest';

    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToTransactions((data) => {
            setTransactions(data);
            setLoading(false);
        }, user.uid);

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        let result = searchTransactions(transactions, filterSearch);

        if (filterStatus !== 'all') {
            result = result.filter(t => t.status === filterStatus);
        }

        // Apply same sorting as list page
        result.sort((a, b) => {
            switch (filterSort) {
                case 'date-newest':
                    return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
                case 'date-oldest':
                    return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
                case 'amount-highest':
                    return b.jumlah - a.jumlah;
                case 'amount-lowest':
                    return a.jumlah - b.jumlah;
                default:
                    return 0;
            }
        });

        setFilteredTransactions(result);
    }, [transactions, filterStatus, filterSearch, filterSort]);

    useEffect(() => {
        if (!loading && filteredTransactions.length > 0) {
            setTimeout(() => {
                window.print();
            }, 1000);
        }
    }, [loading, filteredTransactions]);

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data laporan...</div>;

    const totalOmset = filteredTransactions.reduce((sum, t) => sum + t.jumlah, 0);
    const totalKoli = filteredTransactions.reduce((sum, t) => sum + t.koli, 0);

    return (
        <div className="bg-white min-h-screen p-8 text-sm text-gray-800 font-sans">
            {/* Report Header */}
            <div className="border-b-2 border-gray-800 pb-6 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wide mb-2">Laporan Transaksi</h1>
                        <p className="text-gray-500">Cahaya Cargo Express Management System</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-gray-600">Tanggal Cetak</p>
                        <p className="text-lg font-bold">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-gray-400 text-xs mt-1">Dicetak oleh: {user?.displayName || user?.email}</p>
                    </div>
                </div>

                {/* Filter Summary */}
                <div className="mt-6 flex gap-8 text-sm">
                    <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wider">Status Filter</span>
                        <span className="font-semibold capitalize">{filterStatus === 'all' ? 'Semua Status' : filterStatus}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wider">Pencarian</span>
                        <span className="font-semibold">{filterSearch ? `"${filterSearch}"` : '-'}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wider">Total Item</span>
                        <span className="font-semibold">{filteredTransactions.length} Resi</span>
                    </div>
                </div>
            </div>

            {/* Stats Summary Box */}
            <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Omset</p>
                    <p className="text-2xl font-bold text-blue-600">{formatRupiah(totalOmset)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Koli</p>
                    <p className="text-2xl font-bold text-gray-800">{totalKoli}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Resi Diproses</p>
                    <p className="text-2xl font-bold text-orange-600">{filteredTransactions.filter(t => ['pending', 'diproses', 'dikirim'].includes(t.status)).length}</p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-800">
                        <th className="py-3 font-bold uppercase text-xs tracking-wider w-12">No</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Tanggal</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">No STT</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Pengirim / Penerima</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider">Tujuan</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider text-center">Koli</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider text-center">Status</th>
                        <th className="py-3 font-bold uppercase text-xs tracking-wider text-right">Biaya</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredTransactions.map((t, index) => (
                        <tr key={t.id} className="break-inside-avoid">
                            <td className="py-3 text-gray-500">{index + 1}</td>
                            <td className="py-3">{new Date(t.tanggal).toLocaleDateString('id-ID')}</td>
                            <td className="py-3 font-mono font-semibold">{t.noSTT}</td>
                            <td className="py-3">
                                <div className="font-semibold">{t.pengirimName}</div>
                                <div className="text-xs text-gray-500">kpd. {t.penerimaName}</div>
                            </td>
                            <td className="py-3">{t.tujuan}</td>
                            <td className="py-3 text-center">{t.koli}</td>
                            <td className="py-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white
                                    ${t.status === 'selesai' ? 'bg-green-600' :
                                        t.status === 'dibatalkan' ? 'bg-red-600' :
                                            t.status === 'dikirim' ? 'bg-blue-600' :
                                                'bg-gray-500'}`}
                                >
                                    {t.status}
                                </span>
                            </td>
                            <td className="py-3 text-right font-mono font-medium">{formatRupiah(t.jumlah)}</td>
                        </tr>
                    ))}
                    <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                        <td colSpan={5} className="py-4 text-right pr-4 uppercase text-xs tracking-wider">Total Akhir</td>
                        <td className="py-4 text-center">{totalKoli}</td>
                        <td></td>
                        <td className="py-4 text-right">{formatRupiah(totalOmset)}</td>
                    </tr>
                </tbody>
            </table>

            <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between items-end text-xs text-gray-500">
                <div>
                    <p>Dicetak melalui C2-MS System</p>
                    <p>{new Date().toLocaleString('id-ID')}</p>
                </div>
                <div className="text-center w-40">
                    <div className="h-16 mb-2 border-b border-gray-300"></div>
                    <p className="font-semibold">Tanda Tangan</p>
                </div>
            </div>
        </div>
    );
}

export default function PrintReportPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PrintReportContent />
        </Suspense>
    );
}
