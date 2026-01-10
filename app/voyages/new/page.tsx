'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { createVoyage } from '@/lib/firestore-voyages';
import { subscribeToFleets } from '@/lib/firestore-fleet';
import type { VoyageFormData, VoyageStatus } from '@/types/voyage';
import type { Fleet } from '@/types/fleet';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ArrowLeft, Save, Ship, Truck } from 'lucide-react';

export default function NewVoyagePage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [fleets, setFleets] = useState<Fleet[]>([]);
    const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
    const [formData, setFormData] = useState<VoyageFormData>({
        route: '',
        departureDate: new Date().toISOString().split('T')[0],
        arrivalDate: '',
        status: 'planned',
        shipName: '',
        vehicleNumbers: [],
        notes: '',
    });

    // Load fleet data
    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToFleets(user.uid, (data) => {
            // Filter only available vehicles
            setFleets(data.filter(f => f.status === 'Available'));
        });
        return () => unsubscribe();
    }, [user]);

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
            const voyageData = {
                ...formData,
                vehicleNumbers: selectedVehicles
            };
            const voyageId = await createVoyage(voyageData, user.uid);
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

                                {/* Fleet Multi-Select */}
                                <div className="mb-6">
                                    <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                                        <Truck size={18} />
                                        Pilih Kendaraan
                                    </label>

                                    {fleets.length === 0 ? (
                                        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                                            <Truck size={32} className="mx-auto text-gray-400 mb-2" />
                                            <p className="text-sm text-gray-500 mb-2">
                                                Belum ada armada tersedia.
                                            </p>
                                            <Link href="/fleets/new" className="text-blue-600 hover:text-blue-700 text-sm font-semibold">
                                                Tambah Armada →
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="border-2 border-gray-200 rounded-xl p-4 max-h-80 overflow-y-auto">
                                            {fleets.map(fleet => (
                                                <label
                                                    key={fleet.id}
                                                    className="flex items-center gap-3 p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedVehicles.includes(fleet.plateNumber)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedVehicles(prev => [...prev, fleet.plateNumber]);
                                                            } else {
                                                                setSelectedVehicles(prev => prev.filter(v => v !== fleet.plateNumber));
                                                            }
                                                        }}
                                                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-gray-800 group-hover:text-blue-600">
                                                            {fleet.plateNumber}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            {fleet.name} • {fleet.type}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                                        {fleet.status}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {selectedVehicles.length > 0 && (
                                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                            <p className="text-sm font-semibold text-blue-900 mb-2">
                                                Kendaraan Terpilih ({selectedVehicles.length}):
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedVehicles.map(plate => (
                                                    <span
                                                        key={plate}
                                                        className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
                                                    >
                                                        {plate}
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedVehicles(prev => prev.filter(v => v !== plate))}
                                                            className="hover:bg-blue-700 rounded-full w-4 h-4 flex items-center justify-center"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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
