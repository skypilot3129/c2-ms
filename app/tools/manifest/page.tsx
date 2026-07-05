'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import RouteGuard from '@/components/RouteGuard';
import { 
    Ship, Truck, Calendar, User, Users, FileText, ArrowLeft, 
    Plus, Trash2, Printer, Save, RotateCcw, Search, 
    CheckCircle, Loader2, Play, ChevronDown, ChevronUp, X, Filter 
} from 'lucide-react';
import { getTransactionBySTT } from '@/lib/firestore-transactions';
import { 
    createManifest, getManifests, updateManifest, deleteManifest 
} from '@/lib/firestore-manifests';
import type { CargoManifest, ManifestItem } from '@/types/manifest';
import type { Transaction } from '@/types/transaction';
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DEFAULT_KEPADA = 'CAHAYA CARGO EXP MKS';

export default function ManifestCargoPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Form Header States
    const [tanggal, setTanggal] = useState<string>(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [kapal, setKapal] = useState<string>('');
    const [nopol, setNopol] = useState<string>('');
    const [sopir, setSopir] = useState<string>('');
    const [kepadaYth, setKepadaYth] = useState<string>(DEFAULT_KEPADA);

    // Form Items State
    const [items, setItems] = useState<ManifestItem[]>([]);
    
    // UI & Loading States
    const [savedId, setSavedId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [searchLoadingIdx, setSearchLoadingIdx] = useState<number | null>(null);
    const [sttSearchAlert, setSttSearchAlert] = useState<{ idx: number; message: string; type: 'success' | 'error' } | null>(null);

    // Bulk Import Modal States
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importTransactions, setImportTransactions] = useState<Transaction[]>([]);
    const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
    const [loadingTx, setLoadingTx] = useState(false);
    const [txFilter, setTxFilter] = useState('');

    // History States
    const [history, setHistory] = useState<CargoManifest[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Load History on Mount
    useEffect(() => {
        loadHistoryList();
    }, []);

    const loadHistoryList = async () => {
        setLoadingHistory(true);
        try {
            const list = await getManifests();
            setHistory(list);
        } catch (e) {
            console.error('Failed to load manifest history:', e);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Calculate totals
    const totalKoli = useMemo(() => items.reduce((sum, item) => sum + (Number(item.koli) || 0), 0), [items]);
    const totalBerat = useMemo(() => items.reduce((sum, item) => sum + (Number(item.berat) || 0), 0), [items]);

    // Add empty row
    const handleAddRow = () => {
        const newItem: ManifestItem = {
            noSTT: '',
            koli: 0,
            berat: 0,
            isiBarang: '',
            pengirim: '',
            penerima: '',
            keterangan: ''
        };
        setItems(prev => [...prev, newItem]);
        setErrors([]);
    };

    // Remove row
    const handleRemoveRow = (index: number) => {
        setItems(prev => prev.filter((_, idx) => idx !== index));
    };

    // Update row cell values
    const handleCellChange = (index: number, field: keyof ManifestItem, value: any) => {
        setItems(prev => prev.map((item, idx) => {
            if (idx === index) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    // Single STT Auto-Lookup inside the row
    const handleSTTLookup = async (index: number, noSTT: string) => {
        if (!noSTT || noSTT.trim() === '') return;
        setSearchLoadingIdx(index);
        setSttSearchAlert(null);
        try {
            const transaction = await getTransactionBySTT(noSTT);
            if (transaction) {
                setItems(prev => prev.map((item, idx) => {
                    if (idx === index) {
                        return {
                            ...item,
                            noSTT: transaction.noSTT,
                            koli: transaction.koli || 0,
                            berat: transaction.berat || 0,
                            isiBarang: transaction.isiBarang || '',
                            pengirim: transaction.pengirimName || '',
                            penerima: transaction.penerimaName || '',
                            keterangan: transaction.keterangan || ''
                        };
                    }
                    return item;
                }));
                setSttSearchAlert({
                    idx: index,
                    message: `STT ${transaction.noSTT} ditemukan!`,
                    type: 'success'
                });
                setTimeout(() => setSttSearchAlert(null), 3000);
            } else {
                setSttSearchAlert({
                    idx: index,
                    message: `STT "${noSTT}" tidak ditemukan di database.`,
                    type: 'error'
                });
                setTimeout(() => setSttSearchAlert(null), 4000);
            }
        } catch (e) {
            console.error(e);
            setSttSearchAlert({
                idx: index,
                message: 'Error mencari STT.',
                type: 'error'
            });
        } finally {
            setSearchLoadingIdx(null);
        }
    };

    // Open Bulk Import Modal and fetch recent transactions
    const handleOpenImportModal = async () => {
        setIsImportModalOpen(true);
        setLoadingTx(true);
        try {
            // Fetch recent 100 transactions
            const q = query(
                collection(db, 'transactions'),
                orderBy('createdAt', 'desc'),
                limit(100)
            );
            const snapshot = await getDocs(q);
            const txs: Transaction[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Transaction));
            
            // Filter only transactions that are not completed / cancelled, or just let users choose from pending
            setImportTransactions(txs);
            setSelectedTxIds(new Set());
        } catch (e) {
            console.error('Error fetching transactions for import:', e);
            alert('Gagal mengambil daftar transaksi.');
        } finally {
            setLoadingTx(false);
        }
    };

    // Toggle transaction selection
    const handleToggleSelectTx = (id: string) => {
        setSelectedTxIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Import selected transactions into table
    const handleImportSelected = () => {
        const selectedTxs = importTransactions.filter(tx => selectedTxIds.has(tx.id));
        if (selectedTxs.length === 0) {
            setIsImportModalOpen(false);
            return;
        }

        const newItems: ManifestItem[] = selectedTxs.map(tx => ({
            noSTT: tx.noSTT,
            koli: tx.koli || 0,
            berat: tx.berat || 0,
            isiBarang: tx.isiBarang || '',
            pengirim: tx.pengirimName || '',
            penerima: tx.penerimaName || '',
            keterangan: tx.keterangan || ''
        }));

        setItems(prev => {
            // Remove completely empty rows if they exist at the end
            const cleanPrev = prev.filter(item => item.noSTT.trim() !== '' || item.pengirim !== '');
            return [...cleanPrev, ...newItems];
        });

        setIsImportModalOpen(false);
        alert(`Berhasil mengimport ${selectedTxs.length} transaksi ke manifest!`);
    };

    // Reset Form
    const handleReset = () => {
        if (confirm('Apakah Anda yakin ingin mereset form manifest ini?')) {
            const today = new Date();
            setTanggal(today.toISOString().split('T')[0]);
            setKapal('');
            setNopol('');
            setSopir('');
            setKepadaYth(DEFAULT_KEPADA);
            setItems([]);
            setSavedId(null);
            setErrors([]);
        }
    };

    // Save Manifest to Firestore
    const handleSave = async () => {
        setErrors([]);
        const newErrors = [];
        if (!tanggal) newErrors.push('Tanggal manifest wajib diisi');
        if (!kapal.trim()) newErrors.push('Nama Kapal wajib diisi');
        if (items.length === 0) newErrors.push('Manifest harus memiliki minimal 1 baris barang');

        // Check if any row has empty STT number
        const hasEmptySTT = items.some(item => !item.noSTT || item.noSTT.trim() === '');
        if (hasEmptySTT) newErrors.push('Semua baris barang wajib memiliki nomor STT');

        if (newErrors.length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSaving(true);
        try {
            const manifestData = {
                tanggal,
                kapal: kapal.trim(),
                nopol: nopol.trim(),
                sopir: sopir.trim(),
                kepadaYth: kepadaYth.trim() || DEFAULT_KEPADA,
                items,
                createdBy: user?.uid || '',
                createdByName: user?.displayName || user?.email || '',
            };

            if (savedId) {
                await updateManifest(savedId, manifestData);
                setSaveSuccess(true);
            } else {
                const newId = await createManifest(user?.uid || '', manifestData);
                setSavedId(newId);
                setSaveSuccess(true);
            }
            loadHistoryList();
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            console.error('Failed to save manifest:', e);
            alert('Gagal menyimpan manifest. Coba lagi.');
        } finally {
            setIsSaving(false);
        }
    };

    // Load saved manifest from history
    const handleLoadManifest = (manifest: CargoManifest) => {
        setSavedId(manifest.id || null);
        setTanggal(manifest.tanggal);
        setKapal(manifest.kapal);
        setNopol(manifest.nopol || '');
        setSopir(manifest.sopir || '');
        setKepadaYth(manifest.kepadaYth || DEFAULT_KEPADA);
        setItems(manifest.items || []);
        setShowHistory(false);
        setErrors([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Delete manifest from history
    const handleDeleteManifest = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Apakah Anda yakin ingin menghapus dokumen manifest ini secara permanen?')) return;
        try {
            await deleteManifest(id);
            loadHistoryList();
            if (savedId === id) {
                setSavedId(null);
            }
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus manifest.');
        }
    };

    // Print Manifest
    const handlePrint = () => {
        if (items.length === 0) {
            alert('Manifest kosong. Harap tambahkan barang sebelum mencetak.');
            return;
        }
        
        try {
            const printData = {
                tanggal,
                kapal,
                nopol,
                sopir,
                kepadaYth: kepadaYth || DEFAULT_KEPADA,
                items
            };
            sessionStorage.setItem('cce_print_manifest', JSON.stringify(printData));
            router.push('/tools/manifest/print');
        } catch (e) {
            console.error('Failed to save print session to sessionStorage:', e);
            alert('Gagal membuka halaman cetak.');
        }
    };

    // Filter transactions in bulk import modal
    const filteredTxs = useMemo(() => {
        if (!txFilter.trim()) return importTransactions;
        const term = txFilter.toLowerCase().trim();
        return importTransactions.filter(tx => 
            tx.noSTT.toLowerCase().includes(term) ||
            tx.pengirimName.toLowerCase().includes(term) ||
            tx.penerimaName.toLowerCase().includes(term) ||
            tx.tujuan.toLowerCase().includes(term) ||
            (tx.isiBarang && tx.isiBarang.toLowerCase().includes(term))
        );
    }, [importTransactions, txFilter]);

    return (
        <RouteGuard module="manifest">
            <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-500">
                {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                        <Ship className="text-blue-600" size={32} />
                        Manifest Cargo
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Buat, kelola, dan cetak manifest pengapalan & armada</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-sm font-semibold transition-all shadow-sm"
                    >
                        <ArrowLeft size={16} /> Beranda
                    </button>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                            showHistory 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
                        }`}
                    >
                        <FileText size={16} /> {showHistory ? 'Tutup Riwayat' : 'Lihat Riwayat'}
                    </button>
                </div>
            </div>

            {/* History Section View */}
            {showHistory && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 animate-in slide-in-from-top-2">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <FileText className="text-blue-600" size={20} />
                        Riwayat Manifest Cargo
                    </h3>

                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-blue-600" size={32} />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            Belum ada dokumen manifest yang disimpan.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-bold">
                                        <th className="py-3 px-4">Tanggal</th>
                                        <th className="py-3 px-4">Kapal</th>
                                        <th className="py-3 px-4">Nopol / Sopir</th>
                                        <th className="py-3 px-4">Tujuan</th>
                                        <th className="py-3 px-4 text-center">Koli</th>
                                        <th className="py-3 px-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {history.map((manifest) => (
                                        <tr 
                                            key={manifest.id} 
                                            onClick={() => handleLoadManifest(manifest)}
                                            className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                                        >
                                            <td className="py-3 px-4 font-semibold text-gray-800">
                                                {new Date(manifest.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="py-3 px-4 font-medium text-gray-700">{manifest.kapal}</td>
                                            <td className="py-3 px-4 text-gray-600">
                                                {manifest.nopol || '-'} • {manifest.sopir || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-gray-600">{manifest.kepadaYth}</td>
                                            <td className="py-3 px-4 text-center font-bold text-gray-800">
                                                {manifest.items?.reduce((sum, item) => sum + (item.koli || 0), 0) || 0}
                                            </td>
                                            <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                const printData = {
                                                                    tanggal: manifest.tanggal,
                                                                    kapal: manifest.kapal,
                                                                    nopol: manifest.nopol || '',
                                                                    sopir: manifest.sopir || '',
                                                                    kepadaYth: manifest.kepadaYth || DEFAULT_KEPADA,
                                                                    items: manifest.items || []
                                                                };
                                                                sessionStorage.setItem('cce_print_manifest', JSON.stringify(printData));
                                                                window.open('/tools/manifest/print', '_blank');
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert('Gagal mencetak manifest.');
                                                            }
                                                        }}
                                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Cetak PDF"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteManifest(manifest.id!, e)}
                                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Hapus manifest"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Main Form Block */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Side: Header Form */}
                <div className="lg:col-span-8 bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden space-y-6">
                    <div className="flex items-center justify-between border-b pb-4">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <FileText className="text-blue-600" size={22} />
                            {savedId ? 'Edit Dokumen Manifest' : 'Buat Manifest Baru'}
                        </h3>
                        {savedId && (
                            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full font-bold">
                                Terload — ID: {savedId.slice(-6)}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tanggal */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tanggal Berangkat *</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Calendar size={18} />
                                </div>
                                <input
                                    type="date"
                                    value={tanggal}
                                    onChange={(e) => setTanggal(e.target.value)}
                                    className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-sm"
                                />
                            </div>
                        </div>

                        {/* Nama Kapal */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Kapal Laut / Penyeberangan *</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Ship size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={kapal}
                                    onChange={(e) => setKapal(e.target.value)}
                                    placeholder="Contoh: DkF VII, Meratus 2"
                                    className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-sm"
                                />
                            </div>
                        </div>

                        {/* Nopol Kendaraan */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nopol Mobil / Truk</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Truck size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={nopol}
                                    onChange={(e) => setNopol(e.target.value)}
                                    placeholder="Contoh: DD 8951 SW"
                                    className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-sm"
                                />
                            </div>
                        </div>

                        {/* Sopir */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nama Sopir / No. HP</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={sopir}
                                    onChange={(e) => setSopir(e.target.value)}
                                    placeholder="Contoh: Aswar / 0852-5559-8847"
                                    className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-sm"
                                />
                            </div>
                        </div>

                        {/* Kepada Yth (Tujuan Agen) */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tujuan Penyerahan (Kepada Yth)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Users size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={kepadaYth}
                                    onChange={(e) => setKepadaYth(e.target.value)}
                                    placeholder="Contoh: CAHAYA CARGO EXP MKS"
                                    className="pl-10 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Totals & Commands */}
                <div className="lg:col-span-4 bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl p-6 text-white shadow-lg space-y-6">
                    <h3 className="font-extrabold text-lg tracking-tight border-b border-white/10 pb-3">Ringkasan Manifest</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/10 p-3.5 rounded-xl border border-white/5">
                            <p className="text-[10px] uppercase font-bold text-blue-200">Total Koli</p>
                            <p className="text-2xl font-black mt-1">{totalKoli} <span className="text-xs font-bold text-blue-200">pcs</span></p>
                        </div>
                        <div className="bg-white/10 p-3.5 rounded-xl border border-white/5">
                            <p className="text-[10px] uppercase font-bold text-blue-200">Total Berat</p>
                            <p className="text-2xl font-black mt-1">{totalBerat} <span className="text-xs font-bold text-blue-200">kg</span></p>
                        </div>
                        <div className="bg-white/10 p-3.5 rounded-xl border border-white/5 col-span-2">
                            <p className="text-[10px] uppercase font-bold text-blue-200">Jumlah STT Muatan</p>
                            <p className="text-2xl font-black mt-1">{items.length} <span className="text-xs font-bold text-blue-200">Baris</span></p>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        {saveSuccess && (
                            <div className="flex items-center gap-1.5 text-xs text-green-300 font-bold bg-green-500/10 border border-green-500/20 p-2 rounded-lg justify-center">
                                <CheckCircle size={14} /> Berhasil disimpan ke database!
                            </div>
                        )}
                        
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
                        >
                            <Save size={16} /> {isSaving ? 'Menyimpan...' : (savedId ? 'Update Manifest' : 'Simpan Manifest')}
                        </button>
                        
                        <button
                            onClick={handlePrint}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-95"
                        >
                            <Printer size={16} /> Cetak PDF
                        </button>

                        <button
                            onClick={handleReset}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-red-500/20 text-white rounded-xl font-bold text-sm transition-all border border-white/10"
                        >
                            <RotateCcw size={16} /> Reset Form
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Notifications */}
            {errors.length > 0 && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 animate-in slide-in-from-top-2">
                    <p className="font-bold mb-1.5 text-sm">Kesalahan Pengisian:</p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                        {errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                </div>
            )}

            {/* Interactive Items Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                        <FileText size={18} className="text-blue-600" />
                        Daftar Cargo STT ({items.length})
                    </h3>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleOpenImportModal}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-550 hover:bg-indigo-650 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                            <Plus size={14} /> Bulk Import STT
                        </button>
                        <button
                            onClick={handleAddRow}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                            <Plus size={14} /> Tambah Baris Manual
                        </button>
                    </div>
                </div>

                {/* Table Layout */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-gray-100/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                                <th className="py-3 px-3 text-center w-12">No</th>
                                <th className="py-3 px-3 w-40">No. STT</th>
                                <th className="py-3 px-3 w-20 text-center">Koli</th>
                                <th className="py-3 px-3 w-24 text-center">Berat (kg)</th>
                                <th className="py-3 px-3">Isi Barang</th>
                                <th className="py-3 px-3">Pengirim</th>
                                <th className="py-3 px-3">Penerima</th>
                                <th className="py-3 px-3">Keterangan</th>
                                <th className="py-3 px-3 text-center w-12">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150 bg-white">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-8 text-center text-gray-400 font-medium bg-gray-50/20">
                                        Form manifest masih kosong. Klik "Bulk Import STT" atau "Tambah Baris Manual" untuk memulai.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item, index) => (
                                    <tr key={index} className="hover:bg-blue-50/20 transition-colors">
                                        <td className="py-3 px-3 text-center font-bold text-gray-500 bg-gray-50/50">
                                            {index + 1}
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={item.noSTT}
                                                    onChange={(e) => handleCellChange(index, 'noSTT', e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSTTLookup(index, item.noSTT);
                                                        }
                                                    }}
                                                    className="w-full pl-2 pr-8 py-1.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500 font-mono font-bold"
                                                    placeholder="Contoh: 18412"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSTTLookup(index, item.noSTT)}
                                                    disabled={searchLoadingIdx === index}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                                                    title="Cari STT di Database"
                                                >
                                                    {searchLoadingIdx === index ? (
                                                        <Loader2 size={13} className="animate-spin" />
                                                    ) : (
                                                        <Search size={13} />
                                                    )}
                                                </button>
                                            </div>
                                            {sttSearchAlert && sttSearchAlert.idx === index && (
                                                <span className={`block text-[10px] mt-1 font-semibold ${
                                                    sttSearchAlert.type === 'success' ? 'text-green-600' : 'text-red-500'
                                                }`}>
                                                    {sttSearchAlert.message}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="number"
                                                value={item.koli || ''}
                                                onChange={(e) => handleCellChange(index, 'koli', parseInt(e.target.value) || 0)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-center outline-none focus:border-blue-500 font-bold"
                                                placeholder="0"
                                                min="0"
                                            />
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="number"
                                                value={item.berat || ''}
                                                onChange={(e) => handleCellChange(index, 'berat', parseFloat(e.target.value) || 0)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-center outline-none focus:border-blue-500 font-bold"
                                                placeholder="0.0"
                                                min="0"
                                                step="0.01"
                                            />
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="text"
                                                value={item.isiBarang}
                                                onChange={(e) => handleCellChange(index, 'isiBarang', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                                placeholder="Isi Paket"
                                            />
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="text"
                                                value={item.pengirim}
                                                onChange={(e) => handleCellChange(index, 'pengirim', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                                placeholder="Nama Pengirim"
                                            />
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="text"
                                                value={item.penerima}
                                                onChange={(e) => handleCellChange(index, 'penerima', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                                placeholder="Nama Penerima"
                                            />
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <input
                                                type="text"
                                                value={item.keterangan}
                                                onChange={(e) => handleCellChange(index, 'keterangan', e.target.value)}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                                                placeholder="Catatan"
                                            />
                                        </td>
                                        <td className="py-2.5 px-2 text-center">
                                            <button
                                                onClick={() => handleRemoveRow(index)}
                                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Hapus baris"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bulk Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                    <Users className="text-blue-600" size={22} />
                                    Import Transaksi Masal (Pending / Unpaid)
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">Pilih transaksi yang ingin dimasukkan ke manifest keberangkatan</p>
                            </div>
                            <button
                                onClick={() => setIsImportModalOpen(false)}
                                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search Filter Bar */}
                        <div className="p-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Filter size={16} />
                                </div>
                                <input
                                    type="text"
                                    value={txFilter}
                                    onChange={(e) => setTxFilter(e.target.value)}
                                    placeholder="Filter berdasarkan No STT, Pengirim, Penerima, atau Tujuan..."
                                    className="pl-9 w-full px-4 py-2 border border-gray-300 rounded-xl outline-none focus:border-blue-500 text-sm"
                                />
                            </div>
                        </div>

                        {/* Content Scroll Area */}
                        <div className="overflow-y-auto p-4 flex-1">
                            {loadingTx ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="animate-spin text-blue-600" size={32} />
                                </div>
                            ) : filteredTxs.length === 0 ? (
                                <div className="text-center py-20 text-gray-400 text-sm">
                                    Tidak ada transaksi pending ditemukan.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {filteredTxs.map((tx) => {
                                        const isSelected = selectedTxIds.has(tx.id);
                                        return (
                                            <div
                                                key={tx.id}
                                                onClick={() => handleToggleSelectTx(tx.id)}
                                                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                                                    isSelected
                                                        ? 'bg-blue-50 border-blue-500 shadow-sm'
                                                        : 'bg-white hover:bg-gray-50 border-gray-200'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}} // handled by parent div onClick
                                                    className="mt-1 shrink-0 rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="text-xs space-y-1.5 flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-[10px]">
                                                            {tx.noSTT}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 font-semibold bg-gray-50 px-1.5 py-0.5 rounded border border-gray-150">
                                                            {tx.tujuan}
                                                        </span>
                                                    </div>
                                                    <div className="truncate">
                                                        <span className="font-bold text-gray-800">Sender:</span> {tx.pengirimName}
                                                    </div>
                                                    <div className="truncate">
                                                        <span className="font-bold text-gray-800">Receiver:</span> {tx.penerimaName}
                                                    </div>
                                                    <div className="flex gap-3 text-[10px] font-bold text-gray-600 border-t border-gray-100 pt-1.5 mt-1.5">
                                                        <span>Koli: {tx.koli} koli</span>
                                                        <span>Berat: {tx.berat} kg</span>
                                                        <span className="text-indigo-600 italic font-normal truncate">
                                                            {tx.isiBarang || 'Tanpa isi'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-600">
                                {selectedTxIds.size} Transaksi Terpilih
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-100 text-gray-700 text-sm font-semibold transition-all"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleImportSelected}
                                    disabled={selectedTxIds.size === 0}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    Import Terpilih
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </RouteGuard>
    );
}
