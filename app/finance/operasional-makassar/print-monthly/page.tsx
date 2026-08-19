'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { COMPANY_INFO } from '@/lib/company-config';
import { formatRupiah } from '@/lib/currency';
import type { MakassarOpsRecord } from '@/types/voyage';
import { subscribeToMakassarOpsList } from '@/lib/firestore-makassar-ops';
import { ArrowLeft, Printer, MapPin, Phone, Building2, Calendar, FileText, CheckCircle2, Ticket, Truck } from 'lucide-react';

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function PrintMonthlyMakassarOpsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const initialMonth = searchParams.get('month') !== null 
        ? Number(searchParams.get('month')) 
        : new Date().getMonth();
    const initialYear = searchParams.get('year') !== null 
        ? Number(searchParams.get('year')) 
        : new Date().getFullYear();

    const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
    const [selectedYear, setSelectedYear] = useState<number>(initialYear);
    const [allRecords, setAllRecords] = useState<MakassarOpsRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [printDateStr, setPrintDateStr] = useState<string>('');
    const [showDetailTables, setShowDetailTables] = useState<boolean>(true);

    useEffect(() => {
        const now = new Date();
        setPrintDateStr(now.toLocaleDateString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }));
    }, []);

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        const unsubscribe = subscribeToMakassarOpsList(user.uid, (records) => {
            setAllRecords(records);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Filter records for selected month & year
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    
    const monthlyRecords = useMemo(() => {
        const filtered = allRecords.filter(r => r.date && r.date.startsWith(monthPrefix));
        // Sort ascending by date for chronological presentation
        filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        return filtered;
    }, [allRecords, monthPrefix]);

    // Financial totals
    const totals = useMemo(() => {
        const totalBongkar = monthlyRecords.reduce((sum, r) => sum + (Number(r.totalBongkar) || 0), 0);
        const totalPemuatan = monthlyRecords.reduce((sum, r) => sum + (Number(r.totalPemuatan) || 0), 0);
        const totalTransit = monthlyRecords.reduce((sum, r) => sum + (Number(r.totalTransit) || 0), 0);
        const totalTiket = monthlyRecords.reduce((sum, r) => {
            const direct = Number(r.totalTiket);
            if (!isNaN(direct) && direct > 0) return sum + direct;
            const itemsSum = r.tiketItems?.reduce((s, i) => s + (Number(i.amount) || 0), 0) || 0;
            return sum + itemsSum;
        }, 0);

        const totalGrossOps = totalBongkar + totalPemuatan + totalTransit + totalTiket;
        const totalDeposit = monthlyRecords.reduce((sum, r) => sum + (Number(r.totalDeposit) || 0), 0);
        const totalNetOps = totalGrossOps - totalDeposit;

        return {
            totalBongkar,
            totalPemuatan,
            totalTransit,
            totalTiket,
            totalGrossOps,
            totalDeposit,
            totalNetOps,
        };
    }, [monthlyRecords]);

    // Flattened items for detail tables
    const allTiketItems = useMemo(() => {
        const list: { date: string; shipName: string; ticketNumber: string; route: string; category: string; amount: number; note: string }[] = [];
        monthlyRecords.forEach(r => {
            if (r.tiketItems && r.tiketItems.length > 0) {
                r.tiketItems.forEach(item => {
                    if (Number(item.amount) > 0) {
                        list.push({
                            date: r.date,
                            shipName: item.shipName || '-',
                            ticketNumber: item.ticketNumber || '-',
                            route: item.route || '-',
                            category: item.category || '-',
                            amount: Number(item.amount) || 0,
                            note: item.note || ''
                        });
                    }
                });
            }
        });
        return list;
    }, [monthlyRecords]);

    const allTransitItems = useMemo(() => {
        const list: { date: string; resiNumber: string; koliDetails: string; customerName: string; destination: string; amount: number }[] = [];
        monthlyRecords.forEach(r => {
            if (r.transitItems && r.transitItems.length > 0) {
                r.transitItems.forEach(item => {
                    if (Number(item.amount) > 0) {
                        list.push({
                            date: r.date,
                            resiNumber: item.resiNumber || '-',
                            koliDetails: item.koliDetails || '-',
                            customerName: item.customerName || '-',
                            destination: item.destination || '-',
                            amount: Number(item.amount) || 0
                        });
                    }
                });
            }
        });
        return list;
    }, [monthlyRecords]);

    const allDepositItems = useMemo(() => {
        const list: { date: string; resiNumber: string; description: string; amount: number }[] = [];
        monthlyRecords.forEach(r => {
            if (r.depositItems && r.depositItems.length > 0) {
                r.depositItems.forEach(item => {
                    if (Number(item.amount) > 0) {
                        list.push({
                            date: r.date,
                            resiNumber: item.resiNumber || '-',
                            description: item.description || 'Deposit Kantor',
                            amount: Number(item.amount) || 0
                        });
                    }
                });
            }
        });
        return list;
    }, [monthlyRecords]);

    const handlePrint = () => {
        window.print();
    };

    const periodTitle = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

    return (
        <div className="bg-gray-100 min-h-screen text-gray-900 font-sans print:bg-white print:p-0">
            {/* Embedded Print CSS */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: A4 landscape; margin: 8mm 10mm 8mm 10mm; }
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 8.5pt; color: black !important; }
                    .no-print { display: none !important; }
                    .page-break-after { page-break-after: always; }
                    .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
                    .print-card { box-shadow: none !important; border: 1px solid #9ca3af !important; border-radius: 0 !important; }
                }
                .print-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
                .print-table th, .print-table td { border: 1px solid #6b7280; padding: 4px 6px; text-align: left; }
                .print-table th { background-color: #f3f4f6; font-weight: 700; text-transform: uppercase; font-size: 7.5pt; color: #111827; }
            `}} />

            {/* Top Interactive Toolbar (Hidden on Print) */}
            <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
                <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/finance/operasional-makassar')}
                            className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"
                            title="Kembali ke Operasional Makassar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                <Truck size={18} className="text-blue-600" /> Cetak Laporan Bulanan Operasional Makassar
                            </h1>
                            <p className="text-xs text-gray-500">
                                Periode: <span className="font-semibold text-blue-700">{periodTitle}</span> ({monthlyRecords.length} Hari Beroperasi)
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Month Selector */}
                        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs">
                            <Calendar size={14} className="text-gray-500" />
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
                            >
                                {MONTH_NAMES.map((name, idx) => (
                                    <option key={idx} value={idx}>{name}</option>
                                ))}
                            </select>

                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer ml-1 border-l border-gray-300 pl-1.5"
                            >
                                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        {/* Toggle Detail Tables */}
                        <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl">
                            <input
                                type="checkbox"
                                checked={showDetailTables}
                                onChange={(e) => setShowDetailTables(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <span>Sertakan Rincian Itemized</span>
                        </label>

                        {/* Print Button */}
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all active:scale-95"
                        >
                            <Printer size={16} /> Cetak / Unduh PDF (A4 Landscape)
                        </button>
                    </div>
                </div>
            </div>

            {/* Printable Report Canvas */}
            <div className="max-w-6xl mx-auto my-6 print:my-0 p-6 print:p-0 bg-white rounded-2xl print:rounded-none shadow-sm print:shadow-none border border-gray-200 print:border-none">
                
                {/* ── 1. KOP SURAT PERUSAHAAN ── */}
                <div className="border-b-2 border-gray-900 pb-3 mb-4 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-gray-900 uppercase">
                            {COMPANY_INFO.name}
                        </h2>
                        <p className="text-[10px] font-bold text-blue-900 tracking-wide uppercase">
                            CABANG MAKASSAR — LOGISTIK, EKSPEDISI & CARGO
                        </p>
                        <div className="flex items-center gap-4 text-[8.5px] text-gray-600 mt-1">
                            <span className="flex items-center gap-1">
                                <MapPin size={11} className="text-gray-500 shrink-0" />
                                {COMPANY_INFO.branchAddress}, {COMPANY_INFO.branchCity}
                            </span>
                            <span className="flex items-center gap-1">
                                <Phone size={11} className="text-gray-500 shrink-0" />
                                Telp/WA: {COMPANY_INFO.branchPhone}
                            </span>
                        </div>
                    </div>

                    <div className="text-right">
                        <span className="inline-block bg-blue-900 text-white font-extrabold px-3 py-1 rounded text-[9px] uppercase tracking-wider">
                            LAPORAN BULANAN
                        </span>
                        <div className="text-[8.5px] text-gray-500 mt-1 font-mono">
                            Dicetak: {printDateStr}
                        </div>
                    </div>
                </div>

                {/* ── 2. JUDUL LAPORAN & PERIODE ── */}
                <div className="text-center mb-4">
                    <h3 className="text-base font-extrabold uppercase tracking-wide text-gray-900">
                        LAPORAN REKAPITULASI OPERASIONAL CABANG MAKASSAR
                    </h3>
                    <p className="text-xs font-semibold text-blue-800 uppercase mt-0.5">
                        PERIODE: {periodTitle}
                    </p>
                </div>

                {/* ── 3. EXECUTIVE FINANCIAL SUMMARY BANNER ── */}
                <div className="grid grid-cols-7 gap-2 mb-4 break-inside-avoid">
                    <div className="bg-gray-50 border border-gray-300 p-2 rounded text-center">
                        <div className="text-[8px] font-bold text-gray-500 uppercase">Total Bongkar</div>
                        <div className="text-[11px] font-extrabold text-gray-900 mt-0.5">{formatRupiah(totals.totalBongkar)}</div>
                    </div>

                    <div className="bg-gray-50 border border-gray-300 p-2 rounded text-center">
                        <div className="text-[8px] font-bold text-gray-500 uppercase">Total Pemuatan</div>
                        <div className="text-[11px] font-extrabold text-gray-900 mt-0.5">{formatRupiah(totals.totalPemuatan)}</div>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 p-2 rounded text-center">
                        <div className="text-[8px] font-bold text-purple-700 uppercase">Total Transit</div>
                        <div className="text-[11px] font-extrabold text-purple-900 mt-0.5">{formatRupiah(totals.totalTransit)}</div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 p-2 rounded text-center">
                        <div className="text-[8px] font-bold text-blue-700 uppercase">Total Tiket Kapal</div>
                        <div className="text-[11px] font-extrabold text-blue-900 mt-0.5">{formatRupiah(totals.totalTiket)}</div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-2 rounded text-center">
                        <div className="text-[8px] font-bold text-amber-700 uppercase">Total Gross Ops</div>
                        <div className="text-[11px] font-extrabold text-amber-900 mt-0.5">{formatRupiah(totals.totalGrossOps)}</div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center">
                        <div className="text-[8px] font-bold text-emerald-700 uppercase">Deposit Kantor (-)</div>
                        <div className="text-[11px] font-extrabold text-emerald-900 mt-0.5">-{formatRupiah(totals.totalDeposit)}</div>
                    </div>

                    <div className="bg-blue-900 text-white p-2 rounded text-center border border-blue-950">
                        <div className="text-[8px] font-bold text-blue-200 uppercase tracking-wider">Total Net Ops</div>
                        <div className="text-[12px] font-black text-white mt-0.5">{formatRupiah(totals.totalNetOps)}</div>
                    </div>
                </div>

                {/* ── 4. TABEL REKAPITULASI HARIAN OPERASIONAL ── */}
                <div className="mb-5">
                    <div className="bg-gray-100 px-3 py-1.5 border border-gray-400 font-bold text-[8.5px] uppercase tracking-wider text-gray-900 flex justify-between items-center">
                        <span>A. TABEL REKAPITULASI OPERASIONAL HARIAN ({monthlyRecords.length} LEMBAR TERCATAT)</span>
                        <span className="text-blue-900 font-extrabold">Net Akumulasi: {formatRupiah(totals.totalNetOps)}</span>
                    </div>

                    <table className="print-table">
                        <thead>
                            <tr className="bg-gray-100 text-gray-900 text-[8px]">
                                <th className="w-6 text-center">No</th>
                                <th className="w-20 text-center">Tanggal</th>
                                <th className="w-40">Armada / Tim Bongkar</th>
                                <th className="w-40">Armada / Tim Pemuatan</th>
                                <th className="text-right w-24">Bongkar (Rp)</th>
                                <th className="text-right w-24">Pemuatan (Rp)</th>
                                <th className="text-right w-22">Transit (Rp)</th>
                                <th className="text-right w-22">Tiket Kapal (Rp)</th>
                                <th className="text-right w-24">Gross Ops (Rp)</th>
                                <th className="text-right w-22">Deposit (-)</th>
                                <th className="text-right w-26 bg-blue-50/50">Net Ops (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyRecords.map((r, idx) => {
                                const b = Number(r.totalBongkar) || 0;
                                const p = Number(r.totalPemuatan) || 0;
                                const t = Number(r.totalTransit) || 0;
                                const tk = Number(r.totalTiket) || (r.tiketItems?.reduce((s, i) => s + (Number(i.amount) || 0), 0) || 0);
                                const gross = r.totalGrossOps || (b + p + t + tk);
                                const dep = Number(r.totalDeposit) || 0;
                                const net = r.totalNetOps || (gross - dep);

                                return (
                                    <tr key={r.id || idx} className={idx % 2 === 1 ? 'bg-gray-50/70' : 'bg-white'}>
                                        <td className="text-center font-mono text-gray-500">{idx + 1}</td>
                                        <td className="text-center font-semibold text-gray-900 whitespace-nowrap">
                                            {new Date(r.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="text-gray-800 truncate max-w-[140px]" title={r.bongkarMobilTim}>
                                            {r.bongkarMobilTim || '-'}
                                        </td>
                                        <td className="text-gray-800 truncate max-w-[140px]" title={r.pemuatanMobilTim}>
                                            {r.pemuatanMobilTim || '-'}
                                        </td>
                                        <td className="text-right font-medium">{formatRupiah(b)}</td>
                                        <td className="text-right font-medium">{formatRupiah(p)}</td>
                                        <td className="text-right font-medium text-purple-900">{formatRupiah(t)}</td>
                                        <td className="text-right font-medium text-blue-900">{formatRupiah(tk)}</td>
                                        <td className="text-right font-semibold text-amber-900">{formatRupiah(gross)}</td>
                                        <td className="text-right font-medium text-emerald-900">-{formatRupiah(dep)}</td>
                                        <td className="text-right font-bold text-blue-950 bg-blue-50/40">{formatRupiah(net)}</td>
                                    </tr>
                                );
                            })}

                            {monthlyRecords.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="text-center py-6 text-gray-400 italic">
                                        Tidak ada catatan operasional Makassar yang tersimpan untuk periode {periodTitle}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {monthlyRecords.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-200 font-bold text-gray-900 border-t-2 border-gray-700 text-[8.5px]">
                                    <td colSpan={4} className="text-right uppercase tracking-wider p-2">
                                        TOTAL OPERASIONAL BULANAN ({periodTitle}):
                                    </td>
                                    <td className="text-right p-2">{formatRupiah(totals.totalBongkar)}</td>
                                    <td className="text-right p-2">{formatRupiah(totals.totalPemuatan)}</td>
                                    <td className="text-right p-2 text-purple-950">{formatRupiah(totals.totalTransit)}</td>
                                    <td className="text-right p-2 text-blue-950">{formatRupiah(totals.totalTiket)}</td>
                                    <td className="text-right p-2 text-amber-950">{formatRupiah(totals.totalGrossOps)}</td>
                                    <td className="text-right p-2 text-emerald-950">-{formatRupiah(totals.totalDeposit)}</td>
                                    <td className="text-right p-2 bg-blue-100 text-blue-950 text-[9px] font-black">{formatRupiah(totals.totalNetOps)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* ── 5. DETAIL TABLES (ITEMIZED) ── */}
                {showDetailTables && (
                    <div className="space-y-4">
                        
                        {/* Detail Tiket Kapal */}
                        {allTiketItems.length > 0 && (
                            <div className="break-inside-avoid">
                                <div className="bg-blue-100 px-3 py-1 border border-blue-400 font-bold text-[8px] uppercase tracking-wider text-blue-950 flex justify-between items-center">
                                    <span className="flex items-center gap-1.5">
                                        <Ticket size={12} className="text-blue-700" /> B. RINCIAN TIKET KAPAL BULANAN ({allTiketItems.length} TIKET)
                                    </span>
                                    <span>Total Tiket: {formatRupiah(totals.totalTiket)}</span>
                                </div>
                                <table className="print-table">
                                    <thead>
                                        <tr className="bg-blue-50 text-blue-950 text-[7.5px]">
                                            <th className="w-6 text-center">No</th>
                                            <th className="w-20 text-center">Tanggal</th>
                                            <th className="w-32">Nama Kapal</th>
                                            <th className="w-28">No. Tiket / BL</th>
                                            <th className="w-28">Rute Perjalanan</th>
                                            <th className="w-28">Kategori</th>
                                            <th>Catatan</th>
                                            <th className="text-right w-24">Nominal (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allTiketItems.map((item, idx) => (
                                            <tr key={idx} className={idx % 2 === 1 ? 'bg-blue-50/30' : 'bg-white'}>
                                                <td className="text-center font-mono text-gray-500">{idx + 1}</td>
                                                <td className="text-center font-medium whitespace-nowrap">
                                                    {new Date(item.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </td>
                                                <td className="font-semibold text-gray-900">{item.shipName}</td>
                                                <td className="font-mono text-[7.5px] text-gray-700">{item.ticketNumber}</td>
                                                <td>{item.route}</td>
                                                <td>{item.category}</td>
                                                <td className="text-gray-600">{item.note || '-'}</td>
                                                <td className="text-right font-bold text-blue-900">{formatRupiah(item.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-blue-100 font-bold text-blue-950 border-t border-blue-400">
                                            <td colSpan={7} className="text-right uppercase text-[7.5px]">Subtotal Tiket Kapal:</td>
                                            <td className="text-right font-black">{formatRupiah(totals.totalTiket)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* Detail Barang Transit */}
                        {allTransitItems.length > 0 && (
                            <div className="break-inside-avoid">
                                <div className="bg-purple-100 px-3 py-1 border border-purple-400 font-bold text-[8px] uppercase tracking-wider text-purple-950 flex justify-between items-center">
                                    <span>C. RINCIAN BIAYA PENGIRIMAN TRANSIT ({allTransitItems.length} RESI)</span>
                                    <span>Total Transit: {formatRupiah(totals.totalTransit)}</span>
                                </div>
                                <table className="print-table">
                                    <thead>
                                        <tr className="bg-purple-50 text-purple-950 text-[7.5px]">
                                            <th className="w-6 text-center">No</th>
                                            <th className="w-20 text-center">Tanggal</th>
                                            <th className="w-28 font-mono">No. Resi</th>
                                            <th className="w-40">Koli / Detail Barang</th>
                                            <th className="w-32">Pengirim / Customer</th>
                                            <th className="w-28">Tujuan</th>
                                            <th className="text-right w-24">Biaya (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allTransitItems.map((item, idx) => (
                                            <tr key={idx} className={idx % 2 === 1 ? 'bg-purple-50/30' : 'bg-white'}>
                                                <td className="text-center font-mono text-gray-500">{idx + 1}</td>
                                                <td className="text-center font-medium whitespace-nowrap">
                                                    {new Date(item.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </td>
                                                <td className="font-mono text-[7.5px] font-bold text-purple-900">{item.resiNumber}</td>
                                                <td>{item.koliDetails}</td>
                                                <td>{item.customerName}</td>
                                                <td>{item.destination}</td>
                                                <td className="text-right font-bold text-purple-900">{formatRupiah(item.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-purple-100 font-bold text-purple-950 border-t border-purple-400">
                                            <td colSpan={6} className="text-right uppercase text-[7.5px]">Subtotal Barang Transit:</td>
                                            <td className="text-right font-black">{formatRupiah(totals.totalTransit)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* Detail Deposit Kantor */}
                        {allDepositItems.length > 0 && (
                            <div className="break-inside-avoid">
                                <div className="bg-emerald-100 px-3 py-1 border border-emerald-400 font-bold text-[8px] uppercase tracking-wider text-emerald-950 flex justify-between items-center">
                                    <span>D. RINCIAN DEPOSIT KANTOR MASUK / PENGURANG BIAYA ({allDepositItems.length} TRANSAKSI)</span>
                                    <span>Total Deposit: -{formatRupiah(totals.totalDeposit)}</span>
                                </div>
                                <table className="print-table">
                                    <thead>
                                        <tr className="bg-emerald-50 text-emerald-950 text-[7.5px]">
                                            <th className="w-6 text-center">No</th>
                                            <th className="w-20 text-center">Tanggal</th>
                                            <th className="w-32 font-mono">No. Resi</th>
                                            <th>Keterangan Deposit</th>
                                            <th className="text-right w-24">Nominal (-) (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allDepositItems.map((item, idx) => (
                                            <tr key={idx} className={idx % 2 === 1 ? 'bg-emerald-50/30' : 'bg-white'}>
                                                <td className="text-center font-mono text-gray-500">{idx + 1}</td>
                                                <td className="text-center font-medium whitespace-nowrap">
                                                    {new Date(item.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </td>
                                                <td className="font-mono text-[7.5px] font-bold text-emerald-900">{item.resiNumber}</td>
                                                <td>{item.description}</td>
                                                <td className="text-right font-bold text-emerald-900">-{formatRupiah(item.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-emerald-100 font-bold text-emerald-950 border-t border-emerald-400">
                                            <td colSpan={4} className="text-right uppercase text-[7.5px]">Subtotal Deposit Kantor:</td>
                                            <td className="text-right font-black">-{formatRupiah(totals.totalDeposit)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                    </div>
                )}

                {/* ── 6. BOX TANDA TANGAN & PENGESAHAN ── */}
                <div className="mt-6 pt-3 border-t border-gray-400 break-inside-avoid">
                    <div className="flex justify-between items-start text-center text-[8.5px]">
                        
                        {/* Dibuat Oleh */}
                        <div className="w-1/3 px-4">
                            <p className="text-gray-600">Makassar, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="font-bold text-gray-900 uppercase mt-0.5">Dibuat Oleh (Admin Kas Cabang)</p>
                            <div className="h-16 flex items-end justify-center">
                                <div className="border-b border-gray-700 w-36 pb-0.5 font-bold text-gray-900">
                                    ( ......................................... )
                                </div>
                            </div>
                            <p className="text-[7.5px] text-gray-500 mt-1">Admin Operasional Makassar</p>
                        </div>

                        {/* Diperiksa Oleh */}
                        <div className="w-1/3 px-4">
                            <p className="text-transparent">Diperiksa</p>
                            <p className="font-bold text-gray-900 uppercase mt-0.5">Diperiksa Oleh (Koordinator)</p>
                            <div className="h-16 flex items-end justify-center">
                                <div className="border-b border-gray-700 w-36 pb-0.5 font-bold text-gray-900">
                                    ( ......................................... )
                                </div>
                            </div>
                            <p className="text-[7.5px] text-gray-500 mt-1">Kepala Cabang Makassar</p>
                        </div>

                        {/* Disetujui Oleh */}
                        <div className="w-1/3 px-4">
                            <p className="text-transparent">Disetujui</p>
                            <p className="font-bold text-gray-900 uppercase mt-0.5">Disetujui Oleh (Finance / Owner)</p>
                            <div className="h-16 flex items-end justify-center">
                                <div className="border-b border-gray-700 w-36 pb-0.5 font-bold text-gray-900">
                                    {COMPANY_INFO.signatureName || '( ......................................... )'}
                                </div>
                            </div>
                            <p className="text-[7.5px] text-gray-500 mt-1">Direksi / Finance Pusat</p>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}

export default function PrintMonthlyMakassarOpsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Memuat Laporan Bulanan Operasional Makassar...</div>}>
            <PrintMonthlyMakassarOpsContent />
        </Suspense>
    );
}
