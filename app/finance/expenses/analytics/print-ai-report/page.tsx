'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { COMPANY_INFO } from '@/lib/company-config';
import { formatRupiah } from '@/lib/currency';
import { ExpenseAnalysisPayload, ExpenseAnalysisResult } from '@/app/actions/expense-analysis';
import { Sparkles, Printer, ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, TrendingDown, FileText } from 'lucide-react';

function PrintAiReportContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [payload, setPayload] = useState<ExpenseAnalysisPayload | null>(null);
    const [aiResult, setAiResult] = useState<ExpenseAnalysisResult | null>(null);
    const [printDate, setPrintDate] = useState<string>('');

    useEffect(() => {
        // Load data from searchParam or sessionStorage
        const payloadStr = searchParams.get('payload');
        const aiStr = searchParams.get('ai');

        if (payloadStr) {
            try { setPayload(JSON.parse(decodeURIComponent(payloadStr))); } catch (e) { console.error(e); }
        } else {
            const savedPayload = sessionStorage.getItem('cce_expense_ai_payload');
            if (savedPayload) {
                try { setPayload(JSON.parse(savedPayload)); } catch (e) { console.error(e); }
            }
        }

        if (aiStr) {
            try { setAiResult(JSON.parse(decodeURIComponent(aiStr))); } catch (e) { console.error(e); }
        } else {
            const savedAi = sessionStorage.getItem('cce_expense_ai_result');
            if (savedAi) {
                try { setAiResult(JSON.parse(savedAi)); } catch (e) { console.error(e); }
            }
        }

        const now = new Date();
        setPrintDate(now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));
    }, [searchParams]);

    const handlePrint = () => {
        window.print();
    };

    if (!payload || !aiResult) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 text-gray-700">
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md">
                    <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-bounce" />
                    <h2 className="text-lg font-bold mb-2">Memuat Laporan Analisa AI...</h2>
                    <p className="text-sm text-gray-500 mb-6">Jika data tidak muncul, silakan kembali dan buat ulang laporan dari halaman Analitik.</p>
                    <button
                        onClick={() => router.push('/finance/expenses/analytics')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all"
                    >
                        Kembali ke Analitik Kas Kecil
                    </button>
                </div>
            </div>
        );
    }

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
                .ai-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
                .ai-table th, .ai-table td { border: 1px solid #d1d5db; padding: 5px 8px; }
                .ai-table th { font-weight: bold; text-align: center; background: #f3f4f6; text-transform: uppercase; }
            `}} />

            {/* Print Controls Topbar (Hidden in Print) */}
            <div className="no-print bg-white p-4 shadow-sm mb-6 border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/finance/expenses/analytics')}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                            title="Kembali"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                <Sparkles size={18} className="text-blue-600" /> Cetak Laporan Analisa AI Kas Kecil
                            </h2>
                            <p className="text-xs text-gray-500">Periode: {payload.periodLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/finance/expenses/analytics')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <RefreshCw size={14} /> Atur Ulang Periode
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

            {/* A4 Printable Document Container */}
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
                        <div className="inline-block bg-blue-50 border border-blue-200 text-blue-800 text-[8pt] font-black uppercase px-2.5 py-1 rounded mb-1 tracking-wider">
                            🤖 AI FINANCIAL ANALYSIS REPORT
                        </div>
                        <h2 className="text-base font-black text-gray-900 tracking-tight">ANALISA PENGELUARAN UMUM</h2>
                        <p className="text-[9pt] font-bold text-gray-600">PERIODE: {payload.periodLabel.toUpperCase()}</p>
                    </div>
                </div>

                {/* 2. Executive Financial Summary Cards */}
                <div className="grid grid-cols-4 gap-3 mb-5 text-[8.5pt]">
                    <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Total Pengeluaran</span>
                        <span className="font-black text-red-650 text-[10.5pt] block mt-0.5">{formatRupiah(payload.totalExpenses)}</span>
                        <span className="text-[7.5pt] text-gray-500">{payload.totalCount} transaksi</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Total Top-Up / Pemasukan</span>
                        <span className="font-black text-emerald-650 text-[10.5pt] block mt-0.5">{formatRupiah(payload.totalTopups)}</span>
                        <span className="text-[7.5pt] text-gray-500">Kas masuk</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Arus Kas Netto</span>
                        <span className={`font-black text-[10.5pt] block mt-0.5 ${payload.netCashFlow >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                            {formatRupiah(payload.netCashFlow)}
                        </span>
                        <span className="text-[7.5pt] text-gray-500">Selisih arus kas</span>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-2.5 rounded-lg text-center">
                        <span className="text-blue-800 font-bold block text-[7.5pt] uppercase">Financial Health Score</span>
                        <div className="flex items-center justify-center gap-1 text-blue-900 font-black text-[11pt] mt-0.5">
                            <span>{aiResult.healthScore}</span>
                            <span className="text-[8pt] text-blue-700 font-bold">/ 100</span>
                        </div>
                        <span className="text-[7.5pt] font-extrabold uppercase bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded text-[7pt] inline-block mt-0.5">
                            {aiResult.healthStatus}
                        </span>
                    </div>
                </div>

                {/* 3. Gemini AI Analysis Section */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 className="font-black text-slate-800 text-[10pt] flex items-center gap-1.5 uppercase tracking-wide">
                            <Sparkles size={14} className="text-blue-600" /> Ringkasan Eksekutif & Hasil Analisa AI Gemini
                        </h3>
                        <span className="text-[7.5pt] text-slate-500 italic">Di-generate secara otomatis oleh Gemini AI</span>
                    </div>

                    <div className="text-[8.5pt] text-slate-700 leading-relaxed font-medium bg-white p-3 rounded-lg border border-slate-100 shadow-2xs">
                        <p className="font-semibold text-slate-900 mb-1">📝 Ringkasan Eksekutif:</p>
                        {aiResult.summary}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 text-[8pt]">
                        {/* Left Column: Category Insights */}
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-blue-900 text-[8.5pt] mb-2 flex items-center gap-1">
                                <CheckCircle2 size={12} className="text-blue-600" /> Analisa Distribusi & Kategori
                            </h4>
                            <ul className="space-y-1.5 text-slate-700">
                                {aiResult.categoryInsights.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-blue-600 font-bold">•</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Right Column: Recommendations & Anomalies */}
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-emerald-900 text-[8.5pt] mb-2 flex items-center gap-1">
                                <ShieldCheck size={12} className="text-emerald-600" /> Rekomendasi Efisiensi & Kontrol
                            </h4>
                            <ul className="space-y-1.5 text-slate-700">
                                {aiResult.savingsRecommendations.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-emerald-600 font-bold">✓</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {aiResult.anomaliesOrRisks && aiResult.anomaliesOrRisks.length > 0 && (
                        <div className="bg-amber-50/80 border border-amber-200 p-2.5 rounded-lg text-[8pt]">
                            <h4 className="font-bold text-amber-900 text-[8.5pt] mb-1 flex items-center gap-1">
                                <AlertTriangle size={12} className="text-amber-600" /> Catatan Anomali / Potensi Risiko:
                            </h4>
                            <div className="flex flex-wrap gap-2 text-amber-800">
                                {aiResult.anomaliesOrRisks.map((risk, idx) => (
                                    <span key={idx} className="bg-amber-100 px-2 py-0.5 rounded text-[7.5pt] font-medium border border-amber-200">
                                        ⚠️ {risk}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Rincian Pengeluaran Per Kategori Table */}
                <div className="mb-5">
                    <h3 className="font-bold text-gray-800 text-[9pt] mb-2 uppercase tracking-wider">Tabel Distribusi Pengeluaran per Kategori</h3>
                    <table className="ai-table">
                        <thead>
                            <tr>
                                <th style={{ width: '6%' }}>No</th>
                                <th style={{ width: '35%' }}>Kategori Pengeluaran</th>
                                <th style={{ width: '15%' }}>Jumlah Transaksi</th>
                                <th style={{ width: '22%' }}>Total Nominal (Rp)</th>
                                <th style={{ width: '22%' }}>Persentase (% Total)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payload.categoryBreakdown.map((c, idx) => (
                                <tr key={c.category} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                    <td className="text-center font-medium">{idx + 1}</td>
                                    <td className="font-bold text-gray-800">{c.categoryLabel}</td>
                                    <td className="text-center">{c.count} x</td>
                                    <td className="text-right font-bold font-mono">{formatRupiah(c.amount)}</td>
                                    <td className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden no-print">
                                                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, c.percentage)}%` }} />
                                            </div>
                                            <span className="font-bold text-gray-700 font-mono text-[8pt]">{c.percentage.toFixed(1)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-black border-t-2 border-gray-800 text-[8.5pt]">
                                <td colSpan={2} className="text-right uppercase py-1.5 pr-3">Total Pengeluaran Kas Kecil :</td>
                                <td className="text-center">{payload.totalCount} x</td>
                                <td className="text-right font-mono text-red-650">{formatRupiah(payload.totalExpenses)}</td>
                                <td className="text-right font-mono">100.0%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 5. Top 5 Transaksi Pengeluaran Terbesar */}
                {payload.topExpenses && payload.topExpenses.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-bold text-gray-800 text-[9pt] mb-2 uppercase tracking-wider">Top 5 Transaksi Pengeluaran Terbesar</h3>
                        <table className="ai-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '6%' }}>No</th>
                                    <th style={{ width: '15%' }}>Tanggal</th>
                                    <th style={{ width: '44%' }}>Keterangan / Deskripsi Biaya</th>
                                    <th style={{ width: '18%' }}>Kategori</th>
                                    <th style={{ width: '17%' }}>Nominal (Rp)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payload.topExpenses.map((t, idx) => (
                                    <tr key={idx} className="bg-white">
                                        <td className="text-center font-bold">{idx + 1}</td>
                                        <td className="text-center font-mono">{t.date}</td>
                                        <td className="font-medium text-gray-800">{t.description}</td>
                                        <td className="text-center font-semibold text-gray-600">{t.categoryLabel}</td>
                                        <td className="text-right font-bold font-mono text-red-600">{formatRupiah(t.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 6. Kesimpulan & Tanda Tangan Resmi */}
                <div className="mt-8 pt-4 border-t border-gray-300">
                    <div className="mb-8 text-[8pt] text-gray-700 bg-gray-50 p-2.5 rounded border border-gray-200">
                        <span className="font-bold text-gray-900 block mb-0.5">📌 Kesimpulan & Arahan Manajemen:</span>
                        <p className="italic leading-relaxed">{aiResult.conclusion}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-6 text-[8.5pt] text-center">
                        <div>
                            <p className="text-gray-500 font-semibold mb-12">Dibuat Oleh (Staf Keuangan),</p>
                            <p className="font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block min-w-[120px]">( Staf Kas Kecil )</p>
                            <p className="text-[7.5pt] text-gray-500 mt-1">Tanggal: {printDate}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 font-semibold mb-12">Diperiksa Oleh (Pengurus / Op),</p>
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

export default function PrintAiReportPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-medium">Memuat halaman cetak...</div>}>
            <PrintAiReportContent />
        </Suspense>
    );
}
