'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    X, Search, CheckCircle2, Loader2, Package, User, MapPin,
    Plus, Check, Building2, Info, Hash, Calendar
} from 'lucide-react';
import { addTransaction, getTransactionById, peekNextSTTNumber } from '@/lib/firestore-transactions';
import type { Client } from '@/types/client';
import type { Branch } from '@/types/branch';
import { getAllBranches, getActiveBranch } from '@/types/branch';
import type { BeratUnit, TransactionFormData } from '@/types/transaction';
import type { ManifestItem, ManifestRowColor } from '@/types/manifest';

export interface CreatedManifestSTTResult {
    manifestItem: ManifestItem;
    transactionId: string;
    noSTT: string;
    branch: Branch;
}

interface CreateSTTFromManifestModalProps {
    isOpen: boolean;
    userId: string;
    defaultTanggal?: string;
    clients: Client[];
    onClose: () => void;
    onCreated: (result: CreatedManifestSTTResult) => void;
}

const getInitialDate = (candidate?: string): string => {
    if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate.trim())) {
        return candidate.trim();
    }
    return new Date().toISOString().split('T')[0];
};

export default function CreateSTTFromManifestModal({
    isOpen,
    userId,
    defaultTanggal,
    clients,
    onClose,
    onCreated,
}: CreateSTTFromManifestModalProps) {
    const branches = useMemo(() => getAllBranches(), []);

    // Branch & Auto STT Preview
    const [selectedBranch, setSelectedBranch] = useState<Branch>(getActiveBranch());
    const [previewSTT, setPreviewSTT] = useState<string>('');
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Date
    const [tanggal, setTanggal] = useState<string>(() => getInitialDate(defaultTanggal));

    // Pengirim searchable dropdown state
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientQuery, setClientQuery] = useState<string>('');
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Manual inputs (no price fields — priced later in Modul Resi & Transaksi)
    const [penerimaName, setPenerimaName] = useState<string>('');
    const [penerimaPhone, setPenerimaPhone] = useState<string>('');
    const [tujuan, setTujuan] = useState<string>('');
    const [alamat, setAlamat] = useState<string>('');
    const [koli, setKoli] = useState<number>(1);
    const [berat, setBerat] = useState<string>('');
    const [beratUnit, setBeratUnit] = useState<BeratUnit>('KG');
    const [isiBarang, setIsiBarang] = useState<string>('');
    const [keterangan, setKeterangan] = useState<string>('');
    const [rowColor, setRowColor] = useState<ManifestRowColor>('white');

    // Submit & Feedback States
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [lastCreatedBanner, setLastCreatedBanner] = useState<string | null>(null);

    // Sync default date when modal opens
    useEffect(() => {
        if (isOpen) {
            setTanggal(getInitialDate(defaultTanggal));
            setFormError(null);
            setLastCreatedBanner(null);
        }
    }, [isOpen, defaultTanggal]);

    // Fetch next STT preview whenever modal opens or branch changes
    const refreshSTTPreview = async (branch: Branch) => {
        setLoadingPreview(true);
        try {
            const nextNo = await peekNextSTTNumber(branch);
            setPreviewSTT(nextNo);
        } catch (err) {
            console.error('Failed to peek next STT:', err);
            setPreviewSTT('-');
        } finally {
            setLoadingPreview(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        refreshSTTPreview(selectedBranch);
    }, [isOpen, selectedBranch]);

    // Close client dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter clients for searchable dropdown
    const filteredClients = useMemo(() => {
        const q = clientQuery.trim().toLowerCase();
        const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));
        if (!q) return sorted.slice(0, 60);
        return sorted
            .filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.city || '').toLowerCase().includes(q) ||
                (c.phone || '').toLowerCase().includes(q)
            )
            .slice(0, 60);
    }, [clients, clientQuery]);

    const resetEntryFields = (keepSender: boolean = false) => {
        if (!keepSender) {
            setSelectedClient(null);
            setClientQuery('');
        }
        setPenerimaName('');
        setPenerimaPhone('');
        setTujuan('');
        setAlamat('');
        setKoli(1);
        setBerat('');
        setBeratUnit('KG');
        setIsiBarang('');
        setKeterangan('');
        setRowColor('white');
        setFormError(null);
    };

    const handleCreateSTT = async (keepOpen: boolean) => {
        setFormError(null);

        if (!userId) {
            setFormError('Sesi pengguna tidak ditemukan. Silakan login ulang.');
            return;
        }
        if (!selectedClient) {
            setFormError('Nama Pengirim wajib dipilih dari dropdown database pengirim.');
            return;
        }
        if (!penerimaName.trim()) {
            setFormError('Nama Penerima wajib diisi.');
            return;
        }
        if (!tujuan.trim()) {
            setFormError('Tujuan / Kota pengiriman wajib diisi.');
            return;
        }
        if (!koli || Number(koli) <= 0) {
            setFormError('Jumlah Koli minimal 1.');
            return;
        }

        const parsedBerat = berat.trim() === ''
            ? 0
            : parseFloat(berat.trim().replace(',', '.'));
        if (isNaN(parsedBerat) || parsedBerat < 0) {
            setFormError('Format berat tidak valid. Gunakan angka (contoh: 50 atau 12.5).');
            return;
        }

        setSubmitting(true);
        try {
            const txFormData: TransactionFormData = {
                branch: selectedBranch,
                tanggal,
                tujuan: tujuan.trim(),
                pengirimId: selectedClient.id,
                penerimaId: '',
                koli: Number(koli),
                berat: parsedBerat,
                beratUnit,
                tipeTransaksi: 'regular',
                harga: 0,
                noInvoice: '',
                pembayaran: 'Tunai',
                pelunasan: 'Pending',
                keterangan: keterangan.trim(),
                isiBarang: isiBarang.trim(),
                status: 'pending',
                isTaxable: false,
                ppnRate: 0,
                ppn: 0,
            };

            const newTxId = await addTransaction(
                txFormData,
                userId,
                {
                    name: selectedClient.name,
                    phone: selectedClient.phone || '',
                    address: selectedClient.address || '',
                    city: selectedClient.city || '',
                },
                {
                    name: penerimaName.trim(),
                    phone: penerimaPhone.trim(),
                    address: alamat.trim(),
                    city: tujuan.trim(),
                },
                0 // jumlah = 0 (harga diisi di Modul Resi & Transaksi)
                // noSTT omitted -> atomically generated from metadata/stt_counters for selectedBranch
            );

            const createdTx = await getTransactionById(newTxId);
            const finalNoSTT = createdTx?.noSTT || previewSTT;

            const manifestAlamat = alamat.trim()
                ? `${alamat.trim()}${tujuan.trim() && !alamat.toLowerCase().includes(tujuan.trim().toLowerCase()) ? ` - ${tujuan.trim()}` : ''}`
                : tujuan.trim();

            const manifestItem: ManifestItem = {
                noSTT: finalNoSTT,
                koli: Number(koli),
                berat: parsedBerat > 0 ? parsedBerat : '',
                isiBarang: isiBarang.trim().toUpperCase(),
                pengirim: selectedClient.name.toUpperCase(),
                penerima: penerimaName.trim().toUpperCase(),
                alamat: manifestAlamat.toUpperCase(),
                keterangan: keterangan.trim().toUpperCase(),
                color: rowColor,
                transactionId: newTxId,
            };

            onCreated({
                manifestItem,
                transactionId: newTxId,
                noSTT: finalNoSTT,
                branch: selectedBranch,
            });

            if (keepOpen) {
                setLastCreatedBanner(`Resi ${finalNoSTT} (${selectedClient.name} ➔ ${penerimaName.trim()}) tersimpan & masuk ke manifes!`);
                resetEntryFields(false);
                await refreshSTTPreview(selectedBranch);
            } else {
                resetEntryFields(false);
                onClose();
            }
        } catch (err: any) {
            console.error('Error creating STT from manifest:', err);
            setFormError(err?.message || 'Gagal membuat resi STT baru.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200">
                {/* Modal Header */}
                <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-start justify-between gap-3 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-xl">
                                <Package size={18} />
                            </span>
                            <div>
                                <h3 className="font-black text-base sm:text-lg tracking-tight">
                                    Tambah STT Baru (Resi Otomatis)
                                </h3>
                                <p className="text-[11px] text-slate-300 mt-0.5">
                                    Otomatis tercatat di Modul Resi &amp; Transaksi dan langsung masuk ke baris Manifes
                                </p>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="p-5 overflow-y-auto space-y-4 text-xs">
                    {/* Info Notice: No Price Needed */}
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start gap-2.5 text-blue-900">
                        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                            <strong>Data Awal Resi:</strong> Harga, total biaya, PPN, dan pembayaran tidak perlu diinput di sini — cukup lengkapi nanti di modul <strong>Resi &amp; Transaksi</strong>.
                        </div>
                    </div>

                    {/* Last Created Confirmation Banner (for consecutive entry) */}
                    {lastCreatedBanner && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2 text-emerald-800 font-bold">
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            <span>{lastCreatedBanner}</span>
                        </div>
                    )}

                    {/* Error Alert */}
                    {formError && (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-rose-800 font-bold">
                            ⚠️ {formError}
                        </div>
                    )}

                    {/* Step 1: Cabang / Seri Urutan STT + Live Preview + Tanggal */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="font-extrabold text-gray-800 uppercase tracking-wider text-[10.5px] flex items-center gap-1.5">
                                <Hash size={13} className="text-emerald-600" />
                                Urutan Cabang No. STT
                            </label>
                            <div className="inline-flex items-center gap-1.5 bg-white border border-emerald-300 px-3 py-1 rounded-xl shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-500">No. STT Berikutnya:</span>
                                {loadingPreview ? (
                                    <Loader2 size={13} className="animate-spin text-emerald-600" />
                                ) : (
                                    <span className="font-mono font-black text-sm text-emerald-700 tracking-wide">
                                        {previewSTT || '-'}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {branches.map(b => {
                                const isActive = selectedBranch === b.id;
                                return (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setSelectedBranch(b.id)}
                                        className={`py-2.5 px-3 rounded-xl border text-center font-extrabold transition-all ${
                                            isActive
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                                                : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/40'
                                        }`}
                                    >
                                        <span className="block text-xs">{b.name}</span>
                                        <span className={`block text-[9.5px] font-medium mt-0.5 ${isActive ? 'text-emerald-100' : 'text-gray-400'}`}>
                                            Seri {b.name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div>
                            <label className="font-bold text-gray-700 block mb-1 flex items-center gap-1">
                                <Calendar size={12} className="text-blue-600" /> Tanggal Resi STT
                            </label>
                            <input
                                type="date"
                                value={tanggal}
                                onChange={(e) => setTanggal(e.target.value)}
                                className="w-full sm:w-56 px-3 py-2 bg-white border border-gray-300 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Step 2: Nama Pengirim (Searchable Dropdown from Database Clients) */}
                    <div ref={dropdownRef} className="relative">
                        <label className="font-extrabold text-gray-800 block mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Building2 size={14} className="text-blue-600" />
                                Nama Pengirim (Database Pengirim) <span className="text-rose-500">*</span>
                            </span>
                            <span className="text-[10px] font-semibold text-gray-400">
                                {clients.length} pengirim terdaftar
                            </span>
                        </label>

                        {selectedClient ? (
                            <div className="p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/60 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="font-black text-sm text-emerald-950 flex items-center gap-1.5">
                                        <Check size={15} className="text-emerald-600 shrink-0" />
                                        <span className="truncate">{selectedClient.name}</span>
                                    </div>
                                    <div className="text-[11px] text-emerald-800 truncate mt-0.5">
                                        {[selectedClient.city, selectedClient.phone, selectedClient.address].filter(Boolean).join(' • ') || 'Terdaftar di database pengirim'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedClient(null);
                                        setClientQuery('');
                                        setDropdownOpen(true);
                                    }}
                                    className="px-2.5 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] shrink-0"
                                >
                                    Ganti
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={clientQuery}
                                    onFocus={() => setDropdownOpen(true)}
                                    onChange={(e) => {
                                        setClientQuery(e.target.value);
                                        setDropdownOpen(true);
                                    }}
                                    placeholder="Ketik untuk mencari nama pengirim dari database..."
                                    className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-300 rounded-xl font-semibold text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                                {clientQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setClientQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                                    >
                                        <X size={14} />
                                    </button>
                                )}

                                {dropdownOpen && (
                                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto z-30 divide-y divide-gray-100">
                                        {filteredClients.length === 0 ? (
                                            <div className="p-4 text-center text-gray-400 italic">
                                                Pengirim &quot;{clientQuery}&quot; tidak ditemukan di database pengirim.
                                            </div>
                                        ) : (
                                            filteredClients.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedClient(c);
                                                        setClientQuery(c.name);
                                                        setDropdownOpen(false);
                                                    }}
                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between gap-2"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-gray-900 truncate">{c.name}</div>
                                                        <div className="text-[10.5px] text-gray-500 truncate">
                                                            {c.city || 'Kota -'}{c.address ? ` • ${c.address}` : ''}
                                                        </div>
                                                    </div>
                                                    {c.phone && (
                                                        <span className="font-mono text-[10px] text-gray-400 shrink-0">
                                                            {c.phone}
                                                        </span>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Step 3: Manual Inputs — Penerima, Tujuan, Alamat */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="font-extrabold text-gray-800 block mb-1 flex items-center gap-1">
                                <User size={12} className="text-indigo-600" />
                                Nama Penerima <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={penerimaName}
                                onChange={(e) => setPenerimaName(e.target.value)}
                                placeholder="Input manual nama penerima..."
                                className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl font-semibold text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <div>
                            <label className="font-extrabold text-gray-800 block mb-1 flex items-center gap-1">
                                <MapPin size={12} className="text-rose-500" />
                                Tujuan / Kota <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={tujuan}
                                onChange={(e) => setTujuan(e.target.value)}
                                placeholder="Contoh: MAKASSAR / MAROS / BAU-BAU"
                                className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl font-semibold text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-gray-700 block mb-1">
                                Alamat Pengiriman (Opsional)
                            </label>
                            <input
                                type="text"
                                value={alamat}
                                onChange={(e) => setAlamat(e.target.value)}
                                placeholder="Contoh: JL TODDOPULI RAYA - MAKASSAR"
                                className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-gray-700 block mb-1">
                                No. HP Penerima (Opsional)
                            </label>
                            <input
                                type="text"
                                value={penerimaPhone}
                                onChange={(e) => setPenerimaPhone(e.target.value)}
                                placeholder="08..."
                                className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>

                    {/* Step 4: Manual Inputs — Koli, Berat, Satuan, Isi Barang, Keterangan, Warna */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="font-extrabold text-gray-800 block mb-1">
                                Koli <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={koli || ''}
                                onChange={(e) => setKoli(Number(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-mono font-bold text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-gray-700 block mb-1">
                                Berat / Vol
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={berat}
                                onChange={(e) => setBerat(e.target.value)}
                                placeholder="0 (opsional)"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-mono font-bold text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-gray-700 block mb-1">
                                Satuan
                            </label>
                            <select
                                value={beratUnit}
                                onChange={(e) => setBeratUnit(e.target.value as BeratUnit)}
                                className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500"
                            >
                                <option value="KG">KG</option>
                                <option value="M3">M3</option>
                                <option value="KG/VOLUME">KG/VOLUME</option>
                            </select>
                        </div>
                        <div>
                            <label className="font-bold text-gray-700 block mb-1">
                                Warna Baris
                            </label>
                            <select
                                value={rowColor}
                                onChange={(e) => setRowColor(e.target.value as ManifestRowColor)}
                                className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-xl font-semibold text-gray-800 outline-none focus:border-blue-500"
                            >
                                <option value="white">⚪ Putih</option>
                                <option value="yellow">🟡 Kuning</option>
                                <option value="purple">🟣 Ungu</option>
                                <option value="green">🟢 Hijau</option>
                                <option value="blue">🔵 Biru</option>
                                <option value="red">🔴 Merah</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="font-bold text-gray-700 block mb-1">
                                Isi Barang
                            </label>
                            <input
                                type="text"
                                value={isiBarang}
                                onChange={(e) => setIsiBarang(e.target.value)}
                                placeholder="Contoh: GARMEN, DUZ, PETI, CAMPURAN"
                                className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <div>
                            <label className="font-bold text-gray-700 block mb-1">
                                Keterangan (Opsional)
                            </label>
                            <input
                                type="text"
                                value={keterangan}
                                onChange={(e) => setKeterangan(e.target.value)}
                                placeholder="Contoh: TIMBANG DULU, MOBIL ADI"
                                className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2.5 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-colors"
                    >
                        Tutup
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleCreateSTT(true)}
                            disabled={submitting}
                            className="px-4 py-2.5 bg-white border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Simpan &amp; Tambah Lagi
                        </button>
                        <button
                            type="button"
                            onClick={() => handleCreateSTT(false)}
                            disabled={submitting}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            Simpan STT ke Manifes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

