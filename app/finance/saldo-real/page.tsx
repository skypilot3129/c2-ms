'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    subscribeToRealBalanceSettings,
    saveRealBalanceSettings,
    subscribeToRealMutations,
    addRealMutation,
    updateRealMutation,
    deleteRealMutation,
    syncIkaInvoicesToRealMutations
} from '@/lib/firestore-saldo-real';
import { subscribeToInvoices } from '@/lib/firestore-invoices';
import type { Invoice } from '@/types/invoice';
import type {
    RealBankAccount,
    RealBalanceMutation,
    RealBalanceSettings,
    RealMutationType,
    RealMutationSource
} from '@/types/saldo-real';
import { REAL_BANK_ACCOUNTS, IKA_SYNC_START_DATE } from '@/types/saldo-real';
import { formatRupiah } from '@/lib/currency';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    Building2, Landmark, Wallet, ArrowUpRight, ArrowDownLeft, ArrowLeftRight,
    Plus, Settings, RefreshCw, Printer, Search, Filter, Calendar,
    CheckCircle2, Clock, Trash2, Edit3, X, Save, AlertCircle, Sparkles,
    ChevronLeft, ChevronRight, ArrowRight, DollarSign, FileText, Check
} from 'lucide-react';

type FilterPeriodMode = 'month' | 'date' | 'range' | 'all';

