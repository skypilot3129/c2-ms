'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatRupiah } from '@/lib/currency';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Calendar, TrendingUp, TrendingDown, DollarSign, Printer, Download, Banknote } from 'lucide-react';
import type { Expense, ExpenseCategory } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';

interface ReportData {
    revenue: number;
    pendingRevenue: number;
    cogs: number;
    opex: number;
    netProfit: number;
    voyageExpensesByCategory: Record<string, number>;
    generalExpensesByCategory: Record<string, number>;
}

export default function FinancialReportPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());

    const [data, setData] = useState<ReportData>({
        revenue: 0,
        pendingRevenue: 0,
        cogs: 0,
        opex: 0,
        netProfit: 0,
        voyageExpensesByCategory: {},
        generalExpensesByCategory: {}
    });

    useEffect(() => {
        if (!user) return;
        fetchReportData();
    }, [user, month, year]);

    const fetchReportData = async () => {
        if (!user) return;
        setLoading(true);

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);

        try {
            // 1. Fetch Revenue (Paid Transactions)
            // Note: We use 'tanggal' (Transaction Date) for revenue recognition in this simple version.
            //Ideally, we should rely on a separate 'ledger' or 'payments' collection for strict Cash Basis accounting.
            const txQuery = query(
                collection(db, 'transactions'),
                where('userId', '==', user.uid),
                where('tanggal', '>=', Timestamp.fromDate(startDate)),
                where('tanggal', '<=', Timestamp.fromDate(endDate))
            );
            const txDocs = await getDocs(txQuery);
            let revenue = 0;
            let pendingRevenue = 0; // Track potential revenue

            txDocs.forEach(doc => {
                const d = doc.data();
                // Fix: Only count Realized Revenue (Cash Basis) as requested
                // If pelunasan is NOT 'Pending', it means it's paid (Cash/TF)
                if (d.pelunasan && d.pelunasan !== 'Pending') {
                    revenue += d.jumlah || 0;
                } else {
                    pendingRevenue += d.jumlah || 0;
                }
            });

            // 2. Fetch Expenses
            const expenseQuery = query(
                collection(db, 'expenses'),
                where('userId', '==', user.uid),
                where('date', '>=', Timestamp.fromDate(startDate)),
                where('date', '<=', Timestamp.fromDate(endDate))
            );
            const expDocs = await getDocs(expenseQuery);

            let cogs = 0;
            let opex = 0;
            const voyageExpensesByCategory: Record<string, number> = {};
            const generalExpensesByCategory: Record<string, number> = {};

            expDocs.forEach(doc => {
                const d = doc.data() as Expense; // casting for easier access
                // Handle legacy data where type might be undefined (defaults to voyage)
                const type = d.type || 'voyage';
                const amount = d.amount || 0;
                const category = d.category;

                if (type === 'voyage') {
                    cogs += amount;
                    voyageExpensesByCategory[category] = (voyageExpensesByCategory[category] || 0) + amount;
                } else {
                    opex += amount;
                    generalExpensesByCategory[category] = (generalExpensesByCategory[category] || 0) + amount;
                }
            });

            setData({
                revenue,
                pendingRevenue,
                cogs,
                opex,
                netProfit: revenue - cogs - opex,
                voyageExpensesByCategory,
                generalExpensesByCategory
            });

        } catch (error) {
            console.error("Error fetching report:", error);
        } finally {
            setLoading(false);
        }
    };

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    return (
        <ProtectedRoute>
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Laporan Keuangan</h1>
                        <p className="text-gray-500 mt-1">Laba Rugi (Profit & Loss Statement)</p>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                        <Calendar size={20} className="text-gray-400 ml-2" />
                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="bg-transparent border-none focus:ring-0 text-gray-700 font-medium cursor-pointer"
                        >
                            {months.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="bg-transparent border-l border-gray-200 pl-3 focus:ring-0 text-gray-700 font-medium cursor-pointer"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => window.open(`/finance/reports/print?month=${month}&year=${year}`, '_blank')}
                            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors ml-2"
                            title="Cetak Laporan"
                        >
                            <Printer size={18} />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="h-64 flex items-center justify-center text-gray-400">Loading Report Data...</div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                        <TrendingUp size={24} />
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-600 rounded-md">Realized</span>
                                </div>
                                <p className="text-gray-500 text-sm mb-1">Pendapatan Bersih (Cash)</p>
                                <h3 className="text-2xl font-bold text-gray-800">{formatRupiah(data.revenue)}</h3>
                                {data.pendingRevenue > 0 && (
                                    <p className="text-xs text-orange-500 mt-2 font-medium flex items-center gap-1">
                                        + {formatRupiah(data.pendingRevenue)} tertunda
                                    </p>
                                )}
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                                        <Banknote size={24} />
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-orange-50 text-orange-600 rounded-md">COGS</span>
                                </div>
                                <p className="text-gray-500 text-sm mb-1">Biaya Operasional (HPP)</p>
                                <h3 className="text-2xl font-bold text-gray-800">{formatRupiah(data.cogs)}</h3>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                                        <TrendingDown size={24} />
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-red-50 text-red-600 rounded-md">OpEx</span>
                                </div>
                                <p className="text-gray-500 text-sm mb-1">Pengeluaran Umum</p>
                                <h3 className="text-2xl font-bold text-gray-800">{formatRupiah(data.opex)}</h3>
                            </div>

                            <div className={`p-6 rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300 ${data.netProfit >= 0 ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-white/20 rounded-xl text-white">
                                        <DollarSign size={24} />
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-white/20 text-white rounded-md">Net</span>
                                </div>
                                <p className="text-white/80 text-sm mb-1">Laba Bersih</p>
                                <h3 className="text-3xl font-bold">{formatRupiah(data.netProfit)}</h3>
                            </div>
                        </div>

                        {/* Detailed Report */}
                        <div className="grid lg:grid-cols-2 gap-8">
                            {/* Revenue & HPP */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                    <h2 className="text-lg font-bold text-gray-800">Pendapatan & HPP</h2>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b border-dashed border-gray-200">
                                        <span className="text-gray-600 font-medium">Total Penjualan (Gross Revenue)</span>
                                        <span className="text-gray-900 font-bold">{formatRupiah(data.revenue)}</span>
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Biaya Variabel (Perjalanan)</p>
                                        <div className="space-y-2">
                                            {Object.entries(data.voyageExpensesByCategory).map(([cat, amount]) => (
                                                <div key={cat} className="flex justify-between text-sm">
                                                    <span className="text-gray-600">{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat}</span>
                                                    <span className="text-gray-800">{formatRupiah(amount)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100 font-semibold">
                                                <span className="text-gray-800">Total HPP</span>
                                                <span className="text-red-500">-{formatRupiah(data.cogs)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 p-4 rounded-xl flex justify-between items-center mt-4">
                                        <span className="text-blue-800 font-bold">Gross Profit (Laba Kotor)</span>
                                        <span className="text-blue-800 font-bold text-lg">{formatRupiah(data.revenue - data.cogs)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* OpEx (General Expenses) */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                    <h2 className="text-lg font-bold text-gray-800">Biaya Operasional (OpEx)</h2>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-3 mb-6">
                                        {Object.entries(data.generalExpensesByCategory).map(([cat, amount]) => (
                                            <div key={cat} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                                    <span className="text-gray-700 font-medium">{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat}</span>
                                                </div>
                                                <span className="text-gray-800 font-semibold">{formatRupiah(amount)}</span>
                                            </div>
                                        ))}
                                        {Object.keys(data.generalExpensesByCategory).length === 0 && (
                                            <p className="text-center text-gray-400 py-4">Belum ada pengeluaran umum bulan ini.</p>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                                        <span className="text-gray-800 font-bold">Total OpEx</span>
                                        <span className="text-red-600 font-bold text-lg">-{formatRupiah(data.opex)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}
