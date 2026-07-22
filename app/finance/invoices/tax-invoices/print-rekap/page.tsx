'use client';

import { use, useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices } from '@/lib/firestore-invoices';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { formatRupiah, terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';
import { Printer, ArrowLeft, Filter, Search, Calendar, Building2, Receipt, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

function PrintTaxRekapContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Filter Parameters from URL searchParams
    const initialMonth = searchParams.get('month') || '';
    const initialClient = searchParams.get('client') || '';

    // Filter States
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const [selectedClient, setSelectedClient] = useState(initialClient);
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
    const [searchTerm, setSearchTerm] = useState('');

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

    // Live reconciliation of Tax Invoices with transactions
    const { taxInvoices, sttNumbersMap, clientList } = useMemo(() => {
        const txMap = new Map(transactions.map(t => [t.id, t]));
        const sttMapping: Record<string, string> = {};
        const clientsSet = new Set<string>();

        const filtered = invoices.filter(inv => {
            const linked = (inv.transactionIds || [])
                .map(tid => txMap.get(tid))
                .filter((t): t is Transaction => t !== undefined);

            if (linked.length > 0) {
                sttMapping[inv.id] = linked.map(t => t.noSTT.replace(/^STT/i, '')).join(', ');
            }

            const hasTaxableTx = linked.some(t => t.isTaxable || (t.ppn && t.ppn > 0));
            const isTaxInvoice = inv.isTaxable === true || hasTaxableTx;

            if (isTaxInvoice) {
                const primaryTx = linked[0];
                const clientName = primaryTx?.pengirimName || inv.clientName;
                if (clientName) clientsSet.add(clientName);
            }

            return isTaxInvoice;
        });

        // Sort by Due Date (Jatuh Tempo) ascending
        filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        return {
            taxInvoices: filtered,
            sttNumbersMap: sttMapping,
            clientList: Array.from(clientsSet).sort()
        };
    }, [invoices, transactions]);

    // Available months list
    const availableMonths = useMemo(() => {
        const monthsSet = new Set<string>();
        taxInvoices.forEach(inv => {
            const date = new Date(inv.dueDate);
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
    }, [taxInvoices]);

    // Filtered tax invoices
    const filteredTaxInvoices = useMemo(() => {
        return taxInvoices.filter(inv => {
            // Status Filter
            if (statusFilter === 'unpaid' && inv.status === 'Paid') return false;
            if (statusFilter === 'paid' && inv.status !== 'Paid') return false;

            // Client Filter
            if (selectedClient && inv.clientName.toLowerCase() !== selectedClient.toLowerCase()) {
                return false;
            }

            // Month Filter (by Due Date)
            if (selectedMonth) {
                const dueD = new Date(inv.dueDate);
                const monthStr = `${dueD.getFullYear()}-${String(dueD.getMonth() + 1).padStart(2, '0')}`;
                if (monthStr !== selectedMonth) return false;
            }

            // Date Range Filter (by Due Date)
            if (filterStartDate) {
                const dueD = new Date(inv.dueDate);
                const startD = new Date(filterStartDate);
                startD.setHours(0, 0, 0, 0);
                if (dueD < startD) return false;
            }

            if (filterEndDate) {
                const dueD = new Date(inv.dueDate);
                const endD = new Date(filterEndDate);
                endD.setHours(23, 59, 59, 999);
                if (dueD > endD) return false;
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
    }, [taxInvoices, statusFilter, selectedClient, selectedMonth, filterStartDate, filterEndDate, searchTerm, sttNumbersMap]);

    // KPI Summary
    const summary = useMemo(() => {
        let totalDPP = 0;
        let totalPPN = 0;
        let totalGross = 0;

        filteredTaxInvoices.forEach(inv => {
            totalGross += inv.totalAmount;
            const dpp = Math.round(inv.totalAmount / 1.011);
            const ppn = inv.totalAmount - dpp;
            totalDPP += dpp;
            totalPPN += ppn;
        });

        return { totalDPP, totalPPN, totalGross, count: filteredTaxInvoices.length };
    }, [filteredTaxInvoices]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500 font-medium">Memuat cetak rekap invoice pajak...</div>;
    }

    // Dynamic Filter Title Description for Kop / Header
    const filterDescriptionText = (() => {
        const parts: string[] = [];
        if (selectedClient) parts.push(`KLIEN: ${selectedClient.toUpperCase()}`);
        if (selectedMonth) {
            const mObj = availableMonths.find(m => m.value === selectedMonth);
            if (mObj) parts.push(`BULAN JATUH TEMPO: ${mObj.label.toUpperCase()}`);
        }
        if (filterStartDate || filterEndDate) {
            const startStr = filterStartDate ? new Date(filterStartDate).toLocaleDateString('id-ID') : 'Awal';
            const endStr = filterEndDate ? new Date(filterEndDate).toLocaleDateString('id-ID') : 'Akhir';
            parts.push(`RENTANG JATUH TEMPO: ${startStr} s/d ${endStr}`);
        }
        return parts.length > 0 ? parts.join(' | ') : 'REKAPITULASI KESELURUHAN INVOICE PAJAK';
    })();

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
                .tax-rekap-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
                .tax-rekap-table th, .tax-rekap-table td { border: 1px solid #000; padding: 5px 6px; }
                .tax-rekap-table th { font-weight: bold; text-align: center; background: #f8fafc; text-transform: uppercase; }
            `}} />

            {/* Print Controls Topbar (Hidden in Print) */}
            <div className="no-print bg-white p-5 shadow-sm mb-6 border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push('/finance/invoices/tax-invoices')}
                                className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Receipt size={22} className="text-indigo-600" /> Cetak Rekap Invoice Pajak (PPN 1.1%)
                                </h1>
                                <p className="text-xs text-gray-500">Filter per Klien, Bulan, Tanggal Jatuh Tempo, dan Cetak PDF Formal</p>
                            </div>
                        </div>

                        <button
                            onClick={() => window.print()}
                            disabled={summary.count === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                        >
                            <Printer size={16} /> Cetak Dokumen PDF ({summary.count})
                        </button>
                    </div>

                    {/* Filter Bar Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-100 text-xs">
                        
                        {/* 1. Filter Klien */}
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                            <Building2 size={14} className="text-indigo-600 shrink-0" />
                            <span className="font-semibold text-gray-500 shrink-0">Klien:</span>
                            <select
                                value={selectedClient}
                                onChange={(e) => setSelectedClient(e.target.value)}
                                className="bg-transparent border-none outline-none font-bold text-gray-800 w-full cursor-pointer"
                            >
                                <option value="">Semua Klien</option>
                                {clientList.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Filter Bulan Jatuh Tempo */}
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                            <Calendar size={14} className="text-indigo-600 shrink-0" />
                            <span className="font-semibold text-gray-500 shrink-0">Bulan Jt. Tempo:</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent border-none outline-none font-bold text-gray-800 w-full cursor-pointer"
                            >
                                <option value="">Semua Bulan</option>
                                {availableMonths.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* 3. Filter Rentang Tanggal Jatuh Tempo */}
                        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                            <span className="font-semibold text-gray-500 shrink-0">Jt. Tempo:</span>
                            <input
                                type="date"
                                value={filterStartDate}
                                onChange={(e) => setFilterStartDate(e.target.value)}
                                className="bg-transparent border-none outline-none font-bold text-gray-800 text-[11px] w-28"
                                title="Dari Tanggal Jatuh Tempo"
                            />
                            <span className="text-gray-400 font-bold">s/d</span>
                            <input
                                type="date"
                                value={filterEndDate}
                                onChange={(e) => setFilterEndDate(e.target.value)}
                                className="bg-transparent border-none outline-none font-bold text-gray-800 text-[11px] w-28"
                                title="Sampai Tanggal Jatuh Tempo"
                            />
                        </div>

                        {/* 4. Search Bar */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari No Inv / STT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs w-full focus:ring-2 focus:ring-indigo-100 transition-all outline-none font-medium"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* A4 Printable Document Container */}
            <div className="a4-page bg-white mx-auto shadow-2xl rounded-sm border border-gray-200 my-4" style={{ width: '210mm', minHeight: '297mm', padding: '10mm 14mm' }}>
                
                {/* 1. Header Kop Surat Resmi Cahaya Cargo */}
                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                    <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="Logo Cahaya Cargo" className="w-16 h-16 object-contain" />
                        <div>
                            <h1 className="font-black text-lg tracking-wide text-gray-900">{COMPANY_INFO.name}</h1>
                            <p className="text-[8.5pt] text-gray-800 leading-tight">{COMPANY_INFO.address}, {COMPANY_INFO.city}</p>
                            <p className="text-[8.5pt] text-gray-800 leading-tight">Telp: {COMPANY_INFO.phone} | Email: info@cahayacargo.co.id</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-base font-black tracking-wider text-gray-900 uppercase">REKAPITULASI INVOICE PAJAK (PPN)</h2>
                        <p className="text-[8pt] font-bold text-gray-700 uppercase mt-0.5 max-w-[280px]">
                            {filterDescriptionText}
                        </p>
                        <p className="text-[8pt] text-gray-500 mt-1">Tgl Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>

                {/* 2. Metadata Info Banner */}
                <div className="flex justify-between items-center mb-4 text-[8.5pt] bg-indigo-50/50 border border-indigo-200 p-2.5 rounded">
                    <div>
                        <span className="text-gray-600 mr-1">Kategori Dokumen:</span>
                        <span className="font-bold text-indigo-900 uppercase bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded text-[8pt]">
                            FAKTUR / INVOICE PAJAK PPN 1.1%
                        </span>
                    </div>
                    <div className="flex gap-6 font-semibold">
                        <div>Jumlah Invoice: <strong className="font-mono font-bold text-black">{summary.count} Dokumen</strong></div>
                        <div>Total Gross: <strong className="font-mono font-black text-indigo-900 text-[9.5pt]">{formatRupiah(summary.totalGross)}</strong></div>
                    </div>
                </div>

                {/* 3. Main Tax Invoices Table (MUST SHOW ONLY DUE DATE) */}
                <table className="tax-rekap-table mb-4">
                    <thead>
                        <tr>
                            <th style={{ width: '4%' }}>NO</th>
                            <th style={{ width: '18%' }}>NO. INVOICE PAJAK</th>
                            <th style={{ width: '15%' }}>TANGGAL JATUH TEMPO</th>
                            <th style={{ width: '25%' }}>KLIEN / PENGIRIM</th>
                            <th style={{ width: '18%' }}>NOMOR STT (RESI)</th>
                            <th style={{ width: '10%' }}>DPP (RP)</th>
                            <th style={{ width: '10%' }}>PPN 1.1%</th>
                            <th style={{ width: '15%' }}>TOTAL GROSS (RP)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTaxInvoices.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-6 text-gray-500 italic">
                                    Tidak ada data invoice pajak untuk filter ini.
                                </td>
                            </tr>
                        ) : (
                            filteredTaxInvoices.map((inv, idx) => {
                                const dpp = Math.round(inv.totalAmount / 1.011);
                                const ppn = inv.totalAmount - dpp;
                                const dueDateObj = new Date(inv.dueDate);

                                return (
                                    <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                        <td className="text-center font-medium text-gray-600">{idx + 1}</td>
                                        <td className="font-mono font-bold text-center text-gray-900">{inv.invoiceNumber}</td>
                                        
                                        {/* EXCLUSIVELY DUE DATE ONLY COLUMN */}
                                        <td className="text-center font-bold text-gray-900 font-mono">
                                            {dueDateObj.toLocaleDateString('id-ID')}
                                        </td>

                                        <td>
                                            <div className="font-bold text-gray-900 text-[8.5pt] uppercase">{inv.clientName}</div>
                                            {inv.clientAddress && (
                                                <div className="text-[7.5pt] text-gray-600 truncate max-w-[180px]">{inv.clientAddress}</div>
                                            )}
                                        </td>
                                        
                                        <td className="font-mono text-[8pt] leading-tight max-w-[150px] break-words">
                                            {sttNumbersMap[inv.id] || '-'}
                                        </td>

                                        <td className="text-right font-mono text-gray-700 text-[8.5pt]">
                                            {formatRupiah(dpp)}
                                        </td>

                                        <td className="text-right font-mono text-indigo-700 font-bold text-[8.5pt]">
                                            {formatRupiah(ppn)}
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
                            <td colSpan={5} className="text-right uppercase py-2.5 pr-4 italic">
                                TOTAL REKAPITULASI INVOICE PAJAK :
                            </td>
                            <td className="text-right font-mono text-gray-800 py-2.5">
                                {formatRupiah(summary.totalDPP)}
                            </td>
                            <td className="text-right font-mono text-indigo-800 py-2.5">
                                {formatRupiah(summary.totalPPN)}
                            </td>
                            <td className="text-right font-mono text-indigo-900 py-2.5 pr-2 font-black text-[10pt]">
                                {formatRupiah(summary.totalGross)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 4. Terbilang Box */}
                <div className="bg-gray-50 border border-gray-300 p-2.5 rounded mb-6 font-mono text-[8.5pt] italic">
                    <span className="font-bold mr-2 not-italic text-black">Terbilang Total Gross Tagihan Pajak:</span>
                    # {terbilang(summary.totalGross)} #
                </div>

                {/* 5. Signatures Block */}
                <div className="flex justify-between items-end text-[8.5pt] pt-2 border-t border-gray-300">
                    <div className="leading-relaxed text-[8pt] text-gray-600">
                        <p className="font-bold text-gray-900 uppercase">Catatan Verifikasi Pajak:</p>
                        <p>• Rekapitulasi ini memuat seluruh invoice berstatus Kena Pajak (PPN 1.1%).</p>
                        <p>• Tanggal yang tercantum adalah Tanggal Jatuh Tempo (Due Date) invoice.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-6 text-center text-[8pt] min-w-[340px]">
                        <div>
                            <p className="text-gray-600 font-semibold mb-12">Dibuat Oleh,</p>
                            <p className="font-bold border-b border-black pb-0.5 inline-block min-w-[90px]">( Staf Pajak / Admin )</p>
                        </div>
                        <div>
                            <p className="text-gray-600 font-semibold mb-12">Diperiksa Oleh,</p>
                            <p className="font-bold border-b border-black pb-0.5 inline-block min-w-[90px]">( Manajer Keuangan )</p>
                        </div>
                        <div>
                            <p className="text-gray-600 font-semibold mb-12">Disetujui Oleh,</p>
                            <p className="font-bold border-b border-black pb-0.5 inline-block min-w-[90px]">( Pimpinan / Direktur )</p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Floating Action Button (No Print) */}
            <button
                onClick={() => window.print()}
                disabled={summary.count === 0}
                className="no-print fixed bottom-8 right-8 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-7 py-3.5 rounded-full shadow-2xl transition-all flex items-center gap-2.5 active:scale-95 disabled:opacity-50 z-50 cursor-pointer"
            >
                <Printer size={18} />
                <span>Cetak PDF ({summary.count} Invoice Pajak)</span>
            </button>
        </div>
    );
}

export default function PrintTaxRekapPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-medium">Memuat cetakan rekap invoice pajak...</div>}>
            <PrintTaxRekapContent />
        </Suspense>
    );
}
