'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getTaxSettings } from '@/lib/firestore-settings';
import { getTransactionById, updateTransaction } from '@/lib/firestore-transactions';
import { subscribeToClients } from '@/lib/firestore';
import { formatRupiah } from '@/lib/currency';
import type { Client } from '@/types/client';
import type { Transaction, TransactionFormData, TipeTransaksi, MetodePembayaran, CaraPelunasan, BeratUnit, StatusTransaksi } from '@/types/transaction';
import CurrencyInput from '@/components/CurrencyInput';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ArrowLeft, Save, Package, Users, FileText, CheckCircle, Clock } from 'lucide-react';

// ...

export default function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
    // ...
    // Unwrap params Promise
    const { id } = use(params);
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [clients, setClients] = useState<Client[]>([]);

    // Tax Settings State
    const [taxSettings, setTaxSettings] = useState({ isPKP: false, defaultPPNRate: 0.11 });

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

    const [penerimaData, setPenerimaData] = useState({
        name: '',
        phone: '',
        address: '',
        city: '',
        tujuan: '',
    });

    const [isPKP, setIsPKP] = useState(false);
    const [jumlah, setJumlah] = useState(0);

    useEffect(() => {
        const loadTransaction = async () => {
            console.time('loadTransaction'); // Debug
            try {
                if (!id) return;
                const txn = await getTransactionById(id);
                if (!txn) {
                    alert('Transaksi tidak ditemukan');
                    router.push('/transactions');
                    return;
                }
                setTransaction(txn);

                // Set form data
                setFormData({
                    tanggal: txn.tanggal.toISOString().split('T')[0],
                    tujuan: txn.tujuan,
                    pengirimId: txn.pengirimId,
                    penerimaId: txn.penerimaId,
                    koli: txn.koli,
                    berat: txn.berat,
                    beratUnit: txn.beratUnit,
                    tipeTransaksi: txn.tipeTransaksi,
                    harga: txn.harga,
                    noInvoice: txn.noInvoice,
                    pembayaran: txn.pembayaran,
                    pelunasan: txn.pelunasan,
                    keterangan: txn.keterangan || '',
                    isiBarang: txn.isiBarang || '',
                    status: txn.status,
                    isTaxable: txn.isTaxable || false,
                    ppnRate: txn.ppnRate || 0,
                });

                setPenerimaData({
                    name: txn.penerimaName,
                    phone: txn.penerimaPhone || '',
                    address: txn.penerimaAddress || '',
                    city: txn.penerimaCity || '',
                    tujuan: txn.tujuan,
                });

                // Set initial PKP state from transaction
                // Logic: If transaction says nullable/undefined, it defaults to false.
                // If it HAS a value, we respect it.
                // We also need to check if we should fallback to global settings? 
                // NO, for EDIT, we must respect the SAVED state (snapshot in time).
                // ONLY if it's a legacy transaction without `isTaxable` field do we guess? 
                // Safer to assume false for legacy unless we want to force-apply current rules.
                // Let's trust txn.isTaxable.
                setIsPKP(txn.isTaxable || false);

                // Set Jumlah
                setJumlah(txn.jumlah);

            } catch (error) {
                console.error('Error loading transaction:', error);
                alert('Gagal memuat data transaksi');
            } finally {
                setLoading(false);
                console.timeEnd('loadTransaction'); // Debug
            }
        };

        loadTransaction();
    }, [id, router]);

    useEffect(() => {
        if (!user) return;

        // Load Client Data
        const unsubscribe = subscribeToClients((loadedClients) => {
            console.log(`[EditTransaction] Loaded ${loadedClients.length} clients`);
            setClients(loadedClients);
        }, user.uid);

        // Load Tax Settings
        getTaxSettings(user.uid).then(settings => {
            setTaxSettings({ isPKP: settings.isPKP, defaultPPNRate: settings.defaultPPNRate });
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (formData.tipeTransaksi === 'regular') {
            const subtotal = formData.harga * formData.berat;

            // Use stored rate if exists, otherwise fallback to global tax settings
            // This ensures we don't accidentally check "PKP" and get a wrong 11% vs 1.1% mismatch based on old code
            const rate = transaction?.ppnRate || taxSettings.defaultPPNRate;

            const ppn = isPKP ? subtotal * rate : 0;
            setJumlah(Math.round(subtotal + ppn));
        }
    }, [formData.harga, formData.berat, formData.tipeTransaksi, isPKP, transaction?.ppnRate, taxSettings.defaultPPNRate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.pengirimId) return alert('Pengirim harus dipilih');
        if (!penerimaData.name.trim()) return alert('Nama penerima harus diisi');
        if (!penerimaData.tujuan.trim()) return alert('Tujuan harus diisi');
        if (formData.koli <= 0) return alert('Koli harus lebih dari 0');
        if (formData.tipeTransaksi === 'regular' && formData.harga <= 0) return alert('Harga harus diisi untuk transaksi regular');
        if (formData.tipeTransaksi === 'borongan' && jumlah <= 0) return alert('Jumlah harus diisi untuk transaksi borongan');
        if (!user) return alert('User tidak terautentikasi');

        setSaving(true);
        try {
            const pengirim = clients.find(c => c.id === formData.pengirimId);
            if (!pengirim) throw new Error('Pengirim data not found');

            const updatedFormData = {
                ...formData,
                tujuan: penerimaData.tujuan,
                isTaxable: isPKP,
                ppnRate: isPKP ? (transaction?.ppnRate || taxSettings.defaultPPNRate) : 0,
                // Note: ppn will be calculated in backend if we don't pass it, 
                // but since we track `jumlah` (Total), let's ensure consistency.
                ppn: isPKP ? Math.round(jumlah - (jumlah / (1 + (transaction?.ppnRate || taxSettings.defaultPPNRate)))) : 0
            };

            await updateTransaction(
                id,
                updatedFormData,
                {
                    name: pengirim.name,
                    phone: pengirim.phone,
                    address: pengirim.address,
                    city: pengirim.city,
                },
                penerimaData,
                jumlah
            );

            alert('Transaksi berhasil diupdate!');
            router.push('/transactions');
        } catch (error) {
            console.error('Error updating transaction:', error);
            alert('Gagal mengupdate transaksi. Silakan coba lagi.');
            setSaving(false);
        }
    };

    const handleChange = (field: keyof TransactionFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600 font-semibold">Memuat data transaksi...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-20">
                {/* Clean White Sticky Header */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="container mx-auto max-w-4xl px-4 py-4">
                        <Link href="/transactions" className="text-sm text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                            <ArrowLeft size={16} />
                            Batal & Kembali
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-bold text-gray-800">Edit Transaksi</h1>
                            <span className="text-xs font-mono text-gray-400 mt-1">{transaction?.noSTT} • INV: {transaction?.noInvoice}</span>
                        </div>
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
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">No. STT (Permanen)</label>
                                    <input
                                        type="text"
                                        value={transaction?.noSTT || ''}
                                        disabled
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                                    />
                                </div>
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
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tipe Perhitungan</label>
                                    <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-200 max-w-md">
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
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Pengirim & Penerima */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <Users size={20} className="text-blue-600" />
                                Pengirim & Penerima
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Pengirim</label>
                                    <select
                                        value={formData.pengirimId}
                                        onChange={(e) => handleChange('pengirimId', e.target.value)}
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                                    >
                                        <option value="">Pilih Pengirim</option>
                                        {clients.map(client => (
                                            <option key={client.id} value={client.id}>
                                                {client.name} - {client.city}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="border-t pt-4">
                                    <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Detail Penerima</label>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <input
                                                type="text"
                                                value={penerimaData.name}
                                                onChange={(e) => setPenerimaData({ ...penerimaData, name: e.target.value })}
                                                placeholder="Nama Penerima"
                                                required
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                value={penerimaData.phone}
                                                onChange={(e) => setPenerimaData({ ...penerimaData, phone: e.target.value })}
                                                placeholder="No. Telepon"
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                value={penerimaData.city}
                                                onChange={(e) => setPenerimaData({ ...penerimaData, city: e.target.value })}
                                                placeholder="Kota"
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                value={penerimaData.tujuan}
                                                onChange={(e) => setPenerimaData({ ...penerimaData, tujuan: e.target.value })}
                                                placeholder="Kota Tujuan (PENTING)"
                                                required
                                                className="w-full px-4 py-2.5 rounded-xl border-2 border-blue-100 focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <textarea
                                                value={penerimaData.address}
                                                onChange={(e) => setPenerimaData({ ...penerimaData, address: e.target.value })}
                                                placeholder="Alamat Lengkap"
                                                rows={2}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Detail Muatan */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <Package size={20} className="text-blue-600" />
                                Detail Muatan
                            </h2>
                            <div className="grid md:grid-cols-3 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Koli</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.koli}
                                        onChange={(e) => handleChange('koli', parseInt(e.target.value) || 1)}
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-center font-bold"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Berat</label>
                                    <div className="flex">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.berat}
                                            onChange={(e) => handleChange('berat', parseFloat(e.target.value) || 0)}
                                            required
                                            className="w-full px-4 py-2.5 rounded-l-xl border border-gray-200 focus:border-blue-500 outline-none"
                                        />
                                        <select
                                            value={formData.beratUnit}
                                            onChange={(e) => handleChange('beratUnit', e.target.value as BeratUnit)}
                                            className="bg-gray-50 border border-gray-200 border-l-0 rounded-r-xl px-4 text-sm font-medium text-gray-600 outline-none"
                                        >
                                            <option value="KG">KG</option>
                                            <option value="M3">M3</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Harga Satuan ({formData.beratUnit})
                                    </label>
                                    <CurrencyInput
                                        value={formData.harga}
                                        onChange={(val) => handleChange('harga', val)}
                                        disabled={formData.tipeTransaksi === 'borongan'}
                                        helperText={formData.tipeTransaksi === 'borongan' ? 'Tidak diisi untuk borongan' : undefined}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Opsi Pajak
                                    </label>
                                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 h-[46px]">
                                        <input
                                            type="checkbox"
                                            id="pkp"
                                            checked={isPKP}
                                            onChange={(e) => setIsPKP(e.target.checked)}
                                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <label htmlFor="pkp" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                                            Jasa Kena Pajak (PPN)
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Total Biaya
                                </label>
                                <CurrencyInput
                                    value={jumlah}
                                    onChange={setJumlah}
                                    readOnly={formData.tipeTransaksi === 'regular'}
                                    helperText={formData.tipeTransaksi === 'regular'
                                        ? (() => {
                                            const subtotal = formData.harga * formData.berat;
                                            const rate = transaction?.ppnRate || taxSettings.defaultPPNRate;
                                            const ppn = isPKP ? subtotal * rate : 0;
                                            return `${formatRupiah(formData.harga)} × ${formData.berat} ${formData.beratUnit}${isPKP ? ` + PPN (${(rate * 100).toLocaleString('id-ID')}%)` : ''} = ${formatRupiah(jumlah)}`;
                                        })()
                                        : 'Input manual untuk borongan'
                                    }
                                />
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 mt-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Isi Barang</label>
                                    <input
                                        type="text"
                                        value={formData.isiBarang}
                                        onChange={(e) => handleChange('isiBarang', e.target.value)}
                                        placeholder="Deskripsi..."
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">No. Invoice (Opsional)</label>
                                    <input
                                        type="text"
                                        value={formData.noInvoice}
                                        onChange={(e) => handleChange('noInvoice', e.target.value)}
                                        placeholder="Kosongkan jika auto"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Pembayaran & Status */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-2">
                                <FileText size={20} className="text-blue-600" />
                                Status & Pembayaran
                            </h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Metode Bayar</label>
                                    <select
                                        value={formData.pembayaran}
                                        onChange={(e) => handleChange('pembayaran', e.target.value as MetodePembayaran)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                                    >
                                        <option value="Tunai">Tunai</option>
                                        <option value="Kredit">Kredit</option>
                                        <option value="DP">DP</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status Lunas</label>
                                    <select
                                        value={formData.pelunasan}
                                        onChange={(e) => handleChange('pelunasan', e.target.value as CaraPelunasan)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Cash">Cash</option>
                                        <option value="TF">Transfer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status Pengiriman</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => handleChange('status', e.target.value as StatusTransaksi)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="diproses">Diproses</option>
                                        <option value="dikirim">Dikirim</option>
                                        <option value="selesai">Selesai</option>
                                        <option value="dibatalkan">Dibatalkan</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Keterangan Tambahan</label>
                                <textarea
                                    value={formData.keterangan}
                                    onChange={(e) => handleChange('keterangan', e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none resize-none"
                                    placeholder="Catatan..."
                                />
                            </div>
                        </div>

                        {/* Status History */}
                        {transaction && transaction.statusHistory.length > 0 && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <Clock size={20} className="text-orange-500" />
                                    Riwayat Perubahan
                                </h2>
                                <div className="space-y-4 pl-2">
                                    {transaction.statusHistory.map((entry, idx) => (
                                        <div key={idx} className="flex gap-4 relative">
                                            <div className="w-2 h-2 mt-2 rounded-full bg-gray-300 flex-shrink-0"></div>
                                            <div className="flex-1 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-sm font-bold text-gray-700 capitalize">{entry.status}</span>
                                                    <span className="text-xs text-gray-400">
                                                        {entry.timestamp.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                {entry.catatan && <p className="text-xs text-gray-500 italic">"{entry.catatan}"</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4 pt-4">
                            <Link href="/transactions" className="flex-1">
                                <button type="button" className="w-full py-3.5 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">
                                    Batal
                                </button>
                            </Link>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-[2] bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
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
        </ProtectedRoute>
    );
}
