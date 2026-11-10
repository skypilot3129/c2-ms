'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Voyage, Expense } from '@/types/voyage';
import { EXPENSE_CATEGORY_LABELS } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import type { Invoice } from '@/types/invoice';
import type { OwnerShipExpense } from '@/types/owner-ship-report';
import { formatRupiah } from '@/lib/currency';
import {
    buildInvoiceLookup,
    resolveTransactionPaymentInfo,
    summarizeVoyagePayments,
    type ResolvedTransactionPayment,
} from '@/lib/invoice-reconciliation';
import {
    Ship, MapPin, Calendar, Truck, Package,
    TrendingDown, CheckCircle2, Clock,
    Share2, Check, Printer, Edit3, Search, Link2,
    ExternalLink, ChevronDown, ChevronUp, Unlink
} from 'lucide-react';

export interface OwnerVoyageReportViewProps {
    voyage: Voyage;
    transactions: Transaction[];
    invoices: Invoice[];
    ownerShipExpense: OwnerShipExpense | null;
    expenses: Expense[];
    onEditCosts?: () => void;
    onLinkTransactions?: (txList: Transaction[]) => void;
    onUnlinkInvoice?: (invoiceId: string, invoiceNumber: string, txId: string, noSTT: string) => void;
    onNotify?: (message: string) => void;
    showPrintButton?: boolean;
}

type SttFilterMode = 'all' | 'belum_lunas' | 'lunas' | 'uninvoiced';

