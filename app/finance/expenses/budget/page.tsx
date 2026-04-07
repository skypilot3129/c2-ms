'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToExpenses, subscribeToBudget, saveBudget } from '@/lib/firestore-expenses';
import type { Expense, ExpenseCategory } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_GROUPS } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';
import { Target, CalendarDays, ArrowLeft, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

export default function BudgetPage() {
    const { user, role } = useAuth();
    const isManager = ['admin', 'pengurus'].includes(role);

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [budgets, setBudgets] = useState<Partial<Record<string, number>>>({});
    const [editBudgets, setEditBudgets] = useState<Partial<Record<string, string>>>({});
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const [filterMonth, setFilterMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        if (!user) return;
        const u1 = subscribeToExpenses(user.uid, (data) => {
            setExpenses(data.filter(e => (e.type === 'general' || !e.type) && e.status !== 'rejected'));
            setLoading(false);
        });
        return u1;
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const u2 = subscribeToBudget(filterMonth, (b) => { setBudgets(b); });
        return u2;
    }, [user, filterMonth]);

    const filteredExpenses = useMemo(() => {
        const [y, m] = filterMonth.split('-').map(Number);
        return expenses.filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === y && d.getMonth() + 1 === m;
        });
    }, [expenses, filterMonth]);

    // Spending per category
    const spendingByCategory = useMemo(() => {
        const map: Partial<Record<ExpenseCategory, number>> = {};
        filteredExpenses.forEach(e => {
            map[e.category] = (map[e.category] || 0) + e.amount;
        });
        return map;
    }, [filteredExpenses]);

    const allCats = EXPENSE_CATEGORY_GROUPS.flatMap(g => g.categories);

    const totalBudget = allCats.reduce((s, c) => s + (budgets[c] || 0), 0);
    const totalSpent = allCats.reduce((s, c) => s + (spendingByCategory[c] || 0), 0);

    const handleSave = async () => {
        setSaving(true);
        const parsed: Record<string, number> = {};
        Object.entries(editBudgets).forEach(([k, v]) => {
            const n = Number(v);
            if (n > 0) parsed[k] = n;
        });
        await saveBudget(filterMonth, parsed);
        setEditMode(false);
        setSaving(false);
    };

    const openEdit = () => {
        const init: Partial<Record<string, string>> = {};
        allCats.forEach(c => { init[c] = budgets[c] ? String(budgets[c]) : ''; });
        setEditBudgets(init);
        setEditMode(true);
    };

    const monthLabel = (() => {
        const [y, m] = filterMonth.split('-');
        return new Date(Number(y), Number(m) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    })();

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data...</div>;

    return (
        <ProtectedRoute>
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3 flex-wrap">
                    <Link href="/finance/expenses" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                        <ArrowLeft size={16} /> Kembali
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Target size={20} className="text-purple-600" /> Anggaran Bulanan</h1>
                        <p className="text-xs text-gray-500">Kelola anggaran pengeluaran per kategori</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                        <CalendarDays size={16} className="text-blue-500" />
                        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border-none outline-none text-sm font-medium bg-transparent" />
                    </div>
                    {isManager && !editMode && (
                        <button onClick={openEdit} className="flex items-center gap-1.5 bg-purple-600 text-white hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all">
                            <Target size={15} /> Atur Anggaran
                        </button>
                    )}
                    {editMode && (
                        <div className="flex gap-2">
                            <button onClick={() => setEditMode(false)} className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium">Batal</button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-purple-600 text-white hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-medium shadow-sm disabled:opacity-50">
                                <Save size={15} /> {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg shadow-purple-500/20">
                        <p className="text-purple-100 text-[10px] font-medium mb-1">Total Anggaran</p>
                        <p className="text-lg font-bold">{formatRupiah(totalBudget)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-lg shadow-red-500/20">
                        <p className="text-red-100 text-[10px] font-medium mb-1">Terpakai</p>
                        <p className="text-lg font-bold">{formatRupiah(totalSpent)}</p>
                    </div>
                    <div className={`rounded-xl p-4 text-white shadow-lg ${totalBudget - totalSpent < 0 ? 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-orange-500/20' : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/20'}`}>
                        <p className="text-emerald-100 text-[10px] font-medium mb-1">Sisa Anggaran</p>
                        <p className="text-lg font-bold">{formatRupiah(totalBudget - totalSpent)}</p>
                    </div>
                </div>

                {/* Category Budget Cards */}
                {EXPENSE_CATEGORY_GROUPS.map(group => {
                    const groupHasBudget = group.categories.some(c => (budgets[c] || 0) > 0 || (spendingByCategory[c] || 0) > 0);
                    if (!editMode && !groupHasBudget) return null;

                    return (
                        <div key={group.label} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50">
                                <h2 className="font-bold text-gray-800 text-sm">{group.label}</h2>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {group.categories.map(cat => {
                                    const budget = budgets[cat] || 0;
                                    const spent = spendingByCategory[cat] || 0;
                                    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                                    const over = budget > 0 && spent > budget;
                                    const warn = budget > 0 && pct >= 80 && !over;

                                    if (!editMode && budget === 0 && spent === 0) return null;

                                    return (
                                        <div key={cat} className="px-4 py-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-sm font-medium text-gray-800">{EXPENSE_CATEGORY_LABELS[cat]}</span>
                                                <div className="flex items-center gap-2">
                                                    {over && <AlertTriangle size={14} className="text-orange-500" />}
                                                    {!over && budget > 0 && spent <= budget * 0.5 && <CheckCircle2 size={14} className="text-emerald-500" />}
                                                    <span className="text-xs text-red-600 font-semibold">{formatRupiah(spent)}</span>
                                                    {budget > 0 && <span className="text-xs text-gray-400 font-medium">/ {formatRupiah(budget)}</span>}
                                                </div>
                                            </div>
                                            {budget > 0 && (
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full transition-all ${over ? 'bg-orange-500' : warn ? 'bg-yellow-400' : 'bg-emerald-500'}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            )}
                                            {editMode && (
                                                <div className="mt-2">
                                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                                                        <span className="text-xs text-gray-500">Anggaran Rp</span>
                                                        <input
                                                            type="number"
                                                            className="flex-1 bg-transparent outline-none text-sm font-medium text-gray-800"
                                                            placeholder="0"
                                                            value={editBudgets[cat] || ''}
                                                            onChange={e => setEditBudgets({ ...editBudgets, [cat]: e.target.value })}
                                                            min={0}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {!editMode && totalBudget === 0 && (
                    <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <Target size={40} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Belum ada anggaran yang diatur untuk {monthLabel}.</p>
                        {isManager && (
                            <button onClick={openEdit} className="mt-3 text-sm text-purple-600 font-medium hover:underline">
                                Atur Anggaran Sekarang →
                            </button>
                        )}
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
