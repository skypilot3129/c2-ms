'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatRupiah } from '@/lib/currency';

function SlipContent() {
    const sp = useSearchParams();
    const router = useRouter();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const raw = sp.get('data');
        if (raw) setData(JSON.parse(decodeURIComponent(raw)));
        const t = setTimeout(() => window.print(), 700);
        return () => clearTimeout(t);
    }, [sp]);

    if (!data) return <p className="p-8 text-gray-400">Loading...</p>;
    const { emp, att, calc, period } = data;

    const monthName = (p: string) => {
        const [y, m] = p.split('-');
        const n = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        return `${n[+m - 1]} ${y}`;
    };

    const typeColors: Record<string, string> = {
        present: '#d1fae5',
        late_mild: '#fef3c7',
        late_severe: '#fed7aa',
        absent: '#f3f4f6',
    };
    const typeLabel: Record<string, string> = {
        present: 'H',
        late_mild: 'TL',
        late_severe: 'TB',
        absent: '-',
    };

    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-white p-8 text-gray-900 max-w-3xl mx-auto" style={{ fontSize: '12px' }}>
            {/* Header */}
            <div className="border-b-2 border-gray-800 pb-5 mb-5 flex justify-between items-start">
                <div>
                    <h1 className="text-xl font-bold">CAHAYA CARGO EXPRESS</h1>
                    <p className="text-xs text-gray-600">Jasa Pengiriman Barang Terpercaya</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                    <p>Dicetak: {today}</p>
                </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
                <h2 className="text-base font-bold">SLIP GAJI KARYAWAN</h2>
                <p className="text-xs text-gray-600">Periode: {monthName(period)}</p>
            </div>

            {/* Employee Info */}
            <div className="border border-gray-300 rounded-lg p-4 mb-5 grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-gray-500">Nama</span><p className="font-bold text-sm">{emp.fullName}</p></div>
                <div><span className="text-gray-500">ID Karyawan</span><p className="font-medium">{emp.employeeId}</p></div>
                <div><span className="text-gray-500">Jabatan</span><p className="font-medium capitalize">{emp.role}</p></div>
                <div><span className="text-gray-500">Status</span><p className="font-medium capitalize">{emp.status}</p></div>
            </div>

            {/* Attendance Grid */}
            <div className="mb-5">
                <p className="font-bold text-xs mb-2 text-gray-700">REKAP ABSENSI</p>
                <div className="grid grid-cols-10 gap-1">
                    {att.map((d: any, i: number) => (
                        <div key={i} className="flex flex-col items-center">
                            <div className="text-[8px] text-gray-400">{new Date(d.date + 'T00:00:00').getDate()}</div>
                            <div className="w-full px-0.5 py-1 rounded text-center text-[8px] font-bold"
                                style={{ backgroundColor: typeColors[d.type] }}>
                                {d.overridden ? 'H*' : typeLabel[d.type]}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 mt-2 text-[9px] text-gray-500 flex-wrap">
                    <span><span className="font-bold text-emerald-700">H</span> = Hadir</span>
                    <span><span className="font-bold text-amber-700">TL</span> = Telat Ringan</span>
                    <span><span className="font-bold text-orange-700">TB</span> = Telat Berat</span>
                    <span><span className="text-gray-400">-</span> = Tidak Hadir</span>
                    <span><span className="font-bold">H*</span> = Kelonggaran</span>
                </div>
            </div>

            {/* Attendance Summary */}
            <div className="grid grid-cols-4 gap-3 mb-5 text-center">
                {[
                    { label: 'Hadir', value: calc.daysPresent, bg: '#d1fae5' },
                    { label: 'Telat Ringan', value: calc.daysLateMild, bg: '#fef3c7' },
                    { label: 'Telat Berat', value: calc.daysLateSevere, bg: '#fed7aa' },
                    { label: 'Tidak Hadir', value: calc.daysAbsent, bg: '#f3f4f6' },
                ].map(({ label, value, bg }) => (
                    <div key={label} className="rounded-lg p-3 border border-gray-200" style={{ backgroundColor: bg }}>
                        <p className="text-lg font-bold">{value}</p>
                        <p className="text-[9px] text-gray-600">{label}</p>
                    </div>
                ))}
            </div>

            {/* Salary Calculation Table */}
            <table className="w-full border-collapse border border-gray-300 mb-5 text-xs">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left">Komponen</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">Jumlah (Rp)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="border border-gray-300 px-3 py-2">{calc.daysPresent} hari hadir × Rp 50.000</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">{formatRupiah(calc.basePay)}</td>
                    </tr>
                    {calc.daysLateMild > 0 && <tr className="text-amber-800">
                        <td className="border border-gray-300 px-3 py-2">Potongan Telat Ringan ({calc.daysLateMild}× Rp 10.000)</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">-{formatRupiah(calc.lateMildDeduction)}</td>
                    </tr>}
                    {calc.daysLateSevere > 0 && <tr className="text-orange-800">
                        <td className="border border-gray-300 px-3 py-2">Potongan Telat Berat ({calc.daysLateSevere}× Rp 20.000)</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">-{formatRupiah(calc.lateSevereDeduction)}</td>
                    </tr>}
                    <tr className="font-bold bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2">Gaji Kotor</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">{formatRupiah(calc.grossPay)}</td>
                    </tr>
                    {calc.advanceDeduction > 0 && <tr className="text-red-800">
                        <td className="border border-gray-300 px-3 py-2">Potongan Bon / Kasbon</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">-{formatRupiah(calc.advanceDeduction)}</td>
                    </tr>}
                    <tr className="font-bold bg-blue-50 text-blue-900">
                        <td className="border border-gray-300 px-3 py-2 text-base">TOTAL DITERIMA</td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-base">{formatRupiah(calc.netPay)}</td>
                    </tr>
                </tbody>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-6 mt-10 text-center text-xs">
                {[['Dibuat Oleh', 'Admin'], ['Diperiksa', 'Pengurus'], ['Penerima', emp.fullName]].map(([title, name]) => (
                    <div key={title}>
                        <p className="text-gray-500 mb-12">{title},</p>
                        <p className="border-t border-gray-400 pt-1 font-semibold">( {name} )</p>
                    </div>
                ))}
            </div>

            {/* Print buttons */}
            <div className="no-print mt-6 flex gap-3">
                <button onClick={() => window.print()} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">Print PDF</button>
                <button onClick={() => router.back()} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold">Kembali</button>
            </div>

            <style jsx global>{`
                @media print { .no-print { display: none !important; } @page { size: A4; margin: 1cm; } }
            `}</style>
        </div>
    );
}

export default function SlipPrintPage() {
    return <Suspense fallback={<p className="p-8">Loading...</p>}><SlipContent /></Suspense>;
}
