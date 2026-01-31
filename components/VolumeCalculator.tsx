'use client';

import { useState } from 'react';
import { Calculator, Package, Copy, RotateCcw, Info, Plus, Trash2, DollarSign } from 'lucide-react';
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
    const [formData, setFormData] = useState<VolumeCalculatorFormData>({
        length: 0,
        width: 0,
        height: 0,
        actualWeight: 0
    });

    const [koliList, setKoliList] = useState<KoliItem[]>([]);
    const [pricePerKg, setPricePerKg] = useState<number>(0);
    const [errors, setErrors] = useState<string[]>([]);
    const [showInfo, setShowInfo] = useState(false);

    const handleInputChange = (field: keyof VolumeCalculatorFormData, value: number) => {
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

        if (!validation.valid) {
            setErrors(validation.errors);
            return;
        }

        const calculation = calculateDimensions(formData);
        const newKoli: KoliItem = {
            ...calculation,
            koliNumber: koliList.length + 1
        };

        setKoliList(prev => [...prev, newKoli]);

        // Reset form for next koli
        setFormData({
            length: 0,
            width: 0,
            height: 0,
            actualWeight: 0
        });
        setErrors([]);
    };

    const handleRemoveKoli = (koliNumber: number) => {
        setKoliList(prev => {
            const filtered = prev.filter(k => k.koliNumber !== koliNumber);
            // Renumber kolis
            return filtered.map((k, index) => ({ ...k, koliNumber: index + 1 }));
        });
    };

    const handleReset = () => {
        setFormData({
            length: 0,
            width: 0,
            height: 0,
            actualWeight: 0
        });
        setKoliList([]);
        setPricePerKg(0);
        setErrors([]);
    };

    const handleCopyResult = () => {
        if (koliList.length === 0) return;

        let text = `Hasil Perhitungan Volume - Cahaya Cargo Express\n`;
        text += `${'='.repeat(50)}\n\n`;

        koliList.forEach(koli => {
            text += `Koli ${koli.koliNumber}:\n`;
            text += `  Dimensi: ${koli.length} × ${koli.width} × ${koli.height} cm\n`;
            text += `  Volume: ${formatVolume(koli.volume)} cm³\n`;
            text += `  Berat Aktual: ${formatWeight(koli.actualWeight)} kg\n`;
            text += `  Berat Volume: ${formatWeight(koli.volumetricWeight)} kg\n`;
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

    // Calculate totals
    const totalWeight = koliList.reduce((sum, koli) => sum + koli.chargeableWeight, 0);
    const totalPrice = totalWeight * pricePerKg;

    return (
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <Info size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-blue-900 mb-1">Cara Penggunaan</h3>
                        <p className="text-sm text-blue-800 mb-2">
                            Input data koli satu per satu, klik "Tambah Koli" untuk menyimpannya. Sistem akan otomatis memilih berat yang lebih tinggi.
                        </p>
                        <button
                            onClick={() => setShowInfo(!showInfo)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-semibold underline"
                        >
                            {showInfo ? 'Sembunyikan' : 'Lihat'} rumus perhitungan
                        </button>
                        {showInfo && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                                <p className="text-sm text-gray-700 mb-2">
                                    <strong>Rumus Berat Volume:</strong>
                                </p>
                                <code className="block bg-gray-100 p-2 rounded text-sm mb-3">
                                    Berat Volume (kg) = (Panjang × Lebar × Tinggi) / {VOLUMETRIC_DIVISOR}
                                </code>
                                <p className="text-sm text-gray-700">
                                    <strong>Berat Tagihan:</strong> MAX(Berat Aktual, Berat Volume)
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Input Form */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package size={20} className="text-blue-600" />
                    Input Koli {koliList.length > 0 ? `#${koliList.length + 1}` : ''}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Panjang (cm) *
                        </label>
                        <input
                            type="number"
                            value={formData.length || ''}
                            onChange={(e) => handleInputChange('length', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                            min="0"
                            step="0.1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Lebar (cm) *
                        </label>
                        <input
                            type="number"
                            value={formData.width || ''}
                            onChange={(e) => handleInputChange('width', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                            min="0"
                            step="0.1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Tinggi (cm) *
                        </label>
                        <input
                            type="number"
                            value={formData.height || ''}
                            onChange={(e) => handleInputChange('height', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                            min="0"
                            step="0.1"
                        />
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Berat Aktual (kg) *
                    </label>
                    <input
                        type="number"
                        value={formData.actualWeight || ''}
                        onChange={(e) => handleInputChange('actualWeight', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                        min="0"
                        step="0.1"
                    />
                </div>

                {/* Error Messages */}
                {errors.length > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-semibold text-red-800 mb-2">Error:</p>
                        <ul className="list-disc list-inside space-y-1">
                            {errors.map((error, index) => (
                                <li key={index} className="text-sm text-red-700">{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleAddKoli}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} />
                        Tambah Koli
                    </button>
                    <button
                        onClick={handleReset}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                        title="Reset Semua"
                    >
                        <RotateCcw size={20} />
                    </button>
                </div>
            </div>

            {/* Koli List */}
            {koliList.length > 0 && (
                <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base md:text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Calculator size={18} className="text-green-600 md:hidden" />
                            <Calculator size={20} className="text-green-600 hidden md:block" />
                            <span>Daftar Koli ({koliList.length})</span>
                        </h3>
                        <button
                            onClick={handleCopyResult}
                            className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors border border-gray-300"
                        >
                            <Copy size={14} className="md:hidden" />
                            <Copy size={16} className="hidden md:block" />
                            <span className="hidden sm:inline">Salin</span>
                        </button>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b-2 border-gray-300">
                                    <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Koli</th>
                                    <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Dimensi</th>
                                    <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Volume</th>
                                    <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Aktual</th>
                                    <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Volumetrik</th>
                                    <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">Tagihan</th>
                                    <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">Tipe</th>
                                    <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {koliList.map((koli) => (
                                    <tr key={koli.koliNumber} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-3 px-2 text-sm font-semibold text-gray-800">#{koli.koliNumber}</td>
                                        <td className="py-3 px-2 text-sm text-right text-gray-700">
                                            {koli.length}×{koli.width}×{koli.height}
                                        </td>
                                        <td className="py-3 px-2 text-sm text-right text-gray-700">
                                            {formatVolume(koli.volume)} cm³
                                        </td>
                                        <td className="py-3 px-2 text-sm text-right text-gray-700">
                                            {formatWeight(koli.actualWeight)} kg
                                        </td>
                                        <td className="py-3 px-2 text-sm text-right text-gray-700">
                                            {formatWeight(koli.volumetricWeight)} kg
                                        </td>
                                        <td className="py-3 px-2 text-sm text-right font-bold text-green-700">
                                            {formatWeight(koli.chargeableWeight)} kg
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${koli.weightType === 'actual'
                                                ? 'bg-orange-100 text-orange-700'
                                                : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {koli.weightType === 'actual' ? 'Actual' : 'Volume'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                            <button
                                                onClick={() => handleRemoveKoli(koli.koliNumber)}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Hapus"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {koliList.map((koli) => (
                            <div key={koli.koliNumber} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-gray-800">Koli #{koli.koliNumber}</span>
                                    <button
                                        onClick={() => handleRemoveKoli(koli.koliNumber)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Hapus"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                    <div>
                                        <span className="text-gray-600">Dimensi:</span>
                                        <p className="font-semibold text-gray-800">{koli.length}×{koli.width}×{koli.height} cm</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Volume:</span>
                                        <p className="font-semibold text-gray-800">{formatVolume(koli.volume)} cm³</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Berat Aktual:</span>
                                        <p className="font-semibold text-gray-800">{formatWeight(koli.actualWeight)} kg</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Berat Volume:</span>
                                        <p className="font-semibold text-gray-800">{formatWeight(koli.volumetricWeight)} kg</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-gray-300">
                                    <div>
                                        <span className="text-xs text-gray-600">Berat Tagihan:</span>
                                        <p className="text-lg font-bold text-green-700">{formatWeight(koli.chargeableWeight)} kg</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${koli.weightType === 'actual'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {koli.weightType === 'actual' ? 'Actual' : 'Volume'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Total & Price Calculation */}
            {koliList.length > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 md:p-6 shadow-sm border-2 border-green-300">
                    <h3 className="text-base md:text-lg font-bold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
                        <DollarSign size={18} className="text-green-600 md:hidden" />
                        <DollarSign size={20} className="text-green-600 hidden md:block" />
                        Total & Harga
                    </h3>

                    <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
                        <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-200">
                            <p className="text-xs md:text-sm text-gray-600 mb-1">Total Koli</p>
                            <p className="text-2xl md:text-3xl font-bold text-gray-900">{koliList.length}</p>
                        </div>

                        <div className="bg-white rounded-lg p-3 md:p-4 border-2 border-green-400">
                            <p className="text-xs md:text-sm text-gray-600 mb-1">Total Berat</p>
                            <p className="text-2xl md:text-3xl font-bold text-green-700">
                                {formatWeight(totalWeight)} <span className="text-xs md:text-sm font-normal text-gray-600">kg</span>
                            </p>
                        </div>
                    </div>

                    {/* Price Input */}
                    <div className="mb-4">
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">
                            Harga Satuan (per kg)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm md:text-base">
                                Rp
                            </span>
                            <input
                                type="number"
                                value={pricePerKg || ''}
                                onChange={(e) => setPricePerKg(parseFloat(e.target.value) || 0)}
                                className="w-full pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base md:text-lg font-semibold"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                    </div>

                    {/* Total Price */}
                    {pricePerKg > 0 && (
                        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-4 md:p-6 text-white">
                            <p className="text-xs md:text-sm opacity-90 mb-2">TOTAL BIAYA TRANSAKSI</p>
                            <div className="flex items-baseline gap-1 md:gap-2">
                                <span className="text-lg md:text-2xl font-semibold">Rp</span>
                                <span className="text-3xl md:text-5xl font-bold break-all">
                                    {totalPrice.toLocaleString('id-ID')}
                                </span>
                            </div>
                            <p className="text-xs md:text-sm opacity-75 mt-2 md:mt-3">
                                {formatWeight(totalWeight)} kg × Rp {pricePerKg.toLocaleString('id-ID')}/kg
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
