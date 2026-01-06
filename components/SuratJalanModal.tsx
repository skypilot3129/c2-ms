'use client';

import { useState, useEffect } from 'react';
import type { SuratJalanData } from '@/types/transaction';
import { Truck, User, MapPin, Calendar, X, Package, FileText } from 'lucide-react';

interface SuratJalanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: SuratJalanData) => void;
    transactionId: string;
    // For pre-filling sender/receiver info
    namaPengirim?: string;
    alamatPengirim?: string;
    namaPenerima?: string;
    alamatPenerima?: string;
}

export default function SuratJalanModal({
    isOpen,
    onClose,
    onSubmit,
    transactionId,
    namaPengirim = '',
    alamatPengirim = '',
    namaPenerima = '',
    alamatPenerima = ''
}: SuratJalanModalProps) {
    const [formData, setFormData] = useState<SuratJalanData>({
        tanggalPC: new Date().toISOString().split('T')[0],
        nomorMobil: '',
        namaSopir: '',
        rute: '',
        // Pre-fill sender/receiver info (editable)
        namaPengirim,
        alamatPengirim,
        namaPenerima,
        alamatPenerima,
        // Service default
        service: 'darat',
        // Kondisi defaults
        konsesiBaik: true,
        konsesiRusak: false,
        konsesiBerkurang: false,
        // Asuransi default
        asuransi: false,
        // Payment default
        caraPembayaran: 'tunai',
    });

    // Update form when props change
    useEffect(() => {
        if (isOpen) {
            setFormData(prev => ({
                ...prev,
                namaPengirim,
                alamatPengirim,
                namaPenerima,
                alamatPenerima,
            }));
        }
    }, [isOpen, namaPengirim, alamatPengirim, namaPenerima, alamatPenerima]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const handleChange = (field: keyof SuratJalanData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl p-4 sm:p-6 md:p-8 max-w-4xl w-full shadow-2xl my-4 sm:my-8 max-h-[95vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 sm:mb-6 sticky top-0 bg-white pb-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Data Surat Jalan</h2>
                        <p className="text-gray-600 text-xs sm:text-sm mt-1">Isi data tambahan untuk mencetak Surat Jalan</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0" type="button">
                        <X size={24} className="text-gray-600" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    {/* Tanggal PC */}
                    <div>
                        <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                            <Calendar size={18} className="text-blue-600" />
                            Tanggal PC <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={formData.tanggalPC}
                            onChange={(e) => handleChange('tanggalPC', e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
                        />
                    </div>

                    {/* PENGIRIM Section */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 space-y-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <User size={20} className="text-blue-600" />
                            1. PENGIRIM
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2 text-sm">Nama Pengirim</label>
                                <input
                                    type="text"
                                    value={formData.namaPengirim}
                                    onChange={(e) => handleChange('namaPengirim', e.target.value)}
                                    placeholder="Nama/Perusahaan pengirim"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2 text-sm">Alamat Pengirim</label>
                                <input
                                    type="text"
                                    value={formData.alamatPengirim}
                                    onChange={(e) => handleChange('alamatPengirim', e.target.value)}
                                    placeholder="Alamat lengkap pengirim"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* PENERIMA Section */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 sm:p-6 space-y-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <User size={20} className="text-purple-600" />
                            2. PENERIMA
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2 text-sm">Nama Penerima</label>
                                <input
                                    type="text"
                                    value={formData.namaPenerima}
                                    onChange={(e) => handleChange('namaPenerima', e.target.value)}
                                    placeholder="Nama/Perusahaan penerima"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2 text-sm">Alamat Penerima</label>
                                <input
                                    type="text"
                                    value={formData.alamatPenerima}
                                    onChange={(e) => handleChange('alamatPenerima', e.target.value)}
                                    placeholder="Alamat lengkap penerima"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Transport Info */}
                    <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4 sm:p-6 space-y-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <Truck size={20} className="text-orange-600" />
                            Informasi Transport
                        </h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2 text-sm">Nomor Mobil</label>
                                <input
                                    type="text"
                                    value={formData.nomorMobil}
                                    onChange={(e) => handleChange('nomorMobil', e.target.value)}
                                    placeholder="B 1234 XYZ"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2 text-sm">Nama Sopir</label>
                                <input
                                    type="text"
                                    value={formData.namaSopir}
                                    onChange={(e) => handleChange('namaSopir', e.target.value)}
                                    placeholder="Nama supir"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2 text-sm">
                                    <MapPin size={16} className="text-orange-600" />
                                    Rute
                                </label>
                                <input
                                    type="text"
                                    value={formData.rute}
                                    onChange={(e) => handleChange('rute', e.target.value)}
                                    placeholder="Surabaya - Makassar"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Service Section */}
                    <div className="bg-gradient-to-r from-cyan-50 to-teal-50 rounded-xl p-4 sm:p-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <Truck size={20} className="text-cyan-600" />
                            Service
                        </h3>
                        <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="darat"
                                    checked={formData.service === 'darat'}
                                    onChange={(e) => handleChange('service', e.target.value)}
                                    className="w-5 h-5 text-cyan-600"
                                />
                                <span className="text-gray-700 font-medium">Darat</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="laut"
                                    checked={formData.service === 'laut'}
                                    onChange={(e) => handleChange('service', e.target.value)}
                                    className="w-5 h-5 text-cyan-600"
                                />
                                <span className="text-gray-700 font-medium">Laut</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="udara"
                                    checked={formData.service === 'udara'}
                                    onChange={(e) => handleChange('service', e.target.value)}
                                    className="w-5 h-5 text-cyan-600"
                                />
                                <span className="text-gray-700 font-medium">Udara</span>
                            </label>
                        </div>
                    </div>

                    {/* Kondisi Barang */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 sm:p-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <Package size={20} className="text-green-600" />
                            Kondisi Diterima Dengan
                        </h3>
                        <div className="flex flex-wrap gap-4 mb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.konsesiBaik}
                                    onChange={(e) => handleChange('konsesiBaik', e.target.checked)}
                                    className="w-5 h-5 text-green-600 rounded"
                                />
                                <span className="text-gray-700 font-medium">Baik</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.konsesiRusak}
                                    onChange={(e) => handleChange('konsesiRusak', e.target.checked)}
                                    className="w-5 h-5 text-red-600 rounded"
                                />
                                <span className="text-gray-700 font-medium">Rusak</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.konsesiBerkurang}
                                    onChange={(e) => handleChange('konsesiBerkurang', e.target.checked)}
                                    className="w-5 h-5 text-orange-600 rounded"
                                />
                                <span className="text-gray-700 font-medium">Berkurang</span>
                            </label>
                        </div>
                        <input
                            type="text"
                            value={formData.konsesiKeterangan || ''}
                            onChange={(e) => handleChange('konsesiKeterangan', e.target.value)}
                            placeholder="Keterangan kondisi (optional)"
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none"
                        />
                    </div>

                    {/* Asuransi & Payment */}
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* Asuransi (Simplified) */}
                        <div className="bg-yellow-50 rounded-xl p-4 sm:p-6">
                            <h3 className="font-bold text-gray-800 mb-3 text-sm sm:text-base">Asuransi</h3>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={formData.asuransi === true}
                                        onChange={() => handleChange('asuransi', true)}
                                        className="w-4 h-4 text-yellow-600"
                                    />
                                    <span className="font-medium">Ya</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={formData.asuransi === false}
                                        onChange={() => handleChange('asuransi', false)}
                                        className="w-4 h-4 text-yellow-600"
                                    />
                                    <span className="font-medium">Tidak</span>
                                </label>
                            </div>
                        </div>

                        {/* Cara Pembayaran */}
                        <div className="bg-pink-50 rounded-xl p-4 sm:p-6">
                            <h3 className="font-bold text-gray-800 mb-3 text-sm sm:text-base">Cara Pembayaran</h3>
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="tunai"
                                        checked={formData.caraPembayaran === 'tunai'}
                                        onChange={(e) => handleChange('caraPembayaran', e.target.value)}
                                        className="w-4 h-4 text-pink-600"
                                    />
                                    <span>Tunai</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="invoice"
                                        checked={formData.caraPembayaran === 'invoice'}
                                        onChange={(e) => handleChange('caraPembayaran', e.target.value)}
                                        className="w-4 h-4 text-pink-600"
                                    />
                                    <span>Invoice</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        value="bank"
                                        checked={formData.caraPembayaran === 'bank'}
                                        onChange={(e) => handleChange('caraPembayaran', e.target.value)}
                                        className="w-4 h-4 text-pink-600"
                                    />
                                    <span>Bank</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Dimensi & Volume */}
                    <div className="bg-indigo-50 rounded-xl p-4 sm:p-6 space-y-4">
                        <h3 className="font-bold text-gray-800 mb-3">Dimensi & Volume (Optional)</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2 text-sm">Dimensi (P x L x T)</label>
                                <input
                                    type="text"
                                    value={formData.dimensi || ''}
                                    onChange={(e) => handleChange('dimensi', e.target.value)}
                                    placeholder="Contoh: 100 x 50 x 30"
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-semibold mb-2 text-sm">Berat Volume</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={formData.beratVolume || ''}
                                        onChange={(e) => handleChange('beratVolume', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                        placeholder="Berat"
                                        className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none"
                                    />
                                    <select
                                        value={formData.satuanVolume || 'KG'}
                                        onChange={(e) => handleChange('satuanVolume', e.target.value)}
                                        className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="KG">KG</option>
                                        <option value="M3">M3</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Catatan Khusus */}
                    <div>
                        <label className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                            <FileText size={18} className="text-blue-600" />
                            Catatan Khusus
                        </label>
                        <textarea
                            value={formData.catatanKhusus || ''}
                            onChange={(e) => handleChange('catatanKhusus', e.target.value)}
                            placeholder="Catatan atau instruksi khusus..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Actions */}
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
                            className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 sm:px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm sm:text-base"
                        >
                            🖨️ Cetak Surat Jalan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
