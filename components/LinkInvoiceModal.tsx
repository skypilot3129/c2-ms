'use client';

import { useState, useMemo } from 'react';
import {
    X, Search, Link2, Plus, CheckCircle2, Clock, AlertCircle,
    FileText, Calendar, User, ArrowRight, Sparkles
} from 'lucide-react';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { createInvoice, linkTransactionsToInvoice } from '@/lib/firestore-invoices';
import { getTransactionEffectiveAmount } from '@/lib/invoice-reconciliation';
import { formatRupiah } from '@/lib/currency';

interface LinkInvoiceModalProps {
    targetTransactions: Transaction[];
    invoices: Invoice[];
    userId: string;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

export default function LinkInvoiceModal({
    targetTransactions,
    invoices,
    userId,
    onClose,
    onSuccess,
}: LinkInvoiceModalProps) {
    const [activeMode, setActiveMode] = useState<'existing' | 'create'>('existing');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
    const [submitting, setSubmitting] = useState(false);

    // Form state for creating a new Finance Invoice
    const defaultClientName = targetTransactions[0]?.pengirimName || '';
    const defaultClientAddress = targetTransactions[0]?.pengirimAddress || '';
    const defaultClientId = targetTransactions[0]?.pengirimId || '';

    const [clientName, setClientName] = useState(defaultClientName);
    const [clientAddress, setClientAddress] = useState(defaultClientAddress);
    const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');
    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    const targetIds = useMemo(() => targetTransactions.map(t => t.id), [targetTransactions]);

    const totalTargetAmount = useMemo(() => {
        return targetTransactions.reduce((sum, t) => sum + getTransactionEffectiveAmount(t), 0);
    }, [targetTransactions]);

    const hasTaxableTx = useMemo(() => {
        return targetTransactions.some(t => t.isTaxable || (t.ppn && Number(t.ppn) > 0));
    }, [targetTransactions]);

    // Filter & sort existing invoices so most relevant matches show up on top
    const filteredInvoices = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        const clientNamesLower = new Set(
            targetTransactions.map(t => (t.pengirimName || '').trim().toLowerCase()).filter(Boolean)
        );

        return invoices
            .filter(inv => inv.status !== 'Cancelled')
            .filter(inv => {
                if (statusFilter === 'unpaid' && inv.status === 'Paid') return false;
                if (statusFilter === 'paid' && inv.status !== 'Paid') return false;
                if (!q) return true;
                return (
                    inv.invoiceNumber.toLowerCase().includes(q) ||
                    inv.clientName.toLowerCase().includes(q) ||
                    (inv.notes || '').toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                // Prioritize invoices matching sender name
                const aClientMatch = clientNamesLower.has((a.clientName || '').trim().toLowerCase()) ? 1 : 0;
                const bClientMatch = clientNamesLower.has((b.clientName || '').trim().toLowerCase()) ? 1 : 0;
                if (aClientMatch !== bClientMatch) return bClientMatch - aClientMatch;

                // Prioritize newest issueDate
                const dateA = a.issueDate instanceof Date ? a.issueDate.getTime() : new Date(a.issueDate).getTime();
                const dateB = b.issueDate instanceof Date ? b.issueDate.getTime() : new Date(b.issueDate).getTime();
                return (dateB || 0) - (dateA || 0);
            });
    }, [invoices, searchTerm, statusFilter, targetTransactions]);

