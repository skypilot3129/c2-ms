'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
    getVoyageById,
    deleteVoyage,
    removeTransactionsFromVoyage,
    updateVoyage,
    subscribeToVoyages
} from '@/lib/firestore-voyages';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import { subscribeToInvoices, unlinkTransactionFromInvoice } from '@/lib/firestore-invoices';
import { subscribeToExpensesByVoyage, calculateVoyageExpenses, deleteExpense } from '@/lib/firestore-expenses';
import { subscribeToOwnerShipExpenses, saveOwnerShipExpense } from '@/lib/firestore-owner-ship-expenses';
import type { Voyage, Expense, VoyageStatus } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import type { Invoice } from '@/types/invoice';
import type { OwnerShipExpense } from '@/types/owner-ship-report';
import {
    buildInvoiceLookup,
    resolveTransactionPaymentInfo,
    summarizeVoyagePayments,
    type ResolvedTransactionPayment
} from '@/lib/invoice-reconciliation';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    ArrowLeft, Ship, Package, DollarSign, TrendingUp, TrendingDown,
    Trash2, Edit, Edit3, MapPin, Calendar, Printer, CheckCircle2, Circle,
    Truck, Anchor, Pencil, Plus, Layers, Weight, Compass, Save, X,
    ArrowRight, Wallet, Check, AlertCircle, Clock, FileText, ChevronRight,
    PieChart as PieChartIcon, Link2, Search, ExternalLink, Unlink
} from 'lucide-react';
import { formatRupiah } from '@/lib/currency';
import ExpenseForm from '@/components/ExpenseForm';
import AssignTransactionsModal from '@/components/AssignTransactionsModal';
import LinkInvoiceModal from '@/components/LinkInvoiceModal';
import OwnerVoyageReportView from '@/components/OwnerVoyageReportView';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

