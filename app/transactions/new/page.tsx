'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { addTransaction } from '@/lib/firestore-transactions';
import { subscribeToClients } from '@/lib/firestore';
import { getTaxSettings } from '@/lib/firestore-settings';
import { formatRupiah } from '@/lib/currency';
import type { Client } from '@/types/client';
import type { TransactionFormData, TipeTransaksi, MetodePembayaran, CaraPelunasan, BeratUnit, StatusTransaksi } from '@/types/transaction';
import CurrencyInput from '@/components/CurrencyInput';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ArrowLeft, Save, Package, Users, FileText, CheckCircle, AlertCircle, Trash2, Plus } from 'lucide-react';

export default function NewTransactionPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);


    const [formData, setFormData] = useState<TransactionFormData>({
        tanggal: new Date().toISOString().split('T')[0],
        tujuan: '',
        pengirimId: '',
        penerimaId: '',
        koli: 1,
        berat: 0,
        beratUnit: 'KG',
        tipeTransaksi: 'regular',
        harga: 0,
        noInvoice: '',
        pembayaran: 'Tunai',
        pelunasan: 'Pending',
        keterangan: '',
        isiBarang: '',
        status: 'pending',
        isTaxable: false,
        ppnRate: 0,
    });

    const [penerimaList, setPenerimaList] = useState([
        {
            name: '',
            phone: '',
            address: '',
            city: '',
            tujuan: '',
            koli: 1,
            berat: 0,
            beratUnit: 'KG' as BeratUnit,
            harga: 0,
            isPKP: false,
            jumlah: 0,
            pembayaran: 'Tunai' as MetodePembayaran,
            pelunasan: 'Pending' as CaraPelunasan,
            noSTT: '',  // Manual STT per transaction
        }
    ]);

    const [commonData, setCommonData] = useState({
        noInvoice: '',
        keterangan: '',
        isiBarang: '',
        status: 'pending' as StatusTransaksi,  // Shipping status
    });

    const addPenerima = () => {
        setPenerimaList([...penerimaList, {
            name: '',
            phone: '',
            address: '',
            city: '',
            tujuan: '',
            koli: 1,
            berat: 0,
            beratUnit: 'KG' as BeratUnit,
            harga: 0,
            isPKP: false,
            jumlah: 0,
            pembayaran: 'Tunai' as MetodePembayaran,
            pelunasan: 'Pending' as CaraPelunasan,
            noSTT: '',
        }]);
    };

    const removePenerima = (index: number) => {
        if (penerimaList.length > 1) {
            setPenerimaList(penerimaList.filter((_, i) => i !== index));
        }
    };

    const [taxSettings, setTaxSettings] = useState({ isPKP: false, defaultPPNRate: 0.11 });

    const updatePenerima = (index: number, field: string, value: any) => {
        const updated = [...penerimaList];
        updated[index] = { ...updated[index], [field]: value };

        if (field === 'harga' || field === 'berat' || field === 'isPKP' || field === 'jumlah') {
            if (formData.tipeTransaksi === 'regular') {
                const subtotal = (updated[index].harga || 0) * (updated[index].berat || 0);
                // Use settings rate if isPKP is checked
                const rate = updated[index].isPKP ? taxSettings.defaultPPNRate : 0;
                const ppn = Math.round(subtotal * rate);
                updated[index].jumlah = subtotal + ppn;
                (updated[index] as any).ppnAmount = ppn; // temp store for submit
                (updated[index] as any).ppnRate = rate;
            } else {
                // For Borongan, if PKP checked, assume Jumlah includes Tax or add Tax?
                // Usually Borongan is "Net". Let's assume Add Tax for safety or Net?
                // Let's keep simple: user inputs Total. If PKP, we back-calculate or add?
                // Standard: User inputs Price. If PKP, Tax is added.
                // But for Borongan manual input, maybe user inputs Final Price?
                // Let's assume user inputs BASE, and we add Tax if PKP.
                if (field === 'jumlah' || field === 'isPKP') {
                    // Logic: If user types 1000 and clicks PKP, should it become 1110?
                    // Or is 1000 the final?
                    // Let's assume for manual input, we just track tax status.
                    // But we need to define PPN amount.
                    // Let's stick to Regular auto-calc for now simplicity. 
                    // Manual Borongan: Just flagging as PKP might be enough, back-calc happens in backend if needed.
                    // But better:
                    const rate = updated[index].isPKP ? taxSettings.defaultPPNRate : 0;
                    if (updated[index].isPKP) {
                        // IF manual input, harder to know if user meant Inc or Exc. 
                        // Let's assume Inclusive for Borongan manual entry convenience?
                        // "Total Deal".
                        const total = updated[index].jumlah || 0;
                        const ppn = Math.round(total - (total / (1 + rate)));
                        (updated[index] as any).ppnAmount = ppn;
                        (updated[index] as any).ppnRate = rate;
                    } else {
                        (updated[index] as any).ppnAmount = 0;
                        (updated[index] as any).ppnRate = 0;
                    }
                }
            }
        }

        setPenerimaList(updated);
    };

    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToClients((loadedClients) => {
            setClients(loadedClients);
        }, user.uid);

        getTaxSettings(user.uid).then(settings => {
            setTaxSettings({ isPKP: settings.isPKP, defaultPPNRate: settings.defaultPPNRate });
        });

        return () => unsubscribe();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.pengirimId) {
            alert('Pengirim harus dipilih');
            return;
        }

        for (let i = 0; i < penerimaList.length; i++) {
            const p = penerimaList[i];
            if (!p.name.trim()) return alert(`Nama penerima #${i + 1} harus diisi`);
            if (!p.tujuan.trim()) return alert(`Tujuan penerima #${i + 1} harus diisi`);
            if (p.koli <= 0) return alert(`Koli penerima #${i + 1} harus lebih dari 0`);
            if (formData.tipeTransaksi === 'regular' && p.harga <= 0) return alert(`Harga penerima #${i + 1} harus diisi untuk transaksi regular`);
            if (formData.tipeTransaksi === 'borongan' && p.jumlah <= 0) return alert(`Jumlah penerima #${i + 1} harus diisi untuk transaksi borongan`);
        }

        if (!user) return alert('User tidak terautentikasi');

        setLoading(true);
        try {
            const pengirim = clients.find(c => c.id === formData.pengirimId);
            if (!pengirim) throw new Error('Pengirim data not found');

            const transactionPromises = penerimaList.map(async (penerima) => {
                const dataToSubmit = {
                    tanggal: formData.tanggal,
                    tujuan: penerima.tujuan,
                    pengirimId: formData.pengirimId,
                    penerimaId: '',
                    koli: penerima.koli,
                    berat: penerima.berat,
                    beratUnit: penerima.beratUnit,
                    tipeTransaksi: formData.tipeTransaksi,
                    harga: penerima.harga,
                    noInvoice: '',  // Will be auto-generated by addTransaction
                    pembayaran: penerima.pembayaran,
                    pelunasan: penerima.pelunasan,
                    keterangan: commonData.keterangan,
                    isiBarang: commonData.isiBarang,
                    status: commonData.status,

                    // Tax props from recipient
                    isTaxable: penerima.isPKP,
                    ppnRate: (penerima as any).ppnRate || 0,
                    ppn: (penerima as any).ppnAmount || 0,
                };

                return addTransaction(
                    dataToSubmit,
                    user.uid,
                    {
                        name: pengirim.name,
                        phone: pengirim.phone,
                        address: pengirim.address,
                        city: pengirim.city,
                    },
                    {
                        name: penerima.name,
                        phone: penerima.phone,
                        address: penerima.address,
                        city: penerima.city,
                    },
                    penerima.jumlah
                    // Don't pass noSTT - let it auto-generate to ensure counter increments
                );
            });

            await Promise.all(transactionPromises);

            alert(`✅ Berhasil membuat ${penerimaList.length} transaksi dengan Invoice: ${commonData.noInvoice || 'auto'}`);

            // Reset form instead of redirect  
            // Reset penerima list to initial state
            setPenerimaList([{
                name: '',
                phone: '',
                address: '',
                city: '',
                tujuan: '',
                koli: 1,
                berat: 0,
                beratUnit: 'KG' as BeratUnit,
                harga: 0,
                isPKP: false,
                jumlah: 0,
                pembayaran: 'Tunai' as MetodePembayaran,
                pelunasan: 'Pending' as CaraPelunasan,
                noSTT: '',
            }]);

            // Reset common data
            setCommonData({
                keterangan: '',
                isiBarang: '',
                noInvoice: '',
                status: 'pending' as StatusTransaksi,
            });

            setLoading(false);
        } catch (error) {
            console.error('Error creating transactions:', error);
            alert('Gagal membuat transaksi. Silakan coba lagi.');
            setLoading(false);
        }
    };

    const handleChange = (field: keyof TransactionFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-20">
                {/* Clean White Header */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="container mx-auto max-w-4xl px-4 py-4">
                        <Link href="/transactions" className="text-sm text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                            <ArrowLeft size={16} />
                            Batal & Kembali
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-800">Buat Resi Baru</h1>
                    </div>
                </div>

                <div className="container mx-auto max-w-4xl px-4 py-8">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Section 1: Info Dasar */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <Package size={20} className="text-blue-600" />
                                Informasi Dasar
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Transaksi</label>
                                    <input
                                        type="date"
                                        value={formData.tanggal}
                                        onChange={(e) => handleChange('tanggal', e.target.value)}
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipe Perhitungan</label>
                                    <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => handleChange('tipeTransaksi', 'regular')}
                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${formData.tipeTransaksi === 'regular' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            Regular (Timbang)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleChange('tipeTransaksi', 'borongan')}
                                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${formData.tipeTransaksi === 'borongan' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            Borongan (Manual)
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 ml-1">
                                        {formData.tipeTransaksi === 'regular' ? 'Harga dihitung otomatis: Berat × Harga/kg' : 'Harga total diuinput manual tanpa rumus.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Pengirim */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <Users size={20} className="text-blue-600" />
                                Data Pengirim
                            </h2>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Pilih Pengirim</label>
                                <select
                                    value={formData.pengirimId}
                                    onChange={(e) => handleChange('pengirimId', e.target.value)}
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                                >
                                    <option value="">-- Pilih Client --</option>
                                    {clients.map(client => (
                                        <option key={client.id} value={client.id}>
                                            {client.name} - {client.city}
                                        </option>
                                    ))}
                                </select>
                                <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                                    <span>Pengirim belum terdaftar?</span>
                                    <Link href="/clients/new" target="_blank" className="text-blue-600 hover:underline">
                                        + Tambah Database Client Bar
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Penerima List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-lg font-bold text-gray-800">Daftar Penerima & Muatan</h3>
                            </div>

                            {penerimaList.map((penerima, index) => (
                                <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative group text-sm">
                                    {/* Number Badge */}
                                    <div className="absolute -left-3 -top-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shadow-md z-10">
                                        {index + 1}
                                    </div>

                                    {/* Delete Button */}
                                    {penerimaList.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removePenerima(index)}
                                            className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}

                                    <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                                        {/* Left Col: Penerima Info */}
                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-gray-500 uppercase text-xs tracking-wider border-b pb-1">Info Penerima</h4>
                                            <div>
                                                <input
                                                    type="text"
                                                    value={penerima.name}
                                                    onChange={(e) => updatePenerima(index, 'name', e.target.value)}
                                                    placeholder="Nama Penerima"
                                                    required
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <input
                                                    type="text"
                                                    value={penerima.phone}
                                                    onChange={(e) => updatePenerima(index, 'phone', e.target.value)}
                                                    placeholder="No Telepon"
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none"
                                                />
                                                <input
                                                    type="text"
                                                    value={penerima.tujuan}
                                                    onChange={(e) => updatePenerima(index, 'tujuan', e.target.value)}
                                                    placeholder="Kota Tujuan"
                                                    required
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none"
                                                />
                                            </div>
                                            <textarea
                                                value={penerima.address}
                                                onChange={(e) => updatePenerima(index, 'address', e.target.value)}
                                                placeholder="Alamat Lengkap"
                                                rows={2}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none resize-none"
                                            />
                                        </div>

                                        {/* Right Col: Cargo Info */}
                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-gray-500 uppercase text-xs tracking-wider border-b pb-1">Detail Muatan</h4>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-xs text-gray-500 mb-1 block">Koli</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={penerima.koli || ''}
                                                        onChange={(e) => updatePenerima(index, 'koli', e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-center"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-xs text-gray-500 mb-1 block">Berat ({penerima.beratUnit})</label>
                                                    <div className="flex">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={penerima.berat || ''}
                                                            onChange={(e) => updatePenerima(index, 'berat', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                                            className="w-full px-3 py-2 rounded-l-lg border border-gray-200 focus:border-blue-500 outline-none"
                                                        />
                                                        <select
                                                            value={penerima.beratUnit}
                                                            onChange={(e) => updatePenerima(index, 'beratUnit', e.target.value as BeratUnit)}
                                                            className="bg-gray-50 border border-l-0 border-gray-200 rounded-r-lg px-2 text-xs font-medium text-gray-600 outline-none"
                                                        >
                                                            <option value="KG">KG</option>
                                                            <option value="M3">M3</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs text-gray-500 mb-1 block">
                                                    {formData.tipeTransaksi === 'regular' ? `Harga / ${penerima.beratUnit}` : 'Total Biaya'}
                                                </label>
                                                <CurrencyInput
                                                    value={formData.tipeTransaksi === 'regular' ? penerima.harga : penerima.jumlah}
                                                    onChange={(val) => updatePenerima(index, formData.tipeTransaksi === 'regular' ? 'harga' : 'jumlah', val)}
                                                />
                                            </div>



                                            {/* Subtotal Display (Regular) */}
                                            {formData.tipeTransaksi === 'regular' && (
                                                <div className="bg-blue-50 p-2 rounded-lg flex justify-between items-center px-3 border border-blue-100">
                                                    <span className="text-blue-600 font-semibold text-xs">Total:</span>
                                                    <span className="font-bold text-blue-800">{formatRupiah(penerima.jumlah)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Row: Payment & PKP */}
                                    <div className="mt-4 pt-4 border-t border-dashed border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                                <label htmlFor={`pkp-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                                                    Jasa Kena Pajak (PPN)
                                                </label>
                                                <input
                                                    type="checkbox"
                                                    id={`pkp-${index}`}
                                                    checked={penerima.isPKP}
                                                    onChange={(e) => updatePenerima(index, 'isPKP', e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                                />
                                            </div>
                                            <select
                                                value={penerima.pembayaran}
                                                onChange={(e) => updatePenerima(index, 'pembayaran', e.target.value as MetodePembayaran)}
                                                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                                            >
                                                <option value="Tunai">Tunai</option>
                                                <option value="Kredit">Kredit</option>
                                                <option value="DP">DP</option>
                                            </select>
                                            <select
                                                value={penerima.pelunasan}
                                                onChange={(e) => updatePenerima(index, 'pelunasan', e.target.value as CaraPelunasan)}
                                                className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none font-medium ${penerima.pelunasan === 'Pending' ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'
                                                    }`}
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Cash">Cash</option>
                                                <option value="TF">Transfer</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={addPenerima}
                                className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 font-medium hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={20} />
                                Tambah Penerima Lain
                            </button>
                        </div>

                        {/* Section 4: Lain-lain */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <FileText size={20} className="text-blue-600" />
                                Informasi Tambahan
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status Pengiriman</label>
                                    <select
                                        value={commonData.status}
                                        onChange={(e) => setCommonData(prev => ({ ...prev, status: e.target.value as StatusTransaksi }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="diproses">Diproses</option>
                                        <option value="dikirim">Dikirim</option>
                                        <option value="selesai">Selesai</option>
                                        <option value="dibatalkan">Dibatalkan</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Isi Barang (Umum)</label>
                                    <input
                                        type="text"
                                        value={commonData.isiBarang}
                                        onChange={(e) => setCommonData(prev => ({ ...prev, isiBarang: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                        placeholder="Contoh: Tekstil, Sparepart..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan</label>
                                    <input
                                        type="text"
                                        value={commonData.keterangan}
                                        onChange={(e) => setCommonData(prev => ({ ...prev, keterangan: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                        placeholder="Catatan tambahan..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Submit Actions */}
                        <div className="flex gap-4 pt-4">
                            <Link href="/transactions" className="flex-1">
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
                                        Simpan {penerimaList.length} Transaksi
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
