'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices, updateInvoiceNumber, updateInvoiceStatus } from '@/lib/firestore-invoices';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { formatRupiah } from '@/lib/currency';
import {
    Receipt, Search, Filter, ArrowLeft, Edit2, Save, X,
    CheckCircle2, Printer, Eye, Calendar, Sparkles, Building2, AlertCircle
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

export default function TaxInvoicesPage() {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [statusTab, setStatusTab] = useState<'all' | 'unpaid' | 'paid'>('all');

    // Inline / Modal Edit State for Invoice Number
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [editInvoiceNumberValue, setEditInvoiceNumberValue] = useState('');
    const [savingNumber, setSavingNumber] = useState(false);

    useEffect(() => {
        if (!user) return;

        const unsubInvoices = subscribeToInvoices(user.uid, (invData) => {
            setInvoices(invData);
            setLoading(false);
        });

        const unsubTx = subscribeToTransactions((txData) => {
            setTransactions(txData);
        }, user.uid);

        return () => {
            unsubInvoices();
            unsubTx();
        };
    }, [user]);

    // Reconcile and filter Tax Invoices (Invoice Pajak)
    const { taxInvoices, sttNumbersMap } = useMemo(() => {
        const txMap = new Map(transactions.map(t => [t.id, t]));
        const sttMapping: Record<string, string> = {};

        const filtered = invoices.filter(inv => {
            // Check if invoice has linked transactions
            const linked = (inv.transactionIds || [])
                .map(tid => txMap.get(tid))
                .filter((t): t is Transaction => t !== undefined);

            if (linked.length > 0) {
                sttMapping[inv.id] = linked.map(t => t.noSTT.replace(/^STT/i, '')).join(', ');
            }

            // Tax invoice criteria: inv.isTaxable === true OR any linked transaction has isTaxable / ppn > 0
            const hasTaxableTx = linked.some(t => t.isTaxable || (t.ppn && t.ppn > 0));
            const isTaxInvoice = inv.isTaxable === true || hasTaxableTx;

            return isTaxInvoice;
        });

        return { taxInvoices: filtered, sttNumbersMap: sttMapping };
    }, [invoices, transactions]);

    // Available months
    const months = useMemo(() => {
        const setM = new Set<string>();
        taxInvoices.forEach(inv => {
            const date = new Date(inv.issueDate);
            const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            setM.add(mStr);
        });
        return Array.from(setM).sort().reverse().map(m => {
            const [y, mm] = m.split('-');
            const d = new Date(parseInt(y), parseInt(mm) - 1);
            return { value: m, label: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) };
        });
    }, [taxInvoices]);

    // Filtered tax invoices list
    const filteredTaxInvoices = useMemo(() => {
        return taxInvoices.filter(inv => {
            // Status Tab
            if (statusTab === 'unpaid' && inv.status === 'Paid') return false;
            if (statusTab === 'paid' && inv.status !== 'Paid') return false;

            // Month Filter
            if (monthFilter) {
                const date = new Date(inv.issueDate);
                const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (mStr !== monthFilter) return false;
            }

            // Search Term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchesInv = inv.invoiceNumber.toLowerCase().includes(term);
                const matchesClient = inv.clientName.toLowerCase().includes(term);
                const matchesStt = (sttNumbersMap[inv.id] || '').toLowerCase().includes(term);
                if (!matchesInv && !matchesClient && !matchesStt) return false;
            }

            return true;
        });
    }, [taxInvoices, statusTab, monthFilter, searchTerm, sttNumbersMap]);

    // Financial KPI Calculations for Tax Invoices
    const kpiSummary = useMemo(() => {
        let totalDPP = 0;
        let totalPPN = 0;
        let totalGross = 0;

        filteredTaxInvoices.forEach(inv => {
            totalGross += inv.totalAmount;
            // DPP = totalAmount / 1.011 (approx for 1.1% PPN) or subtotal
            const dpp = Math.round(inv.totalAmount / 1.011);
            const ppn = inv.totalAmount - dpp;
            totalDPP += dpp;
            totalPPN += ppn;
        });

        return { totalDPP, totalPPN, totalGross, count: filteredTaxInvoices.length };
    }, [filteredTaxInvoices]);

    // Start inline editing of Invoice Number
    const handleStartEditNumber = (inv: Invoice) => {
        setEditingInvoiceId(inv.id);
        setEditInvoiceNumberValue(inv.invoiceNumber);
    };

    // Save edited Invoice Number to Firestore
    const handleSaveInvoiceNumber = async (id: string) => {
        if (!editInvoiceNumberValue.trim()) {
            alert('Nomor invoice tidak boleh kosong.');
            return;
        }

        setSavingNumber(true);
        try {
            await updateInvoiceNumber(id, editInvoiceNumberValue);
            setEditingInvoiceId(null);
        } catch (error: any) {
            console.error('Error updating invoice number:', error);
            alert(`Gagal memperbarui nomor invoice: ${error.message}`);
        } finally {
            setSavingNumber(false);
        }
    };

    // Toggle Paid status
    const handleTogglePaid = async (inv: Invoice) => {
        const newStatus = inv.status === 'Paid' ? 'Unpaid' : 'Paid';
        if (confirm(`Ubah status invoice ${inv.invoiceNumber} menjadi ${newStatus === 'Paid' ? 'LUNAS' : 'BELUM LUNAS'}?`)) {
            try {
                const operatorName = user?.displayName || user?.email || 'Admin Keuangan';
                await updateInvoiceStatus(inv.id, newStatus, {
                    date: new Date(),
                    method: 'Transfer',
                    paidBy: operatorName,
                });
            } catch (error: any) {
                console.error('Failed to update status:', error);
                alert(`Gagal merubah status: ${error.message}`);
            }
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500 font-medium">Memuat daftar invoice pajak...</div>;
    }

    return (
        <ProtectedRoute>
            <div className="space-y-6 pb-20 max-w-7xl mx-auto">

                {/* ── Header Toolbar ── */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                    <div className="flex items-center gap-3">
                        <Link href="/finance/invoices" className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Receipt size={22} className="text-indigo-600" /> Daftar Invoice Pajak (PPN 1.1%)
                            </h1>
                            <p className="text-xs text-gray-500">Khusus invoice dengan checklist pajak / PPN — Nomor invoice dapat diedit manual</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <Link
                            href="/finance/tax"
                            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2"
                        >
                            <Building2 size={16} className="text-indigo-600" /> Pengaturan & Laporan Pajak
                        </Link>
                        <button
                            onClick={() => window.print()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                        >
                            <Printer size={16} /> Cetak Rekap Invoice Pajak
                        </button>
                    </div>
                </div>

                {/* ── KPI Summary Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
                        <span className="text-xs text-gray-500 font-semibold block mb-1">Total Invoice Pajak</span>
                        <span className="text-2xl font-black text-gray-900">{kpiSummary.count}</span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">Dokumen Pajak Terdaftar</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
                        <span className="text-xs text-gray-500 font-semibold block mb-1">Total DPP (Dasar Pengenaan Pajak)</span>
                        <span className="text-xl font-extrabold text-blue-700">{formatRupiah(kpiSummary.totalDPP)}</span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">Subtotal sebelum PPN</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 shadow-xs">
                        <span className="text-xs text-indigo-700 font-bold block mb-1">Total PPN 1.1%</span>
                        <span className="text-xl font-black text-indigo-800">{formatRupiah(kpiSummary.totalPPN)}</span>
                        <span className="text-[10px] text-indigo-600 block mt-0.5">Pajak Pertambahan Nilai</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 shadow-xs">
                        <span className="text-xs text-emerald-700 font-bold block mb-1">Total Gross Tagihan Pajak</span>
                        <span className="text-xl font-black text-emerald-800">{formatRupiah(kpiSummary.totalGross)}</span>
                        <span className="text-[10px] text-emerald-600 block mt-0.5">DPP + PPN 1.1%</span>
                    </div>
                </div>

                {/* ── Table Container & Filter Toolbar ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                    
                    {/* Tabs & Search Header */}
                    <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        
                        {/* Status Tabs */}
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                            <button
                                onClick={() => setStatusTab('all')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${statusTab === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Semua ({taxInvoices.length})
                            </button>
                            <button
                                onClick={() => setStatusTab('unpaid')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${statusTab === 'unpaid' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Belum Lunas ({taxInvoices.filter(i => i.status !== 'Paid').length})
                            </button>
                            <button
                                onClick={() => setStatusTab('paid')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${statusTab === 'paid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Lunas ({taxInvoices.filter(i => i.status === 'Paid').length})
                            </button>
                        </div>

                        {/* Search & Month Filter */}
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
                                <Filter size={14} className="text-indigo-600" />
                                <span className="font-semibold text-gray-500">Bulan:</span>
                                <select
                                    value={monthFilter}
                                    onChange={(e) => setMonthFilter(e.target.value)}
                                    className="bg-transparent border-none outline-none font-bold text-gray-800 cursor-pointer"
                                >
                                    <option value="">Semua Bulan</option>
                                    {months.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="relative flex-1 sm:w-64">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cari No Inv / Klien / STT..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs w-full focus:ring-2 focus:ring-indigo-100 transition-all outline-none font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tax Invoices Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50/80 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100 text-[10px]">
                                <tr>
                                    <th className="py-3.5 px-4 text-center w-10">No</th>
                                    <th className="py-3.5 px-4 w-52">Nomor Invoice Pajak (Bisa Diedit)</th>
                                    <th className="py-3.5 px-4">Tgl & Jatuh Tempo</th>
                                    <th className="py-3.5 px-4">Klien / Pengirim</th>
                                    <th className="py-3.5 px-4">Resi STT Terkait</th>
                                    <th className="py-3.5 px-4 text-right">DPP (Rp)</th>
                                    <th className="py-3.5 px-4 text-right">PPN 1.1% (Rp)</th>
                                    <th className="py-3.5 px-4 text-right">Total Gross (Rp)</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-800">
                                {filteredTaxInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-10 text-center text-gray-400 italic">
                                            Tidak ada invoice pajak yang ditemukan untuk kriteria ini.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTaxInvoices.map((inv, idx) => {
                                        const dpp = Math.round(inv.totalAmount / 1.011);
                                        const ppn = inv.totalAmount - dpp;
                                        const isEditingThis = editingInvoiceId === inv.id;

                                        return (
                                            <tr key={inv.id} className="hover:bg-indigo-50/20 transition-colors">
                                                <td className="py-3.5 px-4 text-center font-medium text-gray-400">{idx + 1}</td>
                                                
                                                {/* EDITABLE INVOICE NUMBER COLUMN */}
                                                <td className="py-3.5 px-4 font-mono font-bold">
                                                    {isEditingThis ? (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                value={editInvoiceNumberValue}
                                                                onChange={(e) => setEditInvoiceNumberValue(e.target.value)}
                                                                className="px-2 py-1 bg-white border-2 border-indigo-500 rounded text-xs font-mono font-bold text-gray-900 outline-none w-36"
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={() => handleSaveInvoiceNumber(inv.id)}
                                                                disabled={savingNumber}
                                                                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                                                                title="Simpan Nomor Invoice"
                                                            >
                                                                <Save size={13} />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingInvoiceId(null)}
                                                                className="p-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                                                                title="Batal"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 group">
                                                            <span className="text-indigo-900 font-extrabold text-sm">{inv.invoiceNumber}</span>
                                                            <button
                                                                onClick={() => handleStartEditNumber(inv)}
                                                                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors opacity-70 group-hover:opacity-100"
                                                                title="Edit Nomor Invoice Manual"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    <div className="font-semibold text-gray-800">
                                                        {new Date(inv.issueDate).toLocaleDateString('id-ID')}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                                        Jt. Tempo: {new Date(inv.dueDate).toLocaleDateString('id-ID')}
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-gray-900 uppercase">{inv.clientName}</div>
                                                    {inv.clientAddress && (
                                                        <div className="text-[10px] text-gray-500 truncate max-w-[160px]">{inv.clientAddress}</div>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600 max-w-[160px] break-words">
                                                    {sttNumbersMap[inv.id] || '-'}
                                                </td>

                                                <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-700 whitespace-nowrap">
                                                    {formatRupiah(dpp)}
                                                </td>

                                                <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-700 whitespace-nowrap">
                                                    {formatRupiah(ppn)}
                                                </td>

                                                <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900 text-sm whitespace-nowrap">
                                                    {formatRupiah(inv.totalAmount)}
                                                </td>

                                                <td className="py-3.5 px-4 text-center">
                                                    <button
                                                        onClick={() => handleTogglePaid(inv)}
                                                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border transition-all ${inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                                                    >
                                                        {inv.status === 'Paid' ? '✓ LUNAS' : 'UNPAID'}
                                                    </button>
                                                </td>

                                                <td className="py-3.5 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => handleStartEditNumber(inv)}
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100"
                                                            title="Edit Nomor Invoice"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <Link
                                                            href={`/finance/invoices/${inv.id}/print`}
                                                            target="_blank"
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
                                                            title="Cetak Invoice Pajak"
                                                        >
                                                            <Eye size={14} />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </ProtectedRoute>
    );
}
