'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { COMPANY_INFO } from '@/lib/company-config';
import { formatRupiah } from '@/lib/currency';
import type { RealBankAccount, RealBalanceMutation, RealBalanceSettings } from '@/types/saldo-real';
import { REAL_BANK_ACCOUNTS } from '@/types/saldo-real';
import { subscribeToRealBalanceSettings, subscribeToRealMutations } from '@/lib/firestore-saldo-real';
import { ArrowLeft, Printer, MapPin, Phone, Building2, Landmark, Calendar, FileText } from 'lucide-react';

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

    // Calculate Running Balance in Chronological Ascending order
    const chronologicalMutationsWithBalance = useMemo(() => {
        const sorted = [...mutations].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

        let running: Record<RealBankAccount, number> = {
            perusahaan: settings.modalAwalPerusahaan,
            bca: settings.modalAwalBca,
            bri: settings.modalAwalBri,
            mandiri: settings.modalAwalMandiri,
        };

        return sorted.map(m => {
            const amt = Number(m.amount) || 0;
            if (m.type === 'in') {
                running[m.bank] = (running[m.bank] || 0) + amt;
            } else if (m.type === 'out') {
                running[m.bank] = (running[m.bank] || 0) - amt;
            } else if (m.type === 'transfer') {
                running[m.bank] = (running[m.bank] || 0) - amt;
                if (m.targetBank) {
                    running[m.targetBank] = (running[m.targetBank] || 0) + amt;
                }
            }

            return {
                ...m,
                bankRunningBalance: running[m.bank] || 0,
                totalRunningBalance: running.perusahaan + running.bca + running.bri + running.mandiri,
            };
        });
    }, [mutations, settings]);

    // Filter mutations for printing
    const filteredMutations = useMemo(() => {
        let list = [...chronologicalMutationsWithBalance].reverse();

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

        return list;
    }, [chronologicalMutationsWithBalance, bankParam, modeParam, monthParam, yearParam, dateParam, startParam, endParam]);

    // Financial totals
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
        let totalIn = 0;
        let totalOut = 0;

        filteredMutations.forEach(m => {
            if (m.type === 'in') totalIn += m.amount;
            if (m.type === 'out') totalOut += m.amount;
        });

        return {
            totalModalAwal,
            totalIn,
            totalOut,
            grandSaldo: totalModalAwal + totalIn - totalOut,
        };
    }, [filteredMutations, settings]);

    const handlePrint = () => {
        window.print();
    };

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
                }
                .print-table { width: 100%; border-collapse: collapse; font-size: 8pt; }
                .print-table th, .print-table td { border: 1px solid #6b7280; padding: 4px 6px; text-align: left; }
                .print-table th { background-color: #f3f4f6; font-weight: 700; text-transform: uppercase; font-size: 7.5pt; color: #111827; }
            `}} />

            {/* Top Interactive Toolbar */}
            <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
                <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/finance/saldo-real')}
                            className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"
                            title="Kembali ke Saldo Real"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                <Landmark size={18} className="text-indigo-600" /> Cetak Laporan Saldo Real Bank
                            </h1>
                            <p className="text-xs text-gray-500">
                                Filter: <span className="font-semibold text-indigo-700">{bankParam.toUpperCase()}</span> | {periodLabel}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                    >
                        <Printer size={16} /> Cetak / Unduh PDF (A4 Landscape)
                    </button>
                </div>
            </div>

            {/* Printable Document Canvas */}
            <div className="max-w-6xl mx-auto my-6 print:my-0 p-6 print:p-0 bg-white rounded-2xl print:rounded-none shadow-sm print:shadow-none border border-gray-200 print:border-none">
                
                {/* ── 1. KOP SURAT PERUSAHAAN ── */}
                <div className="border-b-2 border-gray-900 pb-3 mb-4 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-gray-900 uppercase">
                            {COMPANY_INFO.name}
                        </h2>
                        <p className="text-[10px] font-bold text-indigo-900 tracking-wide uppercase">
                            MANAJEMEN KAS & REKENING BANK PERUSAHAAN (SALDO REAL)
                        </p>
                        <div className="flex items-center gap-4 text-[8.5px] text-gray-600 mt-1">
                            <span className="flex items-center gap-1">
                                <MapPin size={11} className="text-gray-500 shrink-0" />
                                {COMPANY_INFO.address}, {COMPANY_INFO.city}
                            </span>
                            <span className="flex items-center gap-1">
                                <Phone size={11} className="text-gray-500 shrink-0" />
                                Telp/WA: {COMPANY_INFO.phone}
                            </span>
                        </div>
                    </div>

                    <div className="text-right">
                        <span className="inline-block bg-indigo-900 text-white font-extrabold px-3 py-1 rounded text-[9px] uppercase tracking-wider">
                            LAPORAN SALDO REAL
                        </span>
                        <div className="text-[8.5px] text-gray-500 mt-1 font-mono">
                            Dicetak: {printDateStr}
                        </div>
                    </div>
                </div>

                {/* ── 2. JUDUL LAPORAN & PERIODE ── */}
                <div className="text-center mb-4">
                    <h3 className="text-base font-extrabold uppercase tracking-wide text-gray-900">
                        LAPORAN REKAPITULASI MUTASI & SALDO REAL BANK
                    </h3>
                    <p className="text-xs font-semibold text-indigo-800 uppercase mt-0.5">
                        PERIODE: {periodLabel}
                    </p>
                </div>

                {/* ── 3. MATRIKS 4 REKENING BANK ── */}
                <div className="grid grid-cols-5 gap-2 mb-4 break-inside-avoid">
                    
                    {/* Bank Perusahaan */}
                    <div className="bg-slate-50 border border-slate-300 p-2.5 rounded text-center">
                        <div className="text-[8px] font-bold text-slate-700 uppercase">Bank Perusahaan</div>
                        <div className="text-[7.5px] text-gray-500 font-mono">Kas Utama</div>
                        <div className="text-[11.5px] font-black text-slate-900 mt-1">
                            {formatRupiah(bankSummary.perusahaan.saldoAkhir)}
                        </div>
                        <div className="text-[7.5px] text-gray-500 mt-0.5">
                            Modal: {formatRupiah(bankSummary.perusahaan.modalAwal)}
                        </div>
                    </div>

                    {/* Bank BCA */}
                    <div className="bg-blue-50 border border-blue-300 p-2.5 rounded text-center">
                        <div className="text-[8px] font-bold text-blue-800 uppercase">Bank BCA</div>
                        <div className="text-[7.5px] text-gray-500 font-mono">1870444342</div>
                        <div className="text-[11.5px] font-black text-blue-950 mt-1">
                            {formatRupiah(bankSummary.bca.saldoAkhir)}
                        </div>
                        <div className="text-[7.5px] text-gray-500 mt-0.5">
                            Modal: {formatRupiah(bankSummary.bca.modalAwal)}
                        </div>
                    </div>

                    {/* Bank BRI */}
                    <div className="bg-sky-50 border border-sky-300 p-2.5 rounded text-center">
                        <div className="text-[8px] font-bold text-sky-800 uppercase">Bank BRI</div>
                        <div className="text-[7.5px] text-gray-500 font-mono">0328...501</div>
                        <div className="text-[11.5px] font-black text-sky-950 mt-1">
                            {formatRupiah(bankSummary.bri.saldoAkhir)}
                        </div>
                        <div className="text-[7.5px] text-gray-500 mt-0.5">
                            Modal: {formatRupiah(bankSummary.bri.modalAwal)}
                        </div>
                    </div>

                    {/* Bank Mandiri */}
                    <div className="bg-amber-50 border border-amber-300 p-2.5 rounded text-center">
                        <div className="text-[8px] font-bold text-amber-800 uppercase">Bank Mandiri</div>
                        <div className="text-[7.5px] text-gray-500 font-mono">14000...851</div>
                        <div className="text-[11.5px] font-black text-amber-950 mt-1">
                            {formatRupiah(bankSummary.mandiri.saldoAkhir)}
                        </div>
                        <div className="text-[7.5px] text-gray-500 mt-0.5">
                            Modal: {formatRupiah(bankSummary.mandiri.modalAwal)}
                        </div>
                    </div>

                    {/* TOTAL GABUNGAN */}
                    <div className="bg-indigo-900 text-white p-2.5 rounded text-center border border-indigo-950">
                        <div className="text-[8px] font-bold text-indigo-200 uppercase tracking-wider">TOTAL SALDO REAL</div>
                        <div className="text-[7.5px] text-indigo-300 font-mono">Semua Rekening</div>
                        <div className="text-[12px] font-black text-white mt-1">
                            {formatRupiah(grandTotals.grandSaldo)}
                        </div>
                        <div className="text-[7.5px] text-indigo-300 mt-0.5">
                            Modal: {formatRupiah(grandTotals.totalModalAwal)}
                        </div>
                    </div>

                </div>

                {/* ── 4. TABEL MUTASI TRANSAKSI ── */}
                <div className="mb-5">
                    <div className="bg-gray-100 px-3 py-1.5 border border-gray-400 font-bold text-[8.5px] uppercase tracking-wider text-gray-900 flex justify-between items-center">
                        <span>TABEL MUTASI TRANSAKSI SALDO REAL ({filteredMutations.length} TRANSAKSI)</span>
                        <span className="text-indigo-900 font-extrabold">Total Masuk: +{formatRupiah(grandTotals.totalIn)} | Total Keluar: -{formatRupiah(grandTotals.totalOut)}</span>
                    </div>

                    <table className="print-table">
                        <thead>
                            <tr className="bg-gray-100 text-gray-900 text-[8px]">
                                <th className="w-6 text-center">No</th>
                                <th className="w-20 text-center">Tanggal</th>
                                <th className="w-24">Rekening Bank</th>
                                <th className="w-28">Kategori / Sumber</th>
                                <th>Keterangan / Berita Acara Transaksi</th>
                                <th className="w-28 font-mono">No. Ref / Invoice</th>
                                <th className="text-right w-24 text-emerald-800">Masuk (+)</th>
                                <th className="text-right w-24 text-red-800">Keluar (-)</th>
                                <th className="text-right w-28 bg-indigo-50/50 text-indigo-950 font-bold">Saldo Bank (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMutations.map((m, idx) => {
                                const bankInfo = REAL_BANK_ACCOUNTS[m.bank] || REAL_BANK_ACCOUNTS.bca;
                                const targetBankInfo = m.targetBank ? REAL_BANK_ACCOUNTS[m.targetBank] : null;

                                return (
                                    <tr key={m.id || idx} className={idx % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'}>
                                        <td className="text-center font-mono text-gray-500">{idx + 1}</td>
                                        <td className="text-center font-semibold text-gray-900 whitespace-nowrap">
                                            {new Date(m.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="font-bold text-gray-900">
                                            {bankInfo.shortName}
                                            {m.type === 'transfer' && targetBankInfo && ` ➔ ${targetBankInfo.shortName}`}
                                        </td>
                                        <td>
                                            <span className="font-semibold text-gray-900">{m.category}</span>
                                            {m.source === 'penagihan_ika' && <span className="text-[7px] text-emerald-800 font-bold block">Auto IKA</span>}
                                        </td>
                                        <td className="text-gray-800">
                                            {m.description}
                                            {m.clientName && <span className="text-gray-500 text-[7.5px] block font-mono">Klien: {m.clientName}</span>}
                                        </td>
                                        <td className="font-mono text-[7.5px] text-gray-700">{m.refNumber || '-'}</td>
                                        <td className="text-right font-semibold text-emerald-700 whitespace-nowrap">
                                            {m.type === 'in' ? `+${formatRupiah(m.amount)}` : '—'}
                                        </td>
                                        <td className="text-right font-semibold text-red-700 whitespace-nowrap">
                                            {m.type === 'out' || m.type === 'transfer' ? `-${formatRupiah(m.amount)}` : '—'}
                                        </td>
                                        <td className="text-right font-bold text-indigo-950 font-mono text-[8.5px] whitespace-nowrap bg-indigo-50/30">
                                            {formatRupiah(m.bankRunningBalance)}
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredMutations.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="text-center py-6 text-gray-400 italic">
                                        {loading ? 'Memuat data mutasi...' : `Tidak ada catatan mutasi saldo real untuk periode ${periodLabel}.`}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {filteredMutations.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-200 font-bold text-gray-900 border-t-2 border-gray-700 text-[8.5px]">
                                    <td colSpan={6} className="text-right uppercase tracking-wider p-2">
                                        TOTAL MUTASI ({periodLabel}):
                                    </td>
                                    <td className="text-right p-2 text-emerald-900">+{formatRupiah(grandTotals.totalIn)}</td>
                                    <td className="text-right p-2 text-red-900">-{formatRupiah(grandTotals.totalOut)}</td>
                                    <td className="text-right p-2 bg-indigo-100 text-indigo-950 text-[9px] font-black">{formatRupiah(grandTotals.grandSaldo)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* ── 5. BOX TANDA TANGAN & PENGESAHAN ── */}
                <div className="mt-6 pt-3 border-t border-gray-400 break-inside-avoid">
                    <div className="flex justify-between items-start text-center text-[8.5px]">
                        
                        {/* Dibuat Oleh */}
                        <div className="w-1/3 px-4">
                            <p className="text-gray-600">Dicetak pada {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p className="font-bold text-gray-900 uppercase mt-0.5">Dibuat Oleh (Admin Kas / Bank)</p>
                            <div className="h-16 flex items-end justify-center">
                                <div className="border-b border-gray-700 w-36 pb-0.5 font-bold text-gray-900">
                                    ( ......................................... )
                                </div>
                            </div>
                            <p className="text-[7.5px] text-gray-500 mt-1">Staff Finance & Cashier</p>
                        </div>

                        {/* Diperiksa Oleh */}
                        <div className="w-1/3 px-4">
                            <p className="text-transparent">Diperiksa</p>
                            <p className="font-bold text-gray-900 uppercase mt-0.5">Diperiksa Oleh (Manager Keuangan)</p>
                            <div className="h-16 flex items-end justify-center">
                                <div className="border-b border-gray-700 w-36 pb-0.5 font-bold text-gray-900">
                                    ( ......................................... )
                                </div>
                            </div>
                            <p className="text-[7.5px] text-gray-500 mt-1">Finance & Accounting Manager</p>
                        </div>

                        {/* Disetujui Oleh */}
                        <div className="w-1/3 px-4">
                            <p className="text-transparent">Disetujui</p>
                            <p className="font-bold text-gray-900 uppercase mt-0.5">Disetujui Oleh (Direksi / Pimpinan)</p>
                            <div className="h-16 flex items-end justify-center">
                                <div className="border-b border-gray-700 w-36 pb-0.5 font-bold text-gray-900">
                                    {COMPANY_INFO.signatureName || '( ......................................... )'}
                                </div>
                            </div>
                            <p className="text-[7.5px] text-gray-500 mt-1">Direktur Utama</p>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}

export default function PrintSaldoRealPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Memuat Laporan Cetak Saldo Real...</div>}>
            <PrintSaldoRealContent />
        </Suspense>
    );
}
