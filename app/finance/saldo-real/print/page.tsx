'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { COMPANY_INFO } from '@/lib/company-config';
import { formatRupiah } from '@/lib/currency';
import type { RealBankAccount, RealBalanceMutation, RealBalanceSettings } from '@/types/saldo-real';
import { REAL_BANK_ACCOUNTS } from '@/types/saldo-real';
import { subscribeToRealBalanceSettings, subscribeToRealMutations } from '@/lib/firestore-saldo-real';
import { ArrowLeft, Printer, MapPin, Phone, Building2, Landmark, Calendar, FileText, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CheckCircle2 } from 'lucide-react';

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function PrintSaldoRealContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const bankParam = (searchParams.get('bank') as RealBankAccount | 'all') || 'all';
    const modeParam = searchParams.get('mode') || 'month';
    const monthParam = searchParams.get('month') !== null ? Number(searchParams.get('month')) : new Date().getMonth();
    const yearParam = searchParams.get('year') !== null ? Number(searchParams.get('year')) : new Date().getFullYear();
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const startParam = searchParams.get('start') || '2026-08-23';
    const endParam = searchParams.get('end') || new Date().toISOString().split('T')[0];

    const [settings, setSettings] = useState<RealBalanceSettings>({
        modalAwalPerusahaan: 0,
        modalAwalBca: 0,
        modalAwalBri: 0,
        modalAwalMandiri: 0,
        effectiveDate: '2026-08-23',
    });

    const [mutations, setMutations] = useState<RealBalanceMutation[]>([]);
    const [loading, setLoading] = useState(true);
    const [printDateStr, setPrintDateStr] = useState('');
    
    // Display Mode: 'separated' (Prioritas Masuk di Atas, Keluar di Bawah) vs 'unified' (Kronologis Gabungan)
    const [viewLayout, setViewLayout] = useState<'separated' | 'unified'>('separated');

    useEffect(() => {
        const now = new Date();
        setPrintDateStr(now.toLocaleDateString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }));
    }, []);

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        const unsubSettings = subscribeToRealBalanceSettings((data) => {
            setSettings(data);
        });

        const unsubMutations = subscribeToRealMutations((data) => {
            setMutations(data);
            setLoading(false);
        });

        return () => {
            unsubSettings();
            unsubMutations();
        };
    }, [user]);

    // Period Title
    const periodLabel = useMemo(() => {
        if (modeParam === 'all') return 'Semua Periode Transaksi (Mulai 23 Agustus 2026)';
        if (modeParam === 'month') return `Bulan ${MONTH_NAMES[monthParam]} ${yearParam}`;
        if (modeParam === 'date') {
            return `Tanggal ${new Date(dateParam + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        }
        if (modeParam === 'range') {
            return `Rentang ${new Date(startParam + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} s/d ${new Date(endParam + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
        return 'Periode Transaksi';
    }, [modeParam, monthParam, yearParam, dateParam, startParam, endParam]);

    // Filter mutations for printing
    const filteredMutations = useMemo(() => {
        let list = [...mutations];

        if (bankParam !== 'all') {
            list = list.filter(m => m.bank === bankParam || (m.type === 'transfer' && m.targetBank === bankParam));
        }

        list = list.filter(m => {
            if (modeParam === 'all') return true;
            if (modeParam === 'month') {
                const prefix = `${yearParam}-${String(monthParam + 1).padStart(2, '0')}`;
                return m.date.startsWith(prefix);
            }
            if (modeParam === 'date') return m.date === dateParam;
            if (modeParam === 'range') return m.date >= startParam && m.date <= endParam;
            return true;
        });

        // Sort ascending by date & createdAt for orderly chronological accounting
        list.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

        return list;
    }, [mutations, bankParam, modeParam, monthParam, yearParam, dateParam, startParam, endParam]);

    // Split into Income and Expenses
    const incomeMutations = useMemo(() => {
        return filteredMutations.filter(m => m.type === 'in');
    }, [filteredMutations]);

    const expenseMutations = useMemo(() => {
        return filteredMutations.filter(m => m.type === 'out' || m.type === 'transfer');
    }, [filteredMutations]);

    // Financial totals & Subtotals
    const totalIncome = useMemo(() => {
        return incomeMutations.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    }, [incomeMutations]);

    const totalExpense = useMemo(() => {
        return expenseMutations.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    }, [expenseMutations]);

    // Per Bank Breakdown for the period
    const bankSummary = useMemo(() => {
        let perBank: Record<RealBankAccount, { modalAwal: number; totalIn: number; totalOut: number; saldoAkhir: number }> = {
            perusahaan: { modalAwal: settings.modalAwalPerusahaan, totalIn: 0, totalOut: 0, saldoAkhir: settings.modalAwalPerusahaan },
            bca: { modalAwal: settings.modalAwalBca, totalIn: 0, totalOut: 0, saldoAkhir: settings.modalAwalBca },
            bri: { modalAwal: settings.modalAwalBri, totalIn: 0, totalOut: 0, saldoAkhir: settings.modalAwalBri },
            mandiri: { modalAwal: settings.modalAwalMandiri, totalIn: 0, totalOut: 0, saldoAkhir: settings.modalAwalMandiri },
        };

        filteredMutations.forEach(m => {
            const amt = Number(m.amount) || 0;
            if (m.type === 'in') {
                if (perBank[m.bank]) {
                    perBank[m.bank].totalIn += amt;
                    perBank[m.bank].saldoAkhir += amt;
                }
            } else if (m.type === 'out') {
                if (perBank[m.bank]) {
                    perBank[m.bank].totalOut += amt;
                    perBank[m.bank].saldoAkhir -= amt;
                }
            } else if (m.type === 'transfer') {
                if (perBank[m.bank]) {
                    perBank[m.bank].totalOut += amt;
                    perBank[m.bank].saldoAkhir -= amt;
                }
                if (m.targetBank && perBank[m.targetBank]) {
                    perBank[m.targetBank].totalIn += amt;
                    perBank[m.targetBank].saldoAkhir += amt;
                }
            }
        });

        return perBank;
    }, [filteredMutations, settings]);

    const grandTotals = useMemo(() => {
        const totalModalAwal = settings.modalAwalPerusahaan + settings.modalAwalBca + settings.modalAwalBri + settings.modalAwalMandiri;
        return {
            totalModalAwal,
            totalIn: totalIncome,
            totalOut: totalExpense,
            grandSaldo: totalModalAwal + totalIncome - totalExpense,
        };
    }, [settings, totalIncome, totalExpense]);

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
                    .print-shadow-none { box-shadow: none !important; }
                }
                .print-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
                .print-table th, .print-table td { border: 1px solid #94a3b8; padding: 4.5px 6px; text-align: left; }
                .print-table th { font-weight: 800; text-transform: uppercase; font-size: 7.5pt; letter-spacing: 0.025em; }
            `}} />

            {/* ── TOP INTERACTIVE CONTROLS TOOLBAR (HIDDEN ON PRINT) ── */}
            <div className="no-print sticky top-0 z-50 bg-white border-b border-slate-300 px-6 py-3 shadow-md">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/finance/saldo-real')}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-700 transition-colors"
                            title="Kembali ke Saldo Real"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                                <Landmark size={18} className="text-indigo-600" /> Cetak Laporan Saldo Real Bank
                            </h1>
                            <p className="text-xs text-slate-500">
                                Akun: <span className="font-bold text-indigo-700 uppercase">{bankParam === 'all' ? 'Semua Bank' : REAL_BANK_ACCOUNTS[bankParam]?.name}</span> • {periodLabel}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Layout Toggle */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-300 text-xs font-bold">
                            <button
                                onClick={() => setViewLayout('separated')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${viewLayout === 'separated' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                title="Prioritas: Tabel Pemasukan di atas, Tabel Pengeluaran di paling bawah"
                            >
                                📋 Prioritas Masuk & Keluar Terpisah
                            </button>
                            <button
                                onClick={() => setViewLayout('unified')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${viewLayout === 'unified' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                title="Mode Buku Besar Kronologis"
                            >
                                📑 Buku Besar Kronologis
                            </button>
                        </div>

                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/25 transition-all active:scale-95"
                        >
                            <Printer size={16} /> 🖨️ Cetak / Unduh PDF (A4 Landscape)
                        </button>
                    </div>
                </div>
            </div>

            {/* ── PRINTABLE DOCUMENT CANVAS (A4 LANDSCAPE) ── */}
            <div className="max-w-7xl mx-auto my-6 print:my-0 p-6 print:p-0 bg-white rounded-2xl print:rounded-none shadow-md print:shadow-none border border-slate-300 print:border-none">
                
                {/* ── 1. KOP SURAT RESMI PERUSAHAAN ── */}
                <div className="border-b-2 border-slate-900 pb-3 mb-3 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                            {COMPANY_INFO.name}
                        </h2>
                        <p className="text-[10px] font-bold text-indigo-900 tracking-wide uppercase">
                            LAPORAN REKAPITULASI MUTASI KAS &amp; SALDO REAL REKENING BANK
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
                            DOKUMEN RESMI SALDO REAL
                        </span>
                        <div className="text-[8.5px] text-slate-500 mt-1 font-mono">
                            Dicetak: {printDateStr}
                        </div>
                    </div>
                </div>

                {/* ── 2. JUDUL LAPORAN & PERIODE ── */}
                <div className="text-center mb-3">
                    <h3 className="text-base font-black uppercase tracking-wide text-slate-900">
                        REKAPITULASI SALDO REAL REKENING BANK &amp; KAS
                    </h3>
                    <p className="text-xs font-extrabold text-indigo-800 uppercase mt-0.5">
                        PERIODE: {periodLabel}
                    </p>
                </div>

                {/* ── 3. EXECUTIVE 5-CARD FINANCIAL SUMMARY ── */}
                <div className="grid grid-cols-5 gap-2 mb-4 break-inside-avoid">
                    
                    {/* Bank Perusahaan */}
                    <div className="bg-slate-50 border-2 border-slate-300 p-2 rounded-xl text-center">
                        <div className="text-[8px] font-black text-slate-800 uppercase">Bank Perusahaan</div>
                        <div className="text-[7.5px] text-slate-500 font-mono">Kas Utama</div>
                        <div className="text-[11.5px] font-black text-slate-900 mt-1">
                            {formatRupiah(bankSummary.perusahaan.saldoAkhir)}
                        </div>
                        <div className="flex justify-between text-[7px] font-bold text-slate-600 mt-1 pt-1 border-t border-slate-200">
                            <span className="text-emerald-700">+{formatRupiah(bankSummary.perusahaan.totalIn)}</span>
                            <span className="text-rose-700">-{formatRupiah(bankSummary.perusahaan.totalOut)}</span>
                        </div>
                    </div>

                    {/* Bank BCA */}
                    <div className="bg-blue-50 border-2 border-blue-300 p-2 rounded-xl text-center">
                        <div className="text-[8px] font-black text-blue-900 uppercase">Bank BCA</div>
                        <div className="text-[7.5px] text-blue-700 font-mono">1870444342</div>
                        <div className="text-[11.5px] font-black text-blue-950 mt-1">
                            {formatRupiah(bankSummary.bca.saldoAkhir)}
                        </div>
                        <div className="flex justify-between text-[7px] font-bold text-slate-600 mt-1 pt-1 border-t border-blue-200">
                            <span className="text-emerald-700">+{formatRupiah(bankSummary.bca.totalIn)}</span>
                            <span className="text-rose-700">-{formatRupiah(bankSummary.bca.totalOut)}</span>
                        </div>
                    </div>

                    {/* Bank BRI */}
                    <div className="bg-sky-50 border-2 border-sky-300 p-2 rounded-xl text-center">
                        <div className="text-[8px] font-black text-sky-900 uppercase">Bank BRI</div>
                        <div className="text-[7.5px] text-sky-700 font-mono">0328...501</div>
                        <div className="text-[11.5px] font-black text-sky-950 mt-1">
                            {formatRupiah(bankSummary.bri.saldoAkhir)}
                        </div>
                        <div className="flex justify-between text-[7px] font-bold text-slate-600 mt-1 pt-1 border-t border-sky-200">
                            <span className="text-emerald-700">+{formatRupiah(bankSummary.bri.totalIn)}</span>
                            <span className="text-rose-700">-{formatRupiah(bankSummary.bri.totalOut)}</span>
                        </div>
                    </div>

                    {/* Bank Mandiri */}
                    <div className="bg-amber-50 border-2 border-amber-300 p-2 rounded-xl text-center">
                        <div className="text-[8px] font-black text-amber-900 uppercase">Bank Mandiri</div>
                        <div className="text-[7.5px] text-amber-700 font-mono">14000...851</div>
                        <div className="text-[11.5px] font-black text-amber-950 mt-1">
                            {formatRupiah(bankSummary.mandiri.saldoAkhir)}
                        </div>
                        <div className="flex justify-between text-[7px] font-bold text-slate-600 mt-1 pt-1 border-t border-amber-200">
                            <span className="text-emerald-700">+{formatRupiah(bankSummary.mandiri.totalIn)}</span>
                            <span className="text-rose-700">-{formatRupiah(bankSummary.mandiri.totalOut)}</span>
                        </div>
                    </div>

                    {/* TOTAL SALDO REAL GABUNGAN */}
                    <div className="bg-slate-900 text-white p-2 rounded-xl text-center border-2 border-slate-950 flex flex-col justify-between">
                        <div>
                            <div className="text-[8px] font-black text-indigo-300 uppercase tracking-wider">TOTAL SALDO REAL</div>
                            <div className="text-[7px] text-slate-400 font-mono">Gabungan 4 Rekening</div>
                        </div>
                        <div className="text-[12px] font-black text-emerald-400 my-0.5">
                            {formatRupiah(grandTotals.grandSaldo)}
                        </div>
                        <div className="text-[7px] text-slate-300 pt-0.5 border-t border-slate-800">
                            Modal: {formatRupiah(grandTotals.totalModalAwal)}
                        </div>
                    </div>

                </div>

                {/* ── 4. TABEL MUTASI (MODE TERPISAH: PEMASUKAN DI ATAS, PENGELUARAN DI PALING BAWAH) ── */}
                {viewLayout === 'separated' ? (
                    <div className="space-y-4">
                        
                        {/* ── SEKSI A: DAFTAR TRANSAKSI PEMASUKAN (UANG MASUK) ── */}
                        <div className="border border-emerald-300 rounded-xl overflow-hidden shadow-xs">
                            <div className="bg-emerald-700 text-white px-3 py-1.5 font-black text-[9px] uppercase tracking-wider flex justify-between items-center">
                                <span className="flex items-center gap-1.5">
                                    <ArrowDownLeft size={13} className="text-emerald-200" />
                                    BAGIAN A. DAFTAR PEMASUKAN / UANG MASUK (PRIORITAS ATAS)
                                </span>
                                <span className="bg-emerald-800 px-2 py-0.5 rounded text-[8.5px] border border-emerald-600 font-mono font-bold">
                                    {incomeMutations.length} Transaksi | Subtotal: +{formatRupiah(totalIncome)}
                                </span>
                            </div>

                            <table className="print-table">
                                <thead>
                                    <tr className="bg-emerald-100/80 text-emerald-950 text-[8px] border-b border-emerald-300">
                                        <th className="w-7 text-center">No</th>
                                        <th className="w-20 text-center">Tanggal</th>
                                        <th className="w-24">Rekening Tujuan</th>
                                        <th className="w-32">Kategori &amp; Sumber</th>
                                        <th>Keterangan / Berita Acara Pelunasan</th>
                                        <th className="w-28 font-mono">No. Invoice / Ref</th>
                                        <th className="text-right w-32 text-emerald-950 bg-emerald-200/60 font-black">Nominal Masuk (+)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {incomeMutations.map((m, idx) => {
                                        const bankInfo = REAL_BANK_ACCOUNTS[m.bank] || REAL_BANK_ACCOUNTS.bca;
                                        return (
                                            <tr key={m.id || idx} className={idx % 2 === 1 ? 'bg-emerald-50/40 hover:bg-emerald-50' : 'bg-white hover:bg-emerald-50/60'}>
                                                <td className="text-center font-mono text-slate-500 font-semibold">{idx + 1}</td>
                                                <td className="text-center font-bold text-slate-900 whitespace-nowrap">
                                                    {new Date(m.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="font-extrabold text-slate-900">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[7.5px] font-bold ${bankInfo.bgColor} ${bankInfo.textColor} border ${bankInfo.borderColor}`}>
                                                        {bankInfo.shortName}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="font-bold text-slate-900">{m.category}</span>
                                                    {m.source === 'penagihan_ika' ? (
                                                        <span className="text-[7px] bg-emerald-200 text-emerald-900 border border-emerald-400 font-extrabold px-1 py-0.2 rounded inline-block ml-1">
                                                            ⚡ Auto IKA
                                                        </span>
                                                    ) : (
                                                        <span className="text-[7px] bg-slate-200 text-slate-700 font-medium px-1 py-0.2 rounded inline-block ml-1">
                                                            Manual
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-slate-900">
                                                    <div className="font-medium">{m.description}</div>
                                                    {m.clientName && (
                                                        <div className="text-slate-500 text-[7.5px] font-mono">Pelanggan: {m.clientName}</div>
                                                    )}
                                                </td>
                                                <td className="font-mono text-[7.5px] text-slate-700 font-bold">{m.refNumber || '-'}</td>
                                                <td className="text-right font-black text-emerald-700 font-mono text-[8.5px] whitespace-nowrap bg-emerald-50/50">
                                                    +{formatRupiah(m.amount)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {incomeMutations.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-4 text-slate-400 italic">
                                                Tidak ada transaksi pemasukan pada periode {periodLabel}.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-emerald-100 font-black text-emerald-950 border-t-2 border-emerald-600 text-[8.5px]">
                                        <td colSpan={6} className="text-right uppercase tracking-wider p-2">
                                            TOTAL PEMASUKAN (+):
                                        </td>
                                        <td className="text-right p-2 text-emerald-900 font-mono text-[9px] bg-emerald-200">
                                            +{formatRupiah(totalIncome)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* ── SEKSI B: DAFTAR TRANSAKSI PENGELUARAN & TRANSFER (UANG KELUAR) ── */}
                        <div className="border border-rose-300 rounded-xl overflow-hidden shadow-xs break-inside-avoid">
                            <div className="bg-rose-700 text-white px-3 py-1.5 font-black text-[9px] uppercase tracking-wider flex justify-between items-center">
                                <span className="flex items-center gap-1.5">
                                    <ArrowUpRight size={13} className="text-rose-200" />
                                    BAGIAN B. DAFTAR PENGELUARAN &amp; TRANSFER (POSISI BAWAH)
                                </span>
                                <span className="bg-rose-800 px-2 py-0.5 rounded text-[8.5px] border border-rose-600 font-mono font-bold">
                                    {expenseMutations.length} Transaksi | Subtotal: -{formatRupiah(totalExpense)}
                                </span>
                            </div>

                            <table className="print-table">
                                <thead>
                                    <tr className="bg-rose-100/80 text-rose-950 text-[8px] border-b border-rose-300">
                                        <th className="w-7 text-center">No</th>
                                        <th className="w-20 text-center">Tanggal</th>
                                        <th className="w-28">Rekening Asal / Tujuan</th>
                                        <th className="w-32">Kategori Transaksi</th>
                                        <th>Keterangan / Keperluan Pengeluaran</th>
                                        <th className="w-28 font-mono">No. Bukti / Ref</th>
                                        <th className="text-right w-32 text-rose-950 bg-rose-200/60 font-black">Nominal Keluar (-)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenseMutations.map((m, idx) => {
                                        const bankInfo = REAL_BANK_ACCOUNTS[m.bank] || REAL_BANK_ACCOUNTS.bca;
                                        const targetBankInfo = m.targetBank ? REAL_BANK_ACCOUNTS[m.targetBank] : null;

                                        return (
                                            <tr key={m.id || idx} className={idx % 2 === 1 ? 'bg-rose-50/40 hover:bg-rose-50' : 'bg-white hover:bg-rose-50/60'}>
                                                <td className="text-center font-mono text-slate-500 font-semibold">{idx + 1}</td>
                                                <td className="text-center font-bold text-slate-900 whitespace-nowrap">
                                                    {new Date(m.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="font-extrabold text-slate-900">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[7.5px] font-bold ${bankInfo.bgColor} ${bankInfo.textColor} border ${bankInfo.borderColor}`}>
                                                        {bankInfo.shortName}
                                                    </span>
                                                    {m.type === 'transfer' && targetBankInfo && (
                                                        <div className="text-[7.5px] text-purple-700 font-bold mt-0.5">
                                                            ➔ {targetBankInfo.shortName}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="font-bold text-slate-900">{m.category}</span>
                                                    {m.type === 'transfer' && (
                                                        <span className="text-[7px] bg-purple-200 text-purple-900 border border-purple-400 font-extrabold px-1 py-0.2 rounded inline-block ml-1">
                                                            Pindah Buku
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-slate-900">
                                                    <div className="font-medium">{m.description}</div>
                                                </td>
                                                <td className="font-mono text-[7.5px] text-slate-700 font-bold">{m.refNumber || '-'}</td>
                                                <td className="text-right font-black text-rose-700 font-mono text-[8.5px] whitespace-nowrap bg-rose-50/50">
                                                    -{formatRupiah(m.amount)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {expenseMutations.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-4 text-slate-400 italic">
                                                Tidak ada transaksi pengeluaran pada periode {periodLabel}.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-rose-100 font-black text-rose-950 border-t-2 border-rose-600 text-[8.5px]">
                                        <td colSpan={6} className="text-right uppercase tracking-wider p-2">
                                            TOTAL PENGELUARAN (-):
                                        </td>
                                        <td className="text-right p-2 text-rose-900 font-mono text-[9px] bg-rose-200">
                                            -{formatRupiah(totalExpense)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                    </div>
                ) : (
                    /* ── MODE BUKU BESAR KRONOLOGIS (UNIFIED) ── */
                    <div className="border border-slate-400 rounded-xl overflow-hidden shadow-xs">
                        <div className="bg-slate-800 text-white px-3 py-1.5 font-black text-[9px] uppercase tracking-wider flex justify-between items-center">
                            <span>TABEL BUKU BESAR MUTASI KRONOLOGIS ({filteredMutations.length} TRANSAKSI)</span>
                            <span className="text-indigo-200 font-mono font-bold">
                                Masuk: +{formatRupiah(totalIncome)} | Keluar: -{formatRupiah(totalExpense)}
                            </span>
                        </div>

                        <table className="print-table">
                            <thead>
                                <tr className="bg-slate-100 text-slate-900 text-[8px]">
                                    <th className="w-6 text-center">No</th>
                                    <th className="w-20 text-center">Tanggal</th>
                                    <th className="w-24">Rekening</th>
                                    <th className="w-28">Kategori</th>
                                    <th>Keterangan / Transaksi</th>
                                    <th className="w-24 font-mono">No. Ref</th>
                                    <th className="text-right w-24 text-emerald-800">Masuk (+)</th>
                                    <th className="text-right w-24 text-rose-800">Keluar (-)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMutations.map((m, idx) => {
                                    const bankInfo = REAL_BANK_ACCOUNTS[m.bank] || REAL_BANK_ACCOUNTS.bca;
                                    const targetBankInfo = m.targetBank ? REAL_BANK_ACCOUNTS[m.targetBank] : null;

                                    return (
                                        <tr key={m.id || idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                                            <td className="text-center font-mono text-slate-500">{idx + 1}</td>
                                            <td className="text-center font-semibold text-slate-900 whitespace-nowrap">
                                                {new Date(m.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="font-bold text-slate-900">
                                                {bankInfo.shortName}
                                                {m.type === 'transfer' && targetBankInfo && ` ➔ ${targetBankInfo.shortName}`}
                                            </td>
                                            <td className="font-semibold text-slate-900">{m.category}</td>
                                            <td className="text-slate-800">{m.description}</td>
                                            <td className="font-mono text-[7.5px] text-slate-700">{m.refNumber || '-'}</td>
                                            <td className="text-right font-bold text-emerald-700 whitespace-nowrap">
                                                {m.type === 'in' ? `+${formatRupiah(m.amount)}` : '—'}
                                            </td>
                                            <td className="text-right font-bold text-rose-700 whitespace-nowrap">
                                                {m.type === 'out' || m.type === 'transfer' ? `-${formatRupiah(m.amount)}` : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-200 font-bold text-slate-900 border-t-2 border-slate-700 text-[8.5px]">
                                    <td colSpan={6} className="text-right uppercase tracking-wider p-2">TOTAL MUTASI:</td>
                                    <td className="text-right p-2 text-emerald-900">+{formatRupiah(totalIncome)}</td>
                                    <td className="text-right p-2 text-rose-900">-{formatRupiah(totalExpense)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* ── 5. REKAPITULASI IMBANGAN AKHIR SALDO (GRAND RECAPITULATION) ── */}
                <div className="mt-4 border-2 border-slate-800 rounded-xl overflow-hidden break-inside-avoid">
                    <div className="bg-slate-900 text-white px-3 py-1.5 font-black text-[9px] uppercase tracking-wider flex justify-between items-center">
                        <span>REKAPITULASI AKHIR SALDO REAL PERIODE {periodLabel}</span>
                        <span className="text-emerald-400 font-mono font-black">
                            SALDO REAL AKHIR: {formatRupiah(grandTotals.grandSaldo)}
                        </span>
                    </div>

                    <div className="grid grid-cols-4 divide-x divide-slate-300 bg-slate-50 text-center text-[8.5px] p-2.5 font-bold">
                        <div>
                            <div className="text-slate-500 uppercase text-[7.5px]">1. Total Modal Awal</div>
                            <div className="font-mono font-black text-slate-900 text-[11px] mt-0.5">
                                {formatRupiah(grandTotals.totalModalAwal)}
                            </div>
                        </div>
                        <div>
                            <div className="text-emerald-700 uppercase text-[7.5px]">2. Total Pemasukan (+)</div>
                            <div className="font-mono font-black text-emerald-700 text-[11px] mt-0.5">
                                +{formatRupiah(totalIncome)}
                            </div>
                        </div>
                        <div>
                            <div className="text-rose-700 uppercase text-[7.5px]">3. Total Pengeluaran (-)</div>
                            <div className="font-mono font-black text-rose-700 text-[11px] mt-0.5">
                                -{formatRupiah(totalExpense)}
                            </div>
                        </div>
                        <div className="bg-indigo-50/80 -my-2.5 py-2.5 border-l border-indigo-200">
                            <div className="text-indigo-900 uppercase text-[8px] font-black">4. SALDO REAL AKHIR (=)</div>
                            <div className="font-mono font-black text-indigo-950 text-[12px] mt-0.5">
                                {formatRupiah(grandTotals.grandSaldo)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── 6. BOX TANDA TANGAN & PENGESAHAN RESMI (3 KOLOM) ── */}
                <div className="mt-6 pt-3 border-t-2 border-slate-700 break-inside-avoid">
                    <div className="flex justify-between items-start text-center text-[8.5px]">
                        
                        {/* Dibuat Oleh */}
                        <div className="w-1/3 px-4">
                            <p className="text-slate-500">Dicetak pada {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="font-extrabold text-slate-900 uppercase mt-0.5">Dibuat Oleh (Admin Kas / Bank)</p>
                            <div className="h-16 flex items-end justify-center">
                                <div className="border-b-2 border-slate-700 w-40 pb-0.5 font-bold text-slate-900">
                                    ( ......................................... )
                                </div>
                            </div>
                            <p className="text-[7.5px] text-slate-500 mt-1">Staff Finance &amp; Cashier</p>
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
                            <p className="font-extrabold text-slate-900 uppercase mt-0.5">Disetujui Oleh (Direksi / Pimpinan)</p>
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

export default function PrintSaldoRealPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Memuat Laporan Cetak Saldo Real...</div>}>
            <PrintSaldoRealContent />
        </Suspense>
    );
}
