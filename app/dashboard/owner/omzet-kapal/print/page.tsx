'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { COMPANY_INFO } from '@/lib/company-config';
import { formatRupiah } from '@/lib/currency';
import { subscribeToVoyages } from '@/lib/firestore-voyages';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import { subscribeToOwnerShipExpenses } from '@/lib/firestore-owner-ship-expenses';
import type { Voyage } from '@/types/voyage';
import type { Transaction } from '@/types/transaction';
import type { OwnerShipExpense, OwnerShipSummaryRow } from '@/types/owner-ship-report';
import { ArrowLeft, Printer, MapPin, Phone, Ship, Crown, Calendar, DollarSign, Wallet } from 'lucide-react';

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function PrintOwnerOmzetKapalContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const modeParam = searchParams.get('mode') || 'month';
    const monthParam = searchParams.get('month') !== null ? Number(searchParams.get('month')) : new Date().getMonth();
    const yearParam = searchParams.get('year') !== null ? Number(searchParams.get('year')) : new Date().getFullYear();
    const shipParam = searchParams.get('ship') || '';

    const [voyages, setVoyages] = useState<Voyage[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [manualExpenses, setManualExpenses] = useState<OwnerShipExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [printDateStr, setPrintDateStr] = useState('');

    useEffect(() => {
        const now = new Date();
        setPrintDateStr(now.toLocaleDateString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }));
    }, []);

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        const unsubVoyages = subscribeToVoyages(user.uid, (data) => {
            setVoyages(data);
        });

        const unsubTransactions = subscribeToTransactions((data) => {
            setTransactions(data);
        }, user.uid);

        const unsubExpenses = subscribeToOwnerShipExpenses((data) => {
            setManualExpenses(data);
            setLoading(false);
        });

        return () => {
            unsubVoyages();
            unsubTransactions();
            unsubExpenses();
        };
    }, [user]);

    const txMap = useMemo(() => {
        const map = new Map<string, Transaction>();
        transactions.forEach(t => map.set(t.id, t));
        return map;
    }, [transactions]);

    const expensesMap = useMemo(() => {
        const map = new Map<string, OwnerShipExpense>();
        manualExpenses.forEach(e => map.set(e.voyageId, e));
        return map;
    }, [manualExpenses]);

    const periodLabel = useMemo(() => {
        if (modeParam === 'all') return 'Semua Riwayat Keberangkatan Kapal';
        return `Bulan ${MONTH_NAMES[monthParam]} ${yearParam}`;
    }, [modeParam, monthParam, yearParam]);

    const consolidatedRows = useMemo<OwnerShipSummaryRow[]>(() => {
        let list = voyages.map(v => {
            const linkedTxList = (v.transactionIds || [])
                .map(id => txMap.get(id))
                .filter((t): t is Transaction => t !== undefined && t.status !== 'dibatalkan');

            let totalRevenue = 0;
            linkedTxList.forEach(t => {
                const subtotal = Number(t.jumlah) || 0;
                const ppn = t.isTaxable || (t.ppn && Number(t.ppn) > 0) ? Math.round(subtotal * 0.011) : 0;
                totalRevenue += (subtotal + ppn);
            });

            const manualCost = expensesMap.get(v.id);
            const tiket = manualCost?.tiket || 0;
            const opsMakassar = manualCost?.opsMakassar || 0;
            const opsSurabaya = manualCost?.opsSurabaya || 0;
            const gajiSopir = manualCost?.gajiSopir || 0;
            const sewaMobil = manualCost?.sewaMobil || 0;
            const opsTambahan = manualCost?.opsTambahan || 0;
            const notes = manualCost?.notes || '';
            const hasManualExpense = manualCost !== undefined;

            const totalExpenses = tiket + opsMakassar + opsSurabaya + gajiSopir + sewaMobil + opsTambahan;
            const netProfit = totalRevenue - totalExpenses;
            const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

            const depDateObj = v.departureDate instanceof Date ? v.departureDate : new Date(v.departureDate);
            const depDateStr = !isNaN(depDateObj.getTime()) ? depDateObj.toISOString().split('T')[0] : '';

            return {
                voyageId: v.id,
                voyageNumber: v.voyageNumber,
                shipName: v.shipName || 'Kapal Belum Dipilih',
                departureDate: depDateObj,
                departureDateStr: depDateStr,
                route: v.route || 'Rute Belum Diatur',
                vehicleNumbers: v.vehicleNumbers || (v.vehicleNumber ? [v.vehicleNumber] : []),
                status: v.status,
                sttCount: linkedTxList.length,
                totalRevenue,
                tiket,
                opsMakassar,
                opsSurabaya,
                gajiSopir,
                sewaMobil,
                opsTambahan,
                totalExpenses,
                netProfit,
                profitMargin,
                notes,
                hasManualExpense,
            };
        });

        // Filter period
        if (modeParam === 'month') {
            const prefix = `${yearParam}-${String(monthParam + 1).padStart(2, '0')}`;
            list = list.filter(r => r.departureDateStr.startsWith(prefix));
        }

        // Filter ship name
        if (shipParam) {
            list = list.filter(r => r.shipName.toLowerCase() === shipParam.toLowerCase());
        }

        // Sort ascending by departureDate for orderly accounting print
        list.sort((a, b) => a.departureDate.getTime() - b.departureDate.getTime());

        return list;
    }, [voyages, txMap, expensesMap, modeParam, monthParam, yearParam, shipParam]);

    const totals = useMemo(() => {
        let totalRevenue = 0;
        let totalTiket = 0;
        let totalOpsMakassar = 0;
        let totalOpsSurabaya = 0;
        let totalGajiSopir = 0;
        let totalSewaMobil = 0;
        let totalOpsTambahan = 0;
        let totalExpenses = 0;

        consolidatedRows.forEach(r => {
            totalRevenue += r.totalRevenue;
            totalTiket += r.tiket;
            totalOpsMakassar += r.opsMakassar;
            totalOpsSurabaya += r.opsSurabaya;
            totalGajiSopir += r.gajiSopir;
            totalSewaMobil += r.sewaMobil;
            totalOpsTambahan += r.opsTambahan;
            totalExpenses += r.totalExpenses;
        });

        const netProfit = totalRevenue - totalExpenses;
        const avgMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

        return {
            totalRevenue,
            totalTiket,
            totalOpsMakassar,
            totalOpsSurabaya,
            totalGajiSopir,
            totalSewaMobil,
            totalOpsTambahan,
            totalExpenses,
            netProfit,
            avgMargin,
        };
    }, [consolidatedRows]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="bg-slate-100 min-h-screen text-slate-900 font-sans print:bg-white print:p-0">
            {/* Embedded Print CSS */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: A4 landscape; margin: 8mm 8mm 8mm 8mm; }
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 8pt; color: #0f172a !important; }
                    .no-print { display: none !important; }
                    .page-break-before { page-break-before: always; }
                    .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
                }
                .print-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
                .print-table th, .print-table td { border: 1px solid #94a3b8; padding: 4.5px 5px; text-align: left; }
                .print-table th { font-weight: 800; text-transform: uppercase; font-size: 7.5pt; letter-spacing: 0.02em; }
            `}} />

            {/* Top Toolbar */}
            <div className="no-print sticky top-0 z-50 bg-white border-b border-slate-300 px-6 py-3 shadow-md">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/dashboard/owner/omzet-kapal')}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                                <Ship size={18} className="text-blue-600" /> Cetak Laporan Omzet &amp; Laba Per-Kapal (Owner)
                            </h1>
                            <p className="text-xs text-slate-500">
                                Periode: <span className="font-bold text-indigo-700">{periodLabel}</span> {shipParam && `• Kapal: ${shipParam}`}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/25 transition-all active:scale-95"
                    >
                        <Printer size={16} /> 🖨️ Cetak / Unduh PDF (A4 Landscape)
                    </button>
                </div>
            </div>

            {/* Document Canvas */}
            <div className="max-w-7xl mx-auto my-6 print:my-0 p-6 print:p-0 bg-white rounded-2xl print:rounded-none shadow-md print:shadow-none border border-slate-300 print:border-none">
                
                {/* ── 1. KOP SURAT RESMI ── */}
                <div className="border-b-2 border-slate-900 pb-3 mb-3 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                            {COMPANY_INFO.name}
                        </h2>
                        <p className="text-[10px] font-bold text-blue-900 tracking-wide uppercase">
                            LAPORAN EKSEKUTIF OMZET &amp; KEUNTUNGAN OPERASIONAL KAPAL (OWNER)
                        </p>
                        <div className="flex items-center gap-4 text-[8.5px] text-slate-600 mt-1">
                            <span className="flex items-center gap-1">
                                <MapPin size={11} className="text-slate-500 shrink-0" />
                                {COMPANY_INFO.address}, {COMPANY_INFO.city}
                            </span>
                            <span className="flex items-center gap-1">
                                <Phone size={11} className="text-slate-500 shrink-0" />
                                Telp/WA: {COMPANY_INFO.phone}
                            </span>
                        </div>
                    </div>

                    <div className="text-right">
                        <span className="inline-block bg-slate-900 text-white font-black px-3 py-1 rounded text-[9px] uppercase tracking-wider">
                            DOKUMEN EKSEKUTIF OWNER
                        </span>
                        <div className="text-[8.5px] text-slate-500 mt-1 font-mono">
                            Dicetak: {printDateStr}
                        </div>
                    </div>
                </div>

                {/* ── 2. JUDUL LAPORAN & PERIODE ── */}
                <div className="text-center mb-3">
                    <h3 className="text-base font-black uppercase tracking-wide text-slate-900">
                        REKAPITULASI OMZET MUATAN &amp; BIAYA OPERASIONAL PER-KAPAL
                    </h3>
                    <p className="text-xs font-extrabold text-blue-900 uppercase mt-0.5">
                        PERIODE: {periodLabel} {shipParam && `• ${shipParam.toUpperCase()}`}
                    </p>
                </div>

                {/* ── 3. EXECUTIVE 4-CARD SUMMARY ── */}
                <div className="grid grid-cols-4 gap-2 mb-3 break-inside-avoid">
                    
                    {/* Total Omzet */}
                    <div className="bg-blue-50 border-2 border-blue-300 p-2 rounded-xl text-center">
                        <div className="text-[8px] font-black text-blue-900 uppercase">1. TOTAL OMZET KAPAL</div>
                        <div className="text-[7.5px] text-blue-700 font-mono">Muatan STT ({consolidatedRows.length} Kapal)</div>
                        <div className="text-[12px] font-black text-blue-950 mt-1 font-mono">
                            {formatRupiah(totals.totalRevenue)}
                        </div>
                    </div>

                    {/* Total Biaya */}
                    <div className="bg-rose-50 border-2 border-rose-300 p-2 rounded-xl text-center">
                        <div className="text-[8px] font-black text-rose-900 uppercase">2. TOTAL BIAYA PENGELUARAN</div>
                        <div className="text-[7.5px] text-rose-700 font-mono">Tiket + Ops MKS/SBY + Gaji + Sewa + Tambahan</div>
                        <div className="text-[12px] font-black text-rose-950 mt-1 font-mono">
                            -{formatRupiah(totals.totalExpenses)}
                        </div>
                    </div>

                    {/* Laba Bersih */}
                    <div className="bg-emerald-50 border-2 border-emerald-400 p-2 rounded-xl text-center">
                        <div className="text-[8px] font-black text-emerald-900 uppercase">3. TOTAL LABA BERSIH OWNER</div>
                        <div className="text-[7.5px] text-emerald-700 font-mono">Omzet - Total Pengeluaran</div>
                        <div className={`text-[12px] font-black mt-1 font-mono ${totals.netProfit >= 0 ? 'text-emerald-950' : 'text-red-700'}`}>
                            {formatRupiah(totals.netProfit)}
                        </div>
                    </div>

                    {/* Margin */}
                    <div className="bg-amber-50 border-2 border-amber-300 p-2 rounded-xl text-center">
                        <div className="text-[8px] font-black text-amber-900 uppercase">4. RATA-RATA MARGIN LABA</div>
                        <div className="text-[7.5px] text-amber-700 font-mono">Persentase Keuntungan Bersih</div>
                        <div className="text-[12px] font-black text-amber-950 mt-1 font-mono">
                            {totals.avgMargin}%
                        </div>
                    </div>

                </div>

                {/* ── 4. TABEL UTAMA: OMZET & RINCIAN 6 BIAYA PER-KAPAL ── */}
                <div className="border border-slate-400 rounded-xl overflow-hidden shadow-xs mb-4">
                    <div className="bg-slate-900 text-white px-3 py-1.5 font-black text-[9px] uppercase tracking-wider flex justify-between items-center">
                        <span className="flex items-center gap-1">
                            <Ship size={13} className="text-blue-300" />
                            TABEL RINCIAN PENDAPATAN &amp; PENGELUARAN PER-KAPAL ({consolidatedRows.length} KEBERANGKATAN)
                        </span>
                        <span className="font-mono text-emerald-300">
                            Net Profit: {formatRupiah(totals.netProfit)} ({totals.avgMargin}%)
                        </span>
                    </div>

                    <table className="print-table">
                        <thead>
                            <tr className="bg-slate-100 text-slate-900 text-[8px]">
                                <th className="w-6 text-center">No</th>
                                <th className="w-18 text-center">Tgl Berangkat</th>
                                <th className="w-32">Nama Kapal &amp; No. Voyage</th>
                                <th className="w-28">Rute &amp; Armada</th>
                                <th className="text-right w-24 bg-blue-100/70 text-blue-950 font-black">Omzet Kapal (+)</th>
                                <th className="text-right w-16">Tiket</th>
                                <th className="text-right w-16">Ops Mks</th>
                                <th className="text-right w-16">Ops Sby</th>
                                <th className="text-right w-16">Gaji Sopir</th>
                                <th className="text-right w-16">Sewa Mobil</th>
                                <th className="text-right w-16">Ops Tambahan</th>
                                <th className="text-right w-22 bg-rose-100/70 text-rose-950 font-black">Total Biaya (-)</th>
                                <th className="text-right w-24 bg-emerald-100/70 text-emerald-950 font-black">Laba Bersih (=)</th>
                                <th className="text-center w-12">Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {consolidatedRows.map((r, idx) => (
                                <tr key={r.voyageId} className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                                    <td className="text-center font-mono text-slate-500">{idx + 1}</td>
                                    <td className="text-center font-bold text-slate-900 whitespace-nowrap">
                                        {r.departureDate && !isNaN(r.departureDate.getTime())
                                            ? r.departureDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                                            : '-'}
                                    </td>
                                    <td>
                                        <div className="font-extrabold text-slate-900">{r.shipName}</div>
                                        <div className="text-[7px] text-slate-500 font-mono">No: {r.voyageNumber}</div>
                                    </td>
                                    <td>
                                        <div className="font-semibold text-slate-900">{r.route}</div>
                                        {r.vehicleNumbers.length > 0 && (
                                            <div className="text-[7px] text-slate-500 font-mono">{r.vehicleNumbers.join(', ')}</div>
                                        )}
                                    </td>

                                    {/* Omzet */}
                                    <td className="text-right font-black text-blue-900 font-mono whitespace-nowrap bg-blue-50/40">
                                        {formatRupiah(r.totalRevenue)}
                                    </td>

                                    {/* 6 Biaya Manual */}
                                    <td className="text-right font-mono text-slate-800 whitespace-nowrap">
                                        {r.tiket > 0 ? formatRupiah(r.tiket) : '—'}
                                    </td>
                                    <td className="text-right font-mono text-slate-800 whitespace-nowrap">
                                        {r.opsMakassar > 0 ? formatRupiah(r.opsMakassar) : '—'}
                                    </td>
                                    <td className="text-right font-mono text-slate-800 whitespace-nowrap">
                                        {r.opsSurabaya > 0 ? formatRupiah(r.opsSurabaya) : '—'}
                                    </td>
                                    <td className="text-right font-mono text-slate-800 whitespace-nowrap">
                                        {r.gajiSopir > 0 ? formatRupiah(r.gajiSopir) : '—'}
                                    </td>
                                    <td className="text-right font-mono text-slate-800 whitespace-nowrap">
                                        {r.sewaMobil > 0 ? formatRupiah(r.sewaMobil) : '—'}
                                    </td>
                                    <td className="text-right font-mono text-slate-800 whitespace-nowrap">
                                        {r.opsTambahan > 0 ? formatRupiah(r.opsTambahan) : '—'}
                                    </td>

                                    {/* Total Biaya */}
                                    <td className="text-right font-black text-rose-800 font-mono whitespace-nowrap bg-rose-50/40">
                                        {formatRupiah(r.totalExpenses)}
                                    </td>

                                    {/* Laba Bersih */}
                                    <td className={`text-right font-black font-mono whitespace-nowrap bg-emerald-50/40 ${r.netProfit >= 0 ? 'text-emerald-950' : 'text-red-700'}`}>
                                        {formatRupiah(r.netProfit)}
                                    </td>

                                    {/* Margin */}
                                    <td className="text-center font-black text-slate-900">
                                        {r.profitMargin}%
                                    </td>
                                </tr>
                            ))}

                            {consolidatedRows.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="text-center py-6 text-slate-400 italic">
                                        {loading ? 'Memuat data kapal...' : `Tidak ada data kapal pada periode ${periodLabel}.`}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {consolidatedRows.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-200 font-black text-slate-900 border-t-2 border-slate-700 text-[8pt]">
                                    <td colSpan={4} className="text-right uppercase tracking-wider p-2">
                                        TOTAL KESELURUHAN:
                                    </td>
                                    <td className="text-right p-2 text-blue-950 font-mono bg-blue-200/80">
                                        {formatRupiah(totals.totalRevenue)}
                                    </td>
                                    <td className="text-right p-2 font-mono">{formatRupiah(totals.totalTiket)}</td>
                                    <td className="text-right p-2 font-mono">{formatRupiah(totals.totalOpsMakassar)}</td>
                                    <td className="text-right p-2 font-mono">{formatRupiah(totals.totalOpsSurabaya)}</td>
                                    <td className="text-right p-2 font-mono">{formatRupiah(totals.totalGajiSopir)}</td>
                                    <td className="text-right p-2 font-mono">{formatRupiah(totals.totalSewaMobil)}</td>
                                    <td className="text-right p-2 font-mono">{formatRupiah(totals.totalOpsTambahan)}</td>
                                    <td className="text-right p-2 text-rose-950 font-mono bg-rose-200/80">
                                        {formatRupiah(totals.totalExpenses)}
                                    </td>
                                    <td className="text-right p-2 text-emerald-950 font-mono bg-emerald-200/80">
                                        {formatRupiah(totals.netProfit)}
                                    </td>
                                    <td className="text-center p-2 font-black">{totals.avgMargin}%</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* ── 5. BOX TANDA TANGAN & PENGESAHAN ── */}
                <div className="mt-6 pt-3 border-t-2 border-slate-700 break-inside-avoid">
                    <div className="flex justify-between items-start text-center text-[8.5px]">
                        
                        {/* Dibuat Oleh */}
                        <div className="w-1/3 px-4">
                            <p className="text-slate-500">Dicetak pada {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="font-extrabold text-slate-900 uppercase mt-0.5">Dibuat Oleh (Admin Operasional)</p>
                            <div className="h-16 flex items-end justify-center">
                                <div className="border-b-2 border-slate-700 w-40 pb-0.5 font-bold text-slate-900">
                                    ( ......................................... )
                                </div>
                            </div>
                            <p className="text-[7.5px] text-slate-500 mt-1">Staff Operasional Kapal</p>
                        </div>

                        {/* Diperiksa Oleh */}
                        <div className="w-1/3 px-4">
                            <p className="text-transparent">Diperiksa</p>
                            <p className="font-extrabold text-slate-900 uppercase mt-0.5">Diperiksa Oleh (Manager Keuangan)</p>
                            <div className="h-16 flex items-end justify-center">
                                <div className="border-b-2 border-slate-700 w-40 pb-0.5 font-bold text-slate-900">
                                    ( ......................................... )
                                </div>
                            </div>
                            <p className="text-[7.5px] text-slate-500 mt-1">Finance &amp; Accounting Manager</p>
                        </div>

                        {/* Disetujui Oleh */}
                        <div className="w-1/3 px-4">
                            <p className="text-transparent">Disetujui</p>
                            <p className="font-extrabold text-slate-900 uppercase mt-0.5">Disetujui Oleh (Direksi / Owner)</p>
                            <div className="h-16 flex items-end justify-center">
                                <div className="border-b-2 border-slate-700 w-40 pb-0.5 font-bold text-slate-900">
                                    {COMPANY_INFO.signatureName || '( ......................................... )'}
                                </div>
                            </div>
                            <p className="text-[7.5px] text-slate-500 mt-1">Direktur Utama</p>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}

export default function PrintOwnerOmzetKapalPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Memuat Laporan Cetak Omzet Kapal...</div>}>
            <PrintOwnerOmzetKapalContent />
        </Suspense>
    );
}
