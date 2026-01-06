'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getVoyageById, deleteVoyage } from '@/lib/firestore-voyages';
import { getTransactionById } from '@/lib/firestore-transactions';
import { subscribeToExpensesByVoyage, calculateVoyageExpenses } from '@/lib/firestore-expenses';
import type { Voyage, Expense } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    ArrowLeft,
    Ship,
    Package,
    DollarSign,
    TrendingUp,
    Trash2,
    Edit,
    MapPin,
    Calendar,
    Printer,
    MoreVertical,
    CheckCircle2,
    Circle,
    Truck,
    Anchor,
    Pencil
} from 'lucide-react';
import { formatRupiah } from '@/lib/currency';
import ExpenseForm from '@/components/ExpenseForm';
import AssignTransactionsModal from '@/components/AssignTransactionsModal';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

type TabType = 'overview' | 'cargo' | 'expenses' | 'summary';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function VoyageDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { user } = useAuth();
    const [voyage, setVoyage] = useState<Voyage | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    const [showAssignModal, setShowAssignModal] = useState(false);

    // Load voyage and transactions
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
                const txPromises = voyageData.transactionIds.map(txId => getTransactionById(txId));
                const txData = await Promise.all(txPromises);
                setTransactions(txData.filter((tx): tx is Transaction => tx !== null));

                setLoading(false);
            } catch (error) {
                console.error('Error loading voyage:', error);
                setLoading(false);
            }
        };

        loadData();
    }, [id, router]);

    // Subscribe to expenses
    useEffect(() => {
        if (!voyage || !user) return;

        const unsubscribe = subscribeToExpensesByVoyage(voyage.id, user.uid, async (data) => {
            setExpenses(data);
            // Calculate totals
            const calc = await calculateVoyageExpenses(voyage.id, user.uid);
            setTotalExpenses(calc.total);
        });

        return () => unsubscribe();
    }, [voyage, user]);

    // Calculate profit
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.jumlah, 0);
    const profit = totalRevenue - totalExpenses;

    const handleDelete = async () => {
        if (!voyage) return;
        const confirmed = confirm(`Yakin ingin menghapus pemberangkatan ${voyage.voyageNumber}?`);
        if (!confirmed) return;

        try {
            await deleteVoyage(voyage.id);
            alert('Pemberangkatan berhasil dihapus');
            router.push('/voyages');
        } catch (error) {
            console.error('Error deleting voyage:', error);
            alert('Gagal menghapus pemberangkatan');
        }
    };

    const handleEditExpense = (expense: Expense) => {
        setEditingExpense(expense);
        setShowExpenseForm(true);
    };

    // Prepare chart data
    const expenseChartData = Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => {
        const value = expenses.filter(e => e.category === key).reduce((sum, e) => sum + e.amount, 0);
        return { name: label, value };
    }).filter(d => d.value > 0);

    const getStatusStep = (status: Voyage['status']) => {
        switch (status) {
            case 'planned': return 1;
            case 'in-progress': return 2;
            case 'completed': return 3;
            default: return 0;
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </ProtectedRoute>
        );
    }

    if (!voyage) return null;

    const currentStep = getStatusStep(voyage.status);

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-20">
                {/* Hero Header */}
                <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center gap-4 mb-2">
                            <Link href="/voyages" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                                <ArrowLeft size={20} />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    {voyage.route}
                                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                        {voyage.voyageNumber}
                                    </span>
                                </h1>
                            </div>
                            <div className="ml-auto flex gap-2">
                                <Link
                                    href={`/voyages/${voyage.id}/manifest`}
                                    className="hidden md:flex bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium items-center gap-2 transition-colors"
                                >
                                    <Printer size={18} />
                                    Cetak Manifest
                                </Link>
                                <button
                                    onClick={() => router.push(`/voyages/${voyage.id}/edit`)}
                                    className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                >
                                    <Edit size={20} />
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Status Steps */}
                        {voyage.status !== 'cancelled' && (
                            <div className="max-w-2xl mx-auto mt-6 mb-2">
                                <div className="flex items-center justify-between relative">
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 -z-10"></div>
                                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-green-500 -z-10 transition-all duration-500`} style={{ width: `${((currentStep - 1) / 2) * 100}%` }}></div>

                                    {[
                                        { step: 1, label: 'Direncanakan' },
                                        { step: 2, label: 'Dalam Perjalanan' },
                                        { step: 3, label: 'Selesai' }
                                    ].map((s) => (
                                        <div key={s.step} className="flex flex-col items-center gap-2 bg-white px-2">
                                            {currentStep >= s.step ? (
                                                <CheckCircle2 className="text-green-500 fill-white" size={24} />
                                            ) : (
                                                <Circle className="text-gray-300 fill-white" size={24} />
                                            )}
                                            <span className={`text-xs font-medium ${currentStep >= s.step ? 'text-green-600' : 'text-gray-400'}`}>
                                                {s.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="container mx-auto px-4 py-8">
                    {/* Key Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Voyage Details */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">Informasi Kapal & Jadwal</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="bg-blue-50 p-2 rounded-lg">
                                        <Anchor size={20} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Kapal</p>
                                        <p className="font-semibold text-gray-800">{voyage.shipName || '-'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-orange-50 p-2 rounded-lg">
                                        <Truck size={20} className="text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Kendaraan</p>
                                        <p className="font-semibold text-gray-800">{voyage.vehicleNumber || '-'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-purple-50 p-2 rounded-lg">
                                        <Calendar size={20} className="text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Periode</p>
                                        <p className="font-semibold text-gray-800">
                                            {new Date(voyage.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                            {voyage.arrivalDate && ` - ${new Date(voyage.arrivalDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Financial Summary */}
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                                <p className="text-gray-500 text-xs mb-1">Total Pendapatan</p>
                                <p className="text-2xl font-bold text-blue-600">{formatRupiah(totalRevenue)}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                                <p className="text-gray-500 text-xs mb-1">Total Pengeluaran</p>
                                <p className="text-2xl font-bold text-red-600">{formatRupiah(totalExpenses)}</p>
                            </div>
                            <div className={`rounded-2xl p-5 border shadow-sm flex flex-col justify-center ${profit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                <p className={`text-xs mb-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {profit >= 0 ? 'Keuntungan Bersih' : 'Kerugian'}
                                </p>
                                <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {formatRupiah(Math.abs(profit))}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="bg-white rounded-xl shadow-sm mb-6 border border-gray-200 overflow-hidden">
                        <div className="flex overflow-x-auto">
                            {[
                                { id: 'overview', label: 'Ringkasan & Grafik' },
                                { id: 'cargo', label: `Kargo (${transactions.length})` },
                                { id: 'expenses', label: `Pengeluaran (${expenses.length})` },
                                { id: 'summary', label: 'Laporan Detail' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={`flex-1 px-6 py-4 font-medium text-sm transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[400px]">
                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-6">Breakdown Pengeluaran</h3>
                                    {expenseChartData.length > 0 ? (
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={expenseChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        fill="#8884d8"
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {expenseChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value: number | undefined) => formatRupiah(Number(value ?? 0))} />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="h-[300px] flex items-center justify-center text-gray-400 flex-col">
                                            <Package size={48} className="mb-2 opacity-50" />
                                            <p>Belum ada data pengeluaran</p>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-4">Catatan Pemberangkatan</h3>
                                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 h-full min-h-[200px]">
                                        <p className="text-gray-700 whitespace-pre-wrap">{voyage.notes || 'Tidak ada catatan.'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'cargo' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-800">Daftar Kargo</h2>
                                    <button
                                        onClick={() => setShowAssignModal(true)}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition items-center flex gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        <Plus size={18} />
                                        Assign Transaksi
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {transactions.map(tx => (
                                        <div key={tx.id} className="bg-white border hover:border-blue-400 p-4 rounded-xl transition-all shadow-sm group">
                                            <div className="flex justify-between items-start">
                                                <div className="flex gap-4">
                                                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                                                        {tx.noSTT.slice(-4)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900">{tx.noSTT}</h4>
                                                        <p className="text-sm text-gray-500">{tx.pengirimName} ➔ {tx.penerimaName}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">{formatRupiah(tx.jumlah)}</p>
                                                    <p className="text-xs text-gray-500">{tx.koli} Koli</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {transactions.length === 0 && (
                                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
                                            <p className="text-gray-500">Belum ada cargo assigned.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'expenses' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-800">Daftar Pengeluaran</h2>
                                    <button
                                        onClick={() => { setEditingExpense(undefined); setShowExpenseForm(true); }}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition items-center flex gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        <Plus size={18} />
                                        Catat Pengeluaran
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {expenses.map(expense => (
                                        <div key={expense.id} className="bg-white border p-4 rounded-xl shadow-sm flex justify-between items-center group hover:border-blue-300 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                                                    <DollarSign size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800">{EXPENSE_CATEGORY_LABELS[expense.category]}</p>
                                                    <p className="text-sm text-gray-500">{expense.description}</p>
                                                    <p className="text-xs text-gray-400">
                                                        {new Date(expense.date).toLocaleDateString('id-ID')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-bold text-red-600">{formatRupiah(expense.amount)}</span>
                                                <button
                                                    onClick={() => handleEditExpense(expense)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {expenses.length === 0 && (
                                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
                                            <p className="text-gray-500">Belum ada pengeluaran dicatat.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'summary' && (
                            <div className="bg-white border rounded-xl overflow-hidden">
                                <div className="p-8">
                                    <div className="text-center mb-8 border-b pb-8 relative">
                                        <h2 className="text-2xl font-bold text-gray-800">Laporan Keuangan Perjalanan</h2>
                                        <p className="text-gray-500 mt-2">{voyage.voyageNumber} • {voyage.route}</p>
                                        <button
                                            onClick={() => window.open(`/voyages/${voyage.id}/print-report`, '_blank')}
                                            className="absolute top-0 right-0 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Printer size={16} />
                                            Cetak Laporan
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center py-2 border-b border-dashed">
                                            <span className="text-gray-600">Total Pendapatan (Kargo)</span>
                                            <span className="font-bold text-blue-600">{formatRupiah(totalRevenue)}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Rincian Pengeluaran</p>
                                            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => {
                                                const catTotal = expenses.filter(e => e.category === key).reduce((sum, e) => sum + e.amount, 0);
                                                if (catTotal === 0) return null;
                                                return (
                                                    <div key={key} className="flex justify-between items-center py-1.5 text-sm">
                                                        <span className="text-gray-600 pl-4 border-l-2 border-gray-200">{label}</span>
                                                        <span className="font-medium text-gray-800">{formatRupiah(catTotal)}</span>
                                                    </div>
                                                );
                                            })}
                                            <div className="flex justify-between items-center py-2 border-t mt-2">
                                                <span className="font-semibold text-gray-800">Total Pengeluaran</span>
                                                <span className="font-bold text-red-600">{formatRupiah(totalExpenses)}</span>
                                            </div>
                                        </div>
                                        <div className={`p-4 rounded-xl flex justify-between items-center ${profit >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            <span className="font-bold text-lg">Net Profit</span>
                                            <span className="font-bold text-2xl">{formatRupiah(profit)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modals */}
                {showExpenseForm && user && voyage && (
                    <ExpenseForm
                        voyageId={voyage.id}
                        userId={user.uid}
                        expenseToEdit={editingExpense}
                        onSuccess={() => {
                            setShowExpenseForm(false);
                            setEditingExpense(undefined);
                        }}
                        onCancel={() => {
                            setShowExpenseForm(false);
                            setEditingExpense(undefined);
                        }}
                    />
                )}

                {showAssignModal && voyage && (
                    <AssignTransactionsModal
                        voyageId={voyage.id}
                        assignedTransactionIds={voyage.transactionIds}
                        onSuccess={async () => {
                            setShowAssignModal(false);
                            // Refresh logic handled by parent state update expectation or reload
                            window.location.reload(); // Simple reload to fetch fresh data
                        }}
                        onCancel={() => setShowAssignModal(false)}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}

function Plus({ size, className }: { size?: number, className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size || 24}
            height={size || 24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    );
}
