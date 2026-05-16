'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, Package, Copy, RotateCcw, Info, Plus, Trash2, DollarSign, Printer, User, ArrowRight, Box, Pencil, X } from 'lucide-react';
import {
    calculateDimensions,
    formatWeight,
    formatVolume,
    validateDimensions
} from '@/lib/volume-calculator';
import type { VolumeCalculatorFormData, VolumeCalculation } from '@/types/volume-calculation';
import { VOLUMETRIC_DIVISOR } from '@/types/volume-calculation';

interface KoliItem extends VolumeCalculation {
    koliNumber: number;
}

export default function VolumeCalculator() {
    const router = useRouter();

    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);

    // Session State
    const [senderName, setSenderName] = useState<string>('');
    const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

    // Form State
    const [formData, setFormData] = useState<VolumeCalculatorFormData>({
        length: 0,
        width: 0,
        height: 0,
        actualWeight: 0,
        quantity: 1,
        itemName: ''
    });

    const [koliList, setKoliList] = useState<KoliItem[]>([]);
    const [pricePerKg, setPricePerKg] = useState<number>(0);
    const [errors, setErrors] = useState<string[]>([]);
    const [showInfo, setShowInfo] = useState(false);
    const [editingKoliNumber, setEditingKoliNumber] = useState<number | null>(null);

    const handleStartSession = (e: React.FormEvent) => {
        e.preventDefault();
        if (senderName.trim() === '') {
            setErrors(['Nama pengirim tidak boleh kosong']);
            return;
        }
        setErrors([]);
        setIsSessionActive(true);
    };

    const handleInputChange = (field: keyof VolumeCalculatorFormData, value: number | string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setErrors([]);
    };

    const handleAddKoli = () => {
        const validation = validateDimensions(
            formData.length,
            formData.width,
            formData.height,
            formData.actualWeight
        );

        const newErrors = [...validation.errors];
        if (!formData.itemName || formData.itemName.trim() === '') {
            newErrors.push('Nama/Tipe barang harus diisi');
        }

        if (newErrors.length > 0) {
            setErrors(newErrors);
            return;
        }

        const calculation = calculateDimensions(formData);
        const newKoli: KoliItem = {
            ...calculation,
            koliNumber: koliList.length + 1
        };

        setKoliList(prev => [...prev, newKoli]);

        setFormData({ length: 0, width: 0, height: 0, actualWeight: 0, quantity: 1, itemName: '' });
        setErrors([]);
    };

    const handleEditKoli = (koliNumber: number) => {
        const koli = koliList.find(k => k.koliNumber === koliNumber);
        if (!koli) return;
        setEditingKoliNumber(koliNumber);
        setFormData({
            length: koli.length,
            width: koli.width,
            height: koli.height,
            actualWeight: koli.actualWeight,
            quantity: koli.quantity,
            itemName: koli.itemName
        });
        setErrors([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleUpdateKoli = () => {
        if (editingKoliNumber === null) return;
        const validation = validateDimensions(formData.length, formData.width, formData.height, formData.actualWeight);
        const newErrors = [...validation.errors];
        if (!formData.itemName || formData.itemName.trim() === '') newErrors.push('Nama/Tipe barang harus diisi');
        if (newErrors.length > 0) { setErrors(newErrors); return; }

        const calculation = calculateDimensions(formData);
        setKoliList(prev => prev.map(k =>
            k.koliNumber === editingKoliNumber ? { ...calculation, koliNumber: editingKoliNumber } : k
        ));
        setEditingKoliNumber(null);
        setFormData({ length: 0, width: 0, height: 0, actualWeight: 0, quantity: 1, itemName: '' });
        setErrors([]);
    };

    const handleCancelEdit = () => {
        setEditingKoliNumber(null);
        setFormData({ length: 0, width: 0, height: 0, actualWeight: 0, quantity: 1, itemName: '' });
        setErrors([]);
    };

    const handleRemoveKoli = (koliNumber: number) => {
        setKoliList(prev => {
            const filtered = prev.filter(k => k.koliNumber !== koliNumber);
            return filtered.map((k, index) => ({ ...k, koliNumber: index + 1 }));
        });
    };

    const handleReset = () => {
        if (confirm('Apakah Anda yakin ingin mereset seluruh halaman ini?')) {
            setSenderName('');
            setIsSessionActive(false);
            setFormData({
                length: 0,
                width: 0,
                height: 0,
                actualWeight: 0,
                quantity: 1,
                itemName: ''
            });
            setKoliList([]);
            setPricePerKg(0);
            setErrors([]);
        }
    };

    const handleCopyResult = () => {
        if (koliList.length === 0) return;

        let text = `Hasil Perhitungan Volume - Cahaya Cargo Express\n`;
        text += `Pengirim: ${senderName}\n`;
        text += `${'='.repeat(50)}\n\n`;

        koliList.forEach(koli => {
            text += `Koli ${koli.koliNumber} - ${koli.itemName}:\n`;
            text += `  Jumlah: ${koli.quantity} pcs\n`;
            text += `  Dimensi: ${koli.length} × ${koli.width} × ${koli.height} cm\n`;
            text += `  Total Volume: ${formatVolume(koli.volume)} cm³\n`;
            text += `  Berat Aktual (Satuan): ${formatWeight(koli.actualWeight)} kg\n`;
            text += `  Total Berat Volume: ${formatWeight(koli.volumetricWeight)} kg\n`;
            text += `  Berat Tagihan: ${formatWeight(koli.chargeableWeight)} kg (${koli.weightType === 'actual' ? 'Actual' : 'Volumetric'})\n\n`;
        });

        text += `${'='.repeat(50)}\n`;
        text += `Total Koli: ${koliList.length}\n`;
        text += `Total Berat Tagihan: ${formatWeight(totalWeight)} kg\n`;

        if (pricePerKg > 0) {
            text += `Harga per kg: Rp ${pricePerKg.toLocaleString('id-ID')}\n`;
            text += `TOTAL BIAYA: Rp ${totalPrice.toLocaleString('id-ID')}\n`;
        }

        navigator.clipboard.writeText(text);
        alert('Hasil berhasil disalin ke clipboard!');
    };

    const handlePrint = () => {
        if (koliList.length === 0) return;

        const dataString = encodeURIComponent(JSON.stringify(koliList));
        const priceString = pricePerKg.toString();
        const senderString = encodeURIComponent(senderName);

        router.push(`/tools/volume-calculator/print?data=${dataString}&price=${priceString}&sender=${senderString}`);
    };

    const totalWeight = koliList.reduce((sum, koli) => sum + koli.chargeableWeight, 0);
    const totalPrice = totalWeight * pricePerKg;

    if (!isClient) return null;

    // --- Modal / Start Session View ---
    if (!isSessionActive) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md w-full mx-auto transform transition-all duration-500 hover:scale-[1.02]">
                    <div className="text-center mb-8">
                        <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Box className="text-blue-600" size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Kalkulator Volume</h2>
                        <p className="text-gray-500 mt-2 text-sm">Hitung akurat berat tagihan untuk Cahaya Cargo Express</p>
                    </div>

                    <form onSubmit={handleStartSession} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Pengirim</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="text-gray-400" size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={senderName}
                                    onChange={(e) => {
                                        setSenderName(e.target.value);
                                        setErrors([]);
                                    }}
                                    className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-medium"
                                    placeholder="Masukkan nama pengirim / perusahaan"
                                    autoFocus
                                />
                            </div>
                            {errors.length > 0 && <p className="text-red-500 text-sm mt-2 font-medium animate-pulse">{errors[0]}</p>}
                        </div>

                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all shadow-lg hover:shadow-blue-500/30"
                        >
                            Mulai Perhitungan <ArrowRight size={20} />
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // --- Main Calculator View ---
    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in zoom-in duration-500">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-gray-900 to-blue-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                        <User size={24} className="text-white" />
                    </div>
                    <div>
                        <p className="text-blue-200 text-sm font-medium">Session Aktif</p>
                        <h2 className="text-2xl font-bold tracking-tight">Pengirim: {senderName}</h2>
                    </div>
                </div>
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-red-500/80 text-white rounded-lg text-sm font-medium transition-all backdrop-blur-sm"
                >
                    <RotateCcw size={16} /> Ganti Pengirim
                </button>
            </div>

            {/* Input Form Card */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-50 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className={`p-2 rounded-lg ${editingKoliNumber !== null ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {editingKoliNumber !== null ? <Pencil size={24} /> : <Package size={24} />}
                    </div>
                    <div>
                        <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                            {editingKoliNumber !== null ? `Edit Koli #${editingKoliNumber}` : `Input Data Koli ${koliList.length > 0 ? `#${koliList.length + 1}` : 'Pertama'}`}
                        </h3>
                        {editingKoliNumber !== null && <p className="text-xs text-amber-600 font-medium mt-0.5">Mode edit aktif — ubah data lalu simpan</p>}
                    </div>
                </div>

                {/* Form Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
                    
                    {/* Row 1: Item Info & Weight */}
                    <div className="md:col-span-6">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Nama / Tipe Barang *</label>
                        <input
                            type="text"
                            value={formData.itemName}
                            onChange={(e) => handleInputChange('itemName', e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all"
                            placeholder="Contoh: Sepatu, Buku, Mesin"
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Berat Aktual (kg) *</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={formData.actualWeight || ''}
                                onChange={(e) => handleInputChange('actualWeight', parseFloat(e.target.value) || 0)}
                                className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all"
                                placeholder="0"
                                min="0"
                                step="0.1"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">kg</span>
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Jumlah Barang (Qty) *</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={formData.quantity || ''}
                                onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
                                className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium transition-all"
                                placeholder="1"
                                min="1"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">pcs</span>
                        </div>
                    </div>

                    {/* Row 2: Dimensions */}
                    <div className="md:col-span-12">
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 md:p-5">
                            <label className="block text-sm font-bold text-gray-700 mb-3">Dimensi (P x L x T) *</label>
                            <div className="grid grid-cols-3 gap-3 md:gap-6">
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.length || ''}
                                        onChange={(e) => handleInputChange('length', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-center bg-white"
                                        placeholder="Panjang"
                                        min="0"
                                    />
                                    <span className="absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold hidden sm:block">×</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.width || ''}
                                        onChange={(e) => handleInputChange('width', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-center bg-white"
                                        placeholder="Lebar"
                                        min="0"
                                    />
                                    <span className="absolute -right-3 md:-right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold hidden sm:block">×</span>
                                </div>
                                <div>
                                    <input
                                        type="number"
                                        value={formData.height || ''}
                                        onChange={(e) => handleInputChange('height', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-center bg-white"
                                        placeholder="Tinggi (cm)"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error Messages */}
                {errors.length > 0 && (
                    <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-start gap-3 relative z-10 animate-in slide-in-from-top-2">
                        <Info size={20} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold mb-1">Terjadi Kesalahan</p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                {errors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Submit Action */}
                <div className="mt-8 relative z-10 flex flex-col md:flex-row items-center justify-end gap-4">
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="text-sm text-gray-500 hover:text-blue-600 font-medium flex items-center gap-1 md:mr-auto transition-colors"
                    >
                        <Info size={16} /> Lihat Rumus Perhitungan
                    </button>

                    {editingKoliNumber !== null ? (
                        <>
                            <button
                                onClick={handleCancelEdit}
                                className="w-full md:w-auto px-6 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                            >
                                <X size={18} /> Batal Edit
                            </button>
                            <button
                                onClick={handleUpdateKoli}
                                className="w-full md:w-auto px-8 py-3.5 bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                            >
                                <Pencil size={18} /> Simpan Perubahan
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleAddKoli}
                            className="w-full md:w-auto px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={20} strokeWidth={3} /> Masukkan ke Daftar Koli
                        </button>
                    )}
                </div>

                {/* Formula Info Expandable */}
                {showInfo && (
                    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm relative z-10 animate-in fade-in">
                        <p className="mb-2"><strong>Berat Volume (kg)</strong> = (P × L × T) / {VOLUMETRIC_DIVISOR}</p>
                        <p><strong>Berat Tagihan</strong> = Nilai TERTINGGI antara Berat Aktual vs Berat Volume</p>
                    </div>
                )}
            </div>

            {/* Render Koli List if Exists */}
            {koliList.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header Bar */}
                    <div className="bg-gray-50 p-4 md:p-6 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Calculator size={20} className="text-green-600" /> Daftar Koli ({koliList.length})
                        </h3>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button
                                onClick={handlePrint}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
                            >
                                <Printer size={16} /> Print Data
                            </button>
                            <button
                                onClick={handleCopyResult}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
                            >
                                <Copy size={16} /> Salin Text
                            </button>
                        </div>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto p-0">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b-2 border-gray-200">
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Koli</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider max-w-[150px]">Barang</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Qty</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Dimensi</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actual W.</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Volume W.</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Charge W.</th>
                                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {koliList.map((koli) => (
                                    <tr key={koli.koliNumber} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="py-4 px-4 text-sm font-black text-gray-800">#{koli.koliNumber}</td>
                                        <td className="py-4 px-4 text-sm font-semibold text-gray-700 truncate max-w-[150px]" title={koli.itemName}>{koli.itemName}</td>
                                        <td className="py-4 px-4 text-sm text-center font-medium bg-gray-50/50">{koli.quantity}</td>
                                        <td className="py-4 px-4 text-sm text-right text-gray-600 whitespace-nowrap">
                                            {koli.length}×{koli.width}×{koli.height} <span className="text-xs text-gray-400">cm</span>
                                        </td>
                                        <td className="py-4 px-4 text-sm text-right font-medium">
                                            {formatWeight(koli.actualWeight * koli.quantity)}
                                        </td>
                                        <td className="py-4 px-4 text-sm text-right font-medium">
                                            {formatWeight(koli.volumetricWeight)}
                                        </td>
                                        <td className="py-4 px-4 text-sm text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-bold text-green-700 text-base">{formatWeight(koli.chargeableWeight)} kg</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold uppercase mt-1 ${koli.weightType === 'actual' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {koli.weightType}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleEditKoli(koli.koliNumber)}
                                                    className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="Edit Koli"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveKoli(koli.koliNumber)}
                                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Hapus Koli"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {koliList.map((koli) => (
                            <div key={koli.koliNumber} className="p-4 bg-white relative">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <span className="inline-block bg-gray-900 text-white text-xs font-black px-2 py-1 rounded mb-1">KOLI #{koli.koliNumber}</span>
                                        <p className="font-bold text-gray-800 text-lg">{koli.itemName}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleEditKoli(koli.koliNumber)}
                                            className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"
                                            title="Edit Koli"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleRemoveKoli(koli.koliNumber)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm bg-gray-50 p-3 rounded-lg mb-3">
                                    <div>
                                        <p className="text-gray-500 text-xs">Jumlah</p>
                                        <p className="font-bold text-gray-800">{koli.quantity} pcs</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs">Dimensi (cm)</p>
                                        <p className="font-bold text-gray-800">{koli.length}×{koli.width}×{koli.height}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs border-t border-gray-200 mt-2 pt-2">Actual Weight</p>
                                        <p className="font-medium">{formatWeight(koli.actualWeight * koli.quantity)} kg</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs border-t border-gray-200 mt-2 pt-2">Volume Weight</p>
                                        <p className="font-medium">{formatWeight(koli.volumetricWeight)} kg</p>
                                    </div>
                                </div>

                                <div className="flex items-end justify-between px-1">
                                    <div>
                                        <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${koli.weightType === 'actual' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                            Base: {koli.weightType}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 font-bold mb-0.5">Berat Tagihan</p>
                                        <p className="text-xl font-black text-green-600 leading-none">{formatWeight(koli.chargeableWeight)} <span className="text-sm">kg</span></p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary Bottom Bar */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-100 p-4 md:p-6 border-t border-green-200">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                            
                            {/* Summary Left */}
                            <div className="flex flex-row items-center justify-around md:justify-start gap-8 bg-white/60 p-4 rounded-xl backdrop-blur-sm border border-white">
                                <div className="text-center md:text-left">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Koli</p>
                                    <p className="text-3xl font-black text-gray-900">{koliList.length}</p>
                                </div>
                                <div className="w-px h-12 bg-gray-300"></div>
                                <div className="text-center md:text-left">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Berat Tagihan</p>
                                    <p className="text-3xl font-black text-green-700">{formatWeight(totalWeight)} <span className="text-base font-bold text-green-600/60">kg</span></p>
                                </div>
                            </div>

                            {/* Summary Right (Pricing Box) */}
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col md:flex-row">
                                <div className="p-4 md:w-1/2 md:border-r border-gray-100 bg-gray-50/50">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Estimasi Tarif (per kg)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                                        <input
                                            type="number"
                                            value={pricePerKg || ''}
                                            onChange={(e) => setPricePerKg(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-bold text-lg text-gray-900 transition-all"
                                            placeholder="0"
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div className="p-6 md:w-1/2 bg-gradient-to-br from-green-600 to-emerald-600 text-white flex flex-col justify-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <DollarSign size={80} />
                                    </div>
                                    <p className="text-xs font-bold text-green-100 uppercase tracking-wider mb-1 relative z-10">Total Biaya</p>
                                    <div className="relative z-10 flex items-baseline gap-1">
                                        <span className="text-lg font-bold text-green-200">Rp</span>
                                        <span className="text-3xl sm:text-4xl font-black tracking-tight">{totalPrice.toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
