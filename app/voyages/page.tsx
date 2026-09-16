'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { subscribeToVoyages, deleteVoyage, updateVoyage } from '@/lib/firestore-voyages';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import { subscribeToOwnerShipExpenses, saveOwnerShipExpense } from '@/lib/firestore-owner-ship-expenses';
import type { Voyage, VoyageStatus } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import type { OwnerShipExpense } from '@/types/owner-ship-report';
import { formatRupiah } from '@/lib/currency';
import {
    Plus, Ship, Calendar, Search, Anchor, Truck, Trash2, Eye, Printer,
    TrendingUp, TrendingDown, DollarSign, Layers, FileText, CheckCircle2,
    Clock, AlertCircle, Filter, ArrowRight, Edit3, Save, X, LayoutGrid,
    Kanban, Table as TableIcon, RotateCcw, Sparkles, Package, Weight,
    Check, ChevronRight, MapPin, Wallet, ArrowUpRight, ArrowDownLeft,
    SlidersHorizontal, Compass, RefreshCw
} from 'lucide-react';

type ViewMode = 'grid' | 'kanban' | 'table';
type SortOption = 'date-desc' | 'date-asc' | 'revenue-desc' | 'profit-desc' | 'weight-desc';

interface EnrichedVoyage extends Voyage {
    sttCount: number;
    totalKoli: number;
    totalWeight: number; // in kg
    totalRevenue: number;
    tiket: number;
    opsMakassar: number;
    opsSurabaya: number;
    gajiSopir: number;
    sewaMobil: number;
    opsTambahan: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number; // %
    costPerKg: number;
    notesText: string;
    hasManualExpense: boolean;
}

