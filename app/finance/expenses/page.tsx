'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    subscribeToExpenses, addExpense, deleteExpense, updateExpense,
    addTopUp, subscribeToTopUps, deleteTopUp,
    approveExpense, rejectExpense,
} from '@/lib/firestore-expenses';
import type { Expense, ExpenseCategory, PettyCashTopUp } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_GROUPS } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';
import {
    Plus, Trash2, Edit2, Wallet, X, Save, Printer,
    Banknote, TrendingDown, ArrowDownRight, CalendarDays,
    ArrowUpRight, CheckCircle2, XCircle, Clock, BarChart3,
    Target, ChevronDown, ChevronUp, Image as ImageIcon,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

// ─────────────────────────────────────
type FilterMode = 'month' | 'date' | 'range';

type LedgerEntry =
    | (Expense & { entryType: 'expense' })
    | (PettyCashTopUp & { entryType: 'topup' });

const STATUS_CONFIG = {
    draft:    { label: 'Draft',     color: 'bg-gray-100 text-gray-600',   icon: <Clock size={12} /> },
    pending:  { label: 'Pending',   color: 'bg-yellow-100 text-yellow-700', icon: <Clock size={12} /> },
    approved: { label: 'Disetujui',  color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 size={12} /> },
    rejected: { label: 'Ditolak',    color: 'bg-red-100 text-red-700',     icon: <XCircle size={12} /> },
};

export default function GeneralExpensesPage() {
    const { user, role } = useAuth();
    const router = useRouter();
    const isManager = ['admin', 'pengurus'].includes(role);

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [topups, setTopups] = useState<PettyCashTopUp[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Add/Edit Expense Modal ──
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
    const [expenseForm, setExpenseForm] = useState({
        category: 'bbm_solar' as ExpenseCategory,
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        receiptFile: null as File | null,
    });
    const [groupOpen, setGroupOpen] = useState(0); // which category group is open

    // ── Add Top-Up Modal ──
    const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
    const [topupForm, setTopupForm] = useState({ amount: 0, description: '', date: new Date().toISOString().split('T')[0] });

    // ── Reject Modal ──
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // ── Petty Cash Balance (localStorage) ──
    const [modalAwal, setModalAwal] = useState(0);
    const [isSettingModal, setIsSettingModal] = useState(false);
    const [tempModalAwal, setTempModalAwal] = useState(0);

    // ── Filter ──
    const [filterMode, setFilterMode] = useState<FilterMode>('month');
    const [filterMonth, setFilterMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [filterStart, setFilterStart] = useState(() => new Date().toISOString().split('T')[0]);
    const [filterEnd, setFilterEnd] = useState(() => new Date().toISOString().split('T')[0]);

    // ── Load modal awal ──
    useEffect(() => {
        const saved = localStorage.getItem('cce_petty_cash_balance');
        if (saved) setModalAwal(Number(saved));
    }, []);

    // ── Subscribe ──
    useEffect(() => {
        if (!user) return;
        const unsub1 = subscribeToExpenses(user.uid, (data) => {
            setExpenses(data.filter(e => e.type === 'general' || !e.type));
            setLoading(false);
        });
        const unsub2 = subscribeToTopUps(user.uid, setTopups);
        return () => { unsub1(); unsub2(); };
    }, [user]);

    // ── Filter logic ──

    const inRange = (date: Date) => {
        const ds = date.toISOString().split('T')[0];
        if (filterMode === 'month') {
            const [y, m] = filterMonth.split('-').map(Number);
            return date.getFullYear() === y && date.getMonth() + 1 === m;
        } else if (filterMode === 'date') {
            return ds === filterDate;
        } else {
            return ds >= filterStart && ds <= filterEnd;
        }
    };

    const filteredExpenses = useMemo(() =>
        expenses.filter(e => inRange(new Date(e.date)))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        [expenses, filterMode, filterMonth, filterDate, filterStart, filterEnd]
    );

    const filteredTopups = useMemo(() =>
        topups.filter(t => inRange(new Date(t.date))),
        [topups, filterMode, filterMonth, filterDate, filterStart, filterEnd]
    );

    // ── Merged ledger sorted by date then input time ──
    const ledger: LedgerEntry[] = useMemo(() => {
        const exp = filteredExpenses.map(e => ({ ...e, entryType: 'expense' as const }));
        const top = filteredTopups.map(t => ({ ...t, entryType: 'topup' as const }));
        return [...exp, ...top].sort((a, b) => {
            const timeA = new Date(a.createdAt || a.date).getTime();
            const timeB = new Date(b.createdAt || b.date).getTime();
            if (a.date !== b.date) {
                return new Date(a.date).getTime() - new Date(b.date).getTime();
            }
            return timeA - timeB;
        });
    }, [filteredExpenses, filteredTopups]);

    // ── Calculations ──
    const totalExpenses = filteredExpenses
        .filter(e => e.status === 'approved' || e.status === 'draft' || !e.status)
        .reduce((s, e) => s + e.amount, 0);
    const totalTopUps = filteredTopups.reduce((s, t) => s + t.amount, 0);
    const pendingCount = filteredExpenses.filter(e => e.status === 'pending').length;

    // ── Starting balance = modal awal + topups - expenses (from start of the month to before the selected period) ──
    const balanceBeforePeriod = useMemo(() => {
        if (filterMode === 'month') return modalAwal;

        // Start from the 1st of the month of the selected filter
        const startOfMonth = filterMode === 'date' ? filterDate.substring(0, 8) + '01' : filterStart.substring(0, 8) + '01';
        const endDate = filterMode === 'date' ? filterDate : filterStart;

        const isBeforePeriodInMonth = (dateObj: Date | string) => {
            const dateStr = typeof dateObj === 'string' ? dateObj : dateObj.toISOString().split('T')[0];
            const ds = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
            return ds >= startOfMonth && ds < endDate;
        };

        const prevTopups = topups.filter(t => isBeforePeriodInMonth(t.date));
        const prevExpenses = expenses.filter(e =>
            isBeforePeriodInMonth(e.date) &&
            (e.type === 'general' || !e.type) &&
            (e.status === 'approved' || e.status === 'draft' || !e.status)
        );

        const topupSum = prevTopups.reduce((s, t) => s + t.amount, 0);
        const expenseSum = prevExpenses.reduce((s, e) => s + e.amount, 0);
        
        return modalAwal + topupSum - expenseSum;
    }, [topups, expenses, filterMode, filterDate, filterStart, modalAwal]);

    // Running balance for each ledger row (starts from balance before the period)
    const ledgerWithBalance = useMemo(() => {
        let running = balanceBeforePeriod;
        return ledger.map(entry => {
            if (entry.entryType === 'topup') {
                running += entry.amount;
            } else {
                const e = entry as Expense;
                // Only approved or draft expenses deduct from balance
                if (e.status === 'approved' || e.status === 'draft' || !e.status) {
                    running -= entry.amount;
                }
            }
            return { ...entry, runningBalance: running };
        });
    }, [ledger, balanceBeforePeriod]);

    // Final saldo = balance before period + topups in period - expenses in period
    const saldoAkhir = balanceBeforePeriod + totalTopUps - totalExpenses;

    // ── Period label ──
    const periodLabel = useMemo(() => {
        if (filterMode === 'month') {
            const [y, m] = filterMonth.split('-');
            return new Date(Number(y), Number(m) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        } else if (filterMode === 'date') {
            return new Date(filterDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else {
            const s = new Date(filterStart + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            const e = new Date(filterEnd + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            return `${s} – ${e}`;
        }
    }, [filterMode, filterMonth, filterDate, filterStart, filterEnd]);

    // ── Handlers ──
    const handleSaveExpense = async () => {
        if (!user || !expenseForm.description.trim() || expenseForm.amount <= 0) return;
        try {
            const statusToUse = isManager ? 'approved' : 'pending';
            if (editingExpenseId) {
                await updateExpense(editingExpenseId, {
                    category: expenseForm.category,
                    description: expenseForm.description,
                    amount: expenseForm.amount,
                    date: expenseForm.date,
                });
            } else {
                await addExpense({
                    type: 'general',
                    category: expenseForm.category,
                    description: expenseForm.description,
                    amount: expenseForm.amount,
                    date: expenseForm.date,
                    status: statusToUse,
                }, user.uid);
            }
            setIsExpenseModalOpen(false);
            resetExpenseForm();
        } catch { alert('Gagal menyimpan pengeluaran'); }
    };

    const handleSaveTopUp = async () => {
        if (!user || topupForm.amount <= 0 || !topupForm.description.trim()) return;
        try {
            await addTopUp(topupForm, user.uid, user.email || user.uid);
            setIsTopupModalOpen(false);
            setTopupForm({ amount: 0, description: '', date: new Date().toISOString().split('T')[0] });
        } catch { alert('Gagal menyimpan pemasukan'); }
    };

    const handleApprove = async (id: string) => {
        if (!user) return;
        await approveExpense(id, user.uid);
    };

    const handleReject = async () => {
        if (!user || !rejectTarget || !rejectReason.trim()) return;
        await rejectExpense(rejectTarget, user.uid, rejectReason);
        setRejectTarget(null);
        setRejectReason('');
    };

    const handleDelete = async (id: string) => {
        if (confirm('Hapus pengeluaran ini?')) await deleteExpense(id);
    };

    const handleDeleteTopUp = async (id: string) => {
        if (confirm('Hapus pemasukan ini?')) await deleteTopUp(id);
    };

    const resetExpenseForm = () => {
        setExpenseForm({ category: 'bbm_solar', description: '', amount: 0, date: new Date().toISOString().split('T')[0], receiptFile: null });
        setEditingExpenseId(null);
        setGroupOpen(0);
    };

    const openEditExpense = (e: Expense) => {
        setExpenseForm({ category: e.category, description: e.description, amount: e.amount, date: new Date(e.date).toISOString().split('T')[0], receiptFile: null });
        setEditingExpenseId(e.id);
        setIsExpenseModalOpen(true);
    };

    const saveModalAwal = () => {
        setModalAwal(tempModalAwal);
        localStorage.setItem('cce_petty_cash_balance', String(tempModalAwal));
        setIsSettingModal(false);
    };

    const handlePrint = () => {
        const approvedLedger = ledgerWithBalance.filter(e => e.entryType === 'topup' || (e as Expense).status !== 'rejected');
        const dataStr = encodeURIComponent(JSON.stringify(approvedLedger));
        const labelStr = encodeURIComponent(periodLabel);
        router.push(`/finance/expenses/print?data=${dataStr}&label=${labelStr}&modal=${balanceBeforePeriod}&expenses=${totalExpenses}&topups=${totalTopUps}&saldo=${saldoAkhir}`);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data...</div>;

    return (
        <ProtectedRoute>
            <div className="space-y-4">
                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Kas Kecil & Pengeluaran</h1>
                        <p className="text-gray-500 text-xs sm:text-sm">Pencatatan pengeluaran operasional harian</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => router.push('/finance/expenses/analytics')} className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-xl text-sm font-medium shadow-sm transition-all">
                            <BarChart3 size={15} /> Analitik
                        </button>
                        <button onClick={() => router.push('/finance/expenses/budget')} className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-xl text-sm font-medium shadow-sm transition-all">
                            <Target size={15} /> Anggaran
                        </button>
                        <button onClick={handlePrint} disabled={ledger.length === 0} className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-xl text-sm font-medium shadow-sm transition-all disabled:opacity-40">
                            <Printer size={15} /> Cetak
                        </button>
                        <button onClick={() => { setIsTopupModalOpen(true); }} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm transition-all">
                            <ArrowUpRight size={15} /> Pemasukan
                        </button>
                        <button onClick={() => { resetExpenseForm(); setIsExpenseModalOpen(true); }} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-600/20 transition-all">
                            <Plus size={15} /> Pengeluaran
                        </button>
                    </div>
                </div>

                {/* ── Filter Row ── */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                        {(['month', 'date', 'range'] as FilterMode[]).map(mode => (
                            <button key={mode} onClick={() => setFilterMode(mode)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterMode === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                {mode === 'month' ? 'Bulanan' : mode === 'date' ? 'Harian' : 'Rentang'}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {filterMode === 'month' && (
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                                <CalendarDays size={16} className="text-blue-500" />
                                <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border-none outline-none text-sm font-medium bg-transparent" />
                            </div>
                        )}
                        {filterMode === 'date' && (
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                                <CalendarDays size={16} className="text-blue-500" />
                                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border-none outline-none text-sm font-medium bg-transparent" />
                            </div>
                        )}
                        {filterMode === 'range' && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                                    <span className="text-xs text-gray-400 font-medium">Dari</span>
                                    <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="border-none outline-none text-sm font-medium bg-transparent" />
                                </div>
                                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                                    <span className="text-xs text-gray-400 font-medium">Sampai</span>
                                    <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="border-none outline-none text-sm font-medium bg-transparent" />
                                </div>
                            </div>
                        )}
                        <button onClick={() => { setTempModalAwal(modalAwal); setIsSettingModal(true); }}
                            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                            <Banknote size={16} className="text-emerald-500" /> Modal Awal
                        </button>
                    </div>
                </div>

                {/* ── Summary Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-emerald-500/20 col-span-1">
                        <p className="text-emerald-100 text-[10px] font-medium mb-1">Modal Awal</p>
                        <p className="text-lg font-bold">{formatRupiah(modalAwal)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg shadow-teal-500/20 col-span-1">
                        <p className="text-teal-100 text-[10px] font-medium mb-1">Pemasukan</p>
                        <p className="text-lg font-bold">{formatRupiah(totalTopUps)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-lg shadow-red-500/20 col-span-1">
                        <p className="text-red-100 text-[10px] font-medium mb-1">Pengeluaran</p>
                        <p className="text-lg font-bold">{formatRupiah(totalExpenses)}</p>
                    </div>
                    <div className={`bg-gradient-to-br rounded-xl p-4 text-white shadow-lg col-span-1 ${saldoAkhir >= 0 ? 'from-blue-500 to-blue-600 shadow-blue-500/20' : 'from-orange-500 to-orange-600 shadow-orange-500/20'}`}>
                        <p className="text-blue-100 text-[10px] font-medium mb-1">Sisa Saldo</p>
                        <p className="text-lg font-bold">{formatRupiah(saldoAkhir)}</p>
                    </div>
                </div>

                {/* Pending approval badge */}
                {isManager && pendingCount > 0 && (
                    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-yellow-800 text-sm font-medium">
                        <Clock size={16} className="text-yellow-500" />
                        <span>{pendingCount} pengeluaran menunggu persetujuan Anda</span>
                    </div>
                )}

                {/* ── Ledger Table ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <ArrowDownRight size={16} className="text-red-500" />
                            Buku Kas – {periodLabel}
                        </h3>
                        <span className="text-xs text-gray-400 font-medium">{ledger.length} entri</span>
                    </div>

                    {ledger.length === 0 ? (
                        <div className="text-center py-12 px-4 text-gray-400">
                            <Wallet size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Belum ada transaksi di periode ini.</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                                        <tr>
                                            <th className="px-4 py-3 text-left">No</th>
                                            <th className="px-4 py-3 text-left">Tanggal</th>
                                            <th className="px-4 py-3 text-left">Keterangan</th>
                                            <th className="px-4 py-3 text-left">Kategori</th>
                                            <th className="px-4 py-3 text-right text-emerald-600">Masuk</th>
                                            <th className="px-4 py-3 text-right text-red-600">Keluar</th>
                                            <th className="px-4 py-3 text-right">Saldo</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {/* Starting balance row */}
                                        <tr className="bg-emerald-50">
                                            <td colSpan={4} className="px-4 py-2 text-xs text-emerald-700 font-bold">Saldo Awal Kas Kecil</td>
                                            <td className="px-4 py-2 text-right text-xs text-emerald-700 font-bold">{formatRupiah(modalAwal)}</td>
                                            <td></td>
                                            <td className="px-4 py-2 text-right text-xs text-emerald-700 font-bold">{formatRupiah(modalAwal)}</td>
                                            <td></td>
                                            <td></td>
                                        </tr>
                                        {ledgerWithBalance.map((entry, idx) => {
                                            const isTopup = entry.entryType === 'topup';
                                            const expense = !isTopup ? entry as Expense & { runningBalance: number } : null;
                                            const topup = isTopup ? entry as PettyCashTopUp & { runningBalance: number } : null;
                                            const isRejected = expense?.status === 'rejected';
                                            return (
                                                <tr key={entry.id} className={`hover:bg-gray-50 transition-colors ${isRejected ? 'opacity-50 line-through' : ''}`}>
                                                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                                                        {new Date(entry.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-800 font-medium max-w-xs truncate">{entry.description}</td>
                                                    <td className="px-4 py-3">
                                                        {isTopup ? (
                                                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-medium">Top-Up Kas</span>
                                                        ) : (
                                                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium border border-gray-200">
                                                                {EXPENSE_CATEGORY_LABELS[(entry as Expense).category] || (entry as Expense).category}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 text-sm">
                                                        {isTopup ? formatRupiah(topup!.amount) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-red-600 text-sm">
                                                        {!isTopup ? formatRupiah(expense!.amount) : '—'}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-semibold text-sm ${(entry as any).runningBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                                        {formatRupiah((entry as any).runningBalance)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {isTopup ? null : (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[expense!.status || 'approved'].color}`}>
                                                                {STATUS_CONFIG[expense!.status || 'approved'].icon}
                                                                {STATUS_CONFIG[expense!.status || 'approved'].label}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {isTopup ? (
                                                                isManager && <button onClick={() => handleDeleteTopUp(topup!.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                                            ) : (
                                                                <>
                                                                    {isManager && expense!.status === 'pending' && (
                                                                        <>
                                                                            <button onClick={() => handleApprove(expense!.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Setujui"><CheckCircle2 size={14} /></button>
                                                                            <button onClick={() => { setRejectTarget(expense!.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Tolak"><XCircle size={14} /></button>
                                                                        </>
                                                                    )}
                                                                    <button onClick={() => openEditExpense(entry as Expense)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                                                                    {isManager && <button onClick={() => handleDelete(expense!.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 font-bold border-t-2 border-gray-200 text-sm">
                                            <td colSpan={4} className="px-4 py-3 text-right text-gray-700">TOTAL:</td>
                                            <td className="px-4 py-3 text-right text-emerald-600">{formatRupiah(totalTopUps)}</td>
                                            <td className="px-4 py-3 text-right text-red-600">{formatRupiah(totalExpenses)}</td>
                                            <td className={`px-4 py-3 text-right ${saldoAkhir >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatRupiah(saldoAkhir)}</td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-gray-100">
                                {ledgerWithBalance.map((entry, idx) => {
                                    const isTopup = entry.entryType === 'topup';
                                    const expense = !isTopup ? entry as Expense & { runningBalance: number } : null;
                                    const topup = isTopup ? entry as PettyCashTopUp & { runningBalance: number } : null;
                                    return (
                                        <div key={entry.id} className={`px-4 py-3 flex flex-col gap-2 ${expense?.status === 'rejected' ? 'opacity-50' : ''}`}>
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0">
                                                    {isTopup ? (
                                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 mb-1">Top-Up Kas</span>
                                                    ) : (
                                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 mb-1">
                                                            {EXPENSE_CATEGORY_LABELS[(entry as Expense).category]}
                                                        </span>
                                                    )}
                                                    <p className="font-medium text-gray-800 text-sm truncate">{entry.description}</p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(entry.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                </div>
                                                <div className="text-right shrink-0 ml-3">
                                                    <p className={`font-bold text-base ${isTopup ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {isTopup ? '+' : '-'}{formatRupiah(entry.amount)}
                                                    </p>
                                                    <p className={`text-[11px] font-semibold mt-0.5 ${(entry as any).runningBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                                        Saldo: {formatRupiah((entry as any).runningBalance)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-1.5 border-t border-dashed border-gray-100">
                                                {!isTopup && expense?.status && (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_CONFIG[expense.status].color}`}>
                                                        {STATUS_CONFIG[expense.status].icon}
                                                        {STATUS_CONFIG[expense.status].label}
                                                    </span>
                                                )}
                                                <div className="flex ml-auto gap-2">
                                                    {isTopup ? (
                                                        isManager && <button onClick={() => handleDeleteTopUp(topup!.id)} className="text-xs text-red-600 flex items-center gap-1 py-1 px-2 rounded hover:bg-red-50"><Trash2 size={12} /></button>
                                                    ) : (
                                                        <>
                                                            {isManager && expense!.status === 'pending' && (
                                                                <>
                                                                    <button onClick={() => handleApprove(expense!.id)} className="text-xs text-emerald-600 flex items-center gap-1 py-1 px-2 rounded hover:bg-emerald-50"><CheckCircle2 size={12} /> Setujui</button>
                                                                    <button onClick={() => setRejectTarget(expense!.id)} className="text-xs text-red-600 flex items-center gap-1 py-1 px-2 rounded hover:bg-red-50"><XCircle size={12} /> Tolak</button>
                                                                </>
                                                            )}
                                                            <button onClick={() => openEditExpense(entry as Expense)} className="text-xs font-medium text-blue-600 flex items-center gap-1 py-1 px-2 rounded hover:bg-blue-50"><Edit2 size={12} /> Edit</button>
                                                            {isManager && <button onClick={() => handleDelete(expense!.id)} className="text-xs font-medium text-red-600 flex items-center gap-1 py-1 px-2 rounded hover:bg-red-50"><Trash2 size={12} /></button>}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="px-4 py-3 bg-gray-50 border-t-2 border-gray-200 space-y-1">
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-gray-700">Total Pemasukan</span>
                                        <span className="text-emerald-600">{formatRupiah(totalTopUps)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-gray-700">Total Pengeluaran</span>
                                        <span className="text-red-600">{formatRupiah(totalExpenses)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-gray-700">Sisa Saldo</span>
                                        <span className={saldoAkhir >= 0 ? 'text-blue-600' : 'text-orange-600'}>{formatRupiah(saldoAkhir)}</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Add/Edit Expense Modal ── */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-10 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-auto">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">{editingExpenseId ? 'Edit Pengeluaran' : 'Catat Pengeluaran'}</h3>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                                <input type="date" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                            </div>
                            {/* Category selector with groups */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                                <div className="space-y-2 max-h-56 overflow-y-auto border border-gray-200 rounded-xl p-2">
                                    {EXPENSE_CATEGORY_GROUPS.map((grp, gi) => (
                                        <div key={grp.label}>
                                            <button onClick={() => setGroupOpen(groupOpen === gi ? -1 : gi)}
                                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-600 transition-colors">
                                                {grp.label}
                                                {groupOpen === gi ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                            {groupOpen === gi && (
                                                <div className="grid grid-cols-2 gap-1 mt-1 px-1">
                                                    {grp.categories.map(cat => (
                                                        <button key={cat} onClick={() => setExpenseForm({ ...expenseForm, category: cat })}
                                                            className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${expenseForm.category === cat ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-blue-50'}`}>
                                                            {EXPENSE_CATEGORY_LABELS[cat]}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-blue-600 font-medium mt-1.5">Terpilih: {EXPENSE_CATEGORY_LABELS[expenseForm.category]}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                                <input type="text" placeholder="Beli solar, servis rutin, dll." className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp)</label>
                                <input type="number" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-lg font-semibold" value={expenseForm.amount || ''} onChange={e => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} min={0} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><ImageIcon size={14} /> Bukti / Struk (opsional)</label>
                                <input type="file" accept="image/*" className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium" onChange={e => setExpenseForm({ ...expenseForm, receiptFile: e.target.files?.[0] || null })} />
                                {expenseForm.receiptFile && <p className="text-xs text-green-600 mt-1">📎 {expenseForm.receiptFile.name}</p>}
                            </div>
                            {!isManager && (
                                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                                    <Clock size={15} className="text-yellow-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-yellow-700">Pengeluaran akan membutuhkan persetujuan pengurus sebelum masuk ke laporan.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">Batal</button>
                            <button onClick={handleSaveExpense} disabled={!expenseForm.description.trim() || expenseForm.amount <= 0} className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50">
                                <Save size={16} /> Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Top-Up Modal ── */}
            {isTopupModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Tambah Pemasukan Kas</h3>
                            <button onClick={() => setIsTopupModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                                <input type="date" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" value={topupForm.date} onChange={e => setTopupForm({ ...topupForm, date: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                                <input type="text" placeholder="Top-up kas dari owner, dll." className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" value={topupForm.description} onChange={e => setTopupForm({ ...topupForm, description: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp)</label>
                                <input type="number" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 text-xl font-bold text-emerald-700" value={topupForm.amount || ''} onChange={e => setTopupForm({ ...topupForm, amount: Number(e.target.value) })} min={0} />
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setIsTopupModalOpen(false)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">Batal</button>
                            <button onClick={handleSaveTopUp} disabled={topupForm.amount <= 0 || !topupForm.description.trim()} className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50">
                                <Save size={16} /> Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reject Modal ── */}
            {rejectTarget && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800">Tolak Pengeluaran</h3>
                        </div>
                        <div className="p-5">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Penolakan</label>
                            <textarea className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 resize-none" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Masukkan alasan..." />
                        </div>
                        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">Batal</button>
                            <button onClick={handleReject} disabled={!rejectReason.trim()} className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50">
                                <XCircle size={16} /> Tolak
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Awal Setting ── */}
            {isSettingModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Modal Awal Kas Kecil</h3>
                            <button onClick={() => setIsSettingModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-sm text-gray-600">Saldo awal kas kecil yang menjadi acuan perhitungan.</p>
                            <input type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 text-xl font-bold text-emerald-700" value={tempModalAwal || ''} onChange={e => setTempModalAwal(Number(e.target.value))} min={0} />
                        </div>
                        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setIsSettingModal(false)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">Batal</button>
                            <button onClick={saveModalAwal} className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-medium flex items-center gap-2">
                                <Save size={16} /> Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ProtectedRoute>
    );
}
