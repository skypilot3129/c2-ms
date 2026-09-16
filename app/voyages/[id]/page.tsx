'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getVoyageById, deleteVoyage, removeTransactionsFromVoyage, updateVoyage } from '@/lib/firestore-voyages';
import { getTransactionById } from '@/lib/firestore-transactions';
import { subscribeToExpensesByVoyage, calculateVoyageExpenses } from '@/lib/firestore-expenses';
import { subscribeToOwnerShipExpenses, saveOwnerShipExpense } from '@/lib/firestore-owner-ship-expenses';
import type { Voyage, Expense, VoyageStatus } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import type { OwnerShipExpense } from '@/types/owner-ship-report';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    ArrowLeft, Ship, Package, DollarSign, TrendingUp, TrendingDown,
    Trash2, Edit, Edit3, MapPin, Calendar, Printer, CheckCircle2, Circle,
    Truck, Anchor, Pencil, Plus, Layers, Weight, Compass, Save, X,
    ArrowRight, Wallet, Check, AlertCircle, Clock, FileText, ChevronRight,
    PieChart as PieChartIcon
} from 'lucide-react';
import { formatRupiah } from '@/lib/currency';
import ExpenseForm from '@/components/ExpenseForm';
import AssignTransactionsModal from '@/components/AssignTransactionsModal';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

