'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToExpensePlan, saveExpensePlan, deleteExpensePlan, subscribeToExpenses } from '@/lib/firestore-expenses';
import type { ExpensePlan, ExpensePlanItem, ExpenseCategory, PlanItemStatus, Expense } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_GROUPS } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';
import {
    Plus, Trash2, Save, ArrowLeft, CalendarDays,
    ClipboardList, CheckCircle2, XCircle, Clock,
    ChevronDown, ChevronUp, StickyNote, Zap, ArrowRight,
    TrendingDown, AlertTriangle, Sparkles, Printer, ShieldCheck, RefreshCw, Calendar
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { generateRoutineExpensePlanWithGemini, RoutinePlannerPayload, RoutinePlannerResult, ScheduledRoutineItem } from '@/app/actions/routine-expense-planner';

// ── helpers ──────────────────────────────────────────────
const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
};

const today = () => new Date().toISOString().split('T')[0];

const uid = () => Math.random().toString(36).slice(2, 10);

const STATUS_LABEL: Record<PlanItemStatus, { label: string; color: string; icon: React.ReactNode }> = {
    planned: { label: 'Direncanakan', color: 'bg-blue-100 text-blue-700',    icon: <Clock size={11} /> },
    done:    { label: 'Terealisasi',   color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 size={11} /> },
    canceled:{ label: 'Dibatalkan',    color: 'bg-gray-100 text-gray-500',    icon: <XCircle size={11} /> },
};

const EMPTY_ITEM = (): ExpensePlanItem => ({
    id: uid(),
    category: 'bbm_solar',
    description: '',
    estimatedAmount: 0,
    status: 'planned',
});

