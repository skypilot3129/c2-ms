'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { COMPANY_INFO } from '@/lib/company-config';
import { formatRupiah } from '@/lib/currency';
import type { MakassarOpsRecord } from '@/types/voyage';
import { getMakassarOpsByDate } from '@/lib/firestore-makassar-ops';
import { ArrowLeft, Printer, MapPin, Phone, Building2 } from 'lucide-react';

function PrintMakassarOpsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const [loading, setLoading] = useState(true);
    const [record, setRecord] = useState<MakassarOpsRecord | null>(null);
    const [printDateStr, setPrintDateStr] = useState<string>('');

    useEffect(() => {
        const now = new Date();
        setPrintDateStr(now.toLocaleDateString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }));
    }, []);

    useEffect(() => {
        if (!user) return;
        let isMounted = true;
        setLoading(true);

        const loadData = async () => {
            try {
                // Try session storage first for instant preview
                const cached = sessionStorage.getItem(`cce_makassar_ops_${targetDate}`);
                if (cached) {
                    setRecord(JSON.parse(cached));
                } else {
                    const fetched = await getMakassarOpsByDate(targetDate, user.uid);
                    if (isMounted) setRecord(fetched);
                }
            } catch (err) {
                console.error('Failed to load print record:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();
        return () => { isMounted = false; };
    }, [user, targetDate]);

    const handlePrint = () => {
        window.print();
    };

    const formattedOpDate = new Date(targetDate + 'T00:00:00').toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const totalBongkar = record?.totalBongkar || 0;
    const totalPemuatan = record?.totalPemuatan || 0;
    const totalTransit = record?.totalTransit || 0;
    const totalTiket = record?.totalTiket || record?.tiketItems?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
    const totalGross = record?.totalGrossOps || (totalBongkar + totalPemuatan + totalTransit + totalTiket);
    const totalDeposit = record?.totalDeposit || 0;
    const totalNet = record?.totalNetOps || (totalGross - totalDeposit);

    return (
        <div className="bg-gray-100 min-h-screen text-gray-900 font-sans print:bg-white print:p-0">
            {/* Embedded Print CSS */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 9.5pt; }
                    .no-print { display: none !important; }
                    .print-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; border-radius: 0 !important; }
                }
                .print-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
                .print-table th, .print-table td { border: 1px solid #9ca3af; padding: 5px 7px; text-align: left; }
                .print-table th { background-color: #f3f4f6; font-weight: 700; text-transform: uppercase; font-size: 8pt; color: #1f2937; }
            `}} />

            {/* Top Toolbar (Hidden on Print) */}
            <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/finance/operasional-makassar')}
                            className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"
                            title="Kembali ke Operasional Makassar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="font-bold text-gray-900 text-sm">
                                Preview Cetak PDF Operasional Cabang Makassar
                            </h1>
                            <p className="text-xs text-gray-500">{formattedOpDate}</p>
                        </div>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Printer size={16} /> Cetak / Save PDF
                    </button>
                </div>
            </div>

            {/* Document Body Container */}
            <div className="max-w-4xl mx-auto my-6 p-8 bg-white rounded-2xl shadow-md border border-gray-200 print-card print:m-0 print:border-none print:p-0">
                
                {/* ── Document Header (Kop Surat Resmi Makassar) ── */}
                <div className="border-b-2 border-gray-800 pb-4 mb-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
                                CAHAYA CARGO EXPRESS (MAKASSAR)
                            </h1>
                            <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                <MapPin size={12} className="inline shrink-0" /> {COMPANY_INFO.branchAddress || COMPANY_INFO.address}, {COMPANY_INFO.branchCity || 'Makassar'}
                            </p>
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                                <Phone size={12} className="inline shrink-0" /> Telepon: {COMPANY_INFO.branchPhone || COMPANY_INFO.phone}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="inline-block bg-blue-100 text-blue-900 text-[10px] font-black uppercase px-3 py-1 rounded-full mb-1">
                                LAPORAN HARIAN LAPANGAN
                            </div>
                            <p className="text-[10px] text-gray-400">Dicetak: {printDateStr}</p>
                        </div>
                    </div>
                </div>

                {/* Document Title Banner */}
                <div className="text-center bg-gray-50 py-2.5 rounded-xl border border-gray-200 mb-5">
                    <h2 className="text-base font-extrabold text-gray-900 tracking-wide uppercase">
                        LEMBAR OPERASIONAL BONGKAR, PEMUATAN & TRANSIT MAKASSAR
                    </h2>
                    <p className="text-xs text-blue-700 font-bold mt-0.5">
                        TANGGAL: {formattedOpDate.toUpperCase()}
                    </p>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-gray-500">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-xs font-semibold">Memuat Lembar Operasional...</p>
                    </div>
                ) : !record ? (
                    <div className="py-12 text-center text-gray-400 border border-dashed border-gray-300 rounded-xl">
                        <p className="text-sm font-semibold">Belum ada data operasional Makassar tersimpan untuk tanggal ini.</p>
                    </div>
                ) : (
                    <div className="space-y-5">

                        {/* ── SECTION 1 & 2: BONGKAR & PEMUATAN SIDE-BY-SIDE ── */}
                        <div className="grid grid-cols-2 gap-4">
                            
                            {/* Operasional Bongkar */}
                            <div className="border border-gray-300 rounded-xl p-3 bg-gray-50/50">
                                <div className="border-b border-gray-300 pb-1.5 mb-2 flex justify-between items-center">
                                    <h3 className="font-extrabold text-xs text-gray-900 uppercase">
                                        * OPERASIONAL BONGKAR MAKASSAR *
                                    </h3>
                                </div>
                                {record.bongkarMobilTim && (
                                    <p className="text-[10px] font-bold text-gray-700 mb-2">
                                        MOBIL: <span className="uppercase text-blue-900">{record.bongkarMobilTim}</span>
                                    </p>
                                )}
                                <table className="print-table">
                                    <thead>
                                        <tr>
                                            <th>Rincian Biaya</th>
                                            <th className="w-28 text-right">Jumlah (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {record.bongkarItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="font-medium text-gray-800">{item.name}</td>
                                                <td className="text-right font-mono font-bold text-gray-900">
                                                    {item.amount > 0 ? formatRupiah(item.amount) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-100 font-bold">
                                            <td className="text-right uppercase text-[9pt]">Total Bongkar:</td>
                                            <td className="text-right font-mono text-blue-900 text-[9pt]">
                                                {formatRupiah(totalBongkar)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Operasional Pemuatan */}
                            <div className="border border-gray-300 rounded-xl p-3 bg-gray-50/50">
                                <div className="border-b border-gray-300 pb-1.5 mb-2 flex justify-between items-center">
                                    <h3 className="font-extrabold text-xs text-gray-900 uppercase">
                                        * OPERASIONAL PEMUATAN MAKASSAR *
                                    </h3>
                                </div>
                                {record.pemuatanMobilTim && (
                                    <p className="text-[10px] font-bold text-gray-700 mb-2">
                                        MOBIL: <span className="uppercase text-indigo-900">{record.pemuatanMobilTim}</span>
                                    </p>
                                )}
                                <table className="print-table">
                                    <thead>
                                        <tr>
                                            <th>Rincian Biaya</th>
                                            <th className="w-28 text-right">Jumlah (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {record.pemuatanItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="font-medium text-gray-800">
                                                    {item.name} {item.note ? `(${item.note})` : ''}
                                                </td>
                                                <td className="text-right font-mono font-bold text-gray-900">
                                                    {item.amount > 0 ? formatRupiah(item.amount) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-100 font-bold">
                                            <td className="text-right uppercase text-[9pt]">Total Pemuatan:</td>
                                            <td className="text-right font-mono text-indigo-900 text-[9pt]">
                                                {formatRupiah(totalPemuatan)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                        </div>

                        {/* ── SECTION 3: BARANG TRANSIT EKSPEDISI LANJUTAN ── */}
                        <div className="border border-gray-300 rounded-xl p-3.5 bg-gray-50/30">
                            <h3 className="font-extrabold text-xs text-gray-900 uppercase mb-2">
                                * BARANG TRANSIT EKSPEDISI LANJUTAN *
                            </h3>
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th className="w-8 text-center">#</th>
                                        <th className="w-28">No. Resi</th>
                                        <th className="w-36">Koli / Berat / Vol</th>
                                        <th>Pengirim / Customer</th>
                                        <th className="w-36">Kota Tujuan</th>
                                        <th className="w-32 text-right">Biaya Transit (Rp)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {record.transitItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="text-center font-medium text-gray-500">{idx + 1}</td>
                                            <td className="font-mono font-bold text-gray-900">{item.resiNumber || '-'}</td>
                                            <td className="font-medium text-gray-800">{item.koliDetails || '-'}</td>
                                            <td className="font-semibold text-gray-900">{item.customerName || '-'}</td>
                                            <td className="font-bold text-purple-900 uppercase">{item.destination || '-'}</td>
                                            <td className="text-right font-mono font-bold text-gray-900">
                                                {formatRupiah(item.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                    {record.transitItems.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center text-gray-400 italic py-2">
                                                Tidak ada pengeluaran transit ekspedisi lanjutan.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold">
                                        <td colSpan={5} className="text-right uppercase text-[9pt]">Total Barang Transit:</td>
                                        <td className="text-right font-mono text-purple-900 text-[9pt]">
                                            {formatRupiah(totalTransit)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* ── SECTION 4: OPERASIONAL TIKET KAPAL MAKASSAR ── */}
                        {(record.tiketItems && record.tiketItems.length > 0 || totalTiket > 0) && (
                            <div className="border border-gray-300 rounded-xl p-3.5 bg-blue-50/20">
                                <h3 className="font-extrabold text-xs text-blue-950 uppercase mb-2">
                                    * OPERASIONAL TIKET KAPAL MAKASSAR *
                                </h3>
                                <table className="print-table">
                                    <thead>
                                        <tr>
                                            <th className="w-8 text-center">#</th>
                                            <th>Nama Kapal</th>
                                            <th className="w-28">No. Tiket</th>
                                            <th className="w-36">Rute</th>
                                            <th className="w-32">Kategori</th>
                                            <th className="w-32 text-right">Biaya Tiket (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(record.tiketItems || []).map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="text-center font-medium text-gray-500">{idx + 1}</td>
                                                <td className="font-bold text-blue-900">{item.shipName || '-'}</td>
                                                <td className="font-mono font-bold text-gray-900">{item.ticketNumber || '-'}</td>
                                                <td className="font-semibold text-gray-800">{item.route || '-'}</td>
                                                <td className="font-medium text-gray-700">{item.category || '-'}</td>
                                                <td className="text-right font-mono font-bold text-blue-900">
                                                    {formatRupiah(item.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-blue-100/50 font-bold">
                                            <td colSpan={5} className="text-right uppercase text-[9pt]">Total Tiket Kapal:</td>
                                            <td className="text-right font-mono text-blue-900 text-[9pt]">
                                                {formatRupiah(totalTiket)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* ── SECTION 5: REKAPITULASI GRAND TOTAL & DEPOSIT KANTOR ── */}
                        <div className="border-2 border-gray-800 rounded-xl p-4 bg-gray-50/80 space-y-3">
                            <h3 className="font-black text-xs text-gray-900 uppercase tracking-wider border-b border-gray-300 pb-1">
                                * REKAPITULASI OPERASIONAL MAKASSAR *
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between">
                                        <span>1. Total Ops Bongkar:</span>
                                        <span className="font-mono font-bold">{formatRupiah(totalBongkar)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>2. Total Ops Pemuatan:</span>
                                        <span className="font-mono font-bold">{formatRupiah(totalPemuatan)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>3. Total Barang Transit:</span>
                                        <span className="font-mono font-bold">{formatRupiah(totalTransit)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>4. Total Tiket Kapal:</span>
                                        <span className="font-mono font-bold text-blue-900">{formatRupiah(totalTiket)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-gray-300 pt-1 font-bold">
                                        <span>TOTAL GROSS OPERASIONAL:</span>
                                        <span className="font-mono text-gray-900">{formatRupiah(totalGross)}</span>
                                    </div>
                                </div>

                                <div className="space-y-1.5 border-l border-gray-300 pl-4">
                                    <p className="font-bold text-gray-800 uppercase text-[10px]">* DEPOSIT KANTOR / POTONGAN *</p>
                                    {record.depositItems.map((dep, idx) => (
                                        <div key={idx} className="flex justify-between text-emerald-900">
                                            <span>Resi {dep.resiNumber || ''} ({dep.description}):</span>
                                            <span className="font-mono font-bold">-{formatRupiah(dep.amount)}</span>
                                        </div>
                                    ))}
                                    {record.depositItems.length === 0 && (
                                        <div className="flex justify-between text-gray-500">
                                            <span>Tidak ada deposit kantor</span>
                                            <span className="font-mono">Rp 0</span>
                                        </div>
                                    )}

                                    <div className="border-t-2 border-gray-900 pt-2 flex justify-between items-center text-sm font-black bg-blue-100/80 p-2 rounded-lg text-blue-950 mt-2">
                                        <span>TOTAL NET OPERASIONAL MAKASSAR:</span>
                                        <span className="font-mono text-base">{formatRupiah(totalNet)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Operational Notes */}
                        {record.notes && (
                            <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-xs">
                                <p className="font-bold text-amber-900 uppercase text-[10px] mb-1">📝 Catatan Lapangan:</p>
                                <p className="text-amber-950 font-medium whitespace-pre-wrap">{record.notes}</p>
                            </div>
                        )}

                    </div>
                )}

                {/* ── Standard Approval Signature Block ── */}
                <div className="mt-10 pt-4 border-t border-gray-300">
                    <div className="grid grid-cols-3 gap-6 text-center text-xs">
                        <div>
                            <p className="font-bold text-gray-700 uppercase">Dibuat Oleh,</p>
                            <p className="text-[10px] text-gray-400 mb-14">Petugas Lapangan Makassar</p>
                            <div className="border-b border-gray-400 w-36 mx-auto"></div>
                            <p className="font-semibold text-gray-900 mt-1">( .................................... )</p>
                        </div>
                        <div>
                            <p className="font-bold text-gray-700 uppercase">Diperiksa Oleh,</p>
                            <p className="text-[10px] text-gray-400 mb-14">Kepala Cabang Makassar</p>
                            <div className="border-b border-gray-400 w-36 mx-auto"></div>
                            <p className="font-semibold text-gray-900 mt-1">( .................................... )</p>
                        </div>
                        <div>
                            <p className="font-bold text-gray-700 uppercase">Disetujui Oleh,</p>
                            <p className="text-[10px] text-gray-400 mb-14">Pimpinan / Owner</p>
                            <div className="border-b border-gray-400 w-36 mx-auto"></div>
                            <p className="font-semibold text-gray-900 mt-1">{COMPANY_INFO.signatureName || '( HILAL BAFAGIH )'}</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function PrintMakassarOpsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500 font-sans">Memuat Halaman Cetak...</div>}>
            <PrintMakassarOpsContent />
        </Suspense>
    );
}
