'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { createVoyage } from '@/lib/firestore-voyages';
import type { VoyageFormData, VoyageStatus } from '@/types/voyage';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ArrowLeft, Save, Ship } from 'lucide-react';

export default function NewVoyagePage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<VoyageFormData>({
        route: '',
        departureDate: new Date().toISOString().split('T')[0],
        arrivalDate: '',
        status: 'planned',
        shipName: '',
        vehicleNumber: '',
        notes: '',
    });

    const handleChange = (field: keyof VoyageFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.route.trim()) {
            alert('Rute harus diisi');
            return;
        }

        if (!user) {
            alert('User tidak terautentikasi');
            return;
        }

        setLoading(true);
        try {
            const voyageId = await createVoyage(formData, user.uid);
            alert('Pemberangkatan berhasil dibuat!');
            router.push(`/voyages/${voyageId}`);
        } catch (error) {
            console.error('Error creating voyage:', error);
            alert('Gagal membuat pemberangkatan');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div className="container mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <Link href="/voyages" className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-2">
                            <ArrowLeft size={16} />
                            Kembali ke Pemberangkatan
                        </Link>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3 mt-4">
                            <Ship size={36} />
                            Buat Pemberangkatan Baru
                        </h1>
                        <p className="text-gray-600 mt-2">Buat pemberangkatan untuk mencatat kargo dan pengeluaran</p>
                    </div>

                    {/* Form */}
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-3xl">
                        <form onSubmit={handleSubmit}>
                            {/* Route */}
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">
                                    Rute Perjalanan <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.route}
                                    onChange={(e) => handleChange('route', e.target.value)}
                                    placeholder="Contoh: Surabaya - Makassar"
                                    required
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                                />
                                <p className="text-sm text-gray-500 mt-1">Format: Kota Asal - Kota Tujuan</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                {/* Ship Name */}
                                <div>
                                    <label className="block text-gray-700 font-semibold mb-2">
                                        Nama Kapal
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.shipName || ''}
                                        onChange={(e) => handleChange('shipName', e.target.value)}
                                        placeholder="Contoh: KM. Nggapulu"
                                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                                    />
                                </div>

                                {/* Vehicle Number */}
                                <div>
                                    <label className="block text-gray-700 font-semibold mb-2">
                                        Nopol Kendaraan
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.vehicleNumber || ''}
                                        onChange={(e) => handleChange('vehicleNumber', e.target.value)}
                                        placeholder="Contoh: L 1234 AB"
                                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Departure Date */}
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">
                                    Tanggal Keberangkatan <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.departureDate}
                                    onChange={(e) => handleChange('departureDate', e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                                />
                            </div>

                            {/* Arrival Date (Optional) */}
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">
                                    Tanggal Tiba (Opsional)
                                </label>
                                <input
                                    type="date"
                                    value={formData.arrivalDate}
                                    onChange={(e) => handleChange('arrivalDate', e.target.value)}
                                    min={formData.departureDate}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                                />
                                <p className="text-sm text-gray-500 mt-1">Kosongkan jika belum diketahui</p>
                            </div>

                            {/* Status */}
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">
                                    Status <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => handleChange('status', e.target.value as VoyageStatus)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                                >
                                    <option value="planned">Direncanakan</option>
                                    <option value="in-progress">Dalam Perjalanan</option>
                                    <option value="completed">Selesai</option>
                                    <option value="cancelled">Dibatalkan</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">
                                    Catatan (Opsional)
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => handleChange('notes', e.target.value)}
                                    placeholder="Tambahkan catatan tentang pemberangkatan ini..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all resize-none"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 pt-6 border-t border-gray-200">
                                <Link href="/voyages" className="flex-1">
                                    <button
                                        type="button"
                                        className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                                    >
                                        Batal
                                    </button>
                                </Link>
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
                                            <Save size={20} />
                                            Simpan Pemberangkatan
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Info Box */}
                    <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-6 max-w-3xl">
                        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Info</h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Nomor pemberangkatan akan digenerate otomatis (VOY001, VOY002, ...)</li>
                            <li>• Setelah membuat pemberangkatan, Anda bisa assign transaksi kargo ke pemberangkatan ini</li>
                            <li>• Anda juga bisa mencatat semua pengeluaran operasional per pemberangkatan</li>
                        </ul>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
