'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatRupiah } from '@/lib/currency';
import type { Expense, ExpenseCategory } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';
import { Printer } from 'lucide-react';

interface ReportData {
    revenue: number;
    pendingRevenue: number;
    cogs: number;
    opex: number;
    netProfit: number;
    voyageExpensesByCategory: Record<string, number>;
    generalExpensesByCategory: Record<string, number>;
}

import { Suspense } from 'react';

// ... (keep imports)

function PrintFinancialReportContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();

    // Default to current date if params missing
    const paramMonth = searchParams.get('month');
    const paramYear = searchParams.get('year');

    const month = paramMonth ? parseInt(paramMonth) : new Date().getMonth();
    const year = paramYear ? parseInt(paramYear) : new Date().getFullYear();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ReportData>({
        revenue: 0,
        pendingRevenue: 0,
        cogs: 0,
        opex: 0,
        netProfit: 0,
        voyageExpensesByCategory: {},
        generalExpensesByCategory: {}
    });
    const [generatedAt, setGeneratedAt] = useState('');

    useEffect(() => {
        // Safe formatting
        setGeneratedAt(new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }));
    }, []);

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    // ... (rest of logic: useEffects, fetchReportData) ..
    useEffect(() => {
        if (!user) return;
        fetchReportData();
    }, [user, month, year]);

    useEffect(() => {
        if (!loading && data) {
            setTimeout(() => window.print(), 500);
        }
    }, [loading, data]);

    const fetchReportData = async () => {
        if (!user) return;
        setLoading(true);

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);

        try {
            // 1. Fetch Revenue
            const txQuery = query(
                collection(db, 'transactions'),
                where('userId', '==', user.uid),
                where('tanggal', '>=', Timestamp.fromDate(startDate)),
                where('tanggal', '<=', Timestamp.fromDate(endDate))
            );
            const txDocs = await getDocs(txQuery);
            let revenue = 0;
            let pendingRevenue = 0;

            txDocs.forEach(doc => {
                const d = doc.data();
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
                const d = doc.data() as Expense;
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

    if (loading) return <div className="p-12 text-center text-gray-500">Menyiapkan Laporan...</div>;

    return (
        <div className="bg-white min-h-screen text-black p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
            {/* Print trigger */}
            <button
                onClick={() => window.print()}
                className="fixed top-4 right-4 bg-blue-600 text-white p-3 rounded-full print:hidden shadow-lg hover:bg-blue-700 transition-colors"
                title="Print Laporan"
            >
                <Printer size={24} />
            </button>

            {/* Header */}
            <div className="text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-bold uppercase tracking-wider mb-2">Laporan Laba Rugi</h1>
                <h2 className="text-lg font-medium">{months[month]} {year}</h2>
                <p className="text-sm text-gray-500 mt-1">Cahaya Cargo Express Management System</p>
            </div>

            {/* Content Table */}
            <div className="space-y-6">
                {/* 1. Revenue */}
                <div>
                    <h3 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">1. Pendapatan (Revenue)</h3>
                    <div className="flex justify-between items-center py-1">
                        <span className="text-gray-700">Pendapatan Usaha (Realized/Cash Basis)</span>
                        <span className="font-bold">{formatRupiah(data.revenue)}</span>
                    </div>
                </div>

                {/* 2. COGS */}
                <div>
                    <h3 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">2. Beban Pokok Pendapatan (Cost of Revenue)</h3>
                    <div className="pl-4 space-y-1">
                        {Object.entries(data.voyageExpensesByCategory).map(([cat, amount]) => (
                            <div key={cat} className="flex justify-between items-center py-1 text-sm">
                                <span className="text-gray-600">{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat}</span>
                                <span>{formatRupiah(amount)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center py-2 mt-1 border-t border-gray-200 font-medium">
                        <span>Total Beban Pokok</span>
                        <span className="text-red-600">({formatRupiah(data.cogs)})</span>
                    </div>
                </div>

                {/* Gross Profit */}
                <div className="bg-gray-50 p-2 border border-gray-200 flex justify-between items-center font-bold">
                    <span>LABA KOTOR (GROSS PROFIT)</span>
                    <span>{formatRupiah(data.revenue - data.cogs)}</span>
                </div>

                {/* 3. OpEx */}
                <div>
                    <h3 className="text-sm font-bold uppercase border-b border-gray-400 pb-1 mb-2">3. Beban Operasional (OpEx)</h3>
                    <div className="pl-4 space-y-1">
                        {Object.entries(data.generalExpensesByCategory).map(([cat, amount]) => (
                            <div key={cat} className="flex justify-between items-center py-1 text-sm">
                                <span className="text-gray-600">{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat}</span>
                                <span>{formatRupiah(amount)}</span>
                            </div>
                        ))}
                        {Object.keys(data.generalExpensesByCategory).length === 0 && (
                            <div className="text-gray-400 italic text-sm py-1">Tidak ada pengeluaran umum.</div>
                        )}
                    </div>
                    <div className="flex justify-between items-center py-2 mt-1 border-t border-gray-200 font-medium">
                        <span>Total Beban Operasional</span>
                        <span className="text-red-600">({formatRupiah(data.opex)})</span>
                    </div>
                </div>

                {/* Net Profit */}
                <div className="border-y-2 border-black py-3 flex justify-between items-center text-xl font-bold mt-8">
                    <span>LABA BERSIH (NET PROFIT)</span>
                    <span>{formatRupiah(data.netProfit)}</span>
                </div>

                {/* Footer Notes */}
                <div className="mt-12 text-xs text-gray-500 text-center">
                    <p>Laporan ini digenerate otomatis oleh sistem pada {generatedAt}.</p>
                    <p className="mt-1">
                        Catatan: Pendapatan dihitung berdasarkan kas yang diterima (Cash Basis).
                        Potensi pendapatan tertunda (Piutang) sebesar <strong>{formatRupiah(data.pendingRevenue)}</strong> tidak termasuk dalam laporan ini.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function PrintFinancialReportPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Memuat Laporan...</div>}>
            <PrintFinancialReportContent />
        </Suspense>
    );
}
