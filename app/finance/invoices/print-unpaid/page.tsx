'use client';

import { use, useEffect, useState, useMemo, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices } from '@/lib/firestore-invoices';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { formatRupiah, terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';
import { Printer, ArrowLeft, Filter, Search, CheckSquare } from 'lucide-react';
import Link from 'next/link';

function PrintUnpaidInvoicesContent({ 
    searchParams 
}: { 
    searchParams: { month?: string } 
}) {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const initialMonth = searchParams.month || '';
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);

    useEffect(() => {
        if (searchParams.month) {
            setSelectedMonth(searchParams.month);
        }
    }, [searchParams.month]);

    useEffect(() => {
        if (!user) return;

        const unsubscribeInvoices = subscribeToInvoices(user.uid, (data) => {
            const unpaidInvoices = data.filter(inv => inv.status !== 'Paid');
            unpaidInvoices.sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());
            setInvoices(unpaidInvoices);
            setLoading(false);
        });

        const unsubscribeTx = subscribeToTransactions((txData) => {
            setTransactions(txData);
        }, user.uid);

        return () => {
            unsubscribeInvoices();
            unsubscribeTx();
        };
    }, [user]);

    // Live reconciliation of unpaid invoices with transaction state (clientName, totalAmount, sttNumbers)
    const { liveUnpaidInvoices, sttNumbers } = useMemo(() => {
        const txMap = new Map(transactions.map(t => [t.id, t]));
        const mapping: Record<string, string> = {};

        const processed = invoices.map(inv => {
            if (!inv.transactionIds || inv.transactionIds.length === 0) return inv;
            const linked = inv.transactionIds.map(tid => txMap.get(tid)).filter((t): t is Transaction => t !== undefined);
            if (linked.length === 0) return inv;

            mapping[inv.id] = linked.map(t => t.noSTT.replace(/^STT/i, '')).join(', ');

            const primaryTx = linked[0];
            const liveClientName = primaryTx.pengirimName || inv.clientName;
            const subtotal = linked.reduce((sum, t) => sum + (t.jumlah || 0), 0);
            const isTaxable = linked.some(t => t.isTaxable || (t.ppn && t.ppn > 0));
            const liveTotalAmount = subtotal + (isTaxable ? Math.round(subtotal * 0.011) : 0);

            return {
                ...inv,
                clientName: liveClientName,
                clientAddress: primaryTx.pengirimAddress || inv.clientAddress,
                totalAmount: liveTotalAmount,
            };
        });

        return { liveUnpaidInvoices: processed, sttNumbers: mapping };
    }, [invoices, transactions]);

    // Available months dropdown
    const availableMonths = useMemo(() => {
        const monthsSet = new Set<string>();
        liveUnpaidInvoices.forEach(inv => {
            const date = new Date(inv.issueDate);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthsSet.add(monthStr);
        });
        return Array.from(monthsSet).sort().reverse().map(m => {
            const [y, mm] = m.split('-');
            const date = new Date(parseInt(y), parseInt(mm) - 1);
            return {
                value: m,
                label: date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
            };
        });
    }, [liveUnpaidInvoices]);

    // Filtered list by month & search
    const filteredInvoices = useMemo(() => {
        return liveUnpaidInvoices.filter(inv => {
            if (selectedMonth) {
                const date = new Date(inv.issueDate);
                const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (monthStr !== selectedMonth) return false;
            }
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchesInv = inv.invoiceNumber.toLowerCase().includes(term);
                const matchesClient = inv.clientName.toLowerCase().includes(term);
                const matchesStt = (sttNumbers[inv.id] || '').toLowerCase().includes(term);
                if (!matchesInv && !matchesClient && !matchesStt) return false;
            }
            return true;
        });
    }, [liveUnpaidInvoices, selectedMonth, searchTerm, sttNumbers]);

    // Sync selected items when filtered list changes
    useEffect(() => {
        setSelectedIds(new Set(filteredInvoices.map(inv => inv.id)));
    }, [selectedMonth, filteredInvoices.length]);

    const totalUnpaidAmount = useMemo(() => {
        return filteredInvoices
            .filter(inv => selectedIds.has(inv.id))
            .reduce((sum, inv) => sum + inv.totalAmount, 0);
    }, [filteredInvoices, selectedIds]);

    const selectedCount = useMemo(() => {
        return filteredInvoices.filter(inv => selectedIds.has(inv.id)).length;
    }, [filteredInvoices, selectedIds]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
        else setSelectedIds(new Set());
    };

    if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Memuat data tagihan belum lunas...</div>;

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { background: white !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .a4-page { box-shadow: none !important; margin: 0 !important; border: none !important; }
                }
                .unpaid-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
                .unpaid-table th, .unpaid-table td { border: 1px solid #000; padding: 5px 6px; }
                .unpaid-table th { font-weight: bold; text-align: center; background: #f8fafc; text-transform: uppercase; }
            `}} />

            {/* Print Controls Topbar (Hidden in Print) */}
            <div className="no-print bg-white p-5 shadow-sm mb-6 border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/finance/invoices" className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                                <ArrowLeft size={20} />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <CheckSquare size={22} className="text-blue-600" /> Cetak Tagihan Belum Lunas
                                </h1>
                                <p className="text-xs text-gray-500">Rekapitulasi piutang berjalan lengkap dengan kotak checklist fisik</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => window.print()}
                                disabled={selectedCount === 0}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                            >
                                <Printer size={16} /> Cetak Dokumen PDF ({selectedCount})
                            </button>
                        </div>
                    </div>

                    {/* Controls & Filter bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-gray-100 text-xs">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                                <Filter size={14} className="text-blue-600" />
                                <span className="font-semibold text-gray-600">Bulan:</span>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="bg-transparent border-none outline-none font-bold text-gray-800 cursor-pointer"
                                >
                                    <option value="">Semua Bulan</option>
                                    {availableMonths.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl w-64">
                                <Search size={14} className="text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cari No Inv / Klien / STT..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-transparent border-none outline-none font-medium text-gray-800 w-full"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-gray-700 font-semibold">
                            <span>Dipilih: <strong className="text-blue-600">{selectedCount}</strong> dari {filteredInvoices.length} Invoice</span>
                            <span>Total Sisa: <strong className="text-red-600">{formatRupiah(totalUnpaidAmount)}</strong></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* A4 Printable Document Container */}
            <div className="a4-page bg-white mx-auto shadow-2xl rounded-sm border border-gray-200 my-4" style={{ width: '210mm', minHeight: '297mm', padding: '10mm 14mm' }}>
                
                {/* 1. Header Perusahaan */}
                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                    <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="Logo CCE" className="w-16 h-16 object-contain" />
                        <div>
                            <h1 className="font-black text-lg tracking-wide text-gray-900">{COMPANY_INFO.name}</h1>
                            <p className="text-[8.5pt] text-gray-800 leading-tight">{COMPANY_INFO.address}, {COMPANY_INFO.city}</p>
                            <p className="text-[8.5pt] text-gray-800 leading-tight">Telp: {COMPANY_INFO.phone} | Email: info@cahayacargo.co.id</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-lg font-black tracking-wider text-gray-900 uppercase">DAFTAR TAGIHAN BELUM LUNAS</h2>
                        <p className="text-[8.5pt] font-bold text-gray-600 uppercase">
                            {selectedMonth && availableMonths.find(m => m.value === selectedMonth)
                                ? `PERIODE BULAN: ${availableMonths.find(m => m.value === selectedMonth)?.label.toUpperCase()}`
                                : 'REKAPITULASI PIUTANG KESELURUHAN'}
                        </p>
                        <p className="text-[8pt] text-gray-500 mt-0.5">Tgl Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>

                {/* 2. Metadata Info Banner */}
                <div className="flex justify-between items-center mb-4 text-[8.5pt] bg-gray-50 p-2.5 border border-gray-300 rounded">
                    <div>
                        <span className="text-gray-600 mr-1">Status Dokumen:</span>
                        <span className="font-bold text-red-650 uppercase bg-red-100 border border-red-200 px-2 py-0.5 rounded text-[8pt]">
                            BELUM LUNAS (UNPAID)
                        </span>
                    </div>
                    <div className="flex gap-6 font-semibold">
                        <div>Jumlah Invoice: <strong className="font-mono font-bold text-black">{selectedCount} Dokumen</strong></div>
                        <div>Total Outstanding: <strong className="font-mono font-black text-red-650 text-[9.5pt]">{formatRupiah(totalUnpaidAmount)}</strong></div>
                    </div>
                </div>

                {/* 3. Main Unpaid Invoices Table */}
                <table className="unpaid-table mb-4">
                    <thead>
                        <tr>
                            {/* Kotak Checklist Fisik untuk Lapangan / Penagihan */}
                            <th style={{ width: '6%' }} className="text-center">
                                <span className="no-print flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        checked={filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedIds.has(inv.id))}
                                        onChange={(e) => toggleAll(e.target.checked)}
                                        className="w-3.5 h-3.5 cursor-pointer"
                                    />
                                </span>
                                <span className="hidden print:inline font-bold">CEK</span>
                            </th>
                            <th style={{ width: '4%' }}>NO</th>
                            <th style={{ width: '15%' }}>NO. INVOICE</th>
                            <th style={{ width: '12%' }}>TGL JATUH TEMPO</th>
                            <th style={{ width: '28%' }}>KLIEN / PENGIRIM</th>
                            <th style={{ width: '20%' }}>NOMOR STT (RESI)</th>
                            <th style={{ width: '15%' }}>TOTAL TAGIHAN (RP)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-6 text-gray-500 italic">
                                    Tidak ada data tagihan belum lunas untuk periode/filter ini.
                                </td>
                            </tr>
                        ) : (
                            filteredInvoices.map((inv, idx) => {
                                const isSelected = selectedIds.has(inv.id);
                                const todayDate = new Date();
                                todayDate.setHours(0, 0, 0, 0);
                                const dueDateObj = new Date(inv.dueDate);
                                const isOverdue = dueDateObj.getTime() < todayDate.getTime();
                                const diffDays = Math.ceil((todayDate.getTime() - dueDateObj.getTime()) / (1000 * 3600 * 24));

                                return (
                                    <tr key={inv.id} className={`${!isSelected ? 'no-print' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                        {/* Kotak Checklist Column */}
                                        <td className="text-center font-mono">
                                            <div className="no-print flex justify-center items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelection(inv.id)}
                                                    className="w-3.5 h-3.5 cursor-pointer"
                                                />
                                            </div>
                                            {/* Kotak Checklist Fisik Saat Print (Kotak 14px x 14px) */}
                                            <div className="hidden print:flex items-center justify-center">
                                                <div style={{ width: '14px', height: '14px', border: '1.5px solid #000', borderRadius: '2px', display: 'inline-block' }} />
                                            </div>
                                        </td>
                                        
                                        <td className="text-center font-medium text-gray-600">{idx + 1}</td>
                                        <td className="font-mono font-bold text-center text-gray-900">{inv.invoiceNumber}</td>
                                        <td className="text-center">
                                            <span className={isOverdue ? 'text-red-650 font-bold' : 'text-gray-800'}>
                                                {dueDateObj.toLocaleDateString('id-ID')}
                                            </span>
                                            {isOverdue && (
                                                <span className="block text-[7pt] text-red-600 font-bold uppercase">
                                                    (+{diffDays} Hari)
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="font-bold text-gray-900 text-[8.5pt] uppercase">{inv.clientName}</div>
                                            {inv.clientAddress && (
                                                <div className="text-[7.5pt] text-gray-600 truncate max-w-[200px]">{inv.clientAddress}</div>
                                            )}
                                        </td>
                                        <td className="font-mono text-[8pt] leading-tight max-w-[180px] break-words">
                                            {sttNumbers[inv.id] || '-'}
                                        </td>
                                        <td className="text-right font-mono font-black text-gray-900 text-[9pt]">
                                            {formatRupiah(inv.totalAmount)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}

                        {/* Grand Total Row */}
                        <tr className="border-t-2 border-black bg-gray-100 font-black text-[9pt]">
                            <td colSpan={6} className="text-right uppercase py-2.5 pr-4 italic">
                                GRAND TOTAL SISA PIUTANG UNPAID :
                            </td>
                            <td className="text-right font-mono text-red-650 py-2.5 pr-2 font-black text-[10pt]">
                                {formatRupiah(totalUnpaidAmount)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 4. Terbilang Box */}
                <div className="bg-gray-50 border border-gray-300 p-2.5 rounded mb-6 font-mono text-[8.5pt] italic">
                    <span className="font-bold mr-2 not-italic text-black">Terbilang Total Tagihan:</span>
                    # {terbilang(totalUnpaidAmount)} #
                </div>

                {/* 5. Catatan Penagihan & Signatures */}
                <div className="flex justify-between items-end text-[8.5pt] pt-2 border-t border-gray-300">
                    <div className="leading-relaxed">
                        <p className="font-bold underline mb-1 uppercase">Petunjuk Pembayaran Penagihan:</p>
                        {COMPANY_INFO.bankAccounts.map((acc, i) => (
                            <p key={i} className="font-medium text-[8pt]">
                                • Bank {acc.bank} A/C: <strong>{acc.accountNumber}</strong> a.n. {acc.accountName}
                            </p>
                        ))}
                        <p className="mt-2 text-[7.5pt] text-gray-500 italic">
                            * Mohon konfirmasi setelah melakukan transfer atau penyerahan bukti fisik bayar.
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-6 text-center text-[8pt] min-w-[340px]">
                        <div>
                            <p className="text-gray-600 font-semibold mb-12">Dibuat Oleh,</p>
                            <p className="font-bold border-b border-black pb-0.5 inline-block min-w-[90px]">( Finance / Admin )</p>
                        </div>
                        <div>
                            <p className="text-gray-600 font-semibold mb-12">Penagih / Kolektor,</p>
                            <p className="font-bold border-b border-black pb-0.5 inline-block min-w-[90px]">( Petugas Lapangan )</p>
                        </div>
                        <div>
                            <p className="text-gray-600 font-semibold mb-12">Diperiksa Oleh,</p>
                            <p className="font-bold border-b border-black pb-0.5 inline-block min-w-[90px]">( Manajer Keuangan )</p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Floating Action Button (No Print) */}
            <button
                onClick={() => window.print()}
                disabled={selectedCount === 0}
                className="no-print fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm px-7 py-3.5 rounded-full shadow-2xl transition-all flex items-center gap-2.5 active:scale-95 disabled:opacity-50 z-50 cursor-pointer"
            >
                <Printer size={18} />
                <span>Cetak PDF ({selectedCount} Invoice)</span>
            </button>
        </div>
    );
}

export default function PrintUnpaidInvoicesPage(props: {
    searchParams: Promise<{ month?: string }>
}) {
    const searchParams = use(props.searchParams);
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-medium">Memuat halaman cetak...</div>}>
            <PrintUnpaidInvoicesContent searchParams={searchParams} />
        </Suspense>
    );
}
