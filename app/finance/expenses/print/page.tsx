'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, Mail, MapPin } from 'lucide-react';

interface ExpenseRow {
    id: string;
    category: string;
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
    sewa_kantor: 'Sewa Kantor/Gudang',
    maintenance: 'Maintenance',
    lainnya: 'Lainnya',
};

function formatRp(n: number) {
    return 'Rp ' + n.toLocaleString('id-ID');
}

function PrintContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [rows, setRows] = useState<ExpenseRow[]>([]);
    const [monthLabel, setMonthLabel] = useState('');
    const [modalAwal, setModalAwal] = useState(0);
    const [printDate, setPrintDate] = useState('');

    useEffect(() => {
        const dataStr = searchParams.get('data');
        const monthStr = searchParams.get('month');
        const modalStr = searchParams.get('modal');

        if (dataStr) {
            try {
                const parsed = JSON.parse(decodeURIComponent(dataStr));
                // Convert date strings back to Date-like objects safely
                const mapped: ExpenseRow[] = parsed.map((r: any) => ({
                    ...r,
                    date: r.date ? (typeof r.date === 'string' ? r.date : new Date(r.date).toISOString()) : '',
                }));
                setRows(mapped);
            } catch (err) {
                console.error('Failed to parse expense data:', err);
            }
        }

        if (monthStr) {
            const [y, m] = monthStr.split('-');
            const d = new Date(Number(y), Number(m) - 1);
            setMonthLabel(d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }));
        }

        if (modalStr) setModalAwal(Number(modalStr));

        const now = new Date();
        setPrintDate(now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));

        const timer = setTimeout(() => window.print(), 600);
        return () => clearTimeout(timer);
    }, [searchParams]);

    const totalExpenses = rows.reduce((s, r) => s + r.amount, 0);
    const saldoAkhir = modalAwal - totalExpenses;

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
                <h2 className="text-lg font-bold mb-1">LAPORAN PENGELUARAN KAS KECIL</h2>
                <p className="text-xs text-gray-600">Periode: {monthLabel}</p>
                <p className="text-xs text-gray-500">Dicetak: {printDate}</p>
            </div>

            {/* Summary Box */}
            <div className="border-2 border-gray-300 rounded-lg p-4 mb-5 grid grid-cols-3 gap-4">
                <div>
                    <p className="text-xs text-gray-600 mb-0.5">Modal Awal Kas Kecil</p>
                    <p className="text-base font-bold text-gray-900">{formatRp(modalAwal)}</p>
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
                        <th className="border border-gray-400 px-2 py-1.5 text-left text-xs">No</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left text-xs">Tanggal</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left text-xs">Kategori</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left text-xs">Keterangan</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-right text-xs">Jumlah (Rp)</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-right text-xs">Saldo (Rp)</th>
                    </tr>
                </thead>
                <tbody>
                    {/* Starting balance row */}
                    <tr className="bg-green-50">
                        <td className="border border-gray-400 px-2 py-1.5 text-xs text-center" colSpan={4}>
                            <strong>Saldo Awal Kas Kecil</strong>
                        </td>
                        <td className="border border-gray-400 px-2 py-1.5 text-xs text-right">-</td>
                        <td className="border border-gray-400 px-2 py-1.5 text-xs text-right font-bold text-green-700">
                            {formatRp(modalAwal)}
                        </td>
                    </tr>
                    {rows.map((r, idx) => (
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
                            <td className="border border-gray-400 px-2 py-1.5 text-xs">
                                {CATEGORY_LABELS[r.category] || r.category}
                            </td>
                            <td className="border border-gray-400 px-2 py-1.5 text-xs">{r.description}</td>
                            <td className="border border-gray-400 px-2 py-1.5 text-xs text-right text-red-700 font-semibold">
                                {formatRp(r.amount)}
                            </td>
                            <td className={`border border-gray-400 px-2 py-1.5 text-xs text-right font-semibold ${r.runningBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                                {formatRp(r.runningBalance)}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-100 font-bold">
                        <td colSpan={4} className="border border-gray-400 px-2 py-2 text-xs text-right">
                            TOTAL PENGELUARAN:
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
