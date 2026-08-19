'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    saveMakassarOpsRecord,
    subscribeToMakassarOpsByDate,
    subscribeToMakassarOpsList,
    deleteMakassarOpsRecord
} from '@/lib/firestore-makassar-ops';
import type {
    MakassarOpsRecord,
    MakassarOpsBongkarItem,
    MakassarOpsPemuatanItem,
    MakassarOpsTransitItem,
    MakassarOpsDepositItem
} from '@/types/voyage';
import { parseMakassarOpsImage } from '@/app/actions/ocr-makassar';
import { formatRupiah } from '@/lib/currency';
import {
    Truck,
    Plus,
    Trash2,
    Save,
    Printer,
    Sparkles,
    Calendar,
    ArrowLeft,
    CheckCircle2,
    DollarSign,
    Package,
    Building2,
    FileText,
    Calculator,
    AlertCircle,
    MapPin,
    Users,
    Receipt,
    Upload,
    Camera,
    Loader2,
    X,
    ChevronLeft,
    ChevronRight,
    RefreshCcw,
    Clock
} from 'lucide-react';
import Link from 'next/link';

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().split('T')[0];

// Standard blank template items for a fresh date
const BLANK_BONGKAR_ITEMS = (): MakassarOpsBongkarItem[] => [
    { id: uid(), name: 'Buruh Bongkar', amount: 0 },
    { id: uid(), name: 'Bensin / Solar', amount: 0 },
    { id: uid(), name: 'Makan Tim', amount: 0 },
    { id: uid(), name: 'Tol', amount: 0 },
    { id: uid(), name: 'Pelabuhan', amount: 0 },
    { id: uid(), name: 'Karantina', amount: 0 },
    { id: uid(), name: 'Buruh DHS', amount: 0 },
    { id: uid(), name: 'Forklift', amount: 0 },
    { id: uid(), name: 'Listrik', amount: 0 },
    { id: uid(), name: 'PDAM', amount: 0 },
];

const BLANK_PEMUATAN_ITEMS = (): MakassarOpsPemuatanItem[] => [
    { id: uid(), name: 'Bensin / Tol', amount: 0 },
    { id: uid(), name: 'Buruh JNT', amount: 0 },
    { id: uid(), name: 'Pengawas JNT', amount: 0 },
    { id: uid(), name: 'Pelabuhan', amount: 0 },
    { id: uid(), name: 'Uang Jalan Sopir / Petugas 1', amount: 0 },
    { id: uid(), name: 'Uang Jalan Sopir / Petugas 2', amount: 0 },
    { id: uid(), name: 'Uang Jalan Sopir / Petugas 3', amount: 0 },
];

export default function MakassarOperationalExpensesPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState<string>(todayStr());
    const [savedRecord, setSavedRecord] = useState<MakassarOpsRecord | null>(null);
    const [allRecords, setAllRecords] = useState<MakassarOpsRecord[]>([]);

    // Form Working States
    const [bongkarMobilTim, setBongkarMobilTim] = useState<string>('');
    const [bongkarItems, setBongkarItems] = useState<MakassarOpsBongkarItem[]>(BLANK_BONGKAR_ITEMS());

    const [pemuatanMobilTim, setPemuatanMobilTim] = useState<string>('');
    const [pemuatanItems, setPemuatanItems] = useState<MakassarOpsPemuatanItem[]>(BLANK_PEMUATAN_ITEMS());

    const [transitItems, setTransitItems] = useState<MakassarOpsTransitItem[]>([]);
    const [depositItems, setDepositItems] = useState<MakassarOpsDepositItem[]>([]);

    const [notes, setNotes] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // AI OCR Scanner Modal States
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiPreviews, setAiPreviews] = useState<string[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiProgress, setAiProgress] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Subscribe to date record
    useEffect(() => {
        if (!user) return;
        return subscribeToMakassarOpsByDate(selectedDate, user.uid, (rec) => {
            setSavedRecord(rec);
            if (rec) {
                // If record exists for this date, load it
                setBongkarMobilTim(rec.bongkarMobilTim || '');
                setBongkarItems(rec.bongkarItems?.length ? rec.bongkarItems : BLANK_BONGKAR_ITEMS());
                setPemuatanMobilTim(rec.pemuatanMobilTim || '');
                setPemuatanItems(rec.pemuatanItems?.length ? rec.pemuatanItems : BLANK_PEMUATAN_ITEMS());
                setTransitItems(rec.transitItems?.length ? rec.transitItems : []);
                setDepositItems(rec.depositItems || []);
                setNotes(rec.notes || '');
            } else {
                // New / unsaved date: Reset to clean blank items
                setBongkarMobilTim('');
                setBongkarItems(BLANK_BONGKAR_ITEMS());
                setPemuatanMobilTim('');
                setPemuatanItems(BLANK_PEMUATAN_ITEMS());
                setTransitItems([]);
                setDepositItems([]);
                setNotes('');
            }
        });
    }, [user, selectedDate]);

    // Subscribe to all records list for history drawer
    useEffect(() => {
        if (!user) return;
        return subscribeToMakassarOpsList(user.uid, (list) => {
            setAllRecords(list);
        });
    }, [user]);

    // ── Calculations ──
    const totalBongkar = useMemo(() => {
        return bongkarItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }, [bongkarItems]);

    const totalPemuatan = useMemo(() => {
        return pemuatanItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }, [pemuatanItems]);

    const totalTransit = useMemo(() => {
        return transitItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }, [transitItems]);

    const totalGrossOps = useMemo(() => {
        return totalBongkar + totalPemuatan + totalTransit;
    }, [totalBongkar, totalPemuatan, totalTransit]);

    const totalDeposit = useMemo(() => {
        return depositItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }, [depositItems]);

    const totalNetOps = useMemo(() => {
        return totalGrossOps - totalDeposit;
    }, [totalGrossOps, totalDeposit]);

    // Date Navigation Controls
    const handlePrevDate = () => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const handleNextDate = () => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const handleToday = () => {
        setSelectedDate(todayStr());
    };

    const handleResetForm = () => {
        if (confirm("Reset/kosongkan seluruh formulir untuk tanggal ini?")) {
            setBongkarMobilTim('');
            setBongkarItems(BLANK_BONGKAR_ITEMS());
            setPemuatanMobilTim('');
            setPemuatanItems(BLANK_PEMUATAN_ITEMS());
            setTransitItems([]);
            setDepositItems([]);
            setNotes('');
        }
    };

    // Load Sample Data (Matching Handwritten Notes: 04-07-2026)
    const handleLoadSampleNotes = () => {
        setSelectedDate('2026-07-04');
        setBongkarMobilTim('HERUL + ISDAR ALMET');
        setBongkarItems([
            { id: uid(), name: 'Buruh Bongkar', amount: 1100000 },
            { id: uid(), name: 'Bensin / Solar', amount: 500000 },
            { id: uid(), name: 'Makan Tim', amount: 500000 },
            { id: uid(), name: 'Tol', amount: 150000 },
            { id: uid(), name: 'Pelabuhan', amount: 400000 },
            { id: uid(), name: 'Karantina', amount: 0 },
            { id: uid(), name: 'Buruh DHS', amount: 750000 },
            { id: uid(), name: 'Forklift', amount: 200000 },
            { id: uid(), name: 'Listrik', amount: 500000 },
            { id: uid(), name: 'PDAM', amount: 350000 },
        ]);

        setPemuatanMobilTim('ALFIAN + HAERUDDIN + RISWAN');
        setPemuatanItems([
            { id: uid(), name: 'Bensin / Tol', amount: 100000, note: '0654' },
            { id: uid(), name: 'Buruh JNT', amount: 1500000 },
            { id: uid(), name: 'Pengawas JNT', amount: 250000 },
            { id: uid(), name: 'Pelabuhan', amount: 100000 },
            { id: uid(), name: 'Uang Jalan: Alfian', amount: 800000 },
            { id: uid(), name: 'Uang Jalan: Haerudin', amount: 800000 },
            { id: uid(), name: 'Uang Jalan: Riswan', amount: 500000, note: '6ME' },
        ]);

        setTransitItems([
            { id: uid(), resiNumber: '18915', koliDetails: '10Q / 50KG', customerName: 'Bp LORENS', destination: 'MANADO', amount: 150000 },
            { id: uid(), resiNumber: '18097', koliDetails: '10Q / 820KG', customerName: 'HAIKAL', destination: 'MOROWALI', amount: 2050000 },
            { id: uid(), resiNumber: '18898', koliDetails: '10Q / 363V', customerName: 'C. MANDIRI', destination: 'KAB. WAJO', amount: 544500 },
            { id: uid(), resiNumber: '18899', koliDetails: '18Q / 365V', customerName: 'CHT', destination: 'KOTAMOBAGU', amount: 985500 },
            { id: uid(), resiNumber: '18890', koliDetails: '15Q', customerName: 'PENTAWIRA', destination: 'GORONTALO', amount: 4500000 },
        ]);

        setDepositItems([
            { id: uid(), resiNumber: '18880', description: 'Deposit Kantor', amount: 1078000 }
        ]);

        setNotes('Lembar operasional Makassar 04-07-2026 telah disesuaikan dengan catatan resmi lapangan.');
    };

    // AI OCR File Selection Handler
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const b64 = event.target?.result as string;
                if (b64) setAiPreviews(prev => [...prev, b64]);
            };
            reader.readAsDataURL(file);
        });
    };

    // Process AI OCR Scan
    const handleRunAiOcr = async () => {
        if (aiPreviews.length === 0) {
            alert('Pilih minimal 1 foto catatan tangan atau nota.');
            return;
        }

        setAiLoading(true);
        setAiProgress('✨ AI Gemini 2.5 Flash sedang mengekstrak tulisan tangan nota...');

        try {
            const result = await parseMakassarOpsImage(aiPreviews);

            if (!result.success || result.error) {
                alert(`Gagal memindai foto: ${result.error || 'Terjadi kesalahan'}`);
                return;
            }

            // 1. Update Date if found in OCR note
            if (result.date) {
                setSelectedDate(result.date);
            }

            // 2. Update Bongkar section
            if (result.bongkarMobilTim) setBongkarMobilTim(result.bongkarMobilTim);
            if (result.bongkarItems && result.bongkarItems.length > 0) {
                setBongkarItems(result.bongkarItems.map(item => ({
                    id: uid(),
                    name: item.name,
                    amount: item.amount || 0
                })));
            }

            // 3. Update Pemuatan section
            if (result.pemuatanMobilTim) setPemuatanMobilTim(result.pemuatanMobilTim);
            if (result.pemuatanItems && result.pemuatanItems.length > 0) {
                setPemuatanItems(result.pemuatanItems.map(item => ({
                    id: uid(),
                    name: item.name,
                    amount: item.amount || 0,
                    note: item.note || ''
                })));
            }

            // 4. Update Transit section
            if (result.transitItems && result.transitItems.length > 0) {
                setTransitItems(result.transitItems.map(item => ({
                    id: uid(),
                    resiNumber: item.resiNumber || '',
                    koliDetails: item.koliDetails || '',
                    customerName: item.customerName || '',
                    destination: item.destination || '',
                    amount: item.amount || 0
                })));
            }

            // 5. Update Deposit section
            if (result.depositItems && result.depositItems.length > 0) {
                setDepositItems(result.depositItems.map(item => ({
                    id: uid(),
                    resiNumber: item.resiNumber || '',
                    description: item.description || 'Deposit Kantor',
                    amount: item.amount || 0
                })));
            }

            if (result.notes) setNotes(result.notes);

            setIsAiModalOpen(false);
            setAiPreviews([]);
            alert(`🎉 AI Berhasil Membaca Foto!\nFormulir Operasional Makassar tanggal ${result.date || selectedDate} telah diisi otomatis.`);
        } catch (err: any) {
            console.error('AI Scan Error:', err);
            alert(`Terjadi kesalahan saat memproses gambar: ${err?.message || err}`);
        } finally {
            setAiLoading(false);
            setAiProgress('');
        }
    };

    // Save Record
    const handleSave = async () => {
        if (!user) {
            alert('Sesi login tidak terdeteksi. Silakan login kembali.');
            return;
        }
        setSaving(true);
        try {
            const idToUse = savedRecord?.id;
            const expDocIdToUse = savedRecord?.expenseDocId;

            await saveMakassarOpsRecord({
                id: idToUse,
                date: selectedDate,
                userId: user.uid,
                pemuatanMobilTim,
                pemuatanItems: pemuatanItems.filter(i => i.name && i.name.trim() && Number(i.amount) > 0),
                totalPemuatan,

                bongkarMobilTim,
                bongkarItems: bongkarItems.filter(i => i.name && i.name.trim() && Number(i.amount) > 0),
                totalBongkar,

                transitItems: transitItems.filter(i => Number(i.amount) > 0 || (i.resiNumber && i.resiNumber.trim().length > 0)),
                totalTransit,

                totalGrossOps,
                depositItems: depositItems.filter(i => Number(i.amount) > 0),
                totalDeposit,
                totalNetOps,
                notes,
                expenseDocId: expDocIdToUse,
            }, user.uid);

            alert(`✅ Operasional Makassar tanggal ${selectedDate} berhasil disimpan dan otomatis memotong Laporan Laba Rugi!`);
        } catch (err: any) {
            console.error('Save error:', err);
            alert(`Gagal menyimpan data operasional Makassar: ${err?.message || 'Terjadi kesalahan sistem'}`);
        } finally {
            setSaving(false);
        }
    };

    // Delete Record
    const handleDelete = async () => {
        if (!savedRecord || !confirm('Hapus lembar operasional Makassar ini beserta entri laporan kasnya?')) return;
        try {
            await deleteMakassarOpsRecord(savedRecord.id, savedRecord.expenseDocId);
            setSavedRecord(null);
            alert('Data operasional Makassar berhasil dihapus.');
        } catch (err) {
            console.error(err);
            alert('Gagal menghapus data.');
        }
    };

    // Print Handler
    const handleOpenPrint = () => {
        const draftPayload = {
            id: savedRecord?.id || 'draft',
            date: selectedDate,
            pemuatanMobilTim,
            pemuatanItems,
            totalPemuatan,
            bongkarMobilTim,
            bongkarItems,
            totalBongkar,
            transitItems,
            totalTransit,
            totalGrossOps,
            depositItems,
            totalDeposit,
            totalNetOps,
            notes
        };
        sessionStorage.setItem(`cce_makassar_ops_${selectedDate}`, JSON.stringify(draftPayload));
        router.push(`/finance/operasional-makassar/print-daily?date=${selectedDate}`);
    };

    const formattedDateTitle = new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    return (
        <ProtectedRoute>
            <div className="space-y-6 pb-24 max-w-7xl mx-auto font-sans">
                
                {/* ── Top Header Bar ── */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/finance" className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Truck size={24} className="text-blue-600" /> Operasional Cabang Makassar
                            </h1>
                            <p className="text-xs text-gray-500">
                                Pencatatan biaya bongkar, pemuatan, ekspedisi transit, & deposit kantor yang otomatis memotong Omzet & Laba Rugi
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setIsAiModalOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-600/20 transition-all active:scale-95"
                        >
                            <Sparkles size={16} className="animate-pulse" /> 📸 AI Scan Catatan Tangan / Nota
                        </button>

                        <button
                            onClick={handleLoadSampleNotes}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors shadow-xs"
                            title="Isi otomatis data sesuai gambar catatan tangan 04-07-2026"
                        >
                            <Sparkles size={14} className="text-amber-600" /> Contoh 04-07-2026
                        </button>

                        <button
                            onClick={handleResetForm}
                            className="p-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            title="Kosongkan formulir"
                        >
                            <RefreshCcw size={16} />
                        </button>
                    </div>
                </div>

                {/* ── Banner Date Switcher & Status Sync Laporan ── */}
                <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-blue-300 text-xs font-extrabold uppercase tracking-wider mb-1">
                                <CheckCircle2 size={16} className="text-emerald-400" /> Auto-Sync Keuangan & Omzet
                            </div>
                            <h2 className="text-lg font-bold text-white">Laporan Operasional Makassar — {formattedDateTitle}</h2>
                            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                                Menginput tanggal selanjutnya atau mengubah tanggal kapan saja. Total Net Ops secara otomatis memotong <strong>Laporan Laba Rugi</strong>, <strong>Kas Umum</strong>, & <strong>Owner Dashboard</strong>.
                            </p>
                        </div>

                        {/* Interactive Date Switcher & Nav */}
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3.5 rounded-2xl flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Pilih Tanggal Input:</span>
                                {savedRecord ? (
                                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        🟢 Tersimpan di Database
                                    </span>
                                ) : (
                                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        🟡 Tanggal Baru (Belum Disimpan)
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevDate}
                                    className="p-2 hover:bg-white/20 rounded-lg text-slate-200 transition-colors"
                                    title="Tanggal Sebelumnya"
                                >
                                    <ChevronLeft size={18} />
                                </button>

                                <div className="flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-xl border border-white/20 flex-1 justify-center">
                                    <Calendar size={16} className="text-blue-300" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={e => setSelectedDate(e.target.value)}
                                        className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer"
                                    />
                                </div>

                                <button
                                    onClick={handleNextDate}
                                    className="p-2 hover:bg-white/20 rounded-lg text-slate-200 transition-colors"
                                    title="Tanggal Selanjutnya"
                                >
                                    <ChevronRight size={18} />
                                </button>

                                <button
                                    onClick={handleToday}
                                    className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                    title="Kembali ke Hari Ini"
                                >
                                    Hari Ini
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Total Net Ops Grand Summary Bar ── */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
                        <span className="text-xs font-bold text-gray-500 uppercase">1. Total Ops Bongkar</span>
                        <p className="text-xl font-extrabold text-gray-900 mt-1">{formatRupiah(totalBongkar)}</p>
                        <span className="text-[10px] text-gray-400">{bongkarItems.length} item pengeluaran</span>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
                        <span className="text-xs font-bold text-gray-500 uppercase">2. Total Ops Pemuatan</span>
                        <p className="text-xl font-extrabold text-gray-900 mt-1">{formatRupiah(totalPemuatan)}</p>
                        <span className="text-[10px] text-gray-400">{pemuatanItems.length} item pengeluaran</span>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
                        <span className="text-xs font-bold text-gray-500 uppercase">3. Total Barang Transit</span>
                        <p className="text-xl font-extrabold text-gray-900 mt-1">{formatRupiah(totalTransit)}</p>
                        <span className="text-[10px] text-gray-400">{transitItems.length} resi transit</span>
                    </div>

                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-4 shadow-md shadow-blue-600/20">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-extrabold text-blue-100 uppercase">TOTAL NET OPERASIONAL</span>
                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white font-bold">Memotong Omzet</span>
                        </div>
                        <p className="text-2xl font-black text-white mt-1">{formatRupiah(totalNetOps)}</p>
                        <span className="text-[10px] text-blue-200 block mt-0.5">
                            Gross: {formatRupiah(totalGrossOps)} | Deposit: -{formatRupiah(totalDeposit)}
                        </span>
                    </div>
                </div>

                {/* ── SECTION 1: OPERASIONAL BONGKAR MAKASSAR ── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                        <div>
                            <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                                <Package size={20} className="text-blue-600" /> 1. Operasional Bongkar Makassar
                            </h3>
                            <p className="text-xs text-gray-500">Rincian buruh bongkar, solar, makan, tol, pelabuhan, karantina, forklift, listrik, & PDAM</p>
                        </div>
                        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                            <Users size={15} className="text-blue-700" />
                            <span className="text-xs font-bold text-blue-900">Armada/Mobil:</span>
                            <input
                                type="text"
                                value={bongkarMobilTim}
                                onChange={e => setBongkarMobilTim(e.target.value)}
                                placeholder="Contoh: HERUL + ISDAR ALMET"
                                className="bg-transparent text-xs font-bold text-blue-950 outline-none w-48"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {bongkarItems.map((item, idx) => (
                            <div key={item.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
                                <span className="text-xs font-bold text-gray-400 w-6 text-center">{idx + 1}.</span>
                                <input
                                    type="text"
                                    value={item.name}
                                    onChange={e => setBongkarItems(prev => prev.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                                    className="flex-1 text-xs font-bold text-gray-800 bg-transparent outline-none"
                                    placeholder="Nama Biaya..."
                                />
                                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 w-36">
                                    <span className="text-[10px] text-gray-400 font-bold">Rp</span>
                                    <input
                                        type="number"
                                        value={item.amount || ''}
                                        onChange={e => setBongkarItems(prev => prev.map(i => i.id === item.id ? { ...i, amount: Number(e.target.value) } : i))}
                                        className="w-full text-xs font-mono font-bold text-gray-900 outline-none text-right"
                                        placeholder="0"
                                    />
                                </div>
                                <button
                                    onClick={() => setBongkarItems(prev => prev.filter(i => i.id !== item.id))}
                                    className="text-red-400 hover:text-red-600 p-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <button
                            onClick={() => setBongkarItems(prev => [...prev, { id: uid(), name: '', amount: 0 }])}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            <Plus size={15} /> Tambah Baris Biaya Bongkar
                        </button>
                        <div className="text-xs font-extrabold text-gray-800">
                            Subtotal Bongkar: <span className="text-blue-700 font-mono">{formatRupiah(totalBongkar)}</span>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 2: OPERASIONAL PEMUATAN MAKASSAR ── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                        <div>
                            <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                                <Truck size={20} className="text-indigo-600" /> 2. Operasional Pemuatan Makassar
                            </h3>
                            <p className="text-xs text-gray-500">Rincian bensin, tol, buruh JNT, pengawas JNT, pelabuhan, & uang jalan petugas</p>
                        </div>
                        <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                            <Users size={15} className="text-indigo-700" />
                            <span className="text-xs font-bold text-indigo-900">Armada/Mobil:</span>
                            <input
                                type="text"
                                value={pemuatanMobilTim}
                                onChange={e => setPemuatanMobilTim(e.target.value)}
                                placeholder="Contoh: ALFIAN + HAERUDDIN + RISWAN"
                                className="bg-transparent text-xs font-bold text-indigo-950 outline-none w-52"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {pemuatanItems.map((item, idx) => (
                            <div key={item.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-200 transition-colors">
                                <span className="text-xs font-bold text-gray-400 w-6 text-center">{idx + 1}.</span>
                                <input
                                    type="text"
                                    value={item.name}
                                    onChange={e => setPemuatanItems(prev => prev.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                                    className="flex-1 text-xs font-bold text-gray-800 bg-transparent outline-none"
                                    placeholder="Nama Biaya..."
                                />
                                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 w-36">
                                    <span className="text-[10px] text-gray-400 font-bold">Rp</span>
                                    <input
                                        type="number"
                                        value={item.amount || ''}
                                        onChange={e => setPemuatanItems(prev => prev.map(i => i.id === item.id ? { ...i, amount: Number(e.target.value) } : i))}
                                        className="w-full text-xs font-mono font-bold text-gray-900 outline-none text-right"
                                        placeholder="0"
                                    />
                                </div>
                                <button
                                    onClick={() => setPemuatanItems(prev => prev.filter(i => i.id !== item.id))}
                                    className="text-red-400 hover:text-red-600 p-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <button
                            onClick={() => setPemuatanItems(prev => [...prev, { id: uid(), name: '', amount: 0 }])}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                            <Plus size={15} /> Tambah Baris Biaya Pemuatan
                        </button>
                        <div className="text-xs font-extrabold text-gray-800">
                            Subtotal Pemuatan: <span className="text-indigo-700 font-mono">{formatRupiah(totalPemuatan)}</span>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 3: BARANG TRANSIT EKSPEDISI LANJUTAN ── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div>
                            <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                                <Receipt size={20} className="text-purple-600" /> 3. Barang Transit / Ekspedisi Lanjutan
                            </h3>
                            <p className="text-xs text-gray-500">Rincian transit resi ke kota Manado, Morowali, Wajo, Kotamobagu, Gorontalo, dll.</p>
                        </div>
                        <button
                            onClick={() => setTransitItems(prev => [...prev, { id: uid(), resiNumber: '', koliDetails: '', customerName: '', destination: '', amount: 0 }])}
                            className="flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200"
                        >
                            <Plus size={15} /> Tambah Resi Transit
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-bold uppercase text-[10px]">
                                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                                    <th className="py-2.5 px-3 w-32">No. Resi / STT</th>
                                    <th className="py-2.5 px-3 w-40">Koli / Berat / Vol</th>
                                    <th className="py-2.5 px-3">Pengirim / Customer</th>
                                    <th className="py-2.5 px-3 w-40">Kota Tujuan</th>
                                    <th className="py-2.5 px-3 w-36 text-right">Biaya Transit (Rp)</th>
                                    <th className="py-2.5 px-3 w-10 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {transitItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                                            Belum ada data barang transit untuk tanggal ini. Klik tombol di atas untuk menambah.
                                        </td>
                                    </tr>
                                ) : (
                                    transitItems.map((item, idx) => (
                                        <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="py-2 px-3 text-center font-bold text-gray-400">{idx + 1}</td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    value={item.resiNumber}
                                                    onChange={e => setTransitItems(prev => prev.map(i => i.id === item.id ? { ...i, resiNumber: e.target.value } : i))}
                                                    className="w-full font-mono font-bold text-gray-900 bg-white border border-gray-200 rounded px-2 py-1 outline-none"
                                                    placeholder="18915"
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    value={item.koliDetails}
                                                    onChange={e => setTransitItems(prev => prev.map(i => i.id === item.id ? { ...i, koliDetails: e.target.value } : i))}
                                                    className="w-full font-medium text-gray-800 bg-white border border-gray-200 rounded px-2 py-1 outline-none"
                                                    placeholder="10Q / 50KG"
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    value={item.customerName}
                                                    onChange={e => setTransitItems(prev => prev.map(i => i.id === item.id ? { ...i, customerName: e.target.value } : i))}
                                                    className="w-full font-semibold text-gray-900 bg-white border border-gray-200 rounded px-2 py-1 outline-none"
                                                    placeholder="Bp LORENS"
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    value={item.destination}
                                                    onChange={e => setTransitItems(prev => prev.map(i => i.id === item.id ? { ...i, destination: e.target.value } : i))}
                                                    className="w-full font-bold text-purple-900 bg-white border border-gray-200 rounded px-2 py-1 outline-none uppercase"
                                                    placeholder="MANADO"
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="number"
                                                    value={item.amount || ''}
                                                    onChange={e => setTransitItems(prev => prev.map(i => i.id === item.id ? { ...i, amount: Number(e.target.value) } : i))}
                                                    className="w-full font-mono font-bold text-gray-900 bg-white border border-gray-200 rounded px-2 py-1 text-right outline-none"
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <button
                                                    onClick={() => setTransitItems(prev => prev.filter(i => i.id !== item.id))}
                                                    className="text-red-400 hover:text-red-600 p-1"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end pt-2">
                        <div className="text-xs font-extrabold text-gray-800">
                            Subtotal Barang Transit: <span className="text-purple-700 font-mono text-sm">{formatRupiah(totalTransit)}</span>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 4: DEPOSIT KANTOR & SUMMARY REKAP ── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div>
                            <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                                <Building2 size={20} className="text-emerald-600" /> 4. Deposit Kantor / Potongan Pemasukan
                            </h3>
                            <p className="text-xs text-gray-500">Pemasukan kas / deposit kantor yang mengurangi Total Operasional Makassar</p>
                        </div>
                        <button
                            onClick={() => setDepositItems(prev => [...prev, { id: uid(), resiNumber: '', description: 'Deposit Kantor', amount: 0 }])}
                            className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200"
                        >
                            <Plus size={15} /> Tambah Deposit Kantor
                        </button>
                    </div>

                    <div className="space-y-2">
                        {depositItems.length === 0 ? (
                            <div className="text-center py-4 text-xs text-gray-400 italic">
                                Belum ada deposit kantor terdaftar. Klik tombol di atas untuk menambah.
                            </div>
                        ) : (
                            depositItems.map((dep, idx) => (
                                <div key={dep.id} className="flex items-center gap-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                                    <span className="text-xs font-bold text-emerald-700">Resi / No:</span>
                                    <input
                                        type="text"
                                        value={dep.resiNumber || ''}
                                        onChange={e => setDepositItems(prev => prev.map(i => i.id === dep.id ? { ...i, resiNumber: e.target.value } : i))}
                                        className="w-32 text-xs font-mono font-bold text-gray-900 bg-white border border-gray-200 rounded px-2.5 py-1 outline-none"
                                        placeholder="18880"
                                    />
                                    <input
                                        type="text"
                                        value={dep.description}
                                        onChange={e => setDepositItems(prev => prev.map(i => i.id === dep.id ? { ...i, description: e.target.value } : i))}
                                        className="flex-1 text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded px-2.5 py-1 outline-none"
                                        placeholder="Keterangan Deposit..."
                                    />
                                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-1 w-40">
                                        <span className="text-[10px] text-emerald-700 font-bold">Rp</span>
                                        <input
                                            type="number"
                                            value={dep.amount || ''}
                                            onChange={e => setDepositItems(prev => prev.map(i => i.id === dep.id ? { ...i, amount: Number(e.target.value) } : i))}
                                            className="w-full text-xs font-mono font-bold text-emerald-800 outline-none text-right"
                                            placeholder="0"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setDepositItems(prev => prev.filter(i => i.id !== dep.id))}
                                        className="text-red-400 hover:text-red-600 p-1"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Operational Notes */}
                    <div className="pt-2 border-t border-dashed border-gray-200">
                        <label className="text-xs font-bold text-gray-700 mb-1 block">Catatan Tambahan Operasional Makassar:</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Catatan kapal pemuatan, kondisi armada, atau petunjuk pembayaran..."
                            rows={2}
                            className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                </div>

                {/* ── ACTION BAR ── */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-md">
                    <div className="flex items-center gap-2">
                        {savedRecord && (
                            <button
                                onClick={handleDelete}
                                className="flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors"
                            >
                                <Trash2 size={15} /> Hapus Lembar Ops Ini
                            </button>
                        )}
                        <button
                            onClick={handleOpenPrint}
                            className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors"
                        >
                            <Printer size={16} /> Cetak PDF Laporan
                        </button>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95"
                    >
                        <Save size={16} />
                        {saving ? 'Menyimpan...' : savedRecord ? `Perbarui Ops (${selectedDate})` : `Simpan Ops (${selectedDate})`}
                    </button>
                </div>

                {/* ── MODAL AI OCR SCANNER (GEMINI 2.5 FLASH) ── */}
                {isAiModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200 border border-purple-100">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                                        <Sparkles size={22} />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-gray-900 text-base">
                                            AI Vision Scanner — Pembaca Catatan Tangan
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            Unggah foto lembar catatan tangan atau foto nota operasional Makassar
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setIsAiModalOpen(false); setAiPreviews([]); }}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Dropzone Upload */}
                            <div className="space-y-3">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                />

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/50 hover:bg-purple-50 rounded-2xl p-6 text-center cursor-pointer transition-all group"
                                >
                                    <Upload size={32} className="mx-auto text-purple-600 group-hover:scale-110 transition-transform mb-2" />
                                    <p className="text-xs font-bold text-purple-900">
                                        Klik untuk Unggah Foto Catatan Tangan / Nota
                                    </p>
                                    <p className="text-[10px] text-purple-600 mt-1">
                                        Mendukung banyak gambar sekaligus (Kamera HP / PNG / JPG / WEBP)
                                    </p>
                                </div>

                                {/* Image Previews Grid */}
                                {aiPreviews.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                                            <span>Pratinjau Foto ({aiPreviews.length}):</span>
                                            <button
                                                onClick={() => setAiPreviews([])}
                                                className="text-red-500 hover:underline text-[10px]"
                                            >
                                                Hapus Semua Foto
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                                            {aiPreviews.map((src, idx) => (
                                                <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-100">
                                                    <img src={src} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                                                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                        #{idx + 1}
                                                    </div>
                                                    <button
                                                        onClick={() => setAiPreviews(prev => prev.filter((_, i) => i !== idx))}
                                                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Status Loader */}
                            {aiLoading && (
                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3 text-purple-900 text-xs font-bold">
                                    <Loader2 size={20} className="animate-spin text-purple-600 shrink-0" />
                                    <span>{aiProgress}</span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => { setIsAiModalOpen(false); setAiPreviews([]); }}
                                    className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleRunAiOcr}
                                    disabled={aiLoading || aiPreviews.length === 0}
                                    className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2 transition-all"
                                >
                                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    {aiLoading ? 'Memproses...' : 'Ekstrak Data dengan AI'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </ProtectedRoute>
    );
}
