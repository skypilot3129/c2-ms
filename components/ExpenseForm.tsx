'use client';

import { useState, useEffect } from 'react';
import { addExpense, updateExpense } from '@/lib/firestore-expenses';
import type { ExpenseFormData, ExpenseCategory, Expense } from '@/types/voyage';
import { X, Save } from 'lucide-react';

interface ExpenseFormProps {
    voyageId: string;
    userId: string;
    expenseToEdit?: Expense; // If provided, we are in edit mode
    onSuccess: () => void;
    onCancel: () => void;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
    'tiket',
    'operasional_surabaya',
    'operasional_makassar',
    'transit',
    'sewa_mobil',
    'gaji_sopir',
    'lainnya',
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
    tiket: 'Tiket',
    operasional_surabaya: 'Operasional Surabaya',
    operasional_makassar: 'Operasional Makassar',
    transit: 'Transit',
    sewa_mobil: 'Sewa Mobil',
    gaji_sopir: 'Gaji Sopir',
    lainnya: 'Lainnya',
};

export default function ExpenseForm({ voyageId, userId, expenseToEdit, onSuccess, onCancel }: ExpenseFormProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<ExpenseFormData>({
        voyageId,
        category: 'tiket',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        if (expenseToEdit) {
            setFormData({
                voyageId: expenseToEdit.voyageId,
                category: expenseToEdit.category,
                amount: expenseToEdit.amount,
                description: expenseToEdit.description,
                date: new Date(expenseToEdit.date).toISOString().split('T')[0], // Helper to format YYYY-MM-DD? safely
                // Or safely: expenseToEdit.date is Date object? types say Date. 
            });
        }
    }, [expenseToEdit]);

    const handleChange = (field: keyof ExpenseFormData, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.amount <= 0) {
            alert('Jumlah harus lebih dari 0');
            return;
        }

        if (!formData.description.trim()) {
            alert('Deskripsi harus diisi');
            return;
        }

        setLoading(true);
        try {
            if (expenseToEdit) {
                await updateExpense(expenseToEdit.id, formData);
                alert('Pengeluaran berhasil diperbarui!');
            } else {
                await addExpense(formData, userId);
                alert('Pengeluaran berhasil ditambahkan!');
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving expense:', error);
            alert('Gagal menyimpan pengeluaran');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
                    <h2 className="text-xl font-bold">{expenseToEdit ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</h2>
                    <button
                        onClick={onCancel}
                        className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                    {/* Category */}
                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2">
                            Kategori <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.category}
                            onChange={(e) => handleChange('category', e.target.value as ExpenseCategory)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                        >
                            {EXPENSE_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>
                                    {CATEGORY_LABELS[cat]}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Amount */}
                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2">
                            Jumlah <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                            <input
                                type="number"
                                value={formData.amount || ''}
                                onChange={(e) => handleChange('amount', parseInt(e.target.value) || 0)}
                                placeholder="0"
                                required
                                min="0"
                                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2">
                            Deskripsi <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Jelaskan detail pengeluaran..."
                            required
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Date */}
                    <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">
                            Tanggal <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => handleChange('date', e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Simpan
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