type TabType = 'overview' | 'cargo' | 'expenses' | 'summary';
type CargoPaymentFilter = 'all' | 'lunas' | 'belum_lunas' | 'invoiced_unpaid' | 'uninvoiced';

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function VoyageDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { user } = useAuth();

    // Data States
    const [voyage, setVoyage] = useState<Voyage | null>(null);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [ownerShipExpense, setOwnerShipExpense] = useState<OwnerShipExpense | null>(null);
    const [loading, setLoading] = useState(true);

    // Tab & Cargo Filter States
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [cargoPaymentFilter, setCargoPaymentFilter] = useState<CargoPaymentFilter>('all');
    const [cargoSearchTerm, setCargoSearchTerm] = useState('');
    const [selectedCargoIds, setSelectedCargoIds] = useState<string[]>([]);
    const [linkModalTransactions, setLinkModalTransactions] = useState<Transaction[] | null>(null);
    const [generalExpensesTotal, setGeneralExpensesTotal] = useState(0);

    // Modals State
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    const [showAssignModal, setShowAssignModal] = useState(false);

    // Cost Modal State
    const [isCostModalOpen, setIsCostModalOpen] = useState(false);
    const [formPenjualanMakassar, setFormPenjualanMakassar] = useState<number>(0);
    const [formTiket, setFormTiket] = useState<number>(0);
    const [formTiketMakassar, setFormTiketMakassar] = useState<number>(0);
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

    // Support deep link query ?tab=cargo&filter=...
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const paramsObj = new URLSearchParams(window.location.search);
        const tabParam = paramsObj.get('tab');
        if (tabParam === 'overview' || tabParam === 'cargo' || tabParam === 'expenses' || tabParam === 'summary') {
            setActiveTab(tabParam);
        }
        const filterParam = paramsObj.get('payment');
        if (filterParam === 'lunas' || filterParam === 'belum_lunas' || filterParam === 'invoiced_unpaid' || filterParam === 'uninvoiced') {
            setCargoPaymentFilter(filterParam);
        }
    }, []);

    // 1. Real-time subscriptions for Voyage, Transactions, and Invoices
    useEffect(() => {
        if (!user) return;
        let isMounted = true;

        // Ensure voyage exists initially
        getVoyageById(id).then((v) => {
            if (!isMounted) return;
            if (!v) {
                alert('Pemberangkatan tidak ditemukan');
                router.push('/voyages');
                return;
            }
            setVoyage(v);
            setLoading(false);
        }).catch((err) => {
            console.error('Error loading initial voyage:', err);
            if (isMounted) setLoading(false);
        });

        const unsubVoyages = subscribeToVoyages(user.uid, (list) => {
            if (!isMounted) return;
            const found = list.find(v => v.id === id);
            if (found) {
                setVoyage(found);
                setLoading(false);
            }
        });

        const unsubTx = subscribeToTransactions((txList) => {
            if (!isMounted) return;
            setAllTransactions(txList);
        }, user.uid);

        const unsubInvoices = subscribeToInvoices(user.uid, (invList) => {
            if (!isMounted) return;
            setInvoices(invList);
        });

        return () => {
            isMounted = false;
            unsubVoyages();
            unsubTx();
            unsubInvoices();
        };
    }, [id, user, router]);

    // Derive linked transactions for this voyage cleanly (live synced)
    const transactions = useMemo(() => {
        if (!voyage) return [];
        const txMap = new Map(allTransactions.map(t => [t.id, t]));
        return (voyage.transactionIds || [])
            .map(txId => txMap.get(txId))
            .filter((t): t is Transaction => t !== undefined && t.status !== 'dibatalkan');
    }, [voyage, allTransactions]);

    // Invoice Lookup & Resolved Payment States
    const invoiceLookup = useMemo(() => buildInvoiceLookup(invoices), [invoices]);

    const txPaymentMap = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const map = new Map<string, ResolvedTransactionPayment>();
        transactions.forEach(tx => {
            map.set(tx.id, resolveTransactionPaymentInfo(tx, invoiceLookup, today));
        });
        return map;
    }, [transactions, invoiceLookup]);

    const paymentSummary = useMemo(
        () => summarizeVoyagePayments(transactions, invoiceLookup),
        [transactions, invoiceLookup]
    );

    const filteredCargoTransactions = useMemo(() => {
        const q = cargoSearchTerm.trim().toLowerCase();
        return transactions.filter(tx => {
            const pInfo = txPaymentMap.get(tx.id);
            if (cargoPaymentFilter === 'lunas' && !pInfo?.isPaid) return false;
            if (cargoPaymentFilter === 'belum_lunas' && pInfo?.isPaid) return false;
            if (cargoPaymentFilter === 'invoiced_unpaid' && pInfo?.state !== 'invoiced_unpaid') return false;
            if (cargoPaymentFilter === 'uninvoiced' && pInfo?.state !== 'uninvoiced') return false;

            if (q) {
                const matchStt = tx.noSTT.toLowerCase().includes(q);
                const matchSender = (tx.pengirimName || '').toLowerCase().includes(q);
                const matchReceiver = (tx.penerimaName || '').toLowerCase().includes(q);
                const matchInv = (pInfo?.displayInvoiceNumber || '').toLowerCase().includes(q);
                const matchDest = (tx.tujuan || '').toLowerCase().includes(q);
                if (!matchStt && !matchSender && !matchReceiver && !matchInv && !matchDest) return false;
            }

            return true;
        });
    }, [transactions, txPaymentMap, cargoPaymentFilter, cargoSearchTerm]);

    const handleUnlinkInvoice = async (invoiceId: string, invoiceNumber: string, txId: string, noSTT: string) => {
        if (!confirm(`Lepas hubungan STT ${noSTT} dari Invoice #${invoiceNumber}?`)) return;
        try {
            await unlinkTransactionFromInvoice(invoiceId, txId);
            showToast(`STT ${noSTT} dilepas dari Invoice #${invoiceNumber}.`);
        } catch (err: any) {
            console.error('Failed to unlink invoice:', err);
            alert('Gagal melepas tautan invoice: ' + (err?.message || ''));
        }
    };

    const toggleCargoSelection = (txId: string) => {
        setSelectedCargoIds(prev =>
            prev.includes(txId) ? prev.filter(item => item !== txId) : [...prev, txId]
        );
    };

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
                setFormPenjualanMakassar(match.penjualanMakassar || 0);
                setFormTiket(match.tiket || 0);
                setFormTiketMakassar(match.tiketMakassar || 0);
                setFormOpsMakassar(match.opsMakassar || 0);
                setFormOpsSurabaya(match.opsSurabaya || 0);
                setFormGajiSopir(match.gajiSopir || 0);
                setFormSewaMobil(match.sewaMobil || 0);
                setFormOpsTambahan(match.opsTambahan || 0);
                setFormCostNotes(match.notes || '');
            } else {
                setOwnerShipExpense(null);
                setFormPenjualanMakassar(0);
                setFormTiket(0);
                setFormTiketMakassar(0);
                setFormOpsMakassar(0);
                setFormOpsSurabaya(0);
                setFormGajiSopir(0);
                setFormSewaMobil(0);
                setFormOpsTambahan(0);
                setFormCostNotes('');
            }
        });

        return () => unsubscribe();
    }, [voyage]);

    // Cargo Metrics Calculations
    const omzetStt = useMemo(() => {
        return transactions.reduce((sum, tx) => {
            const subtotal = Number(tx.jumlah) || 0;
            const ppn = tx.isTaxable || (tx.ppn && Number(tx.ppn) > 0) ? Math.round(subtotal * 0.011) : 0;
            return sum + subtotal + ppn;
        }, 0);
    }, [transactions]);

    const penjualanMakassar = ownerShipExpense?.penjualanMakassar || 0;
    const totalRevenue = omzetStt + penjualanMakassar;

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
            (ownerShipExpense.tiketMakassar || 0) +
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
                penjualanMakassar: Number(formPenjualanMakassar) || 0,
                tiket: Number(formTiket) || 0,
                tiketMakassar: Number(formTiketMakassar) || 0,
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
            setSelectedCargoIds(prev => prev.filter(id => id !== transactionId));
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

    const handleDeleteExpense = async (id: string, description: string) => {
        if (!confirm(`Hapus pengeluaran "${description}"? Tindakan ini tidak dapat dibatalkan.`)) {
            return;
        }
        try {
            await deleteExpense(id);
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Gagal menghapus pengeluaran.');
        }
    };

    // Prepare chart data (combine ship costs + general expenses)
    const expenseChartData = useMemo(() => {
        const list: { name: string; value: number }[] = [];

        if (ownerShipExpense) {
            if (ownerShipExpense.tiket > 0) list.push({ name: 'Tiket Kapal (SBY)', value: ownerShipExpense.tiket });
            if ((ownerShipExpense.tiketMakassar || 0) > 0) list.push({ name: 'Tiket Makassar', value: ownerShipExpense.tiketMakassar! });
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
                            <div className="flex flex-wrap items-center gap-2">
                                <Link
                                    href={`/voyages/${voyage.id}/owner-report`}
                                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                                    title="Buka Tampilan Laporan Owner Khusus Mobile"
                                >
                                    <FileText size={14} className="text-emerald-400" />
                                    <span className="hidden sm:inline">Laporan Owner</span>
                                    <span className="sm:hidden">Laporan</span>
                                </Link>

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
                                    <span className="text-[10px] font-bold text-slate-300 uppercase block">Total Omzet Kapal</span>
                                    <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
                                        {formatRupiah(totalRevenue)}
                                    </div>
                                    <span className="text-[10px] text-blue-300 mt-0.5 block">
                                        STT: {formatRupiah(omzetStt)}{penjualanMakassar > 0 ? ` + Mks: ${formatRupiah(penjualanMakassar)}` : ''}
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

                            {/* STT Invoice & Payment Collection Status Ribbon */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2 font-bold">
                                        <CheckCircle2 size={14} className="text-emerald-400" />
                                        <span className="text-emerald-300">
                                            STT Lunas: {paymentSummary.paidCount}/{paymentSummary.totalSttCount} Resi ({formatRupiah(paymentSummary.paidRevenue)})
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-bold ${paymentSummary.unpaidCount > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                                            {paymentSummary.unpaidCount > 0
                                                ? `Belum Lunas: ${paymentSummary.unpaidCount} Resi (${formatRupiah(paymentSummary.unpaidRevenue)})`
                                                : 'Semua Tagihan Lunas'}
                                        </span>
                                        <button
                                            onClick={() => {
                                                setActiveTab('cargo');
                                                setCargoPaymentFilter(paymentSummary.unpaidCount > 0 ? 'belum_lunas' : 'all');
                                            }}
                                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition-colors"
                                        >
                                            Cek STT ➔
                                        </button>
                                    </div>
                                </div>
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500"
                                        style={{ width: `${paymentSummary.collectionPercent}%` }}
                                    />
                                </div>
                            </div>

                            {/* Breakdown summary pills */}
                            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                                <div className="flex items-center gap-3 flex-wrap text-[11px]">
                                    <span>Tiket SBY: <strong className="text-white font-mono">{formatRupiah(ownerShipExpense?.tiket || 0)}</strong></span>
                                    <span>Tiket Mks: <strong className="text-white font-mono">{formatRupiah(ownerShipExpense?.tiketMakassar || 0)}</strong></span>
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
                                { id: 'cargo', label: `Kargo & Pelunasan (${paymentSummary.paidCount}/${transactions.length} Lunas)` },
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

                                {/* Invoice & STT Payment Status Overview Card */}
                                <div className="md:col-span-2 bg-white rounded-2xl p-5 shadow-xs border border-gray-200 space-y-4">
                                    <div className="flex flex-wrap justify-between items-center gap-3 border-b border-gray-100 pb-3">
                                        <div>
                                            <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                                                <Link2 size={18} className="text-indigo-600" />
                                                Monitoring Status Penagihan Invoice &amp; Pelunasan STT
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Terhubung real-time dengan Modul Keuangan (Invoice &amp; Penagihan IKA)
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab('cargo')}
                                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                                        >
                                            Kelola Status STT <ArrowRight size={14} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <div
                                            onClick={() => { setActiveTab('cargo'); setCargoPaymentFilter('lunas'); }}
                                            className="cursor-pointer bg-emerald-50/70 border border-emerald-200 hover:border-emerald-400 p-3.5 rounded-xl transition-all"
                                        >
                                            <div className="flex items-center justify-between text-emerald-800 font-bold mb-1">
                                                <span>✅ STT Sudah Lunas</span>
                                                <span className="bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full text-[10px]">
                                                    {paymentSummary.paidCount} Resi
                                                </span>
                                            </div>
                                            <div className="font-mono font-black text-base text-emerald-950">
                                                {formatRupiah(paymentSummary.paidRevenue)}
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => { setActiveTab('cargo'); setCargoPaymentFilter('invoiced_unpaid'); }}
                                            className="cursor-pointer bg-amber-50/70 border border-amber-200 hover:border-amber-400 p-3.5 rounded-xl transition-all"
                                        >
                                            <div className="flex items-center justify-between text-amber-800 font-bold mb-1">
                                                <span>⏳ Invoice Belum Lunas</span>
                                                <span className="bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full text-[10px]">
                                                    {paymentSummary.invoicedUnpaidCount} Resi
                                                </span>
                                            </div>
                                            <div className="font-mono font-black text-base text-amber-950">
                                                {formatRupiah(
                                                    transactions
                                                        .filter(tx => txPaymentMap.get(tx.id)?.state === 'invoiced_unpaid')
                                                        .reduce((s, tx) => s + (txPaymentMap.get(tx.id)?.effectiveAmount || 0), 0)
                                                )}
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => { setActiveTab('cargo'); setCargoPaymentFilter('uninvoiced'); }}
                                            className="cursor-pointer bg-rose-50/70 border border-rose-200 hover:border-rose-400 p-3.5 rounded-xl transition-all"
                                        >
                                            <div className="flex items-center justify-between text-rose-800 font-bold mb-1">
                                                <span>⚠️ Belum Dibuat Invoice</span>
                                                <span className="bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded-full text-[10px]">
                                                    {paymentSummary.uninvoicedCount} Resi
                                                </span>
                                            </div>
                                            <div className="font-mono font-black text-base text-rose-950">
                                                {formatRupiah(
                                                    transactions
                                                        .filter(tx => txPaymentMap.get(tx.id)?.state === 'uninvoiced')
                                                        .reduce((s, tx) => s + (txPaymentMap.get(tx.id)?.effectiveAmount || 0), 0)
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {paymentSummary.linkedInvoices.length > 0 && (
                                        <div className="pt-2 border-t border-gray-100">
                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
                                                Invoice Terhubung ({paymentSummary.linkedInvoices.length}):
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {paymentSummary.linkedInvoices.map(inv => (
                                                    <Link
                                                        key={inv.id}
                                                        href={`/finance/invoices/${inv.id}/print`}
                                                        target="_blank"
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all hover:shadow-xs ${
                                                            inv.status === 'Paid'
                                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                                                : 'bg-amber-50 border-amber-200 text-amber-800'
                                                        }`}
                                                    >
                                                        <FileText size={12} />
                                                        <span className="font-mono">#{inv.invoiceNumber}</span>
                                                        <span className="text-[10px] font-normal text-gray-600">({inv.clientName})</span>
                                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                                            inv.status === 'Paid' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                                                        }`}>
                                                            {inv.status === 'Paid' ? 'LUNAS' : 'BELUM'}
                                                        </span>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
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
                                            Daftar Kargo STT &amp; Status Pelunasan ({transactions.length} Resi)
                                        </h2>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Total: <strong>{totalKoli.toLocaleString('id-ID')} Koli</strong> • <strong>{(totalWeight / 1000).toFixed(2)} Ton</strong> • <strong className="text-emerald-700">{paymentSummary.paidCount} Lunas</strong> • <strong className="text-amber-700">{paymentSummary.unpaidCount} Belum Lunas</strong>
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
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

                                {/* Payment Filter Tabs */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setCargoPaymentFilter('all')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            cargoPaymentFilter === 'all'
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                        }`}
                                    >
                                        <div className="text-[10px] font-bold uppercase opacity-80">Semua STT</div>
                                        <div className="text-sm font-black mt-0.5">{paymentSummary.totalSttCount} Resi</div>
                                        <div className="text-[10px] font-mono opacity-90">{formatRupiah(paymentSummary.totalRevenue)}</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setCargoPaymentFilter('lunas')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            cargoPaymentFilter === 'lunas'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                : 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100/70'
                                        }`}
                                    >
                                        <div className="text-[10px] font-bold uppercase opacity-80">✅ Sudah Lunas</div>
                                        <div className="text-sm font-black mt-0.5">{paymentSummary.paidCount} Resi</div>
                                        <div className="text-[10px] font-mono opacity-90">{formatRupiah(paymentSummary.paidRevenue)}</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setCargoPaymentFilter('belum_lunas')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            cargoPaymentFilter === 'belum_lunas'
                                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                                : 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100/70'
                                        }`}
                                    >
                                        <div className="text-[10px] font-bold uppercase opacity-80">⏳ Semua Belum Lunas</div>
                                        <div className="text-sm font-black mt-0.5">{paymentSummary.unpaidCount} Resi</div>
                                        <div className="text-[10px] font-mono opacity-90">{formatRupiah(paymentSummary.unpaidRevenue)}</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setCargoPaymentFilter('uninvoiced')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            cargoPaymentFilter === 'uninvoiced'
                                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                                : 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100/70'
                                        }`}
                                    >
                                        <div className="text-[10px] font-bold uppercase opacity-80">⚠️ Belum Ada Invoice</div>
                                        <div className="text-sm font-black mt-0.5">{paymentSummary.uninvoicedCount} Resi</div>
                                        <div className="text-[10px] font-mono opacity-90">Perlu dibuatkan invoice</div>
                                    </button>
                                </div>

                                {/* Search & Bulk Action Toolbar */}
                                <div className="flex flex-wrap items-center justify-between gap-2.5 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Cari No STT, Pengirim, Penerima, No Invoice..."
                                            value={cargoSearchTerm}
                                            onChange={(e) => setCargoSearchTerm(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        {paymentSummary.uninvoicedCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const uninvIds = transactions
                                                        .filter(t => txPaymentMap.get(t.id)?.state === 'uninvoiced')
                                                        .map(t => t.id);
                                                    setSelectedCargoIds(uninvIds);
                                                }}
                                                className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg font-bold text-[11px]"
                                            >
                                                Pilih Semua Belum Ada Invoice ({paymentSummary.uninvoicedCount})
                                            </button>
                                        )}

                                        {selectedCargoIds.length > 0 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedCargoIds([])}
                                                    className="px-2.5 py-1.5 text-gray-500 hover:text-gray-800 font-bold text-[11px]"
                                                >
                                                    Batal ({selectedCargoIds.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const chosen = transactions.filter(t => selectedCargoIds.includes(t.id));
                                                        if (chosen.length > 0) setLinkModalTransactions(chosen);
                                                    }}
                                                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-extrabold text-[11px] flex items-center gap-1.5 shadow-xs"
                                                >
                                                    <Link2 size={13} />
                                                    Hubungkan / Buat Invoice ({selectedCargoIds.length} STT)
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    {filteredCargoTransactions.map(tx => {
                                        const pInfo = txPaymentMap.get(tx.id);
                                        const isSelected = selectedCargoIds.includes(tx.id);
                                        const inv = pInfo?.linkedInvoice;

                                        return (
                                            <div
                                                key={tx.id}
                                                className={`border p-3.5 rounded-xl transition-all shadow-2xs group flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                                                    isSelected
                                                        ? 'border-indigo-500 bg-indigo-50/40'
                                                        : pInfo?.isPaid
                                                        ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-400'
                                                        : pInfo?.isOverdue
                                                        ? 'border-rose-200 bg-rose-50/20 hover:border-rose-400'
                                                        : 'border-gray-200 bg-white hover:border-blue-400'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleCargoSelection(tx.id)}
                                                        className="mt-2.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                                    />
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-extrabold text-xs shrink-0 border ${
                                                        pInfo?.isPaid
                                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                            : pInfo?.state === 'invoiced_unpaid'
                                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                        STT
                                                    </div>
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="font-mono font-black text-sm text-blue-900">{tx.noSTT}</h4>
                                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.2 rounded font-medium">
                                                                {new Date(tx.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
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

                                                        {/* Invoice & Payment Status Badges */}
                                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                                            {pInfo?.isPaid ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                    <CheckCircle2 size={12} /> LUNAS
                                                                    {pInfo.paymentMethod ? ` (${pInfo.paymentMethod})` : ''}
                                                                </span>
                                                            ) : pInfo?.isOverdue ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                                                    <AlertCircle size={12} /> JATUH TEMPO • BELUM LUNAS
                                                                </span>
                                                            ) : pInfo?.state === 'invoiced_unpaid' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                                                    <Clock size={12} /> BELUM LUNAS
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gray-100 text-gray-700 border border-gray-300">
                                                                    <AlertCircle size={12} /> BELUM ADA INVOICE
                                                                </span>
                                                            )}

                                                            {inv ? (
                                                                <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-0.5 rounded-lg text-[11px]">
                                                                    <FileText size={11} className="text-blue-600" />
                                                                    <span className="font-mono font-bold text-blue-800">
                                                                        Inv #{inv.invoiceNumber}
                                                                    </span>
                                                                    {pInfo?.paidAt && pInfo.isPaid && (
                                                                        <span className="text-[10px] text-emerald-700">
                                                                            • {new Date(pInfo.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                                        </span>
                                                                    )}
                                                                    <Link
                                                                        href={`/finance/invoices/${inv.id}/print`}
                                                                        target="_blank"
                                                                        className="text-blue-600 hover:underline font-bold ml-1 inline-flex items-center gap-0.5"
                                                                        title="Lihat / Cetak Invoice di Modul Keuangan"
                                                                    >
                                                                        <ExternalLink size={10} /> Lihat
                                                                    </Link>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUnlinkInvoice(inv.id, inv.invoiceNumber, tx.id, tx.noSTT)}
                                                                        className="text-gray-400 hover:text-rose-600 ml-1"
                                                                        title="Lepas tautan dari Invoice ini"
                                                                    >
                                                                        <Unlink size={11} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setLinkModalTransactions([tx])}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-colors"
                                                                >
                                                                    <Link2 size={11} /> Hubungkan / Buat Invoice
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 pt-2 lg:pt-0 shrink-0">
                                                    <div className="text-left lg:text-right">
                                                        <p className="font-mono font-black text-sm text-gray-900">
                                                            {formatRupiah(pInfo?.effectiveAmount || tx.jumlah)}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 font-bold">
                                                            {tx.koli || 0} Koli • {tx.berat || 0} {tx.beratUnit || 'kg'}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleUnassignTransaction(tx.id, tx.noSTT)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Lepas STT dari pemberangkatan ini"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {filteredCargoTransactions.length === 0 && (
                                        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                                            <Package size={36} className="mx-auto text-gray-400 mb-2" />
                                            <p className="font-bold text-gray-700 text-sm">
                                                {transactions.length === 0
                                                    ? 'Belum ada transaksi kargo di-assign.'
                                                    : 'Tidak ada STT yang cocok dengan filter status/pencarian ini.'}
                                            </p>
                                            {transactions.length === 0 ? (
                                                <p className="text-xs text-gray-500 mt-1">Klik tombol &quot;Assign Transaksi STT&quot; di atas untuk memasukkan kargo.</p>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => { setCargoPaymentFilter('all'); setCargoSearchTerm(''); }}
                                                    className="mt-2 text-xs text-blue-600 font-bold hover:underline"
                                                >
                                                    Tampilkan Semua STT ({transactions.length})
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: EXPENSES */}
                        {activeTab === 'expenses' && (
                            <div className="space-y-6">
                                
                                {/* Executive Ship Costs Card */}
                                <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-200 space-y-4">
                                    <div className="flex justify-between items-center border-b pb-3">
                                        <div>
                                            <h3 className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                                                <DollarSign size={18} className="text-emerald-600" />
                                                Biaya Operasional Utama Pelayaran
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Tiket (SBY &amp; MKS), Operasional Pelabuhan/Bongkar, Sopir, &amp; Armada
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsCostModalOpen(true)}
                                            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                                        >
                                            <Edit3 size={13} /> Edit Biaya Kapal
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block">Tiket Kapal (SBY)</span>
                                            <span className="font-mono font-black text-sm text-gray-900 mt-1 block">
                                                {formatRupiah(ownerShipExpense?.tiket || 0)}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold block">Tiket Makassar</span>
                                            <span className="font-mono font-black text-sm text-gray-900 mt-1 block">
                                                {formatRupiah(ownerShipExpense?.tiketMakassar || 0)}
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
                                        <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                                            <span className="text-[10px] text-emerald-800 uppercase font-bold block">Penjualan Makassar (+)</span>
                                            <span className="font-mono font-black text-sm text-emerald-950 mt-1 block">
                                                {formatRupiah(ownerShipExpense?.penjualanMakassar || 0)}
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
                                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="Edit Pengeluaran"
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteExpense(exp.id, exp.description || EXPENSE_CATEGORY_LABELS[exp.category])}
                                                        className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                                                        title="Hapus Pengeluaran"
                                                    >
                                                        <Trash2 size={13} />
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

                        {/* TAB 4: FINANCIAL SUMMARY REPORT (UNIFIED MOBILE OWNER REPORT) */}
                        {activeTab === 'summary' && (
                            <div className="max-w-3xl mx-auto">
                                <OwnerVoyageReportView
                                    voyage={voyage}
                                    transactions={transactions}
                                    invoices={invoices}
                                    ownerShipExpense={ownerShipExpense}
                                    expenses={expenses}
                                    onEditCosts={() => setIsCostModalOpen(true)}
                                    onLinkTransactions={(txList) => setLinkModalTransactions(txList)}
                                    onUnlinkInvoice={handleUnlinkInvoice}
                                    onNotify={showToast}
                                    showPrintButton={true}
                                />
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
                                
                                {/* Omzet & Penjualan Summary Box */}
                                <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3.5 rounded-xl space-y-2 text-xs">
                                    <div className="flex justify-between items-center text-blue-200">
                                        <span>Omzet Muatan STT ({transactions.length} Resi):</span>
                                        <span className="font-mono font-bold text-white">{formatRupiah(omzetStt)}</span>
                                    </div>
                                    {formPenjualanMakassar > 0 && (
                                        <div className="flex justify-between items-center text-emerald-300">
                                            <span>Penjualan Makassar:</span>
                                            <span className="font-mono font-bold">+{formatRupiah(formPenjualanMakassar)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center font-black pt-1 border-t border-white/20">
                                        <span>Total Omzet Kapal:</span>
                                        <span className="font-mono text-emerald-300 text-sm">
                                            {formatRupiah(omzetStt + (Number(formPenjualanMakassar) || 0))}
                                        </span>
                                    </div>
                                </div>

                                {/* Penjualan Makassar Input */}
                                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                                    <label className="font-extrabold text-emerald-950 block mb-1 text-xs flex items-center justify-between">
                                        <span>💵 Penjualan Makassar (Rp)</span>
                                        <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                                            Penambah Omzet Kapal
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formPenjualanMakassar || ''}
                                        onChange={(e) => setFormPenjualanMakassar(Number(e.target.value))}
                                        placeholder="Rp 0"
                                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-300 text-xs"
                                    />
                                    <p className="text-[10px] text-emerald-700 mt-1">
                                        Nominal ini otomatis ditambahkan ke total omzet muatan STT kapal.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">🎟️ Tiket Kapal / SBY (Rp)</label>
                                        <input
                                            type="number"
                                            value={formTiket || ''}
                                            onChange={(e) => setFormTiket(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">🎟️ Tiket Makassar (Rp)</label>
                                        <input
                                            type="number"
                                            value={formTiketMakassar || ''}
                                            onChange={(e) => setFormTiketMakassar(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">🏢 Operasional Makassar (Rp)</label>
                                        <input
                                            type="number"
                                            value={formOpsMakassar || ''}
                                            onChange={(e) => setFormOpsMakassar(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">🏢 Operasional Surabaya (Rp)</label>
                                        <input
                                            type="number"
                                            value={formOpsSurabaya || ''}
                                            onChange={(e) => setFormOpsSurabaya(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">👨‍✈️ Gaji Sopir (Rp)</label>
                                        <input
                                            type="number"
                                            value={formGajiSopir || ''}
                                            onChange={(e) => setFormGajiSopir(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-extrabold text-gray-800 block mb-1">🚛 Sewa Mobil (Rp)</label>
                                        <input
                                            type="number"
                                            value={formSewaMobil || ''}
                                            onChange={(e) => setFormSewaMobil(Number(e.target.value))}
                                            placeholder="Rp 0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 text-xs"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="font-extrabold text-gray-800 block mb-1">➕ Operasional Tambahan (Rp)</label>
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
                                    const totalRevCalc = omzetStt + (Number(formPenjualanMakassar) || 0);
                                    const totalCostCalc = formTiket + formTiketMakassar + formOpsMakassar + formOpsSurabaya + formGajiSopir + formSewaMobil + formOpsTambahan;
                                    const netProfitCalc = totalRevCalc - totalCostCalc;
                                    const marginCalc = totalRevCalc > 0
                                        ? Math.round((netProfitCalc / totalRevCalc) * 100)
                                        : 0;

                                    return (
                                        <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-1.5">
                                            <div className="flex justify-between text-[11px] text-slate-300">
                                                <span>Total Omzet Kapal:</span>
                                                <span className="font-mono text-emerald-300 font-bold">{formatRupiah(totalRevCalc)}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px] text-slate-300">
                                                <span>Total Biaya Operasional:</span>
                                                <span className="font-mono text-rose-300 font-bold">-{formatRupiah(totalCostCalc)}</span>
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
                        onSuccess={() => {
                            setShowAssignModal(false);
                            showToast('Transaksi STT berhasil ditambahkan ke pemberangkatan!');
                        }}
                        onCancel={() => setShowAssignModal(false)}
                    />
                )}

                {/* Link / Create Finance Invoice Modal */}
                {linkModalTransactions && linkModalTransactions.length > 0 && user && (
                    <LinkInvoiceModal
                        targetTransactions={linkModalTransactions}
                        invoices={invoices}
                        userId={user.uid}
                        onClose={() => setLinkModalTransactions(null)}
                        onSuccess={(msg) => {
                            setLinkModalTransactions(null);
                            setSelectedCargoIds([]);
                            showToast(msg);
                        }}
                    />
                )}

            </div>
        </ProtectedRoute>
    );
}
