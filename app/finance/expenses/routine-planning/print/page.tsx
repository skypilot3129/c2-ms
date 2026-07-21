'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { COMPANY_INFO } from '@/lib/company-config';
import { formatRupiah } from '@/lib/currency';
import { RoutinePlannerPayload, RoutinePlannerResult, ScheduledRoutineItem } from '@/app/actions/routine-expense-planner';
import { Sparkles, Printer, ArrowLeft, RefreshCw, Calendar, CheckCircle2, ShieldCheck, AlertCircle, FileText } from 'lucide-react';

function PrintRoutinePlanContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [payload, setPayload] = useState<RoutinePlannerPayload | null>(null);
    const [result, setResult] = useState<RoutinePlannerResult | null>(null);
    const [printDate, setPrintDate] = useState<string>('');

    useEffect(() => {
        const payloadStr = searchParams.get('payload');
        const resultStr = searchParams.get('result');

        if (payloadStr) {
            try { setPayload(JSON.parse(decodeURIComponent(payloadStr))); } catch (e) { console.error(e); }
        } else {
            const savedPayload = sessionStorage.getItem('cce_routine_plan_payload');
            if (savedPayload) {
                try { setPayload(JSON.parse(savedPayload)); } catch (e) { console.error(e); }
            }
        }

        if (resultStr) {
            try { setResult(JSON.parse(decodeURIComponent(resultStr))); } catch (e) { console.error(e); }
        } else {
            const savedResult = sessionStorage.getItem('cce_routine_plan_result');
            if (savedResult) {
                try { setResult(JSON.parse(savedResult)); } catch (e) { console.error(e); }
            }
        }

        const now = new Date();
        setPrintDate(now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));
    }, [searchParams]);

    const handlePrint = () => {
        window.print();
    };

    if (!payload || !result) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 text-gray-700">
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md">
                    <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-bounce" />
                    <h2 className="text-lg font-bold mb-2">Memuat Jadwal Rencana Rutin...</h2>
                    <p className="text-sm text-gray-500 mb-6">Jika data tidak muncul, silakan kembali dan jalankan analisa dari halaman Perencanaan Pengeluaran Rutin.</p>
                    <button
                        onClick={() => router.push('/finance/expenses/planning')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all"
                    >
                        Kembali ke Perencanaan Kas Kecil
                    </button>
                </div>
            </div>
        );
    }

    const priorityBadge = (priority: string) => {
        switch (priority) {
            case 'TINGGI': return 'bg-red-100 text-red-800 border-red-200';
            case 'SEDANG': return 'bg-amber-100 text-amber-800 border-amber-200';
            default: return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

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
                .routine-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
                .routine-table th, .routine-table td { border: 1px solid #d1d5db; padding: 5px 8px; }
                .routine-table th { font-weight: bold; text-align: center; background: #f3f4f6; text-transform: uppercase; }
            `}} />

            {/* Print Controls Topbar (Hidden in Print) */}
            <div className="no-print bg-white p-4 shadow-sm mb-6 border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/finance/expenses/planning')}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                            title="Kembali"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <Sparkles size={18} className="text-blue-600" /> Cetak Dokumen Rencana & Jadwal Pengeluaran Rutin
                            </h2>
                            <p className="text-xs text-gray-500">Periode Target: {payload.targetPeriodLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/finance/expenses/planning')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <RefreshCw size={14} /> Edit / Atur Ulang Rencana
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm transition-all flex items-center gap-2 active:scale-95"
                        >
                            <Printer size={16} /> Cetak Dokumen PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* A4 Printable Page Container */}
            <div className="a4-page bg-white mx-auto shadow-2xl rounded-sm border border-gray-200 my-4" style={{ width: '210mm', minHeight: '297mm', padding: '12mm 16mm' }}>
                
                {/* 1. Header Perusahaan */}
                <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-4">
                    <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="Logo CCE" className="w-16 h-16 object-contain" />
                        <div>
                            <h1 className="font-black text-lg text-gray-900 tracking-wide">{COMPANY_INFO.name}</h1>
                            <p className="text-[9pt] text-gray-700 leading-tight">{COMPANY_INFO.address}, {COMPANY_INFO.city}</p>
                            <p className="text-[9pt] text-gray-700 leading-tight">Telp: {COMPANY_INFO.phone} | Email: info@cahayacargo.co.id</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="inline-block bg-indigo-50 border border-indigo-200 text-indigo-800 text-[8pt] font-black uppercase px-2.5 py-1 rounded mb-1 tracking-wider">
                            📋 OPERATIONAL ROUTINE EXPENSE PLAN
                        </div>
                        <h2 className="text-base font-black text-gray-900 tracking-tight">RENCANA & JADWAL BIAYA RUTIN</h2>
                        <p className="text-[9pt] font-bold text-gray-600">PERIODE: {payload.targetPeriodLabel.toUpperCase()}</p>
                    </div>
                </div>

                {/* 2. Executive KPI & Target Projection Grid */}
                <div className="grid grid-cols-3 gap-3 mb-5 text-[8.5pt]">
                    <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Proyeksi Total Biaya Rutin</span>
                        <span className="font-black text-blue-900 text-[11pt] block mt-0.5">{formatRupiah(result.totalProjectedRoutineCost)}</span>
                        <span className="text-[7.5pt] text-gray-500">{result.scheduledItems.length} item jadwal rutin</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Total Histori Beban Rutin</span>
                        <span className="font-black text-gray-800 text-[11pt] block mt-0.5">{formatRupiah(payload.totalHistoricalExpenses)}</span>
                        <span className="text-[7.5pt] text-gray-500">Histori pembanding</span>
                    </div>
                    <div className="bg-indigo-50/70 border border-indigo-200 p-2.5 rounded-lg">
                        <span className="text-indigo-900 font-bold block text-[7.5pt] uppercase">Status Kategori Rutin</span>
                        <span className="font-black text-indigo-950 text-[11pt] block mt-0.5">{payload.routineCategories.length} Kategori Utama</span>
                        <span className="text-[7.5pt] text-indigo-700 font-medium">Operasional Terjadwal</span>
                    </div>
                </div>

                {/* 3. Executive AI Summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 text-[8.5pt]">
                    <h3 className="font-black text-slate-900 text-[9pt] mb-1 flex items-center gap-1.5 uppercase tracking-wide">
                        <Sparkles size={14} className="text-blue-600" /> Analisa Strategis Pengeluaran Rutin
                    </h3>
                    <p className="text-slate-700 leading-relaxed font-medium bg-white p-2.5 rounded border border-slate-200 mb-2">
                        {result.executiveSummary}
                    </p>

                    {result.optimizationStrategies && result.optimizationStrategies.length > 0 && (
                        <div className="mt-2 bg-emerald-50/80 border border-emerald-200 p-2 rounded text-[8pt]">
                            <span className="font-bold text-emerald-900 block mb-1">💡 Strategi Efisiensi & Penghematan Biaya Rutin:</span>
                            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-emerald-950">
                                {result.optimizationStrategies.map((strat, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                        <span className="text-emerald-600 font-bold">✓</span>
                                        <span>{strat}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* 4. Main Scheduled Routine Items Table */}
                <div className="mb-5">
                    <h3 className="font-bold text-gray-800 text-[9pt] mb-2 uppercase tracking-wider">Rincian Jadwal & Estimasi Alokasi Biaya Rutin</h3>
                    <table className="routine-table">
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}>No</th>
                                <th style={{ width: '18%' }}>Jadwal / Siklus</th>
                                <th style={{ width: '18%' }}>Kategori Biaya</th>
                                <th style={{ width: '32%' }}>Deskripsi Rencana Pengeluaran</th>
                                <th style={{ width: '10%' }}>Prioritas</th>
                                <th style={{ width: '17%' }}>Estimasi Biaya (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.scheduledItems.map((item, idx) => (
                                <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                    <td className="text-center font-medium">{idx + 1}</td>
                                    <td className="text-center font-bold text-gray-800 text-[8pt]">
                                        {item.targetDate}
                                        <span className="block text-[7pt] text-gray-500 font-normal">{item.cycle}</span>
                                    </td>
                                    <td className="font-bold text-gray-800 text-[8pt]">{item.categoryLabel}</td>
                                    <td>
                                        <p className="font-medium text-gray-900">{item.description}</p>
                                        {item.notes && <p className="text-[7.5pt] text-gray-500 italic mt-0.5">Note: {item.notes}</p>}
                                    </td>
                                    <td className="text-center">
                                        <span className={`px-2 py-0.5 rounded text-[7pt] font-black border uppercase ${priorityBadge(item.priority)}`}>
                                            {item.priority}
                                        </span>
                                    </td>
                                    <td className="text-right font-bold font-mono text-gray-900 text-[9pt]">
                                        {formatRupiah(item.estimatedAmount)}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-black border-t-2 border-gray-900 text-[9pt]">
                                <td colSpan={5} className="text-right uppercase py-2 pr-3">Total Proyeksi Anggaran Biaya Rutin :</td>
                                <td className="text-right font-mono text-blue-900">{formatRupiah(result.totalProjectedRoutineCost)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 5. Cash Flow Liquidity Guidance */}
                {result.cashFlowAdvice && (
                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg mb-6 text-[8pt]">
                        <span className="font-bold text-amber-900 block mb-0.5">⚠️ Panduan Likuiditas Arus Kas (Cash Flow Control):</span>
                        <p className="text-amber-950 font-medium leading-relaxed">{result.cashFlowAdvice}</p>
                    </div>
                )}

                {/* 6. Formal Signatures & Stamps */}
                <div className="mt-8 pt-4 border-t border-gray-300">
                    <div className="grid grid-cols-3 gap-6 text-[8.5pt] text-center">
                        <div>
                            <p className="text-gray-500 font-semibold mb-12">Disusun Oleh (Staf Keuangan),</p>
                            <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[120px]">( Perencana Kas Kecil )</p>
                            <p className="text-[7.5pt] text-gray-500 mt-1">Tanggal: {printDate}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 font-semibold mb-12">Diperiksa Oleh (Manajer Op),</p>
                            <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[120px]">( Manajer Operasional )</p>
                            <p className="text-[7.5pt] text-gray-500 mt-1">CV. Cahaya Cargo Express</p>
                        </div>
                        <div>
                            <p className="text-gray-500 font-semibold mb-12">Disetujui Oleh (Pimpinan),</p>
                            <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[120px]">( Pimpinan / Direktur )</p>
                            <p className="text-[7.5pt] text-gray-500 mt-1">Stempel & Tanda Tangan</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function PrintRoutinePlanPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-medium">Memuat cetakan rencana pengeluaran...</div>}>
            <PrintRoutinePlanContent />
        </Suspense>
    );
}
