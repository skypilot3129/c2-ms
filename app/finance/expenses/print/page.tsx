'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, Mail, MapPin } from 'lucide-react';

interface LedgerRow {
    id: string;
    entryType: 'expense' | 'topup';
    category?: string;
    description: string;
    amount: number;
    date: string;
    runningBalance: number;
}

const CATEGORY_LABELS: Record<string, string> = {
    tiket: 'Tiket',
    operasional_surabaya: 'Op. Surabaya',
    operasional_makassar: 'Op. Makassar',
    transit: 'Transit',
    sewa_mobil: 'Sewa Mobil',
    gaji_sopir: 'Gaji Sopir',
    gaji_karyawan: 'Gaji Karyawan',
    listrik_air_internet: 'Listrik/Air/Internet',
    sewa_kantor: 'Sewa Kantor',
    maintenance: 'Maintenance',
    lainnya: 'Lainnya',
    bbm_solar: 'BBM/Solar',
    parkir_tol: 'Parkir/Tol',
    makan_tim: 'Makan Tim',
    perlengkapan_kerja: 'Perlengkapan Kerja',
    biaya_pelabuhan: 'Biaya Pelabuhan',
    servis_rutin: 'Servis Rutin',
    ganti_oli: 'Ganti Oli',
    ban: 'Ban Kendaraan',
    spare_part: 'Spare Part',
    atk_kantor: 'ATK',
    pulsa_kuota: 'Pulsa/Kuota',
    konsumsi_rapat: 'Konsumsi Rapat',
    iuran_retribusi: 'Iuran/Retribusi'
};

function formatRp(n: number) {
    return 'Rp ' + n.toLocaleString('id-ID');
}

function PrintContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [periodLabel, setPeriodLabel] = useState('');
    const [modalAwal, setModalAwal] = useState(0); // This is now balanceBeforePeriod
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [totalTopups, setTotalTopups] = useState(0);
    const [saldoAkhir, setSaldoAkhir] = useState(0);
    const [printDate, setPrintDate] = useState('');

    useEffect(() => {
        const dataStr = searchParams.get('data');
        const labelStr = searchParams.get('label');
        const modalStr = searchParams.get('modal');
        setTotalExpenses(Number(searchParams.get('expenses') || 0));
        setTotalTopups(Number(searchParams.get('topups') || 0));
        setSaldoAkhir(Number(searchParams.get('saldo') || 0));

        if (dataStr) {
            try {
                const parsed = JSON.parse(decodeURIComponent(dataStr));
                const mapped: LedgerRow[] = parsed.map((r: any) => ({
                    ...r,
                    date: r.date ? (typeof r.date === 'string' ? r.date : new Date(r.date).toISOString()) : '',
                }));
                setRows(mapped);
            } catch (err) {
                console.error('Failed to parse expense data:', err);
            }
        }

        if (labelStr) {
            setPeriodLabel(decodeURIComponent(labelStr));
        }

        if (modalStr) setModalAwal(Number(modalStr));

        const now = new Date();
        setPrintDate(now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));

        const timer = setTimeout(() => window.print(), 600);
        return () => clearTimeout(timer);
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-white p-8 text-gray-900" style={{ fontSize: '12px' }}>
            {/* Header */}
            <div className="border-b-2 border-gray-800 pb-5 mb-5">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold mb-1">CAHAYA CARGO EXPRESS</h1>
                        <p className="text-xs text-gray-600">Jasa Pengiriman Barang Terpercaya</p>
                    </div>
                    <div className="text-right text-xs text-gray-600 space-y-0.5">
                        <div className="flex items-center justify-end gap-1"><Phone size={10} /> +62 xxx-xxxx-xxxx</div>
                        <div className="flex items-center justify-end gap-1"><Mail size={10} /> info@cahayacargo.com</div>
                        <div className="flex items-center justify-end gap-1"><MapPin size={10} /> Surabaya, Indonesia</div>
                    </div>
                </div>
            </div>

            {/* Title */}
            <div className="text-center mb-5">
                <h2 className="text-lg font-bold mb-1">LAPORAN BUKU KAS KECIL</h2>
                <p className="text-xs text-gray-600">Periode: {periodLabel}</p>
                <p className="text-xs text-gray-500">Dicetak: {printDate}</p>
            </div>

            {/* Summary Box */}
            <div className="border-2 border-gray-300 rounded-lg p-4 mb-5 grid grid-cols-4 gap-4">
                <div>
                    <p className="text-xs text-gray-600 mb-0.5">Saldo Awal</p>
                    <p className="text-base font-bold text-gray-900">{formatRp(modalAwal)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-600 mb-0.5">Total Pemasukan</p>
                    <p className="text-base font-bold text-green-700">{formatRp(totalTopups)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-600 mb-0.5">Total Pengeluaran</p>
                    <p className="text-base font-bold text-red-700">{formatRp(totalExpenses)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-600 mb-0.5">Sisa Saldo</p>
                    <p className={`text-base font-bold ${saldoAkhir >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatRp(saldoAkhir)}</p>
                </div>
            </div>

            {/* Expense Table */}
            <table className="w-full border-collapse border border-gray-400 mb-5">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border border-gray-400 px-2 py-1.5 text-left text-xs w-8">No</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left text-xs w-24">Tanggal</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left text-xs w-24">Kategori</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left text-xs">Keterangan</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-right text-xs w-24">Masuk (Rp)</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-right text-xs w-24">Keluar (Rp)</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-right text-xs w-24">Saldo (Rp)</th>
                    </tr>
                </thead>
                <tbody>
                    {/* Starting balance row */}
                    <tr className="bg-emerald-50">
                        <td className="border border-gray-400 px-2 py-1.5 text-xs text-center" colSpan={4}>
                            <strong>Saldo Awal Periode</strong>
                        </td>
                        <td className="border border-gray-400 px-2 py-1.5 text-xs text-right"></td>
                        <td className="border border-gray-400 px-2 py-1.5 text-xs text-right"></td>
                        <td className="border border-gray-400 px-2 py-1.5 text-xs text-right font-bold text-emerald-700">
                            {formatRp(modalAwal)}
                        </td>
                    </tr>
                    {rows.map((r, idx) => {
                        const isTopup = r.entryType === 'topup';
                        return (
                            <tr key={r.id || idx} className={idx % 2 === 0 ? '' : 'bg-gray-50'}>
                                <td className="border border-gray-400 px-2 py-1.5 text-xs text-center">{idx + 1}</td>
                                <td className="border border-gray-400 px-2 py-1.5 text-xs whitespace-nowrap">
                                    {(() => {
                                        try {
                                            return new Date(r.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                                        } catch {
                                            return r.date;
                                        }
                                    })()}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 text-[10px]">
                                    {isTopup ? 'Top-Up Kas' : (CATEGORY_LABELS[r.category || ''] || r.category)}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 text-xs">{r.description}</td>
                                <td className="border border-gray-400 px-2 py-1.5 text-xs text-right text-green-700 font-semibold">
                                    {isTopup ? formatRp(r.amount) : '-'}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 text-xs text-right text-red-700 font-semibold">
                                    {!isTopup ? formatRp(r.amount) : '-'}
                                </td>
                                <td className={`border border-gray-400 px-2 py-1.5 text-xs text-right font-semibold ${r.runningBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                                    {formatRp(r.runningBalance)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-100 font-bold">
                        <td colSpan={4} className="border border-gray-400 px-2 py-2 text-xs text-right">
                            TOTAL:
                        </td>
                        <td className="border border-gray-400 px-2 py-2 text-xs text-right text-green-700">
                            {formatRp(totalTopups)}
                        </td>
                        <td className="border border-gray-400 px-2 py-2 text-xs text-right text-red-700">
                            {formatRp(totalExpenses)}
                        </td>
                        <td className={`border border-gray-400 px-2 py-2 text-xs text-right ${saldoAkhir >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                            {formatRp(saldoAkhir)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-8 mt-10 text-center text-xs">
                <div>
                    <p className="text-gray-600 mb-16">Dibuat Oleh,</p>
                    <p className="border-t border-gray-400 pt-1 font-semibold">( ________________ )</p>
                    <p className="text-gray-500">Admin Keuangan</p>
                </div>
                <div>
                    <p className="text-gray-600 mb-16">Diperiksa Oleh,</p>
                    <p className="border-t border-gray-400 pt-1 font-semibold">( ________________ )</p>
                    <p className="text-gray-500">Pengurus</p>
                </div>
                <div>
                    <p className="text-gray-600 mb-16">Disetujui Oleh,</p>
                    <p className="border-t border-gray-400 pt-1 font-semibold">( ________________ )</p>
                    <p className="text-gray-500">Pemilik</p>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-gray-300 text-[10px] text-gray-500 italic">
                <p>* Dokumen ini dibuat secara otomatis oleh sistem C2-MS Cahaya Cargo Express</p>
                <p>* Laporan ini berlaku sebagai pertanggungjawaban pengeluaran kas kecil perusahaan</p>
            </div>

            {/* Non-print buttons */}
            <div className="no-print mt-6 flex gap-3">
                <button onClick={() => window.print()} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                    Print / Save as PDF
                </button>
                <button onClick={() => router.back()} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors">
                    Kembali
                </button>
            </div>

            {/* Print CSS */}
            <style jsx global>{`
                @media print {
                    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    @page { size: A4; margin: 1cm; }
                    table { page-break-inside: avoid; }
                    tr { page-break-inside: avoid; }
                }
            `}</style>
        </div>
    );
}

export default function PrintExpensesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white p-8 flex items-center justify-center"><p className="text-gray-600">Loading...</p></div>}>
            <PrintContent />
        </Suspense>
    );
}
