'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices, updateInvoiceStatus, updateCollectionFeedback } from '@/lib/firestore-invoices';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { formatRupiah, terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';
import {
    Send, Search, Filter, CheckCircle2, Clock, Calendar,
    User, Phone, Copy, Check, ExternalLink, Printer, FileText,
    ArrowUpRight, AlertCircle, Wallet, ShieldCheck, X, Building2,
    MessageSquare, AlertTriangle, ChevronRight, MessageCircleCode, Sparkles
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

export default function PenagihanIkaPage() {
    const { user, role } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter & Tab states
    const [activeTab, setActiveTab] = useState<'unpaid' | 'paid' | 'daily'>('unpaid');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClientFilter, setSelectedClientFilter] = useState('');
    const [dailyReportDate, setDailyReportDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Payment Modal State
    const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<Invoice | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'Transfer' | 'Cash'>('Transfer');
    const [paymentRef, setPaymentRef] = useState('');
    const [processingPayment, setProcessingPayment] = useState(false);

    // Customer Feedback / Reason Log Modal State
    const [selectedInvoiceForFeedback, setSelectedInvoiceForFeedback] = useState<Invoice | null>(null);
    const [feedbackStatus, setFeedbackStatus] = useState<string>('Janji Bayar');
    const [feedbackNotes, setFeedbackNotes] = useState<string>('');
    const [feedbackPromisedDate, setFeedbackPromisedDate] = useState<string>('');
    const [savingFeedback, setSavingFeedback] = useState(false);

    // Toast feedback state
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

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

    // Reconcile Live Invoices with Transaction details
    const { liveInvoices, sttNumbersMap, clientList } = useMemo(() => {
        const txMap = new Map(transactions.map(t => [t.id, t]));
        const sttMapping: Record<string, string> = {};
        const clientsSet = new Set<string>();

        const processed = invoices.map(inv => {
            const linked = (inv.transactionIds || [])
                .map(tid => txMap.get(tid))
                .filter((t): t is Transaction => t !== undefined);

            if (linked.length > 0) {
                sttMapping[inv.id] = linked.map(t => t.noSTT.replace(/^STT/i, '')).join(', ');
                const primaryTx = linked[0];
                const liveClientName = primaryTx.pengirimName || inv.clientName;
                const liveClientAddress = primaryTx.pengirimAddress || inv.clientAddress;
                
                if (liveClientName) clientsSet.add(liveClientName);

                const subtotal = linked.reduce((sum, t) => sum + (t.jumlah || 0), 0);
                const isTaxable = linked.some(t => t.isTaxable || (t.ppn && t.ppn > 0));
                const liveTotalAmount = subtotal + (isTaxable ? Math.round(subtotal * 0.011) : 0);

                return {
                    ...inv,
                    clientName: liveClientName,
                    clientAddress: liveClientAddress,
                    totalAmount: liveTotalAmount,
                };
            }

            if (inv.clientName) clientsSet.add(inv.clientName);
            return inv;
        });

        return {
            liveInvoices: processed,
            sttNumbersMap: sttMapping,
            clientList: Array.from(clientsSet).sort()
        };
    }, [invoices, transactions]);

    // Derived lists
    const unpaidInvoices = useMemo(() => {
        return liveInvoices
            .filter(i => i.status !== 'Paid')
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [liveInvoices]);

    const paidInvoices = useMemo(() => {
        return liveInvoices
            .filter(i => i.status === 'Paid')
            .sort((a, b) => {
                const timeA = a.paidAt?.getTime() || a.paymentDate?.getTime() || a.updatedAt.getTime();
                const timeB = b.paidAt?.getTime() || b.paymentDate?.getTime() || b.updatedAt.getTime();
                return timeB - timeA;
            });
    }, [liveInvoices]);

    // Group Unpaid Invoices by Client Name
    const unpaidGroupedByClient = useMemo(() => {
        const map: Record<string, Invoice[]> = {};
        unpaidInvoices.forEach(inv => {
            // Apply Client filter
            if (selectedClientFilter && inv.clientName.toLowerCase() !== selectedClientFilter.toLowerCase()) {
                return;
            }
            // Apply Search filter
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchesInv = inv.invoiceNumber.toLowerCase().includes(term);
                const matchesClient = inv.clientName.toLowerCase().includes(term);
                const matchesStt = (sttNumbersMap[inv.id] || '').toLowerCase().includes(term);
                if (!matchesInv && !matchesClient && !matchesStt) return;
            }

            const cName = inv.clientName || 'Lainnya';
            if (!map[cName]) map[cName] = [];
            map[cName].push(inv);
        });
        return map;
    }, [unpaidInvoices, selectedClientFilter, searchTerm, sttNumbersMap]);

    // Daily Collection Logs for selected date
    const dailyCollections = useMemo(() => {
        return paidInvoices.filter(inv => {
            const dateObj = inv.paidAt || inv.paymentDate || inv.updatedAt;
            const dateStr = dateObj.toISOString().split('T')[0];
            return dateStr === dailyReportDate;
        });
    }, [paidInvoices, dailyReportDate]);

    // Unpaid Feedback Logs for selected date
    const dailyUnpaidFeedbacks = useMemo(() => {
        return unpaidInvoices.filter(inv => {
            if (!inv.collectionFeedback) return false;
            const fbDate = inv.collectionFeedback.updatedAt ? new Date(inv.collectionFeedback.updatedAt).toISOString().split('T')[0] : '';
            return fbDate === dailyReportDate || inv.collectionFeedback.promisedDate === dailyReportDate;
        });
    }, [unpaidInvoices, dailyReportDate]);

    // KPI Metrics
    const kpiSummary = useMemo(() => {
        const totalUnpaidAmount = unpaidInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
        
        const todayStr = new Date().toISOString().split('T')[0];
        const collectedToday = paidInvoices
            .filter(i => {
                const dateObj = i.paidAt || i.paymentDate || i.updatedAt;
                return dateObj.toISOString().split('T')[0] === todayStr;
            })
            .reduce((sum, i) => sum + i.totalAmount, 0);

        const clientsCount = Object.keys(unpaidGroupedByClient).length;

        return {
            totalUnpaidAmount,
            collectedToday,
            unpaidCount: unpaidInvoices.length,
            clientsCount
        };
    }, [unpaidInvoices, paidInvoices, unpaidGroupedByClient]);

    // ── SINGLE INVOICE WHATSAPP MESSAGE ──
    const generateSingleWaMessage = (inv: Invoice) => {
        const stts = sttNumbersMap[inv.id] || '-';
        const pdfUrl = `${window.location.origin}/finance/invoices/${inv.id}/print`;
        const dueDateFormatted = new Date(inv.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

        return `Halo Yth. Bpk/Ibu *${inv.clientName}*,

Berikut kami sampaikan rincian tagihan Invoice dari *CV. CAHAYA CARGO EXPRESS*:

📄 *No. Invoice:* ${inv.invoiceNumber}
📦 *Resi STT:* ${stts}
📅 *Jatuh Tempo:* ${dueDateFormatted}
💰 *Total Tagihan:* ${formatRupiah(inv.totalAmount)}

📌 *Link Dokumen Invoice PDF:*
${pdfUrl}

💳 *Rekening Resmi Pembayaran (a.n. MARTINI):*
• BCA: 1870444342
• BRI: 0328 0107 3891 501
• MANDIRI: 14000 2408 7851

Mohon konfirmasi setelah melakukan pembayaran. Terima kasih atas kerja samanya. 🙏`;
    };

    // ── CONSOLIDATED CLIENT WHATSAPP RECAP MESSAGE ──
    const generateClientConsolidatedWaMessage = (clientName: string, clientInvoices: Invoice[]) => {
        const grandTotal = clientInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
        const recapPdfUrl = `${window.location.origin}/finance/invoices/print-rekap?client=${encodeURIComponent(clientName)}`;

        let invListText = '';
        clientInvoices.forEach((inv, index) => {
            const stts = sttNumbersMap[inv.id] || '-';
            const dueStr = new Date(inv.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            invListText += `${index + 1}. *No. Inv:* ${inv.invoiceNumber} (Jt. Tempo: ${dueStr})\n   📦 STT: ${stts}\n   💰 Nominal: ${formatRupiah(inv.totalAmount)}\n\n`;
        });

        return `Halo Yth. Bpk/Ibu *${clientName}*,

Berikut kami sampaikan *REKAPAN KESELURUHAN TAGIHAN INVOICE UNPAID* dari *CV. CAHAYA CARGO EXPRESS*:

------------------------------------
${invListText.trim()}
------------------------------------
🔥 *TOTAL KESELURUHAN TAGIHAN (${clientInvoices.length} INVOICE):*
👉 *${formatRupiah(grandTotal)}*
(# ${terbilang(grandTotal)} #)

📄 *Link Cetak Rekap Surat Tagihan PDF:*
${recapPdfUrl}

💳 *Rekening Resmi Pembayaran (a.n. MARTINI):*
• BCA: 1870444342
• BRI: 0328 0107 3891 501
• MANDIRI: 14000 2408 7851

Mohon bantuan untuk segera diproses pelunasannya. Terima kasih banyak atas kerja samanya. 🙏`;
    };

    // Forward Single WA
    const handleForwardSingleWA = (inv: Invoice) => {
        const msg = generateSingleWaMessage(inv);
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    };

    // Copy Single WA
    const handleCopySingleWA = (inv: Invoice) => {
        navigator.clipboard.writeText(generateSingleWaMessage(inv));
        showToast(`Teks WA Invoice ${inv.invoiceNumber} berhasil disalin!`);
    };

    // Forward Consolidated Client WA
    const handleForwardClientConsolidatedWA = (clientName: string, clientInvoices: Invoice[]) => {
        const msg = generateClientConsolidatedWaMessage(clientName, clientInvoices);
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    };

    // Copy Consolidated Client WA
    const handleCopyClientConsolidatedWA = (clientName: string, clientInvoices: Invoice[]) => {
        const msg = generateClientConsolidatedWaMessage(clientName, clientInvoices);
        navigator.clipboard.writeText(msg);
        showToast(`Teks Rekapan WA seluruh invoice ${clientName} berhasil disalin!`);
    };

    // Open Feedback Modal
    const handleOpenFeedbackModal = (inv: Invoice) => {
        setSelectedInvoiceForFeedback(inv);
        setFeedbackStatus(inv.collectionFeedback?.status || 'Janji Bayar');
        setFeedbackNotes(inv.collectionFeedback?.notes || '');
        setFeedbackPromisedDate(inv.collectionFeedback?.promisedDate || '');
    };

    // Save Customer Feedback / Collection Notes
    const handleSaveCollectionFeedback = async () => {
        if (!selectedInvoiceForFeedback) return;
        setSavingFeedback(true);

        try {
            const officerName = user?.displayName || user?.email || 'Officer Penagihan IKA';
            await updateCollectionFeedback(selectedInvoiceForFeedback.id, {
                status: feedbackStatus,
                notes: feedbackNotes.trim(),
                promisedDate: feedbackPromisedDate || undefined,
                officer: officerName,
            });

            showToast(`Catatan penagihan untuk invoice ${selectedInvoiceForFeedback.invoiceNumber} disimpan!`);
            setSelectedInvoiceForFeedback(null);
        } catch (error: any) {
            console.error('Error saving feedback:', error);
            alert(`Gagal menyimpan catatan penagihan: ${error.message}`);
        } finally {
            setSavingFeedback(false);
        }
    };

    // Open Pay Invoice Modal
    const handleOpenPayModal = (inv: Invoice) => {
        setSelectedInvoiceToPay(inv);
        setPaymentMethod('Transfer');
        setPaymentRef('');
    };

    // Process Payment Execution
    const handleExecutePayment = async () => {
        if (!selectedInvoiceToPay) return;
        setProcessingPayment(true);

        try {
            const operatorName = user?.displayName || user?.email || 'Officer Penagihan IKA';
            await updateInvoiceStatus(selectedInvoiceToPay.id, 'Paid', {
                date: new Date(),
                method: paymentMethod,
                ref: paymentRef.trim() || undefined,
                paidBy: operatorName,
            });

            showToast(`Invoice ${selectedInvoiceToPay.invoiceNumber} berhasil dilunasi!`);
            setSelectedInvoiceToPay(null);
        } catch (error: any) {
            console.error('Failed to execute payment:', error);
            alert(`Gagal memproses pelunasan: ${error.message}`);
        } finally {
            setProcessingPayment(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500 font-medium">Memuat modul Penagihan IKA...</div>;
    }

    return (
        <ProtectedRoute>
            <div className="space-y-6 pb-24 max-w-7xl mx-auto">

                {/* Floating Toast Notification */}
                {toastMessage && (
                    <div className="fixed top-6 right-6 bg-slate-900 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-2.5 animate-bounce border border-slate-700">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* ── Ultra Modern Header Toolbar ── */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-xs">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
                            <Send size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight">PENAGIHAN IKA</h1>
                                <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                    VERSI 2.0 (LIVE REKAPAN & FEEDBACK)
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                                Eksekusi penagihan, forward rekapan kolektif WA per client, & pencatatan respon customer
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <Link
                            href={`/finance/penagihan-ika/print-daily?date=${dailyReportDate}`}
                            target="_blank"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                        >
                            <Printer size={16} /> Cetak Laporan Penagihan Harian
                        </Link>
                        {role === 'admin' && (
                            <Link
                                href="/finance/invoices"
                                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2"
                            >
                                <FileText size={16} className="text-indigo-600" /> Daftar Invoice
                            </Link>
                        )}
                    </div>
                </div>

                {/* ── Summary KPI Cards Grid ── */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-rose-600 to-red-700 p-5 rounded-3xl text-white shadow-xl shadow-rose-600/20">
                        <span className="text-xs text-rose-100 font-bold block mb-1">Total Sisa Piutang Unpaid</span>
                        <span className="text-2xl font-black tracking-tight">{formatRupiah(kpiSummary.totalUnpaidAmount)}</span>
                        <span className="text-[10px] text-rose-200 block mt-1.5 font-medium">
                            {kpiSummary.unpaidCount} invoice menunggu tagihan
                        </span>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 rounded-3xl text-white shadow-xl shadow-emerald-600/20">
                        <span className="text-xs text-emerald-100 font-bold block mb-1">Hasil Ditagih Hari Ini</span>
                        <span className="text-2xl font-black tracking-tight">{formatRupiah(kpiSummary.collectedToday)}</span>
                        <span className="text-[10px] text-emerald-200 block mt-1.5 font-medium">
                            Pelunasan berhasil hari ini
                        </span>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
                        <span className="text-xs text-gray-500 font-bold block mb-1">Invoice Belum Lunas</span>
                        <span className="text-3xl font-black text-amber-600">{kpiSummary.unpaidCount}</span>
                        <span className="text-[10px] text-gray-400 block mt-1">Siap ditagih / forward WA</span>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
                        <span className="text-xs text-gray-500 font-bold block mb-1">Pelanggan Aktif Unpaid</span>
                        <span className="text-3xl font-black text-indigo-600">{kpiSummary.clientsCount}</span>
                        <span className="text-[10px] text-gray-400 block mt-1">Perusahaan / Klien</span>
                    </div>
                </div>

                {/* ── Main Tab Container ── */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
                    
                    {/* Header Tabs & Filters */}
                    <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        
                        {/* Tabs */}
                        <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl w-full md:w-auto">
                            <button
                                onClick={() => setActiveTab('unpaid')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'unpaid' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                <Clock size={15} /> Belum Lunas ({unpaidInvoices.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('paid')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'paid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                <CheckCircle2 size={15} /> Riwayat Lunas ({paidInvoices.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('daily')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'daily' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                <Printer size={15} /> Rekapan Penagihan Harian
                            </button>
                        </div>

                        {/* Search & Date Controls */}
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            {activeTab === 'unpaid' && (
                                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
                                    <Building2 size={14} className="text-indigo-600" />
                                    <span className="font-bold text-gray-500">Filter Klien:</span>
                                    <select
                                        value={selectedClientFilter}
                                        onChange={(e) => setSelectedClientFilter(e.target.value)}
                                        className="bg-transparent border-none outline-none font-extrabold text-gray-800 cursor-pointer"
                                    >
                                        <option value="">Semua Pelanggan</option>
                                        {clientList.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {activeTab === 'daily' && (
                                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
                                    <Calendar size={14} className="text-blue-600" />
                                    <span className="font-bold text-gray-500">Pilih Tanggal:</span>
                                    <input
                                        type="date"
                                        value={dailyReportDate}
                                        onChange={(e) => setDailyReportDate(e.target.value)}
                                        className="bg-transparent border-none outline-none font-bold text-gray-800 cursor-pointer"
                                    />
                                </div>
                            )}

                            <div className="relative flex-1 sm:w-64">
                                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cari No Inv / Klien / STT..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs w-full focus:ring-2 focus:ring-indigo-100 transition-all outline-none font-semibold"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── TAB 1: TAGIHAN BELUM LUNAS PER KLIEN ── */}
                    {activeTab === 'unpaid' && (
                        <div className="p-6 space-y-8">
                            {Object.keys(unpaidGroupedByClient).length === 0 ? (
                                <div className="text-center py-20 text-gray-400 font-medium">
                                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3 opacity-40" />
                                    Tidak ada tagihan invoice belum lunas untuk kriteria pencarian ini.
                                </div>
                            ) : (
                                Object.entries(unpaidGroupedByClient).map(([clientName, clientInvoicesList]) => {
                                    const clientTotal = clientInvoicesList.reduce((sum, i) => sum + i.totalAmount, 0);

                                    return (
                                        <div key={clientName} className="border border-gray-200 rounded-3xl overflow-hidden shadow-xs">
                                            
                                            {/* ── CLIENT CARD KOLEKTIF HEADER ── */}
                                            <div className="bg-slate-900 text-white p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                <div className="flex items-center gap-3.5">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-md">
                                                        {clientName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-lg text-white tracking-wide">{clientName}</h3>
                                                        <p className="text-xs text-slate-300 font-medium mt-0.5">
                                                            {clientInvoicesList.length} Invoice Unpaid • Total Tagihan Kolektif: <strong className="text-emerald-400 font-mono text-sm font-black">{formatRupiah(clientTotal)}</strong>
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* CONSOLIDATED RECAP ACTIONS FOR THIS CLIENT */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {/* Forward Consolidated WA for Client */}
                                                    <button
                                                        onClick={() => handleForwardClientConsolidatedWA(clientName, clientInvoicesList)}
                                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                                        title="Forward Rekapan Semua Invoice Client Ini ke WhatsApp"
                                                    >
                                                        <Send size={14} /> 💬 Forward Rekapan WA Client
                                                    </button>

                                                    {/* Copy Consolidated WA Text for Client */}
                                                    <button
                                                        onClick={() => handleCopyClientConsolidatedWA(clientName, clientInvoicesList)}
                                                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-2 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                                        title="Salin Teks Rekapan WA Semua Invoice Client Ini"
                                                    >
                                                        <Copy size={14} /> 📋 Salin Rekapan WA
                                                    </button>

                                                    {/* Printable Client Invoice Recap PDF */}
                                                    <Link
                                                        href={`/finance/invoices/print-rekap?client=${encodeURIComponent(clientName)}`}
                                                        target="_blank"
                                                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                                                        title="Cetak Dokumen Rekapan PDF Untuk Client Ini"
                                                    >
                                                        <Printer size={14} /> 📄 Rekapan PDF Client
                                                    </Link>
                                                </div>
                                            </div>

                                            {/* Invoices List Table for this Client */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                                                        <tr>
                                                            <th className="py-3 px-4">No. Invoice</th>
                                                            <th className="py-3 px-4">Tgl & Jatuh Tempo</th>
                                                            <th className="py-3 px-4">Resi STT Terkait</th>
                                                            <th className="py-3 px-4 text-right">Total Tagihan (Rp)</th>
                                                            <th className="py-3 px-4">Respon / Catatan Customer (Field)</th>
                                                            <th className="py-3 px-4 text-center">Tindakan Penagihan</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {clientInvoicesList.map((inv) => {
                                                            const todayDate = new Date();
                                                            todayDate.setHours(0, 0, 0, 0);
                                                            const dueDateObj = new Date(inv.dueDate);
                                                            const isOverdue = dueDateObj.getTime() < todayDate.getTime();
                                                            const diffDays = Math.ceil((todayDate.getTime() - dueDateObj.getTime()) / (1000 * 3600 * 24));
                                                            const fb = inv.collectionFeedback;

                                                            return (
                                                                <tr key={inv.id} className="hover:bg-indigo-50/20 transition-colors">
                                                                    <td className="py-4 px-4 font-mono font-extrabold text-indigo-900 text-sm">
                                                                        {inv.invoiceNumber}
                                                                    </td>

                                                                    <td className="py-4 px-4">
                                                                        <span className={isOverdue ? 'text-red-600 font-bold' : 'text-gray-800 font-medium'}>
                                                                            {dueDateObj.toLocaleDateString('id-ID')}
                                                                        </span>
                                                                        {isOverdue && (
                                                                            <span className="block text-[9px] text-red-600 font-black uppercase">
                                                                                Terlambat +{diffDays} Hari
                                                                            </span>
                                                                        )}
                                                                    </td>

                                                                    <td className="py-4 px-4 font-mono text-[11px] text-gray-600 max-w-[160px] break-words">
                                                                        {sttNumbersMap[inv.id] || '-'}
                                                                    </td>

                                                                    <td className="py-4 px-4 text-right font-mono font-black text-gray-900 text-sm whitespace-nowrap">
                                                                        {formatRupiah(inv.totalAmount)}
                                                                    </td>

                                                                    {/* CUSTOMER RESPONSE / FEEDBACK COLUMN */}
                                                                    <td className="py-4 px-4">
                                                                        {fb ? (
                                                                            <div className="space-y-1">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="font-extrabold text-[10px] uppercase bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full">
                                                                                        {fb.status}
                                                                                    </span>
                                                                                    {fb.promisedDate && (
                                                                                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                                                                            Jt. Bayar: {new Date(fb.promisedDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                {fb.notes && (
                                                                                    <p className="text-[11px] text-gray-700 italic max-w-[220px]">
                                                                                        "{fb.notes}"
                                                                                    </p>
                                                                                )}
                                                                                <div className="text-[9px] text-gray-400 font-medium">
                                                                                    Recorded by {fb.officer}
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => handleOpenFeedbackModal(inv)}
                                                                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center gap-1"
                                                                            >
                                                                                <MessageSquare size={13} /> + Catat Alasan / Respon
                                                                            </button>
                                                                        )}
                                                                    </td>

                                                                    {/* INDIVIDUAL INVOICE ACTIONS */}
                                                                    <td className="py-4 px-4 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                                            {/* Single WA */}
                                                                            <button
                                                                                onClick={() => handleForwardSingleWA(inv)}
                                                                                className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 font-bold transition-all"
                                                                                title="Forward Single Invoice WA"
                                                                            >
                                                                                <Send size={14} />
                                                                            </button>

                                                                            {/* Copy Single WA */}
                                                                            <button
                                                                                onClick={() => handleCopySingleWA(inv)}
                                                                                className="p-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg border border-gray-300 font-bold transition-all"
                                                                                title="Salin Teks WA Invoice"
                                                                            >
                                                                                <Copy size={14} />
                                                                            </button>

                                                                            {/* Log Customer Feedback */}
                                                                            <button
                                                                                onClick={() => handleOpenFeedbackModal(inv)}
                                                                                className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 font-bold transition-all"
                                                                                title="Catat Alasan / Respon Customer Penagihan"
                                                                            >
                                                                                <MessageSquare size={14} />
                                                                            </button>

                                                                            {/* Single Invoice PDF */}
                                                                            <Link
                                                                                href={`/finance/invoices/${inv.id}/print`}
                                                                                target="_blank"
                                                                                className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 font-bold transition-all"
                                                                                title="PDF Single Invoice"
                                                                            >
                                                                                <ExternalLink size={14} />
                                                                            </Link>

                                                                            {/* Pay Invoice */}
                                                                            <button
                                                                                onClick={() => handleOpenPayModal(inv)}
                                                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg shadow-xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer ml-1"
                                                                                title="Tandai Invoice Lunas"
                                                                            >
                                                                                <CheckCircle2 size={13} /> Lunas
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
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* ── TAB 2: RIWAYAT INVOICE LUNAS ── */}
                    {activeTab === 'paid' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                                    <tr>
                                        <th className="py-3.5 px-4 text-center w-10">No</th>
                                        <th className="py-3.5 px-4">No. Invoice</th>
                                        <th className="py-3.5 px-4">Klien / Pengirim</th>
                                        <th className="py-3.5 px-4">Resi STT Terkait</th>
                                        <th className="py-3.5 px-4 text-center">Waktu & Jam Pelunasan</th>
                                        <th className="py-3.5 px-4 text-center">Metode & Bukti</th>
                                        <th className="py-3.5 px-4 text-center">Petugas Penagih</th>
                                        <th className="py-3.5 px-4 text-right">Nominal Lunas (Rp)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-800">
                                    {paidInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-10 text-center text-gray-400 italic">
                                                Belum ada riwayat invoice lunas.
                                            </td>
                                        </tr>
                                    ) : (
                                        paidInvoices.map((inv, idx) => {
                                            const dateObj = inv.paidAt || inv.paymentDate || inv.updatedAt;
                                            const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                                            const timeStr = inv.paidTime || dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

                                            return (
                                                <tr key={inv.id} className="hover:bg-emerald-50/20 transition-colors">
                                                    <td className="py-3.5 px-4 text-center font-medium text-gray-400">{idx + 1}</td>
                                                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">{inv.invoiceNumber}</td>
                                                    <td className="py-3.5 px-4 font-bold text-gray-900 uppercase">{inv.clientName}</td>
                                                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600 max-w-[160px] break-words">
                                                        {sttNumbersMap[inv.id] || '-'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <div className="font-bold text-gray-900">{dateStr}</div>
                                                        <div className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 inline-block mt-0.5">
                                                            ⏱️ {timeStr}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center">
                                                        <span className="font-bold text-gray-800 block">{inv.paymentMethod || 'Cash'}</span>
                                                        {inv.paymentRef && <span className="text-[10px] text-gray-500 font-mono block">Ref: {inv.paymentRef}</span>}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center font-semibold text-gray-700">
                                                        {inv.paidBy || 'Officer'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                                                        {formatRupiah(inv.totalAmount)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── TAB 3: REKAPAN PENAGIHAN HARIAN & RESPOS CUSTOMER ── */}
                    {activeTab === 'daily' && (
                        <div className="p-6 space-y-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl">
                                <div>
                                    <span className="text-xs text-slate-300 uppercase font-extrabold tracking-wider">Rekapan Penagihan Harian</span>
                                    <h2 className="text-xl font-black text-white mt-0.5">Tanggal: {dailyReportDate}</h2>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <span className="text-[10px] text-slate-300 block uppercase font-bold">Total Hasil Ditagih</span>
                                        <span className="text-2xl font-black text-emerald-400 font-mono">
                                            {formatRupiah(dailyCollections.reduce((sum, i) => sum + i.totalAmount, 0))}
                                        </span>
                                    </div>
                                    <Link
                                        href={`/finance/penagihan-ika/print-daily?date=${dailyReportDate}`}
                                        target="_blank"
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-3 rounded-2xl transition-all shadow-md active:scale-95 flex items-center gap-2 ml-4 cursor-pointer"
                                    >
                                        <Printer size={16} /> Cetak Laporan PDF A4
                                    </Link>
                                </div>
                            </div>

                            {/* Section 1: Paid Collections */}
                            <div className="space-y-3">
                                <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2 uppercase tracking-wide">
                                    <CheckCircle2 size={16} className="text-emerald-600" /> Pelunasan Berhasil Tanggal {dailyReportDate} ({dailyCollections.length})
                                </h3>
                                <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                                            <tr>
                                                <th className="py-3.5 px-4 text-center w-10">No</th>
                                                <th className="py-3.5 px-4">Waktu & Jam Pelunasan</th>
                                                <th className="py-3.5 px-4">No. Invoice</th>
                                                <th className="py-3.5 px-4">Klien / Pengirim</th>
                                                <th className="py-3.5 px-4 text-center">Metode & Bukti</th>
                                                <th className="py-3.5 px-4 text-center">Petugas Penagih</th>
                                                <th className="py-3.5 px-4 text-right">Nominal (Rp)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-gray-800">
                                            {dailyCollections.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="py-6 text-center text-gray-400 italic">
                                                        Belum ada pelunasan penagihan yang tercatat pada tanggal {dailyReportDate}.
                                                    </td>
                                                </tr>
                                            ) : (
                                                dailyCollections.map((inv, idx) => {
                                                    const dateObj = inv.paidAt || inv.paymentDate || inv.updatedAt;
                                                    const timeStr = inv.paidTime || dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

                                                    return (
                                                        <tr key={inv.id} className="hover:bg-emerald-50/20 transition-colors">
                                                            <td className="py-3.5 px-4 text-center font-medium text-gray-400">{idx + 1}</td>
                                                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">⏱️ {timeStr}</td>
                                                            <td className="py-3.5 px-4 font-mono font-bold text-gray-900">{inv.invoiceNumber}</td>
                                                            <td className="py-3.5 px-4 font-bold text-gray-900 uppercase">{inv.clientName}</td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                <span className="font-bold text-gray-800 block">{inv.paymentMethod || 'Cash'}</span>
                                                                {inv.paymentRef && <span className="text-[10px] text-gray-500 font-mono block">Ref: {inv.paymentRef}</span>}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center font-semibold text-gray-700">{inv.paidBy || 'Officer'}</td>
                                                            <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 text-sm">{formatRupiah(inv.totalAmount)}</td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Section 2: Customer Collection Feedback Logs */}
                            <div className="space-y-3 pt-4">
                                <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2 uppercase tracking-wide">
                                    <MessageSquare size={16} className="text-indigo-600" /> Respon / Catatan Feedback Customer Tanggal {dailyReportDate} ({dailyUnpaidFeedbacks.length})
                                </h3>
                                <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                                            <tr>
                                                <th className="py-3.5 px-4 text-center w-10">No</th>
                                                <th className="py-3.5 px-4">No. Invoice</th>
                                                <th className="py-3.5 px-4">Klien / Customer</th>
                                                <th className="py-3.5 px-4">Status Hasil Penagihan</th>
                                                <th className="py-3.5 px-4">Catatan / Detail Alasan Customer</th>
                                                <th className="py-3.5 px-4 text-center">Janji Bayar Tgl</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-gray-800">
                                            {dailyUnpaidFeedbacks.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="py-6 text-center text-gray-400 italic">
                                                        Tidak ada catatan feedback / alasan penagihan customer pada tanggal ini.
                                                    </td>
                                                </tr>
                                            ) : (
                                                dailyUnpaidFeedbacks.map((inv, idx) => {
                                                    const fb = inv.collectionFeedback!;
                                                    return (
                                                        <tr key={inv.id} className="hover:bg-indigo-50/20 transition-colors">
                                                            <td className="py-3.5 px-4 text-center font-medium text-gray-400">{idx + 1}</td>
                                                            <td className="py-3.5 px-4 font-mono font-bold text-gray-900">{inv.invoiceNumber}</td>
                                                            <td className="py-3.5 px-4 font-bold text-gray-900 uppercase">{inv.clientName}</td>
                                                            <td className="py-3.5 px-4">
                                                                <span className="font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full text-[10px] uppercase inline-block">
                                                                    {fb.status}
                                                                </span>
                                                                <span className="block text-[9px] text-gray-400 font-medium mt-0.5">Petugas: {fb.officer}</span>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-gray-700 italic">
                                                                "{fb.notes || '-'}"
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-700">
                                                                {fb.promisedDate ? new Date(fb.promisedDate).toLocaleDateString('id-ID') : '-'}
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
                    )}

                </div>

                {/* ── MODAL CATAT RESPON / FEEDBACK PENAGIHAN CUSTOMER ── */}
                {selectedInvoiceForFeedback && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in duration-200">
                            
                            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                                <div>
                                    <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                                        <MessageSquare size={20} className="text-indigo-600" /> Catat Respon / Feedback Customer
                                    </h3>
                                    <p className="text-xs text-gray-500">Log hasil kunjungan / komunikasi penagihan petugas ke customer</p>
                                </div>
                                <button onClick={() => setSelectedInvoiceForFeedback(null)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Target Invoice Details */}
                            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-1.5 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">No. Invoice:</span>
                                    <span className="font-mono font-extrabold text-indigo-900">{selectedInvoiceForFeedback.invoiceNumber}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">Pelanggan / Klien:</span>
                                    <span className="font-bold text-gray-900 uppercase">{selectedInvoiceForFeedback.clientName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">Nominal Tagihan:</span>
                                    <span className="font-mono font-black text-gray-900">{formatRupiah(selectedInvoiceForFeedback.totalAmount)}</span>
                                </div>
                            </div>

                            {/* Preset Status Radio Choices */}
                            <div className="space-y-3 text-xs">
                                <label className="font-black text-gray-800 block">Pilih Status Respon Customer:</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Janji Bayar', icon: '💬' },
                                        { label: 'Banyak Alasan / Menunda', icon: '⚠️' },
                                        { label: 'Menghindar / Sulit Dihubungi', icon: '🚫' },
                                        { label: 'Menolak Bayar / Sengketa', icon: '❌' },
                                        { label: 'Lainnya / Catatan Khusus', icon: '📝' }
                                    ].map(item => (
                                        <button
                                            type="button"
                                            key={item.label}
                                            onClick={() => setFeedbackStatus(item.label)}
                                            className={`p-2.5 rounded-xl border font-bold text-[11px] text-left transition-all flex items-center gap-1.5 ${feedbackStatus === item.label ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                                        >
                                            <span>{item.icon}</span>
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {feedbackStatus === 'Janji Bayar' && (
                                    <div>
                                        <label className="font-bold text-gray-800 block mb-1">Tanggal Janji Bayar Customer:</label>
                                        <input
                                            type="date"
                                            value={feedbackPromisedDate}
                                            onChange={(e) => setFeedbackPromisedDate(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 font-bold"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="font-bold text-gray-800 block mb-1">Catatan Rinci / Alasan Customer:</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Contoh: Customer B janji bayar hari Jumat jam 10 pagi, alasan bendahara lagi dinas luar..."
                                        value={feedbackNotes}
                                        onChange={(e) => setFeedbackNotes(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 font-medium text-xs"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => setSelectedInvoiceForFeedback(null)}
                                    className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleSaveCollectionFeedback}
                                    disabled={savingFeedback}
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                >
                                    {savingFeedback ? 'Menyimpan...' : 'Simpan Catatan Customer'}
                                </button>
                            </div>

                        </div>
                    </div>
                )}

                {/* ── MODAL PELUNASAN INVOICE OLEH PETUGAS ── */}
                {selectedInvoiceToPay && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in duration-200">
                            
                            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                                <div>
                                    <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                                        <CheckCircle2 size={20} className="text-emerald-600" /> Eksekusi Pelunasan Invoice
                                    </h3>
                                    <p className="text-xs text-gray-500">Konfirmasi penerimaan pembayaran dari pelanggan</p>
                                </div>
                                <button onClick={() => setSelectedInvoiceToPay(null)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Invoice Target Details */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">No. Invoice:</span>
                                    <span className="font-mono font-extrabold text-indigo-900 text-sm">{selectedInvoiceToPay.invoiceNumber}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">Pelanggan / Klien:</span>
                                    <span className="font-bold text-gray-900 uppercase">{selectedInvoiceToPay.clientName}</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                                    <span className="text-gray-700 font-bold">Total Nominal Tagihan:</span>
                                    <span className="font-mono font-black text-emerald-700 text-base">{formatRupiah(selectedInvoiceToPay.totalAmount)}</span>
                                </div>
                            </div>

                            {/* Payment Form Fields */}
                            <div className="space-y-4 text-xs">
                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1.5">Metode Pembayaran</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('Transfer')}
                                            className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${paymentMethod === 'Transfer' ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                        >
                                            🏦 Transfer Bank
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('Cash')}
                                            className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${paymentMethod === 'Cash' ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                        >
                                            💵 Tunai (Cash)
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="font-extrabold text-gray-800 block mb-1.5">
                                        {paymentMethod === 'Transfer' ? 'Nomor Referensi / Bukti Transfer' : 'Catatan Setoran Tunai Kasir'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={paymentMethod === 'Transfer' ? 'Contoh: BCA-98127391' : 'Contoh: Diterima oleh Kasir Hilal'}
                                        value={paymentRef}
                                        onChange={(e) => setPaymentRef(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 font-medium"
                                    />
                                </div>
                            </div>

                            {/* Modal Action Buttons */}
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => setSelectedInvoiceToPay(null)}
                                    className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleExecutePayment}
                                    disabled={processingPayment}
                                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                >
                                    {processingPayment ? (
                                        <>Memproses...</>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={16} /> Konfirmasi Lunas
                                        </>
                                    )}
                                </button>
                            </div>

                        </div>
                    </div>
                )}

            </div>
        </ProtectedRoute>
    );
}
