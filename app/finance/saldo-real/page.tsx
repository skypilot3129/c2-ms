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
    ChevronLeft, ChevronRight, ArrowRight, DollarSign, FileText, Check,
    SlidersHorizontal, Eye, ChevronDown, ChevronUp
} from 'lucide-react';

type FilterPeriodMode = 'month' | 'date' | 'range' | 'all';

export default function SaldoRealPage() {
    const { user } = useAuth();
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
    const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out' | 'transfer'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showMobileFilterPanel, setShowMobileFilterPanel] = useState(false);
    
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
                showToast(`✅ Sinkronisasi berhasil: ${res.addedCount} invoice baru, ${res.updatedCount} diperbarui!`);
            } else {
                showToast(`ℹ️ Semua invoice Penagihan IKA (mulai ${IKA_SYNC_START_DATE}) sudah tersinkron.`);
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
                if (perBank[m.bank]) {
                    perBank[m.bank].totalOut += amt;
                    perBank[m.bank].saldoReal -= amt;
                }
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
        const sorted = [...mutations].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

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
        let list = [...chronologicalMutationsWithBalance].reverse();

        if (activeBankTab !== 'all') {
            list = list.filter(m => m.bank === activeBankTab || (m.type === 'transfer' && m.targetBank === activeBankTab));
        }

        if (sourceFilter !== 'all') {
            list = list.filter(m => m.source === sourceFilter);
        }

        if (typeFilter !== 'all') {
            list = list.filter(m => m.type === typeFilter);
        }

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
        typeFilter,
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
    }, [activeBankTab, sourceFilter, typeFilter, periodMode, selectedMonth, selectedYear, selectedDate, startDate, endDate, searchTerm, pageSize]);

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

    const activeFilterCount = (sourceFilter !== 'all' ? 1 : 0) + (periodMode !== 'month' ? 1 : 0);

    return (
        <ProtectedRoute>
            <div className="space-y-4 sm:space-y-6 pb-28 max-w-7xl mx-auto font-sans px-2 sm:px-4">
                
                {/* Toast Notification */}
                {toastMessage && (
                    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 bg-gray-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200 border border-gray-700 text-xs font-semibold max-w-sm">
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* ── 1. TOP HEADER & ACTION BUTTONS ── */}
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <Link 
                                href="/finance" 
                                className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors border border-gray-200 shrink-0 active:scale-95"
                                title="Kembali ke Menu Keuangan"
                            >
                                <Building2 size={18} />
                            </Link>
                            <div className="min-w-0">
                                <h1 className="text-base sm:text-xl font-black text-gray-900 flex items-center gap-1.5 tracking-tight truncate">
                                    <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                                        <Landmark size={18} />
                                    </span>
                                    Saldo Real Bank & Kas
                                </h1>
                                <p className="text-[11px] sm:text-xs text-gray-500 line-clamp-1 mt-0.5">
                                    Kas Utama, Mandiri, BRI, & BCA (Auto-Sync Penagihan IKA)
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pt-1 sm:pt-0">
                            <button
                                onClick={handleManualSyncIka}
                                disabled={syncingIka}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-all shadow-xs disabled:opacity-50 shrink-0 active:scale-95"
                                title="Sinkronkan data pelunasan invoice dari Penagihan IKA"
                            >
                                <RefreshCw size={13} className={syncingIka ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
                                <span className="hidden sm:inline">{syncingIka ? 'Menyinkronkan...' : 'Sinkron IKA'}</span>
                                <span className="sm:hidden text-[11px]">{syncingIka ? 'Sync...' : 'Sync IKA'}</span>
                            </button>

                            <button
                                onClick={() => setIsSettingsModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-all shadow-xs shrink-0 active:scale-95"
                                title="Atur Modal Awal per rekening bank"
                            >
                                <Settings size={13} className="text-gray-600" /> 
                                <span className="hidden sm:inline">Modal Awal</span>
                                <span className="sm:hidden text-[11px]">Modal</span>
                            </button>

                            <button
                                onClick={handleOpenPrintReport}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-all shadow-xs shrink-0 active:scale-95"
                                title="Cetak Rekap Laporan Saldo Real PDF A4"
                            >
                                <Printer size={13} className="text-blue-600" />
                                <span className="hidden sm:inline">Cetak PDF</span>
                                <span className="sm:hidden text-[11px]">PDF</span>
                            </button>

                            <button
                                onClick={handleOpenAddMutation}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20 transition-all active:scale-95 shrink-0"
                            >
                                <Plus size={15} /> 
                                <span>+ Transaksi</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── 2. TOP KPI CARDS (RESPONSIVE HERO & BANK CARDS) ── */}
                <div className="space-y-3">
                    
                    {/* Hero Card: TOTAL SALDO REAL GABUNGAN */}
                    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-indigo-900/50 relative overflow-hidden">
                        <div className="absolute right-0 top-0 -mr-6 -mt-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[9px] sm:text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Total 4 Akun Bank
                                </span>
                                <h3 className="text-xs sm:text-sm font-bold text-slate-300 mt-1.5 flex items-center gap-1.5">
                                    TOTAL SALDO REAL GABUNGAN
                                </h3>
                            </div>
                            <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
                                <Wallet size={20} className="text-emerald-400" />
                            </div>
                        </div>

                        <div className="my-3 relative z-10">
                            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                {formatRupiah(balances.grandTotalSaldoReal)}
                            </div>
                            <div className="text-[11px] sm:text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                                <span>Modal Awal:</span>
                                <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded-md">
                                    {formatRupiah(balances.totalModalAwal)}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/10 text-[11px] sm:text-xs relative z-10">
                            <div className="text-emerald-300 flex items-center gap-1 font-bold bg-emerald-950/40 px-2.5 py-1.5 rounded-xl border border-emerald-500/20">
                                <ArrowDownLeft size={14} className="shrink-0" />
                                <div className="truncate">
                                    <span className="text-[9px] block text-emerald-400 font-normal">Total Masuk</span>
                                    +{formatRupiah(balances.totalIn)}
                                </div>
                            </div>
                            <div className="text-red-300 flex items-center gap-1 font-bold bg-rose-950/40 px-2.5 py-1.5 rounded-xl border border-rose-500/20 justify-end text-right">
                                <div className="truncate">
                                    <span className="text-[9px] block text-rose-400 font-normal">Total Keluar</span>
                                    -{formatRupiah(balances.totalOut)}
                                </div>
                                <ArrowUpRight size={14} className="shrink-0" />
                            </div>
                        </div>
                    </div>

                    {/* 4 Individual Bank Cards (Mobile: 2x2 Grid, Desktop: 4 Columns) */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                        
                        {/* Card: PERUSAHAAN (KAS UTAMA) */}
                        <div 
                            onClick={() => setActiveBankTab(prev => prev === 'perusahaan' ? 'all' : 'perusahaan')}
                            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.98] flex flex-col justify-between ${
                                activeBankTab === 'perusahaan'
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-400'
                                    : 'bg-white hover:border-slate-400 border-slate-200 text-gray-900 shadow-2xs'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                    activeBankTab === 'perusahaan' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800'
                                }`}>
                                    Kas Utama
                                </span>
                                <Building2 size={15} className={activeBankTab === 'perusahaan' ? 'text-slate-300' : 'text-slate-500'} />
                            </div>

                            <div className="my-2">
                                <h4 className={`text-[11px] font-bold ${activeBankTab === 'perusahaan' ? 'text-slate-200' : 'text-gray-700'}`}>
                                    Perusahaan
                                </h4>
                                <div className="text-sm sm:text-base font-black tracking-tight mt-0.5 truncate">
                                    {formatRupiah(balances.perBank.perusahaan.saldoReal)}
                                </div>
                            </div>

                            <div className={`pt-2 border-t text-[10px] flex justify-between items-center ${
                                activeBankTab === 'perusahaan' ? 'border-white/15 text-slate-300' : 'border-gray-100 text-gray-500'
                            }`}>
                                <span className="text-emerald-500 font-bold truncate">+{formatRupiah(balances.perBank.perusahaan.totalIn)}</span>
                                <span className="text-rose-500 font-bold truncate">-{formatRupiah(balances.perBank.perusahaan.totalOut)}</span>
                            </div>
                        </div>

                        {/* Card: BANK BCA */}
                        <div 
                            onClick={() => setActiveBankTab(prev => prev === 'bca' ? 'all' : 'bca')}
                            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.98] flex flex-col justify-between ${
                                activeBankTab === 'bca'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                                    : 'bg-white hover:border-blue-400 border-blue-200 text-gray-900 shadow-2xs'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                    activeBankTab === 'bca' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'
                                }`}>
                                    BCA 1870
                                </span>
                                <Landmark size={15} className={activeBankTab === 'bca' ? 'text-blue-100' : 'text-blue-600'} />
                            </div>

                            <div className="my-2">
                                <h4 className={`text-[11px] font-bold ${activeBankTab === 'bca' ? 'text-blue-100' : 'text-blue-950'}`}>
                                    Bank BCA
                                </h4>
                                <div className="text-sm sm:text-base font-black tracking-tight mt-0.5 truncate">
                                    {formatRupiah(balances.perBank.bca.saldoReal)}
                                </div>
                            </div>

                            <div className={`pt-2 border-t text-[10px] flex justify-between items-center ${
                                activeBankTab === 'bca' ? 'border-white/15 text-blue-100' : 'border-gray-100 text-gray-500'
                            }`}>
                                <span className="text-emerald-500 font-bold truncate">+{formatRupiah(balances.perBank.bca.totalIn)}</span>
                                <span className="text-rose-500 font-bold truncate">-{formatRupiah(balances.perBank.bca.totalOut)}</span>
                            </div>
                        </div>

                        {/* Card: BANK BRI */}
                        <div 
                            onClick={() => setActiveBankTab(prev => prev === 'bri' ? 'all' : 'bri')}
                            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.98] flex flex-col justify-between ${
                                activeBankTab === 'bri'
                                    ? 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-300'
                                    : 'bg-white hover:border-sky-400 border-sky-200 text-gray-900 shadow-2xs'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                    activeBankTab === 'bri' ? 'bg-white/20 text-white' : 'bg-sky-50 text-sky-700'
                                }`}>
                                    BRI 0328
                                </span>
                                <Landmark size={15} className={activeBankTab === 'bri' ? 'text-sky-100' : 'text-sky-600'} />
                            </div>

                            <div className="my-2">
                                <h4 className={`text-[11px] font-bold ${activeBankTab === 'bri' ? 'text-sky-100' : 'text-sky-950'}`}>
                                    Bank BRI
                                </h4>
                                <div className="text-sm sm:text-base font-black tracking-tight mt-0.5 truncate">
                                    {formatRupiah(balances.perBank.bri.saldoReal)}
                                </div>
                            </div>

                            <div className={`pt-2 border-t text-[10px] flex justify-between items-center ${
                                activeBankTab === 'bri' ? 'border-white/15 text-sky-100' : 'border-gray-100 text-gray-500'
                            }`}>
                                <span className="text-emerald-500 font-bold truncate">+{formatRupiah(balances.perBank.bri.totalIn)}</span>
                                <span className="text-rose-500 font-bold truncate">-{formatRupiah(balances.perBank.bri.totalOut)}</span>
                            </div>
                        </div>

                        {/* Card: BANK MANDIRI */}
                        <div 
                            onClick={() => setActiveBankTab(prev => prev === 'mandiri' ? 'all' : 'mandiri')}
                            className={`p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.98] flex flex-col justify-between ${
                                activeBankTab === 'mandiri'
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                                    : 'bg-white hover:border-amber-400 border-amber-200 text-gray-900 shadow-2xs'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                    activeBankTab === 'mandiri' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'
                                }`}>
                                    Mandiri 1400
                                </span>
                                <Landmark size={15} className={activeBankTab === 'mandiri' ? 'text-amber-100' : 'text-amber-600'} />
                            </div>

                            <div className="my-2">
                                <h4 className={`text-[11px] font-bold ${activeBankTab === 'mandiri' ? 'text-amber-100' : 'text-amber-950'}`}>
                                    Bank Mandiri
                                </h4>
                                <div className="text-sm sm:text-base font-black tracking-tight mt-0.5 truncate">
                                    {formatRupiah(balances.perBank.mandiri.saldoReal)}
                                </div>
                            </div>

                            <div className={`pt-2 border-t text-[10px] flex justify-between items-center ${
                                activeBankTab === 'mandiri' ? 'border-white/15 text-amber-100' : 'border-gray-100 text-gray-500'
                            }`}>
                                <span className="text-emerald-500 font-bold truncate">+{formatRupiah(balances.perBank.mandiri.totalIn)}</span>
                                <span className="text-rose-500 font-bold truncate">-{formatRupiah(balances.perBank.mandiri.totalOut)}</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── 3. FILTER TABS & SEARCH BAR ── */}
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
                    
                    {/* Bank Account Horizontal Scrollable Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <button
                            onClick={() => setActiveBankTab('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                                activeBankTab === 'all' 
                                    ? 'bg-gray-900 text-white shadow-xs' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Semua Rekening ({mutations.length})
                        </button>
                        <button
                            onClick={() => setActiveBankTab('perusahaan')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                                activeBankTab === 'perusahaan' 
                                    ? 'bg-slate-800 text-white shadow-xs' 
                                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                            }`}
                        >
                            🏢 Perusahaan
                        </button>
                        <button
                            onClick={() => setActiveBankTab('bca')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                                activeBankTab === 'bca' 
                                    ? 'bg-blue-600 text-white shadow-xs' 
                                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                            }`}
                        >
                            💳 BCA
                        </button>
                        <button
                            onClick={() => setActiveBankTab('bri')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                                activeBankTab === 'bri' 
                                    ? 'bg-sky-600 text-white shadow-xs' 
                                    : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                            }`}
                        >
                            💳 BRI
                        </button>
                        <button
                            onClick={() => setActiveBankTab('mandiri')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                                activeBankTab === 'mandiri' 
                                    ? 'bg-amber-600 text-white shadow-xs' 
                                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                            }`}
                        >
                            💳 Mandiri
                        </button>
                    </div>

                    {/* Search Bar & Filter Toggle Row */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari keterangan, invoice, resi, kategori..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-200 font-medium"
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')} 
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Toggle Advanced Filters Button */}
                        <button
                            onClick={() => setShowMobileFilterPanel(!showMobileFilterPanel)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                                showMobileFilterPanel || activeFilterCount > 0
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <SlidersHorizontal size={14} />
                            <span className="hidden sm:inline">Filter</span>
                            {activeFilterCount > 0 && (
                                <span className="w-4 h-4 bg-white text-indigo-700 rounded-full text-[10px] font-black flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Transaction Type Quick Filter (All / Masuk / Keluar / Transfer) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <button
                            onClick={() => setTypeFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                typeFilter === 'all' ? 'bg-gray-800 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Semua Tipe
                        </button>
                        <button
                            onClick={() => setTypeFilter('in')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                                typeFilter === 'in' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                        >
                            <ArrowDownLeft size={13} /> Masuk (+)
                        </button>
                        <button
                            onClick={() => setTypeFilter('out')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                                typeFilter === 'out' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                            }`}
                        >
                            <ArrowUpRight size={13} /> Keluar (-)
                        </button>
                        <button
                            onClick={() => setTypeFilter('transfer')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                                typeFilter === 'transfer' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                            }`}
                        >
                            <ArrowLeftRight size={13} /> Transfer
                        </button>
                    </div>

                    {/* Collapsible Advanced Filter Panel (Period & Source) */}
                    {showMobileFilterPanel && (
                        <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <span className="font-bold text-gray-800 flex items-center gap-1.5">
                                    <Filter size={13} className="text-indigo-600" /> Filter Periode & Sumber Data
                                </span>
                                {(sourceFilter !== 'all' || periodMode !== 'month') && (
                                    <button
                                        onClick={() => {
                                            setSourceFilter('all');
                                            setPeriodMode('month');
                                        }}
                                        className="text-[11px] text-red-600 font-bold hover:underline"
                                    >
                                        Reset Filter
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Sumber Mutasi */}
                                <div>
                                    <label className="block font-bold text-gray-700 mb-1 text-[11px]">Sumber Mutasi</label>
                                    <select
                                        value={sourceFilter}
                                        onChange={(e) => setSourceFilter(e.target.value as any)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 font-bold text-gray-800 outline-none text-xs"
                                    >
                                        <option value="all">Semua Sumber Mutasi</option>
                                        <option value="penagihan_ika">Otomatis Penagihan IKA (23 Ags+)</option>
                                        <option value="manual">Manual Input</option>
                                        <option value="transfer">Transfer Antar Bank</option>
                                    </select>
                                </div>

                                {/* Mode Periode */}
                                <div>
                                    <label className="block font-bold text-gray-700 mb-1 text-[11px]">Mode Periode</label>
                                    <div className="grid grid-cols-4 gap-1">
                                        {(['month', 'date', 'range', 'all'] as FilterPeriodMode[]).map((mode) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => setPeriodMode(mode)}
                                                className={`py-1 px-1 rounded-lg text-center font-bold text-[10.5px] transition-all capitalize ${
                                                    periodMode === mode 
                                                        ? 'bg-indigo-600 text-white shadow-xs' 
                                                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                                }`}
                                            >
                                                {mode === 'month' ? 'Bulan' : mode === 'date' ? 'Hari' : mode === 'range' ? 'Rentang' : 'Semua'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Period Inputs */}
                            {periodMode === 'month' && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <span className="text-gray-500 text-[11px]">Pilih Bulan & Tahun:</span>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        className="bg-white border border-gray-200 rounded-xl px-2.5 py-1 font-bold text-gray-800 text-xs"
                                    >
                                        {MONTH_LABELS.map((m, idx) => (
                                            <option key={idx} value={idx}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="bg-white border border-gray-200 rounded-xl px-2.5 py-1 font-bold text-gray-800 text-xs"
                                    >
                                        {[2024, 2025, 2026, 2027, 2028].map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {periodMode === 'date' && (
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-gray-500 text-[11px]">Tanggal:</span>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-3 py-1 font-bold text-gray-800 text-xs"
                                    />
                                </div>
                            )}

                            {periodMode === 'range' && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-2 py-1 font-bold text-gray-800 text-xs"
                                    />
                                    <span className="text-gray-400">s/d</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-2 py-1 font-bold text-gray-800 text-xs"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* ── 4. MUTATION LEDGER (DUAL VIEW: MOBILE CARDS & DESKTOP TABLE) ── */}
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
                    {/* Header Bar */}
                    <div className="p-3.5 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={15} className="text-indigo-600" /> Buku Mutasi Saldo Real
                            </h3>
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                                {filteredMutations.length} Transaksi
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <span className="hidden sm:inline">Per hal:</span>
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

                    {/* ── MOBILE VIEW: MODERN TRANSACTION CARDS (Visible on < md) ── */}
                    <div className="block md:hidden divide-y divide-gray-100">
                        {loading ? (
                            <div className="p-8 text-center text-gray-400">
                                <RefreshCw className="animate-spin mx-auto text-indigo-600 mb-2" size={24} />
                                <p className="text-xs">Memuat mutasi saldo real...</p>
                            </div>
                        ) : paginatedMutations.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 italic text-xs">
                                Tidak ada transaksi mutasi yang cocok dengan filter.
                            </div>
                        ) : (
                            paginatedMutations.map((m, idx) => {
                                const bankInfo = REAL_BANK_ACCOUNTS[m.bank] || REAL_BANK_ACCOUNTS.bca;
                                const targetBankInfo = m.targetBank ? REAL_BANK_ACCOUNTS[m.targetBank] : null;
                                const isIncome = m.type === 'in';
                                const isExpense = m.type === 'out';
                                const isTransfer = m.type === 'transfer';

                                return (
                                    <div 
                                        key={m.id} 
                                        className={`p-3.5 transition-colors ${
                                            isIncome ? 'bg-emerald-50/25' : isExpense ? 'bg-rose-50/25' : 'bg-purple-50/25'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2.5">
                                            {/* Type Icon Badge */}
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <div className={`p-2 rounded-xl shrink-0 ${
                                                    isIncome 
                                                        ? 'bg-emerald-100 text-emerald-700' 
                                                        : isExpense 
                                                        ? 'bg-rose-100 text-rose-700' 
                                                        : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {isIncome ? (
                                                        <ArrowDownLeft size={16} />
                                                    ) : isExpense ? (
                                                        <ArrowUpRight size={16} />
                                                    ) : (
                                                        <ArrowLeftRight size={16} />
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {/* Bank Pill */}
                                                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${bankInfo.bgColor} ${bankInfo.textColor} border ${bankInfo.borderColor}`}>
                                                            {bankInfo.shortName}
                                                        </span>
                                                        {isTransfer && targetBankInfo && (
                                                            <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                                                                <ArrowRight size={10} /> {targetBankInfo.shortName}
                                                            </span>
                                                        )}

                                                        {/* Source Badge */}
                                                        {m.source === 'penagihan_ika' ? (
                                                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-emerald-300">
                                                                Auto IKA
                                                            </span>
                                                        ) : m.source === 'transfer' ? (
                                                            <span className="bg-purple-100 text-purple-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-purple-200">
                                                                Transfer
                                                            </span>
                                                        ) : (
                                                            <span className="bg-gray-100 text-gray-600 text-[9px] font-medium px-1.5 py-0.2 rounded border border-gray-200">
                                                                Manual
                                                            </span>
                                                        )}

                                                        <span className="text-[10px] text-gray-400 font-mono ml-auto">
                                                            {new Date(m.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    </div>

                                                    <h4 className="text-xs font-bold text-gray-900 mt-1 leading-snug break-words">
                                                        {m.description}
                                                    </h4>

                                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                                                        <span className="font-semibold text-gray-600">{m.category}</span>
                                                        {m.refNumber && (
                                                            <span className="font-mono text-gray-400">• {m.refNumber}</span>
                                                        )}
                                                        {m.clientName && (
                                                            <span className="text-gray-600 truncate">• {m.clientName}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Amount & Running Balance */}
                                            <div className="text-right shrink-0">
                                                <div className={`text-sm font-black tracking-tight ${
                                                    isIncome ? 'text-emerald-700' : isExpense ? 'text-rose-700' : 'text-purple-700'
                                                }`}>
                                                    {isIncome ? `+${formatRupiah(m.amount)}` : `-${formatRupiah(m.amount)}`}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                    Saldo: <span className="font-bold text-blue-950">{formatRupiah(m.bankRunningBalance)}</span>
                                                </div>

                                                {/* Edit / Delete actions for manual entries */}
                                                {m.source !== 'penagihan_ika' && (
                                                    <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                                        <button
                                                            onClick={() => handleOpenEditMutation(m)}
                                                            className="p-1 text-gray-400 hover:text-blue-600 bg-white border border-gray-200 rounded-md shadow-2xs"
                                                            title="Edit"
                                                        >
                                                            <Edit3 size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteMutation(m)}
                                                            className="p-1 text-gray-400 hover:text-red-600 bg-white border border-gray-200 rounded-md shadow-2xs"
                                                            title="Hapus"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* ── DESKTOP VIEW: FULL DATA TABLE (Visible on >= md) ── */}
                    <div className="hidden md:block overflow-x-auto">
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

                                    const isIncome = m.type === 'in';
                                    const isExpense = m.type === 'out';
                                    const isTransfer = m.type === 'transfer';

                                    const rowBgClass = isIncome 
                                        ? 'bg-emerald-50/20 hover:bg-emerald-50/60 border-l-4 border-l-emerald-500' 
                                        : isExpense 
                                        ? 'bg-rose-50/20 hover:bg-rose-50/60 border-l-4 border-l-rose-500' 
                                        : 'bg-purple-50/20 hover:bg-purple-50/60 border-l-4 border-l-purple-500';

                                    return (
                                        <tr key={m.id} className={`${rowBgClass} transition-colors`}>
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
                        <div className="p-3 sm:p-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs">
                            <span className="text-gray-500 text-[11px] sm:text-xs">
                                Hal <strong className="text-gray-800">{currentPage}</strong> / <strong className="text-gray-800">{totalPages}</strong> ({filteredMutations.length} data)
                            </span>
                            <div className="flex items-center gap-1 sm:gap-1.5">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors flex items-center gap-1 font-bold text-gray-700"
                                >
                                    <ChevronLeft size={14} />
                                    <span className="hidden sm:inline">Prev</span>
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors flex items-center gap-1 font-bold text-gray-700"
                                >
                                    <span className="hidden sm:inline">Next</span>
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 5. MOBILE FLOATING ACTION BUTTON (FAB) ── */}
                <button
                    onClick={handleOpenAddMutation}
                    className="sm:hidden fixed bottom-6 right-4 z-40 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-xs active:scale-95 border border-white/20"
                >
                    <Plus size={18} />
                    <span>+ Transaksi</span>
                </button>

                {/* ── MODAL: INPUT MUTASI MANUAL / TRANSFER ANTAR BANK (MOBILE FRIENDLY BOTTOM-SHEET) ── */}
                {isMutationModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in duration-200">
                            
                            {/* Modal Header */}
                            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/60 shrink-0">
                                <div>
                                    <h3 className="font-black text-gray-900 text-sm sm:text-base flex items-center gap-2">
                                        <Landmark size={18} className="text-indigo-600" />
                                        {editingMutation ? 'Edit Mutasi Saldo Real' : 'Input Transaksi Mutasi Kas & Bank'}
                                    </h3>
                                    <p className="text-[11px] text-gray-500 mt-0.5">Pencatatan uang masuk, keluar, atau pindah antar bank</p>
                                </div>
                                <button 
                                    onClick={() => setIsMutationModalOpen(false)} 
                                    className="p-1.5 hover:bg-gray-200/80 rounded-full text-gray-400 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Form Scrollable Content */}
                            <form onSubmit={handleSaveMutation} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
                                
                                {/* Mutation Type Selector */}
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1.5 text-xs">Tipe Transaksi</label>
                                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormMutationType('in');
                                                setFormCategory('Pemasukan');
                                            }}
                                            className={`py-2.5 px-2 rounded-xl font-bold border text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
                                                formMutationType === 'in' 
                                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs ring-2 ring-emerald-200' 
                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            <ArrowDownLeft size={14} className="text-emerald-600" />
                                            <span className="text-[11px]">Masuk (+)</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormMutationType('out');
                                                setFormCategory('Pengeluaran');
                                            }}
                                            className={`py-2.5 px-2 rounded-xl font-bold border text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
                                                formMutationType === 'out' 
                                                    ? 'bg-red-50 border-red-500 text-red-900 shadow-xs ring-2 ring-red-200' 
                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            <ArrowUpRight size={14} className="text-rose-600" />
                                            <span className="text-[11px]">Keluar (-)</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormMutationType('transfer');
                                                setFormCategory('Transfer Antar Bank');
                                            }}
                                            className={`py-2.5 px-2 rounded-xl font-bold border text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
                                                formMutationType === 'transfer' 
                                                    ? 'bg-purple-50 border-purple-500 text-purple-900 shadow-xs ring-2 ring-purple-200' 
                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            <ArrowLeftRight size={14} className="text-purple-600" />
                                            <span className="text-[11px]">Transfer</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Bank Selection */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1 text-xs">
                                            {formMutationType === 'transfer' ? 'Dari Bank (Sumber Dana)' : 'Rekening Bank'}
                                        </label>
                                        <select
                                            value={formBank}
                                            onChange={(e) => setFormBank(e.target.value as RealBankAccount)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200 text-xs sm:text-xs"
                                        >
                                            <option value="bca">Bank BCA (1870444342)</option>
                                            <option value="bri">Bank BRI (0328 0107 3891 501)</option>
                                            <option value="mandiri">Bank Mandiri (14000 2408 7851)</option>
                                            <option value="perusahaan">Bank Perusahaan (Kas Utama)</option>
                                        </select>
                                    </div>

                                    {formMutationType === 'transfer' ? (
                                        <div>
                                            <label className="font-extrabold text-gray-800 block mb-1 text-xs">Ke Bank (Tujuan Transfer)</label>
                                            <select
                                                value={formTargetBank}
                                                onChange={(e) => setFormTargetBank(e.target.value as RealBankAccount)}
                                                className="w-full px-3 py-2.5 bg-purple-50 border border-purple-300 rounded-xl font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-200 text-xs sm:text-xs"
                                            >
                                                <option value="perusahaan">Bank Perusahaan (Kas Utama)</option>
                                                <option value="bca">Bank BCA (1870444342)</option>
                                                <option value="bri">Bank BRI (0328 0107 3891 501)</option>
                                                <option value="mandiri">Bank Mandiri (14000 2408 7851)</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="font-extrabold text-gray-800 block mb-1 text-xs">Tanggal Transaksi</label>
                                            <input
                                                type="date"
                                                value={formDate}
                                                onChange={(e) => setFormDate(e.target.value)}
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200 text-xs sm:text-xs"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                {formMutationType === 'transfer' && (
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1 text-xs">Tanggal Transfer</label>
                                        <input
                                            type="date"
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none text-xs sm:text-xs"
                                            required
                                        />
                                    </div>
                                )}

                                {/* Amount & Category */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1 text-xs">Nominal (Rp)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="Contoh: 5000000"
                                            value={formAmount || ''}
                                            onChange={(e) => setFormAmount(Number(e.target.value))}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-200 text-sm"
                                            required
                                        />
                                        {formAmount > 0 && (
                                            <p className="text-[11px] font-bold text-indigo-600 mt-1">
                                                {formatRupiah(formAmount)}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1 text-xs">Kategori Transaksi</label>
                                        <input
                                            type="text"
                                            placeholder="Setoran Modal, Biaya Ops, dll."
                                            value={formCategory}
                                            onChange={(e) => setFormCategory(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200 text-xs sm:text-xs"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1 text-xs">Keterangan / Berita Acara</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Tuliskan detail berita acara transaksi..."
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200 text-xs sm:text-xs"
                                        required
                                    />
                                </div>

                                {/* Reference Number */}
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1 text-xs">Nomor Referensi / Bukti Transfer (Opsional)</label>
                                    <input
                                        type="text"
                                        placeholder="Contoh: TRF-BCA-88912 atau No Kwitansi"
                                        value={formRefNumber}
                                        onChange={(e) => setFormRefNumber(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200 text-xs sm:text-xs"
                                    />
                                </div>

                                {/* Modal Actions Footer */}
                                <div className="flex items-center gap-2.5 pt-2 pb-1 sticky bottom-0 bg-white">
                                    <button
                                        type="button"
                                        onClick={() => setIsMutationModalOpen(false)}
                                        className="flex-1 py-3 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-xs"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingMutation}
                                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-xs"
                                    >
                                        <Save size={14} />
                                        {submittingMutation ? 'Menyimpan...' : 'Simpan Transaksi'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── MODAL: PENGATURAN MODAL AWAL 4 REKENING BANK (MOBILE FRIENDLY BOTTOM-SHEET) ── */}
                {isSettingsModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in duration-200">
                            
                            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/60 shrink-0">
                                <div>
                                    <h3 className="font-black text-gray-900 text-sm sm:text-base flex items-center gap-2">
                                        <Settings size={18} className="text-gray-700" /> Atur Modal Awal Saldo Real
                                    </h3>
                                    <p className="text-[11px] text-gray-500 mt-0.5">Saldo awal untuk 4 rekening bank</p>
                                </div>
                                <button 
                                    onClick={() => setIsSettingsModalOpen(false)} 
                                    className="p-1.5 hover:bg-gray-200/80 rounded-full text-gray-400 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveSettings} className="p-4 sm:p-6 overflow-y-auto space-y-3.5 text-xs">
                                
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">Tanggal Mulai Efektif</label>
                                    <input
                                        type="date"
                                        value={formEffectiveDate}
                                        onChange={(e) => setFormEffectiveDate(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none text-xs"
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
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 text-xs sm:text-xs"
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
                                            className="w-full px-3 py-2.5 bg-blue-50 border border-blue-300 rounded-xl font-mono font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-300 text-xs sm:text-xs"
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
                                            className="w-full px-3 py-2.5 bg-sky-50 border border-sky-300 rounded-xl font-mono font-bold text-sky-900 outline-none focus:ring-2 focus:ring-sky-300 text-xs sm:text-xs"
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
                                            className="w-full px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-xl font-mono font-bold text-amber-900 outline-none focus:ring-2 focus:ring-amber-300 text-xs sm:text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 text-[11px] text-indigo-950 flex justify-between items-center font-bold">
                                    <span>Total Modal Awal:</span>
                                    <span className="font-mono text-sm">{formatRupiah(formModalPerusahaan + formModalBca + formModalBri + formModalMandiri)}</span>
                                </div>

                                <div className="flex items-center gap-2.5 pt-2 sticky bottom-0 bg-white">
                                    <button
                                        type="button"
                                        onClick={() => setIsSettingsModalOpen(false)}
                                        className="flex-1 py-3 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-xs"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingSettings}
                                        className="flex-1 py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-xs"
                                    >
                                        <Save size={14} />
                                        {savingSettings ? 'Menyimpan...' : 'Simpan Modal'}
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
