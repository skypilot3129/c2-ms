'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatRupiah } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';
import { Printer, ArrowLeft } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

function LabelSlipContent() {
    const sp = useSearchParams();
    const router = useRouter();
    const [records, setRecords] = useState<any[]>([]);

    useEffect(() => {
        const raw = sp.get('data');
        if (raw) {
            try {
                const parsed = JSON.parse(decodeURIComponent(raw));
                if (parsed.list) {
                    setRecords(parsed.list);
                } else {
                    setRecords([parsed]);
                }
            } catch (e) {
                console.error("Error parsing print data", e);
            }
        }
        const t = setTimeout(() => {
            if (raw) window.print();
        }, 800);
        return () => clearTimeout(t);
    }, [sp]);

    const monthName = (p: string) => {
        if (!p) return '';
        const parts = p.split('-');
        const y = parts[0];
        const m = parts[1];
        const n = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${n[+m - 1] || ''} ${y || ''}`;
    };

    if (records.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-2xl shadow-sm max-w-sm w-full text-center">
                    <p className="text-gray-500 font-medium mb-4">Memuat data cetak...</p>
                    <button onClick={() => router.back()} className="text-blue-600 font-semibold hover:underline flex items-center justify-center gap-1 mx-auto">
                        <ArrowLeft size={16} /> Kembali
                    </button>
                </div>
            </div>
        );
    }

    return (
        <ProtectedRoute>
            <style dangerouslySetInnerHTML={{ __html: `
                /* CSS layout for A6 Print mode */
                @media print {
                    @page {
                        size: A6 portrait;
                        margin: 0;
                    }
                    body {
                        background: #fff !important;
                        color: #000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        font-family: system-ui, -apple-system, sans-serif;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    .print-page {
                        display: flex !important;
                        flex-direction: column;
                        justify-content: space-between;
                        box-sizing: border-box;
                        width: 105mm;
                        height: 148mm;
                        padding: 6mm 8mm;
                        page-break-after: always;
                        break-after: page;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        position: relative;
                        overflow: hidden;
                    }
                }
                
                /* Layout for screen preview of labels */
                .label-preview-card {
                    width: 105mm;
                    height: 148mm;
                    background: #ffffff;
                    border: 2px dashed #000000;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                    border-radius: 8px;
                    padding: 6mm 8mm;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    position: relative;
                    overflow: hidden;
                    color: #000000;
                    font-family: system-ui, -apple-system, sans-serif;
                }
            ` }} />

            {/* Screen UI elements */}
            <div className="min-h-screen bg-gray-100 py-8 px-4 no-print flex flex-col items-center">
                <div className="max-w-4xl w-full flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
                    <div>
                        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                            <ArrowLeft size={16} /> Kembali ke Kalkulator Uang Muat
                        </button>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Printer className="text-green-600" />
                            Preview Cetak Slip Uang Muat A6
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Menampilkan {records.length} slip uang muat format sticker A6</p>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 transition-all hover:scale-105 active:scale-95"
                    >
                        <Printer size={18} />
                        Cetak Sekarang (A6)
                    </button>
                </div>

                {/* Grid preview */}
                <div className="flex flex-col gap-8 items-center w-full">
                    {records.map((record, index) => {
                        const { emp, calc, period } = record;
                        return (
                            <div key={index} className="label-preview-card">
                                {/* Header */}
                                <div className="border-b-2 border-black pb-1.5 text-center">
                                    <h3 className="font-black text-sm tracking-wide leading-none">{COMPANY_INFO.name}</h3>
                                    <p className="text-[8px] font-bold mt-0.5 tracking-tight uppercase">Jasa Pengiriman Terpercaya</p>
                                    <p className="text-[8px] font-semibold text-gray-800 leading-none mt-0.5">{COMPANY_INFO.address}, {COMPANY_INFO.city} · Telp: {COMPANY_INFO.phone}</p>
                                </div>

                                {/* Body Content */}
                                <div className="flex-1 flex flex-col justify-between py-3">
                                    {/* Title & Period */}
                                    <div className="text-center">
                                        <h4 className="font-extrabold text-xs tracking-wider leading-none">SLIP UANG MUAT OPERASIONAL</h4>
                                        <p className="text-[9px] font-bold text-gray-700 mt-1 uppercase tracking-tight">Periode: {monthName(period)}</p>
                                    </div>

                                    {/* Employee Info Box */}
                                    <div className="border border-black p-2 my-1.5 rounded-md flex flex-col gap-0.5 text-[10px] bg-white">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-gray-600 text-[8px] uppercase">Nama Penerima</span>
                                            <span className="font-bold text-gray-600 text-[8px] uppercase">Jabatan</span>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-black text-sm text-black leading-none">{emp.fullName}</span>
                                            <span className="font-bold text-black capitalize">Helper</span>
                                        </div>
                                    </div>

                                    {/* Work Details Summary */}
                                    <div className="my-1 border border-black rounded-md p-2 flex flex-col gap-1 text-[10px]">
                                        <div className="flex justify-between font-bold border-b border-black/10 pb-0.5">
                                            <span>Jumlah Operasi Muat</span>
                                            <span>{calc.sessionsCount} Sesi</span>
                                        </div>
                                        <div className="flex justify-between pt-1">
                                            <span>Uang Muat Bagi Rata</span>
                                            <span className="font-semibold">{formatRupiah(calc.totalShare)}</span>
                                        </div>
                                        {calc.totalBonus > 0 && (
                                            <div className="flex justify-between">
                                                <span>Bonus Tukang Susun</span>
                                                <span className="font-semibold text-amber-700">+{formatRupiah(calc.totalBonus)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-black text-black border-t-2 border-black pt-1.5 text-sm bg-black/5 px-1 rounded">
                                            <span>TOTAL DITERIMA</span>
                                            <span>{formatRupiah(calc.total)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer / Signature */}
                                <div className="border-t border-black pt-2 flex justify-between text-center text-[9px] font-bold">
                                    <div className="w-[45%]">
                                        <p className="text-gray-500 mb-6">Dibuat Oleh,</p>
                                        <p className="border-t border-black pt-0.5">Admin ( CCE )</p>
                                    </div>
                                    <div className="w-[45%]">
                                        <p className="text-gray-500 mb-6">Penerima,</p>
                                        <p className="border-t border-black pt-0.5">{emp.fullName}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Print Output (only shown when printing) */}
            <div className="hidden print-only">
                {records.map((record, index) => {
                    const { emp, calc, period } = record;
                    return (
                        <div key={index} className="print-page">
                            {/* Header */}
                            <div style={{ borderBottom: '3px solid black', paddingBottom: '6px', textAlign: 'center' }}>
                                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '12pt', letterSpacing: '1px', textTransform: 'uppercase' }}>{COMPANY_INFO.name}</h3>
                                <p style={{ margin: '1px 0 0 0', fontSize: '7pt', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jasa Pengiriman Terpercaya</p>
                                <p style={{ margin: '2px 0 0 0', fontSize: '7pt', fontWeight: 700 }}>{COMPANY_INFO.address}, {COMPANY_INFO.city} · Telp: {COMPANY_INFO.phone}</p>
                            </div>

                            {/* Title */}
                            <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '2px' }}>
                                <h4 style={{ margin: 0, fontWeight: 900, fontSize: '11pt', letterSpacing: '0.5px' }}>SLIP UANG MUAT OPERASIONAL</h4>
                                <p style={{ margin: '1px 0 0 0', fontSize: '8.5pt', fontWeight: 900, textTransform: 'uppercase' }}>Periode: {monthName(period)}</p>
                            </div>

                            {/* Employee Info Box */}
                            <div style={{ border: '2px solid black', padding: '6px 8px', margin: '10px 0', borderRadius: '6px', fontSize: '9.5pt' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ fontSize: '7.5pt', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', width: '50%' }}>Nama Penerima</td>
                                            <td style={{ fontSize: '7.5pt', fontWeight: 'bold', color: '#333', textTransform: 'uppercase', width: '50%', textAlign: 'right' }}>Jabatan</td>
                                        </tr>
                                        <tr>
                                            <td style={{ fontWeight: 900, fontSize: '11pt' }}>{emp.fullName}</td>
                                            <td style={{ fontWeight: 'bold', fontSize: '10pt', textAlign: 'right', textTransform: 'capitalize' }}>Helper</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Work Details Summary */}
                            <div style={{ border: '2px solid black', padding: '8px 10px', margin: '10px 0', borderRadius: '6px', fontSize: '10pt', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid black', paddingBottom: '3px', fontWeight: 'bold' }}>
                                    <span style={{ flex: 1 }}>Jumlah Operasi Muat</span>
                                    <span>{calc.sessionsCount} Sesi</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
                                    <span>Uang Muat Bagi Rata</span>
                                    <span style={{ fontWeight: 'bold' }}>{formatRupiah(calc.totalShare)}</span>
                                </div>
                                {calc.totalBonus > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Bonus Tukang Susun</span>
                                        <span style={{ fontWeight: 'bold', color: '#000' }}>+{formatRupiah(calc.totalBonus)}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '2px solid black', paddingTop: '4px', fontSize: '12pt', background: '#f5f5f5', paddingLeft: '4px', paddingRight: '4px', borderRadius: '3px' }}>
                                    <span>TOTAL DITERIMA</span>
                                    <span>{formatRupiah(calc.total)}</span>
                                </div>
                            </div>

                            {/* Footer / Signature */}
                            <div style={{ borderTop: '2px solid black', paddingTop: '8px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', textAlign: 'center', fontSize: '8.5pt', fontWeight: 'bold' }}>
                                <div style={{ width: '45%' }}>
                                    <p style={{ margin: '0 0 35px 0', color: '#444' }}>Dibuat Oleh,</p>
                                    <p style={{ margin: 0, borderTop: '1px solid black', paddingTop: '2px' }}>Admin ( CCE )</p>
                                </div>
                                <div style={{ width: '45%' }}>
                                    <p style={{ margin: '0 0 35px 0', color: '#444' }}>Penerima,</p>
                                    <p style={{ margin: 0, borderTop: '1px solid black', paddingTop: '2px' }}>{emp.fullName}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ProtectedRoute>
    );
}

export default function LabelSlipPrintPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <p className="text-gray-400 font-medium">Memuat...</p>
            </div>
        }>
            <LabelSlipContent />
        </Suspense>
    );
}
