'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToExpenses } from '@/lib/firestore-expenses';
import type { Expense, ExpenseCategory } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_GROUPS } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';
import { BarChart3, CalendarDays, ArrowLeft, TrendingDown } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

export default function ExpenseAnalyticsPage() {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterMonth, setFilterMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        if (!user) return;
        return subscribeToExpenses(user.uid, (data) => {
            setExpenses(data.filter(e => (e.type === 'general' || !e.type) && e.status !== 'rejected'));
            setLoading(false);
        });
    }, [user]);

    const filtered = useMemo(() => {
        const [y, m] = filterMonth.split('-').map(Number);
        return expenses.filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === y && d.getMonth() + 1 === m;
        });
    }, [expenses, filterMonth]);

    const total = filtered.reduce((s, e) => s + e.amount, 0);

    // By category
    const byCategory = useMemo(() => {
        const map: Partial<Record<ExpenseCategory, number>> = {};
        filtered.forEach(e => {
            map[e.category] = (map[e.category] || 0) + e.amount;
        });
        return Object.entries(map)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([cat, amt]) => ({ cat: cat as ExpenseCategory, amt: amt as number }));
    }, [filtered]);

    // Daily totals for bar chart
    const byDay = useMemo(() => {
        const map: Record<string, number> = {};
        filtered.forEach(e => {
            const key = new Date(e.date).toISOString().split('T')[0];
            map[key] = (map[key] || 0) + e.amount;
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered]);

    const maxDay = byDay.reduce((m, [, v]) => Math.max(m, v), 0);

    const monthLabel = (() => {
        const [y, m] = filterMonth.split('-');
        return new Date(Number(y), Number(m) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    })();

    // Pie chart SVG (simple donut)
    const PIE_COLORS = ['#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#e11d48'];
    const pieSlices = useMemo(() => {
        if (total === 0) return [];
        let cumAngle = -Math.PI / 2;
        return byCategory.slice(0, 12).map(({ cat, amt }, i) => {
            const frac = amt / total;
            const angle = frac * 2 * Math.PI;
            const x1 = 50 + 40 * Math.cos(cumAngle);
            const y1 = 50 + 40 * Math.sin(cumAngle);
            cumAngle += angle;
            const x2 = 50 + 40 * Math.cos(cumAngle);
            const y2 = 50 + 40 * Math.sin(cumAngle);
            const large = angle > Math.PI ? 1 : 0;
            return { cat, amt, frac, x1, y1, x2, y2, large, color: PIE_COLORS[i % PIE_COLORS.length] };
        });
    }, [byCategory, total]);

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data...</div>;

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3 flex-wrap">
                    <Link href="/finance/expenses" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                        <ArrowLeft size={16} /> Kembali
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><BarChart3 size={20} className="text-blue-600" /> Analitik Kas Kecil</h1>
                        <p className="text-xs text-gray-500">Visualisasi pengeluaran per kategori dan harian</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                        <CalendarDays size={16} className="text-blue-500" />
                        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border-none outline-none text-sm font-medium bg-transparent" />
                    </div>
                </div>

                {/* Total card */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white shadow-lg shadow-blue-600/20">
                    <p className="text-blue-200 text-xs font-medium mb-1">Total Pengeluaran – {monthLabel}</p>
                    <p className="text-3xl font-bold">{formatRupiah(total)}</p>
                    <p className="text-blue-200 text-xs mt-1">{filtered.length} transaksi</p>
                </div>

                {filtered.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <TrendingDown size={40} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Tidak ada data pengeluaran di bulan ini.</p>
                    </div>
                ) : (
                    <>
                        {/* ── Pie / Donut Chart ── */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                            <h2 className="font-bold text-gray-800 mb-4 text-sm">Komposisi per Kategori</h2>
                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                {/* SVG Donut */}
                                <div className="shrink-0">
                                    <svg viewBox="0 0 100 100" className="w-44 h-44">
                                        {pieSlices.length === 1 ? (
                                            <circle cx="50" cy="50" r="40" fill={PIE_COLORS[0]} />
                                        ) : (
                                            pieSlices.map((s, i) => (
                                                <path key={i}
                                                    d={`M50,50 L${s.x1},${s.y1} A40,40 0 ${s.large},1 ${s.x2},${s.y2} Z`}
                                                    fill={s.color}
                                                    stroke="white"
                                                    strokeWidth="0.5"
                                                />
                                            ))
                                        )}
                                        <circle cx="50" cy="50" r="24" fill="white" />
                                        <text x="50" y="48" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#1f2937">{byCategory.length}</text>
                                        <text x="50" y="55" textAnchor="middle" fontSize="4.5" fill="#6b7280">kategori</text>
                                    </svg>
                                </div>
                                {/* Legend */}
                                <div className="flex-1 space-y-2 w-full">
                                    {byCategory.slice(0, 10).map(({ cat, amt }, i) => (
                                        <div key={cat} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                                            <span className="text-xs text-gray-700 flex-1 truncate">{EXPENSE_CATEGORY_LABELS[cat] || cat}</span>
                                            <span className="text-xs font-semibold text-gray-800 shrink-0">{((amt / total) * 100).toFixed(1)}%</span>
                                            <span className="text-xs text-gray-500 w-24 text-right shrink-0">{formatRupiah(amt)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Bar Chart Daily ── */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                            <h2 className="font-bold text-gray-800 mb-4 text-sm">Pengeluaran Harian – {monthLabel}</h2>
                            {byDay.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">Tidak ada data.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <div className="flex items-end gap-1 min-w-max h-40 px-1">
                                        {byDay.map(([date, amt]) => {
                                            const height = maxDay > 0 ? Math.max(4, (amt / maxDay) * 100) : 4;
                                            const day = new Date(date + 'T00:00:00').getDate();
                                            return (
                                                <div key={date} className="flex flex-col items-center gap-1 group">
                                                    <div className="relative">
                                                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] rounded px-1.5 py-0.5 whitespace-nowrap z-10 transition-opacity">
                                                            {formatRupiah(amt)}
                                                        </div>
                                                        <div
                                                            className="w-6 bg-blue-500 hover:bg-blue-600 rounded-t transition-colors"
                                                            style={{ height: `${height}px` }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-gray-500 font-medium">{day}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Top Category Table ── */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50">
                                <h2 className="font-bold text-gray-800 text-sm">Rincian per Kategori</h2>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {byCategory.map(({ cat, amt }, i) => (
                                    <div key={cat} className="flex items-center gap-3 px-4 py-3">
                                        <span className="text-xs text-gray-400 w-5 font-bold">{i + 1}</span>
                                        <span className="text-sm text-gray-800 flex-1 font-medium">{EXPENSE_CATEGORY_LABELS[cat] || cat}</span>
                                        <div className="w-32 bg-gray-100 rounded-full h-1.5 hidden sm:block">
                                            <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(amt / total) * 100}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-red-600 w-28 text-right">{formatRupiah(amt)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </ProtectedRoute>
    );
}
