'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToExpenses, addExpense, deleteExpense, updateExpense } from '@/lib/firestore-expenses';
import type { Expense, ExpenseCategory } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';
import { formatRupiah } from '@/lib/currency';
import { Plus, Trash2, Edit2, Wallet, Calendar, X, Save } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function GeneralExpensesPage() {
    const { user } = useAuth();
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

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToExpenses(user.uid, (data) => {
            // Filter only 'general' expenses
            setExpenses(data.filter(e => e.type === 'general' || !e.type));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleSave = async () => {
        if (!user) return;

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
        setFormData({
            category: 'lainnya',
            description: '',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
        });
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

    if (loading) return <div className="p-8 text-center text-gray-500">Memuat data...</div>;

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Pengeluaran Umum</h1>
                        <p className="text-gray-500">Biaya operasional kantor dan umum (Non-Pemberangkatan)</p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-red-600/20 transition-all hover:scale-105"
                    >
                        <Plus size={20} />
                        Catat Pengeluaran
                    </button>
                </div>

                {/* Summary Card */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between max-w-sm">
                    <div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Total Pengeluaran Umum</p>
                        <h2 className="text-3xl font-bold text-red-600">{formatRupiah(totalExpenses)}</h2>
                    </div>
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                        <Wallet size={24} />
                    </div>
                </div>

                {/* List */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">Tanggal</th>
                                <th className="px-6 py-4">Kategori</th>
                                <th className="px-6 py-4">Keterangan</th>
                                <th className="px-6 py-4 text-right">Jumlah</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {expenses.map((e) => (
                                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-gray-600">
                                        {new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-medium border border-gray-200">
                                            {EXPENSE_CATEGORY_LABELS[e.category] || e.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-800 font-medium">{e.description}</td>
                                    <td className="px-6 py-4 text-right font-bold text-red-600">{formatRupiah(e.amount)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEdit(e)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(e.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {expenses.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-400">Belum ada data pengeluaran umum.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in-up">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800">
                                {editingId ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                                <select
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                                >
                                    <option value="gaji_karyawan">{EXPENSE_CATEGORY_LABELS.gaji_karyawan}</option>
                                    <option value="listrik_air_internet">{EXPENSE_CATEGORY_LABELS.listrik_air_internet}</option>
                                    <option value="sewa_kantor">{EXPENSE_CATEGORY_LABELS.sewa_kantor}</option>
                                    <option value="lainnya">{EXPENSE_CATEGORY_LABELS.lainnya}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Bayar Listrik Bulan Januari"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp)</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2"
                            >
                                <Save size={18} />
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ProtectedRoute>
    );
}
