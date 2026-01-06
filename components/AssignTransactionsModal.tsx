'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import { assignTransactionsToVoyage } from '@/lib/firestore-voyages';
import type { Transaction } from '@/types/transaction';
import { X, Check, Package } from 'lucide-react';
import { formatRupiah } from '@/lib/currency';

interface AssignTransactionsModalProps {
    voyageId: string;
    assignedTransactionIds: string[];
    onSuccess: () => void;
    onCancel: () => void;
}

export default function AssignTransactionsModal({
    voyageId,
    assignedTransactionIds,
    onSuccess,
    onCancel
}: AssignTransactionsModalProps) {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Load transactions
    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToTransactions((data: Transaction[]) => {
            // Filter out transactions that are not cancelled
            const activeTransactions = data.filter((t: Transaction) => t.status !== 'dibatalkan');
            setTransactions(activeTransactions);
        }, user.uid);

        return () => unsubscribe();
    }, [user]);

    // Available transactions (not yet assigned to this voyage)
    const availableTransactions = transactions.filter(
        t => !assignedTransactionIds.includes(t.id)
    );

    // Toggle selection
    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    // Select all
    const selectAll = () => {
        setSelectedIds(availableTransactions.map(t => t.id));
    };

    // Clear all
    const clearAll = () => {
        setSelectedIds([]);
    };

    // Handle assign
    const handleAssign = async () => {
        if (selectedIds.length === 0) {
            alert('Pilih minimal 1 transaksi');
            return;
        }

        setLoading(true);
        try {
            await assignTransactionsToVoyage(voyageId, selectedIds);
            alert(`${selectedIds.length} transaksi berhasil di-assign!`);
            onSuccess();
        } catch (error) {
            console.error('Error assigning transactions:', error);
            alert('Gagal assign transaksi');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">Assign Transaksi ke Pemberangkatan</h2>
                        <p className="text-sm text-blue-100 mt-1">
                            Pilih transaksi yang akan masuk ke pemberangkatan ini
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Summary */}
                <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-600">
                                {selectedIds.length} transaksi dipilih dari {availableTransactions.length} tersedia
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={selectAll}
                                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                            >
                                Pilih Semua
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                onClick={clearAll}
                                className="text-sm text-gray-600 hover:text-gray-700 font-semibold"
                            >
                                Bersihkan
                            </button>
                        </div>
                    </div>
                </div>

                {/* Transaction List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {availableTransactions.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="mx-auto text-gray-300 mb-4" size={48} />
                            <p className="text-gray-600">Semua transaksi sudah di-assign</p>
                            <p className="text-sm text-gray-400 mt-2">Tidak ada transaksi tersedia untuk di-assign</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {availableTransactions.map(tx => (
                                <div
                                    key={tx.id}
                                    onClick={() => toggleSelect(tx.id)}
                                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedIds.includes(tx.id)
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Checkbox */}
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.includes(tx.id)
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'border-gray-300'
                                            }`}>
                                            {selectedIds.includes(tx.id) && (
                                                <Check className="text-white" size={16} />
                                            )}
                                        </div>

                                        {/* Transaction Info */}
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-bold text-gray-800">{tx.noSTT}</p>
                                                    <p className="text-sm text-gray-600">
                                                        {tx.pengirimName} → {tx.penerimaName}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-blue-600">{formatRupiah(tx.jumlah)}</p>
                                                    <p className="text-xs text-gray-500">{tx.noInvoice}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 text-xs text-gray-500">
                                                <span>📍 {tx.tujuan}</span>
                                                <span>📦 {tx.koli} koli</span>
                                                <span>⚖️ {tx.berat} {tx.beratUnit}</span>
                                                <span>📅 {new Date(tx.tanggal).toLocaleDateString('id-ID')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 bg-white text-gray-700 px-6 py-3 rounded-xl font-semibold border-2 border-gray-200 hover:bg-gray-50 transition-all"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleAssign}
                            disabled={loading || selectedIds.length === 0}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Menyimpan...
                                </span>
                            ) : (
                                `Assign ${selectedIds.length} Transaksi`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
