'use client';

import { useState } from 'react';
import { X, Printer } from 'lucide-react';
import type { Transaction } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';

interface BulkInvoiceModalProps {
    transactions: Transaction[];
    onClose: () => void;
    onSubmit: (data: BulkInvoiceFormData) => void;
}

export interface BulkInvoiceFormData {
    kepadaYth: string;
    nama: string;
    kota: string;
    noNPWP: string;
    keteranganKeberangkatan: string; // General departure notes for all STTs
    keteranganPerSTT: { [sttId: string]: string }; // Map of transaction ID to keterangan
    includePPN: boolean;
}

export default function BulkInvoiceModal({ transactions, onClose, onSubmit }: BulkInvoiceModalProps) {
    const [formData, setFormData] = useState<BulkInvoiceFormData>({
        kepadaYth: transactions[0]?.pengirimName || '',
        nama: transactions[0]?.pengirimName || '',
        kota: transactions[0]?.pengirimCity || '',
        noNPWP: '',
        keteranganKeberangkatan: '',
        keteranganPerSTT: {},
        includePPN: false,
    });

    const handleKeteranganChange = (transactionId: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            keteranganPerSTT: {
                ...prev.keteranganPerSTT,
                [transactionId]: value,
            },
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const grandTotal = transactions.reduce((sum, t) => sum + t.jumlah, 0);
    const ppnAmount = formData.includePPN ? grandTotal * 0.011 : 0;
    const totalWithPPN = grandTotal + ppnAmount;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl p-4 sm:p-6 md:p-8 max-w-4xl w-full shadow-2xl my-4 sm:my-8 max-h-[95vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 sm:mb-6 sticky top-0 bg-white pb-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Invoice Gabungan</h2>
                        <p className="text-gray-600 text-xs sm:text-sm mt-1">
                            {transactions.length} transaksi terpilih
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                        type="button"
                    >
                        <X size={24} className="text-gray-600" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Recipient Information */}
                    <div className="mb-6 bg-blue-50 p-4 rounded-xl">
                        <h3 className="font-semibold text-gray-800 mb-3">Informasi Penerima Invoice</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Kepada Yth
                                </label>
                                <input
                                    type="text"
                                    value={formData.kepadaYth}
                                    onChange={(e) => setFormData({ ...formData, kepadaYth: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                                    placeholder="Contoh: PT. ABC"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nama
                                </label>
                                <input
                                    type="text"
                                    value={formData.nama}
                                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                                    placeholder="Nama penerima"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Kota
                                </label>
                                <input
                                    type="text"
                                    value={formData.kota}
                                    onChange={(e) => setFormData({ ...formData, kota: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                                    placeholder="Contoh: MAKASSAR"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    No. NPWP
                                </label>
                                <input
                                    type="text"
                                    value={formData.noNPWP}
                                    onChange={(e) => setFormData({ ...formData, noNPWP: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                                    placeholder="Contoh: 01.234.567.8-901.000"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Keterangan Keberangkatan Umum */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-gray-800 mb-3">Keterangan Keberangkatan (Umum)</h3>
                        <textarea
                            value={formData.keteranganKeberangkatan}
                            onChange={(e) => setFormData({ ...formData, keteranganKeberangkatan: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                            placeholder="Contoh: BERANGKAT TGL 2 JANUARI 2026 KM. DHARMA KENCANA VII"
                            rows={2}
                        />
                        <p className="text-xs text-gray-500 mt-1">Keterangan ini akan muncul di atas tabel invoice</p>
                    </div>

                    {/* Keterangan per STT */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Keterangan Keberangkatan per STT</h3>
                        <div className="space-y-3 max-h-48 sm:max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 sm:p-3">
                            {transactions.map((transaction) => (
                                <div key={transaction.id} className="bg-gray-50 p-2 sm:p-3 rounded-lg border border-gray-100">
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                                        <span className="font-mono font-bold text-blue-600 text-xs sm:text-sm">
                                            {transaction.noSTT}
                                        </span>
                                        <span className="text-xs text-gray-600 break-all">
                                            {transaction.pengirimCity || 'ASAL'} → {transaction.tujuan}
                                        </span>
                                    </div>
                                    <textarea
                                        value={formData.keteranganPerSTT[transaction.id] || ''}
                                        onChange={(e) => handleKeteranganChange(transaction.id, e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-xs sm:text-sm"
                                        placeholder={`Contoh: BERANGKAT TGL ${new Date(transaction.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()} KM. ${transaction.pengirimCity?.toUpperCase() || 'ASAL'} ${transaction.isiBarang || ''}`}
                                        rows={2}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PPN Option */}
                    <div className="mb-6 bg-yellow-50 p-4 rounded-xl border-2 border-yellow-200">
                        <div className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                id="includePPN"
                                checked={formData.includePPN}
                                onChange={(e) => setFormData({ ...formData, includePPN: e.target.checked })}
                                className="w-5 h-5 mt-1 cursor-pointer"
                            />
                            <div className="flex-1">
                                <label htmlFor="includePPN" className="font-semibold text-gray-800 cursor-pointer block">
                                    Sertakan PPN 1.1%
                                </label>
                                <p className="text-sm text-gray-600 mt-1">
                                    Khusus untuk PKP yang menyertakan PPN
                                </p>
                                {formData.includePPN && (
                                    <div className="mt-3 text-sm bg-white p-3 rounded-lg border border-yellow-300">
                                        <p className="font-semibold text-red-600 mb-1">
                                            ⚠️ Transfer hanya ke Rekening BCA
                                        </p>
                                        <p className="text-gray-700">
                                            BCA <strong>1870444342</strong> a/n <strong>CAHAYA CARGO EXPRESS CV</strong>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl">
                        <h3 className="font-semibold text-gray-800 mb-2">Ringkasan</h3>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Subtotal ({transactions.length} transaksi):</span>
                                <span className="font-semibold">{formatRupiah(grandTotal)}</span>
                            </div>
                            {formData.includePPN && (
                                <>
                                    <div className="flex justify-between text-yellow-700">
                                        <span>PPN 1.1%:</span>
                                        <span className="font-semibold">{formatRupiah(ppnAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t-2 border-gray-300">
                                        <span>Total + PPN:</span>
                                        <span>{formatRupiah(totalWithPPN)}</span>
                                    </div>
                                </>
                            )}
                            {!formData.includePPN && (
                                <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t-2 border-gray-300">
                                    <span>Grand Total:</span>
                                    <span>{formatRupiah(grandTotal)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sticky bottom-0 bg-white pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:flex-1 bg-gray-100 text-gray-700 px-4 sm:px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm sm:text-base"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 sm:px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                            <Printer size={18} className="sm:w-5 sm:h-5" />
                            <span className="whitespace-nowrap">Lanjut ke Preview & Cetak</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
