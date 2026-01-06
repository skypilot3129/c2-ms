'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    TrendingUp,
    Activity,
    Users,
    AlertTriangle,
    ArrowUpRight,
    BarChart3,
    PieChart,
    Crown,
    Wallet,
    ArrowLeft
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';

import { subscribeToTransactions } from '@/lib/firestore-transactions';
import { subscribeToVoyages } from '@/lib/firestore-voyages';
import { subscribeToExpenses } from '@/lib/firestore-expenses';
import { formatRupiah } from '@/lib/currency';
import type { Transaction } from '@/types/transaction';
import type { Voyage } from '@/types/voyage';
import type { Expense } from '@/types/voyage';

export default function OwnerDashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [dateRange, setDateRange] = useState<'this_month' | 'last_month' | 'all'>('this_month');

    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [voyages, setVoyages] = useState<Voyage[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    // Convert string range to Date objects
    const dateRangeDates = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        if (dateRange === 'this_month') {
            const startDate = new Date(currentYear, currentMonth, 1);
            const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
            return { startDate, endDate };
        }
        if (dateRange === 'last_month') {
            const startDate = new Date(currentYear, currentMonth - 1, 1);
            const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
            return { startDate, endDate };
        }
        // 'all' returns undefined
        return undefined;
    }, [dateRange]);

    useEffect(() => {
        if (!user) return;
        setLoading(true); // Show loading when range changes

        // Parallel subscription with filters
        const unsubTxn = subscribeToTransactions((data) => {
            setTransactions(data);
            setLoading(false); // Only set loading false after data arrives
        }, user.uid, dateRangeDates);

        const unsubVoyage = subscribeToVoyages(user.uid, (data) => setVoyages(data), dateRangeDates);
        const unsubExpense = subscribeToExpenses(user.uid, (data) => setExpenses(data), dateRangeDates);

        return () => {
            unsubTxn();
            unsubVoyage();
            unsubExpense();
        };
    }, [user, dateRangeDates]);

    // -- Calculations --

    // Data is already filtered by Firestore now!
    // We just need to filter out cancelled/unpaid statuses if needed, but date filtering is done.
    const filteredData = useMemo(() => {
        return {
            transactions: transactions.filter(t => t.status !== 'dibatalkan'),
            expenses: expenses, // Already filtered by date
            unpaidTransactions: transactions.filter(t => t.pelunasan === 'Pending' && t.status !== 'dibatalkan'),
            activeVoyages: voyages.filter(v => v.status === 'planned' || v.status === 'in-progress'),
        };
    }, [transactions, expenses, voyages]);

    // ... (rest of code)

    // Fix Tooltip formatter
    <Tooltip
        formatter={(value: any) => [formatRupiah(Number(value) || 0), 'Value']}
        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
    />

    const metrics = useMemo(() => {
        const revenue = filteredData.transactions.reduce((sum, t) => sum + t.jumlah, 0);
        const expenseTotal = filteredData.expenses.reduce((sum, e) => sum + e.amount, 0);
        // COGS estimation: could filter expenses by type='voyage' vs 'general' if needed. For now sum all.

        const netProfit = revenue - expenseTotal;
        const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

        const unpaidAmount = filteredData.unpaidTransactions.reduce((sum, t) => sum + t.jumlah, 0);

        return { revenue, expenseTotal, netProfit, margin, unpaidAmount };
    }, [filteredData]);

    // Chart Data Preparation (Daily Aggregation)
    const chartData = useMemo(() => {
        const map = new Map<string, { date: string; revenue: number; expense: number }>();

        // Helper to key by date
        const getKey = (d: Date) => d.toISOString().split('T')[0];

        filteredData.transactions.forEach(t => {
            const key = getKey(t.tanggal);
            const entry = map.get(key) || { date: key, revenue: 0, expense: 0 };
            entry.revenue += t.jumlah;
            map.set(key, entry);
        });

        filteredData.expenses.forEach(e => {
            const key = getKey(e.date);
            const entry = map.get(key) || { date: key, revenue: 0, expense: 0 };
            entry.expense += e.amount;
            map.set(key, entry);
        });

        // Convert to array and sort
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredData]);

    // Top Clients
    const topClients = useMemo(() => {
        const clientMap = new Map<string, { name: string; total: number; count: number }>();

        filteredData.transactions.forEach(t => {
            const name = t.pengirimName || 'Unknown';
            const entry = clientMap.get(name) || { name, total: 0, count: 0 };
            entry.total += t.jumlah;
            entry.count += 1;
            clientMap.set(name, entry);
        });

        return Array.from(clientMap.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [filteredData.transactions]);

    // Route Efficiency (Top Destinations)
    const topRoutes = useMemo(() => {
        const routeMap = new Map<string, { dest: string; count: number; revenue: number }>();

        filteredData.transactions.forEach(t => {
            const dest = t.tujuan || 'Unknown';
            const entry = routeMap.get(dest) || { dest, count: 0, revenue: 0 };
            entry.count += 1;
            entry.revenue += t.jumlah;
            routeMap.set(dest, entry);
        });

        return Array.from(routeMap.values())
            .sort((a, b) => b.revenue - a.revenue) // Sort by Revenue? Or Volume? Let's do Revenue
            .slice(0, 3);
    }, [filteredData.transactions]);


    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50 pb-20">
                {/* Premium Header */}
                <div className="bg-white border-b sticky top-0 z-30 bg-opacity-80 backdrop-blur-md">
                    <div className="container mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 bg-white/50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white transition-colors shadow-sm"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent flex items-center gap-2">
                                <Crown className="text-indigo-600" /> Pusat Kendali Owner
                            </h1>
                        </div>
                        <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 self-start md:self-auto">
                            <button
                                onClick={() => setDateRange('this_month')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${dateRange === 'this_month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Bulan Ini
                            </button>
                            <button
                                onClick={() => setDateRange('last_month')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${dateRange === 'last_month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Bulan Lalu
                            </button>
                            <button
                                onClick={() => setDateRange('all')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${dateRange === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Semua Data
                            </button>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-6 py-8 space-y-8">

                    {/* 1. Executive Pulse (Tickers) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Revenue Card */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                            <div className="relative">
                                <p className="text-slate-500 text-sm font-medium mb-1">Total Pendapatan</p>
                                <h3 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight truncate">
                                    {formatRupiah(metrics.revenue)}
                                </h3>
                                <div className="flex items-center gap-1 mt-2 text-emerald-600 text-sm font-medium">
                                    <TrendingUp size={16} />
                                    <span>Terverifikasi</span>
                                </div>
                            </div>
                        </div>

                        {/* Net Profit Card */}
                        <div className="bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-800 relative overflow-hidden group text-white">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                            <div className="relative">
                                <p className="text-slate-400 text-sm font-medium mb-1 flex items-center gap-2">
                                    Est. Laba Bersih
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${metrics.margin > 20 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                                        Margin {metrics.margin.toFixed(1)}%
                                    </span>
                                </p>
                                <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
                                    {formatRupiah(metrics.netProfit)}
                                </h3>
                                <div className="flex items-center gap-1 mt-2 text-emerald-400 text-sm font-medium">
                                    <ArrowUpRight size={16} />
                                    <span>Real-time</span>
                                </div>
                            </div>
                        </div>

                        {/* Active Operations */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                            <div className="relative">
                                <p className="text-slate-500 text-sm font-medium mb-1">Armada Jalan</p>
                                <h3 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                                    {filteredData.activeVoyages.length} <span className="text-sm font-normal text-slate-400">Dalam Perjalanan</span>
                                </h3>
                                <div className="flex items-center gap-1 mt-2 text-blue-600 text-sm font-medium">
                                    <Activity size={16} />
                                    <span>Beroperasi</span>
                                </div>
                            </div>
                        </div>

                        {/* Risks / Invoices */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                            <div className="relative">
                                <p className="text-slate-500 text-sm font-medium mb-1">Tagihan Belum Lunas</p>
                                <h3 className="text-3xl font-bold text-slate-800 tracking-tight">
                                    {filteredData.unpaidTransactions.length} <span className="text-lg text-slate-400 font-normal">Pending</span>
                                </h3>
                                <div className="flex items-center gap-1 mt-2 text-amber-600 text-sm font-medium">
                                    <AlertTriangle size={16} />
                                    <span>{formatRupiah(metrics.unpaidAmount)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Main Visuals (Charts) */}
                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Financial Deep Dive Chart */}
                        <div className="md:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[400px]">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Performa Keuangan</h3>
                                    <p className="text-slate-500 text-sm">Pendapatan vs Pengeluaran Operasional</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-2 bg-slate-50 rounded-lg text-indigo-600"><BarChart3 size={20} /></button>
                                </div>
                            </div>

                            <div className="h-80 w-full">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(val) => `Rp${(val / 1000000).toFixed(0)}Jt`} />
                                            <Tooltip
                                                formatter={(value: any) => formatRupiah(Number(value) || 0)}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="revenue" name="Pendapatan" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Bar dataKey="expense" name="Pengeluaran" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <BarChart3 size={48} className="mb-2 opacity-20" />
                                        <p>Belum ada data periode ini</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top Clients Lists */}
                        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Users size={20} className="text-indigo-500" />
                                Klien Teratas
                            </h3>
                            <div className="space-y-6">
                                {topClients.length > 0 ? topClients.map((client, i) => (
                                    <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors -mx-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                                {client.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{client.name}</p>
                                                <p className="text-xs text-slate-400">{client.count} Transaksi</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-700 text-sm">{formatRupiah(client.total)}</p>
                                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">High Vol</span>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-sm text-gray-500 text-center py-4">Belum ada data klien</p>
                                )}
                            </div>
                            <button onClick={() => router.push('/finance/receivables')} className="w-full mt-8 py-3 rounded-xl bg-slate-50 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-colors">
                                Lihat Detail Keuangan
                            </button>
                        </div>
                    </div>

                    {/* 3. Operational Heatmap / Routes */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-slate-900 rounded-3xl p-8 shadow-sm text-white overflow-hidden relative">
                            {/* Decorative Map BG */}
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-slate-900 to-slate-900"></div>

                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                    <Activity size={20} className="text-blue-400" />
                                    Rute Terpadat (Volume)
                                </h3>
                                <div className="space-y-4">
                                    {topRoutes.length > 0 ? topRoutes.map((r, i) => (
                                        <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-slate-200">{r.dest}</p>
                                                <div className="flex gap-2 mt-1">
                                                    <div className="h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
                                                        <div style={{ width: `${(r.revenue / (topRoutes[0].revenue || 1)) * 100}%` }} className="h-full bg-blue-500 rounded-full"></div>
                                                    </div>
                                                    <span className="text-xs text-slate-400">{formatRupiah(r.revenue)}</span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                {r.count} Jalan
                                            </span>
                                        </div>
                                    )) : (
                                        <p className="text-slate-500 text-sm">Belum ada data rute</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-6">Aksi Cepat</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => window.print()}
                                    className="p-4 rounded-xl bg-violet-50 text-violet-700 font-semibold hover:bg-violet-100 transition-colors text-left"
                                >
                                    <div className="mb-2 bg-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm">
                                        <BarChart3 size={20} />
                                    </div>
                                    Cetak Ringkasan
                                </button>
                                <button
                                    onClick={() => router.push('/finance/invoices')}
                                    className="p-4 rounded-xl bg-orange-50 text-orange-700 font-semibold hover:bg-orange-100 transition-colors text-left"
                                >
                                    <div className="mb-2 bg-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm">
                                        <AlertTriangle size={20} />
                                    </div>
                                    Cek Tagihan
                                </button>
                                <button
                                    onClick={() => router.push('/finance/expenses')}
                                    className="p-4 rounded-xl bg-red-50 text-red-700 font-semibold hover:bg-red-100 transition-colors text-left"
                                >
                                    <div className="mb-2 bg-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm">
                                        <Wallet size={20} />
                                    </div>
                                    Catat Pengeluaran
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
