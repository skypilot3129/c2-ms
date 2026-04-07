'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToExpenses, addExpense, deleteExpense, updateExpense } from '@/lib/firestore-expenses';
import type { Expense, ExpenseCategory } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';
import { Plus, Trash2, Edit2, Wallet, X, Save, Printer, ChevronDown, ChevronUp, Banknote, TrendingDown, ArrowDownRight, CalendarDays, Filter } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

// ── Categories relevant for general/operational expenses ───────────
const GENERAL_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
    { value: 'operasional_surabaya', label: 'Operasional Surabaya' },
    { value: 'operasional_makassar', label: 'Operasional Makassar' },
    { value: 'gaji_karyawan', label: 'Gaji Karyawan' },
    { value: 'listrik_air_internet', label: 'Listrik / Air / Internet' },
    { value: 'sewa_kantor', label: 'Sewa Kantor / Gudang' },
    { value: 'maintenance', label: 'Maintenance Armada' },
    { value: 'sewa_mobil', label: 'Sewa Mobil' },
    { value: 'transit', label: 'Transit' },
    { value: 'lainnya', label: 'Lainnya' },
];

export default function GeneralExpensesPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        category: 'lainnya' as ExpenseCategory,
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
    });

    // Petty Cash Balance
    const [modalAwal, setModalAwal] = useState<number>(0);
    const [isSettingModal, setIsSettingModal] = useState(false);
    const [tempModalAwal, setTempModalAwal] = useState<number>(0);

    // Filter State
    const [filterMonth, setFilterMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [showFilter, setShowFilter] = useState(false);

    // Load modal awal from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('cce_petty_cash_balance');
        if (saved) setModalAwal(Number(saved));
    }, []);

    // Subscribe to expenses
    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToExpenses(user.uid, (data) => {
            setExpenses(data.filter(e => e.type === 'general' || !e.type));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // ── Filtered & Sorted Data ──
    const filteredExpenses = useMemo(() => {
        const [year, month] = filterMonth.split('-').map(Number);
        return expenses
            .filter(e => {
                const d = new Date(e.date);
                return d.getFullYear() === year && d.getMonth() + 1 === month;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // oldest first for running balance
    }, [expenses, filterMonth]);

    // ── Calculations ──
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const saldoAkhir = modalAwal - totalExpenses;

    // Running balance per row
    const expensesWithBalance = useMemo(() => {
        let running = modalAwal;
        return filteredExpenses.map(e => {
            running -= e.amount;
            return { ...e, runningBalance: running };
        });
    }, [filteredExpenses, modalAwal]);

    // Group by date for display
    const groupedByDate = useMemo(() => {
        const groups: Record<string, (Expense & { runningBalance: number })[]> = {};
        expensesWithBalance.forEach(e => {
            const key = new Date(e.date).toISOString().split('T')[0];
            if (!groups[key]) groups[key] = [];
            groups[key].push(e);
        });
        return groups;
    }, [expensesWithBalance]);

    const sortedDates = Object.keys(groupedByDate).sort();

    // ── Handlers ──
    const handleSave = async () => {
        if (!user || !formData.description.trim() || formData.amount <= 0) return;
        try {
            if (editingId) {
                await updateExpense(editingId, {
                    category: formData.category,
                    description: formData.description,
                    amount: formData.amount,
                    date: formData.date
                });
            } else {
                await addExpense({
                    type: 'general',
                    category: formData.category,
                    description: formData.description,
                    amount: formData.amount,
                    date: formData.date
                }, user.uid);
            }
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error saving expense:', error);
            alert('Gagal menyimpan pengeluaran');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Hapus pengeluaran ini?')) {
            await deleteExpense(id);
        }
    };

    const resetForm = () => {
        setFormData({ category: 'lainnya', description: '', amount: 0, date: new Date().toISOString().split('T')[0] });
        setEditingId(null);
    };

    const openEdit = (e: Expense) => {
        setFormData({
            category: e.category,
            description: e.description,
            amount: e.amount,
            date: new Date(e.date).toISOString().split('T')[0],
        });
        setEditingId(e.id);
        setIsModalOpen(true);
    };

    const saveModalAwal = () => {
        setModalAwal(tempModalAwal);
        localStorage.setItem('cce_petty_cash_balance', String(tempModalAwal));
        setIsSettingModal(false);
    };

    const handlePrint = () => {
        const dataStr = encodeURIComponent(JSON.stringify(expensesWithBalance));
        const monthStr = filterMonth;
        const modalStr = String(modalAwal);
        router.push(`/finance/expenses/print?data=${dataStr}&month=${monthStr}&modal=${modalStr}`);
    };

    // ── Month label ──
    const monthLabel = (() => {
        const [y, m] = filterMonth.split('-');
        const d = new Date(Number(y), Number(m) - 1);
        return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    })();

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data...</div>;

    return (
        <ProtectedRoute>
            <div className="space-y-5">
                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Kas Kecil & Pengeluaran</h1>
                        <p className="text-gray-500 text-xs sm:text-sm">Pencatatan pengeluaran operasional harian</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={handlePrint}
                            disabled={filteredExpenses.length === 0}
                            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
                        >
                            <Printer size={16} /> Cetak
                        </button>
                        <button
                            onClick={() => { resetForm(); setIsModalOpen(true); }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                        >
                            <Plus size={16} /> Catat Pengeluaran
                        </button>
                    </div>
                </div>

                {/* ── Filter Row ── */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                        <CalendarDays size={16} className="text-blue-500" />
                        <input
                            type="month"
                            value={filterMonth}
                            onChange={e => setFilterMonth(e.target.value)}
                            className="border-none outline-none text-sm font-medium bg-transparent"
                        />
                    </div>
                    <button
                        onClick={() => { setTempModalAwal(modalAwal); setIsSettingModal(true); }}
                        className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
                    >
                        <Banknote size={16} className="text-emerald-500" />
                        Modal Awal
                    </button>
                </div>

                {/* ── Summary Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-emerald-500/20">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-emerald-100 text-xs font-medium">Modal Awal Kas Kecil</p>
                            <Banknote size={20} className="text-emerald-200" />
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{formatRupiah(modalAwal)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-lg shadow-red-500/20">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-red-100 text-xs font-medium">Total Pengeluaran ({monthLabel})</p>
                            <TrendingDown size={20} className="text-red-200" />
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{formatRupiah(totalExpenses)}</p>
                    </div>
                    <div className={`bg-gradient-to-br rounded-xl p-4 text-white shadow-lg ${saldoAkhir >= 0 ? 'from-blue-500 to-blue-600 shadow-blue-500/20' : 'from-orange-500 to-orange-600 shadow-orange-500/20'}`}>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-blue-100 text-xs font-medium">Sisa Saldo</p>
                            <Wallet size={20} className="text-blue-200" />
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{formatRupiah(saldoAkhir)}</p>
                    </div>
                </div>

                {/* ── Daily Expense List ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <ArrowDownRight size={16} className="text-red-500" />
                            Rincian Pengeluaran – {monthLabel}
                        </h3>
                        <span className="text-xs text-gray-400 font-medium">{filteredExpenses.length} item</span>
                    </div>

                    {filteredExpenses.length === 0 ? (
                        <div className="text-center py-12 px-4 text-gray-400">
                            <Wallet size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Belum ada pengeluaran di bulan ini.</p>
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
                                            <th className="px-4 py-3 text-left">Kategori</th>
                                            <th className="px-4 py-3 text-left">Keterangan</th>
                                            <th className="px-4 py-3 text-right">Jumlah</th>
                                            <th className="px-4 py-3 text-right">Saldo</th>
                                            <th className="px-4 py-3 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {expensesWithBalance.map((e, idx) => (
                                            <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-gray-400 font-medium">{idx + 1}</td>
                                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                                    {new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium border border-gray-200">
                                                        {EXPENSE_CATEGORY_LABELS[e.category] || e.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-800 font-medium max-w-xs truncate" title={e.description}>
                                                    {e.description}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-red-600 whitespace-nowrap">{formatRupiah(e.amount)}</td>
                                                <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${e.runningBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                                    {formatRupiah(e.runningBalance)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => openEdit(e)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={15} /></button>
                                                        <button onClick={() => handleDelete(e.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                                            <td colSpan={4} className="px-4 py-3 text-right text-gray-700">TOTAL PENGELUARAN:</td>
                                            <td className="px-4 py-3 text-right text-red-600">{formatRupiah(totalExpenses)}</td>
                                            <td className={`px-4 py-3 text-right ${saldoAkhir >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatRupiah(saldoAkhir)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Mobile Card View grouped by date */}
                            <div className="md:hidden divide-y divide-gray-100">
                                {sortedDates.map(dateKey => (
                                    <div key={dateKey}>
                                        <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-500 flex items-center gap-1.5 sticky top-0">
                                            <CalendarDays size={12} />
                                            {new Date(dateKey + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                        {groupedByDate[dateKey].map(e => (
                                            <div key={e.id} className="px-4 py-3 flex flex-col gap-2">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 min-w-0">
                                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 mb-1">
                                                            {EXPENSE_CATEGORY_LABELS[e.category] || e.category}
                                                        </span>
                                                        <p className="font-medium text-gray-800 text-sm line-clamp-2">{e.description}</p>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-3">
                                                        <p className="font-bold text-red-600 text-sm">{formatRupiah(e.amount)}</p>
                                                        <p className={`text-[11px] font-semibold mt-0.5 ${e.runningBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                                            Saldo: {formatRupiah(e.runningBalance)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-3 pt-1.5 border-t border-dashed border-gray-100">
                                                    <button onClick={() => openEdit(e)} className="text-xs font-medium text-blue-600 flex items-center gap-1 py-1 px-2 rounded hover:bg-blue-50">
                                                        <Edit2 size={13} /> Edit
                                                    </button>
                                                    <button onClick={() => handleDelete(e.id)} className="text-xs font-medium text-red-600 flex items-center gap-1 py-1 px-2 rounded hover:bg-red-50">
                                                        <Trash2 size={13} /> Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                {/* Mobile Total Footer */}
                                <div className="px-4 py-3 bg-gray-50 border-t-2 border-gray-200">
                                    <div className="flex justify-between font-bold text-sm">
                                        <span className="text-gray-700">Total Pengeluaran</span>
                                        <span className="text-red-600">{formatRupiah(totalExpenses)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-sm mt-1">
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
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">
                                {editingId ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                                <input type="date" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                                <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}>
                                    {GENERAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                                <input type="text" placeholder="Beli solar, bayar listrik, dll." className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp)</label>
                                <input type="number" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 text-lg font-semibold" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} min={0} />
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">Batal</button>
                            <button onClick={handleSave} disabled={!formData.description.trim() || formData.amount <= 0} className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm">
                                <Save size={16} /> Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Awal Setting Modal ── */}
            {isSettingModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">Modal Awal Kas Kecil</h3>
                            <button onClick={() => setIsSettingModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">Masukkan saldo awal kas kecil perusahaan. Saldo ini akan menjadi acuan perhitungan sisa saldo setelah pengeluaran.</p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Awal (Rp)</label>
                                <input type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 text-xl font-bold text-emerald-700" value={tempModalAwal || ''} onChange={e => setTempModalAwal(Number(e.target.value))} min={0} />
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setIsSettingModal(false)} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">Batal</button>
                            <button onClick={saveModalAwal} className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm">
                                <Save size={16} /> Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ProtectedRoute>
    );
}
