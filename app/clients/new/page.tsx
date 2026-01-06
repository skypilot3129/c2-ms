'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addClient } from '@/lib/firestore';
import type { ClientFormData } from '@/types/client';
import { ArrowLeft, Save, User, Phone, MapPin, FileText, CheckCircle } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';

export default function NewClientPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<ClientFormData>({
        name: '',
        phone: '',
        address: '',
        city: '',
        notes: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) alert('Nama client harus diisi');
        if (!user) return alert('Anda harus login terlebih dahulu');

        setLoading(true);
        try {
            await addClient(formData, user.uid);
            router.push('/clients');
        } catch (error) {
            console.error('Error adding client:', error);
            alert('Gagal menambahkan client. Silakan coba lagi.');
            setLoading(false);
        }
    };

    const handleChange = (field: keyof ClientFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-20">
                {/* Clean White Sticky Header */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="container mx-auto max-w-2xl px-4 py-4">
                        <Link href="/clients" className="text-sm text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                            <ArrowLeft size={16} />
                            Batal & Kembali
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-800">Tambah Client Baru</h1>
                    </div>
                </div>

                <div className="container mx-auto max-w-2xl px-4 py-8">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Main Info Card */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <User size={20} className="text-blue-600" />
                                Data Diri
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Lengkap / Perusahaan <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                        placeholder="Contoh: PT. Sumber Makmur"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">No. Telepon</label>
                                        <div className="relative">
                                            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => handleChange('phone', e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                placeholder="0812..."
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Kota</label>
                                        <div className="relative">
                                            <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                value={formData.city}
                                                onChange={(e) => handleChange('city', e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                placeholder="Jakarta"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Alamat Lengkap</label>
                                    <textarea
                                        value={formData.address}
                                        onChange={(e) => handleChange('address', e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
                                        placeholder="Jalan, Nomor, RT/RW..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <FileText size={20} className="text-blue-600" />
                                Catatan Tambahan
                            </h2>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none"
                                placeholder="Preferensi khusus, info rekening, dll..."
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 pt-4">
                            <Link href="/clients" className="flex-1">
                                <button type="button" className="w-full py-3.5 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">
                                    Batal
                                </button>
                            </Link>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-[2] bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={20} />
                                        Simpan Client
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </ProtectedRoute>
    );
}
