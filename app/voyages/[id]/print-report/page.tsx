'use client';

import { use, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getVoyageById } from '@/lib/firestore-voyages';
import { getTransactionById } from '@/lib/firestore-transactions';
import { subscribeToExpensesByVoyage } from '@/lib/firestore-expenses';
import type { Voyage, Expense } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';

function PrintVoyageReportContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const router = useRouter();
    const [voyage, setVoyage] = useState<Voyage | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;

            try {
                const voyageData = await getVoyageById(id);
                if (!voyageData) {
                    alert('Pemberangkatan tidak ditemukan');
                    return;
                }
                setVoyage(voyageData);

                // Load transactions
                const txPromises = voyageData.transactionIds.map(txId => getTransactionById(txId));
                const txData = await Promise.all(txPromises);
                setTransactions(txData.filter((tx): tx is Transaction => tx !== null));

                // Load expenses
                const unsubscribe = subscribeToExpensesByVoyage(voyageData.id, user.uid, (data) => {
                    setExpenses(data);
                    setLoading(false);
                });

                return () => unsubscribe();
            } catch (error) {
                console.error('Error loading voyage report data:', error);
                setLoading(false);
            }
        };

        loadData();
    }, [id, user]);

    useEffect(() => {
        if (!loading && voyage) {
            setTimeout(() => {
                window.print();
            }, 1000);
        }
    }, [loading, voyage]);

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat laporan keuangan...</div>;
    if (!voyage) return null;

    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.jumlah, 0);
    const totalExpenses = expenses.reduce((sum, tx) => sum + tx.amount, 0);
    const profit = totalRevenue - totalExpenses;

    return (
        <div className="bg-white min-h-screen p-8 text-sm text-gray-800 font-sans">
            {/* Header */}
            <div className="border-b-2 border-gray-800 pb-6 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wide mb-2">Laporan Keuangan Perjalanan</h1>
                        <p className="text-gray-500">Cahaya Cargo Express Management System</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-gray-600">No. Voyage</p>
                        <h2 className="text-2xl font-mono font-bold">{voyage.voyageNumber}</h2>
                        <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-8 mt-6">
                    <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wider">Rute</span>
                        <span className="font-semibold text-lg">{voyage.route}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wider">Kapal / Kendaraan</span>
                        <span className="font-semibold">{voyage.shipName || '-'} / {voyage.vehicleNumber || '-'}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs uppercase tracking-wider">Periode</span>
                        <span className="font-semibold">
                            {new Date(voyage.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            {voyage.arrivalDate && ` - ${new Date(voyage.arrivalDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Financial Summary Box */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
                <div className="grid grid-cols-3 gap-8 text-center">
                    <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Pendapatan</p>
                        <p className="text-2xl font-bold text-blue-600">{formatRupiah(totalRevenue)}</p>
                    </div>
                    <div className="border-x border-gray-200">
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Pengeluaran</p>
                        <p className="text-2xl font-bold text-red-600">{formatRupiah(totalExpenses)}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Keuntungan Bersih</p>
                        <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatRupiah(profit)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Income Detail (Cargo) */}
            <div className="mb-8">
                <h3 className="text-lg font-bold border-b border-gray-300 pb-2 mb-4">Rincian Pendapatan (Kargo)</h3>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                            <th className="py-2 w-10">No</th>
                            <th className="py-2">No STT</th>
                            <th className="py-2">Pengirim ➔ Penerima</th>
                            <th className="py-2 text-center">Koli</th>
                            <th className="py-2 text-right">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {transactions.map((t, i) => (
                            <tr key={t.id}>
                                <td className="py-3 text-gray-500">{i + 1}</td>
                                <td className="py-3 font-mono font-medium">{t.noSTT}</td>
                                <td className="py-3 text-sm">
                                    <span className="font-semibold">{t.pengirimName}</span>
                                    <span className="text-gray-400 mx-1">➔</span>
                                    <span>{t.penerimaName}</span>
                                </td>
                                <td className="py-3 text-center">{t.koli}</td>
                                <td className="py-3 text-right font-medium">{formatRupiah(t.jumlah)}</td>
                            </tr>
                        ))}
                        <tr className="bg-blue-50 font-bold border-t border-blue-100">
                            <td colSpan={3} className="py-3 text-right pr-4 uppercase text-xs tracking-wider">Total Pendapatan</td>
                            <td className="py-3 text-center">{transactions.reduce((sum, t) => sum + t.koli, 0)}</td>
                            <td className="py-3 text-right text-blue-700">{formatRupiah(totalRevenue)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Expense Detail */}
            <div className="mb-8">
                <h3 className="text-lg font-bold border-b border-gray-300 pb-2 mb-4">Rincian Pengeluaran</h3>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                            <th className="py-2 w-10">No</th>
                            <th className="py-2">Tanggal</th>
                            <th className="py-2">Kategori</th>
                            <th className="py-2">Keterangan</th>
                            <th className="py-2 text-right">Biaya</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {expenses.map((e, i) => (
                            <tr key={e.id}>
                                <td className="py-3 text-gray-500">{i + 1}</td>
                                <td className="py-3 text-gray-600">{new Date(e.date).toLocaleDateString('id-ID')}</td>
                                <td className="py-3 font-medium text-gray-800">{EXPENSE_CATEGORY_LABELS[e.category]}</td>
                                <td className="py-3 text-gray-600">{e.description}</td>
                                <td className="py-3 text-right font-medium text-red-600">{formatRupiah(e.amount)}</td>
                            </tr>
                        ))}
                        <tr className="bg-red-50 font-bold border-t border-red-100">
                            <td colSpan={4} className="py-3 text-right pr-4 uppercase text-xs tracking-wider">Total Pengeluaran</td>
                            <td className="py-3 text-right text-red-700">{formatRupiah(totalExpenses)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between items-end text-xs text-gray-500">
                <div>
                    <p>Dicetak melalui C2-MS System</p>
                    <p>{new Date().toLocaleString('id-ID')}</p>
                </div>
                <div className="text-center w-40">
                    <div className="h-16 mb-2 border-b border-gray-300"></div>
                    <p className="font-semibold">Penanggung Jawab</p>
                </div>
            </div>
        </div>
    );
}

export default function PrintVoyageReportPage(props: { params: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PrintVoyageReportContent params={props.params} />
        </Suspense>
    );
}