export default function OwnerVoyageReportView({
    voyage,
    transactions,
    invoices,
    ownerShipExpense,
    expenses,
    onEditCosts,
    onLinkTransactions,
    onUnlinkInvoice,
    onNotify,
    showPrintButton = true,
}: OwnerVoyageReportViewProps) {
    const [sttFilter, setSttFilter] = useState<SttFilterMode>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showZeroCostItems, setShowZeroCostItems] = useState(false);
    const [unpaidExpanded, setUnpaidExpanded] = useState(true);
    const [paidExpanded, setPaidExpanded] = useState(true);
    const [copiedWa, setCopiedWa] = useState(false);

    const activeTransactions = useMemo(
        () => transactions.filter(t => t.status !== 'dibatalkan'),
        [transactions]
    );

    const invoiceLookup = useMemo(() => buildInvoiceLookup(invoices), [invoices]);

    const { txPaymentMap, paidItems, unpaidItems, paymentSummary } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const map = new Map<string, ResolvedTransactionPayment>();
        const paid: { tx: Transaction; info: ResolvedTransactionPayment }[] = [];
        const unpaid: { tx: Transaction; info: ResolvedTransactionPayment }[] = [];

        activeTransactions.forEach(tx => {
            const info = resolveTransactionPaymentInfo(tx, invoiceLookup, today);
            map.set(tx.id, info);
            if (info.isPaid) {
                paid.push({ tx, info });
            } else {
                unpaid.push({ tx, info });
            }
        });

        // Sort unpaid so overdue comes first, then invoiced_unpaid, then uninvoiced
        unpaid.sort((a, b) => {
            const rankA = a.info.isOverdue ? 0 : a.info.state === 'invoiced_unpaid' ? 1 : 2;
            const rankB = b.info.isOverdue ? 0 : b.info.state === 'invoiced_unpaid' ? 1 : 2;
            if (rankA !== rankB) return rankA - rankB;
            return b.info.effectiveAmount - a.info.effectiveAmount;
        });

        paid.sort((a, b) => b.info.effectiveAmount - a.info.effectiveAmount);

        const summary = summarizeVoyagePayments(activeTransactions, invoiceLookup);

        return {
            txPaymentMap: map,
            paidItems: paid,
            unpaidItems: unpaid,
            paymentSummary: summary,
        };
    }, [activeTransactions, invoiceLookup]);

    // Financial calculations
    const financials = useMemo(() => {
        const omzetStt = paymentSummary.totalRevenue;
        const penjualanMakassar = ownerShipExpense?.penjualanMakassar || 0;
        const totalRevenue = omzetStt + penjualanMakassar;

        const shipCostCategories = [
            { key: 'tiket', label: 'Tiket Kapal (SBY)', amount: ownerShipExpense?.tiket || 0, color: 'bg-purple-500' },
            { key: 'tiketMakassar', label: 'Tiket Makassar', amount: ownerShipExpense?.tiketMakassar || 0, color: 'bg-fuchsia-500' },
            { key: 'opsMakassar', label: 'Operasional Makassar', amount: ownerShipExpense?.opsMakassar || 0, color: 'bg-blue-500' },
            { key: 'opsSurabaya', label: 'Operasional Surabaya', amount: ownerShipExpense?.opsSurabaya || 0, color: 'bg-amber-500' },
            { key: 'gajiSopir', label: 'Gaji Sopir / Uang Jalan', amount: ownerShipExpense?.gajiSopir || 0, color: 'bg-emerald-500' },
            { key: 'sewaMobil', label: 'Sewa Mobil / Unit Luar', amount: ownerShipExpense?.sewaMobil || 0, color: 'bg-indigo-500' },
            { key: 'opsTambahan', label: 'Operasional Tambahan', amount: ownerShipExpense?.opsTambahan || 0, color: 'bg-rose-500' },
        ];

        const shipCostsTotal = shipCostCategories.reduce((s, c) => s + c.amount, 0);
        const fieldExpensesTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const combinedExpensesTotal = shipCostsTotal + fieldExpensesTotal;
        const netProfit = totalRevenue - combinedExpensesTotal;
        const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

        const totalKoli = activeTransactions.reduce((s, t) => s + (Number(t.koli) || 0), 0);
        const totalWeight = activeTransactions.reduce((s, t) => s + (Number(t.berat) || 0), 0);
        const costPerKg = totalWeight > 0 ? Math.round(combinedExpensesTotal / totalWeight) : 0;

        const invoicedUnpaidRevenue = unpaidItems
            .filter(item => item.info.state === 'invoiced_unpaid')
            .reduce((s, item) => s + item.info.effectiveAmount, 0);
        const uninvoicedRevenue = unpaidItems
            .filter(item => item.info.state === 'uninvoiced')
            .reduce((s, item) => s + item.info.effectiveAmount, 0);

        return {
            omzetStt,
            penjualanMakassar,
            totalRevenue,
            shipCostCategories,
            shipCostsTotal,
            fieldExpensesTotal,
            combinedExpensesTotal,
            netProfit,
            profitMargin,
            totalKoli,
            totalWeight,
            costPerKg,
            invoicedUnpaidRevenue,
            uninvoicedRevenue,
        };
    }, [paymentSummary, ownerShipExpense, expenses, activeTransactions, unpaidItems]);

    // Filter STT lists
    const { visibleUnpaid, visiblePaid } = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        const matchesQuery = (tx: Transaction, info: ResolvedTransactionPayment) => {
            if (!q) return true;
            return (
                tx.noSTT.toLowerCase().includes(q) ||
                (tx.pengirimName || '').toLowerCase().includes(q) ||
                (tx.penerimaName || '').toLowerCase().includes(q) ||
                (tx.tujuan || '').toLowerCase().includes(q) ||
                (info.displayInvoiceNumber || '').toLowerCase().includes(q)
            );
        };

        const filteredUnpaid = sttFilter === 'lunas'
            ? []
            : unpaidItems.filter(({ tx, info }) => {
                if (sttFilter === 'uninvoiced' && info.state !== 'uninvoiced') return false;
                return matchesQuery(tx, info);
            });

        const filteredPaid = (sttFilter === 'belum_lunas' || sttFilter === 'uninvoiced')
            ? []
            : paidItems.filter(({ tx, info }) => matchesQuery(tx, info));

        return {
            visibleUnpaid: filteredUnpaid,
            visiblePaid: filteredPaid,
        };
    }, [unpaidItems, paidItems, sttFilter, searchTerm]);

    // Progress bar breakdown widths
    const collectionBars = useMemo(() => {
        const denom = paymentSummary.totalRevenue > 0 ? paymentSummary.totalRevenue : 1;
        const paidPct = Math.round((paymentSummary.paidRevenue / denom) * 100);
        const invoicedUnpaidPct = Math.round((financials.invoicedUnpaidRevenue / denom) * 100);
        const uninvoicedPct = Math.max(0, 100 - paidPct - invoicedUnpaidPct);
        return { paidPct, invoicedUnpaidPct, uninvoicedPct };
    }, [paymentSummary, financials]);

    const vehicleList = voyage.vehicleNumbers && voyage.vehicleNumbers.length > 0
        ? voyage.vehicleNumbers
        : voyage.vehicleNumber
        ? [voyage.vehicleNumber]
        : [];

    const depDateFormatted = useMemo(() => {
        const d = voyage.departureDate instanceof Date ? voyage.departureDate : new Date(voyage.departureDate);
        return !isNaN(d.getTime())
            ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
            : '-';
    }, [voyage.departureDate]);

    const statusBadge = useMemo(() => {
        switch (voyage.status) {
            case 'planned':
                return { label: 'Persiapan / Muat', cls: 'bg-blue-500/20 text-blue-200 border-blue-400/30' };
            case 'in-progress':
                return { label: 'Sedang Berlayar', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/30' };
            case 'completed':
                return { label: 'Tiba & Selesai', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' };
            default:
                return { label: 'Dibatalkan', cls: 'bg-rose-500/20 text-rose-200 border-rose-400/30' };
        }
    }, [voyage.status]);

    const activeShipCosts = financials.shipCostCategories.filter(c => c.amount > 0);
    const zeroShipCosts = financials.shipCostCategories.filter(c => c.amount === 0);
    const displayedShipCosts = showZeroCostItems || activeShipCosts.length === 0
        ? financials.shipCostCategories
        : activeShipCosts;

    const scrollToSection = (sectionId: string) => {
        const el = document.getElementById(sectionId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const generateExecutiveWaReport = (): string => {
        let text = `📋 *LAPORAN DETAIL OWNER PEMBERANGKATAN*\n`;
        text += `*CAHAYA CARGO EXPRESS*\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `🚢 *Kapal:* ${voyage.shipName || '-'}\n`;
        text += `📜 *No. Voyage:* ${voyage.voyageNumber}\n`;
        text += `📅 *Berangkat:* ${depDateFormatted}\n`;
        text += `📍 *Rute:* ${voyage.route}\n`;
        if (vehicleList.length > 0) {
            text += `🚛 *Truk:* ${vehicleList.join(', ')}\n`;
        }
        text += `📦 *Muatan:* ${activeTransactions.length} STT • ${financials.totalKoli} Koli • ${(financials.totalWeight / 1000).toFixed(2)} Ton\n\n`;

        text += `💰 *1. KESELURUHAN KEUANGAN:*\n`;
        text += `• Omzet Muatan STT: ${formatRupiah(financials.omzetStt)}\n`;
        if (financials.penjualanMakassar > 0) {
            text += `• Penjualan Makassar: +${formatRupiah(financials.penjualanMakassar)}\n`;
        }
        text += `• *Total Omzet:* *${formatRupiah(financials.totalRevenue)}*\n`;
        text += `• *Total Biaya Ops:* *-${formatRupiah(financials.combinedExpensesTotal)}*\n`;
        text += `👉 *LABA BERSIH:* *${formatRupiah(financials.netProfit)}* (Margin ${financials.profitMargin}%)\n\n`;

        text += `💸 *2. BIAYA OPERASIONAL:*\n`;
        financials.shipCostCategories.forEach(c => {
            if (c.amount > 0) {
                text += `• ${c.label}: ${formatRupiah(c.amount)}\n`;
            }
        });
        if (expenses.length > 0) {
            expenses.forEach(e => {
                text += `• ${EXPENSE_CATEGORY_LABELS[e.category]}${e.description ? ` (${e.description})` : ''}: ${formatRupiah(e.amount)}\n`;
            });
        }
        if (financials.combinedExpensesTotal === 0) {
            text += `• Belum ada biaya tercatat (Rp 0)\n`;
        }
        text += `*Total Pengeluaran:* ${formatRupiah(financials.combinedExpensesTotal)}\n\n`;

        text += `📊 *3. STATUS PENAGIHAN STT:*\n`;
        text += `✅ *Sudah Lunas:* ${paymentSummary.paidCount}/${paymentSummary.totalSttCount} STT (${formatRupiah(paymentSummary.paidRevenue)} • ${paymentSummary.collectionPercent}%)\n`;
        text += `⏳ *Belum Lunas:* ${paymentSummary.unpaidCount} STT (${formatRupiah(paymentSummary.unpaidRevenue)})\n`;

        if (unpaidItems.length > 0) {
            text += `\n⚠️ *RINCIAN STT BELUM LUNAS:*\n`;
            unpaidItems.slice(0, 25).forEach(({ tx, info }, idx) => {
                const statusTag = info.isOverdue
                    ? 'JATUH TEMPO'
                    : info.linkedInvoice
                    ? `Inv #${info.linkedInvoice.invoiceNumber}`
                    : 'BELUM ADA INV';
                text += `${idx + 1}. *${tx.noSTT}* — ${tx.pengirimName} (${formatRupiah(info.effectiveAmount)}) [${statusTag}]\n`;
            });
            if (unpaidItems.length > 25) {
                text += `...dan ${unpaidItems.length - 25} STT belum lunas lainnya.\n`;
            }
        }

        if (paidItems.length > 0) {
            text += `\n✅ *RINCIAN STT SUDAH LUNAS:*\n`;
            paidItems.slice(0, 25).forEach(({ tx, info }, idx) => {
                const invTag = info.linkedInvoice ? `Inv #${info.linkedInvoice.invoiceNumber}` : (info.paymentMethod || 'Lunas');
                text += `${idx + 1}. *${tx.noSTT}* — ${tx.pengirimName} (${formatRupiah(info.effectiveAmount)}) [${invTag}]\n`;
            });
            if (paidItems.length > 25) {
                text += `...dan ${paidItems.length - 25} STT lunas lainnya.\n`;
            }
        }

        if (ownerShipExpense?.notes?.trim() || voyage.notes?.trim()) {
            text += `\n📝 *Catatan:* ${(ownerShipExpense?.notes || voyage.notes || '').trim()}\n`;
        }
        text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `_Dikirim dari Laporan Owner Mobile CCE App_`;
        return text;
    };

    const handleCopyWa = async () => {
        try {
            await navigator.clipboard.writeText(generateExecutiveWaReport());
            setCopiedWa(true);
            onNotify?.('Laporan lengkap (Keseluruhan + Biaya + STT Lunas/Belum Lunas) disalin ke clipboard!');
            setTimeout(() => setCopiedWa(false), 3000);
        } catch {
            alert('Gagal menyalin laporan ke clipboard.');
        }
    };

    return (
        <div className="space-y-4 sm:space-y-5">

            {/* ── QUICK NAVIGATION JUMP BAR + SHARE ACTIONS (MOBILE STICKY FRIENDLY) ── */}
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-2">
                <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <button
                        type="button"
                        onClick={() => scrollToSection('sec-keseluruhan')}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-bold"
                    >
                        📊 Keseluruhan
                    </button>
                    <button
                        type="button"
                        onClick={() => scrollToSection('sec-biaya')}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-bold"
                    >
                        💸 Biaya Ops
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setSttFilter('all');
                            setUnpaidExpanded(true);
                            scrollToSection('sec-belum-lunas');
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold"
                    >
                        ⏳ Belum Lunas ({unpaidItems.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setSttFilter('all');
                            setPaidExpanded(true);
                            scrollToSection('sec-lunas');
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold"
                    >
                        ✅ Lunas ({paidItems.length})
                    </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-500">
                        Live data • {activeTransactions.length} Resi STT
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleCopyWa}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                                copiedWa
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                        >
                            {copiedWa ? <Check size={13} /> : <Share2 size={13} />}
                            {copiedWa ? 'Tersalin!' : 'Salin Laporan WA'}
                        </button>
                        {showPrintButton && (
                            <button
                                type="button"
                                onClick={() => window.open(`/voyages/${voyage.id}/print-report`, '_blank')}
                                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 flex items-center gap-1"
                            >
                                <Printer size={13} />
                                <span>PDF</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── BAGIAN 1: RINGKASAN KESELURUHAN ── */}
            <section
                id="sec-keseluruhan"
                className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-700 space-y-4 scroll-mt-20"
            >
                {/* Header Identitas Kapal */}
                <div className="flex flex-col gap-2 border-b border-white/10 pb-3.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-black bg-blue-500/25 text-blue-200 border border-blue-400/30 px-2.5 py-0.5 rounded-lg">
                            {voyage.voyageNumber}
                        </span>
                        <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge.cls}`}>
                            {statusBadge.label}
                        </span>
                    </div>

                    <div>
                        <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 leading-snug">
                            <Ship size={20} className="text-blue-400 shrink-0" />
                            <span>{voyage.shipName || 'Kapal Belum Diatur'}</span>
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300 mt-1">
                            <span className="inline-flex items-center gap-1">
                                <MapPin size={12} className="text-blue-400" /> {voyage.route}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Calendar size={12} className="text-purple-400" /> {depDateFormatted}
                            </span>
                            {vehicleList.length > 0 && (
                                <span className="inline-flex items-center gap-1 font-mono text-orange-300">
                                    <Truck size={12} /> {vehicleList.join(', ')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Highlight Utama: Laba Bersih */}
                <div className={`p-3.5 sm:p-4 rounded-2xl border ${
                    financials.netProfit >= 0
                        ? 'bg-emerald-500/15 border-emerald-400/30'
                        : 'bg-rose-500/20 border-rose-400/40'
                }`}>
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-200 block">
                                Laba Bersih Pemberangkatan
                            </span>
                            <div className={`text-2xl sm:text-3xl font-black font-mono mt-0.5 ${
                                financials.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'
                            }`}>
                                {formatRupiah(financials.netProfit)}
                            </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                            financials.profitMargin >= 25
                                ? 'bg-emerald-500 text-white'
                                : financials.profitMargin >= 10
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-rose-500 text-white'
                        }`}>
                            Margin {financials.profitMargin}%
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-200 mt-2 pt-2 border-t border-white/10">
                        <span>📦 <strong>{activeTransactions.length}</strong> STT</span>
                        <span>• <strong>{financials.totalKoli.toLocaleString('id-ID')}</strong> Koli</span>
                        <span>• <strong>{(financials.totalWeight / 1000).toFixed(2)} Ton</strong></span>
                        {financials.costPerKg > 0 && (
                            <span>• Biaya/kg: <strong>Rp {financials.costPerKg.toLocaleString('id-ID')}</strong></span>
                        )}
                    </div>
                </div>

                {/* 2x2 Grid Angka Utama (Sangat Enak Dibaca di HP) */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <div className="bg-white/10 border border-white/10 rounded-2xl p-3">
                        <span className="text-[10px] font-bold uppercase text-blue-200 block">
                            Total Omzet Kapal
                        </span>
                        <div className="font-mono font-black text-base sm:text-lg text-white mt-0.5 break-all">
                            {formatRupiah(financials.totalRevenue)}
                        </div>
                        <span className="text-[10px] text-slate-300 block mt-0.5 leading-tight">
                            STT {formatRupiah(financials.omzetStt)}
                            {financials.penjualanMakassar > 0 ? ` + Mks ${formatRupiah(financials.penjualanMakassar)}` : ''}
                        </span>
                    </div>

                    <div className="bg-white/10 border border-white/10 rounded-2xl p-3">
                        <span className="text-[10px] font-bold uppercase text-rose-200 block">
                            Biaya Operasional
                        </span>
                        <div className="font-mono font-black text-base sm:text-lg text-rose-300 mt-0.5 break-all">
                            -{formatRupiah(financials.combinedExpensesTotal)}
                        </div>
                        <span className="text-[10px] text-slate-300 block mt-0.5 leading-tight">
                            {activeShipCosts.length} Pos Kapal
                            {expenses.length > 0 ? ` + ${expenses.length} Lapangan` : ''}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setSttFilter('lunas');
                            setPaidExpanded(true);
                            scrollToSection('sec-stt');
                        }}
                        className="text-left bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 rounded-2xl p-3 transition-colors"
                    >
                        <span className="text-[10px] font-bold uppercase text-emerald-300 flex items-center justify-between">
                            <span>✅ STT Lunas</span>
                            <span>{paymentSummary.collectionPercent}%</span>
                        </span>
                        <div className="font-mono font-black text-base sm:text-lg text-emerald-300 mt-0.5 break-all">
                            {formatRupiah(paymentSummary.paidRevenue)}
                        </div>
                        <span className="text-[10px] text-emerald-100 block mt-0.5 font-semibold">
                            {paymentSummary.paidCount} dari {paymentSummary.totalSttCount} Resi ➔
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setSttFilter('belum_lunas');
                            setUnpaidExpanded(true);
                            scrollToSection('sec-stt');
                        }}
                        className={`text-left rounded-2xl p-3 border transition-colors ${
                            paymentSummary.unpaidCount > 0
                                ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/40'
                                : 'bg-white/5 border-white/10'
                        }`}
                    >
                        <span className="text-[10px] font-bold uppercase text-amber-300 flex items-center justify-between">
                            <span>⏳ Belum Lunas</span>
                            {paymentSummary.uninvoicedCount > 0 && (
                                <span className="text-rose-300">{paymentSummary.uninvoicedCount} No-Inv</span>
                            )}
                        </span>
                        <div className={`font-mono font-black text-base sm:text-lg mt-0.5 break-all ${
                            paymentSummary.unpaidCount > 0 ? 'text-amber-300' : 'text-slate-300'
                        }`}>
                            {formatRupiah(paymentSummary.unpaidRevenue)}
                        </div>
                        <span className="text-[10px] text-amber-100 block mt-0.5 font-semibold">
                            {paymentSummary.unpaidCount} Resi Belum Masuk ➔
                        </span>
                    </button>
                </div>

                {/* Progress Bar Kolektibilitas Tagihan */}
                <div className="bg-black/25 rounded-2xl p-3 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-200">Progres Pelunasan Omzet STT</span>
                        <span className="text-emerald-300 font-mono">{paymentSummary.collectionPercent}% Terbayar</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden flex">
                        {collectionBars.paidPct > 0 && (
                            <div
                                className="h-full bg-emerald-400 transition-all duration-500"
                                style={{ width: `${collectionBars.paidPct}%` }}
                                title={`Lunas: ${collectionBars.paidPct}%`}
                            />
                        )}
                        {collectionBars.invoicedUnpaidPct > 0 && (
                            <div
                                className="h-full bg-amber-400 transition-all duration-500"
                                style={{ width: `${collectionBars.invoicedUnpaidPct}%` }}
                                title={`Ada Invoice (Belum Lunas): ${collectionBars.invoicedUnpaidPct}%`}
                            />
                        )}
                        {collectionBars.uninvoicedPct > 0 && (
                            <div
                                className="h-full bg-rose-400/80 transition-all duration-500"
                                style={{ width: `${collectionBars.uninvoicedPct}%` }}
                                title={`Belum Ada Invoice: ${collectionBars.uninvoicedPct}%`}
                            />
                        )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-300">
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Lunas ({paymentSummary.paidCount})
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400" /> Tagihan Berjalan ({paymentSummary.invoicedUnpaidCount})
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-400" /> Belum Invoice ({paymentSummary.uninvoicedCount})
                        </span>
                    </div>
                </div>
            </section>

            {/* ── BAGIAN 2: RINCIAN BIAYA OPERASIONAL LENGKAP ── */}
            <section
                id="sec-biaya"
                className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200 shadow-xs space-y-4 scroll-mt-20"
            >
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 block">
                            Pengeluaran Trip Pelayaran
                        </span>
                        <h3 className="text-base font-black text-gray-900 flex items-center gap-1.5">
                            <TrendingDown size={18} className="text-rose-600" />
                            Rincian Biaya Operasional
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {onEditCosts && (
                            <button
                                type="button"
                                onClick={onEditCosts}
                                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors"
                            >
                                <Edit3 size={12} /> Edit Biaya
                            </button>
                        )}
                    </div>
                </div>

                {/* Penjualan Makassar Banner if present */}
                {financials.penjualanMakassar > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">
                                Penambah Omzet Kapal
                            </span>
                            <span className="text-xs font-bold text-emerald-950">Penjualan Makassar</span>
                        </div>
                        <span className="font-mono font-black text-sm text-emerald-700">
                            +{formatRupiah(financials.penjualanMakassar)}
                        </span>
                    </div>
                )}

                {/* Itemized Ship Expenses (Stacked Visual Rows - Zero Horizontal Scroll) */}
                <div className="space-y-2.5">
                    {displayedShipCosts.map(item => {
                        const pct = financials.combinedExpensesTotal > 0
                            ? Math.round((item.amount / financials.combinedExpensesTotal) * 100)
                            : 0;
                        return (
                            <div
                                key={item.key}
                                className={`p-3 rounded-2xl border ${
                                    item.amount > 0
                                        ? 'bg-gray-50/80 border-gray-200'
                                        : 'bg-gray-50/30 border-dashed border-gray-200 opacity-70'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-gray-800">{item.label}</span>
                                    <div className="text-right">
                                        <span className={`font-mono font-black text-xs sm:text-sm ${
                                            item.amount > 0 ? 'text-gray-900' : 'text-gray-400'
                                        }`}>
                                            {formatRupiah(item.amount)}
                                        </span>
                                        {item.amount > 0 && (
                                            <span className="ml-1.5 text-[10px] font-bold text-gray-500">
                                                ({pct}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {item.amount > 0 && (
                                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-2">
                                        <div
                                            className={`h-full ${item.color} rounded-full`}
                                            style={{ width: `${Math.max(4, pct)}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {activeShipCosts.length > 0 && zeroShipCosts.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowZeroCostItems(prev => !prev)}
                            className="w-full py-1.5 text-[11px] font-bold text-gray-500 hover:text-gray-800 flex items-center justify-center gap-1"
                        >
                            {showZeroCostItems ? (
                                <>
                                    <ChevronUp size={13} /> Sembunyikan {zeroShipCosts.length} pos biaya Rp 0
                                </>
                            ) : (
                                <>
                                    <ChevronDown size={13} /> Lihat {zeroShipCosts.length} pos biaya lainnya (Rp 0)
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* General Field Expenses if any */}
                {expenses.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 block">
                            Pengeluaran Lapangan Tambahan ({expenses.length} Item)
                        </span>
                        {expenses.map(exp => (
                            <div
                                key={exp.id}
                                className="p-3 rounded-2xl bg-blue-50/40 border border-blue-100 flex items-center justify-between gap-2"
                            >
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-gray-900 truncate">
                                        {EXPENSE_CATEGORY_LABELS[exp.category]}
                                    </div>
                                    <div className="text-[11px] text-gray-600 truncate">
                                        {exp.description || '-'} • {new Date(exp.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                    </div>
                                </div>
                                <span className="font-mono font-black text-xs text-rose-700 shrink-0">
                                    {formatRupiah(exp.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Total Pengeluaran Strip */}
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-rose-950 uppercase tracking-wide">
                        Total Biaya Operasional
                    </span>
                    <span className="font-mono font-black text-base text-rose-700">
                        {formatRupiah(financials.combinedExpensesTotal)}
                    </span>
                </div>

                {/* Catatan Biaya / Operasional */}
                {(ownerShipExpense?.notes?.trim() || voyage.notes?.trim()) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-950">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block mb-0.5">
                            Catatan Biaya &amp; Operasional
                        </span>
                        <p className="whitespace-pre-wrap leading-relaxed font-medium">
                            {ownerShipExpense?.notes?.trim() || voyage.notes?.trim()}
                        </p>
                    </div>
                )}
            </section>

            {/* ── BAGIAN 3: RINCIAN STT BELUM LUNAS & SUDAH LUNAS ── */}
            <section
                id="sec-stt"
                className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200 shadow-xs space-y-4 scroll-mt-20"
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 block">
                            Rincian Resi &amp; Invoice Pelayaran
                        </span>
                        <h3 className="text-base font-black text-gray-900 flex items-center gap-1.5">
                            <Package size={18} className="text-indigo-600" />
                            Detail STT Lunas &amp; Belum Lunas ({activeTransactions.length})
                        </h3>
                    </div>
                </div>

                {/* Filter Pills & Search */}
                <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {[
                            { id: 'all' as SttFilterMode, label: `Semua (${activeTransactions.length})`, activeCls: 'bg-slate-900 text-white', idleCls: 'bg-gray-100 text-gray-700' },
                            { id: 'belum_lunas' as SttFilterMode, label: `⏳ Belum Lunas (${unpaidItems.length})`, activeCls: 'bg-amber-600 text-white', idleCls: 'bg-amber-50 text-amber-800 border border-amber-200' },
                            { id: 'lunas' as SttFilterMode, label: `✅ Lunas (${paidItems.length})`, activeCls: 'bg-emerald-600 text-white', idleCls: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
                            { id: 'uninvoiced' as SttFilterMode, label: `⚠️ Belum Invoice (${paymentSummary.uninvoicedCount})`, activeCls: 'bg-rose-600 text-white', idleCls: 'bg-rose-50 text-rose-800 border border-rose-200' },
                        ].map(pill => (
                            <button
                                key={pill.id}
                                type="button"
                                onClick={() => setSttFilter(pill.id)}
                                className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                                    sttFilter === pill.id ? pill.activeCls : pill.idleCls
                                }`}
                            >
                                {pill.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari No. STT, Pengirim, Penerima, No. Invoice..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                </div>

                {/* GROUP A: STT BELUM LUNAS */}
                {sttFilter !== 'lunas' && (
                    <div id="sec-belum-lunas" className="space-y-2.5 scroll-mt-24">
                        <button
                            type="button"
                            onClick={() => setUnpaidExpanded(prev => !prev)}
                            className="w-full p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-left"
                        >
                            <div>
                                <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                                    <Clock size={14} className="text-amber-600" />
                                    STT Belum Lunas ({visibleUnpaid.length})
                                </div>
                                <div className="text-[11px] text-amber-800 font-semibold mt-0.5">
                                    Total Piutang: <span className="font-mono font-black text-rose-700">{formatRupiah(
                                        visibleUnpaid.reduce((s, item) => s + item.info.effectiveAmount, 0)
                                    )}</span>
                                </div>
                            </div>
                            {unpaidExpanded ? <ChevronUp size={16} className="text-amber-700" /> : <ChevronDown size={16} className="text-amber-700" />}
                        </button>

                        {unpaidExpanded && (
                            <div className="space-y-2">
                                {visibleUnpaid.length === 0 ? (
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-center text-xs text-gray-500">
                                        {unpaidItems.length === 0
                                            ? '🎉 Semua STT di pemberangkatan ini sudah lunas!'
                                            : 'Tidak ada STT belum lunas yang cocok dengan pencarian.'}
                                    </div>
                                ) : (
                                    visibleUnpaid.map(({ tx, info }) => {
                                        const inv = info.linkedInvoice;
                                        return (
                                            <div
                                                key={tx.id}
                                                className={`p-3.5 rounded-2xl border space-y-2 ${
                                                    info.isOverdue
                                                        ? 'bg-rose-50/40 border-rose-200'
                                                        : 'bg-white border-amber-200'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <Link
                                                                href={`/transactions/${tx.id}`}
                                                                className="font-mono font-black text-xs sm:text-sm text-blue-900 hover:underline"
                                                            >
                                                                {tx.noSTT}
                                                            </Link>
                                                            {info.isOverdue ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                                                    JATUH TEMPO
                                                                </span>
                                                            ) : info.state === 'invoiced_unpaid' ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                                                    BELUM LUNAS
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-700 border border-gray-300">
                                                                    BELUM INVOICE
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="font-mono font-black text-xs sm:text-sm text-gray-900">
                                                            {formatRupiah(info.effectiveAmount)}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">
                                                            {tx.koli || 0} Koli • {tx.berat || 0} {tx.beratUnit || 'kg'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-xs text-gray-700 leading-snug">
                                                    <strong className="text-gray-900">{tx.pengirimName}</strong>
                                                    <span className="text-gray-400 mx-1">➔</span>
                                                    <span>{tx.penerimaName}</span>
                                                    {tx.tujuan && (
                                                        <span className="ml-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                                            {tx.tujuan}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                                    {inv ? (
                                                        <>
                                                            <span className="text-gray-600 font-medium">
                                                                Inv <strong className="font-mono text-blue-800">#{inv.invoiceNumber}</strong>
                                                                <span className="text-gray-400 ml-1.5">
                                                                    • Tempo {new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                                </span>
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <Link
                                                                    href={`/finance/invoices/${inv.id}/print`}
                                                                    target="_blank"
                                                                    className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold inline-flex items-center gap-1"
                                                                >
                                                                    <ExternalLink size={11} /> Invoice
                                                                </Link>
                                                                {onUnlinkInvoice && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onUnlinkInvoice(inv.id, inv.invoiceNumber, tx.id, tx.noSTT)}
                                                                        className="p-1 text-gray-400 hover:text-rose-600"
                                                                        title="Lepas dari Invoice"
                                                                    >
                                                                        <Unlink size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-rose-700 font-semibold">
                                                                Belum terhubung ke Invoice Keuangan
                                                            </span>
                                                            {onLinkTransactions && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onLinkTransactions([tx])}
                                                                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold inline-flex items-center gap-1"
                                                                >
                                                                    <Link2 size={11} /> Hubungkan Invoice
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* GROUP B: STT SUDAH LUNAS */}
                {sttFilter !== 'belum_lunas' && sttFilter !== 'uninvoiced' && (
                    <div id="sec-lunas" className="space-y-2.5 scroll-mt-24">
                        <button
                            type="button"
                            onClick={() => setPaidExpanded(prev => !prev)}
                            className="w-full p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-left"
                        >
                            <div>
                                <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="text-emerald-600" />
                                    STT Sudah Lunas ({visiblePaid.length})
                                </div>
                                <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                                    Total Masuk: <span className="font-mono font-black text-emerald-700">{formatRupiah(
                                        visiblePaid.reduce((s, item) => s + item.info.effectiveAmount, 0)
                                    )}</span>
                                </div>
                            </div>
                            {paidExpanded ? <ChevronUp size={16} className="text-emerald-700" /> : <ChevronDown size={16} className="text-emerald-700" />}
                        </button>

                        {paidExpanded && (
                            <div className="space-y-2">
                                {visiblePaid.length === 0 ? (
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-center text-xs text-gray-500">
                                        {paidItems.length === 0
                                            ? 'Belum ada STT yang berstatus lunas pada pemberangkatan ini.'
                                            : 'Tidak ada STT lunas yang cocok dengan pencarian.'}
                                    </div>
                                ) : (
                                    visiblePaid.map(({ tx, info }) => {
                                        const inv = info.linkedInvoice;
                                        return (
                                            <div
                                                key={tx.id}
                                                className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/20 space-y-2"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                        <Link
                                                            href={`/transactions/${tx.id}`}
                                                            className="font-mono font-black text-xs sm:text-sm text-blue-900 hover:underline"
                                                        >
                                                            {tx.noSTT}
                                                        </Link>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                                            <CheckCircle2 size={10} /> LUNAS
                                                            {info.paymentMethod ? ` • ${info.paymentMethod}` : ''}
                                                        </span>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="font-mono font-black text-xs sm:text-sm text-emerald-900">
                                                            {formatRupiah(info.effectiveAmount)}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">
                                                            {tx.koli || 0} Koli • {tx.berat || 0} {tx.beratUnit || 'kg'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-xs text-gray-700 leading-snug">
                                                    <strong className="text-gray-900">{tx.pengirimName}</strong>
                                                    <span className="text-gray-400 mx-1">➔</span>
                                                    <span>{tx.penerimaName}</span>
                                                    {tx.tujuan && (
                                                        <span className="ml-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                                            {tx.tujuan}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="pt-2 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                                    {inv ? (
                                                        <>
                                                            <span className="text-emerald-800 font-medium">
                                                                Inv <strong className="font-mono">#{inv.invoiceNumber}</strong>
                                                                {info.paidAt && (
                                                                    <span className="ml-1.5 text-emerald-700">
                                                                        • Lunas {new Date(info.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <Link
                                                                href={`/finance/invoices/${inv.id}/print`}
                                                                target="_blank"
                                                                className="px-2 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-700 font-bold inline-flex items-center gap-1"
                                                            >
                                                                <ExternalLink size={11} /> Lihat Invoice
                                                            </Link>
                                                        </>
                                                    ) : (
                                                        <span className="text-emerald-700 font-semibold">
                                                            Pelunasan langsung pada resi STT ({tx.pelunasan})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
