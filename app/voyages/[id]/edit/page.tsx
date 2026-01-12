'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getVoyageById, updateVoyage } from '@/lib/firestore-voyages';
import { subscribeToFleets } from '@/lib/firestore-fleet';
import type { Voyage, VoyageFormData, VoyageStatus } from '@/types/voyage';
import type { Fleet } from '@/types/fleet';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ArrowLeft, Save, Ship, Truck } from 'lucide-react';

export default function EditVoyagePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [voyage, setVoyage] = useState<Voyage | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fleets, setFleets] = useState<Fleet[]>([]);
    const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
    const [formData, setFormData] = useState<VoyageFormData>({
        departureDate: '',
        arrivalDate: '',
        route: '',
        status: 'planned',
        vehicleNumbers: [],
        notes: '',
    });

    // Load fleet data
    useEffect(() => {
        const unsubscribe = subscribeToFleets('', (data) => {
            setFleets(data.filter(f => f.status === 'Available'));
        });
        return () => unsubscribe();
    }, []);

    // Load voyage
    useEffect(() => {
        const loadVoyage = async () => {
            try {
                const data = await getVoyageById(id);
                if (!data) {
                    alert('Pemberangkatan tidak ditemukan');
                    router.push('/voyages');
                    return;
                }
                setVoyage(data);

                // Initialize selected vehicles from voyage data
                setSelectedVehicles(data.vehicleNumbers || []);

                // Pre-fill form
                setFormData({
                    departureDate: new Date(data.departureDate).toISOString().split('T')[0],
                    arrivalDate: data.arrivalDate ? new Date(data.arrivalDate).toISOString().split('T')[0] : '',
                    route: data.route,
                    status: data.status,
                    shipName: data.shipName || '',
                    vehicleNumbers: data.vehicleNumbers || [],
                    notes: data.notes || '',
                });

                setLoading(false);
            } catch (error) {
                console.error('Error loading voyage:', error);
                setLoading(false);
            }
        };

        loadVoyage();
    }, [id, router]);

    const handleChange = (field: keyof VoyageFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.route.trim()) {
            alert('Rute harus diisi');
            return;
        }

        setSaving(true);
        try {
            const updateData = {
                ...formData,
                vehicleNumbers: selectedVehicles
            };
            await updateVoyage(id, updateData);
            alert('Pemberangkatan berhasil diupdate!');
            router.push(`/voyages/${id}`);
        } catch (error) {
            console.error('Error updating voyage:', error);
            alert('Gagal mengupdate pemberangkatan');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Memuat pemberangkatan...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    if (!voyage) {
        return null;
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <div className="container mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <Link href={`/voyages/${id}`} className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-2">
                            <ArrowLeft size={16} />
                            Kembali ke Detail
                        </Link>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3 mt-4">
                            <Ship size={36} />
                            Edit {voyage.voyageNumber}
                        </h1>
                        <p className="text-gray-600 mt-2">Update informasi pemberangkatan</p>
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

                                    {/* Manual Input for Rental Trucks */}
                                    <div className="mt-4">
                                        <p className="text-sm font-semibold text-gray-700 mb-2">
                                            + Tambah Nopol Manual (Truk Sewaan)
                                        </p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Contoh: L 9999 XY"
                                                className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-sm"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const input = e.currentTarget;
                                                        const plate = input.value.trim().toUpperCase();
                                                        if (plate && !selectedVehicles.includes(plate)) {
                                                            setSelectedVehicles(prev => [...prev, plate]);
                                                            input.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                    const plate = input.value.trim().toUpperCase();
                                                    if (plate && !selectedVehicles.includes(plate)) {
                                                        setSelectedVehicles(prev => [...prev, plate]);
                                                        input.value = '';
                                                    }
                                                }}
                                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors"
                                            >
                                                Tambah
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Tekan Enter atau klik Tambah untuk memasukkan nopol truk sewaan
                                        </p>
                                    </div>

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

                            {/* Arrival Date */}
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
                                    placeholder="Tambahkan catatan..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all resize-none"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 pt-6 border-t border-gray-200">
                                <Link href={`/voyages/${id}`} className="flex-1">
                                    <button
                                        type="button"
                                        className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                                    >
                                        Batal
                                    </button>
                                </Link>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={20} />
                                            Simpan Perubahan
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
