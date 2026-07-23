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
import { Printer, ArrowLeft, Send, CheckCircle2, User, Clock, MessageSquare, AlertTriangle } from 'lucide-react';

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

    // Live reconciliation of daily collection data & customer feedback notes
    const { dailyPaidInvoices, unpaidFeedbackInvoices, sttNumbersMap, summary } = useMemo(() => {
        const txMap = new Map(transactions.map(t => [t.id, t]));
        const sttMapping: Record<string, string> = {};

        let totalAmount = 0;
        let cashAmount = 0;
        let transferAmount = 0;

        const paidList: Invoice[] = [];
        const unpaidFeedbackList: Invoice[] = [];

        invoices.forEach(inv => {
            // STT mapping & Live transaction details
            const linked = (inv.transactionIds || [])
                .map(tid => txMap.get(tid))
                .filter((t): t is Transaction => t !== undefined);

            let liveClientName = inv.clientName;
            let liveClientAddress = inv.clientAddress;
            let liveTotalAmount = inv.totalAmount;
            let liveStatus = inv.status;

            if (linked.length > 0) {
                sttMapping[inv.id] = linked.map(t => t.noSTT.replace(/^STT/i, '')).join(', ');
                const primaryTx = linked[0];
                liveClientName = primaryTx.pengirimName || inv.clientName;
                liveClientAddress = primaryTx.pengirimAddress || inv.clientAddress;

                const subtotal = linked.reduce((sum, t) => sum + (Number(t.jumlah) || 0), 0);
                const isTaxable = linked.some(t => t.isTaxable || (t.ppn && Number(t.ppn) > 0));
                liveTotalAmount = subtotal + (isTaxable ? Math.round(subtotal * 0.011) : 0);

                const allTxPaid = linked.every(t => t.pelunasan === 'TF' || t.pelunasan === 'Cash');
                if (allTxPaid) liveStatus = 'Paid';
            }

            const liveInv: Invoice = {
                ...inv,
                clientName: liveClientName,
                clientAddress: liveClientAddress,
                totalAmount: liveTotalAmount,
                status: liveStatus
            };

            // 1. Paid invoices for target date
            if (liveInv.status === 'Paid') {
                const dateObj = liveInv.paidAt || liveInv.paymentDate || liveInv.updatedAt;
                const dateStr = dateObj.toISOString().split('T')[0];
                if (dateStr === targetDateParam) {
                    if (!officerParam || (liveInv.paidBy && liveInv.paidBy.toLowerCase().includes(officerParam.toLowerCase()))) {
                        paidList.push(liveInv);
                        totalAmount += liveInv.totalAmount;
                        if (liveInv.paymentMethod === 'Transfer') transferAmount += liveInv.totalAmount;
                        else cashAmount += liveInv.totalAmount;
                    }
                }
            }

            // 2. Unpaid invoices with collection feedback logged on or active for target date
            if (liveInv.status !== 'Paid' && liveInv.collectionFeedback) {
                const feedbackDate = liveInv.collectionFeedback.updatedAt ? new Date(liveInv.collectionFeedback.updatedAt).toISOString().split('T')[0] : '';
                // Show if feedback logged today or if promised date matches/active
                if (feedbackDate === targetDateParam || liveInv.collectionFeedback.promisedDate === targetDateParam || !targetDateParam) {
                    if (!officerParam || (liveInv.collectionFeedback.officer && liveInv.collectionFeedback.officer.toLowerCase().includes(officerParam.toLowerCase()))) {
                        unpaidFeedbackList.push(liveInv);
                    }
                }
            }
        });

        // Sort lists
        paidList.sort((a, b) => (a.paidAt?.getTime() || a.updatedAt.getTime()) - (b.paidAt?.getTime() || b.updatedAt.getTime()));

        return {
            dailyPaidInvoices: paidList,
            unpaidFeedbackInvoices: unpaidFeedbackList,
            sttNumbersMap: sttMapping,
            summary: {
                totalAmount,
                cashAmount,
                transferAmount,
                countPaid: paidList.length,
                countFeedback: unpaidFeedbackList.length
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

            {/* Print Controls Topbar */}
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
                                <Send size={18} className="text-emerald-600" /> Cetak Laporan Penagihan Harian & Respon Customer
                            </h2>
                            <p className="text-xs text-gray-500">Tanggal: {formattedTargetDate}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
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
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Total Hasil Ditagih</span>
                        <span className="font-black text-emerald-800 text-[10pt]">{formatRupiah(summary.totalAmount)}</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 p-2 rounded text-center">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Invoice Lunas</span>
                        <span className="font-bold text-gray-900 text-[10pt]">{summary.countPaid} Invoice</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 p-2 rounded text-center">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Transfer vs Cash</span>
                        <span className="font-bold text-blue-800 text-[8.5pt] block">{formatRupiah(summary.transferAmount)} (TF)</span>
                        <span className="font-bold text-amber-800 text-[8.5pt] block">{formatRupiah(summary.cashAmount)} (Cash)</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 p-2 rounded text-center">
                        <span className="text-gray-500 font-semibold block text-[7.5pt] uppercase">Respon Customer Unpaid</span>
                        <span className="font-bold text-indigo-900 text-[10pt]">{summary.countFeedback} Catatan Field</span>
                    </div>
                </div>

                {/* 3. SECTION 1: TABEL PENAGIHAN LUNAS (PAID COLLECTIONS) */}
                <div className="mb-5">
                    <h3 className="font-black text-[9.5pt] uppercase tracking-wide text-gray-900 mb-1.5 flex items-center gap-1.5">
                        <CheckCircle2 size={15} className="text-emerald-700" /> I. DAFTAR INVOICE BERHASIL DITAGIH (LUNAS)
                    </h3>
                    <table className="daily-table">
                        <thead>
                            <tr>
                                <th style={{ width: '4%' }}>NO</th>
                                <th style={{ width: '14%' }}>WAKTU & JAM</th>
                                <th style={{ width: '16%' }}>NO. INVOICE</th>
                                <th style={{ width: '24%' }}>KLIEN / PENGIRIM</th>
                                <th style={{ width: '16%' }}>NOMOR STT (RESI)</th>
                                <th style={{ width: '14%' }}>METODE & BUKTI</th>
                                <th style={{ width: '12%' }}>PETUGAS</th>
                                <th style={{ width: '14%' }}>NOMINAL (RP)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailyPaidInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-4 text-gray-500 italic">
                                        Belum ada pelunasan penagihan yang tercatat pada tanggal ini.
                                    </td>
                                </tr>
                            ) : (
                                dailyPaidInvoices.map((inv, idx) => {
                                    const dateObj = inv.paidAt || inv.paymentDate || inv.updatedAt;
                                    const timeStr = inv.paidTime || dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

                                    return (
                                        <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                            <td className="text-center font-medium text-gray-600">{idx + 1}</td>
                                            <td className="text-center font-mono font-bold text-emerald-800 text-[8pt]">⏱️ {timeStr}</td>
                                            <td className="font-mono font-bold text-center text-gray-900">{inv.invoiceNumber}</td>
                                            <td>
                                                <div className="font-bold text-gray-900 text-[8.5pt] uppercase">{inv.clientName}</div>
                                                {inv.clientAddress && <div className="text-[7.5pt] text-gray-600 truncate max-w-[170px]">{inv.clientAddress}</div>}
                                            </td>
                                            <td className="font-mono text-[8pt] leading-tight max-w-[140px] break-words">{sttNumbersMap[inv.id] || '-'}</td>
                                            <td className="text-center">
                                                <span className="font-bold text-gray-800 text-[8pt] block">{inv.paymentMethod || 'Cash'}</span>
                                                {inv.paymentRef && <span className="text-[7.5pt] text-gray-500 truncate block max-w-[100px] mx-auto font-mono">Ref: {inv.paymentRef}</span>}
                                            </td>
                                            <td className="text-center text-[8pt] font-semibold text-gray-700">{inv.paidBy || 'Officer'}</td>
                                            <td className="text-right font-mono font-black text-emerald-800 text-[9pt]">{formatRupiah(inv.totalAmount)}</td>
                                        </tr>
                                    );
                                })
                            )}
                            <tr className="border-t-2 border-black bg-gray-100 font-black text-[8.5pt]">
                                <td colSpan={7} className="text-right uppercase py-2 pr-4 italic">TOTAL DITAGIH HARI INI :</td>
                                <td className="text-right font-mono text-emerald-800 py-2 pr-2 font-black text-[9.5pt]">{formatRupiah(summary.totalAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 4. SECTION 2: TABEL RESPO / CATATAN CUSTOMER UNPAID (CUSTOMER FEEDBACK LOGS) */}
                <div className="mb-4">
                    <h3 className="font-black text-[9.5pt] uppercase tracking-wide text-gray-900 mb-1.5 flex items-center gap-1.5">
                        <MessageSquare size={15} className="text-indigo-700" /> II. DAFTAR HASIL / FEEDBACK ALASAN PENAGIHAN CUSTOMER (BELUM LUNAS)
                    </h3>
                    <table className="daily-table">
                        <thead>
                            <tr>
                                <th style={{ width: '4%' }}>NO</th>
                                <th style={{ width: '16%' }}>NO. INVOICE</th>
                                <th style={{ width: '22%' }}>KLIEN / CUSTOMER</th>
                                <th style={{ width: '18%' }}>STATUS HASIL PENAGIHAN</th>
                                <th style={{ width: '26%' }}>CATATAN / DETAIL ALASAN CUSTOMER</th>
                                <th style={{ width: '14%' }}>JANJI BAYAR TGL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {unpaidFeedbackInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-4 text-gray-500 italic">
                                        Tidak ada catatan feedback / alasan penagihan customer yang tercatat.
                                    </td>
                                </tr>
                            ) : (
                                unpaidFeedbackInvoices.map((inv, idx) => {
                                    const fb = inv.collectionFeedback!;
                                    const promisedStr = fb.promisedDate ? new Date(fb.promisedDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

                                    return (
                                        <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                            <td className="text-center font-medium text-gray-600">{idx + 1}</td>
                                            <td className="font-mono font-bold text-center text-gray-900">{inv.invoiceNumber}</td>
                                            <td>
                                                <div className="font-bold text-gray-900 uppercase text-[8.5pt]">{inv.clientName}</div>
                                                <div className="text-[7.5pt] font-mono text-gray-600">Tagihan: {formatRupiah(inv.totalAmount)}</div>
                                            </td>
                                            <td className="text-center">
                                                <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[8pt] block uppercase">
                                                    {fb.status}
                                                </span>
                                                <span className="text-[7pt] text-gray-500 block mt-0.5">Oleh: {fb.officer}</span>
                                            </td>
                                            <td className="text-[8pt] text-gray-800 leading-snug">
                                                "{fb.notes || 'Belum ada catatan khusus.'}"
                                            </td>
                                            <td className="text-center font-mono font-bold text-amber-800 text-[8.5pt]">
                                                {promisedStr}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 5. Terbilang Box */}
                <div className="bg-emerald-50/50 border border-emerald-300 p-2.5 rounded mb-6 font-mono text-[8.5pt] italic">
                    <span className="font-bold mr-2 not-italic text-black">Terbilang Total Penagihan Harian:</span>
                    # {terbilang(summary.totalAmount)} #
                </div>

                {/* 6. Signatures Block */}
                <div className="flex justify-between items-end text-[8.5pt] pt-2 border-t border-gray-300">
                    <div className="leading-relaxed text-[8pt] text-gray-600">
                        <p className="font-bold text-gray-900 uppercase">Catatan Verifikasi Penagihan:</p>
                        <p>• Laporan ini mencakup realisasi uang fisik/transfer & catatan feedback kunjungan penagihan customer.</p>
                        <p>• Bukti setoran kasir & bukti transfer bank terlampir bersama dokumen ini.</p>
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
