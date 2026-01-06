'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getDashboardStats, type DashboardStats } from '@/lib/firestore-analytics';
import { formatRupiah } from '@/lib/currency';
import { TrendingUp, TrendingDown, DollarSign, Activity, Package } from 'lucide-react';

function PrintDashboardContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    useEffect(() => {
        const loadStats = async () => {
            if (!user) return;
            try {
                const data = await getDashboardStats(user.uid, startDate, endDate);
                setStats(data);
                setLoading(false);
            } catch (error) {
                console.error('Error loading dashboard report:', error);
                setLoading(false);
            }
        };

        loadStats();
    }, [user, searchParams]);

    useEffect(() => {
        if (!loading && stats) {
            setTimeout(() => {
                window.print();
            }, 1000);
        }
    }, [loading, stats]);

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat laporan dashboard...</div>;
    if (!stats) return null;

    return (
        <div className="bg-white min-h-screen p-8 text-sm text-gray-800 font-sans">
            {/* Header */}
            <div className="border-b-2 border-gray-800 pb-6 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wide mb-2">Laporan Dashboard BI</h1>
                        <p className="text-gray-500">Cahaya Cargo Express Management System</p>
                    </div>
                    <div className="text-right">
                        <p className="font-semibold text-gray-600">Periode Laporan</p>
                        <p className="text-lg font-bold">
                            {startDate ? startDate.toLocaleDateString('id-ID') : 'Awal'} - {endDate ? endDate.toLocaleDateString('id-ID') : 'Sekarang'}
                        </p>
                        <p className="text-gray-400 text-xs mt-1">Dicetak: {new Date().toLocaleString('id-ID')}</p>
                    </div>
                </div>
            </div>

            {/* Executive Summary */}
            <h2 className="text-lg font-bold border-b border-gray-300 pb-2 mb-4">Ringkasan Eksekutif</h2>
            <div className="grid grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Pendapatan</p>
                    <p className="text-2xl font-bold text-blue-600">{formatRupiah(stats.totalRevenue)}</p>
                    <p className={`text-xs mt-1 ${stats.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stats.revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(stats.revenueGrowth).toFixed(1)}% vs periode lalu
                    </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Pengeluaran</p>
                    <p className="text-2xl font-bold text-red-600">{formatRupiah(stats.totalExpenses)}</p>
                    <p className={`text-xs mt-1 ${stats.expensesGrowth > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {stats.expensesGrowth >= 0 ? '↑' : '↓'} {Math.abs(stats.expensesGrowth).toFixed(1)}% vs periode lalu
                    </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Keuntungan Bersih</p>
                    <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatRupiah(stats.netProfit)}
                    </p>
                    <p className={`text-xs mt-1 ${stats.profitGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stats.profitGrowth >= 0 ? '↑' : '↓'} {Math.abs(stats.profitGrowth).toFixed(1)}% vs periode lalu
                    </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Kargo Aktif</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.activeShipments}</p>
                    <p className="text-xs mt-1 text-gray-400">Sedang diproses</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Financial Trends Table */}
                <div>
                    <h3 className="text-base font-bold border-b border-gray-300 pb-2 mb-4">Tren Keuangan (Per Bulan/Periode)</h3>
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="py-2 px-2">Periode</th>
                                <th className="py-2 px-2 text-right">Pendapatan</th>
                                <th className="py-2 px-2 text-right">Pengeluaran</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.periodStats.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-100">
                                    <td className="py-2 px-2 font-medium">{item.name}</td>
                                    <td className="py-2 px-2 text-right text-blue-600">{formatRupiah(item.revenue)}</td>
                                    <td className="py-2 px-2 text-right text-red-600">{formatRupiah(item.expenses)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Top Clients Table */}
                <div>
                    <h3 className="text-base font-bold border-b border-gray-300 pb-2 mb-4">Top 5 Pelanggan</h3>
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="py-2 px-2 w-10">#</th>
                                <th className="py-2 px-2">Nama Pelanggan</th>
                                <th className="py-2 px-2 text-center">Transaksi</th>
                                <th className="py-2 px-2 text-right">Kontribusi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.topClients.map((client, idx) => (
                                <tr key={idx} className="border-b border-gray-100">
                                    <td className="py-2 px-2 text-gray-500">{idx + 1}</td>
                                    <td className="py-2 px-2 font-medium">{client.name}</td>
                                    <td className="py-2 px-2 text-center">{client.transactionCount}</td>
                                    <td className="py-2 px-2 text-right font-semibold text-gray-700">{formatRupiah(client.revenue)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Route Profitability */}
            <div className="mb-6">
                <h3 className="text-base font-bold border-b border-gray-300 pb-2 mb-4">Profitabilitas Rute</h3>
                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="py-2 px-2">Rute</th>
                            <th className="py-2 px-2 text-center">Margin</th>
                            <th className="py-2 px-2 text-right">Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.routeProfitability.slice(0, 8).map((route, idx) => (
                            <tr key={idx} className="border-b border-gray-100">
                                <td className="py-2 px-2 font-medium">{route.route}</td>
                                <td className="py-2 px-2 text-center">
                                    <span className={`px-2 py-0.5 rounded textxs font-semibold border ${route.margin >= 20 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                                        {route.margin.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="py-2 px-2 text-right font-semibold">{formatRupiah(route.profit)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between items-end text-xs text-gray-500">
                <div>
                    <p>Laporan ini digenerate otomatis oleh sistem.</p>
                </div>
                <div className="text-center w-40">
                    <div className="h-16 mb-2 border-b border-gray-300"></div>
                    <p className="font-semibold">Mengetahui</p>
                </div>
            </div>
        </div>
    );
}

export default function PrintDashboardPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PrintDashboardContent />
        </Suspense>
    );
}
