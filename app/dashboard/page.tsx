'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import DateRangePicker, { type DateRange } from '@/components/DateRangePicker';
import { getDashboardStats, generateCSV, type DashboardStats } from '@/lib/firestore-analytics';
import { formatRupiah } from '@/lib/currency';
import {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    Package,
    DollarSign,
    Activity,
    ArrowLeft,
    Download,
    Printer
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

export default function DashboardPage() {
    console.log('Rendering Dashboard Page...'); // Debug log
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | null>(null);

    useEffect(() => {
        const loadStats = async () => {
            if (!user) return;
            try {
                setLoading(true);
                // Default to 'Bulan Ini' if no range selected yet (handled inside component initially, but here we can force it or wait)
                // Actually DateRangePicker will fire onChange on mount? No, usually not.
                // Let's pass null to let library handle default or set typical default here.
                const data = await getDashboardStats(user.uid, dateRange?.startDate, dateRange?.endDate);
                setStats(data);
            } catch (error) {
                console.error('Error loading dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, [user, dateRange]);

    const handleDateRangeChange = (range: DateRange) => {
        setDateRange(range);
    };

    const handleExport = () => {
        if (!stats) return;
        const csv = generateCSV(stats, dateRange?.label || 'Bulan Ini');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan-Dashboard-${dateRange?.label || 'Bulan-Ini'}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading && !stats) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Memuat dashboard...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    if (!stats) return null;

    const GrowthIndicator = ({ value }: { value: number }) => {
        if (value === 0) return <span className="text-gray-400 text-xs text-nowrap">vs periode lalu</span>;
        const isPositive = value > 0;
        return (
            <span className={`text-xs font-medium flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(value).toFixed(1)}%
                <span className="text-gray-400 font-normal ml-1">vs periode lalu</span>
            </span>
        );
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50/50">
                <div className="container mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-flex items-center gap-2">
                                <ArrowLeft size={16} />
                                Menu Utama
                            </Link>
                            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                                Dashboard BI
                                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">v2.0</span>
                            </h1>
                            <p className="text-gray-500 mt-1">Analisis performa & profitabilitas bisnis</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <DateRangePicker onChange={handleDateRangeChange} />
                            <button
                                onClick={() => {
                                    const params = new URLSearchParams();
                                    if (dateRange?.startDate) params.append('startDate', dateRange.startDate.toISOString());
                                    if (dateRange?.endDate) params.append('endDate', dateRange.endDate.toISOString());
                                    window.open(`/dashboard/print-report?${params.toString()}`, '_blank');
                                }}
                                className="bg-white border border-gray-200 text-gray-700 p-2 rounded-lg hover:bg-gray-50 shadow-sm"
                                title="Cetak PDF"
                            >
                                <Printer size={18} />
                            </button>
                            <button
                                onClick={handleExport}
                                className="bg-white border border-gray-200 text-gray-700 p-2 rounded-lg hover:bg-gray-50 shadow-sm"
                                title="Export CSV"
                            >
                                <Download size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {/* Revenue */}
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Total Pendapatan</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatRupiah(stats.totalRevenue)}</h3>
                                </div>
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <DollarSign size={20} />
                                </div>
                            </div>
                            <GrowthIndicator value={stats.revenueGrowth} />
                        </div>

                        {/* Expenses */}
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Total Pengeluaran</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatRupiah(stats.totalExpenses)}</h3>
                                </div>
                                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                                    <TrendingDown size={20} />
                                </div>
                            </div>
                            <GrowthIndicator value={stats.expensesGrowth} />
                        </div>

                        {/* Profit */}
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Keuntungan Bersih</p>
                                    <h3 className={`text-2xl font-bold mt-1 ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatRupiah(stats.netProfit)}
                                    </h3>
                                </div>
                                <div className={`p-2 rounded-lg ${stats.netProfit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                    <TrendingUp size={20} />
                                </div>
                            </div>
                            <GrowthIndicator value={stats.profitGrowth} />
                        </div>

                        {/* Active Shipments */}
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Kargo Aktif</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.activeShipments}</h3>
                                </div>
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                    <Package size={20} />
                                </div>
                            </div>
                            <p className="text-xs text-purple-600 font-medium bg-purple-50 inline-block px-2 py-1 rounded-md">
                                Sedang diproses
                            </p>
                        </div>
                    </div>

                    {/* Main Charts Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Financial Chart */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
                            <h3 className="text-lg font-bold text-gray-800 mb-6">Tren Keuangan</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.periodStats} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tickFormatter={(value: number) => `Rp${(value / 1000000).toFixed(0)}jt`} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                        <Tooltip
                                            formatter={(value: number | undefined) => formatRupiah(value || 0)}
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Bar dataKey="revenue" name="Pendapatan" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                        <Bar dataKey="expenses" name="Pengeluaran" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Clients */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Top 5 Pelanggan</h3>
                            <div className="space-y-4">
                                {stats.topClients.map((client, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800 text-sm">{client.name}</p>
                                                <p className="text-xs text-gray-500">{client.transactionCount} Transaksi</p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700">{formatRupiah(client.revenue)}</span>
                                    </div>
                                ))}
                                {stats.topClients.length === 0 && (
                                    <p className="text-gray-400 text-center py-4 text-sm">Belum ada data pelanggan</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Secondary Metrics Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Route Profitability */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Profitabilitas Rute</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l-lg">Rute</th>
                                            <th className="px-4 py-3">Margin</th>
                                            <th className="px-4 py-3 rounded-r-lg text-right">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.routeProfitability.slice(0, 5).map((route, idx) => (
                                            <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                                                <td className="px-4 py-3 font-medium text-gray-800">{route.route}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${route.margin >= 20 ? 'bg-green-100 text-green-700' : route.margin > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                        {route.margin.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-700">{formatRupiah(route.profit)}</td>
                                            </tr>
                                        ))}
                                        {stats.routeProfitability.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="text-center py-4 text-gray-400">Belum ada data rute</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Shipment Status */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Status Pengiriman</h3>
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="h-48 w-48 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats.shipmentStatusStats}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {stats.shipmentStatusStats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-2xl font-bold text-gray-800">{stats.activeShipments}</span>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-3 w-full">
                                    {stats.shipmentStatusStats.map(stat => (
                                        <div key={stat.name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></div>
                                                <span className="text-sm text-gray-600">{stat.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{ width: `${(stat.value / (stats.shipmentStatusStats.reduce((a, b) => a + b.value, 0) || 1)) * 100}%`, backgroundColor: stat.color }}
                                                    ></div>
                                                </div>
                                                <span className="text-sm font-bold text-gray-800 w-6 text-right">{stat.value}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity Feed */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-6">Aktivitas Terbaru</h3>
                        <div className="space-y-4">
                            {stats.recentActivity.map((item) => (
                                <div key={item.id} className="flex items-center justify-between border-b border-gray-50 pb-4 last:border-0 last:pb-0 hover:bg-gray-50/50 p-2 rounded-lg transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-full flex-shrink-0 ${item.type === 'transaction' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                                            {item.type === 'transaction' ? <Package size={20} /> : <Activity size={20} />}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">{item.description}</p>
                                            <p className="text-xs text-gray-500 flex items-center gap-2">
                                                {new Date(item.date).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                                {item.status && (
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.status === 'selesai' ? 'bg-green-100 text-green-700' :
                                                        item.status === 'dibatalkan' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`font-bold ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {item.amount > 0 ? '+' : ''}{formatRupiah(item.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
