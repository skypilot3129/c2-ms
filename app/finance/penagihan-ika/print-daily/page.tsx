'use client';

import { use, useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { subscribeToInvoices } from '@/lib/firestore-invoices';
import { subscribeToTransactions } from '@/lib/firestore-transactions';
import type { Invoice } from '@/types/invoice';
import type { Transaction } from '@/types/transaction';
import { formatRupiah, terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';
import { Printer, ArrowLeft, Send, CheckCircle2, User, Clock } from 'lucide-react';

function PrintDailyCollectionContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const targetDateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const officerParam = searchParams.get('officer') || '';

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const unsubInvoices = subscribeToInvoices(user.uid, (invData) => {
            const paidInvoices = invData.filter(inv => inv.status === 'Paid');
            setInvoices(paidInvoices);
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

    // Filter paid invoices for the target collection date & officer
    const { dailyPaidInvoices, sttNumbersMap, summary } = useMemo(() => {
        const txMap = new Map(transactions.map(t => [t.id, t]));
        const sttMapping: Record<string, string> = {};

        let totalAmount = 0;
        let cashAmount = 0;
        let transferAmount = 0;

        const filtered = invoices.filter(inv => {
            // Check paid date
            const dateObj = inv.paidAt || inv.paymentDate || inv.updatedAt;
            const dateStr = dateObj.toISOString().split('T')[0];

            if (dateStr !== targetDateParam) return false;

            // Check officer filter if specified
            if (officerParam && inv.paidBy && !inv.paidBy.toLowerCase().includes(officerParam.toLowerCase())) {
                return false;
            }

            // Linked transactions
            const linked = (inv.transactionIds || [])
                .map(tid => txMap.get(tid))
                .filter((t): t is Transaction => t !== undefined);

            if (linked.length > 0) {
                sttMapping[inv.id] = linked.map(t => t.noSTT.replace(/^STT/i, '')).join(', ');
            }

            // Amounts
            totalAmount += inv.totalAmount;
            if (inv.paymentMethod === 'Transfer') {
                transferAmount += inv.totalAmount;
            } else {
                cashAmount += inv.totalAmount;
            }

            return true;
        });

        // Sort by paid time ascending
        filtered.sort((a, b) => {
            const timeA = a.paidAt?.getTime() || a.updatedAt.getTime();
            const timeB = b.paidAt?.getTime() || b.updatedAt.getTime();
            return timeA - timeB;
        });

        return {
            dailyPaidInvoices: filtered,
            sttNumbersMap: sttMapping,
            summary: {
                totalAmount,
                cashAmount,
                transferAmount,
                count: filtered.length
            }
        };
    }, [invoices, transactions, targetDateParam, officerParam]);

    const formattedTargetDate = useMemo(() => {
        const [y, m, d] = targetDateParam.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }, [targetDateParam]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500 font-medium">Memuat cetakan laporan penagihan harian...</div>;
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
                .daily-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
                .daily-table th, .daily-table td { border: 1px solid #000; padding: 5px 6px; }
                .daily-table th { font-weight: bold; text-align: center; background: #f8fafc; text-transform: uppercase; }
            `}} />

            {/* Print Controls Topbar (Hidden in Print) */}
            <div className="no-print bg-white p-4 shadow-sm mb-6 border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/finance/penagihan-ika')}
                            className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                                <Send size={18} className="text-emerald-600" /> Cetak Laporan Penagihan Harian
                            </h2>
                            <p className="text-xs text-gray-500">Tanggal: {formattedTargetDate}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => window.print()}
                        disabled={summary.count === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                        <Printer size={16} /> Cetak Dokumen PDF
                    </button>
                </div>
            </div>

            {/* A4 Printable Page Container */}
            <div className="a4-page bg-white mx-auto shadow-2xl rounded-sm border border-gray-200 my-4" style={{ width: '210mm', minHeight: '297mm', padding: '10mm 14mm' }}>
                
                {/* 1. Header Kop Perusahaan */}
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
                        <h2 className="text-base font-black tracking-wider text-gray-900 uppercase">LAPORAN PENAGIHAN HARIAN IKA</h2>
                        <p className="text-[8.5pt] font-bold text-emerald-800 uppercase mt-0.5">TANGGAL: {formattedTargetDate.toUpperCase()}</p>
                        {officerParam && <p className="text-[8pt] text-gray-600 font-semibold">Petugas: {officerParam}</p>}
                        <p className="text-[8pt] text-gray-500 mt-0.5">Tgl Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>

                {/* 2. Metadata & KPI Summary Banner */}
                <div className="grid grid-cols-4 gap-3 mb-4 text-[8.5pt]">
                    <div className="bg-gray-50 border border-gray-300 p-2 rounded text-center">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Total Ditagih</span>
                        <span className="font-black text-emerald-800 text-[10pt]">{formatRupiah(summary.totalAmount)}</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 p-2 rounded text-center">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Invoice Lunas</span>
                        <span className="font-bold text-gray-900 text-[10pt]">{summary.count} Invoice</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 p-2 rounded text-center">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Non-Tunai (Transfer)</span>
                        <span className="font-bold text-blue-700 text-[10pt]">{formatRupiah(summary.transferAmount)}</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 p-2 rounded text-center">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Tunai (Cash)</span>
                        <span className="font-bold text-amber-700 text-[10pt]">{formatRupiah(summary.cashAmount)}</span>
                    </div>
                </div>

                {/* 3. Daily Collections Table */}
                <table className="daily-table mb-4">
                    <thead>
                        <tr>
                            <th style={{ width: '4%' }}>NO</th>
                            <th style={{ width: '15%' }}>WAKTU & JAM</th>
                            <th style={{ width: '15%' }}>NO. INVOICE</th>
                            <th style={{ width: '24%' }}>KLIEN / PENGIRIM</th>
                            <th style={{ width: '17%' }}>NOMOR STT (RESI)</th>
                            <th style={{ width: '15%' }}>METODE & BUKTI</th>
                            <th style={{ width: '10%' }}>PETUGAS</th>
                            <th style={{ width: '15%' }}>NOMINAL (RP)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailyPaidInvoices.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-6 text-gray-500 italic">
                                    Tidak ada data pelunasan penagihan yang tercatat pada tanggal ini.
                                </td>
                            </tr>
                        ) : (
                            dailyPaidInvoices.map((inv, idx) => {
                                const dateObj = inv.paidAt || inv.paymentDate || inv.updatedAt;
                                const timeStr = inv.paidTime || dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

                                return (
                                    <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                        <td className="text-center font-medium text-gray-600">{idx + 1}</td>
                                        <td className="text-center font-mono font-bold text-emerald-800 text-[8pt]">
                                            ⏱️ {timeStr}
                                        </td>
                                        <td className="font-mono font-bold text-center text-gray-900">{inv.invoiceNumber}</td>
                                        <td>
                                            <div className="font-bold text-gray-900 text-[8.5pt] uppercase">{inv.clientName}</div>
                                            {inv.clientAddress && (
                                                <div className="text-[7.5pt] text-gray-600 truncate max-w-[170px]">{inv.clientAddress}</div>
                                            )}
                                        </td>
                                        <td className="font-mono text-[8pt] leading-tight max-w-[140px] break-words">
                                            {sttNumbersMap[inv.id] || '-'}
                                        </td>
                                        <td className="text-center">
                                            <span className="font-bold text-gray-800 text-[8pt] block">
                                                {inv.paymentMethod || 'Cash'}
                                            </span>
                                            {inv.paymentRef && (
                                                <span className="text-[7.5pt] text-gray-500 truncate block max-w-[100px] mx-auto font-mono">
                                                    Ref: {inv.paymentRef}
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-center text-[8pt] font-semibold text-gray-700">
                                            {inv.paidBy || 'Officer'}
                                        </td>
                                        <td className="text-right font-mono font-black text-emerald-800 text-[9pt]">
                                            {formatRupiah(inv.totalAmount)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}

                        {/* Grand Total Row */}
                        <tr className="border-t-2 border-black bg-gray-100 font-black text-[9pt]">
                            <td colSpan={7} className="text-right uppercase py-2.5 pr-4 italic">
                                TOTAL HASIL PENAGIHAN HARIAN :
                            </td>
                            <td className="text-right font-mono text-emerald-800 py-2.5 pr-2 font-black text-[10pt]">
                                {formatRupiah(summary.totalAmount)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 4. Terbilang Box */}
                <div className="bg-emerald-50/50 border border-emerald-300 p-2.5 rounded mb-6 font-mono text-[8.5pt] italic">
                    <span className="font-bold mr-2 not-italic text-black">Terbilang Total Penagihan Harian:</span>
                    # {terbilang(summary.totalAmount)} #
                </div>

                {/* 5. Signatures Block */}
                <div className="flex justify-between items-end text-[8.5pt] pt-2 border-t border-gray-300">
                    <div className="leading-relaxed text-[8pt] text-gray-600">
                        <p className="font-bold text-gray-900 uppercase">Catatan Petugas Penagihan IKA:</p>
                        <p>• Rekapitulasi ini memuat seluruh transaksi pelunasan penagihan tanggal {formattedTargetDate}.</p>
                        <p>• Bukti setoran / transfer fisik terlampir bersama laporan ini.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-6 text-center text-[8pt] min-w-[340px]">
                        <div>
                            <p className="text-gray-600 font-semibold mb-12">Petugas Penagih,</p>
                            <p className="font-bold border-b border-black pb-0.5 inline-block min-w-[90px]">( Officer Penagihan )</p>
                        </div>
                        <div>
                            <p className="text-gray-600 font-semibold mb-12">Diperiksa Oleh,</p>
                            <p className="font-bold border-b border-black pb-0.5 inline-block min-w-[90px]">( Kasir / Supervisor )</p>
                        </div>
                        <div>
                            <p className="text-gray-600 font-semibold mb-12">Disetujui Oleh,</p>
                            <p className="font-bold border-b border-black pb-0.5 inline-block min-w-[90px]">( Manajer Keuangan )</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function PrintDailyCollectionPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-medium">Memuat cetakan laporan penagihan harian...</div>}>
            <PrintDailyCollectionContent />
        </Suspense>
    );
}