export default function ExpensePlanningPage() {
    const { user } = useAuth();
    const router = useRouter();

    // The date being planned
    const [planDate, setPlanDate] = useState(tomorrow());

    // Saved plan from Firestore
    const [plan, setPlan] = useState<ExpensePlan | null>(null);

    // Working edit state
    const [items, setItems] = useState<ExpensePlanItem[]>([EMPTY_ITEM()]);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [groupOpen, setGroupOpen] = useState<number | null>(null);
    const [openCatFor, setOpenCatFor] = useState<string | null>(null);

    // Actual expenses & historical expenses
    const [actuals, setActuals] = useState<Expense[]>([]);
    const [allExpenses, setAllExpenses] = useState<Expense[]>([]);

    // Gemini AI Routine Planning State
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<RoutinePlannerResult | null>(null);
    const [targetPeriodMonth, setTargetPeriodMonth] = useState(() => {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    });

    const isToday = planDate === today();
    const isPast  = planDate < today();

    // ── subscribe to plan ──
    useEffect(() => {
        if (!user) return;
        return subscribeToExpensePlan(planDate, user.uid, (p) => {
            setPlan(p);
            if (p) {
                setItems(p.items.length ? p.items : [EMPTY_ITEM()]);
                setNotes(p.notes || '');
            } else {
                setItems([EMPTY_ITEM()]);
                setNotes('');
            }
            setDirty(false);
        });
    }, [user, planDate]);

    // ── subscribe to all expenses for pattern analysis & comparison ──
    useEffect(() => {
        if (!user) return;
        return subscribeToExpenses(user.uid, (data) => {
            const generalExps = data.filter(e => (e.type === 'general' || !e.type) && e.status !== 'rejected');
            setAllExpenses(generalExps);
            setActuals(
                generalExps.filter(e => {
                    const ds = new Date(e.date).toISOString().split('T')[0];
                    return ds === planDate;
                })
            );
        });
    }, [user, planDate]);

    // Routine Categories Pattern Analysis
    const routineCategoryStats = useMemo(() => {
        const catMap: Record<string, { total: number; count: number; lastDate: string }> = {};
        allExpenses.forEach(e => {
            const dateStr = typeof e.date === 'string' ? e.date : new Date(e.date).toISOString();
            const curr = catMap[e.category] || { total: 0, count: 0, lastDate: dateStr };
            const lastD = new Date(e.date) > new Date(curr.lastDate) ? dateStr : curr.lastDate;
            catMap[e.category] = { total: curr.total + e.amount, count: curr.count + 1, lastDate: lastD };
        });

        // Estimate monthly avg based on 3-month sample or available range
        return Object.entries(catMap)
            .sort(([, a], [, b]) => b.total - a.total)
            .map(([cat, stat]) => {
                const count = stat.count;
                const freq = count >= 8 ? 'Harian/Mingguan' : count >= 3 ? 'Mingguan' : 'Bulanan/Insidental';
                const formattedLastDate = new Date(stat.lastDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                return {
                    category: cat,
                    categoryLabel: EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat,
                    avgMonthly: Math.round(stat.total / 3), // 3-month avg approximation
                    transactionCount: count,
                    lastDate: formattedLastDate,
                    frequencyLabel: freq
                };
            });
    }, [allExpenses]);

    // ── calculations ──
    const totalEstimated = items.filter(i => i.status !== 'canceled').reduce((s, i) => s + i.estimatedAmount, 0);
    const totalActual    = actuals.reduce((s, e) => s + e.amount, 0);
    const diff           = totalActual - totalEstimated;

    // ── handlers ──
    const updateItem = (id: string, patch: Partial<ExpensePlanItem>) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
        setDirty(true);
    };

    const addItem = () => {
        setItems(prev => [...prev, EMPTY_ITEM()]);
        setDirty(true);
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
        setDirty(true);
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const validItems = items.filter(i => i.description.trim() && i.estimatedAmount > 0);
            await saveExpensePlan(planDate, validItems, notes, user.uid);
            setDirty(false);
        } catch { alert('Gagal menyimpan rencana'); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!plan || !confirm('Hapus rencana pengeluaran ini?')) return;
        await deleteExpensePlan(plan.id);
    };

    const copyToTomorrow = async () => {
        if (!user) return;
        const tomorrowDate = tomorrow();
        const planItems = items.map(i => ({ ...i, id: uid(), status: 'planned' as PlanItemStatus }));
        await saveExpensePlan(tomorrowDate, planItems, notes, user.uid);
        setPlanDate(tomorrowDate);
    };

    // Build payload & generate Routine Plan with Gemini AI
    const buildRoutinePayload = (): RoutinePlannerPayload => {
        const [y, m] = targetPeriodMonth.split('-').map(Number);
        const periodLabelStr = new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        const totalHistorical = allExpenses.reduce((s, e) => s + e.amount, 0);

        const recent = allExpenses
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10)
            .map(e => ({
                description: e.description,
                categoryLabel: EXPENSE_CATEGORY_LABELS[e.category] || e.category,
                amount: e.amount,
                date: new Date(e.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
            }));

        return {
            targetPeriodLabel: periodLabelStr,
            totalHistoricalExpenses: totalHistorical,
            routineCategories: routineCategoryStats,
            recentExpenses: recent
        };
    };

    const handleGenerateRoutinePlan = async () => {
        if (allExpenses.length === 0) {
            alert('Belum ada histori pengeluaran untuk dianalisa.');
            return;
        }

        setIsAiLoading(true);
        try {
            const payloadData = buildRoutinePayload();
            const res = await generateRoutineExpensePlanWithGemini(payloadData);
            setAiResult(res);

            sessionStorage.setItem('cce_routine_plan_payload', JSON.stringify(payloadData));
            sessionStorage.setItem('cce_routine_plan_result', JSON.stringify(res));
        } catch (error) {
            console.error('Failed to generate AI routine plan:', error);
            alert('Gagal membuat rencana rutin AI.');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleImportItemToPlan = (scheduled: ScheduledRoutineItem) => {
        const newItem: ExpensePlanItem = {
            id: uid(),
            category: 'bbm_solar', // default or matched
            description: `[${scheduled.categoryLabel}] ${scheduled.description}`,
            estimatedAmount: scheduled.estimatedAmount,
            status: 'planned'
        };
        setItems(prev => [...prev.filter(i => i.description.trim() !== ''), newItem]);
        setDirty(true);
    };

    const handleOpenPrintRoutinePage = () => {
        const payloadData = buildRoutinePayload();
        sessionStorage.setItem('cce_routine_plan_payload', JSON.stringify(payloadData));
        if (aiResult) {
            sessionStorage.setItem('cce_routine_plan_result', JSON.stringify(aiResult));
        }
        router.push('/finance/expenses/routine-planning/print');
    };

    const dateLabel = new Date(planDate + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    return (
        <ProtectedRoute>
            <div className="space-y-6 pb-24 max-w-7xl mx-auto">

                {/* ── Header Toolbar ── */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                    <div className="flex items-center gap-3">
                        <Link href="/finance/expenses" className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <ClipboardList size={22} className="text-violet-600" /> Perencanaan & Penjadwalan Pengeluaran Rutin
                            </h1>
                            <p className="text-xs text-gray-500">Analisa biaya operasional berulang, jadwalkan pengeluaran rutin, dan rencanakan anggaran</p>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 1: AI Gemini Routine Expense Planner Banner & Actions ── */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-2xl p-6 text-white shadow-xl">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
                        <div>
                            <div className="flex items-center gap-2 text-violet-300 text-xs font-extrabold tracking-wider uppercase mb-1">
                                <Sparkles size={16} /> Gemini AI Routine Expense Planner
                            </div>
                            <h2 className="text-xl font-bold text-white">Analisa & Penjadwalan Pengeluaran Rutin Operasional</h2>
                            <p className="text-xs text-slate-300 mt-1">Sistem akan menganalisa riwayat pengeluaran rutin (BBM, gaji, listrik, maintenance) & membuat jadwal proyeksi yang teratur.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs">
                                <Calendar size={15} className="text-violet-300" />
                                <span className="text-slate-300">Target Periode:</span>
                                <input
                                    type="month"
                                    value={targetPeriodMonth}
                                    onChange={e => setTargetPeriodMonth(e.target.value)}
                                    className="border-none outline-none font-bold text-white bg-transparent cursor-pointer"
                                />
                            </div>

                            <button
                                onClick={handleGenerateRoutinePlan}
                                disabled={isAiLoading || allExpenses.length === 0}
                                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 flex-1 md:flex-initial"
                            >
                                {isAiLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Menyusun Rencana AI...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} /> {aiResult ? 'Analisa Ulang Rencana AI' : 'Buat Rencana Rutin AI'}
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleOpenPrintRoutinePage}
                                disabled={allExpenses.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 flex-1 md:flex-initial"
                            >
                                <Printer size={16} /> Cetak PDF Rencana & Jadwal
                            </button>
                        </div>
                    </div>

                    {/* AI Generated Result Preview */}
                    {aiResult ? (
                        <div className="space-y-4 text-slate-100 text-xs">
                            {/* Summary & Projected Cost */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-3 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
                                    <p className="text-violet-300 font-bold text-xs uppercase mb-1">📌 Analisa Strategis Pengeluaran Rutin:</p>
                                    <p className="text-slate-200 leading-relaxed">{aiResult.executiveSummary}</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 text-center flex flex-col items-center justify-center">
                                    <span className="text-slate-300 text-[10px] uppercase font-bold tracking-wider">Estimasi Total Beban Rutin</span>
                                    <div className="text-xl font-black text-emerald-400 mt-1">{formatRupiah(aiResult.totalProjectedRoutineCost)}</div>
                                    <span className="text-[10px] text-slate-300 mt-0.5">{aiResult.scheduledItems.length} item terjadwal</span>
                                </div>
                            </div>

                            {/* Scheduled Routine Table */}
                            <div className="bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/10 overflow-hidden">
                                <h4 className="font-bold text-violet-300 text-xs mb-3 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5"><CalendarDays size={16} /> Jadwal & Rincian Pengeluaran Rutin Terjadwal</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Klik "+ Impor" untuk menyalin item ke rencana harian</span>
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px]">
                                                <th className="py-2 px-3">Target Jadwal</th>
                                                <th className="py-2 px-3">Kategori</th>
                                                <th className="py-2 px-3">Keterangan Pengeluaran</th>
                                                <th className="py-2 px-3">Prioritas</th>
                                                <th className="py-2 px-3 text-right">Estimasi (Rp)</th>
                                                <th className="py-2 px-3 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-slate-200">
                                            {aiResult.scheduledItems.map((item, idx) => (
                                                <tr key={item.id || idx} className="hover:bg-white/5 transition-colors">
                                                    <td className="py-2.5 px-3 font-bold text-violet-300 whitespace-nowrap">
                                                        {item.targetDate}
                                                        <span className="block text-[9px] text-slate-400 font-normal">{item.cycle}</span>
                                                    </td>
                                                    <td className="py-2.5 px-3 font-semibold text-slate-300 whitespace-nowrap">{item.categoryLabel}</td>
                                                    <td className="py-2.5 px-3">
                                                        <p className="font-medium text-white">{item.description}</p>
                                                        {item.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">{item.notes}</p>}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${item.priority === 'TINGGI' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : item.priority === 'SEDANG' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                                                            {item.priority}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-bold font-mono text-emerald-400 whitespace-nowrap">
                                                        {formatRupiah(item.estimatedAmount)}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <button
                                                            onClick={() => handleImportItemToPlan(item)}
                                                            className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all active:scale-95 whitespace-nowrap"
                                                        >
                                                            + Impor ke Plan
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 text-center border border-white/10">
                            <Sparkles className="w-10 h-10 text-violet-400 mx-auto mb-2 opacity-60 animate-pulse" />
                            <p className="text-sm font-semibold text-slate-200">Jadwal Rencana Pengeluaran AI Belum Dibuat</p>
                            <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1 mb-4">
                                Klik tombol <strong>"Buat Rencana Rutin AI"</strong> di atas untuk memproses analisa pengeluaran berulang otomatis & mencetak laporan PDF formal.
                            </p>
                        </div>
                    )}
                </div>

                {/* ── SECTION 2: Daily Expense Planner & Actual Comparison ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                        <div>
                            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                                <CalendarDays size={18} className="text-violet-600" /> Form Perencanaan Harian Kas Kecil
                            </h3>
                            <p className="text-xs text-gray-500">Pilih tanggal untuk menyusun atau mengedit rencana item pengeluaran harian</p>
                        </div>

                        {/* Date Picker Switcher */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => setPlanDate(today())}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${planDate === today() ? 'bg-violet-600 text-white border-violet-600 shadow-xs' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                Hari Ini
                            </button>
                            <button onClick={() => setPlanDate(tomorrow())}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${planDate === tomorrow() ? 'bg-violet-600 text-white border-violet-600 shadow-xs' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                Besok
                            </button>
                            <input
                                type="date"
                                value={planDate}
                                onChange={e => setPlanDate(e.target.value)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-800 bg-gray-50 outline-none focus:ring-2 focus:ring-violet-200"
                            />
                        </div>
                    </div>

                    {/* Summary Stat Cards for Selected Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl p-4 text-white shadow-md shadow-violet-600/20">
                            <p className="text-violet-200 text-[10px] font-medium mb-1">Estimasi Total Rencana</p>
                            <p className="text-xl font-extrabold">{formatRupiah(totalEstimated)}</p>
                            <p className="text-violet-200 text-[10px] mt-1">{items.filter(i => i.status !== 'canceled').length} item direncanakan</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white shadow-md shadow-blue-600/20">
                            <p className="text-blue-200 text-[10px] font-medium mb-1">Realisasi Actual ({planDate})</p>
                            <p className="text-xl font-extrabold">{formatRupiah(totalActual)}</p>
                            <p className="text-blue-200 text-[10px] mt-1">{actuals.length} transaksi tercatat</p>
                        </div>
                        <div className={`rounded-xl p-4 text-white shadow-md ${diff > 0 ? 'from-orange-500 to-orange-600 bg-gradient-to-br shadow-orange-500/20' : diff < 0 ? 'from-emerald-500 to-emerald-600 bg-gradient-to-br shadow-emerald-500/20' : 'from-gray-600 to-gray-700 bg-gradient-to-br'}`}>
                            <p className="text-white/80 text-[10px] font-medium mb-1">Selisih Realisasi</p>
                            <p className="text-xl font-extrabold">{diff > 0 ? '+' : ''}{formatRupiah(diff)}</p>
                            <p className="text-white/80 text-[10px] mt-1">{diff > 0 ? '↑ Melebihi rencana' : diff < 0 ? '↓ Lebih hemat' : 'Sesuai rencana'}</p>
                        </div>
                    </div>

                    {/* Actual vs Planned comparison (when viewing today/past) */}
                    {(isToday || isPast) && actuals.length > 0 && (
                        <div className="bg-blue-50/50 rounded-xl border border-blue-100 shadow-xs overflow-hidden">
                            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                                <TrendingDown size={16} className="text-blue-600" />
                                <h3 className="font-bold text-blue-900 text-xs uppercase tracking-wider">Realisasi Pengeluaran Aktual ({dateLabel})</h3>
                            </div>
                            <div className="divide-y divide-blue-50">
                                {actuals.map(e => (
                                    <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">{e.description}</p>
                                            <span className="text-[10px] text-blue-700 font-semibold bg-blue-100/80 rounded px-2 py-0.5 mt-0.5 inline-block">
                                                {EXPENSE_CATEGORY_LABELS[e.category]}
                                            </span>
                                        </div>
                                        <p className="font-extrabold text-red-650 text-sm shrink-0 font-mono">{formatRupiah(e.amount)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Plan Items Form List */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-2">
                                <StickyNote size={15} className="text-violet-600" />
                                Daftar Rencana Item Pengeluaran Tanggal {planDate}
                            </h3>
                            <button onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-900 transition-colors">
                                <Plus size={15} /> Tambah Baris Rencana
                            </button>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {items.map((item, idx) => (
                                <div key={item.id} className={`p-4 space-y-3 transition-colors ${item.status === 'canceled' ? 'bg-gray-50 opacity-60' : ''}`}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-gray-400 font-bold w-5">{idx + 1}.</span>
                                        <button
                                            onClick={() => setOpenCatFor(openCatFor === item.id ? null : item.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors"
                                        >
                                            {EXPENSE_CATEGORY_LABELS[item.category]}
                                            <ChevronDown size={11} className={`transition-transform ${openCatFor === item.id ? 'rotate-180' : ''}`} />
                                        </button>

                                        <div className="flex items-center gap-1 ml-auto">
                                            {(['planned', 'done', 'canceled'] as PlanItemStatus[]).map(s => (
                                                <button key={s} onClick={() => updateItem(item.id, { status: s })}
                                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${item.status === s ? STATUS_LABEL[s].color + ' border-current' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                                                    {STATUS_LABEL[s].label}
                                                </button>
                                            ))}
                                        </div>
                                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors ml-1">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* Category dropdown */}
                                    {openCatFor === item.id && (
                                        <div className="border border-violet-100 rounded-xl p-2.5 bg-violet-50/50 space-y-2">
                                            {EXPENSE_CATEGORY_GROUPS.map((grp, gi) => (
                                                <div key={grp.label}>
                                                    <button onClick={() => setGroupOpen(groupOpen === gi ? null : gi)}
                                                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[10px] font-bold text-gray-600 transition-colors">
                                                        {grp.label}
                                                        {groupOpen === gi ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                                    </button>
                                                    {groupOpen === gi && (
                                                        <div className="grid grid-cols-2 gap-1 mt-1.5 px-1">
                                                            {grp.categories.map(cat => (
                                                                <button key={cat}
                                                                    onClick={() => { updateItem(item.id, { category: cat }); setOpenCatFor(null); }}
                                                                    className={`text-left px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${item.category === cat ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-violet-50'}`}>
                                                                    {EXPENSE_CATEGORY_LABELS[cat]}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Description + Amount */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            type="text"
                                            placeholder="Keterangan / deskripsi rencana pengeluaran..."
                                            value={item.description}
                                            onChange={e => updateItem(item.id, { description: e.target.value })}
                                            className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-200 font-medium placeholder-gray-400"
                                        />
                                        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 w-full sm:w-48">
                                            <span className="text-xs text-gray-400 font-semibold shrink-0">Rp</span>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                value={item.estimatedAmount || ''}
                                                onChange={e => updateItem(item.id, { estimatedAmount: Number(e.target.value) })}
                                                className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-800 font-mono"
                                                min={0}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Notes */}
                        <div className="px-4 pb-4">
                            <div className="border-t border-dashed border-gray-200 pt-3">
                                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Catatan Operasional Rencana</label>
                                <textarea
                                    value={notes}
                                    onChange={e => { setNotes(e.target.value); setDirty(true); }}
                                    placeholder="Catatan persetujuan, armada rute khusus, atau petunjuk pembayaran..."
                                    rows={2}
                                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-200 resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-3 pt-2">
                        {plan && (
                            <button onClick={handleDelete} className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors">
                                <Trash2 size={15} /> Hapus Rencana
                            </button>
                        )}
                        <button onClick={copyToTomorrow} className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors">
                            <Zap size={15} /> Salin ke Besok
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || (!dirty && !!plan)}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-600/20 disabled:opacity-50 transition-all active:scale-95"
                        >
                            <Save size={16} />
                            {saving ? 'Menyimpan...' : plan ? 'Perbarui Rencana Tanggal Ini' : 'Simpan Rencana Tanggal Ini'}
                        </button>
                    </div>
                </div>

            </div>
        </ProtectedRoute>
    );
}
