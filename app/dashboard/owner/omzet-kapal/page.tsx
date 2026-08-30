'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { subscribeToVoyages } from '@/lib/firestore-voyages';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import {
    subscribeToOwnerShipExpenses,
    saveOwnerShipExpense,
    deleteOwnerShipExpense
} from '@/lib/firestore-owner-ship-expenses';
import type { Voyage } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import type { OwnerShipExpense, OwnerShipSummaryRow } from '@/types/owner-ship-report';
import { formatRupiah } from '@/lib/currency';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    Ship, Crown, ArrowLeft, Plus, Printer, Search, Calendar,
    TrendingUp, TrendingDown, DollarSign, Wallet, CheckCircle2,
    Clock, AlertCircle, Edit3, Trash2, X, Save, RefreshCw,
    Sparkles, ArrowRight, Layers, FileText, ChevronRight, PieChart,
    Truck, UserCheck, Ticket, Building2, MapPin
} from 'lucide-react';

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function OwnerOmzetKapalPage() {
    const { user, role } = useAuth();
    const router = useRouter();

    const [voyages, setVoyages] = useState<Voyage[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [manualExpenses, setManualExpenses] = useState<OwnerShipExpense[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [filterPeriodMode, setFilterPeriodMode] = useState<'month' | 'all'>('month');
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedShipFilter, setSelectedShipFilter] = useState('');

    // Modal state for Input / Edit Manual Expenses
    const [isCostModalOpen, setIsCostModalOpen] = useState(false);
    const [selectedVoyageForCost, setSelectedVoyageForCost] = useState<Voyage | null>(null);

    // Cost Form Fields
    const [formTiket, setFormTiket] = useState<number>(0);
    const [formOpsMakassar, setFormOpsMakassar] = useState<number>(0);
    const [formOpsSurabaya, setFormOpsSurabaya] = useState<number>(0);
    const [formGajiSopir, setFormGajiSopir] = useState<number>(0);
    const [formSewaMobil, setFormSewaMobil] = useState<number>(0);
    const [formOpsTambahan, setFormOpsTambahan] = useState<number>(0);
    const [formNotes, setFormNotes] = useState<string>('');
    const [savingCost, setSavingCost] = useState(false);

    // Toast message state
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Subscriptions
    useEffect(() => {
        if (!user) return;
        setLoading(true);

        const unsubVoyages = subscribeToVoyages(user.uid, (data) => {
            setVoyages(data);
        });

        const unsubTransactions = subscribeToTransactions((data) => {
            setTransactions(data);
        }, user.uid);

        const unsubExpenses = subscribeToOwnerShipExpenses((data) => {
            setManualExpenses(data);
            setLoading(false);
        });

        return () => {
            unsubVoyages();
            unsubTransactions();
            unsubExpenses();
        };
    }, [user]);

    // Fast Lookup Map for Transactions
    const txMap = useMemo(() => {
        const map = new Map<string, Transaction>();
        transactions.forEach(t => map.set(t.id, t));
        return map;
    }, [transactions]);

    // Fast Lookup Map for Manual Expenses by voyageId
    const expensesMap = useMemo(() => {
        const map = new Map<string, OwnerShipExpense>();
        manualExpenses.forEach(e => map.set(e.voyageId, e));
        return map;
    }, [manualExpenses]);

    // Unique Ship Names for Filter Dropdown
    const uniqueShipNames = useMemo(() => {
        const set = new Set<string>();
        voyages.forEach(v => {
            if (v.shipName && v.shipName.trim()) set.add(v.shipName.trim());
        });
        return Array.from(set).sort();
    }, [voyages]);

    // Consolidated Rows: Voyage + Auto Revenue from STTs + Manual Costs
    const consolidatedRows = useMemo<OwnerShipSummaryRow[]>(() => {
        return voyages.map(v => {
            // 1. Calculate automatic revenue from linked STTs
            const linkedTxList = (v.transactionIds || [])
                .map(id => txMap.get(id))
                .filter((t): t is Transaction => t !== undefined && t.status !== 'dibatalkan');

            let totalRevenue = 0;
            linkedTxList.forEach(t => {
                const subtotal = Number(t.jumlah) || 0;
                const ppn = t.isTaxable || (t.ppn && Number(t.ppn) > 0) ? Math.round(subtotal * 0.011) : 0;
                totalRevenue += (subtotal + ppn);
            });

            // 2. Lookup manual expenses
            const manualCost = expensesMap.get(v.id);
            const tiket = manualCost?.tiket || 0;
            const opsMakassar = manualCost?.opsMakassar || 0;
            const opsSurabaya = manualCost?.opsSurabaya || 0;
            const gajiSopir = manualCost?.gajiSopir || 0;
            const sewaMobil = manualCost?.sewaMobil || 0;
            const opsTambahan = manualCost?.opsTambahan || 0;
            const notes = manualCost?.notes || '';
            const hasManualExpense = manualCost !== undefined;

            const totalExpenses = tiket + opsMakassar + opsSurabaya + gajiSopir + sewaMobil + opsTambahan;
            const netProfit = totalRevenue - totalExpenses;
            const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

            const depDateObj = v.departureDate instanceof Date ? v.departureDate : new Date(v.departureDate);
            const depDateStr = !isNaN(depDateObj.getTime()) ? depDateObj.toISOString().split('T')[0] : '';

            return {
                voyageId: v.id,
                voyageNumber: v.voyageNumber,
                shipName: v.shipName || 'Kapal Belum Dipilih',
                departureDate: depDateObj,
                departureDateStr: depDateStr,
                route: v.route || 'Rute Belum Diatur',
                vehicleNumbers: v.vehicleNumbers || (v.vehicleNumber ? [v.vehicleNumber] : []),
                status: v.status,
                sttCount: linkedTxList.length,
                totalRevenue,
                tiket,
                opsMakassar,
                opsSurabaya,
                gajiSopir,
                sewaMobil,
                opsTambahan,
                totalExpenses,
                netProfit,
                profitMargin,
                notes,
                hasManualExpense,
            };
        });
    }, [voyages, txMap, expensesMap]);

    // Filtered Rows for display
    const filteredRows = useMemo(() => {
        let list = [...consolidatedRows];

        // 1. Period filter
        if (filterPeriodMode === 'month') {
            const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
            list = list.filter(r => r.departureDateStr.startsWith(prefix));
        }

        // 2. Ship filter
        if (selectedShipFilter) {
            list = list.filter(r => r.shipName.toLowerCase() === selectedShipFilter.toLowerCase());
        }

        // 3. Search filter
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(r =>
                r.shipName.toLowerCase().includes(q) ||
                r.voyageNumber.toLowerCase().includes(q) ||
                r.route.toLowerCase().includes(q) ||
                r.vehicleNumbers.some(vn => vn.toLowerCase().includes(q))
            );
        }

        // Sort by departureDate descending (newest first)
        list.sort((a, b) => b.departureDate.getTime() - a.departureDate.getTime());

        return list;
    }, [consolidatedRows, filterPeriodMode, selectedMonth, selectedYear, selectedShipFilter, searchTerm]);

    // Overall Totals for Executive KPI
    const kpiTotals = useMemo(() => {
        let totalRevenue = 0;
        let totalTiket = 0;
        let totalOpsMakassar = 0;
        let totalOpsSurabaya = 0;
        let totalGajiSopir = 0;
        let totalSewaMobil = 0;
        let totalOpsTambahan = 0;
        let totalExpenses = 0;

        filteredRows.forEach(r => {
            totalRevenue += r.totalRevenue;
            totalTiket += r.tiket;
            totalOpsMakassar += r.opsMakassar;
            totalOpsSurabaya += r.opsSurabaya;
            totalGajiSopir += r.gajiSopir;
            totalSewaMobil += r.sewaMobil;
            totalOpsTambahan += r.opsTambahan;
            totalExpenses += r.totalExpenses;
        });

        const netProfit = totalRevenue - totalExpenses;
        const avgMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

        return {
            totalRevenue,
            totalTiket,
            totalOpsMakassar,
            totalOpsSurabaya,
            totalGajiSopir,
            totalSewaMobil,
            totalOpsTambahan,
            totalExpenses,
            netProfit,
            avgMargin,
            shipCount: filteredRows.length,
        };
    }, [filteredRows]);

    // Open Modal: Input / Edit Costs for a voyage
    const handleOpenCostModal = (voyage: Voyage) => {
        setSelectedVoyageForCost(voyage);
        const existing = expensesMap.get(voyage.id);
        if (existing) {
            setFormTiket(existing.tiket || 0);
            setFormOpsMakassar(existing.opsMakassar || 0);
            setFormOpsSurabaya(existing.opsSurabaya || 0);
            setFormGajiSopir(existing.gajiSopir || 0);
            setFormSewaMobil(existing.sewaMobil || 0);
            setFormOpsTambahan(existing.opsTambahan || 0);
            setFormNotes(existing.notes || '');
        } else {
            setFormTiket(0);
            setFormOpsMakassar(0);
            setFormOpsSurabaya(0);
            setFormGajiSopir(0);
            setFormSewaMobil(0);
            setFormOpsTambahan(0);
            setFormNotes('');
        }
        setIsCostModalOpen(true);
    };

    // Save Manual Costs
    const handleSaveCost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVoyageForCost || !user) return;
        setSavingCost(true);

        try {
            const depDateObj = selectedVoyageForCost.departureDate instanceof Date 
                ? selectedVoyageForCost.departureDate 
                : new Date(selectedVoyageForCost.departureDate);
            const depDateStr = !isNaN(depDateObj.getTime()) ? depDateObj.toISOString().split('T')[0] : '';

            await saveOwnerShipExpense({
                voyageId: selectedVoyageForCost.id,
                voyageNumber: selectedVoyageForCost.voyageNumber,
                shipName: selectedVoyageForCost.shipName || '',
                departureDate: depDateStr,
                route: selectedVoyageForCost.route || '',
                tiket: Number(formTiket) || 0,
                opsMakassar: Number(formOpsMakassar) || 0,
                opsSurabaya: Number(formOpsSurabaya) || 0,
                gajiSopir: Number(formGajiSopir) || 0,
                sewaMobil: Number(formSewaMobil) || 0,
                opsTambahan: Number(formOpsTambahan) || 0,
                notes: formNotes.trim(),
            }, user.uid, user.displayName || user.email || 'Owner');

            showToast(`✅ Biaya operasional kapal ${selectedVoyageForCost.shipName || selectedVoyageForCost.voyageNumber} berhasil disimpan!`);
            setIsCostModalOpen(false);
        } catch (err: any) {
            console.error(err);
            alert(`Gagal menyimpan biaya kapal: ${err.message}`);
        } finally {
            setSavingCost(false);
        }
    };

    // Delete Manual Costs
    const handleDeleteCost = async (voyageId: string, shipName: string) => {
        if (confirm(`Hapus / reset rincian biaya manual untuk ${shipName}?`)) {
            try {
                await deleteOwnerShipExpense(voyageId);
                showToast('🗑️ Biaya operasional kapal berhasil direset.');
            } catch (err: any) {
                console.error(err);
                alert(`Gagal menghapus data: ${err.message}`);
            }
        }
    };

    // Navigation to Print Report
    const handleOpenPrintPage = () => {
        const params = new URLSearchParams();
        params.set('mode', filterPeriodMode);
        if (filterPeriodMode === 'month') {
            params.set('month', String(selectedMonth));
            params.set('year', String(selectedYear));
        }
        if (selectedShipFilter) {
            params.set('ship', selectedShipFilter);
        }
        router.push(`/dashboard/owner/omzet-kapal/print?${params.toString()}`);
    };

    // Selected Voyage Revenue for Modal Live Preview
    const selectedVoyageRevenue = useMemo(() => {
        if (!selectedVoyageForCost) return 0;
        const linked = (selectedVoyageForCost.transactionIds || [])
            .map(id => txMap.get(id))
            .filter((t): t is Transaction => t !== undefined && t.status !== 'dibatalkan');
        return linked.reduce((sum, t) => {
            const subtotal = Number(t.jumlah) || 0;
            const ppn = t.isTaxable || (t.ppn && Number(t.ppn) > 0) ? Math.round(subtotal * 0.011) : 0;
            return sum + subtotal + ppn;
        }, 0);
    }, [selectedVoyageForCost, txMap]);

    const formTotalCost = formTiket + formOpsMakassar + formOpsSurabaya + formGajiSopir + formSewaMobil + formOpsTambahan;
    const formEstimatedProfit = selectedVoyageRevenue - formTotalCost;
    const formEstimatedMargin = selectedVoyageRevenue > 0 ? Math.round((formEstimatedProfit / selectedVoyageRevenue) * 100) : 0;

    return (
        <ProtectedRoute>
            <div className="space-y-6 pb-24 max-w-7xl mx-auto font-sans">
                
                {/* Toast Notification */}
                {toastMessage && (
                    <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 border border-gray-700 text-xs font-semibold">
                        <Sparkles size={16} className="text-amber-400 animate-pulse" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* ── 1. TOP HEADER & NAVIGATION ── */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/owner" className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
                                    <Crown size={12} /> OWNER EXECUTIVE HUB
                                </span>
                                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Ship size={22} className="text-blue-600" /> Laporan Omzet &amp; Keuntungan Per-Kapal
                                </h1>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Omzet otomatis dari data Pemberangkatan (STT) vs Input Biaya Manual (Tiket, Ops MKS, Ops SBY, Gaji Sopir, Sewa Mobil, Ops Tambahan)
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleOpenPrintPage}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors shadow-xs"
                        >
                            <Printer size={15} className="text-blue-600" /> 🖨️ Cetak PDF Rekap
                        </button>
                    </div>
                </div>

                {/* ── 2. EXECUTIVE 4-CARD FINANCIAL SUMMARY ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Card 1: Total Omzet Kapal */}
                    <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-5 rounded-2xl shadow-md border border-blue-900/50 flex flex-col justify-between relative overflow-hidden">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full">
                                    Auto dari {kpiTotals.shipCount} Kapal
                                </span>
                                <h3 className="text-xs font-bold text-slate-300 mt-1.5">TOTAL OMZET KAPAL</h3>
                            </div>
                            <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-300">
                                <DollarSign size={20} />
                            </div>
                        </div>

                        <div className="my-3">
                            <div className="text-2xl font-black text-white tracking-tight">
                                {formatRupiah(kpiTotals.totalRevenue)}
                            </div>
                            <div className="text-[11px] text-blue-200 mt-1">
                                Akumulasi seluruh muatan STT kapal
                            </div>
                        </div>

                        <div className="pt-2 border-t border-white/10 text-[10px] text-slate-300 flex items-center justify-between font-medium">
                            <span>Status: {filterPeriodMode === 'month' ? `Bulan ${MONTH_NAMES[selectedMonth]} ${selectedYear}` : 'Semua Periode'}</span>
                            <span className="text-blue-400 font-bold">{kpiTotals.shipCount} Keberangkatan</span>
                        </div>
                    </div>

                    {/* Card 2: Total Pengeluaran Biaya Kapal */}
                    <div className="bg-white p-5 rounded-2xl shadow-xs border border-rose-200 flex flex-col justify-between hover:border-rose-300 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                    Input Biaya Manual
                                </span>
                                <h3 className="text-xs font-bold text-gray-800 mt-1.5">TOTAL PENGELUARAN KAPAL</h3>
                            </div>
                            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                                <TrendingDown size={20} />
                            </div>
                        </div>

                        <div className="my-3">
                            <div className="text-2xl font-black text-rose-700 tracking-tight">
                                {formatRupiah(kpiTotals.totalExpenses)}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-1">
                                Tiket + Ops MKS/SBY + Gaji + Sewa + Tambahan
                            </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 flex items-center justify-between font-medium">
                            <span>Tiket: {formatRupiah(kpiTotals.totalTiket)}</span>
                            <span className="text-rose-600 font-bold">Ops: {formatRupiah(kpiTotals.totalOpsMakassar + kpiTotals.totalOpsSurabaya)}</span>
                        </div>
                    </div>

                    {/* Card 3: Total Laba Bersih Owner */}
                    <div className="bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white p-5 rounded-2xl shadow-md border border-emerald-800/50 flex flex-col justify-between relative overflow-hidden">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                                    Net Profit Owner
                                </span>
                                <h3 className="text-xs font-bold text-emerald-200 mt-1.5">TOTAL LABA BERSIH</h3>
                            </div>
                            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-300">
                                <Wallet size={20} />
                            </div>
                        </div>

                        <div className="my-3">
                            <div className="text-2xl font-black text-emerald-300 tracking-tight">
                                {formatRupiah(kpiTotals.netProfit)}
                            </div>
                            <div className="text-[11px] text-emerald-200 mt-1">
                                Omzet dikurangi Total Seluruh Biaya
                            </div>
                        </div>

                        <div className="pt-2 border-t border-white/10 text-[10px] text-emerald-200 flex items-center justify-between font-bold">
                            <span>Status Finansial</span>
                            <span className={kpiTotals.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                {kpiTotals.netProfit >= 0 ? 'Surplus / Menguntungkan' : 'Defisit / Minus'}
                            </span>
                        </div>
                    </div>

                    {/* Card 4: Rata-Rata Margin Keuntungan */}
                    <div className="bg-white p-5 rounded-2xl shadow-xs border border-amber-200 flex flex-col justify-between hover:border-amber-300 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    Profit Margin Ratio
                                </span>
                                <h3 className="text-xs font-bold text-gray-800 mt-1.5">RATA-RATA MARGIN LABA</h3>
                            </div>
                            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                                <TrendingUp size={20} />
                            </div>
                        </div>

                        <div className="my-3">
                            <div className="text-2xl font-black text-amber-900 tracking-tight">
                                {kpiTotals.avgMargin}%
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${kpiTotals.avgMargin >= 30 ? 'bg-emerald-500' : kpiTotals.avgMargin >= 10 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(100, Math.max(0, kpiTotals.avgMargin))}%` }}
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 flex items-center justify-between font-medium">
                            <span>Efisiensi Biaya</span>
                            <span className="font-bold text-amber-900">{kpiTotals.avgMargin >= 20 ? 'Sangat Baik' : 'Cukup'}</span>
                        </div>
                    </div>

                </div>

                {/* ── 3. RINCIAN 6 BIAYA OPERASIONAL (SUB-CARD BREAKDOWN) ── */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                    <div className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <PieChart size={16} className="text-indigo-600" /> Ringkasan 6 Pos Biaya Operasional Kapal ({filterPeriodMode === 'month' ? `Bulan ${MONTH_NAMES[selectedMonth]} ${selectedYear}` : 'Semua Periode'})
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                        {/* 1. Tiket */}
                        <div className="bg-blue-50/70 border border-blue-200 p-2.5 rounded-xl">
                            <div className="text-[10px] font-bold text-blue-900 flex items-center gap-1">
                                <Ticket size={12} /> Tiket Kapal
                            </div>
                            <div className="text-xs font-black text-blue-950 mt-1 font-mono">
                                {formatRupiah(kpiTotals.totalTiket)}
                            </div>
                        </div>

                        {/* 2. Ops Makassar */}
                        <div className="bg-sky-50/70 border border-sky-200 p-2.5 rounded-xl">
                            <div className="text-[10px] font-bold text-sky-900 flex items-center gap-1">
                                <Building2 size={12} /> Ops Makassar
                            </div>
                            <div className="text-xs font-black text-sky-950 mt-1 font-mono">
                                {formatRupiah(kpiTotals.totalOpsMakassar)}
                            </div>
                        </div>

                        {/* 3. Ops Surabaya */}
                        <div className="bg-indigo-50/70 border border-indigo-200 p-2.5 rounded-xl">
                            <div className="text-[10px] font-bold text-indigo-900 flex items-center gap-1">
                                <Building2 size={12} /> Ops Surabaya
                            </div>
                            <div className="text-xs font-black text-indigo-950 mt-1 font-mono">
                                {formatRupiah(kpiTotals.totalOpsSurabaya)}
                            </div>
                        </div>

                        {/* 4. Gaji Sopir */}
                        <div className="bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl">
                            <div className="text-[10px] font-bold text-amber-900 flex items-center gap-1">
                                <UserCheck size={12} /> Gaji Sopir
                            </div>
                            <div className="text-xs font-black text-amber-950 mt-1 font-mono">
                                {formatRupiah(kpiTotals.totalGajiSopir)}
                            </div>
                        </div>

                        {/* 5. Sewa Mobil */}
                        <div className="bg-purple-50/70 border border-purple-200 p-2.5 rounded-xl">
                            <div className="text-[10px] font-bold text-purple-900 flex items-center gap-1">
                                <Truck size={12} /> Sewa Mobil
                            </div>
                            <div className="text-xs font-black text-purple-950 mt-1 font-mono">
                                {formatRupiah(kpiTotals.totalSewaMobil)}
                            </div>
                        </div>

                        {/* 6. Ops Tambahan */}
                        <div className="bg-rose-50/70 border border-rose-200 p-2.5 rounded-xl">
                            <div className="text-[10px] font-bold text-rose-900 flex items-center gap-1">
                                <Plus size={12} /> Ops Tambahan
                            </div>
                            <div className="text-xs font-black text-rose-950 mt-1 font-mono">
                                {formatRupiah(kpiTotals.totalOpsTambahan)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── 4. FILTER TABS & SEARCH CONTROLS ── */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                    
                    {/* Period Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl font-bold">
                            <button
                                onClick={() => setFilterPeriodMode('month')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${filterPeriodMode === 'month' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Per Bulan
                            </button>
                            <button
                                onClick={() => setFilterPeriodMode('all')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${filterPeriodMode === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Semua Riwayat Kapal
                            </button>
                        </div>

                        {filterPeriodMode === 'month' && (
                            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                                <Calendar size={14} className="text-gray-400" />
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                    className="bg-transparent font-bold text-gray-800 outline-none cursor-pointer"
                                >
                                    {MONTH_NAMES.map((m, idx) => (
                                        <option key={idx} value={idx}>{m}</option>
                                    ))}
                                </select>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className="bg-transparent font-bold text-gray-800 outline-none cursor-pointer border-l border-gray-200 pl-1.5"
                                >
                                    {[2024, 2025, 2026, 2027, 2028].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Filter by Ship Name */}
                        {uniqueShipNames.length > 0 && (
                            <select
                                value={selectedShipFilter}
                                onChange={(e) => setSelectedShipFilter(e.target.value)}
                                className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl font-bold text-gray-700 outline-none"
                            >
                                <option value="">Semua Nama Kapal</option>
                                {uniqueShipNames.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari kapal, rute, no pemberangkatan..."
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

                {/* ── 5. MAIN DATA TABLE: REVENUE & MANUAL EXPENSES PER VOYAGE ── */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Ship size={16} className="text-blue-600" /> Daftar Performa Finansial Keberangkatan Kapal
                            </h3>
                            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                                {filteredRows.length} Kapal
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-100/75 border-b border-gray-200 text-gray-600 font-bold uppercase text-[9px] tracking-wider">
                                    <th className="p-3 text-center w-10">No</th>
                                    <th className="p-3 w-28">Tgl Berangkat</th>
                                    <th className="p-3 w-44">Nama Kapal &amp; No. Voyage</th>
                                    <th className="p-3 w-36">Rute &amp; Armada</th>
                                    <th className="p-3 text-right w-32 bg-blue-50/60 text-blue-900 font-black">
                                        Omzet Kapal (Auto)
                                    </th>
                                    <th className="p-3 text-right w-24 text-gray-700">Tiket</th>
                                    <th className="p-3 text-right w-24 text-gray-700">Ops Mks</th>
                                    <th className="p-3 text-right w-24 text-gray-700">Ops Sby</th>
                                    <th className="p-3 text-right w-24 text-gray-700">Gaji Sopir</th>
                                    <th className="p-3 text-right w-24 text-gray-700">Sewa Mobil</th>
                                    <th className="p-3 text-right w-24 text-gray-700">Ops Tambahan</th>
                                    <th className="p-3 text-right w-32 bg-rose-50/60 text-rose-900 font-black">
                                        Total Biaya (-)
                                    </th>
                                    <th className="p-3 text-right w-32 bg-emerald-50/60 text-emerald-950 font-black">
                                        Laba Bersih (=)
                                    </th>
                                    <th className="p-3 text-center w-20">Margin</th>
                                    <th className="p-3 text-center w-24">Aksi Biaya</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700 text-xs">
                                {filteredRows.map((r, idx) => {
                                    const matchingVoyage = voyages.find(v => v.id === r.voyageId);

                                    return (
                                        <tr key={r.voyageId} className="hover:bg-blue-50/20 transition-colors">
                                            <td className="p-3 text-center font-mono text-gray-400 text-[11px]">{idx + 1}</td>
                                            <td className="p-3 font-semibold text-gray-900 whitespace-nowrap">
                                                {r.departureDate && !isNaN(r.departureDate.getTime())
                                                    ? r.departureDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                                    : '-'}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-extrabold text-gray-900 flex items-center gap-1.5">
                                                    <Ship size={14} className="text-blue-600 shrink-0" />
                                                    {r.shipName}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                    No: {r.voyageNumber}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-semibold text-gray-800 text-[11px]">{r.route}</div>
                                                {r.vehicleNumbers.length > 0 && (
                                                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                        🚗 {r.vehicleNumbers.join(', ')}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Omzet Kapal (Auto STT) */}
                                            <td className="p-3 text-right font-black text-blue-900 font-mono bg-blue-50/30 whitespace-nowrap">
                                                {formatRupiah(r.totalRevenue)}
                                                <div className="text-[9px] text-blue-600 font-medium font-sans">
                                                    {r.sttCount} Resi STT
                                                </div>
                                            </td>

                                            {/* 6 Manual Cost Columns */}
                                            <td className="p-3 text-right font-mono text-gray-700 whitespace-nowrap">
                                                {r.tiket > 0 ? formatRupiah(r.tiket) : '—'}
                                            </td>
                                            <td className="p-3 text-right font-mono text-gray-700 whitespace-nowrap">
                                                {r.opsMakassar > 0 ? formatRupiah(r.opsMakassar) : '—'}
                                            </td>
                                            <td className="p-3 text-right font-mono text-gray-700 whitespace-nowrap">
                                                {r.opsSurabaya > 0 ? formatRupiah(r.opsSurabaya) : '—'}
                                            </td>
                                            <td className="p-3 text-right font-mono text-gray-700 whitespace-nowrap">
                                                {r.gajiSopir > 0 ? formatRupiah(r.gajiSopir) : '—'}
                                            </td>
                                            <td className="p-3 text-right font-mono text-gray-700 whitespace-nowrap">
                                                {r.sewaMobil > 0 ? formatRupiah(r.sewaMobil) : '—'}
                                            </td>
                                            <td className="p-3 text-right font-mono text-gray-700 whitespace-nowrap">
                                                {r.opsTambahan > 0 ? formatRupiah(r.opsTambahan) : '—'}
                                            </td>

                                            {/* Total Biaya */}
                                            <td className="p-3 text-right font-black text-rose-700 font-mono bg-rose-50/30 whitespace-nowrap">
                                                {formatRupiah(r.totalExpenses)}
                                            </td>

                                            {/* Laba Bersih */}
                                            <td className={`p-3 text-right font-black font-mono whitespace-nowrap ${r.netProfit >= 0 ? 'text-emerald-700 bg-emerald-50/30' : 'text-red-700 bg-red-50/30'}`}>
                                                {formatRupiah(r.netProfit)}
                                            </td>

                                            {/* Profit Margin (%) */}
                                            <td className="p-3 text-center">
                                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${r.profitMargin >= 30 ? 'bg-emerald-100 text-emerald-800' : r.profitMargin >= 10 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                                                    {r.profitMargin}%
                                                </span>
                                            </td>

                                            {/* Action Button */}
                                            <td className="p-3 text-center">
                                                {matchingVoyage && (
                                                    <button
                                                        onClick={() => handleOpenCostModal(matchingVoyage)}
                                                        className={`flex items-center justify-center gap-1 w-full py-1 px-2 rounded-lg font-bold text-[10px] transition-all ${r.hasManualExpense ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200' : 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs'}`}
                                                    >
                                                        <Edit3 size={11} />
                                                        {r.hasManualExpense ? 'Edit Biaya' : '+ Isi Biaya'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={15} className="p-8 text-center text-gray-400 italic">
                                            {loading ? 'Memuat data omzet per-kapal...' : 'Tidak ada data keberangkatan kapal yang cocok dengan filter.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {filteredRows.length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-100 font-extrabold text-gray-900 border-t-2 border-gray-300 text-xs">
                                        <td colSpan={4} className="p-3 text-right uppercase tracking-wider">
                                            TOTAL KESELURUHAN ({filteredRows.length} KAPAL):
                                        </td>
                                        <td className="p-3 text-right text-blue-900 font-mono font-black bg-blue-100/70">
                                            {formatRupiah(kpiTotals.totalRevenue)}
                                        </td>
                                        <td className="p-3 text-right font-mono text-gray-800">{formatRupiah(kpiTotals.totalTiket)}</td>
                                        <td className="p-3 text-right font-mono text-gray-800">{formatRupiah(kpiTotals.totalOpsMakassar)}</td>
                                        <td className="p-3 text-right font-mono text-gray-800">{formatRupiah(kpiTotals.totalOpsSurabaya)}</td>
                                        <td className="p-3 text-right font-mono text-gray-800">{formatRupiah(kpiTotals.totalGajiSopir)}</td>
                                        <td className="p-3 text-right font-mono text-gray-800">{formatRupiah(kpiTotals.totalSewaMobil)}</td>
                                        <td className="p-3 text-right font-mono text-gray-800">{formatRupiah(kpiTotals.totalOpsTambahan)}</td>
                                        <td className="p-3 text-right text-rose-900 font-mono font-black bg-rose-100/70">
                                            {formatRupiah(kpiTotals.totalExpenses)}
                                        </td>
                                        <td className="p-3 text-right text-emerald-950 font-mono font-black bg-emerald-100/70">
                                            {formatRupiah(kpiTotals.netProfit)}
                                        </td>
                                        <td className="p-3 text-center text-amber-900 font-black">
                                            {kpiTotals.avgMargin}%
                                        </td>
                                        <td className="p-3"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* ── 6. MODAL INPUT / EDIT BIAYA MANUAL KAPAL ── */}
                {isCostModalOpen && selectedVoyageForCost && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200 border border-gray-100">
                            
                            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                                <div>
                                    <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                                        <Ship size={20} className="text-blue-600" />
                                        Input Biaya Manual Operasional Kapal
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        {selectedVoyageForCost.shipName || 'Kapal'} • No: {selectedVoyageForCost.voyageNumber} ({selectedVoyageForCost.route})
                                    </p>
                                </div>
                                <button onClick={() => setIsCostModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Revenue & Live Profit Summary Box */}
                            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 rounded-2xl shadow-inner space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-blue-200">Total Omzet Muatan Kapal (Auto STT):</span>
                                    <span className="font-mono font-black text-sm text-emerald-300">{formatRupiah(selectedVoyageRevenue)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pt-1 border-t border-white/10">
                                    <span className="text-blue-200">Total Biaya Pengeluaran Kapal:</span>
                                    <span className="font-mono font-black text-sm text-rose-300">-{formatRupiah(formTotalCost)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-white/20 font-bold">
                                    <span className="text-white">Estimasi Laba Bersih Kapal:</span>
                                    <span className={`font-mono font-black text-base ${formEstimatedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatRupiah(formEstimatedProfit)} ({formEstimatedMargin}%)
                                    </span>
                                </div>
                            </div>

                            <form onSubmit={handleSaveCost} className="space-y-3.5 text-xs">
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* 1. Tiket */}
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">
                                            🎟️ Biaya Tiket Kapal (Rp)
                                        </label>
                                        <input
                                            type="number"
                                            value={formTiket || ''}
                                            onChange={(e) => setFormTiket(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                                        />
                                    </div>

                                    {/* 2. Ops Makassar */}
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">
                                            🏢 Biaya Ops Makassar (Rp)
                                        </label>
                                        <input
                                            type="number"
                                            value={formOpsMakassar || ''}
                                            onChange={(e) => setFormOpsMakassar(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                                        />
                                    </div>

                                    {/* 3. Ops Surabaya */}
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">
                                            🏢 Biaya Ops Surabaya (Rp)
                                        </label>
                                        <input
                                            type="number"
                                            value={formOpsSurabaya || ''}
                                            onChange={(e) => setFormOpsSurabaya(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                                        />
                                    </div>

                                    {/* 4. Gaji Sopir */}
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">
                                            👨‍✈️ Gaji / Uang Jalan Sopir (Rp)
                                        </label>
                                        <input
                                            type="number"
                                            value={formGajiSopir || ''}
                                            onChange={(e) => setFormGajiSopir(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                                        />
                                    </div>

                                    {/* 5. Sewa Mobil */}
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">
                                            🚛 Biaya Sewa Mobil / Unit (Rp)
                                        </label>
                                        <input
                                            type="number"
                                            value={formSewaMobil || ''}
                                            onChange={(e) => setFormSewaMobil(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                                        />
                                    </div>

                                    {/* 6. Ops Tambahan */}
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">
                                            ➕ Biaya Ops Tambahan (Rp)
                                        </label>
                                        <input
                                            type="number"
                                            value={formOpsTambahan || ''}
                                            onChange={(e) => setFormOpsTambahan(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">Catatan Tambahan (Opsional)</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Tuliskan keterangan khusus operasional kapal ini..."
                                        value={formNotes}
                                        onChange={(e) => setFormNotes(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </div>

                                {/* Modal Actions */}
                                <div className="flex items-center justify-between gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteCost(selectedVoyageForCost.id, selectedVoyageForCost.shipName || 'Kapal')}
                                        className="py-2.5 px-4 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors"
                                    >
                                        Reset Biaya
                                    </button>

                                    <div className="flex items-center gap-2 flex-1 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setIsCostModalOpen(false)}
                                            className="py-2.5 px-4 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={savingCost}
                                            className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                        >
                                            <Save size={15} />
                                            {savingCost ? 'Menyimpan...' : 'Simpan Biaya Kapal'}
                                        </button>
                                    </div>
                                </div>
                            </form>

                        </div>
                    </div>
                )}

            </div>
        </ProtectedRoute>
    );
}
