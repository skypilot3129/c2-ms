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

    // Load sample preset manifest from screenshot
    const handleLoadSampleManifest = () => {
        if (items.length > 0 && !confirm('Muat contoh data Daftar Cargo Manifes Cahaya Cargo Express? Data di form saat ini akan digantikan.')) {
            return;
        }
        setTanggal('KAMIS - 23 JULI 2026');
        setKapal('DKC-7');
        setNopol('');
        setSopir('AGUNG , ADI');
        setKepadaYth('CAHAYA CARGO EXP MKS');

        setItems([
            { noSTT: '1433', koli: 4, berat: 381, pengirim: 'AGUS SALIM', penerima: 'AGUS SALIM', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1434', koli: 1, berat: 130, pengirim: 'BU NITA / AA', penerima: 'EXP BINTANG MURA', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1435', koli: 2, berat: 84.7, pengirim: 'PB COLLECTION', penerima: 'IRHAM', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1436', koli: 1, berat: 50, pengirim: 'WACHID', penerima: 'RIO', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1437', koli: 5, berat: 253.9, pengirim: 'P.INDRA', penerima: 'EXP CAHAYA ILAHI', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1438', koli: 19, berat: 592.5, pengirim: 'AMURA', penerima: 'LAPAS MAKASAR', isiBarang: 'GARMEN', alamat: 'BANDUNG - MAKASAR', keterangan: '', color: 'white' },
            { noSTT: '1439', koli: 12, berat: -200, pengirim: 'MLA', penerima: 'MENTARI', isiBarang: 'DUZ', alamat: 'SEMARANG - MAKASAR', keterangan: '', color: 'white' },
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

    const handleSTTLookup = async (index: number, noSTT: string) => {
        if (!noSTT || noSTT.trim() === '') return;
        setSearchLoadingIdx(index);
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
                            alamat: transaction.penerimaAddress || (transaction.tujuan ? `SURABAYA - ${transaction.tujuan.toUpperCase()}` : ''),
                            keterangan: transaction.keterangan || '',
                            color: item.color || 'white'
                        };
                    }
                    return item;
                }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSearchLoadingIdx(null);
        }
    };

    const handleOpenImportModal = async () => {
        setIsImportModalOpen(true);
        setLoadingTx(true);
        try {
            const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(100));
            const snapshot = await getDocs(q);
            setImportTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
            setSelectedTxIds(new Set());
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
    };

    const handleReset = () => {
        if (confirm('Reset form?')) {
            setTanggal(''); setKapal(''); setNopol(''); setSopir(''); setItems([]); setSavedId(null);
        }
    };

    const handleSave = async () => {
        if (!tanggal || !kapal.trim() || items.length === 0) {
            setErrors(['Tanggal, Kapal, dan minimal 1 item harus diisi.']);
            return;
        }
        setIsSaving(true);
        try {
            const data = { tanggal, kapal, nopol, sopir, kepadaYth, items, createdBy: user?.uid || '', createdByName: user?.displayName || 'Admin' };
            if (savedId) await updateManifest(savedId, data);
            else setSavedId(await createManifest(user?.uid || '', data));
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 4000);
            loadHistoryList();
        } finally {
            setIsSaving(false);
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePrint = () => {
        sessionStorage.setItem('cce_print_manifest', JSON.stringify({ tanggal, kapal, nopol, sopir, kepadaYth, items, orientation: 'landscape' }));
        router.push('/tools/manifest/print');
    };

    const filteredTxs = useMemo(() => {
        if (!txFilter.trim()) return importTransactions;
        return importTransactions.filter(tx => tx.noSTT.includes(txFilter) || tx.pengirimName.toLowerCase().includes(txFilter.toLowerCase()));
    }, [importTransactions, txFilter]);

    return (
        <RouteGuard module="manifest">
            <div className="space-y-6 max-w-[96rem] mx-auto pb-12 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                            <Ship className="text-blue-600" size={32} />
                            Daftar Cargo Manifes
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Modul Input Data & Cetak Manifes Pengapalan (Format Official Excel CCE)</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={handleLoadSampleManifest} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-95">⚡ Muat Contoh Manifes CCE</button>
                        <button onClick={() => router.push('/')} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-sm font-semibold transition-all shadow-sm"><ArrowLeft size={16} /> Beranda</button>
                        <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${showHistory ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'}`}><FileText size={16} /> {showHistory ? 'Tutup Riwayat' : 'Lihat Riwayat'}</button>
                    </div>
                </div>

                {showHistory && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText className="text-blue-600" size={20} /> Riwayat Manifest</h3>
                        {loadingHistory ? <div className="text-center py-12"><Loader2 className="animate-spin text-blue-600 mx-auto" /></div> : (
                            <table className="w-full text-left border-collapse text-sm">
                                <thead><tr className="border-b bg-gray-50 font-bold"><th className="py-3 px-4">Tanggal</th><th className="py-3 px-4">Kapal</th><th className="py-3 px-4">Nopol / Sopir</th><th className="py-3 px-4 text-center">Aksi</th></tr></thead>
                                <tbody>{history.map((m) => (
                                    <tr key={m.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => handleLoadManifest(m)}>
                                        <td className="py-3 px-4">{m.tanggal}</td>
                                        <td className="py-3 px-4">{m.kapal}</td>
                                        <td className="py-3 px-4">{m.nopol} - {m.sopir}</td>
                                        <td className="py-3 px-4 text-center"><button onClick={(e) => {e.stopPropagation(); deleteManifest(m.id!); loadHistoryList()}} className="text-red-500"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-8 bg-white rounded-2xl p-6 md:p-8 shadow-sm border space-y-6">
                        <h3 className="text-xl font-bold border-b pb-4">Header Informasi Manifes</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold uppercase mb-2">Tanggal Berangkat</label><input type="text" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-full px-4 py-2.5 border rounded-xl outline-none focus:border-blue-500 font-semibold text-sm"/></div>
                            <div><label className="block text-xs font-bold uppercase mb-2">Kapal</label><input type="text" value={kapal} onChange={e => setKapal(e.target.value)} className="w-full px-4 py-2.5 border rounded-xl outline-none focus:border-blue-500 font-semibold text-sm"/></div>
                            <div><label className="block text-xs font-bold uppercase mb-2">Nopol</label><input type="text" value={nopol} onChange={e => setNopol(e.target.value)} className="w-full px-4 py-2.5 border rounded-xl outline-none focus:border-blue-500 font-semibold text-sm"/></div>
                            <div><label className="block text-xs font-bold uppercase mb-2">Sopir</label><input type="text" value={sopir} onChange={e => setSopir(e.target.value)} className="w-full px-4 py-2.5 border rounded-xl outline-none focus:border-blue-500 font-semibold text-sm"/></div>
                            <div className="md:col-span-2"><label className="block text-xs font-bold uppercase mb-2">Kepada Yth</label><input type="text" value={kepadaYth} onChange={e => setKepadaYth(e.target.value)} className="w-full px-4 py-2.5 border rounded-xl outline-none focus:border-blue-500 font-semibold text-sm"/></div>
                        </div>
                    </div>

                    <div className="lg:col-span-4 bg-gradient-to-br from-gray-900 to-blue-950 rounded-2xl p-6 text-white shadow-xl space-y-6">
                        <h3 className="font-extrabold text-lg border-b border-white/10 pb-3">Ringkasan Manifes</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 p-3.5 rounded-xl text-center"><p className="text-[10px] font-bold">Total Koli</p><p className="text-2xl font-black">{totalKoli}</p></div>
                            <div className="bg-white/10 p-3.5 rounded-xl text-center"><p className="text-[10px] font-bold">Total Berat</p><p className="text-2xl font-black">{totalBerat.toLocaleString()}</p></div>
                        </div>
                        <div className="space-y-2.5 pt-2">
                            <button onClick={handlePrint} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg">Cetak Manifes (PDF)</button>
                            <button onClick={handleSave} disabled={isSaving} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm">Simpan ke Database</button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                        <h3 className="font-extrabold text-base">DAFTAR CARGO MANIFES ({items.length} Resi)</h3>
                        <div className="flex gap-2">
                            <button onClick={handleOpenImportModal} className="bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold text-white">Bulk Import</button>
                            <button onClick={handleAddRow} className="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold text-white">Tambah Baris</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-100 uppercase text-[11px] font-extrabold">
                                    <th className="py-3 px-2 border-r">No</th><th className="py-3 px-2 border-r">No. STT</th><th className="py-3 px-2 border-r">Koli</th><th className="py-3 px-2 border-r">Berat</th><th className="py-3 px-2 border-r">Pengirim</th><th className="py-3 px-2 border-r">Penerima</th><th className="py-3 px-2 border-r">Isi</th><th className="py-3 px-2 border-r">Alamat</th><th className="py-3 px-2 border-r">Ket</th><th className="py-3 px-2 border-r">Warna</th><th className="py-3 px-2">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>{items.map((item, index) => {
                                const colorMap: Record<string, string> = { white: 'bg-white', purple: 'bg-purple-100', yellow: 'bg-yellow-100', green: 'bg-green-100', red: 'bg-red-100', blue: 'bg-blue-100' };
                                return (
                                    <tr key={index} className={colorMap[item.color || 'white']}>
                                        <td className="py-1 px-1 border-r text-center">{index + 1}</td>
                                        <td className="py-1 px-1 border-r"><input value={item.noSTT} onChange={e => handleCellChange(index, 'noSTT', e.target.value)} className="w-full border rounded p-1"/></td>
                                        <td className="py-1 px-1 border-r"><input value={item.koli} onChange={e => handleCellChange(index, 'koli', e.target.value)} className="w-full border rounded p-1"/></td>
                                        <td className="py-1 px-1 border-r"><input value={item.berat} onChange={e => handleCellChange(index, 'berat', e.target.value)} className="w-full border rounded p-1"/></td>
                                        <td className="py-1 px-1 border-r"><input value={item.pengirim} onChange={e => handleCellChange(index, 'pengirim', e.target.value)} className="w-full border rounded p-1"/></td>
                                        <td className="py-1 px-1 border-r"><input value={item.penerima} onChange={e => handleCellChange(index, 'penerima', e.target.value)} className="w-full border rounded p-1"/></td>
                                        <td className="py-1 px-1 border-r"><input value={item.isiBarang} onChange={e => handleCellChange(index, 'isiBarang', e.target.value)} className="w-full border rounded p-1"/></td>
                                        <td className="py-1 px-1 border-r"><input value={item.alamat} onChange={e => handleCellChange(index, 'alamat', e.target.value)} className="w-full border rounded p-1"/></td>
                                        <td className="py-1 px-1 border-r"><input value={item.keterangan} onChange={e => handleCellChange(index, 'keterangan', e.target.value)} className="w-full border rounded p-1"/></td>
                                        <td className="py-1 px-1 border-r text-center">
                                            <select value={item.color || 'white'} onChange={e => handleCellChange(index, 'color', e.target.value)} className="border rounded p-1 text-[10px]">
                                                <option value="white">Putih</option><option value="purple">Ungu</option><option value="yellow">Kuning</option><option value="green">Hijau</option><option value="red">Merah</option><option value="blue">Biru</option>
                                            </select>
                                        </td>
                                        <td className="py-1 px-1 text-center"><button onClick={() => handleRemoveRow(index)} className="text-red-500"><Trash2 size={14}/></button></td>
                                    </tr>
                                );
                            })}</tbody>
                        </table>
                    </div>
                </div>

                {isImportModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg">Import Transaksi</h3><button onClick={() => setIsImportModalOpen(false)}><X size={20}/></button></div>
                            <div className="p-4 flex-1 overflow-y-auto grid grid-cols-2 gap-2">
                                {filteredTxs.map(tx => (
                                    <div key={tx.id} onClick={() => setSelectedTxIds(prev => new Set(prev.has(tx.id) ? [...prev].filter(i => i !== tx.id) : [...prev, tx.id]))} className={`p-2 border rounded-lg cursor-pointer ${selectedTxIds.has(tx.id) ? 'bg-blue-100 border-blue-500' : ''}`}>
                                        <p className="font-bold text-xs">{tx.noSTT}</p>
                                        <p className="text-[10px]">{tx.pengirimName} ➔ {tx.penerimaName}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t flex justify-end gap-2"><button onClick={handleImportSelected} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Import ke Tabel</button></div>
                        </div>
                    </div>
                )}
            </div>
        </RouteGuard>
    );
}