type TabType = 'overview' | 'cargo' | 'expenses' | 'summary';

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function VoyageDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { user } = useAuth();

    // Data States
    const [voyage, setVoyage] = useState<Voyage | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [ownerShipExpense, setOwnerShipExpense] = useState<OwnerShipExpense | null>(null);
    const [loading, setLoading] = useState(true);

    // Tab State
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [generalExpensesTotal, setGeneralExpensesTotal] = useState(0);

    // Modals State
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    const [showAssignModal, setShowAssignModal] = useState(false);

    // Cost Modal State
    const [isCostModalOpen, setIsCostModalOpen] = useState(false);
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

    // 1. Load Voyage & Linked Transactions
    useEffect(() => {
        const loadData = async () => {
            try {
                const voyageData = await getVoyageById(id);
                if (!voyageData) {
                    alert('Pemberangkatan tidak ditemukan');
                    router.push('/voyages');
                    return;
                }
                setVoyage(voyageData);

                // Load transactions
                if (voyageData.transactionIds && voyageData.transactionIds.length > 0) {
                    const txPromises = voyageData.transactionIds.map(txId => getTransactionById(txId));
                    const txData = await Promise.all(txPromises);
                    setTransactions(txData.filter((tx): tx is Transaction => tx !== null));
                } else {
                    setTransactions([]);
                }

                setLoading(false);
            } catch (error) {
                console.error('Error loading voyage:', error);
                setLoading(false);
            }
        };

        loadData();
    }, [id, router]);

    // 2. Subscribe to general expenses
    useEffect(() => {
        if (!voyage || !user) return;

        const unsubscribe = subscribeToExpensesByVoyage(voyage.id, user.uid, async (data) => {
            setExpenses(data);
            const calc = await calculateVoyageExpenses(voyage.id, user.uid);
            setGeneralExpensesTotal(calc.total);
        });

        return () => unsubscribe();
    }, [voyage, user]);

    // 3. Subscribe to Owner Ship Expenses
    useEffect(() => {
        if (!voyage) return;

        const unsubscribe = subscribeToOwnerShipExpenses((list) => {
            const match = list.find(e => e.voyageId === voyage.id);
            if (match) {
                setOwnerShipExpense(match);
                setFormTiket(match.tiket || 0);
                setFormOpsMakassar(match.opsMakassar || 0);
                setFormOpsSurabaya(match.opsSurabaya || 0);
                setFormGajiSopir(match.gajiSopir || 0);
                setFormSewaMobil(match.sewaMobil || 0);
                setFormOpsTambahan(match.opsTambahan || 0);
                setFormCostNotes(match.notes || '');
            } else {
                setOwnerShipExpense(null);
            }
        });

        return () => unsubscribe();
    }, [voyage]);

    // Cargo Metrics Calculations
    const totalRevenue = useMemo(() => {
        return transactions.reduce((sum, tx) => {
            const subtotal = Number(tx.jumlah) || 0;
            const ppn = tx.isTaxable || (tx.ppn && Number(tx.ppn) > 0) ? Math.round(subtotal * 0.011) : 0;
            return sum + subtotal + ppn;
        }, 0);
    }, [transactions]);

    const totalKoli = useMemo(() => {
        return transactions.reduce((sum, tx) => sum + (Number(tx.koli) || 0), 0);
    }, [transactions]);

    const totalWeight = useMemo(() => {
        return transactions.reduce((sum, tx) => sum + (Number(tx.berat) || 0), 0);
    }, [transactions]);

    // Ship Costs calculation
    const shipCostsTotal = useMemo(() => {
        if (!ownerShipExpense) return 0;
        return (ownerShipExpense.tiket || 0) +
            (ownerShipExpense.opsMakassar || 0) +
            (ownerShipExpense.opsSurabaya || 0) +
            (ownerShipExpense.gajiSopir || 0) +
            (ownerShipExpense.sewaMobil || 0) +
            (ownerShipExpense.opsTambahan || 0);
    }, [ownerShipExpense]);

    // Combined Expenses (Ship Costs + Any General Voyage Expenses)
    const combinedExpensesTotal = useMemo(() => {
        return shipCostsTotal + generalExpensesTotal;
    }, [shipCostsTotal, generalExpensesTotal]);

    const netProfit = totalRevenue - combinedExpensesTotal;
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
    const costPerKg = totalWeight > 0 ? Math.round(combinedExpensesTotal / totalWeight) : 0;

    // Status Step helper (1: Planned, 2: In-Progress, 3: Completed)
    const currentStep = useMemo(() => {
        if (!voyage) return 1;
        switch (voyage.status) {
            case 'planned': return 1;
            case 'in-progress': return 2;
            case 'completed': return 3;
            default: return 1;
        }
    }, [voyage]);

    // Quick Status Update
    const handleUpdateStatus = async (newStatus: VoyageStatus) => {
        if (!voyage) return;
        try {
            await updateVoyage(voyage.id, { status: newStatus });
            setVoyage(prev => prev ? { ...prev, status: newStatus } : prev);
            showToast(`Status perjalanan diubah menjadi: ${newStatus === 'in-progress' ? 'Sedang Berlayar' : newStatus === 'completed' ? 'Selesai' : 'Persiapan'}`);
        } catch (err: any) {
            console.error(err);
            alert('Gagal mengupdate status: ' + (err?.message || ''));
        }
    };

    // Handle Delete Voyage
    const handleDelete = async () => {
        if (!voyage) return;
        const confirmed = confirm(`Yakin ingin menghapus pemberangkatan ${voyage.voyageNumber}? Seluruh data terkait akan dihapus.`);
        if (!confirmed) return;

        try {
            await deleteVoyage(voyage.id);
            alert('Pemberangkatan berhasil dihapus');
            router.push('/voyages');
        } catch (error: any) {
            console.error('Error deleting voyage:', error);
            alert('Gagal menghapus pemberangkatan');
        }
    };

    // Save Ship Cost Modal
    const handleSaveCost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!voyage || !user) return;

        setSavingCost(true);
        try {
            const depDateStr = voyage.departureDate instanceof Date
                ? voyage.departureDate.toISOString().split('T')[0]
                : '';

            await saveOwnerShipExpense({
                voyageId: voyage.id,
                voyageNumber: voyage.voyageNumber,
                shipName: voyage.shipName || '',
                departureDate: depDateStr,
                route: voyage.route || '',
                tiket: Number(formTiket) || 0,
                opsMakassar: Number(formOpsMakassar) || 0,
                opsSurabaya: Number(formOpsSurabaya) || 0,
                gajiSopir: Number(formGajiSopir) || 0,
                sewaMobil: Number(formSewaMobil) || 0,
                opsTambahan: Number(formOpsTambahan) || 0,
                notes: formCostNotes.trim(),
            }, user.uid, user.displayName || user.email || 'Admin');

            showToast(`Biaya operasional kapal berhasil diperbarui!`);
            setIsCostModalOpen(false);
        } catch (err: any) {
            console.error('Error saving ship costs:', err);
            alert('Gagal menyimpan biaya kapal: ' + (err?.message || ''));
        } finally {
            setSavingCost(false);
        }
    };

    const handleUnassignTransaction = async (transactionId: string, transactionSTT: string) => {
        if (!voyage) return;

        const confirmed = confirm(`Yakin ingin melepas transaksi ${transactionSTT} dari pemberangkatan ini?`);
        if (!confirmed) return;

        try {
            await removeTransactionsFromVoyage(voyage.id, [transactionId]);
            setTransactions(prev => prev.filter(tx => tx.id !== transactionId));
            setVoyage(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    transactionIds: prev.transactionIds.filter(id => id !== transactionId)
                };
            });
            showToast(`Transaksi ${transactionSTT} berhasil dilepas.`);
        } catch (error) {
            console.error('Error unassigning transaction:', error);
            alert('Gagal melepas transaksi');
        }
    };

    const handleEditExpense = (expense: Expense) => {
        setEditingExpense(expense);
        setShowExpenseForm(true);
    };

    // Prepare chart data (combine ship costs + general expenses)
    const expenseChartData = useMemo(() => {
        const list: { name: string; value: number }[] = [];

        if (ownerShipExpense) {
            if (ownerShipExpense.tiket > 0) list.push({ name: 'Tiket Kapal', value: ownerShipExpense.tiket });
            if (ownerShipExpense.opsMakassar > 0) list.push({ name: 'Ops Makassar', value: ownerShipExpense.opsMakassar });
            if (ownerShipExpense.opsSurabaya > 0) list.push({ name: 'Ops Surabaya', value: ownerShipExpense.opsSurabaya });
            if (ownerShipExpense.gajiSopir > 0) list.push({ name: 'Gaji Sopir', value: ownerShipExpense.gajiSopir });
            if (ownerShipExpense.sewaMobil > 0) list.push({ name: 'Sewa Mobil', value: ownerShipExpense.sewaMobil });
            if (ownerShipExpense.opsTambahan > 0) list.push({ name: 'Ops Tambahan', value: ownerShipExpense.opsTambahan });
        }

        // Add general categories
        Object.entries(EXPENSE_CATEGORY_LABELS).forEach(([key, label]) => {
            const val = expenses.filter(e => e.category === key).reduce((sum, e) => sum + e.amount, 0);
            if (val > 0) list.push({ name: label, value: val });
        });

        return list;
    }, [ownerShipExpense, expenses]);

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-[70vh]">
                    <div className="text-center space-y-3">
                        <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-gray-500 font-semibold text-sm">Memuat Detail Pemberangkatan...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    if (!voyage) return null;

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50/70 pb-24 font-sans">
                
                {/* Floating Toast Notification */}
                {toastMessage && (
                    <div className="fixed bottom-6 right-6 z-50 bg-gray-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200 border border-gray-700 text-xs font-semibold max-w-sm">
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* ── 1. STICKY TOP BAR ── */}
                <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs">
                    <div className="container mx-auto px-4 py-3.5 sm:py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Link 
                                    href="/voyages" 
                                    className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-900 transition-colors border border-gray-200 shrink-0"
                                >
                                    <ArrowLeft size={18} />
                                </Link>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                                            {voyage.voyageNumber}
                                        </span>
                                        <h1 className="text-base sm:text-xl font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                                            <Ship size={20} className="text-blue-600" />
                                            {voyage.shipName || 'Kapal'}
                                            <span className="text-gray-400 font-normal text-xs sm:text-sm">({voyage.route})</span>
                                        </h1>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        Berangkat: {new Date(voyage.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>

                            {/* Header Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsCostModalOpen(true)}
                                    className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                                    title="Input / Edit Biaya Operasional Kapal"
                                >
                                    <DollarSign size={15} />
                                    <span>Biaya Kapal</span>
                                </button>

                                <Link
                                    href={`/voyages/${voyage.id}/manifest`}
                                    className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                                >
                                    <Printer size={15} />
                                    <span className="hidden sm:inline">Cetak Manifest</span>
                                    <span className="sm:hidden">Manifest</span>
                                </Link>

                                <button
                                    onClick={() => router.push(`/voyages/${voyage.id}/edit`)}
                                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20"
                                >
                                    <Edit size={14} />
                                    <span className="hidden sm:inline">Edit</span>
                                </button>

                                <button
                                    onClick={handleDelete}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                    title="Hapus Trip"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* ── VISUAL LOGISTICS JOURNEY PROGRESS STEPPER ── */}
                        <div className="mt-4 pt-3 border-t border-gray-100">
                            <div className="max-w-3xl mx-auto">
                                <div className="flex items-center justify-between relative">
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 -z-10" />
                                    <div 
                                        className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-blue-600 via-amber-500 to-emerald-500 -z-10 transition-all duration-500"
                                        style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                                    />

                                    {[
                                        { step: 1, label: 'Persiapan & Muat', sub: 'Gudang SBY', statusKey: 'planned' as VoyageStatus },
                                        { step: 2, label: 'Sedang Berlayar', sub: 'Laut Jawa / Selat Mks', statusKey: 'in-progress' as VoyageStatus },
                                        { step: 3, label: 'Tiba & Selesai', sub: 'Pelabuhan MKS / DHS', statusKey: 'completed' as VoyageStatus }
                                    ].map((s) => {
                                        const isDone = currentStep >= s.step;
                                        const isCurrent = currentStep === s.step;

                                        return (
                                            <div 
                                                key={s.step} 
                                                onClick={() => handleUpdateStatus(s.statusKey)}
                                                className="flex flex-col items-center gap-1 bg-white px-2 cursor-pointer group"
                                                title={`Ubah status ke: ${s.label}`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                    isCurrent 
                                                        ? 'bg-amber-500 text-white shadow-md ring-4 ring-amber-100 scale-110'
                                                        : isDone 
                                                        ? 'bg-emerald-600 text-white' 
                                                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                                                }`}>
                                                    {isDone && !isCurrent ? (
                                                        <Check size={16} />
                                                    ) : isCurrent ? (
                                                        <Ship size={15} className="animate-pulse" />
                                                    ) : (
                                                        <Circle size={12} />
                                                    )}
                                                </div>
                                                <span className={`text-[11px] font-bold text-center leading-tight ${
                                                    isCurrent ? 'text-amber-700 font-black' : isDone ? 'text-emerald-700' : 'text-gray-400'
                                                }`}>
                                                    {s.label}
                                                    <span className="block text-[9px] font-normal text-gray-400">{s.sub}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <div className="container mx-auto px-3 sm:px-4 py-6 space-y-6">

                    {/* ── 2. HERO FINANCIAL & CARGO METRICS ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                        
                        {/* Info Kapal & Armada (4 cols) */}
                        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-gray-200 shadow-xs flex flex-col justify-between space-y-4">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 block mb-1">
                                    Informasi Armada & Rute
                                </span>
                                <h3 className="text-lg font-black text-gray-900 flex items-center gap-1.5">
                                    <Anchor className="text-blue-600" size={20} />
                                    {voyage.shipName || 'Kapal Belum Diatur'}
                                </h3>
                                <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5 font-medium">
                                    <MapPin size={13} className="text-blue-500" /> {voyage.route}
                                </p>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-gray-100 text-xs">
                                <div className="flex items-center justify-between text-gray-700">
                                    <span className="flex items-center gap-1.5 text-gray-500">
                                        <Calendar size={14} className="text-purple-600" /> Tgl Berangkat:
                                    </span>
                                    <span className="font-bold">
                                        {new Date(voyage.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>

                                <div className="flex items-start justify-between text-gray-700 pt-1">
                                    <span className="flex items-center gap-1.5 text-gray-500">
                                        <Truck size={14} className="text-orange-600" /> Armada Truk:
                                    </span>
                                    <div className="flex flex-wrap gap-1 justify-end max-w-[180px]">
                                        {voyage.vehicleNumbers && voyage.vehicleNumbers.length > 0 ? (
                                            voyage.vehicleNumbers.map((vn, idx) => (
                                                <span key={idx} className="bg-orange-50 border border-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-mono font-bold text-[10.5px]">
                                                    {vn}
                                                </span>
                                            ))
                                        ) : voyage.vehicleNumber ? (
                                            <span className="bg-orange-50 border border-orange-200 text-orange-900 px-1.5 py-0.5 rounded font-mono font-bold text-[10.5px]">
                                                {voyage.vehicleNumber}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic text-[11px]">-</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Cargo Snapshot Pills */}
                            <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center text-xs">
                                <div>
                                    <span className="text-[9px] text-gray-500 uppercase font-bold block">Resi</span>
                                    <span className="font-black text-gray-900 text-sm">{transactions.length}</span>
                                </div>
                                <div className="border-x border-gray-200">
                                    <span className="text-[9px] text-gray-500 uppercase font-bold block">Koli</span>
                                    <span className="font-black text-indigo-700 text-sm">{totalKoli.toLocaleString('id-ID')}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] text-gray-500 uppercase font-bold block">Tonase</span>
                                    <span className="font-black text-gray-900 text-sm">{(totalWeight / 1000).toFixed(2)} T</span>
                                </div>
                            </div>
                        </div>

                        {/* Real-Time Profit & Loss Widget (8 cols) */}
                        <div className="lg:col-span-8 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-5 shadow-lg border border-slate-700 flex flex-col justify-between space-y-4">
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300">
                                        Profit & Loss Trip Pelayaran
                                    </span>
                                    <h3 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                                        <Wallet className="text-emerald-400" size={20} />
                                        Kalkulasi Omzet vs Biaya Operasional Riil
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-black ${
                                        profitMargin >= 25 
                                            ? 'bg-emerald-500 text-white shadow-emerald-500/30 shadow-md' 
                                            : profitMargin >= 10 
                                            ? 'bg-amber-400 text-slate-900' 
                                            : 'bg-rose-500 text-white'
                                    }`}>
                                        Margin {profitMargin}%
                                    </span>
                                </div>
                            </div>

                            {/* 3 Main Numbers */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                
                                <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase block">Total Omzet STT</span>
                                    <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
                                        {formatRupiah(totalRevenue)}
                                    </div>
                                    <span className="text-[10px] text-blue-300 mt-0.5 block">
                                        Dari {transactions.length} STT kargo
                                    </span>
                                </div>

                                <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/10">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase block">Total Biaya Operasional</span>
                                    <div className="text-xl sm:text-2xl font-black text-rose-300 font-mono mt-1">
                                        -{formatRupiah(combinedExpensesTotal)}
                                    </div>
                                    <span className="text-[10px] text-rose-200 mt-0.5 block truncate">
                                        {shipCostsTotal > 0 ? 'Tiket, Ops MKS/SBY, Sopir' : 'Belum ada biaya tercatat'}
                                    </span>
                                </div>

                                <div className={`p-3.5 rounded-xl border backdrop-blur-sm ${
                                    netProfit >= 0 
                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100' 
                                        : 'bg-rose-500/20 border-rose-500/40 text-rose-100'
                                }`}>
                                    <span className="text-[10px] font-bold uppercase block opacity-80">Laba Bersih Voyage</span>
                                    <div className={`text-xl sm:text-2xl font-black font-mono mt-1 ${
                                        netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}>
                                        {formatRupiah(netProfit)}
                                    </div>
                                    <span className="text-[10px] opacity-90 mt-0.5 block">
                                        Biaya: {costPerKg > 0 ? `Rp ${costPerKg.toLocaleString('id-ID')} / kg` : 'Rp 0 / kg'}
                                    </span>
                                </div>

                            </div>

                            {/* Breakdown summary pills */}
                            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                                <div className="flex items-center gap-3 flex-wrap text-[11px]">
                                    <span>Tiket: <strong className="text-white font-mono">{formatRupiah(ownerShipExpense?.tiket || 0)}</strong></span>
                                    <span>Ops MKS: <strong className="text-white font-mono">{formatRupiah(ownerShipExpense?.opsMakassar || 0)}</strong></span>
                                    <span>Ops SBY: <strong className="text-white font-mono">{formatRupiah(ownerShipExpense?.opsSurabaya || 0)}</strong></span>
                                    <span>Gaji Sopir: <strong className="text-white font-mono">{formatRupiah(ownerShipExpense?.gajiSopir || 0)}</strong></span>
                                </div>
                                <button
                                    onClick={() => setIsCostModalOpen(true)}
                                    className="text-xs font-bold text-blue-300 hover:text-white underline flex items-center gap-1"
                                >
                                    <Edit3 size={12} /> Ubah Rincian Biaya
                                </button>
                            </div>

                        </div>

                    </div>

                    {/* ── 3. TABS NAVIGATION ── */}
                    <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
                        <div className="flex overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden border-b border-gray-200">
                            {[
                                { id: 'overview', label: 'Ringkasan & Grafik' },
                                { id: 'cargo', label: `Kargo (${transactions.length} STT • ${(totalWeight / 1000).toFixed(1)} Ton)` },
                                { id: 'expenses', label: `Biaya Operasional (${formatRupiah(combinedExpensesTotal)})` },
                                { id: 'summary', label: 'Laporan Finansial Trip' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={`flex-1 min-w-[140px] px-5 py-3.5 font-bold text-xs sm:text-sm transition-all whitespace-nowrap text-center ${
                                        activeTab === tab.id
                                            ? 'bg-blue-50/80 text-blue-700 border-b-2 border-blue-600'
                                            : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── 4. TAB CONTENTS ── */}
                    <div>
                        {/* TAB 1: OVERVIEW */}
                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                
                                {/* Expense Pie Chart */}
                                <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-200 space-y-4">
                                    <div className="flex justify-between items-center border-b pb-3">
                                        <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                                            <PieChartIcon size={18} className="text-blue-600" />
                                            Distribusi Pengeluaran Biaya Kapal
                                        </h3>
                                        <span className="text-xs font-mono font-bold text-rose-600">
                                            {formatRupiah(combinedExpensesTotal)}
                                        </span>
                                    </div>

                                    {expenseChartData.length > 0 ? (
                                        <div className="h-[280px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={expenseChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={55}
                                                        outerRadius={95}
                                                        fill="#8884d8"
                                                        paddingAngle={4}
                                                        dataKey="value"
                                                    >
                                                        {expenseChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value: number | undefined) => formatRupiah(Number(value ?? 0))} />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="h-[280px] flex items-center justify-center text-gray-400 flex-col">
                                            <Package size={40} className="mb-2 opacity-40 text-gray-400" />
                                            <p className="text-xs font-medium">Belum ada rincian pengeluaran untuk trip ini.</p>
                                            <button
                                                onClick={() => setIsCostModalOpen(true)}
                                                className="mt-3 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100"
                                            >
                                                + Input Biaya Kapal Sekarang
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Notes & Operational Details */}
                                <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-200 space-y-4">
                                    <div className="flex justify-between items-center border-b pb-3">
                                        <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                                            <FileText size={18} className="text-amber-600" />
                                            Catatan Operasional Pemberangkatan
                                        </h3>
                                        <button
                                            onClick={() => router.push(`/voyages/${voyage.id}/edit`)}
                                            className="text-xs text-blue-600 font-bold hover:underline"
                                        >
                                            Edit Catatan
                                        </button>
                                    </div>

                                    <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 min-h-[160px] text-xs text-amber-950 space-y-2">
                                        <p className="font-semibold text-gray-800 whitespace-pre-wrap leading-relaxed">
                                            {voyage.notes || ownerShipExpense?.notes || 'Tidak ada catatan khusus untuk pemberangkatan ini.'}
                                        </p>
                                    </div>

                                    <div className="pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                                        <div>• Terakhir diperbarui: {new Date(voyage.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                        <div>• Nomor voyage dibuat otomatis dari sistem metadata counter.</div>
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* TAB 2: CARGO LIST */}
                        {activeTab === 'cargo' && (
                            <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-200 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                                    <div>
                                        <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                                            <Package size={18} className="text-blue-600" />
                                            Daftar Kargo STT Terangkut ({transactions.length} Resi)
                                        </h2>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Total: <strong>{totalKoli.toLocaleString('id-ID')} Koli</strong> • <strong>{(totalWeight / 1000).toFixed(2)} Ton</strong> ({totalWeight.toLocaleString('id-ID')} kg)
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/voyages/${voyage.id}/manifest`}
                                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                                        >
                                            <Printer size={14} /> Cetak Manifest
                                        </Link>
                                        <button
                                            onClick={() => setShowAssignModal(true)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20"
                                        >
                                            <Plus size={15} /> Assign Transaksi STT
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    {transactions.map(tx => (
                                        <div key={tx.id} className="bg-white border border-gray-200 hover:border-blue-400 p-3.5 rounded-xl transition-all shadow-2xs group flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center font-mono font-extrabold text-xs shrink-0 border border-blue-200">
                                                    STT
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-mono font-black text-sm text-blue-900">{tx.noSTT}</h4>
                                                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.2 rounded font-medium">
                                                            {new Date(tx.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                        {tx.tujuan && (
                                                            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.2 rounded font-bold uppercase">
                                                                ➔ {tx.tujuan}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        <strong className="text-gray-800">{tx.pengirimName}</strong> ➔ <strong className="text-gray-800">{tx.penerimaName}</strong>
                                                    </p>
                                                    {tx.isiBarang && (
                                                        <p className="text-[11px] text-gray-400 mt-0.5">Isi: {tx.isiBarang}</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                                                <div className="text-left sm:text-right">
                                                    <p className="font-mono font-black text-sm text-gray-900">{formatRupiah(tx.jumlah)}</p>
                                                    <p className="text-[11px] text-gray-500 font-bold">
                                                        {tx.koli || 0} Koli • {tx.berat || 0} kg
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleUnassignTransaction(tx.id, tx.noSTT)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Lepas dari pemberangkatan ini"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {transactions.length === 0 && (
                                        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                                            <Package size={36} className="mx-auto text-gray-400 mb-2" />
                                            <p className="font-bold text-gray-700 text-sm">Belum ada transaksi kargo di-assign.</p>
                                            <p className="text-xs text-gray-500 mt-1">Klik tombol &quot;Assign Transaksi STT&quot; di atas untuk memasukkan kargo.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: EXPENSES */}
                        {activeTab === 'expenses' && (
                            <div className="space-y-6">
                                
                                {/* 6 Executive Ship Costs Card */}
                                <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-200 space-y-4">
                                    <div className="flex justify-between items-center border-b pb-3">
                                        <div>
                                            <h3 className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                                                <DollarSign size={18} className="text-emerald-600" />
                                                Biaya Operasional Utama Pelayaran
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Tiket, Operasional Pelabuhan/Bongkar, Sopir, & Armada
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsCostModalOpen(true)}
                                            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                                        >
                                            <Edit3 size={13} /> Edit Biaya Kapal
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block">Tiket Kapal</span>
                                            <span className="font-mono font-black text-sm text-gray-900 mt-1 block">
                                                {formatRupiah(ownerShipExpense?.tiket || 0)}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block">Ops Makassar</span>
                                            <span className="font-mono font-black text-sm text-gray-900 mt-1 block">
                                                {formatRupiah(ownerShipExpense?.opsMakassar || 0)}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block">Ops Surabaya</span>
                                            <span className="font-mono font-black text-sm text-gray-900 mt-1 block">
                                                {formatRupiah(ownerShipExpense?.opsSurabaya || 0)}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block">Gaji Sopir</span>
                                            <span className="font-mono font-black text-sm text-gray-900 mt-1 block">
                                                {formatRupiah(ownerShipExpense?.gajiSopir || 0)}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block">Sewa Mobil</span>
                                            <span className="font-mono font-black text-sm text-gray-900 mt-1 block">
                                                {formatRupiah(ownerShipExpense?.sewaMobil || 0)}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block">Ops Tambahan</span>
                                            <span className="font-mono font-black text-sm text-gray-900 mt-1 block">
                                                {formatRupiah(ownerShipExpense?.opsTambahan || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* General Voyage Expenses List */}
                                <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-200 space-y-4">
                                    <div className="flex justify-between items-center border-b pb-3">
                                        <h3 className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                                            <FileText size={18} className="text-blue-600" />
                                            Pengeluaran Lapangan Lainnya ({expenses.length})
                                        </h3>
                                        <button
                                            onClick={() => { setEditingExpense(undefined); setShowExpenseForm(true); }}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                                        >
                                            <Plus size={14} /> Catat Pengeluaran
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {expenses.map(exp => (
                                            <div key={exp.id} className="bg-gray-50/70 border border-gray-200 p-3 rounded-xl flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold text-gray-800 text-xs">{EXPENSE_CATEGORY_LABELS[exp.category]}</span>
                                                    <p className="text-[11px] text-gray-500">{exp.description}</p>
                                                    <span className="text-[10px] text-gray-400">
                                                        {new Date(exp.date).toLocaleDateString('id-ID')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-rose-600 text-xs">{formatRupiah(exp.amount)}</span>
                                                    <button
                                                        onClick={() => handleEditExpense(exp)}
                                                        className="p-1 text-gray-400 hover:text-blue-600"
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {expenses.length === 0 && (
                                            <p className="text-center py-6 text-xs text-gray-400 italic">Belum ada pengeluaran tambahan lainnya.</p>
                                        )}
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* TAB 4: FINANCIAL SUMMARY REPORT */}
                        {activeTab === 'summary' && (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                                <div className="p-6 sm:p-8 space-y-6">
                                    <div className="text-center border-b pb-6 relative">
                                        <h2 className="text-xl font-black text-gray-900">Laporan Finansial Trip Pelayaran</h2>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {voyage.voyageNumber} • {voyage.shipName} • {voyage.route}
                                        </p>
                                        <button
                                            onClick={() => window.open(`/voyages/${voyage.id}/print-report`, '_blank')}
                                            className="sm:absolute top-0 right-0 mt-3 sm:mt-0 border border-gray-300 text-gray-700 px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                                        >
                                            <Printer size={14} /> Cetak Laporan PDF
                                        </button>
                                    </div>

                                    <div className="max-w-2xl mx-auto space-y-4 text-xs">
                                        <div className="flex justify-between items-center py-2.5 border-b border-gray-200">
                                            <span className="font-bold text-gray-700 text-sm">Total Omzet Kargo STT ({transactions.length} Resi)</span>
                                            <span className="font-mono font-black text-blue-900 text-base">{formatRupiah(totalRevenue)}</span>
                                        </div>

                                        <div className="space-y-2 pt-2">
                                            <p className="font-extrabold text-gray-500 uppercase tracking-wider text-[10px]">Rincian Biaya Operasional Trip</p>
                                            
                                            <div className="flex justify-between py-1 text-gray-600 pl-3 border-l-2 border-purple-300">
                                                <span>Tiket Kapal Penyeberangan</span>
                                                <span className="font-mono font-bold text-gray-800">{formatRupiah(ownerShipExpense?.tiket || 0)}</span>
                                            </div>
                                            <div className="flex justify-between py-1 text-gray-600 pl-3 border-l-2 border-purple-300">
                                                <span>Operasional Makassar (Bongkar & Pelabuhan)</span>
                                                <span className="font-mono font-bold text-gray-800">{formatRupiah(ownerShipExpense?.opsMakassar || 0)}</span>
                                            </div>
                                            <div className="flex justify-between py-1 text-gray-600 pl-3 border-l-2 border-purple-300">
                                                <span>Operasional Surabaya (Solar, Tol, Muat)</span>
                                                <span className="font-mono font-bold text-gray-800">{formatRupiah(ownerShipExpense?.opsSurabaya || 0)}</span>
                                            </div>
                                            <div className="flex justify-between py-1 text-gray-600 pl-3 border-l-2 border-purple-300">
                                                <span>Gaji Sopir / Uang Jalan</span>
                                                <span className="font-mono font-bold text-gray-800">{formatRupiah(ownerShipExpense?.gajiSopir || 0)}</span>
                                            </div>
                                            <div className="flex justify-between py-1 text-gray-600 pl-3 border-l-2 border-purple-300">
                                                <span>Sewa Mobil / Armada Luar</span>
                                                <span className="font-mono font-bold text-gray-800">{formatRupiah(ownerShipExpense?.sewaMobil || 0)}</span>
                                            </div>
                                            <div className="flex justify-between py-1 text-gray-600 pl-3 border-l-2 border-purple-300">
                                                <span>Operasional Tambahan</span>
                                                <span className="font-mono font-bold text-gray-800">{formatRupiah(ownerShipExpense?.opsTambahan || 0)}</span>
                                            </div>
                                            {generalExpensesTotal > 0 && (
                                                <div className="flex justify-between py-1 text-gray-600 pl-3 border-l-2 border-blue-300">
                                                    <span>Pengeluaran Lapangan Lainnya</span>
                                                    <span className="font-mono font-bold text-gray-800">{formatRupiah(generalExpensesTotal)}</span>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center py-2.5 border-t border-gray-200 mt-2">
                                                <span className="font-bold text-gray-800">Total Pengeluaran</span>
                                                <span className="font-mono font-black text-rose-700 text-sm">{formatRupiah(combinedExpensesTotal)}</span>
                                            </div>
                                        </div>

                                        {/* Net Profit Banner */}
                                        <div className={`p-4 rounded-2xl flex justify-between items-center shadow-xs ${
                                            netProfit >= 0 ? 'bg-emerald-50 text-emerald-950 border border-emerald-200' : 'bg-rose-50 text-rose-950 border border-rose-200'
                                        }`}>
                                            <div>
                                                <span className="font-extrabold text-sm block">Laba Bersih (Net Profit)</span>
                                                <span className="text-[11px] font-medium opacity-80">
                                                    Margin: <strong>{profitMargin}%</strong> • Biaya: <strong>Rp {costPerKg.toLocaleString('id-ID')} / kg</strong>
                                                </span>
                                            </div>
                                            <span className="font-mono font-black text-xl sm:text-2xl">
                                                {formatRupiah(netProfit)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* ── MODAL INPUT / EDIT BIAYA KAPAL ── */}
                {isCostModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in duration-200">
                            
                            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70 shrink-0">
                                <div>
                                    <span className="font-mono text-[10.5px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                        {voyage.voyageNumber}
                                    </span>
                                    <h3 className="font-black text-gray-900 text-sm sm:text-base mt-1 flex items-center gap-1.5">
                                        <DollarSign size={18} className="text-emerald-600" />
                                        Input Biaya Operasional: {voyage.shipName || 'Trip Kapal'}
                                    </h3>
                                    <p className="text-[11px] text-gray-500">
                                        {voyage.route} • {new Date(voyage.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setIsCostModalOpen(false)} 
                                    className="p-1.5 hover:bg-gray-200/80 rounded-full text-gray-400 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveCost} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
                                
                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 flex justify-between items-center text-xs">
                                    <span className="text-blue-800 font-medium">Omzet Otomatis dari STT ({transactions.length} Resi):</span>
                                    <span className="font-black text-blue-950 font-mono text-sm">{formatRupiah(totalRevenue)}</span>
                                </div>

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

                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">Catatan Biaya & Keterangan</label>
                                    <textarea
                                        rows={2}
                                        value={formCostNotes}
                                        onChange={(e) => setFormCostNotes(e.target.value)}
                                        placeholder="Catatan tambahan biaya trip ini..."
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                    />
                                </div>

                                {(() => {
                                    const totalCostCalc = formTiket + formOpsMakassar + formOpsSurabaya + formGajiSopir + formSewaMobil + formOpsTambahan;
                                    const netProfitCalc = totalRevenue - totalCostCalc;
                                    const marginCalc = totalRevenue > 0
                                        ? Math.round((netProfitCalc / totalRevenue) * 100)
                                        : 0;

                                    return (
                                        <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-1.5">
                                            <div className="flex justify-between text-[11px] text-slate-300">
                                                <span>Total Biaya Operasional:</span>
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

                {/* General Expense Modal */}
                {showExpenseForm && user && voyage && (
                    <ExpenseForm
                        voyageId={voyage.id}
                        userId={user.uid}
                        expenseToEdit={editingExpense}
                        onSuccess={() => {
                            setShowExpenseForm(false);
                            setEditingExpense(undefined);
                            showToast('Pengeluaran berhasil dicatat!');
                        }}
                        onCancel={() => {
                            setShowExpenseForm(false);
                            setEditingExpense(undefined);
                        }}
                    />
                )}

                {/* Assign Transactions Modal */}
                {showAssignModal && voyage && (
                    <AssignTransactionsModal
                        voyageId={voyage.id}
                        assignedTransactionIds={voyage.transactionIds}
                        onSuccess={async () => {
                            setShowAssignModal(false);
                            window.location.reload();
                        }}
                        onCancel={() => setShowAssignModal(false)}
                    />
                )}

            </div>
        </ProtectedRoute>
    );
}
