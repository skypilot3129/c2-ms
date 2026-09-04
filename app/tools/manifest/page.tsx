'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import RouteGuard from '@/components/RouteGuard';
import { 
    Ship, Truck, Calendar, User, Users, FileText, ArrowLeft, 
    Plus, Trash2, Printer, Save, RotateCcw, Search, 
    CheckCircle, AlertCircle, Loader2, Play, ChevronDown, ChevronUp, X, Filter,
    Sparkles, RefreshCw, Layers
} from 'lucide-react';
import { getTransactionBySTT } from '@/lib/firestore-transactions';
import { 
    createManifest, getManifests, updateManifest, deleteManifest, subscribeToManifests 
} from '@/lib/firestore-manifests';
import type { CargoManifest, ManifestItem, ManifestRowColor } from '@/types/manifest';
import type { Transaction } from '@/types/transaction';
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DEFAULT_KEPADA = 'CAHAYA CARGO EXP MKS';

const COLOR_OPTIONS: { value: ManifestRowColor; label: string; bgClass: string; borderClass: string }[] = [
    { value: 'white', label: 'Putih (Biasa)', bgClass: 'bg-white', borderClass: 'border-gray-300' },
    { value: 'yellow', label: 'Kuning (Prioritas/Cabang)', bgClass: 'bg-yellow-100', borderClass: 'border-yellow-400' },
    { value: 'purple', label: 'Ungu (Lunas/Motor)', bgClass: 'bg-purple-100', borderClass: 'border-purple-400' },
    { value: 'green', label: 'Hijau (Khusus)', bgClass: 'bg-green-100', borderClass: 'border-green-400' },
    { value: 'blue', label: 'Biru (Transfer)', bgClass: 'bg-blue-100', borderClass: 'border-blue-400' },
    { value: 'red', label: 'Merah (Penting/Urgent)', bgClass: 'bg-red-100', borderClass: 'border-red-400' },
];

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
    const [errors, setErrors] = useState<string[]>([]);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const [searchLoadingIdx, setSearchLoadingIdx] = useState<number | null>(null);

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

    // Toast Notification helper
    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToastMessage(message);
        setToastType(type);
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Realtime subscription to manifest history
    useEffect(() => {
        setLoadingHistory(true);
        const unsubscribe = subscribeToManifests((list) => {
            setHistory(list);
            setLoadingHistory(false);
        });

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, []);

    const refreshHistory = async () => {
        setLoadingHistory(true);
        try {
            const list = await getManifests();
            setHistory(list);
            showToast('Riwayat manifes diperbarui', 'success');
        } catch (e: any) {
            console.error('Failed to load manifest history:', e);
            showToast('Gagal memuat riwayat: ' + (e?.message || ''), 'error');
        } finally {
            setLoadingHistory(false);
        }
    };

    // Calculate totals
    const totalKoli = useMemo(() => items.reduce((sum, item) => sum + (Number(item.koli) || 0), 0), [items]);
    const totalBerat = useMemo(() => {
        return items.reduce((sum, item) => {
            if (typeof item.berat === 'number') return sum + item.berat;
            const parsed = parseFloat(String(item.berat || '').replace(/\./g, '').replace(',', '.'));
            return sum + (isNaN(parsed) ? 0 : parsed);
        }, 0);
    }, [items]);

    // Load sample preset manifest
    const handleLoadSampleManifest = () => {
        if (items.length > 0 && !confirm('Muat contoh data Daftar Cargo Manifes Cahaya Cargo Express? Data di formulir saat ini akan digantikan.')) {
            return;
        }
        setTanggal('KAMIS - 23 JULI 2026');
        setKapal('DKC-7');
        setNopol('B 9876 CCE');
        setSopir('AGUNG , ADI');
        setKepadaYth('CAHAYA CARGO EXP MKS');

        setItems([
            { noSTT: '1433', koli: 4, berat: 381, pengirim: 'AGUS SALIM', penerima: 'AGUS SALIM', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1434', koli: 1, berat: 130, pengirim: 'BU NITA / AA', penerima: 'EXP BINTANG MURA', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1435', koli: 2, berat: 84.7, pengirim: 'PB COLLECTION', penerima: 'IRHAM', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1436', koli: 1, berat: 50, pengirim: 'WACHID', penerima: 'RIO', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1437', koli: 5, berat: 253.9, pengirim: 'P.INDRA', penerima: 'EXP CAHAYA ILAHI', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1438', koli: 19, berat: 592.5, pengirim: 'AMURA', penerima: 'LAPAS MAKASAR', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1439', koli: 12, berat: 200, pengirim: 'MLA', penerima: 'MENTARI', isiBarang: 'DUZ', alamat: 'SEMARANG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18825', koli: 2, berat: '', pengirim: 'BP MUJIB', penerima: 'BP MUJIB', isiBarang: 'MOTOR', alamat: 'SURABAYA - SEMARANG', keterangan: 'LUNAS', color: 'purple' },
            { noSTT: '18826', koli: 385, berat: '5.192,99', pengirim: 'DHS', penerima: 'SPX MAROS', isiBarang: 'SHOPEE', alamat: 'MAROS', keterangan: 'AGUNG', color: 'yellow' },
            { noSTT: '18827', koli: 351, berat: '7.109,60', pengirim: 'DHS', penerima: 'SPX TAMALANREA', isiBarang: 'SHOPEE', alamat: 'MAKASAR', keterangan: 'AGUNG', color: 'yellow' },
            { noSTT: '18828', koli: 1460, berat: '14.851,94', pengirim: 'DHS', penerima: 'SPX TAMALANREA', isiBarang: 'SHOPEE', alamat: 'MAKASAR', keterangan: 'ADI', color: 'yellow' },
            { noSTT: '18829', koli: 1, berat: '', pengirim: 'BP PUR', penerima: 'P TEDY', isiBarang: 'PETI', alamat: 'MAKASAR', keterangan: 'MOBIL ADI', color: 'white' },
            { noSTT: '18830', koli: 5, berat: '882 KV', pengirim: 'MARGITRANS', penerima: 'KHARLEN KRISTO', isiBarang: 'PETI', alamat: 'JL BONTO LEMPANGAN - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18831', koli: 3, berat: 54.4, pengirim: 'MARGITRANS', penerima: 'ROCK N ROLL', isiBarang: 'CAMPURAN', alamat: 'BAU - BAU', keterangan: '', color: 'yellow' },
            { noSTT: '18832', koli: 6, berat: 90, pengirim: 'MARGITRANS', penerima: 'ROBIN CUESTA', isiBarang: 'DUZ', alamat: 'BAU - BAU', keterangan: '', color: 'yellow' },
            { noSTT: '18833', koli: 1, berat: 11, pengirim: 'ERS CARGO', penerima: 'MMA', isiBarang: 'DUZ', alamat: 'PERGUDANGAN PARANGLOE - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18834', koli: 1, berat: 1, pengirim: 'BP HENDRA', penerima: 'WIZMIE TODDOPULI', isiBarang: 'GNTUNGAN KUCI', alamat: 'JL TODDOPULI RAYA - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18835', koli: 1, berat: 1.5, pengirim: 'BP HENDRA', penerima: 'WIZMIE MAPPAODANG', isiBarang: 'GNTUNGAN KUCI', alamat: 'JL ANDI MAPPAODANG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18836', koli: 1, berat: 1, pengirim: 'BP HENDRA', penerima: 'WIZMIE MAROS', isiBarang: 'GNTUNGAN KUCI', alamat: 'ANTAR KE OTLET WIZMIE MAROS', keterangan: '', color: 'yellow' },
            { noSTT: '18837', koli: 1, berat: '', pengirim: 'PT BUKIT KARYA. L', penerima: 'PT SINAR NIAGA. S', isiBarang: 'PETI', alamat: 'JL KIMA 5 - MAKASAR', keterangan: 'TIMBG DULU', color: 'white' },
            { noSTT: '18838', koli: 4, berat: 253.64, pengirim: 'KNITO', penerima: 'IMAM BONE', isiBarang: 'GARMEN', alamat: '( SBY) - JL KAPOPOSAN - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18839', koli: 11, berat: 92.6, pengirim: 'ERS CARGO', penerima: 'XPDISI PELITA', isiBarang: 'CAMPURAN', alamat: 'JL GUNUNG LOMPO - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18840', koli: 9, berat: 316, pengirim: 'SOLATA', penerima: 'REY XPRESS', isiBarang: 'BRG PINDAHAN', alamat: 'JL CAKALANG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18841', koli: 1, berat: 7.8, pengirim: 'DWIMA', penerima: 'CV MKS SAFARI', isiBarang: 'MKN KCING', alamat: 'JL VETERAN SLATAN - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18842', koli: 2, berat: 41.1, pengirim: 'DWIMA', penerima: 'CV AMIGOS', isiBarang: 'MKN KCING', alamat: 'JL TUPAI NO 89 - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18843', koli: 3, berat: 178, pengirim: 'TSL', penerima: 'TANGAN RAHMAT TRANS', isiBarang: 'GARMEN', alamat: 'JL SULTAN ABDUL RAYA - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18844', koli: 533, berat: '6.154,19', pengirim: 'DHS', penerima: 'SPX MAROS', isiBarang: 'SHOPEE', alamat: 'MAROS', keterangan: 'P. SYAM', color: 'white' },
            { noSTT: '18845', koli: 90, berat: 2250, pengirim: 'P. PARMIN', penerima: 'CELLI SULAWESI', isiBarang: 'BBT/ TAJUK', alamat: 'MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '18846', koli: 42, berat: '', pengirim: 'PT PENTAWIRA', penerima: 'PT PENTAWIRA', isiBarang: '', alamat: 'KONAWE', keterangan: '', color: 'white' }
        ]);
        setSavedId(null);
        setErrors([]);
        showToast('Contoh manifes kapal DKC-7 berhasil dimuat!', 'success');
    };

    // Add empty row
    const handleAddRow = () => {
        const newItem: ManifestItem = {
            noSTT: '',
            koli: 0,
            berat: 0,
            isiBarang: '',
            pengirim: '',
            penerima: '',
            alamat: '',
            keterangan: '',
            color: 'white'
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
        setItems(prev => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
    };

    // Lookup STT from transactions collection
    const handleSTTLookup = async (index: number, noSTT: string) => {
        const cleanSTT = String(noSTT || '').trim();
        if (!cleanSTT) return;
        setSearchLoadingIdx(index);
        try {
            const transaction = await getTransactionBySTT(cleanSTT);
            if (transaction) {
                setItems(prev => prev.map((item, idx) => {
                    if (idx === index) {
                        return {
                            ...item,
                            noSTT: transaction.noSTT,
                            koli: transaction.koli || 0,
                            berat: transaction.berat || 0,
                            isiBarang: transaction.isiBarang || item.isiBarang || '',
                            pengirim: transaction.pengirimName || item.pengirim || '',
                            penerima: transaction.penerimaName || item.penerima || '',
                            alamat: transaction.penerimaAddress || (transaction.tujuan ? `SURABAYA - ${transaction.tujuan.toUpperCase()}` : item.alamat || ''),
                            keterangan: transaction.keterangan || item.keterangan || '',
                            color: item.color || 'white'
                        };
                    }
                    return item;
                }));
                showToast(`Data STT ${cleanSTT} ditemukan!`, 'success');
            } else {
                showToast(`STT ${cleanSTT} tidak ditemukan di sistem transaksi.`, 'error');
            }
        } catch (e: any) {
            console.error('STT Lookup error:', e);
            showToast(`Gagal mencari STT: ${e?.message || ''}`, 'error');
        } finally {
            setSearchLoadingIdx(null);
        }
    };

    const handleOpenImportModal = async () => {
        setIsImportModalOpen(true);
        setLoadingTx(true);
        try {
            const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(150));
            const snapshot = await getDocs(q);
            setImportTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
            setSelectedTxIds(new Set());
        } catch (err: any) {
            console.error('Error fetching transactions for import:', err);
            showToast('Gagal memuat transaksi: ' + (err?.message || ''), 'error');
        } finally {
            setLoadingTx(false);
        }
    };

    const handleImportSelected = () => {
        const newItems: ManifestItem[] = importTransactions
            .filter(tx => selectedTxIds.has(tx.id))
            .map(tx => ({
                noSTT: tx.noSTT,
                koli: tx.koli || 0,
                berat: tx.berat || 0,
                isiBarang: tx.isiBarang || '',
                pengirim: tx.pengirimName || '',
                penerima: tx.penerimaName || '',
                alamat: tx.penerimaAddress || (tx.tujuan ? `SURABAYA - ${tx.tujuan.toUpperCase()}` : ''),
                keterangan: tx.keterangan || '',
                color: 'white'
            }));
        setItems(prev => [...prev.filter(item => item.noSTT.trim() !== ''), ...newItems]);
        setIsImportModalOpen(false);
        showToast(`${newItems.length} transaksi berhasil diimport ke tabel manifes!`, 'success');
    };

    const handleResetForm = () => {
        if (items.length > 0 && !confirm('Kosongkan formulir untuk membuat manifes baru?')) {
            return;
        }
        const today = new Date();
        setTanggal(today.toISOString().split('T')[0]);
        setKapal('');
        setNopol('');
        setSopir('');
        setKepadaYth(DEFAULT_KEPADA);
        setItems([]);
        setSavedId(null);
        setErrors([]);
        showToast('Formulir berhasil direset. Siap membuat manifes baru.', 'success');
    };

    // Save or Update Manifest in Firestore
    const handleSave = async (forceNew: boolean = false) => {
        setErrors([]);
        const trimmedTanggal = tanggal.trim();
        const trimmedKapal = kapal.trim();

        const validationErrors: string[] = [];
        if (!trimmedTanggal) validationErrors.push('Tanggal Berangkat wajib diisi.');
        if (!trimmedKapal) validationErrors.push('Nama Kapal wajib diisi.');
        if (items.length === 0) validationErrors.push('Daftar item manifes masih kosong. Tambahkan minimal 1 baris.');

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            showToast(validationErrors[0], 'error');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                tanggal: trimmedTanggal,
                kapal: trimmedKapal,
                nopol: nopol.trim(),
                sopir: sopir.trim(),
                kepadaYth: kepadaYth.trim() || DEFAULT_KEPADA,
                items,
                createdBy: user?.uid || 'user',
                createdByName: user?.displayName || user?.email || 'Admin',
            };

            if (savedId && !forceNew) {
                await updateManifest(savedId, payload);
                showToast(`Manifes kapal "${trimmedKapal}" berhasil diperbarui di database!`, 'success');
            } else {
                const newId = await createManifest(user?.uid || '', payload);
                setSavedId(newId);
                showToast(`Manifes kapal "${trimmedKapal}" berhasil disimpan ke database!`, 'success');
            }
        } catch (err: any) {
            console.error('Error saving manifest:', err);
            const msg = err?.message || 'Terjadi kesalahan saat menyimpan ke database';
            setErrors([msg]);
            showToast(`Gagal menyimpan: ${msg}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Delete Manifest from Firestore
    const handleDelete = async (id: string, shipName: string) => {
        if (!confirm(`Hapus manifes kapal "${shipName}" dari database? Data yang dihapus tidak dapat dikembalikan.`)) {
            return;
        }
        try {
            await deleteManifest(id);
            if (savedId === id) {
                setSavedId(null);
            }
            showToast(`Manifes kapal "${shipName}" berhasil dihapus dari database.`, 'success');
        } catch (err: any) {
            console.error('Error deleting manifest:', err);
            showToast(`Gagal menghapus: ${err?.message || 'Terjadi kesalahan'}`, 'error');
        }
    };

    const handleLoadManifest = (m: CargoManifest) => {
        setSavedId(m.id || null);
        setTanggal(m.tanggal);
        setKapal(m.kapal);
        setNopol(m.nopol || '');
        setSopir(m.sopir || '');
        setKepadaYth(m.kepadaYth || DEFAULT_KEPADA);
        setItems(m.items || []);
        setShowHistory(false);
        setErrors([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast(`Manifes kapal "${m.kapal}" (${m.items?.length || 0} resi) berhasil dimuat.`, 'success');
    };

    const handlePrint = () => {
        if (items.length === 0) {
            showToast('Tambahkan minimal 1 item sebelum mencetak PDF.', 'error');
            return;
        }
        sessionStorage.setItem('cce_print_manifest', JSON.stringify({
            tanggal,
            kapal,
            nopol,
            sopir,
            kepadaYth,
            items,
            orientation: 'landscape'
        }));
        router.push('/tools/manifest/print');
    };

    const filteredTxs = useMemo(() => {
        if (!txFilter.trim()) return importTransactions;
        const q = txFilter.toLowerCase();
        return importTransactions.filter(tx => 
            tx.noSTT?.toLowerCase().includes(q) || 
            tx.pengirimName?.toLowerCase().includes(q) ||
            tx.penerimaName?.toLowerCase().includes(q)
        );
    }, [importTransactions, txFilter]);

    return (
        <ProtectedRoute>
            <RouteGuard module="manifest">
                <div className="space-y-6 max-w-[96rem] mx-auto pb-16 animate-in fade-in duration-300">
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                                <span className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                                    <Ship size={28} />
                                </span>
                                Daftar Cargo Manifes
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">
                                Modul Input Data & Cetak Manifes Pengapalan (Format Official Excel CCE)
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            <button 
                                onClick={handleLoadSampleManifest} 
                                className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95"
                                title="Muat format manifes contoh resmi CCE"
                            >
                                <Sparkles size={16} /> Muat Contoh CCE
                            </button>
                            <button 
                                onClick={handleResetForm} 
                                className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm"
                                title="Kosongkan formulir untuk manifes baru"
                            >
                                <RotateCcw size={15} /> Manifes Baru
                            </button>
                            <button 
                                onClick={() => router.push('/')} 
                                className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm"
                            >
                                <ArrowLeft size={16} /> Beranda
                            </button>
                            <button 
                                onClick={() => setShowHistory(!showHistory)} 
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ${
                                    showHistory 
                                        ? 'bg-blue-600 text-white shadow-blue-200' 
                                        : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
                                }`}
                            >
                                <FileText size={16} /> 
                                {showHistory ? 'Tutup Riwayat' : `Riwayat (${history.length})`}
                            </button>
                        </div>
                    </div>

                    {/* Active Saved Document Indicator Banner */}
                    {savedId && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-900 shadow-sm animate-in fade-in">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                                    <CheckCircle size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">
                                        Sedang Mengedit Manifes Tersimpan: <span className="underline">{kapal || 'Tanpa Kapal'}</span> ({tanggal})
                                    </p>
                                    <p className="text-xs text-emerald-700">
                                        ID Dokumen: <span className="font-mono">{savedId}</span> • Klik &quot;Simpan Perubahan&quot; untuk memperbarui atau &quot;Simpan Sebagai Baru&quot; untuk menduplikasi.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleSave(false)}
                                    disabled={isSaving}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    Simpan Perubahan
                                </button>
                                <button
                                    onClick={() => handleSave(true)}
                                    disabled={isSaving}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                    <Plus size={13} />
                                    Simpan Sebagai Baru
                                </button>
                                <button
                                    onClick={handleResetForm}
                                    className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold transition-all"
                                >
                                    Buka Baru
                                </button>
                            </div>
                        </div>
                    )}

                    {/* History Section (Collapsible Drawer) */}
                    {showHistory && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4 animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between border-b pb-3">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <FileText className="text-blue-600" size={20} /> 
                                    Daftar Riwayat Manifes Tersimpan ({history.length})
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={refreshHistory}
                                        disabled={loadingHistory}
                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-all text-xs flex items-center gap-1 font-semibold"
                                        title="Muat Ulang Riwayat"
                                    >
                                        <RefreshCw size={14} className={loadingHistory ? 'animate-spin text-blue-600' : ''} />
                                        Segarkan
                                    </button>
                                    <button 
                                        onClick={() => setShowHistory(false)} 
                                        className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {loadingHistory ? (
                                <div className="text-center py-12">
                                    <Loader2 className="animate-spin text-blue-600 mx-auto" size={32} />
                                    <p className="text-xs text-gray-500 mt-2">Menyinkronkan data riwayat dari Firestore...</p>
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                    <FileText className="text-gray-400 mx-auto mb-2" size={36} />
                                    <p className="text-sm font-bold text-gray-700">Belum Ada Manifes Tersimpan</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Data yang Anda simpan akan muncul di sini secara otomatis.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr className="border-b bg-gray-50 text-gray-700 font-bold text-xs uppercase">
                                                <th className="py-3 px-4">Tanggal</th>
                                                <th className="py-3 px-4">Kapal</th>
                                                <th className="py-3 px-4">Nopol / Sopir</th>
                                                <th className="py-3 px-4 text-center">Total Resi</th>
                                                <th className="py-3 px-4 text-center">Total Koli</th>
                                                <th className="py-3 px-4 text-right">Total Berat</th>
                                                <th className="py-3 px-4 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {history.map((m) => {
                                                const isCurrent = savedId === m.id;
                                                const totalKoliM = (m.items || []).reduce((acc, it) => acc + (Number(it.koli) || 0), 0);
                                                const totalBeratM = (m.items || []).reduce((acc, it) => {
                                                    const val = parseFloat(String(it.berat || '').replace(/\./g, '').replace(',', '.'));
                                                    return acc + (isNaN(val) ? 0 : val);
                                                }, 0);

                                                return (
                                                    <tr 
                                                        key={m.id} 
                                                        className={`hover:bg-blue-50/70 transition-all ${isCurrent ? 'bg-blue-50/90 font-medium' : ''}`}
                                                    >
                                                        <td className="py-3 px-4 font-semibold text-gray-900">
                                                            {m.tanggal}
                                                            {isCurrent && (
                                                                <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                                                                    Aktif
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-blue-700">{m.kapal}</td>
                                                        <td className="py-3 px-4 text-gray-600">
                                                            {m.nopol || '-'} • {m.sopir || '-'}
                                                        </td>
                                                        <td className="py-3 px-4 text-center font-bold text-gray-800">
                                                            {m.items?.length || 0}
                                                        </td>
                                                        <td className="py-3 px-4 text-center font-bold text-amber-700">
                                                            {totalKoliM.toLocaleString('id-ID')}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-bold text-gray-900">
                                                            {totalBeratM.toLocaleString('id-ID')} kg
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    onClick={() => handleLoadManifest(m)}
                                                                    className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-bold transition-all"
                                                                    title="Muat ke Formulir"
                                                                >
                                                                    Buka
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDelete(m.id!, m.kapal)} 
                                                                    className="p-1 text-gray-400 hover:text-red-600 rounded-lg transition-all"
                                                                    title="Hapus Manifes"
                                                                >
                                                                    <Trash2 size={16}/>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Metadata Header & Summary Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Form Metadata */}
                        <div className="lg:col-span-8 bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-200/80 space-y-6">
                            <div className="flex items-center justify-between border-b pb-4">
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Ship className="text-blue-600" size={22} />
                                    Informasi Keberangkatan Kapal
                                </h3>
                                {savedId && (
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1">
                                        <CheckCircle size={14} /> Tersimpan
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                                        Tanggal Berangkat <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={tanggal} 
                                        onChange={e => setTanggal(e.target.value)} 
                                        placeholder="Contoh: KAMIS - 23 JULI 2026 atau 2026-07-23"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                                        Nama Kapal <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={kapal} 
                                        onChange={e => setKapal(e.target.value)} 
                                        placeholder="Contoh: DKC-7 / KM. NIKI SEJAHTERA"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                                        No. Polisi Truk / Container
                                    </label>
                                    <input 
                                        type="text" 
                                        value={nopol} 
                                        onChange={e => setNopol(e.target.value)} 
                                        placeholder="Contoh: B 9876 CCE / L 1234 XY"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                                        Nama Sopir / Kru
                                    </label>
                                    <input 
                                        type="text" 
                                        value={sopir} 
                                        onChange={e => setSopir(e.target.value)} 
                                        placeholder="Contoh: AGUNG, ADI"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold text-sm transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                                        Kepada Yth. (Tujuan Pengiriman)
                                    </label>
                                    <input 
                                        type="text" 
                                        value={kepadaYth} 
                                        onChange={e => setKepadaYth(e.target.value)} 
                                        placeholder="Contoh: CAHAYA CARGO EXP MKS"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold text-sm transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Summary & Save Action Card */}
                        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 text-white shadow-xl space-y-6 border border-slate-700">
                            <div className="flex items-center justify-between border-b border-white/15 pb-3">
                                <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                                    <Layers size={20} className="text-blue-400" /> Ringkasan Manifes
                                </h3>
                                <span className="text-xs bg-white/15 px-2.5 py-1 rounded-full font-bold">
                                    {items.length} Resi
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 text-center">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Total Koli</p>
                                    <p className="text-3xl font-black text-amber-400 mt-1">{totalKoli.toLocaleString('id-ID')}</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 text-center">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Total Berat</p>
                                    <p className="text-2xl font-black text-white mt-1">
                                        {totalBerat.toLocaleString('id-ID')}
                                        <span className="text-xs font-normal text-slate-300 ml-1">kg</span>
                                    </p>
                                </div>
                            </div>

                            {/* Validation Errors Box */}
                            {errors.length > 0 && (
                                <div className="bg-rose-500/20 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-200 space-y-1">
                                    <div className="font-bold flex items-center gap-1.5 text-rose-300">
                                        <AlertCircle size={15} /> Perhatian:
                                    </div>
                                    {errors.map((err, i) => (
                                        <div key={i}>• {err}</div>
                                    ))}
                                </div>
                            )}

                            {/* Actions Buttons */}
                            <div className="space-y-2.5 pt-1">
                                <button 
                                    onClick={handlePrint} 
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <Printer size={18} />
                                    Cetak Manifes (PDF Landscape)
                                </button>
                                
                                <button 
                                    onClick={() => handleSave(false)} 
                                    disabled={isSaving} 
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800/50 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Menyimpan ke Database...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            {savedId ? 'Simpan Perubahan Manifes' : 'Simpan ke Database'}
                                        </>
                                    )}
                                </button>

                                {savedId && (
                                    <button 
                                        onClick={() => handleSave(true)} 
                                        disabled={isSaving} 
                                        className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Plus size={14} />
                                        Simpan Sebagai Manifes Baru (Duplikat)
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cargo Manifest Items Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
                        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                                    DAFTAR CARGO MANIFES
                                    <span className="px-2.5 py-0.5 bg-blue-600 text-white text-xs font-black rounded-full">
                                        {items.length} Baris
                                    </span>
                                </h3>
                                <p className="text-slate-400 text-xs mt-0.5">
                                    Masukkan No. STT untuk otomatis menarik data transaksi, atau ketik manual.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={handleOpenImportModal} 
                                    className="bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-sm"
                                >
                                    <Filter size={14} /> Bulk Import STT
                                </button>
                                <button 
                                    onClick={handleAddRow} 
                                    className="bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-sm"
                                >
                                    <Plus size={14} /> Tambah Baris
                                </button>
                                {items.length > 0 && (
                                    <button 
                                        onClick={() => {
                                            if (confirm('Hapus semua baris manifes?')) setItems([]);
                                        }} 
                                        className="bg-rose-900/60 hover:bg-rose-900 px-3 py-2 rounded-xl text-xs font-bold text-rose-200 transition-all"
                                        title="Kosongkan Tabel"
                                    >
                                        Kosongkan
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 uppercase text-[11px] font-extrabold tracking-wider border-b border-gray-300">
                                        <th className="py-3 px-2 border-r border-gray-300 text-center w-10">No</th>
                                        <th className="py-3 px-2 border-r border-gray-300 text-center min-w-[120px]">No. STT</th>
                                        <th className="py-3 px-2 border-r border-gray-300 text-center w-16">Koli</th>
                                        <th className="py-3 px-2 border-r border-gray-300 text-center min-w-[90px]">Berat</th>
                                        <th className="py-3 px-2 border-r border-gray-300 text-left min-w-[140px]">Pengirim</th>
                                        <th className="py-3 px-2 border-r border-gray-300 text-left min-w-[140px]">Penerima</th>
                                        <th className="py-3 px-2 border-r border-gray-300 text-left min-w-[120px]">Isi Barang</th>
                                        <th className="py-3 px-2 border-r border-gray-300 text-left min-w-[180px]">Alamat</th>
                                        <th className="py-3 px-2 border-r border-gray-300 text-left min-w-[100px]">Ket</th>
                                        <th className="py-3 px-2 border-r border-gray-300 text-center w-28">Warna</th>
                                        <th className="py-3 px-2 text-center w-12">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="text-center py-12 text-gray-500 bg-gray-50">
                                                <Ship size={32} className="mx-auto text-gray-400 mb-2" />
                                                <p className="font-semibold">Belum ada baris dalam manifes ini.</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Klik &quot;Tambah Baris&quot;, &quot;Bulk Import STT&quot;, atau &quot;Muat Contoh CCE&quot; untuk mengisi data.
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item, index) => {
                                            const colorMap: Record<string, string> = { 
                                                white: 'bg-white hover:bg-gray-50', 
                                                purple: 'bg-purple-100 hover:bg-purple-200/80', 
                                                yellow: 'bg-yellow-100 hover:bg-yellow-200/80', 
                                                green: 'bg-green-100 hover:bg-green-200/80', 
                                                red: 'bg-red-100 hover:bg-red-200/80', 
                                                blue: 'bg-blue-100 hover:bg-blue-200/80' 
                                            };
                                            const isSearching = searchLoadingIdx === index;

                                            return (
                                                <tr key={index} className={`border-b border-gray-200 transition-colors ${colorMap[item.color || 'white']}`}>
                                                    <td className="py-1 px-1 border-r border-gray-200 text-center font-bold text-gray-600">
                                                        {index + 1}
                                                    </td>
                                                    <td className="py-1 px-1 border-r border-gray-200">
                                                        <div className="relative flex items-center">
                                                            <input 
                                                                value={item.noSTT} 
                                                                onChange={e => handleCellChange(index, 'noSTT', e.target.value)} 
                                                                onBlur={() => handleSTTLookup(index, item.noSTT)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleSTTLookup(index, item.noSTT);
                                                                    }
                                                                }}
                                                                placeholder="Ketik STT..."
                                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono font-bold focus:border-blue-500 outline-none bg-white/90"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSTTLookup(index, item.noSTT)}
                                                                disabled={isSearching}
                                                                className="absolute right-1 text-gray-400 hover:text-blue-600 p-0.5"
                                                                title="Cari transaksi STT ini"
                                                            >
                                                                {isSearching ? <Loader2 size={12} className="animate-spin text-blue-600" /> : <Search size={12} />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-1 px-1 border-r border-gray-200">
                                                        <input 
                                                            type="number" 
                                                            value={item.koli || ''} 
                                                            onChange={e => handleCellChange(index, 'koli', Number(e.target.value) || 0)} 
                                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-center font-bold focus:border-blue-500 outline-none bg-white/90"
                                                        />
                                                    </td>
                                                    <td className="py-1 px-1 border-r border-gray-200">
                                                        <input 
                                                            value={item.berat} 
                                                            onChange={e => handleCellChange(index, 'berat', e.target.value)} 
                                                            placeholder="0"
                                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-center font-bold focus:border-blue-500 outline-none bg-white/90"
                                                        />
                                                    </td>
                                                    <td className="py-1 px-1 border-r border-gray-200">
                                                        <input 
                                                            value={item.pengirim} 
                                                            onChange={e => handleCellChange(index, 'pengirim', e.target.value)} 
                                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs uppercase focus:border-blue-500 outline-none bg-white/90 font-medium"
                                                        />
                                                    </td>
                                                    <td className="py-1 px-1 border-r border-gray-200">
                                                        <input 
                                                            value={item.penerima} 
                                                            onChange={e => handleCellChange(index, 'penerima', e.target.value)} 
                                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs uppercase focus:border-blue-500 outline-none bg-white/90 font-medium"
                                                        />
                                                    </td>
                                                    <td className="py-1 px-1 border-r border-gray-200">
                                                        <input 
                                                            value={item.isiBarang} 
                                                            onChange={e => handleCellChange(index, 'isiBarang', e.target.value)} 
                                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs uppercase focus:border-blue-500 outline-none bg-white/90"
                                                        />
                                                    </td>
                                                    <td className="py-1 px-1 border-r border-gray-200">
                                                        <input 
                                                            value={item.alamat} 
                                                            onChange={e => handleCellChange(index, 'alamat', e.target.value)} 
                                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs uppercase focus:border-blue-500 outline-none bg-white/90"
                                                        />
                                                    </td>
                                                    <td className="py-1 px-1 border-r border-gray-200">
                                                        <input 
                                                            value={item.keterangan} 
                                                            onChange={e => handleCellChange(index, 'keterangan', e.target.value)} 
                                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs uppercase focus:border-blue-500 outline-none bg-white/90"
                                                        />
                                                    </td>
                                                    <td className="py-1 px-1 border-r border-gray-200 text-center">
                                                        <select 
                                                            value={item.color || 'white'} 
                                                            onChange={e => handleCellChange(index, 'color', e.target.value)} 
                                                            className="border border-gray-300 rounded px-1.5 py-1 text-[11px] font-semibold bg-white outline-none focus:border-blue-500 w-full"
                                                        >
                                                            <option value="white">⚪ Putih</option>
                                                            <option value="yellow">🟡 Kuning</option>
                                                            <option value="purple">🟣 Ungu</option>
                                                            <option value="green">🟢 Hijau</option>
                                                            <option value="blue">🔵 Biru</option>
                                                            <option value="red">🔴 Merah</option>
                                                        </select>
                                                    </td>
                                                    <td className="py-1 px-1 text-center">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleRemoveRow(index)} 
                                                            className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                                                            title="Hapus baris ini"
                                                        >
                                                            <Trash2 size={15}/>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bulk Import Modal */}
                    {isImportModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                                <div className="p-5 border-b flex justify-between items-center bg-slate-900 text-white">
                                    <div>
                                        <h3 className="font-extrabold text-lg flex items-center gap-2">
                                            <Filter size={20} className="text-blue-400" />
                                            Import Data Transaksi ke Manifes
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Pilih transaksi aktif untuk dimasukkan ke tabel manifes.
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setIsImportModalOpen(false)}
                                        className="p-1 text-slate-400 hover:text-white rounded-lg"
                                    >
                                        <X size={22}/>
                                    </button>
                                </div>

                                <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row gap-3 items-center justify-between">
                                    <div className="relative w-full sm:w-80">
                                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={txFilter}
                                            onChange={e => setTxFilter(e.target.value)}
                                            placeholder="Cari no STT, pengirim, penerima..."
                                            className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs outline-none focus:border-blue-500 font-medium"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedTxIds.size === filteredTxs.length) {
                                                    setSelectedTxIds(new Set());
                                                } else {
                                                    setSelectedTxIds(new Set(filteredTxs.map(t => t.id)));
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-100"
                                        >
                                            {selectedTxIds.size === filteredTxs.length && filteredTxs.length > 0 ? 'Batal Pilih Semua' : 'Pilih Semua'}
                                        </button>
                                        <span className="text-xs text-gray-600 font-bold">
                                            {selectedTxIds.size} dipilih
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4 flex-1 overflow-y-auto">
                                    {loadingTx ? (
                                        <div className="text-center py-12">
                                            <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
                                            <p className="text-xs text-gray-500 mt-2">Memuat daftar transaksi...</p>
                                        </div>
                                    ) : filteredTxs.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <p className="font-semibold">Tidak ada transaksi yang cocok.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                            {filteredTxs.map(tx => {
                                                const isSelected = selectedTxIds.has(tx.id);
                                                return (
                                                    <div 
                                                        key={tx.id} 
                                                        onClick={() => {
                                                            setSelectedTxIds(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(tx.id)) next.delete(tx.id);
                                                                else next.add(tx.id);
                                                                return next;
                                                            });
                                                        }} 
                                                        className={`p-3 border rounded-xl cursor-pointer transition-all ${
                                                            isSelected 
                                                                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200' 
                                                                : 'bg-white hover:bg-gray-50 border-gray-200'
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <span className="font-mono font-bold text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                                                    STT: {tx.noSTT}
                                                                </span>
                                                                <span className="text-xs text-gray-500 ml-2">
                                                                    {tx.koli || 0} Koli • {tx.berat || 0} kg
                                                                </span>
                                                            </div>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isSelected} 
                                                                onChange={() => {}} 
                                                                className="rounded text-blue-600"
                                                            />
                                                        </div>
                                                        <div className="text-[11px] text-gray-700 mt-2 font-medium">
                                                            <span className="font-semibold">{tx.pengirimName || '-'}</span> ➔ <span className="font-semibold">{tx.penerimaName || '-'}</span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 truncate mt-0.5">
                                                            Isi: {tx.isiBarang || '-'} • Tujuan: {tx.tujuan || '-'}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                                    <button 
                                        onClick={() => setIsImportModalOpen(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100"
                                    >
                                        Batal
                                    </button>
                                    <button 
                                        onClick={handleImportSelected} 
                                        disabled={selectedTxIds.size === 0}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                                    >
                                        Tambahkan {selectedTxIds.size} Transaksi ke Manifes
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Floating Toast Notification */}
                    {toastMessage && (
                        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white text-sm font-semibold transition-all transform animate-in slide-in-from-bottom-5 ${
                            toastType === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}>
                            {toastType === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                            <span>{toastMessage}</span>
                        </div>
                    )}
                </div>
            </RouteGuard>
        </ProtectedRoute>
    );
}