export default function SaldoRealPage() {
    const { user, role } = useAuth();
    const router = useRouter();

    const [settings, setSettings] = useState<RealBalanceSettings>({
        modalAwalPerusahaan: 0,
        modalAwalBca: 0,
        modalAwalBri: 0,
        modalAwalMandiri: 0,
        effectiveDate: '2026-08-23',
    });

    const [mutations, setMutations] = useState<RealBalanceMutation[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncingIka, setSyncingIka] = useState(false);

    // Toast notification
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Filter & Tab States
    const [activeBankTab, setActiveBankTab] = useState<'all' | RealBankAccount>('all');
    const [sourceFilter, setSourceFilter] = useState<'all' | RealMutationSource>('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Period filter
    const [periodMode, setPeriodMode] = useState<FilterPeriodMode>('month');
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [startDate, setStartDate] = useState(() => '2026-08-23');
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    // Modal States
    const [isMutationModalOpen, setIsMutationModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [editingMutation, setEditingMutation] = useState<RealBalanceMutation | null>(null);

    // Form: Manual Mutation
    const [formMutationType, setFormMutationType] = useState<RealMutationType>('in');
    const [formBank, setFormBank] = useState<RealBankAccount>('bca');
    const [formTargetBank, setFormTargetBank] = useState<RealBankAccount>('perusahaan');
    const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [formAmount, setFormAmount] = useState<number>(0);
    const [formCategory, setFormCategory] = useState('Pemasukan');
    const [formDescription, setFormDescription] = useState('');
    const [formRefNumber, setFormRefNumber] = useState('');
    const [submittingMutation, setSubmittingMutation] = useState(false);

    // Form: Modal Awal Settings
    const [formModalPerusahaan, setFormModalPerusahaan] = useState(0);
    const [formModalBca, setFormModalBca] = useState(0);
    const [formModalBri, setFormModalBri] = useState(0);
    const [formModalMandiri, setFormModalMandiri] = useState(0);
    const [formEffectiveDate, setFormEffectiveDate] = useState('2026-08-23');
    const [savingSettings, setSavingSettings] = useState(false);

    // Subscriptions
    useEffect(() => {
        if (!user) return;
        setLoading(true);

        const unsubSettings = subscribeToRealBalanceSettings((data) => {
            setSettings(data);
            setFormModalPerusahaan(data.modalAwalPerusahaan || 0);
            setFormModalBca(data.modalAwalBca || 0);
            setFormModalBri(data.modalAwalBri || 0);
            setFormModalMandiri(data.modalAwalMandiri || 0);
            setFormEffectiveDate(data.effectiveDate || '2026-08-23');
        });

        const unsubMutations = subscribeToRealMutations((data) => {
            setMutations(data);
            setLoading(false);
        });

        const unsubInvoices = subscribeToInvoices(user.uid, (invData) => {
            setInvoices(invData);
        });

        return () => {
            unsubSettings();
            unsubMutations();
            unsubInvoices();
        };
    }, [user]);

    // Auto-sync Penagihan IKA on first load if paid invoices exist
    useEffect(() => {
        if (!user || invoices.length === 0) return;
        
        // Background silent sync
        syncIkaInvoicesToRealMutations(invoices, user.uid, user.displayName || user.email || 'System')
            .catch(err => console.warn('Background IKA sync notice:', err));
    }, [user, invoices]);

    // Manual Trigger Sync IKA
    const handleManualSyncIka = async () => {
        if (!user) return;
        setSyncingIka(true);
        try {
            const res = await syncIkaInvoicesToRealMutations(
                invoices,
                user.uid,
                user.displayName || user.email || 'Admin Finance'
            );
            if (res.addedCount > 0 || res.updatedCount > 0) {
                showToast(`✅ Berhasil menyinkronkan ${res.addedCount} invoice baru & memperbarui ${res.updatedCount} transaksi dari Penagihan IKA!`);
            } else {
                showToast(`ℹ️ Semua invoice Penagihan IKA (mulai ${IKA_SYNC_START_DATE}) sudah tersinkron rapi.`);
            }
        } catch (err: any) {
            console.error(err);
            alert(`Gagal sinkronisasi Penagihan IKA: ${err.message}`);
        } finally {
            setSyncingIka(false);
        }
    };

    // Calculate Real Balances per Bank across all historical data
    const balances = useMemo(() => {
        let perBank: Record<RealBankAccount, { modalAwal: number; totalIn: number; totalOut: number; saldoReal: number }> = {
            perusahaan: { modalAwal: settings.modalAwalPerusahaan, totalIn: 0, totalOut: 0, saldoReal: settings.modalAwalPerusahaan },
            bca: { modalAwal: settings.modalAwalBca, totalIn: 0, totalOut: 0, saldoReal: settings.modalAwalBca },
            bri: { modalAwal: settings.modalAwalBri, totalIn: 0, totalOut: 0, saldoReal: settings.modalAwalBri },
            mandiri: { modalAwal: settings.modalAwalMandiri, totalIn: 0, totalOut: 0, saldoReal: settings.modalAwalMandiri },
        };

        mutations.forEach(m => {
            const amt = Number(m.amount) || 0;
            if (m.type === 'in') {
                if (perBank[m.bank]) {
                    perBank[m.bank].totalIn += amt;
                    perBank[m.bank].saldoReal += amt;
                }
            } else if (m.type === 'out') {
                if (perBank[m.bank]) {
                    perBank[m.bank].totalOut += amt;
                    perBank[m.bank].saldoReal -= amt;
                }
            } else if (m.type === 'transfer') {
                // Out from source bank
                if (perBank[m.bank]) {
                    perBank[m.bank].totalOut += amt;
                    perBank[m.bank].saldoReal -= amt;
                }
                // In to target bank
                if (m.targetBank && perBank[m.targetBank]) {
                    perBank[m.targetBank].totalIn += amt;
                    perBank[m.targetBank].saldoReal += amt;
                }
            }
        });

        const totalModalAwal = perBank.perusahaan.modalAwal + perBank.bca.modalAwal + perBank.bri.modalAwal + perBank.mandiri.modalAwal;
        const totalIn = perBank.perusahaan.totalIn + perBank.bca.totalIn + perBank.bri.totalIn + perBank.mandiri.totalIn;
        const totalOut = perBank.perusahaan.totalOut + perBank.bca.totalOut + perBank.bri.totalOut + perBank.mandiri.totalOut;
        const grandTotalSaldoReal = perBank.perusahaan.saldoReal + perBank.bca.saldoReal + perBank.bri.saldoReal + perBank.mandiri.saldoReal;

        return {
            perBank,
            totalModalAwal,
            totalIn,
            totalOut,
            grandTotalSaldoReal,
        };
    }, [settings, mutations]);

    // Calculate Running Balance in Chronological Ascending order
    const chronologicalMutationsWithBalance = useMemo(() => {
        // Sort ascending by date & createdAt
        const sorted = [...mutations].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

        // Running balance tracker per bank
        let running: Record<RealBankAccount, number> = {
            perusahaan: settings.modalAwalPerusahaan,
            bca: settings.modalAwalBca,
            bri: settings.modalAwalBri,
            mandiri: settings.modalAwalMandiri,
        };

        return sorted.map(m => {
            const amt = Number(m.amount) || 0;
            if (m.type === 'in') {
                running[m.bank] = (running[m.bank] || 0) + amt;
            } else if (m.type === 'out') {
                running[m.bank] = (running[m.bank] || 0) - amt;
            } else if (m.type === 'transfer') {
                running[m.bank] = (running[m.bank] || 0) - amt;
                if (m.targetBank) {
                    running[m.targetBank] = (running[m.targetBank] || 0) + amt;
                }
            }

            const currentBankBalance = running[m.bank] || 0;
            const totalCombinedBalance = running.perusahaan + running.bca + running.bri + running.mandiri;

            return {
                ...m,
                bankRunningBalance: currentBankBalance,
                totalRunningBalance: totalCombinedBalance,
            };
        });
    }, [mutations, settings]);

    // Filter mutations for display
    const filteredMutations = useMemo(() => {
        // Reverse back to descending for standard ledger display
        let list = [...chronologicalMutationsWithBalance].reverse();

        // 1. Bank tab filter
        if (activeBankTab !== 'all') {
            list = list.filter(m => m.bank === activeBankTab || (m.type === 'transfer' && m.targetBank === activeBankTab));
        }

        // 2. Source filter
        if (sourceFilter !== 'all') {
            list = list.filter(m => m.source === sourceFilter);
        }

        // 3. Period filter
        list = list.filter(m => {
            if (periodMode === 'all') return true;
            if (periodMode === 'month') {
                const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
                return m.date.startsWith(prefix);
            }
            if (periodMode === 'date') {
                return m.date === selectedDate;
            }
            if (periodMode === 'range') {
                return m.date >= startDate && m.date <= endDate;
            }
            return true;
        });

        // 4. Search Filter
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(m =>
                m.description.toLowerCase().includes(q) ||
                m.category.toLowerCase().includes(q) ||
                (m.refNumber && m.refNumber.toLowerCase().includes(q)) ||
                (m.clientName && m.clientName.toLowerCase().includes(q)) ||
                REAL_BANK_ACCOUNTS[m.bank]?.name.toLowerCase().includes(q)
            );
        }

        return list;
    }, [
        chronologicalMutationsWithBalance,
        activeBankTab,
        sourceFilter,
        periodMode,
        selectedMonth,
        selectedYear,
        selectedDate,
        startDate,
        endDate,
        searchTerm
    ]);

    // Pagination
    const totalPages = Math.ceil(filteredMutations.length / pageSize) || 1;
    const paginatedMutations = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredMutations.slice(start, start + pageSize);
    }, [filteredMutations, currentPage, pageSize]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeBankTab, sourceFilter, periodMode, selectedMonth, selectedYear, selectedDate, startDate, endDate, searchTerm, pageSize]);

    // Open Modal: Add Mutation
    const handleOpenAddMutation = () => {
        setEditingMutation(null);
        setFormMutationType('in');
        setFormBank(activeBankTab !== 'all' ? activeBankTab : 'bca');
        setFormTargetBank('perusahaan');
        setFormDate(new Date().toISOString().split('T')[0]);
        setFormAmount(0);
        setFormCategory('Pemasukan');
        setFormDescription('');
        setFormRefNumber('');
        setIsMutationModalOpen(true);
    };

    // Open Modal: Edit Mutation
    const handleOpenEditMutation = (m: RealBalanceMutation) => {
        if (m.source === 'penagihan_ika') {
            alert('Transaksi dari Penagihan IKA disinkronkan otomatis dari invoice. Anda dapat mengedit status atau pembayarannya langsung di modul Penagihan IKA.');
            return;
        }
        setEditingMutation(m);
        setFormMutationType(m.type);
        setFormBank(m.bank);
        setFormTargetBank(m.targetBank || 'perusahaan');
        setFormDate(m.date);
        setFormAmount(m.amount);
        setFormCategory(m.category);
        setFormDescription(m.description);
        setFormRefNumber(m.refNumber || '');
        setIsMutationModalOpen(true);
    };

    // Save Mutation (Create or Update)
    const handleSaveMutation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (formAmount <= 0) {
            alert('Nominal transaksi harus lebih dari Rp 0');
            return;
        }
        if (!formDescription.trim()) {
            alert('Keterangan / deskripsi transaksi wajib diisi');
            return;
        }
        if (formMutationType === 'transfer' && formBank === formTargetBank) {
            alert('Bank Asal dan Bank Tujuan tidak boleh sama untuk transfer antar bank');
            return;
        }

        setSubmittingMutation(true);
        try {
            if (editingMutation) {
                await updateRealMutation(editingMutation.id, {
                    date: formDate,
                    type: formMutationType,
                    bank: formBank,
                    targetBank: formMutationType === 'transfer' ? formTargetBank : undefined,
                    amount: formAmount,
                    category: formCategory,
                    description: formDescription.trim(),
                    refNumber: formRefNumber.trim() || undefined,
                });
                showToast('✅ Mutasi saldo real berhasil diperbarui!');
            } else {
                await addRealMutation({
                    userId: user.uid,
                    date: formDate,
                    type: formMutationType,
                    source: formMutationType === 'transfer' ? 'transfer' : 'manual',
                    bank: formBank,
                    targetBank: formMutationType === 'transfer' ? formTargetBank : undefined,
                    amount: formAmount,
                    category: formMutationType === 'transfer' ? 'Transfer Antar Bank' : formCategory,
                    description: formDescription.trim(),
                    refNumber: formRefNumber.trim() || undefined,
                    paidBy: user.displayName || user.email || 'User',
                }, user.uid);
                showToast('✅ Transaksi mutasi baru berhasil ditambahkan!');
            }
            setIsMutationModalOpen(false);
        } catch (err: any) {
            console.error(err);
            alert(`Gagal menyimpan mutasi: ${err.message}`);
        } finally {
            setSubmittingMutation(false);
        }
    };

    // Delete Mutation
    const handleDeleteMutation = async (m: RealBalanceMutation) => {
        if (m.source === 'penagihan_ika') {
            alert('Transaksi ini berasal dari Penagihan IKA. Silakan batalkan status lunas invoice terkait di modul Penagihan IKA jika ingin membatalkannya.');
            return;
        }
        if (confirm(`Hapus mutasi "${m.description}" sebesar ${formatRupiah(m.amount)}?`)) {
            try {
                await deleteRealMutation(m.id);
                showToast('🗑️ Mutasi berhasil dihapus.');
            } catch (err: any) {
                console.error(err);
                alert(`Gagal menghapus mutasi: ${err.message}`);
            }
        }
    };

    // Save Modal Awal Settings
    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSavingSettings(true);
        try {
            await saveRealBalanceSettings({
                modalAwalPerusahaan: formModalPerusahaan,
                modalAwalBca: formModalBca,
                modalAwalBri: formModalBri,
                modalAwalMandiri: formModalMandiri,
                effectiveDate: formEffectiveDate,
            }, user.uid, user.displayName || user.email || 'Admin');
            showToast('✅ Pengaturan modal awal 4 rekening bank berhasil disimpan!');
            setIsSettingsModalOpen(false);
        } catch (err: any) {
            console.error(err);
            alert(`Gagal menyimpan modal awal: ${err.message}`);
        } finally {
            setSavingSettings(false);
        }
    };

    // Open Print Report
    const handleOpenPrintReport = () => {
        const params = new URLSearchParams();
        if (activeBankTab !== 'all') params.set('bank', activeBankTab);
        params.set('mode', periodMode);
        if (periodMode === 'month') {
            params.set('month', String(selectedMonth));
            params.set('year', String(selectedYear));
        } else if (periodMode === 'date') {
            params.set('date', selectedDate);
        } else if (periodMode === 'range') {
            params.set('start', startDate);
            params.set('end', endDate);
        }
        router.push(`/finance/saldo-real/print?${params.toString()}`);
    };

    const MONTH_LABELS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    return (
        <ProtectedRoute>
            <div className="space-y-6 pb-24 max-w-7xl mx-auto font-sans">
                
                {/* Toast Notification */}
                {toastMessage && (
                    <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 border border-gray-700 text-xs font-semibold">
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* ── 1. TOP HEADER & ACTION BUTTONS ── */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/finance" className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                            <Building2 size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Landmark size={24} className="text-indigo-600" /> Saldo Real Bank & Kas
                            </h1>
                            <p className="text-xs text-gray-500">
                                Rekapitulasi Real-Time Kas Utama Perusahaan, Bank Mandiri, Bank BRI, & Bank BCA (Auto-Sync Penagihan IKA)
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleManualSyncIka}
                            disabled={syncingIka}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-xs disabled:opacity-50"
                            title="Sinkronkan data pelunasan invoice dari Penagihan IKA mulai 23 Agustus 2026"
                        >
                            <RefreshCw size={14} className={syncingIka ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
                            {syncingIka ? 'Menyinkronkan...' : '🔄 Sinkronkan Penagihan IKA'}
                        </button>

                        <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors shadow-xs"
                            title="Atur Modal Awal per rekening bank"
                        >
                            <Settings size={14} className="text-gray-600" /> Atur Modal Awal
                        </button>

                        <button
                            onClick={handleOpenPrintReport}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors shadow-xs"
                            title="Cetak Rekap Laporan Saldo Real PDF A4"
                        >
                            <Printer size={14} className="text-blue-600" /> 🖨️ Cetak PDF
                        </button>

                        <button
                            onClick={handleOpenAddMutation}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20 transition-all active:scale-95"
                        >
                            <Plus size={16} /> + Input Transaksi
                        </button>
                    </div>
                </div>

                {/* ── 2. TOP KPI CARDS (5 ACCOUNTS SUMMARY) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    
                    {/* Card 1: TOTAL SALDO REAL GABUNGAN */}
                    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white p-4 rounded-2xl shadow-md border border-indigo-900/50 relative overflow-hidden flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Total 4 Akun
                                </span>
                                <h3 className="text-xs font-bold text-slate-200 mt-1">TOTAL SALDO REAL</h3>
                            </div>
                            <div className="p-2 bg-white/10 rounded-xl">
                                <Wallet size={18} className="text-emerald-400" />
                            </div>
                        </div>

                        <div className="my-2">
                            <div className="text-lg sm:text-xl font-black text-white tracking-tight">
                                {formatRupiah(balances.grandTotalSaldoReal)}
                            </div>
                            <div className="text-[10px] text-slate-300 mt-0.5">
                                Modal Awal: <span className="font-semibold text-white">{formatRupiah(balances.totalModalAwal)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1 pt-2 border-t border-white/10 text-[9.5px]">
                            <div className="text-emerald-300 flex items-center gap-1 font-semibold">
                                <ArrowDownLeft size={12} /> +{formatRupiah(balances.totalIn)}
                            </div>
                            <div className="text-red-300 flex items-center gap-1 font-semibold justify-end">
                                <ArrowUpRight size={12} /> -{formatRupiah(balances.totalOut)}
                            </div>
                        </div>
                    </div>

                    {/* Card 2: BANK PERUSAHAAN (KAS UTAMA) */}
                    <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between hover:border-slate-400 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="bg-slate-100 text-slate-800 border border-slate-300 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                                    Kas Utama
                                </span>
                                <h3 className="text-xs font-bold text-gray-900 mt-1">Bank Perusahaan</h3>
                            </div>
                            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                                <Building2 size={16} />
                            </div>
                        </div>

                        <div className="my-2">
                            <div className="text-base font-extrabold text-slate-900">
                                {formatRupiah(balances.perBank.perusahaan.saldoReal)}
                            </div>
                            <div className="text-[10px] text-gray-500">
                                Modal Awal: {formatRupiah(balances.perBank.perusahaan.modalAwal)}
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-[9px] font-medium text-gray-500">
                            <span className="text-emerald-600">+{formatRupiah(balances.perBank.perusahaan.totalIn)}</span>
                            <span className="text-red-600">-{formatRupiah(balances.perBank.perusahaan.totalOut)}</span>
                        </div>
                    </div>

                    {/* Card 3: BANK BCA */}
                    <div className="bg-white p-4 rounded-2xl shadow-xs border border-blue-200 flex flex-col justify-between hover:border-blue-400 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                                    1870444342
                                </span>
                                <h3 className="text-xs font-bold text-blue-950 mt-1">Bank BCA</h3>
                            </div>
                            <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                                <Landmark size={16} />
                            </div>
                        </div>

                        <div className="my-2">
                            <div className="text-base font-extrabold text-blue-900">
                                {formatRupiah(balances.perBank.bca.saldoReal)}
                            </div>
                            <div className="text-[10px] text-gray-500">
                                Modal Awal: {formatRupiah(balances.perBank.bca.modalAwal)}
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-[9px] font-medium text-gray-500">
                            <span className="text-emerald-600">+{formatRupiah(balances.perBank.bca.totalIn)}</span>
                            <span className="text-red-600">-{formatRupiah(balances.perBank.bca.totalOut)}</span>
                        </div>
                    </div>

                    {/* Card 4: BANK BRI */}
                    <div className="bg-white p-4 rounded-2xl shadow-xs border border-sky-200 flex flex-col justify-between hover:border-sky-400 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                                    0328...501
                                </span>
                                <h3 className="text-xs font-bold text-sky-950 mt-1">Bank BRI</h3>
                            </div>
                            <div className="p-1.5 bg-sky-50 text-sky-700 rounded-lg">
                                <Landmark size={16} />
                            </div>
                        </div>

                        <div className="my-2">
                            <div className="text-base font-extrabold text-sky-900">
                                {formatRupiah(balances.perBank.bri.saldoReal)}
                            </div>
                            <div className="text-[10px] text-gray-500">
                                Modal Awal: {formatRupiah(balances.perBank.bri.modalAwal)}
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-[9px] font-medium text-gray-500">
                            <span className="text-emerald-600">+{formatRupiah(balances.perBank.bri.totalIn)}</span>
                            <span className="text-red-600">-{formatRupiah(balances.perBank.bri.totalOut)}</span>
                        </div>
                    </div>

                    {/* Card 5: BANK MANDIRI */}
                    <div className="bg-white p-4 rounded-2xl shadow-xs border border-amber-200 flex flex-col justify-between hover:border-amber-400 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                                    14000...851
                                </span>
                                <h3 className="text-xs font-bold text-amber-950 mt-1">Bank Mandiri</h3>
                            </div>
                            <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                                <Landmark size={16} />
                            </div>
                        </div>

                        <div className="my-2">
                            <div className="text-base font-extrabold text-amber-900">
                                {formatRupiah(balances.perBank.mandiri.saldoReal)}
                            </div>
                            <div className="text-[10px] text-gray-500">
                                Modal Awal: {formatRupiah(balances.perBank.mandiri.modalAwal)}
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-[9px] font-medium text-gray-500">
                            <span className="text-emerald-600">+{formatRupiah(balances.perBank.mandiri.totalIn)}</span>
                            <span className="text-red-600">-{formatRupiah(balances.perBank.mandiri.totalOut)}</span>
                        </div>
                    </div>

                </div>

                {/* ── 3. FILTER TABS & TOOLBAR ── */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                    
                    {/* Bank Account Selection Tabs */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                        <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-bold">
                            <button
                                onClick={() => setActiveBankTab('all')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${activeBankTab === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Semua Akun Bank ({mutations.length})
                            </button>
                            <button
                                onClick={() => setActiveBankTab('perusahaan')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${activeBankTab === 'perusahaan' ? 'bg-slate-800 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                🏢 Perusahaan
                            </button>
                            <button
                                onClick={() => setActiveBankTab('bca')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${activeBankTab === 'bca' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                💳 BCA
                            </button>
                            <button
                                onClick={() => setActiveBankTab('bri')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${activeBankTab === 'bri' ? 'bg-sky-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                💳 BRI
                            </button>
                            <button
                                onClick={() => setActiveBankTab('mandiri')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${activeBankTab === 'mandiri' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                💳 Mandiri
                            </button>
                        </div>

                        {/* Source Filter */}
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400 font-medium">Sumber:</span>
                            <select
                                value={sourceFilter}
                                onChange={(e) => setSourceFilter(e.target.value as any)}
                                className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 font-bold text-gray-700 outline-none text-xs"
                            >
                                <option value="all">Semua Sumber Mutasi</option>
                                <option value="penagihan_ika">Otomatis Penagihan IKA (Mulai 23 Ags 2026)</option>
                                <option value="manual">Input Manual</option>
                                <option value="transfer">Transfer Antar Bank</option>
                            </select>
                        </div>
                    </div>

                    {/* Period Controls & Search */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            
                            {/* Period Mode Selector */}
                            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
                                <button
                                    onClick={() => setPeriodMode('month')}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${periodMode === 'month' ? 'bg-white text-indigo-700 shadow-xs border border-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    Bulanan
                                </button>
                                <button
                                    onClick={() => setPeriodMode('date')}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${periodMode === 'date' ? 'bg-white text-indigo-700 shadow-xs border border-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    Harian
                                </button>
                                <button
                                    onClick={() => setPeriodMode('range')}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${periodMode === 'range' ? 'bg-white text-indigo-700 shadow-xs border border-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    Rentang
                                </button>
                                <button
                                    onClick={() => setPeriodMode('all')}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${periodMode === 'all' ? 'bg-white text-indigo-700 shadow-xs border border-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    Semua
                                </button>
                            </div>

                            {/* Conditional Period Inputs */}
                            {periodMode === 'month' && (
                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl">
                                    <Calendar size={13} className="text-gray-400" />
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        className="bg-transparent font-bold text-gray-800 outline-none text-xs cursor-pointer"
                                    >
                                        {MONTH_LABELS.map((m, idx) => (
                                            <option key={idx} value={idx}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="bg-transparent font-bold text-gray-800 outline-none text-xs cursor-pointer border-l border-gray-200 pl-1"
                                    >
                                        {[2024, 2025, 2026, 2027, 2028].map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {periodMode === 'date' && (
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 font-bold text-gray-800 outline-none text-xs"
                                />
                            )}

                            {periodMode === 'range' && (
                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-1 rounded-xl text-xs">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-transparent font-bold text-gray-800 outline-none text-xs"
                                    />
                                    <span className="text-gray-400">s/d</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-transparent font-bold text-gray-800 outline-none text-xs"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Search Box */}
                        <div className="relative w-full sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari invoice, resi, keterangan..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                </div>

                {/* ── 4. REAL BALANCE MUTATIONS TABLE ── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={15} className="text-indigo-600" /> Buku Mutasi Saldo Real
                            </h3>
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                                {filteredMutations.length} Transaksi
                            </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Tampilkan per hal:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 outline-none"
                            >
                                <option value={15}>15</option>
                                <option value={30}>30</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-100/75 border-b border-gray-200 text-gray-600 font-bold uppercase text-[9px] tracking-wider">
                                    <th className="p-3 text-center w-10">No</th>
                                    <th className="p-3 w-24">Tanggal</th>
                                    <th className="p-3 w-28">Rekening Bank</th>
                                    <th className="p-3 w-36">Kategori & Sumber</th>
                                    <th className="p-3">Keterangan / Transaksi</th>
                                    <th className="p-3 w-32 font-mono">No. Ref / Inv</th>
                                    <th className="p-3 text-right w-32 text-emerald-700">Masuk (+)</th>
                                    <th className="p-3 text-right w-32 text-red-700">Keluar (-)</th>
                                    <th className="p-3 text-right w-36 text-blue-900 font-bold">Saldo Bank (Rp)</th>
                                    <th className="p-3 text-center w-20">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700 text-xs">
                                {paginatedMutations.map((m, idx) => {
                                    const rowNo = (currentPage - 1) * pageSize + idx + 1;
                                    const bankInfo = REAL_BANK_ACCOUNTS[m.bank] || REAL_BANK_ACCOUNTS.bca;
                                    const targetBankInfo = m.targetBank ? REAL_BANK_ACCOUNTS[m.targetBank] : null;

                                    return (
                                        <tr key={m.id} className="hover:bg-indigo-50/20 transition-colors">
                                            <td className="p-3 text-center font-mono text-gray-400 text-[11px]">{rowNo}</td>
                                            <td className="p-3 font-semibold text-gray-900 whitespace-nowrap">
                                                {new Date(m.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="p-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${bankInfo.bgColor} ${bankInfo.textColor} border ${bankInfo.borderColor}`}>
                                                    {bankInfo.shortName}
                                                </span>
                                                {m.type === 'transfer' && targetBankInfo && (
                                                    <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                                                        <ArrowRight size={10} /> {targetBankInfo.shortName}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-gray-800 text-[11px]">{m.category}</div>
                                                {m.source === 'penagihan_ika' ? (
                                                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-emerald-300 inline-flex items-center gap-1 mt-0.5">
                                                        ⚡ Auto IKA
                                                    </span>
                                                ) : m.source === 'transfer' ? (
                                                    <span className="bg-purple-100 text-purple-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-purple-200 inline-flex items-center gap-1 mt-0.5">
                                                        🔄 Transfer
                                                    </span>
                                                ) : (
                                                    <span className="bg-gray-100 text-gray-600 text-[9px] font-medium px-1.5 py-0.2 rounded border border-gray-200 inline-block mt-0.5">
                                                        ✍️ Manual
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 max-w-xs">
                                                <div className="font-medium text-gray-900 truncate" title={m.description}>
                                                    {m.description}
                                                </div>
                                                {m.clientName && (
                                                    <div className="text-[10px] text-gray-500 truncate">Klien: {m.clientName}</div>
                                                )}
                                            </td>
                                            <td className="p-3 font-mono text-[10.5px] text-gray-600">
                                                {m.refNumber || '-'}
                                            </td>
                                            <td className="p-3 text-right font-semibold text-emerald-600 whitespace-nowrap">
                                                {m.type === 'in' ? `+${formatRupiah(m.amount)}` : '—'}
                                            </td>
                                            <td className="p-3 text-right font-semibold text-red-600 whitespace-nowrap">
                                                {m.type === 'out' || m.type === 'transfer' ? `-${formatRupiah(m.amount)}` : '—'}
                                            </td>
                                            <td className="p-3 text-right font-bold text-blue-950 font-mono text-xs whitespace-nowrap">
                                                {formatRupiah(m.bankRunningBalance)}
                                            </td>
                                            <td className="p-3 text-center">
                                                {m.source === 'penagihan_ika' ? (
                                                    <span className="text-[10px] text-gray-400 italic">Auto-Lock</span>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => handleOpenEditMutation(m)}
                                                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                            title="Edit mutasi manual"
                                                        >
                                                            <Edit3 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteMutation(m)}
                                                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                            title="Hapus mutasi"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredMutations.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="p-8 text-center text-gray-400 italic">
                                            {loading ? 'Memuat mutasi saldo real...' : 'Tidak ada transaksi mutasi yang cocok dengan filter.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Bar */}
                    {totalPages > 1 && (
                        <div className="p-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs">
                            <span className="text-gray-500">
                                Halaman <strong className="text-gray-800">{currentPage}</strong> dari <strong className="text-gray-800">{totalPages}</strong> (Total {filteredMutations.length} baris)
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── MODAL: INPUT MUTASI MANUAL / TRANSFER ANTAR BANK ── */}
                {isMutationModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200 border border-gray-100">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                <div>
                                    <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                                        <Landmark size={20} className="text-indigo-600" />
                                        {editingMutation ? 'Edit Mutasi Saldo Real' : 'Input Transaksi Mutasi Kas / Bank'}
                                    </h3>
                                    <p className="text-xs text-gray-500">Pencatatan uang masuk, uang keluar, atau transfer pindah saldo antar bank</p>
                                </div>
                                <button onClick={() => setIsMutationModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveMutation} className="space-y-3.5 text-xs">
                                
                                {/* Mutation Type Selector */}
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1.5">Tipe Transaksi</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormMutationType('in');
                                                setFormCategory('Pemasukan');
                                            }}
                                            className={`py-2 px-3 rounded-xl font-bold border text-center transition-all ${formMutationType === 'in' ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs ring-2 ring-emerald-200' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                        >
                                            📥 Uang Masuk (+)
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormMutationType('out');
                                                setFormCategory('Pengeluaran');
                                            }}
                                            className={`py-2 px-3 rounded-xl font-bold border text-center transition-all ${formMutationType === 'out' ? 'bg-red-50 border-red-500 text-red-900 shadow-xs ring-2 ring-red-200' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                        >
                                            📤 Uang Keluar (-)
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormMutationType('transfer');
                                                setFormCategory('Transfer Antar Bank');
                                            }}
                                            className={`py-2 px-3 rounded-xl font-bold border text-center transition-all ${formMutationType === 'transfer' ? 'bg-purple-50 border-purple-500 text-purple-900 shadow-xs ring-2 ring-purple-200' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                        >
                                            🔄 Pindah Bank
                                        </button>
                                    </div>
                                </div>

                                {/* Bank Selection */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">
                                            {formMutationType === 'transfer' ? 'Dari Bank (Sumber Dana)' : 'Rekening Bank'}
                                        </label>
                                        <select
                                            value={formBank}
                                            onChange={(e) => setFormBank(e.target.value as RealBankAccount)}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200"
                                        >
                                            <option value="bca">Bank BCA (1870444342)</option>
                                            <option value="bri">Bank BRI (0328 0107 3891 501)</option>
                                            <option value="mandiri">Bank Mandiri (14000 2408 7851)</option>
                                            <option value="perusahaan">Bank Perusahaan (Kas Utama)</option>
                                        </select>
                                    </div>

                                    {formMutationType === 'transfer' ? (
                                        <div>
                                            <label className="font-extrabold text-gray-800 block mb-1">Ke Bank (Tujuan Transfer)</label>
                                            <select
                                                value={formTargetBank}
                                                onChange={(e) => setFormTargetBank(e.target.value as RealBankAccount)}
                                                className="w-full px-3 py-2 bg-purple-50 border border-purple-300 rounded-xl font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-200"
                                            >
                                                <option value="perusahaan">Bank Perusahaan (Kas Utama)</option>
                                                <option value="bca">Bank BCA (1870444342)</option>
                                                <option value="bri">Bank BRI (0328 0107 3891 501)</option>
                                                <option value="mandiri">Bank Mandiri (14000 2408 7851)</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="font-extrabold text-gray-800 block mb-1">Tanggal Transaksi</label>
                                            <input
                                                type="date"
                                                value={formDate}
                                                onChange={(e) => setFormDate(e.target.value)}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                {formMutationType === 'transfer' && (
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Tanggal Transfer</label>
                                        <input
                                            type="date"
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none"
                                            required
                                        />
                                    </div>
                                )}

                                {/* Amount & Category */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Nominal (Rp)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="Contoh: 5000000"
                                            value={formAmount || ''}
                                            onChange={(e) => setFormAmount(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-200 text-sm"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Kategori Transaksi</label>
                                        <input
                                            type="text"
                                            placeholder="Contoh: Setoran Modal, Biaya Operasional, dll."
                                            value={formCategory}
                                            onChange={(e) => setFormCategory(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">Keterangan / Berita Acara</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Tuliskan keterangan detail transaksi..."
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200"
                                        required
                                    />
                                </div>

                                {/* Reference Number */}
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">Nomor Referensi / Bukti Transfer (Opsional)</label>
                                    <input
                                        type="text"
                                        placeholder="Contoh: TRF-BCA-88912 atau No Kwitansi"
                                        value={formRefNumber}
                                        onChange={(e) => setFormRefNumber(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200"
                                    />
                                </div>

                                {/* Modal Actions */}
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsMutationModalOpen(false)}
                                        className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingMutation}
                                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                    >
                                        <Save size={15} />
                                        {submittingMutation ? 'Menyimpan...' : 'Simpan Transaksi'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── MODAL: PENGATURAN MODAL AWAL 4 REKENING BANK ── */}
                {isSettingsModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200 border border-gray-100">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                <div>
                                    <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                                        <Settings size={20} className="text-gray-700" /> Atur Modal Awal Saldo Real
                                    </h3>
                                    <p className="text-xs text-gray-500">Saldo awal untuk masing-masing 4 rekening bank</p>
                                </div>
                                <button onClick={() => setIsSettingsModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs">
                                
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">Tanggal Mulai Efektif</label>
                                    <input
                                        type="date"
                                        value={formEffectiveDate}
                                        onChange={(e) => setFormEffectiveDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none"
                                    />
                                    <p className="text-[10px] text-indigo-600 mt-1">
                                        Penagihan IKA otomatis dihitung masuk mulai tanggal <strong>23 Agustus 2026</strong>.
                                    </p>
                                </div>

                                <div className="space-y-2.5 pt-1">
                                    <div>
                                        <label className="font-extrabold text-slate-800 block mb-1">
                                            🏢 Modal Awal Bank Perusahaan (Kas Utama)
                                        </label>
                                        <input
                                            type="number"
                                            value={formModalPerusahaan || ''}
                                            onChange={(e) => setFormModalPerusahaan(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
                                        />
                                    </div>

                                    <div>
                                        <label className="font-extrabold text-blue-900 block mb-1">
                                            💳 Modal Awal Bank BCA (1870444342)
                                        </label>
                                        <input
                                            type="number"
                                            value={formModalBca || ''}
                                            onChange={(e) => setFormModalBca(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-blue-50 border border-blue-300 rounded-xl font-mono font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-300"
                                        />
                                    </div>

                                    <div>
                                        <label className="font-extrabold text-sky-900 block mb-1">
                                            💳 Modal Awal Bank BRI (0328 0107 3891 501)
                                        </label>
                                        <input
                                            type="number"
                                            value={formModalBri || ''}
                                            onChange={(e) => setFormModalBri(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-sky-50 border border-sky-300 rounded-xl font-mono font-bold text-sky-900 outline-none focus:ring-2 focus:ring-sky-300"
                                        />
                                    </div>

                                    <div>
                                        <label className="font-extrabold text-amber-900 block mb-1">
                                            💳 Modal Awal Bank Mandiri (14000 2408 7851)
                                        </label>
                                        <input
                                            type="number"
                                            value={formModalMandiri || ''}
                                            onChange={(e) => setFormModalMandiri(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl font-mono font-bold text-amber-900 outline-none focus:ring-2 focus:ring-amber-300"
                                        />
                                    </div>
                                </div>

                                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 text-[11px] text-indigo-950 flex justify-between items-center font-bold">
                                    <span>Total Modal Awal Gabungan:</span>
                                    <span className="font-mono text-sm">{formatRupiah(formModalPerusahaan + formModalBca + formModalBri + formModalMandiri)}</span>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsSettingsModalOpen(false)}
                                        className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingSettings}
                                        className="flex-1 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                    >
                                        <Save size={15} />
                                        {savingSettings ? 'Menyimpan...' : 'Simpan Modal Awal'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </ProtectedRoute>
    );
}