export default function VoyagesPage() {
    const { user, role } = useAuth();
    const router = useRouter();

    // Core Data States
    const [voyages, setVoyages] = useState<Voyage[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [manualExpenses, setManualExpenses] = useState<OwnerShipExpense[]>([]);
    const [loading, setLoading] = useState(true);

    // View & Filter States
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<VoyageStatus | 'all'>('all');
    const [selectedShipFilter, setSelectedShipFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');

    // Cost Modal States
    const [isCostModalOpen, setIsCostModalOpen] = useState(false);
    const [selectedVoyageForCost, setSelectedVoyageForCost] = useState<EnrichedVoyage | null>(null);
    const [formTiket, setFormTiket] = useState<number>(0);
    const [formOpsMakassar, setFormOpsMakassar] = useState<number>(0);
    const [formOpsSurabaya, setFormOpsSurabaya] = useState<number>(0);
    const [formGajiSopir, setFormGajiSopir] = useState<number>(0);
    const [formSewaMobil, setFormSewaMobil] = useState<number>(0);
    const [formOpsTambahan, setFormOpsTambahan] = useState<number>(0);
    const [formCostNotes, setFormCostNotes] = useState<string>('');
    const [savingCost, setSavingCost] = useState(false);

    // Toast Notification
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    // 1. Subscribe to Voyages
    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToVoyages(user.uid, (data) => {
            setVoyages(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // 2. Subscribe to Transactions (to calculate Revenue, Koli, Weight per voyage)
    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToTransactions((data) => {
            setTransactions(data);
        });
        return () => unsubscribe();
    }, [user]);

    // 3. Subscribe to Owner Ship Expenses (Tiket, Ops Mks, Ops Sby, Gaji Sopir, Sewa Mobil, dll.)
    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToOwnerShipExpenses((data) => {
            setManualExpenses(data);
        });
        return () => unsubscribe();
    }, [user]);

    // Transaction Map for fast lookups
    const txMap = useMemo(() => {
        const map = new Map<string, Transaction>();
        transactions.forEach(t => map.set(t.id, t));
        return map;
    }, [transactions]);

    // Manual Expenses Map by voyageId
    const expensesMap = useMemo(() => {
        const map = new Map<string, OwnerShipExpense>();
        manualExpenses.forEach(e => map.set(e.voyageId, e));
        return map;
    }, [manualExpenses]);

    // Unique Ship Names for Dropdown Filter
    const uniqueShipNames = useMemo(() => {
        const set = new Set<string>();
        voyages.forEach(v => {
            if (v.shipName && v.shipName.trim()) set.add(v.shipName.trim());
        });
        return Array.from(set).sort();
    }, [voyages]);

    // Enriched Voyages with Cargo & Real-Time Financials
    const enrichedVoyages = useMemo<EnrichedVoyage[]>(() => {
        return voyages.map(v => {
            // Calculate STTs
            const linkedTxs = (v.transactionIds || [])
                .map(id => txMap.get(id))
                .filter((t): t is Transaction => t !== undefined && t.status !== 'dibatalkan');

            let totalRevenue = 0;
            let totalKoli = 0;
            let totalWeight = 0;

            linkedTxs.forEach(t => {
                const subtotal = Number(t.jumlah) || 0;
                const ppn = t.isTaxable || (t.ppn && Number(t.ppn) > 0) ? Math.round(subtotal * 0.011) : 0;
                totalRevenue += (subtotal + ppn);
                totalKoli += (Number(t.koli) || 0);
                totalWeight += (Number(t.berat) || 0);
            });

            // Lookup manual costs
            const costDoc = expensesMap.get(v.id);
            const tiket = costDoc?.tiket || 0;
            const opsMakassar = costDoc?.opsMakassar || 0;
            const opsSurabaya = costDoc?.opsSurabaya || 0;
            const gajiSopir = costDoc?.gajiSopir || 0;
            const sewaMobil = costDoc?.sewaMobil || 0;
            const opsTambahan = costDoc?.opsTambahan || 0;
            const notesText = costDoc?.notes || v.notes || '';
            const hasManualExpense = costDoc !== undefined;

            const totalExpenses = tiket + opsMakassar + opsSurabaya + gajiSopir + sewaMobil + opsTambahan;
            const netProfit = totalRevenue - totalExpenses;
            const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
            const costPerKg = totalWeight > 0 ? Math.round(totalExpenses / totalWeight) : 0;

            return {
                ...v,
                sttCount: linkedTxs.length,
                totalKoli,
                totalWeight,
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
                costPerKg,
                notesText,
                hasManualExpense,
            };
        });
    }, [voyages, txMap, expensesMap]);

    // Filter & Sort Logic
    const filteredVoyages = useMemo(() => {
        let list = [...enrichedVoyages];

        // Status Filter
        if (statusFilter !== 'all') {
            list = list.filter(v => v.status === statusFilter);
        }

        // Ship Filter
        if (selectedShipFilter !== 'all') {
            list = list.filter(v => (v.shipName || '').toLowerCase() === selectedShipFilter.toLowerCase());
        }

        // Search Term
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(v =>
                v.route.toLowerCase().includes(lower) ||
                v.voyageNumber.toLowerCase().includes(lower) ||
                (v.shipName && v.shipName.toLowerCase().includes(lower)) ||
                (v.vehicleNumbers && v.vehicleNumbers.some(n => n.toLowerCase().includes(lower))) ||
                (v.vehicleNumber && v.vehicleNumber.toLowerCase().includes(lower)) ||
                (v.notesText && v.notesText.toLowerCase().includes(lower))
            );
        }

        // Sorting
        list.sort((a, b) => {
            if (sortBy === 'date-desc') return b.departureDate.getTime() - a.departureDate.getTime();
            if (sortBy === 'date-asc') return a.departureDate.getTime() - b.departureDate.getTime();
            if (sortBy === 'revenue-desc') return b.totalRevenue - a.totalRevenue;
            if (sortBy === 'profit-desc') return b.netProfit - a.netProfit;
            if (sortBy === 'weight-desc') return b.totalWeight - a.totalWeight;
            return 0;
        });

        return list;
    }, [enrichedVoyages, statusFilter, selectedShipFilter, searchTerm, sortBy]);

    // Overall KPI Metrics for Hero Banner
    const kpiMetrics = useMemo(() => {
        let totalRevenue = 0;
        let totalExpenses = 0;
        let totalWeightKg = 0;
        let totalKoli = 0;
        let inProgressCount = 0;
        let plannedCount = 0;
        let completedCount = 0;

        filteredVoyages.forEach(v => {
            totalRevenue += v.totalRevenue;
            totalExpenses += v.totalExpenses;
            totalWeightKg += v.totalWeight;
            totalKoli += v.totalKoli;
            if (v.status === 'in-progress') inProgressCount++;
            else if (v.status === 'planned') plannedCount++;
            else if (v.status === 'completed') completedCount++;
        });

        const totalNetProfit = totalRevenue - totalExpenses;
        const avgMargin = totalRevenue > 0 ? Math.round((totalNetProfit / totalRevenue) * 100) : 0;
        const totalTon = (totalWeightKg / 1000).toFixed(1);

        return {
            totalTrips: filteredVoyages.length,
            totalRevenue,
            totalExpenses,
            totalNetProfit,
            avgMargin,
            totalWeightKg,
            totalTon,
            totalKoli,
            inProgressCount,
            plannedCount,
            completedCount,
        };
    }, [filteredVoyages]);

    // Handle Delete Voyage
    const handleDelete = async (id: string, voyageNo: string, e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        if (confirm(`Apakah Anda yakin ingin menghapus pemberangkatan ${voyageNo}? Seluruh data terkait akan dihapus.`)) {
            try {
                await deleteVoyage(id);
                showToast(`Pemberangkatan ${voyageNo} berhasil dihapus.`);
            } catch (error: any) {
                console.error('Error deleting voyage:', error);
                alert('Gagal menghapus pemberangkatan: ' + (error?.message || ''));
            }
        }
    };

    // Quick Status Update
    const handleQuickStatusChange = async (voyageId: string, newStatus: VoyageStatus) => {
        try {
            await updateVoyage(voyageId, { status: newStatus });
            showToast(`Status pemberangkatan berhasil diperbarui ke: ${getStatusLabel(newStatus)}`);
        } catch (err: any) {
            console.error('Error updating status:', err);
            alert('Gagal memperbarui status: ' + (err?.message || ''));
        }
    };

    // Open Cost Modal
    const handleOpenCostModal = (voyage: EnrichedVoyage, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedVoyageForCost(voyage);
        setFormTiket(voyage.tiket || 0);
        setFormOpsMakassar(voyage.opsMakassar || 0);
        setFormOpsSurabaya(voyage.opsSurabaya || 0);
        setFormGajiSopir(voyage.gajiSopir || 0);
        setFormSewaMobil(voyage.sewaMobil || 0);
        setFormOpsTambahan(voyage.opsTambahan || 0);
        setFormCostNotes(voyage.notesText || '');
        setIsCostModalOpen(true);
    };

    // Save Cost Modal
    const handleSaveCost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVoyageForCost || !user) return;

        setSavingCost(true);
        try {
            const depDateStr = selectedVoyageForCost.departureDate instanceof Date
                ? selectedVoyageForCost.departureDate.toISOString().split('T')[0]
                : '';

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
                notes: formCostNotes.trim(),
            }, user.uid, user.displayName || user.email || 'Admin');

            showToast(`Biaya operasional kapal ${selectedVoyageForCost.shipName || selectedVoyageForCost.voyageNumber} berhasil disimpan!`);
            setIsCostModalOpen(false);
        } catch (err: any) {
            console.error('Error saving ship costs:', err);
            alert('Gagal menyimpan biaya kapal: ' + (err?.message || ''));
        } finally {
            setSavingCost(false);
        }
    };

    // Status helpers
    const getStatusBadge = (status: VoyageStatus) => {
        switch (status) {
            case 'planned':
                return {
                    label: 'Persiapan & Muat',
                    color: 'bg-blue-50 text-blue-700 border-blue-200',
                    dotColor: 'bg-blue-500',
                };
            case 'in-progress':
                return {
                    label: 'Sedang Berlayar',
                    color: 'bg-amber-50 text-amber-800 border-amber-200',
                    dotColor: 'bg-amber-500 animate-pulse',
                };
            case 'completed':
                return {
                    label: 'Tiba & Selesai',
                    color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    dotColor: 'bg-emerald-500',
                };
            case 'cancelled':
                return {
                    label: 'Dibatalkan',
                    color: 'bg-rose-50 text-rose-700 border-rose-200',
                    dotColor: 'bg-rose-500',
                };
            default:
                return {
                    label: status,
                    color: 'bg-gray-50 text-gray-700 border-gray-200',
                    dotColor: 'bg-gray-400',
                };
        }
    };

    const getStatusLabel = (status: VoyageStatus) => {
        switch (status) {
            case 'planned': return 'Persiapan / Muat';
            case 'in-progress': return 'Sedang Berlayar';
            case 'completed': return 'Selesai';
            case 'cancelled': return 'Dibatalkan';
            default: return status;
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-[70vh]">
                    <div className="text-center space-y-3">
                        <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-gray-500 font-semibold text-sm">Menyiapkan Dashboard Pemberangkatan Kapal...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50/70 pb-24 font-sans">
                
                {/* Floating Toast Notification */}
                {toastMessage && (
                    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 bg-gray-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200 border border-gray-700 text-xs font-semibold max-w-sm">
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* ── 1. TOP HEADER & MAIN CONTROLS ── */}
                <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs">
                    <div className="container mx-auto px-4 py-3.5 sm:py-4">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                            <div>
                                <Link 
                                    href="/" 
                                    className="text-xs text-gray-500 hover:text-blue-600 inline-flex items-center gap-1 transition-colors font-medium mb-1"
                                >
                                    ← Beranda Utama
                                </Link>
                                <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
                                    <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                                        <Ship size={24} />
                                    </span>
                                    Pemberangkatan Kapal
                                </h1>
                                <p className="text-gray-500 text-xs mt-0.5">
                                    Monitoring Jadwal, Muatan Kargo (Tonase & Koli), Biaya Operasional, dan Profitabilitas Trip Kapal
                                </p>
                            </div>

                            {/* Action Buttons & View Switcher */}
                            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end pt-1 lg:pt-0">
                                
                                {/* View Mode Toggle */}
                                <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-0.5 border border-gray-200 shadow-2xs">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                            viewMode === 'grid' 
                                                ? 'bg-white text-gray-900 shadow-xs' 
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                        title="Tampilan Kartu Ekspedisi"
                                    >
                                        <LayoutGrid size={14} />
                                        <span className="hidden sm:inline">Kartu</span>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('kanban')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                            viewMode === 'kanban' 
                                                ? 'bg-white text-gray-900 shadow-xs' 
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                        title="Tampilan Jalur Pipeline (Kanban)"
                                    >
                                        <Kanban size={14} />
                                        <span className="hidden sm:inline">Pipeline</span>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                            viewMode === 'table' 
                                                ? 'bg-white text-gray-900 shadow-xs' 
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                        title="Tampilan Tabel Data Lengkap"
                                    >
                                        <TableIcon size={14} />
                                        <span className="hidden sm:inline">Tabel</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => window.open(`/voyages/print-list?status=${statusFilter}&search=${searchTerm}`, '_blank')}
                                        className="px-3.5 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                                        title="Cetak Laporan PDF"
                                    >
                                        <Printer size={15} />
                                        <span className="hidden sm:inline">Cetak Rekap</span>
                                    </button>

                                    <Link
                                        href="/voyages/new"
                                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-95"
                                    >
                                        <Plus size={16} />
                                        <span>+ Buat Baru</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-3 sm:px-4 py-6 space-y-6">

                    {/* ── 2. HERO KPI ANALYTICS RIBBON ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        
                        {/* Card 1: Total Trip & Status */}
                        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                                        Total Pemberangkatan
                                    </span>
                                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5">
                                        {kpiMetrics.totalTrips} <span className="text-xs font-bold text-gray-500">Trip</span>
                                    </h3>
                                </div>
                                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                                    <Ship size={18} />
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 pt-2.5 border-t border-gray-100 text-[11px] font-bold text-gray-600">
                                <span className="text-amber-600 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                    {kpiMetrics.inProgressCount} Berlayar
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className="text-blue-600">{kpiMetrics.plannedCount} Muat</span>
                                <span className="text-gray-300">•</span>
                                <span className="text-emerald-600">{kpiMetrics.completedCount} Tiba</span>
                            </div>
                        </div>

                        {/* Card 2: Total Tonase & Koli */}
                        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                                        Total Muatan Kargo
                                    </span>
                                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5">
                                        {kpiMetrics.totalTon} <span className="text-xs font-bold text-gray-500">Ton</span>
                                    </h3>
                                </div>
                                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                                    <Weight size={18} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 text-[11px]">
                                <span className="text-gray-500 font-medium">
                                    {kpiMetrics.totalWeightKg.toLocaleString('id-ID')} kg
                                </span>
                                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                    {kpiMetrics.totalKoli.toLocaleString('id-ID')} Koli
                                </span>
                            </div>
                        </div>

                        {/* Card 3: Total Omzet STT Kargo */}
                        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-4 rounded-2xl shadow-md border border-slate-800 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-200">
                                        Total Omzet STT
                                    </span>
                                    <h3 className="text-lg sm:text-xl font-black text-white mt-0.5 truncate tracking-tight">
                                        {formatRupiah(kpiMetrics.totalRevenue)}
                                    </h3>
                                </div>
                                <div className="p-2 bg-white/10 text-emerald-400 rounded-xl backdrop-blur-sm">
                                    <Wallet size={18} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-[10.5px]">
                                <span className="text-slate-300">Biaya Ops:</span>
                                <span className="font-bold text-rose-300">
                                    {formatRupiah(kpiMetrics.totalExpenses)}
                                </span>
                            </div>
                        </div>

                        {/* Card 4: Net Profit & Margin */}
                        <div className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
                            kpiMetrics.totalNetProfit >= 0 
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                                : 'bg-rose-50/70 border-rose-200 text-rose-950'
                        }`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-600">
                                        Laba Bersih & Margin
                                    </span>
                                    <h3 className={`text-lg sm:text-xl font-black mt-0.5 tracking-tight ${
                                        kpiMetrics.totalNetProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'
                                    }`}>
                                        {formatRupiah(kpiMetrics.totalNetProfit)}
                                    </h3>
                                </div>
                                <div className={`p-2 rounded-xl ${
                                    kpiMetrics.totalNetProfit >= 0 ? 'bg-emerald-200/60 text-emerald-800' : 'bg-rose-200/60 text-rose-800'
                                }`}>
                                    {kpiMetrics.totalNetProfit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2.5 border-t border-black/10 text-[11px] font-bold">
                                <span>Profit Margin:</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    kpiMetrics.avgMargin >= 25 
                                        ? 'bg-emerald-600 text-white' 
                                        : kpiMetrics.avgMargin >= 10 
                                        ? 'bg-amber-500 text-white' 
                                        : 'bg-rose-600 text-white'
                                }`}>
                                    {kpiMetrics.avgMargin}%
                                </span>
                            </div>
                        </div>

                    </div>

                    {/* ── 3. SEARCH, STATUS TABS, & SORT BAR ── */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
                        
                        {/* Top row: Status Tabs & Ship Filter */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                            {/* Status Filter Tabs */}
                            <div className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                {[
                                    { id: 'all', label: 'Semua Status' },
                                    { id: 'planned', label: 'Persiapan / Muat' },
                                    { id: 'in-progress', label: 'Sedang Berlayar' },
                                    { id: 'completed', label: 'Tiba / Selesai' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setStatusFilter(tab.id as any)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                            statusFilter === tab.id
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Ship Filter Dropdown */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 font-bold whitespace-nowrap">Kapal:</span>
                                <select
                                    value={selectedShipFilter}
                                    onChange={(e) => setSelectedShipFilter(e.target.value)}
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="all">Semua Kapal</option>
                                    {uniqueShipNames.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Bottom row: Search & Sorting */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Cari rute, kapal, no. voyage, nopol truk, catatan..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-200 font-medium"
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

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                <span className="text-xs text-gray-500 font-bold whitespace-nowrap">Urutkan:</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-700 outline-none"
                                >
                                    <option value="date-desc">Tanggal Terbaru</option>
                                    <option value="date-asc">Tanggal Terlama</option>
                                    <option value="revenue-desc">Omzet Tertinggi</option>
                                    <option value="profit-desc">Laba Bersih Tertinggi</option>
                                    <option value="weight-desc">Tonase Terberat</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ── 4. VIEW RENDERING (GRID / KANBAN / TABLE) ── */}
                    {filteredVoyages.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200 shadow-xs">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                                <Ship size={32} />
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-800">Belum Ada Pemberangkatan yang Cocok</h3>
                            <p className="text-gray-500 text-xs sm:text-sm max-w-md mx-auto mt-1 mb-4">
                                {searchTerm || statusFilter !== 'all' || selectedShipFilter !== 'all'
                                    ? 'Tidak ada trip yang sesuai dengan filter pencarian saat ini.'
                                    : 'Buat jadwal pemberangkatan baru untuk mulai mencatat kargo dan biaya operasional.'}
                            </p>
                            {(searchTerm || statusFilter !== 'all' || selectedShipFilter !== 'all') ? (
                                <button
                                    onClick={() => { setSearchTerm(''); setStatusFilter('all'); setSelectedShipFilter('all'); }}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
                                >
                                    Reset Semua Filter
                                </button>
                            ) : (
                                <Link
                                    href="/voyages/new"
                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                                >
                                    <Plus size={16} /> Buat Pemberangkatan Baru
                                </Link>
                            )}
                        </div>
                    ) : viewMode === 'grid' ? (
                        
                        /* ── VIEW 1: RICH EXPEDITION CARDS GRID ── */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                            {filteredVoyages.map((v) => {
                                const badge = getStatusBadge(v.status);
                                const isSailing = v.status === 'in-progress';
                                const hasProfit = v.netProfit >= 0;

                                return (
                                    <div 
                                        key={v.id} 
                                        className="bg-white rounded-2xl border border-gray-200/90 hover:border-blue-400 hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden group shadow-2xs"
                                    >
                                        {/* Status Accent Bar */}
                                        <div className={`h-1.5 w-full ${
                                            v.status === 'completed' ? 'bg-emerald-500' :
                                            v.status === 'in-progress' ? 'bg-amber-500' : 'bg-blue-600'
                                        }`} />

                                        <div className="p-4 sm:p-5 flex-1 flex flex-col space-y-4">
                                            
                                            {/* Header Info: Voyage Number, Status, Route */}
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                                                        {v.voyageNumber}
                                                    </span>

                                                    {/* Status Badge */}
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border flex items-center gap-1.5 ${badge.color}`}>
                                                        <span className={`w-2 h-2 rounded-full ${badge.dotColor}`} />
                                                        {badge.label}
                                                    </span>
                                                </div>

                                                <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-1.5 group-hover:text-blue-600 transition-colors">
                                                    <MapPin size={16} className="text-blue-500 shrink-0" />
                                                    <span className="truncate">{v.route}</span>
                                                </h3>
                                            </div>

                                            {/* Ship Name & Truck Numbers */}
                                            <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                                                <div className="flex items-center justify-between text-gray-700">
                                                    <span className="flex items-center gap-1.5 font-bold text-blue-900">
                                                        <Anchor size={14} className="text-blue-600" />
                                                        {v.shipName || 'Kapal Belum Dipilih'}
                                                    </span>
                                                    <span className="text-gray-500 text-[11px]">
                                                        {new Date(v.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-200/60 text-[11px] text-gray-600 flex-wrap">
                                                    <Truck size={13} className="text-orange-600 shrink-0" />
                                                    {v.vehicleNumbers && v.vehicleNumbers.length > 0 ? (
                                                        v.vehicleNumbers.map((plate, idx) => (
                                                            <span key={idx} className="bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono font-bold text-gray-800">
                                                                {plate}
                                                            </span>
                                                        ))
                                                    ) : v.vehicleNumber ? (
                                                        <span className="bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono font-bold text-gray-800">
                                                            {v.vehicleNumber}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 italic">Tanpa Nopol Truk</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Cargo Metrics: Resi, Koli, Tonase */}
                                            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-center">
                                                <div>
                                                    <span className="text-[9px] uppercase font-bold text-gray-500 block">Total STT</span>
                                                    <span className="text-xs font-black text-gray-900">{v.sttCount} Resi</span>
                                                </div>
                                                <div className="border-x border-gray-200">
                                                    <span className="text-[9px] uppercase font-bold text-gray-500 block">Koli</span>
                                                    <span className="text-xs font-black text-indigo-700">{v.totalKoli.toLocaleString('id-ID')}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] uppercase font-bold text-gray-500 block">Berat (Ton)</span>
                                                    <span className="text-xs font-black text-gray-900">
                                                        {(v.totalWeight / 1000).toFixed(2)} T
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Financial Metrics: Omzet, Biaya Ops, Net Profit */}
                                            <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-3.5 rounded-xl space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-300 text-[11px]">Omzet STT:</span>
                                                    <span className="font-bold text-white font-mono">{formatRupiah(v.totalRevenue)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-300 text-[11px]">Biaya Ops Kapal:</span>
                                                    <span className="font-bold text-rose-300 font-mono">
                                                        {v.hasManualExpense ? `-${formatRupiah(v.totalExpenses)}` : 'Rp 0'}
                                                    </span>
                                                </div>
                                                <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                                                    <div>
                                                        <span className="text-[9px] uppercase text-slate-300 block">Laba Bersih</span>
                                                        <span className={`text-sm font-black font-mono ${hasProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {formatRupiah(v.netProfit)}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                                            v.profitMargin >= 25 
                                                                ? 'bg-emerald-500 text-white' 
                                                                : v.profitMargin >= 10 
                                                                ? 'bg-amber-400 text-slate-900' 
                                                                : 'bg-rose-500 text-white'
                                                        }`}>
                                                            Margin {v.profitMargin}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons & Status Advancement */}
                                            <div className="pt-2 mt-auto border-t border-gray-100 flex items-center justify-between gap-2">
                                                
                                                {/* Quick Status Advance Button */}
                                                <div>
                                                    {v.status === 'planned' ? (
                                                        <button
                                                            onClick={() => handleQuickStatusChange(v.id, 'in-progress')}
                                                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                                                            title="Ubah status menjadi Sedang Berlayar"
                                                        >
                                                            <Ship size={12} />
                                                            Berlayar ➔
                                                        </button>
                                                    ) : v.status === 'in-progress' ? (
                                                        <button
                                                            onClick={() => handleQuickStatusChange(v.id, 'completed')}
                                                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                                                            title="Tandai kapal sudah tiba dan selesai"
                                                        >
                                                            <CheckCircle2 size={12} />
                                                            Tiba ✅
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleQuickStatusChange(v.id, 'in-progress')}
                                                            className="px-2 py-1 text-gray-400 hover:text-gray-600 rounded text-[10px] font-semibold"
                                                            title="Kembalikan ke status jalan"
                                                        >
                                                            Re-open
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    {/* Button Input Biaya Kapal */}
                                                    <button
                                                        onClick={(e) => handleOpenCostModal(v, e)}
                                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-2xs ${
                                                            v.hasManualExpense
                                                                ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                        title="Input / Edit Biaya Operasional Kapal"
                                                    >
                                                        <DollarSign size={13} />
                                                        <span>Biaya</span>
                                                    </button>

                                                    {/* Button Detail */}
                                                    <Link
                                                        href={`/voyages/${v.id}`}
                                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-2xs"
                                                        title="Buka Detail Voyage"
                                                    >
                                                        <Eye size={13} />
                                                        <span>Detail</span>
                                                    </Link>

                                                    {/* Button Hapus */}
                                                    <button
                                                        onClick={(e) => handleDelete(v.id, v.voyageNumber, e)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Hapus Pemberangkatan"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : viewMode === 'kanban' ? (

                        /* ── VIEW 2: KANBAN PIPELINE BOARD ── */
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                            
                            {/* Column 1: Planned / Persiapan Muat */}
                            <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                                        <h3 className="font-extrabold text-sm text-gray-800">Persiapan & Muat Gudang</h3>
                                    </div>
                                    <span className="px-2 py-0.5 bg-white rounded-full text-xs font-bold text-gray-700 border">
                                        {filteredVoyages.filter(v => v.status === 'planned').length}
                                    </span>
                                </div>

                                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                                    {filteredVoyages.filter(v => v.status === 'planned').map(v => (
                                        <div key={v.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs hover:shadow-md transition-all space-y-2.5">
                                            <div className="flex justify-between items-start">
                                                <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                                    {v.voyageNumber}
                                                </span>
                                                <span className="text-[11px] text-gray-500">
                                                    {new Date(v.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                            
                                            <h4 className="font-black text-sm text-gray-900">{v.shipName || 'Kapal Belum Ada'}</h4>
                                            <p className="text-xs text-gray-600 flex items-center gap-1">
                                                <MapPin size={12} className="text-blue-500" /> {v.route}
                                            </p>

                                            <div className="flex justify-between text-[11px] bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                <span>{v.sttCount} Resi • {v.totalKoli} Koli</span>
                                                <span className="font-bold text-gray-800">{(v.totalWeight / 1000).toFixed(1)} Ton</span>
                                            </div>

                                            <div className="flex justify-between items-center text-xs pt-1">
                                                <span className="text-[11px] text-gray-500">Omzet:</span>
                                                <span className="font-bold text-blue-900">{formatRupiah(v.totalRevenue)}</span>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t gap-2">
                                                <button
                                                    onClick={() => handleQuickStatusChange(v.id, 'in-progress')}
                                                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                                                >
                                                    <Ship size={13} /> Berlayar ➔
                                                </button>
                                                <Link 
                                                    href={`/voyages/${v.id}`}
                                                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs"
                                                    title="Lihat Detail"
                                                >
                                                    <Eye size={15} />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}

                                    {filteredVoyages.filter(v => v.status === 'planned').length === 0 && (
                                        <p className="text-xs text-center text-gray-400 py-8 italic">Tidak ada trip dalam persiapan muat.</p>
                                    )}
                                </div>
                            </div>

                            {/* Column 2: In-Progress / Sedang Berlayar */}
                            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/80 space-y-3">
                                <div className="flex justify-between items-center border-b border-amber-200 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                                        <h3 className="font-extrabold text-sm text-amber-950">Sedang Berlayar</h3>
                                    </div>
                                    <span className="px-2 py-0.5 bg-white rounded-full text-xs font-bold text-amber-900 border border-amber-200">
                                        {filteredVoyages.filter(v => v.status === 'in-progress').length}
                                    </span>
                                </div>

                                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                                    {filteredVoyages.filter(v => v.status === 'in-progress').map(v => (
                                        <div key={v.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs hover:shadow-md transition-all space-y-2.5">
                                            <div className="flex justify-between items-start">
                                                <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                                    {v.voyageNumber}
                                                </span>
                                                <span className="text-[11px] text-gray-500">
                                                    Berangkat: {new Date(v.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                            
                                            <h4 className="font-black text-sm text-gray-900">{v.shipName || 'Kapal Belum Ada'}</h4>
                                            <p className="text-xs text-gray-600 flex items-center gap-1">
                                                <MapPin size={12} className="text-amber-600" /> {v.route}
                                            </p>

                                            <div className="flex justify-between text-[11px] bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                                <span>{v.sttCount} Resi • {v.totalKoli} Koli</span>
                                                <span className="font-bold text-gray-800">{(v.totalWeight / 1000).toFixed(1)} Ton</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1 text-[11px] bg-gray-50 p-2 rounded-lg">
                                                <div>
                                                    <span className="text-gray-400 block text-[9px]">Omzet STT</span>
                                                    <span className="font-bold text-blue-900">{formatRupiah(v.totalRevenue)}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-gray-400 block text-[9px]">Biaya Ops</span>
                                                    <span className="font-bold text-rose-700">{formatRupiah(v.totalExpenses)}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t gap-2">
                                                <button
                                                    onClick={() => handleQuickStatusChange(v.id, 'completed')}
                                                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                                                >
                                                    <CheckCircle2 size={13} /> Tiba / Selesai ✅
                                                </button>
                                                <button
                                                    onClick={(e) => handleOpenCostModal(v, e)}
                                                    className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs"
                                                    title="Input Biaya Kapal"
                                                >
                                                    <DollarSign size={15} />
                                                </button>
                                                <Link 
                                                    href={`/voyages/${v.id}`}
                                                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs"
                                                    title="Lihat Detail"
                                                >
                                                    <Eye size={15} />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}

                                    {filteredVoyages.filter(v => v.status === 'in-progress').length === 0 && (
                                        <p className="text-xs text-center text-gray-400 py-8 italic">Tidak ada kapal yang sedang berlayar saat ini.</p>
                                    )}
                                </div>
                            </div>

                            {/* Column 3: Completed / Selesai */}
                            <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200/80 space-y-3">
                                <div className="flex justify-between items-center border-b border-emerald-200 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                        <h3 className="font-extrabold text-sm text-emerald-950">Tiba & Selesai</h3>
                                    </div>
                                    <span className="px-2 py-0.5 bg-white rounded-full text-xs font-bold text-emerald-900 border border-emerald-200">
                                        {filteredVoyages.filter(v => v.status === 'completed').length}
                                    </span>
                                </div>

                                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                                    {filteredVoyages.filter(v => v.status === 'completed').map(v => (
                                        <div key={v.id} className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs hover:shadow-md transition-all space-y-2.5">
                                            <div className="flex justify-between items-start">
                                                <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                                    {v.voyageNumber}
                                                </span>
                                                <span className="text-[11px] text-gray-500">
                                                    {new Date(v.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                            
                                            <h4 className="font-black text-sm text-gray-900">{v.shipName || 'Kapal Belum Ada'}</h4>
                                            
                                            <div className="flex justify-between items-center bg-emerald-50 p-2 rounded-lg text-xs font-bold text-emerald-950">
                                                <span>Laba Bersih:</span>
                                                <span className="font-mono">{formatRupiah(v.netProfit)} ({v.profitMargin}%)</span>
                                            </div>

                                            <div className="flex items-center justify-between pt-1 text-xs">
                                                <button
                                                    onClick={(e) => handleOpenCostModal(v, e)}
                                                    className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-[11px] font-bold"
                                                >
                                                    Edit Biaya
                                                </button>
                                                <Link 
                                                    href={`/voyages/${v.id}`}
                                                    className="text-blue-600 hover:underline font-bold text-xs flex items-center gap-1"
                                                >
                                                    Buka Detail ➔
                                                </Link>
                                            </div>
                                        </div>
                                    ))}

                                    {filteredVoyages.filter(v => v.status === 'completed').length === 0 && (
                                        <p className="text-xs text-center text-gray-400 py-8 italic">Belum ada trip berstatus selesai.</p>
                                    )}
                                </div>
                            </div>

                        </div>
                    ) : (

                        /* ── VIEW 3: DATA LEDGER TABLE VIEW ── */
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100/80 border-b border-gray-200 text-gray-600 font-bold uppercase text-[9.5px] tracking-wider">
                                            <th className="p-3 text-center w-12">No</th>
                                            <th className="p-3 w-28">No. Voyage</th>
                                            <th className="p-3 w-28">Tgl Berangkat</th>
                                            <th className="p-3">Kapal & Truk</th>
                                            <th className="p-3">Rute</th>
                                            <th className="p-3 text-center w-28">Status</th>
                                            <th className="p-3 text-center w-24">STT / Koli</th>
                                            <th className="p-3 text-right w-24">Tonase</th>
                                            <th className="p-3 text-right w-28 text-blue-900">Omzet STT</th>
                                            <th className="p-3 text-right w-28 text-rose-700">Biaya Ops</th>
                                            <th className="p-3 text-right w-32 font-bold text-emerald-700">Laba Bersih</th>
                                            <th className="p-3 text-center w-20">Margin</th>
                                            <th className="p-3 text-center w-24">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {filteredVoyages.map((v, idx) => {
                                            const badge = getStatusBadge(v.status);
                                            return (
                                                <tr key={v.id} className="hover:bg-blue-50/40 transition-colors">
                                                    <td className="p-3 text-center font-mono text-gray-400">{idx + 1}</td>
                                                    <td className="p-3 font-mono font-bold text-blue-700">{v.voyageNumber}</td>
                                                    <td className="p-3 font-medium whitespace-nowrap">
                                                        {new Date(v.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-gray-900">{v.shipName || '-'}</div>
                                                        <div className="text-[10.5px] text-gray-500 font-mono">
                                                            {v.vehicleNumbers?.join(', ') || v.vehicleNumber || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-medium">{v.route}</td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${badge.color}`}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center font-semibold">
                                                        {v.sttCount} / {v.totalKoli}
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-gray-900">
                                                        {(v.totalWeight / 1000).toFixed(2)} T
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-blue-900 whitespace-nowrap">
                                                        {formatRupiah(v.totalRevenue)}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-semibold text-rose-700 whitespace-nowrap">
                                                        {formatRupiah(v.totalExpenses)}
                                                    </td>
                                                    <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                                                        v.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                                    }`}>
                                                        {formatRupiah(v.netProfit)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                                                            v.profitMargin >= 25 ? 'bg-emerald-100 text-emerald-800' :
                                                            v.profitMargin >= 10 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                            {v.profitMargin}%
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={(e) => handleOpenCostModal(v, e)}
                                                                className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                                                                title="Input Biaya Kapal"
                                                            >
                                                                <DollarSign size={14} />
                                                            </button>
                                                            <Link
                                                                href={`/voyages/${v.id}`}
                                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                                title="Detail Voyage"
                                                            >
                                                                <Eye size={14} />
                                                            </Link>
                                                            <button
                                                                onClick={(e) => handleDelete(v.id, v.voyageNumber, e)}
                                                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>

                {/* ── MODAL INPUT / EDIT BIAYA OPERASIONAL KAPAL ── */}
                {isCostModalOpen && selectedVoyageForCost && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in duration-200">
                            
                            {/* Modal Header */}
                            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70 shrink-0">
                                <div>
                                    <span className="font-mono text-[10.5px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                        {selectedVoyageForCost.voyageNumber}
                                    </span>
                                    <h3 className="font-black text-gray-900 text-sm sm:text-base mt-1 flex items-center gap-1.5">
                                        <DollarSign size={18} className="text-emerald-600" />
                                        Input Biaya Operasional: {selectedVoyageForCost.shipName || 'Trip Kapal'}
                                    </h3>
                                    <p className="text-[11px] text-gray-500">
                                        {selectedVoyageForCost.route} • {new Date(selectedVoyageForCost.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setIsCostModalOpen(false)} 
                                    className="p-1.5 hover:bg-gray-200/80 rounded-full text-gray-400 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Form Scrollable Content */}
                            <form onSubmit={handleSaveCost} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
                                
                                {/* Omzet STT Context Box */}
                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 flex justify-between items-center text-xs">
                                    <span className="text-blue-800 font-medium">Omzet Otomatis dari STT ({selectedVoyageForCost.sttCount} Resi):</span>
                                    <span className="font-black text-blue-950 font-mono text-sm">{formatRupiah(selectedVoyageForCost.totalRevenue)}</span>
                                </div>

                                {/* Form Fields for 6 Voyage Costs */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Tiket Kapal (Rp)</label>
                                        <input
                                            type="number"
                                            value={formTiket || ''}
                                            onChange={(e) => setFormTiket(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Operasional Makassar (Rp)</label>
                                        <input
                                            type="number"
                                            value={formOpsMakassar || ''}
                                            onChange={(e) => setFormOpsMakassar(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Operasional Surabaya (Rp)</label>
                                        <input
                                            type="number"
                                            value={formOpsSurabaya || ''}
                                            onChange={(e) => setFormOpsSurabaya(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Gaji Sopir (Rp)</label>
                                        <input
                                            type="number"
                                            value={formGajiSopir || ''}
                                            onChange={(e) => setFormGajiSopir(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Sewa Mobil (Rp)</label>
                                        <input
                                            type="number"
                                            value={formSewaMobil || ''}
                                            onChange={(e) => setFormSewaMobil(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">Operasional Tambahan (Rp)</label>
                                        <input
                                            type="number"
                                            value={formOpsTambahan || ''}
                                            onChange={(e) => setFormOpsTambahan(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Notes Field */}
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">Catatan Biaya & Keterangan</label>
                                    <textarea
                                        rows={2}
                                        value={formCostNotes}
                                        onChange={(e) => setFormCostNotes(e.target.value)}
                                        placeholder="Catatan tambahan seputar biaya trip ini..."
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                    />
                                </div>

                                {/* Live P&L Preview */}
                                {(() => {
                                    const totalCostCalc = formTiket + formOpsMakassar + formOpsSurabaya + formGajiSopir + formSewaMobil + formOpsTambahan;
                                    const netProfitCalc = selectedVoyageForCost.totalRevenue - totalCostCalc;
                                    const marginCalc = selectedVoyageForCost.totalRevenue > 0
                                        ? Math.round((netProfitCalc / selectedVoyageForCost.totalRevenue) * 100)
                                        : 0;

                                    return (
                                        <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-1.5">
                                            <div className="flex justify-between text-[11px] text-slate-300">
                                                <span>Total Biaya Terinput:</span>
                                                <span className="font-mono text-rose-300 font-bold">{formatRupiah(totalCostCalc)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-bold pt-1.5 border-t border-white/10">
                                                <span>Estimasi Laba Bersih:</span>
                                                <span className={`font-mono text-sm ${netProfitCalc >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {formatRupiah(netProfitCalc)} ({marginCalc}%)
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Actions Footer */}
                                <div className="flex items-center gap-2.5 pt-2 sticky bottom-0 bg-white">
                                    <button
                                        type="button"
                                        onClick={() => setIsCostModalOpen(false)}
                                        className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingCost}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                    >
                                        <Save size={14} />
                                        {savingCost ? 'Menyimpan...' : 'Simpan Biaya Kapal'}
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