    const handleLinkToExisting = async (inv: Invoice) => {
        if (submitting) return;
        const alreadyLinkedCount = targetIds.filter(id => inv.transactionIds?.includes(id)).length;
        if (alreadyLinkedCount === targetIds.length) {
            alert(`STT ini sudah terhubung dengan Invoice #${inv.invoiceNumber}.`);
            return;
        }

        const confirmMsg = inv.status === 'Paid'
            ? `Hubungkan ${targetTransactions.length} STT ke Invoice #${inv.invoiceNumber} (${inv.clientName})?\n\n⚠️ Invoice ini sudah berstatus LUNAS di Modul Keuangan, sehingga status STT ini juga akan otomatis menjadi LUNAS.`
            : `Hubungkan ${targetTransactions.length} STT ke Invoice #${inv.invoiceNumber} (${inv.clientName})?`;

        if (!confirm(confirmMsg)) return;

        setSubmitting(true);
        try {
            await linkTransactionsToInvoice(inv.id, targetIds);
            onSuccess(`${targetTransactions.length} STT berhasil dihubungkan ke Invoice #${inv.invoiceNumber}`);
        } catch (err: any) {
            console.error('Error linking transactions to invoice:', err);
            alert('Gagal menghubungkan ke invoice: ' + (err?.message || 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateAndLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        if (!clientName.trim()) {
            alert('Nama klien / pengirim wajib diisi.');
            return;
        }

        setSubmitting(true);
        try {
            await createInvoice({
                invoiceNumber: customInvoiceNumber.trim() || undefined,
                clientId: defaultClientId || undefined,
                clientName: clientName.trim(),
                clientAddress: clientAddress.trim() || undefined,
                transactionIds: targetIds,
                totalAmount: totalTargetAmount,
                issueDate: issueDate || new Date().toISOString().split('T')[0],
                dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                notes: notes.trim() || undefined,
                isTaxable: hasTaxableTx,
            }, userId);

            onSuccess(`Invoice baru berhasil dibuat di Modul Keuangan dan dihubungkan ke ${targetTransactions.length} STT!`);
        } catch (err: any) {
            console.error('Error creating & linking invoice:', err);
            alert('Gagal membuat invoice: ' + (err?.message || 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    const todayStart = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in duration-200">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-start bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0">
                    <div>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                            <Link2 size={12} /> Sinkronisasi Modul Keuangan &amp; Pemberangkatan
                        </span>
                        <h3 className="font-black text-gray-900 text-base sm:text-lg mt-1">
                            Hubungkan {targetTransactions.length} STT ke Invoice Keuangan
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                            Pilih invoice yang sudah dibuat di Keuangan, atau buat tagihan invoice baru secara langsung.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/80 rounded-full text-gray-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Selected STTs Snapshot */}
                <div className="px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-400 font-semibold">STT Terpilih:</span>
                        {targetTransactions.slice(0, 4).map(tx => (
                            <span key={tx.id} className="font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-blue-200">
                                {tx.noSTT}
                            </span>
                        ))}
                        {targetTransactions.length > 4 && (
                            <span className="text-[11px] text-slate-300 font-bold">
                                +{targetTransactions.length - 4} lainnya
                            </span>
                        )}
                    </div>
                    <div className="font-mono font-black text-emerald-400 text-sm">
                        Total: {formatRupiah(totalTargetAmount)}
                    </div>
                </div>

                {/* Mode Tabs */}
                <div className="p-3 bg-gray-50 border-b border-gray-200 flex gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveMode('existing')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                            activeMode === 'existing'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                        <Link2 size={14} /> Pilih Invoice yang Sudah Ada ({invoices.filter(i => i.status !== 'Cancelled').length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveMode('create')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                            activeMode === 'create'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                        <Plus size={14} /> Buat Invoice Baru di Keuangan
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-4 sm:p-5 overflow-y-auto flex-1">
                    {activeMode === 'existing' ? (
                        <div className="space-y-3">
                            {/* Search & Filter */}
                            <div className="flex flex-wrap gap-2">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Cari No Invoice atau Nama Pengirim..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-200"
                                    />
                                </div>
                                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-[11px] font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('all')}
                                        className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'}`}
                                    >
                                        Semua
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('unpaid')}
                                        className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'unpaid' ? 'bg-white text-amber-700 shadow-2xs' : 'text-gray-600'}`}
                                    >
                                        Belum Lunas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('paid')}
                                        className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'paid' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-gray-600'}`}
                                    >
                                        Lunas
                                    </button>
                                </div>
                            </div>

                            {/* Invoice List */}
                            <div className="space-y-2.5">
                                {filteredInvoices.length === 0 ? (
                                    <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-xs text-gray-500">
                                        Tidak ada invoice yang cocok. Anda dapat membuat invoice baru di tab sebelah.
                                    </div>
                                ) : (
                                    filteredInvoices.map(inv => {
                                        const isPaid = inv.status === 'Paid';
                                        const issueD = inv.issueDate instanceof Date ? inv.issueDate : new Date(inv.issueDate);
                                        const dueD = inv.dueDate instanceof Date ? inv.dueDate : new Date(inv.dueDate);
                                        const isOverdue = !isPaid && dueD < todayStart;

                                        return (
                                            <div
                                                key={inv.id}
                                                className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                    isPaid
                                                        ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400'
                                                        : isOverdue
                                                        ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
                                                        : 'bg-white border-gray-200 hover:border-blue-400'
                                                }`}
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono font-black text-sm text-blue-800">
                                                            Inv #{inv.invoiceNumber}
                                                        </span>
                                                        {isPaid ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                <CheckCircle2 size={10} /> LUNAS
                                                            </span>
                                                        ) : isOverdue ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                                                <AlertCircle size={10} /> JATUH TEMPO
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                                <Clock size={10} /> BELUM LUNAS
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                                                        <User size={12} className="text-gray-400" />
                                                        {inv.clientName}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 flex flex-wrap items-center gap-2">
                                                        <span>Tgl: {issueD.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                        <span>•</span>
                                                        <span>{inv.transactionIds?.length || 0} Resi STT</span>
                                                        <span>•</span>
                                                        <span className="font-mono font-bold text-gray-800">{formatRupiah(inv.totalAmount)}</span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    disabled={submitting}
                                                    onClick={() => handleLinkToExisting(inv)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shrink-0 shadow-xs active:scale-95 disabled:opacity-50 ${
                                                        isPaid
                                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                    }`}
                                                >
                                                    <Link2 size={13} />
                                                    Hubungkan
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateAndLink} className="space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">
                                        Nama Klien / Pengirim *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        placeholder="Nama pengirim / klien..."
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-200"
                                    />
                                </div>
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">
                                        Nomor Invoice (Opsional)
                                    </label>
                                    <input
                                        type="text"
                                        value={customInvoiceNumber}
                                        onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                                        placeholder="Kosongkan untuk nomor otomatis"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-200"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-extrabold text-gray-800 block mb-1">
                                    Alamat Klien (Opsional)
                                </label>
                                <input
                                    type="text"
                                    value={clientAddress}
                                    onChange={(e) => setClientAddress(e.target.value)}
                                    placeholder="Alamat klien..."
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">
                                        Tanggal Terbit Invoice
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={issueDate}
                                        onChange={(e) => setIssueDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-200"
                                    />
                                </div>
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1">
                                        Tanggal Jatuh Tempo
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-200"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-extrabold text-gray-800 block mb-1">
                                    Catatan Invoice (Opsional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Contoh: Transfer ke BCA ..."
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                            </div>

                            <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl flex justify-between items-center">
                                <div>
                                    <span className="text-[11px] font-bold text-indigo-800 block">
                                        Total Tagihan ({targetTransactions.length} STT{hasTaxableTx ? ' + PPN 1.1%' : ''}):
                                    </span>
                                    <span className="text-[10px] text-indigo-600">
                                        Invoice akan langsung muncul di Modul Keuangan &amp; Penagihan IKA.
                                    </span>
                                </div>
                                <span className="font-mono font-black text-base text-indigo-950">
                                    {formatRupiah(totalTargetAmount)}
                                </span>
                            </div>

                            <div className="flex gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                >
                                    <Plus size={15} />
                                    {submitting ? 'Membuat Invoice...' : 'Buat & Hubungkan Invoice'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

