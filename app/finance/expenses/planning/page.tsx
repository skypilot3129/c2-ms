'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToExpensePlan, saveExpensePlan, deleteExpensePlan, subscribeToExpenses } from '@/lib/firestore-expenses';
import type { ExpensePlan, ExpensePlanItem, ExpenseCategory, PlanItemStatus, Expense } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_GROUPS } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';
import {
    Plus, Trash2, Save, ArrowLeft, CalendarDays,
    ClipboardList, CheckCircle2, XCircle, Clock,
    ChevronDown, ChevronUp, StickyNote, Zap, ArrowRight,
    TrendingDown, AlertTriangle,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

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

// ─────────────────────────────────────────────────────────
export default function ExpensePlanningPage() {
    const { user } = useAuth();

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
    const [openCatFor, setOpenCatFor] = useState<string | null>(null); // which item is picking category

    // Actual expenses for the plan date (for comparison)
    const [actuals, setActuals] = useState<Expense[]>([]);

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

    // ── subscribe to actual expenses for that date ──
    useEffect(() => {
        if (!user) return;
        return subscribeToExpenses(user.uid, (data) => {
            setActuals(
                data.filter(e => {
                    const ds = new Date(e.date).toISOString().split('T')[0];
                    return ds === planDate && (e.type === 'general' || !e.type) && e.status !== 'rejected';
                })
            );
        });
    }, [user, planDate]);

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

    // Quick-fill tomorrow from today's plan
    const copyToTomorrow = async () => {
        if (!user) return;
        const tomorrowDate = tomorrow();
        const planItems = items.map(i => ({ ...i, id: uid(), status: 'planned' as PlanItemStatus }));
        await saveExpensePlan(tomorrowDate, planItems, notes, user.uid);
        setPlanDate(tomorrowDate);
    };

    const dateLabel = new Date(planDate + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    return (
        <ProtectedRoute>
            <div className="space-y-5 pb-20">

                {/* ── Header ── */}
                <div className="flex items-center gap-3 flex-wrap">
                    <Link href="/finance/expenses" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                        <ArrowLeft size={16} /> Kembali
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <ClipboardList size={20} className="text-violet-600" /> Rencana Pengeluaran
                        </h1>
                        <p className="text-xs text-gray-500">Rencanakan pengeluaran operasional sebelum hari pelaksanaan</p>
                    </div>
                </div>

                {/* ── Date Picker ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                        <CalendarDays size={18} className="text-violet-500 shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Tanggal Rencana</p>
                            <p className="text-sm font-bold text-gray-800">{dateLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setPlanDate(today())}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${planDate === today() ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            Hari Ini
                        </button>
                        <button onClick={() => setPlanDate(tomorrow())}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${planDate === tomorrow() ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            Besok
                        </button>
                        <input
                            type="date"
                            value={planDate}
                            onChange={e => setPlanDate(e.target.value)}
                            className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-violet-200"
                        />
                    </div>
                </div>

                {/* ── Summary Cards ── */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white shadow-lg shadow-violet-500/20">
                        <p className="text-violet-100 text-[10px] font-medium mb-1">Estimasi Total</p>
                        <p className="text-lg font-bold leading-tight">{formatRupiah(totalEstimated)}</p>
                        <p className="text-violet-200 text-[10px] mt-1">{items.filter(i => i.status !== 'canceled').length} item</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg shadow-blue-500/20">
                        <p className="text-blue-100 text-[10px] font-medium mb-1">Realisasi Actual</p>
                        <p className="text-lg font-bold leading-tight">{formatRupiah(totalActual)}</p>
                        <p className="text-blue-200 text-[10px] mt-1">{actuals.length} transaksi</p>
                    </div>
                    <div className={`rounded-xl p-4 text-white shadow-lg ${diff > 0 ? 'from-orange-500 to-orange-600 bg-gradient-to-br shadow-orange-500/20' : diff < 0 ? 'from-emerald-500 to-emerald-600 bg-gradient-to-br shadow-emerald-500/20' : 'from-gray-400 to-gray-500 bg-gradient-to-br'}`}>
                        <p className="text-white/80 text-[10px] font-medium mb-1">Selisih</p>
                        <p className="text-lg font-bold leading-tight">{diff > 0 ? '+' : ''}{formatRupiah(diff)}</p>
                        <p className="text-white/70 text-[10px] mt-1">{diff > 0 ? '↑ Melebihi rencana' : diff < 0 ? '↓ Lebih hemat' : 'Sesuai rencana'}</p>
                    </div>
                </div>

                {/* Actual vs Planned comparison (when viewing today/past) */}
                {(isToday || isPast) && actuals.length > 0 && (
                    <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                            <TrendingDown size={15} className="text-blue-600" />
                            <h3 className="font-bold text-blue-800 text-sm">Pengeluaran Aktual Hari Ini</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {actuals.map(e => (
                                <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{e.description}</p>
                                        <span className="text-[10px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{EXPENSE_CATEGORY_LABELS[e.category]}</span>
                                    </div>
                                    <p className="font-bold text-red-600 text-sm shrink-0">{formatRupiah(e.amount)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Plan Items ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <StickyNote size={15} className="text-violet-500" />
                            Daftar Rencana Pengeluaran
                        </h3>
                        <button onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">
                            <Plus size={14} /> Tambah Item
                        </button>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {items.map((item, idx) => (
                            <div key={item.id} className={`p-4 space-y-3 transition-colors ${item.status === 'canceled' ? 'bg-gray-50 opacity-60' : ''}`}>
                                {/* Top row: category badge + status + delete */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-gray-400 font-bold w-5">{idx + 1}.</span>
                                    {/* Category picker trigger */}
                                    <button
                                        onClick={() => setOpenCatFor(openCatFor === item.id ? null : item.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
                                    >
                                        {EXPENSE_CATEGORY_LABELS[item.category]}
                                        <ChevronDown size={11} className={`transition-transform ${openCatFor === item.id ? 'rotate-180' : ''}`} />
                                    </button>
                                    {/* Status switcher */}
                                    <div className="flex items-center gap-1 ml-auto">
                                        {(['planned', 'done', 'canceled'] as PlanItemStatus[]).map(s => (
                                            <button key={s} onClick={() => updateItem(item.id, { status: s })}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${item.status === s ? STATUS_LABEL[s].color + ' border-current' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                                                {STATUS_LABEL[s].label}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors ml-1">
                                        <Trash2 size={13} />
                                    </button>
                                </div>

                                {/* Category dropdown */}
                                {openCatFor === item.id && (
                                    <div className="border border-violet-100 rounded-xl p-2 bg-violet-50 space-y-1.5">
                                        {EXPENSE_CATEGORY_GROUPS.map((grp, gi) => (
                                            <div key={grp.label}>
                                                <button onClick={() => setGroupOpen(groupOpen === gi ? null : gi)}
                                                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-[10px] font-bold text-gray-600 transition-colors">
                                                    {grp.label}
                                                    {groupOpen === gi ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                                </button>
                                                {groupOpen === gi && (
                                                    <div className="grid grid-cols-2 gap-1 mt-1 px-1">
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
                                        placeholder="Keterangan / deskripsi..."
                                        value={item.description}
                                        onChange={e => updateItem(item.id, { description: e.target.value })}
                                        className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-200 font-medium placeholder-gray-400"
                                    />
                                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 w-full sm:w-44">
                                        <span className="text-xs text-gray-400 shrink-0">Rp</span>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={item.estimatedAmount || ''}
                                            onChange={e => updateItem(item.id, { estimatedAmount: Number(e.target.value) })}
                                            className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-800"
                                            min={0}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Notes */}
                    <div className="px-4 pb-4">
                        <div className="border-t border-dashed border-gray-200 pt-4">
                            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Catatan Tambahan</label>
                            <textarea
                                value={notes}
                                onChange={e => { setNotes(e.target.value); setDirty(true); }}
                                placeholder="Catatan operasional, persiapan khusus, dll..."
                                rows={2}
                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-200 resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Warning if over budget ── */}
                {diff > 0 && totalEstimated > 0 && (
                    <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-orange-800 text-sm">
                        <AlertTriangle size={16} className="text-orange-500 shrink-0" />
                        <span>Pengeluaran aktual melebihi rencana sebesar <strong>{formatRupiah(diff)}</strong></span>
                    </div>
                )}

                {/* ── Action Bar ── */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 z-40 md:static md:border-none md:bg-transparent md:p-0">
                    {plan && (
                        <button onClick={handleDelete} className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                            <Trash2 size={14} /> Hapus
                        </button>
                    )}
                    <button onClick={copyToTomorrow} className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                        <Zap size={14} /> Salin ke Besok
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || (!dirty && !!plan)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-600/20 disabled:opacity-50 transition-all">
                        <Save size={15} />
                        {saving ? 'Menyimpan...' : plan ? 'Perbarui Rencana' : 'Simpan Rencana'}
                    </button>
                </div>

            </div>
        </ProtectedRoute>
    );
}
