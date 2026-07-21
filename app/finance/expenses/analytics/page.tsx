'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToExpenses, subscribeToTopUps } from '@/lib/firestore-expenses';
import type { Expense, ExpenseCategory, PettyCashTopUp } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';
import {
    BarChart3, CalendarDays, ArrowLeft, TrendingDown, Sparkles, Printer,
    CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, FileText, Calendar
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { analyzeExpensesWithGemini, ExpenseAnalysisPayload, ExpenseAnalysisResult } from '@/app/actions/expense-analysis';

type FilterPeriodMode = 'month' | 'range';

export default function ExpenseAnalyticsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [topups, setTopups] = useState<PettyCashTopUp[]>([]);
    const [loading, setLoading] = useState(true);

    // Period Filter State
    const [filterMode, setFilterMode] = useState<FilterPeriodMode>('month');
    const [filterMonth, setFilterMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // AI Analysis State
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<ExpenseAnalysisResult | null>(null);

    useEffect(() => {
        if (!user) return;
        const unsub1 = subscribeToExpenses(user.uid, (data) => {
            setExpenses(data.filter(e => (e.type === 'general' || !e.type) && e.status !== 'rejected'));
            setLoading(false);
        });
        const unsub2 = subscribeToTopUps(user.uid, (data) => {
            setTopups(data);
        });

        return () => {
            unsub1();
            unsub2();
        };
    }, [user]);

    // Filtered Expenses & Top-ups based on selected period
    const { filteredExpenses, filteredTopups, periodLabel } = useMemo(() => {
        if (filterMode === 'month') {
            const [y, m] = filterMonth.split('-').map(Number);
            const filteredExp = expenses.filter(e => {
                const d = new Date(e.date);
                return d.getFullYear() === y && d.getMonth() + 1 === m;
            });
            const filteredTop = topups.filter(t => {
                const d = new Date(t.date);
                return d.getFullYear() === y && d.getMonth() + 1 === m;
            });
            const monthName = new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            return { filteredExpenses: filteredExp, filteredTopups: filteredTop, periodLabel: monthName };
        } else {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const filteredExp = expenses.filter(e => {
                const d = new Date(e.date);
                return d >= start && d <= end;
            });
            const filteredTop = topups.filter(t => {
                const d = new Date(t.date);
                return d >= start && d <= end;
            });

            const fmtStart = new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            const fmtEnd = new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            return { filteredExpenses: filteredExp, filteredTopups: filteredTop, periodLabel: `${fmtStart} - ${fmtEnd}` };
        }
    }, [expenses, topups, filterMode, filterMonth, startDate, endDate]);

    const totalExpenses = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);
    const totalTopups = useMemo(() => filteredTopups.reduce((s, t) => s + t.amount, 0), [filteredTopups]);
    const netCashFlow = totalTopups - totalExpenses;

    // By Category
    const byCategory = useMemo(() => {
        const map: Partial<Record<ExpenseCategory, { amount: number; count: number }>> = {};
        filteredExpenses.forEach(e => {
            const curr = map[e.category] || { amount: 0, count: 0 };
            map[e.category] = { amount: curr.amount + e.amount, count: curr.count + 1 };
        });

        return Object.entries(map)
            .sort(([, a], [, b]) => b.amount - a.amount)
            .map(([cat, val]) => ({
                cat: cat as ExpenseCategory,
                label: EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat,
                amount: val.amount,
                count: val.count,
                percentage: totalExpenses > 0 ? (val.amount / totalExpenses) * 100 : 0
            }));
    }, [filteredExpenses, totalExpenses]);

    // Top 5 Largest Expenses
    const topExpenses = useMemo(() => {
        return [...filteredExpenses]
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)
            .map(e => ({
                description: e.description,
                amount: e.amount,
                categoryLabel: EXPENSE_CATEGORY_LABELS[e.category] || e.category,
                date: new Date(e.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
            }));
    }, [filteredExpenses]);

    // Daily totals for bar chart
    const byDay = useMemo(() => {
        const map: Record<string, number> = {};
        filteredExpenses.forEach(e => {
            const key = new Date(e.date).toISOString().split('T')[0];
            map[key] = (map[key] || 0) + e.amount;
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    }, [filteredExpenses]);

    const maxDay = byDay.reduce((m, [, v]) => Math.max(m, v), 0);

    // Pie chart SVG (simple donut)
    const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#e11d48'];
    const pieSlices = useMemo(() => {
        if (totalExpenses === 0) return [];
        let cumAngle = -Math.PI / 2;
        return byCategory.slice(0, 12).map(({ cat, amount }, i) => {
            const frac = amount / totalExpenses;
            const angle = frac * 2 * Math.PI;
            const x1 = 50 + 40 * Math.cos(cumAngle);
            const y1 = 50 + 40 * Math.sin(cumAngle);
            cumAngle += angle;
            const x2 = 50 + 40 * Math.cos(cumAngle);
            const y2 = 50 + 40 * Math.sin(cumAngle);
            const large = angle > Math.PI ? 1 : 0;
            return { cat, amount, frac, x1, y1, x2, y2, large, color: PIE_COLORS[i % PIE_COLORS.length] };
        });
    }, [byCategory, totalExpenses]);

    // Prepare payload & trigger Gemini AI
    const buildAiPayload = (): ExpenseAnalysisPayload => {
        const statusCounts = {
            approved: filteredExpenses.filter(e => e.status === 'approved').length,
            pending: filteredExpenses.filter(e => e.status === 'pending').length,
            draft: filteredExpenses.filter(e => e.status === 'draft').length,
            rejected: filteredExpenses.filter(e => e.status === 'rejected').length,
        };

        return {
            periodLabel,
            totalExpenses,
            totalTopups,
            netCashFlow,
            totalCount: filteredExpenses.length,
            categoryBreakdown: byCategory.map(c => ({
                category: c.cat,
                categoryLabel: c.label,
                amount: c.amount,
                percentage: c.percentage,
                count: c.count
            })),
            topExpenses,
            statusCounts
        };
    };

    const handleGenerateAiAnalysis = async () => {
        if (filteredExpenses.length === 0) {
            alert('Tidak ada transaksi pengeluaran pada periode yang dipilih untuk dianalisa.');
            return;
        }

        setIsAiLoading(true);
        try {
            const payloadData = buildAiPayload();
            const res = await analyzeExpensesWithGemini(payloadData);
            setAiResult(res);

            // Save to sessionStorage for printable page
            sessionStorage.setItem('cce_expense_ai_payload', JSON.stringify(payloadData));
            sessionStorage.setItem('cce_expense_ai_result', JSON.stringify(res));
        } catch (error) {
            console.error('Failed to generate AI analysis:', error);
            alert('Gagal membuat analisa AI. Silakan coba lagi.');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleOpenPrintPage = () => {
        const payloadData = buildAiPayload();
        sessionStorage.setItem('cce_expense_ai_payload', JSON.stringify(payloadData));
        if (aiResult) {
            sessionStorage.setItem('cce_expense_ai_result', JSON.stringify(aiResult));
        }
        router.push('/finance/expenses/analytics/print-ai-report');
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data analitik kas kecil...</div>;

    return (
        <ProtectedRoute>
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                {/* Header Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                    <div className="flex items-center gap-3">
                        <Link href="/finance/expenses" className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <BarChart3 size={22} className="text-blue-600" /> Analitik & Analisa AI Kas Kecil
                            </h1>
                            <p className="text-xs text-gray-500">Visualisasi data pengeluaran dan laporan otomatis berbasis Gemini AI</p>
                        </div>
                    </div>

                    {/* Period Switcher */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-gray-100 p-1 rounded-xl flex items-center text-xs font-semibold">
                            <button
                                onClick={() => setFilterMode('month')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${filterMode === 'month' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Per Bulan
                            </button>
                            <button
                                onClick={() => setFilterMode('range')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${filterMode === 'range' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Rentang Tanggal
                            </button>
                        </div>

                        {filterMode === 'month' ? (
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs">
                                <CalendarDays size={16} className="text-blue-600" />
                                <input
                                    type="month"
                                    value={filterMonth}
                                    onChange={e => setFilterMonth(e.target.value)}
                                    className="border-none outline-none font-semibold text-gray-800 bg-transparent"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs">
                                <Calendar size={16} className="text-blue-600" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="border-none outline-none font-semibold text-gray-800 bg-transparent"
                                />
                                <span className="text-gray-400 font-bold">s/d</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="border-none outline-none font-semibold text-gray-800 bg-transparent"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-600/20">
                        <p className="text-blue-200 text-xs font-medium mb-1">Total Pengeluaran – {periodLabel}</p>
                        <p className="text-3xl font-extrabold">{formatRupiah(totalExpenses)}</p>
                        <p className="text-blue-200 text-xs mt-1">{filteredExpenses.length} transaksi pengeluaran</p>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                        <p className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">Total Pemasukan / Topup</p>
                        <p className="text-2xl font-bold text-emerald-600">{formatRupiah(totalTopups)}</p>
                        <p className="text-gray-500 text-xs mt-1">{filteredTopups.length} transaksi kas masuk</p>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                        <p className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wider">Arus Kas Netto</p>
                        <p className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-blue-700' : 'text-amber-600'}`}>
                            {formatRupiah(netCashFlow)}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">{netCashFlow >= 0 ? 'Surplus kas kecil' : 'Defisit kas kecil'}</p>
                    </div>
                </div>

                {/* ── AI Gemini Analysis Section & Action Banner ── */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 text-white shadow-xl">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
                        <div>
                            <div className="flex items-center gap-2 text-blue-400 text-xs font-extrabold tracking-wider uppercase mb-1">
                                <Sparkles size={16} /> Analisa Keuangan Cerdas Gemini AI
                            </div>
                            <h2 className="text-xl font-bold text-white">Laporan Analisa Pengeluaran ({periodLabel})</h2>
                            <p className="text-xs text-slate-300 mt-1">Dapatkan insight otomatis mengenai tren pengeluaran, risiko boros, dan rekomendasi efisiensi biaya.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <button
                                onClick={handleGenerateAiAnalysis}
                                disabled={isAiLoading || filteredExpenses.length === 0}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 flex-1 md:flex-initial"
                            >
                                {isAiLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Menganalisa dengan Gemini AI...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} /> {aiResult ? 'Analisa Ulang Gemini AI' : 'Generasi Analisa AI'}
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleOpenPrintPage}
                                disabled={filteredExpenses.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 flex-1 md:flex-initial"
                            >
                                <Printer size={16} /> Cetak Laporan PDF (A4)
                            </button>
                        </div>
                    </div>

                    {/* AI Result Cards Preview */}
                    {aiResult ? (
                        <div className="space-y-4 text-slate-100 text-xs">
                            {/* Executive Summary & Score */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-3 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
                                    <p className="text-blue-300 font-bold text-xs uppercase mb-1">📝 Ringkasan Eksekutif:</p>
                                    <p className="text-slate-200 leading-relaxed">{aiResult.summary}</p>
                                </div>

                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 text-center flex flex-col items-center justify-center">
                                    <span className="text-slate-300 text-[10px] uppercase font-bold tracking-wider">Health Score</span>
                                    <div className="text-3xl font-black text-blue-400 mt-1">{aiResult.healthScore} <span className="text-xs text-slate-400">/ 100</span></div>
                                    <span className="mt-1 bg-blue-500/30 text-blue-200 font-bold px-2 py-0.5 rounded text-[10px] border border-blue-400/30">
                                        {aiResult.healthStatus}
                                    </span>
                                </div>
                            </div>

                            {/* Two columns: Insights & Savings */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/10">
                                    <h4 className="font-bold text-blue-300 text-xs mb-2.5 flex items-center gap-1.5">
                                        <CheckCircle2 size={14} className="text-blue-400" /> Analisa Kategori Utama
                                    </h4>
                                    <ul className="space-y-1.5 text-slate-300">
                                        {aiResult.categoryInsights.map((insight, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-blue-400 font-bold">•</span>
                                                <span>{insight}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/10">
                                    <h4 className="font-bold text-emerald-300 text-xs mb-2.5 flex items-center gap-1.5">
                                        <ShieldCheck size={14} className="text-emerald-400" /> Rekomendasi Efisiensi & Kontrol
                                    </h4>
                                    <ul className="space-y-1.5 text-slate-300">
                                        {aiResult.savingsRecommendations.map((rec, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-emerald-400 font-bold">✓</span>
                                                <span>{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {aiResult.anomaliesOrRisks && aiResult.anomaliesOrRisks.length > 0 && (
                                <div className="bg-amber-500/10 backdrop-blur-md p-3.5 rounded-xl border border-amber-500/20 text-amber-200">
                                    <p className="font-bold text-amber-300 text-xs mb-1 flex items-center gap-1.5">
                                        <AlertTriangle size={14} /> Catatan Anomali & Risiko Pengeluaran:
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {aiResult.anomaliesOrRisks.map((risk, idx) => (
                                            <span key={idx} className="bg-amber-400/20 text-amber-200 px-2.5 py-1 rounded-lg text-[11px] border border-amber-400/30">
                                                ⚠️ {risk}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 text-center border border-white/10">
                            <Sparkles className="w-10 h-10 text-blue-400 mx-auto mb-2 opacity-60 animate-pulse" />
                            <p className="text-sm font-semibold text-slate-200">Analisa AI Gemini Belum Dibuat</p>
                            <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1 mb-4">
                                Klik tombol <strong>"Generasi Analisa AI"</strong> di atas untuk memproses analisa keuangan kas kecil otomatis dan mencetaknya sebagai dokumen PDF formal.
                            </p>
                        </div>
                    )}
                </div>

                {filteredExpenses.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-400">
                        <TrendingDown size={40} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-medium">Tidak ada data pengeluaran pada periode {periodLabel}.</p>
                    </div>
                ) : (
                    <>
                        {/* ── Pie / Donut Chart ── */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
                            <h2 className="font-bold text-gray-800 mb-4 text-sm">Komposisi Pengeluaran per Kategori ({periodLabel})</h2>
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
                                <div className="flex-1 space-y-2.5 w-full">
                                    {byCategory.slice(0, 10).map(({ cat, label, amount, percentage }, i) => (
                                        <div key={cat} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                                            <span className="text-xs text-gray-700 flex-1 truncate font-medium">{label}</span>
                                            <span className="text-xs font-semibold text-gray-800 shrink-0">{percentage.toFixed(1)}%</span>
                                            <span className="text-xs font-bold text-gray-900 w-28 text-right shrink-0 font-mono">{formatRupiah(amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Bar Chart Daily ── */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
                            <h2 className="font-bold text-gray-800 mb-4 text-sm">Grafik Pengeluaran Harian – {periodLabel}</h2>
                            {byDay.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">Tidak ada data.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <div className="flex items-end gap-1.5 min-w-max h-44 px-2 pt-6">
                                        {byDay.map(([dateStr, amt]) => {
                                            const height = maxDay > 0 ? Math.max(6, (amt / maxDay) * 120) : 6;
                                            const formattedDay = new Date(dateStr + 'T00:00:00').getDate();
                                            return (
                                                <div key={dateStr} className="flex flex-col items-center gap-1 group">
                                                    <div className="relative">
                                                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-mono rounded px-2 py-1 whitespace-nowrap z-10 transition-opacity shadow-lg">
                                                            {dateStr}: {formatRupiah(amt)}
                                                        </div>
                                                        <div
                                                            className="w-6 bg-blue-600 hover:bg-blue-500 rounded-t-md transition-colors cursor-pointer"
                                                            style={{ height: `${height}px` }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-gray-500 font-medium">{formattedDay}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Top Category Breakdown Table ── */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                                <h2 className="font-bold text-gray-800 text-sm">Rincian Lengkap Kategori Pengeluaran</h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {byCategory.map(({ cat, label, amount, count, percentage }, i) => (
                                    <div key={cat} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/80 transition-colors">
                                        <span className="text-xs text-gray-400 w-6 font-bold">{i + 1}</span>
                                        <div className="flex-1 min-w-[160px]">
                                            <p className="text-sm font-bold text-gray-800">{label}</p>
                                            <p className="text-[11px] text-gray-500">{count} transaksi pengeluaran</p>
                                        </div>
                                        <div className="w-36 bg-gray-100 rounded-full h-2 hidden md:block overflow-hidden">
                                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, percentage)}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 w-16 text-right font-mono">{percentage.toFixed(1)}%</span>
                                        <span className="text-sm font-extrabold text-red-650 w-32 text-right font-mono">{formatRupiah(amount)}</span>
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
