'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatRupiah } from '@/lib/currency';

function PrintContent() {
    const sp = useSearchParams();
    const router = useRouter();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const raw = sp.get('data');
        if (raw) setData(JSON.parse(decodeURIComponent(raw)));
        const t = setTimeout(() => window.print(), 700);
        return () => clearTimeout(t);
    }, [sp]);

    if (!data) return <p className="p-8">Loading...</p>;
    const { salary } = data;

    const monthName = (p: string) => {
        const [y, m] = p.split('-');
        const n = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${n[+m - 1]} ${y}`;
    };

    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-white p-8 text-gray-900 max-w-2xl mx-auto" style={{ fontSize: '12px' }}>
            <div className="border-b-2 border-gray-800 pb-4 mb-5 flex justify-between">
                <div><h1 className="text-xl font-bold">CAHAYA CARGO EXPRESS</h1><p className="text-xs text-gray-500">Jasa Pengiriman Barang Terpercaya</p></div>
                <div className="text-right text-xs text-gray-500"><p>Dicetak: {today}</p></div>
            </div>
            <div className="text-center mb-6">
                <h2 className="text-base font-bold">SLIP GAJI SOPIR</h2>
                <p className="text-xs text-gray-600">Periode: {monthName(salary.period)}</p>
            </div>
            <div className="border border-gray-300 rounded-lg p-4 mb-5 text-xs">
                <p className="text-gray-500 mb-1">Nama Sopir</p>
                <p className="font-bold text-lg">{salary.driverName}</p>
            </div>
            <table className="w-full border-collapse border border-gray-300 mb-5 text-xs">
                <tbody>
                    <tr><td className="border border-gray-300 px-3 py-2">Gaji Pokok</td><td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatRupiah(salary.baseSalary)}</td></tr>
                    {salary.bonusAmount > 0 && <tr><td className="border border-gray-300 px-3 py-2">Bonus</td><td className="border border-gray-300 px-3 py-2 text-right font-medium text-emerald-700">+{formatRupiah(salary.bonusAmount)}</td></tr>}
                    {salary.advanceDeduction > 0 && <tr><td className="border border-gray-300 px-3 py-2">Potongan Bon</td><td className="border border-gray-300 px-3 py-2 text-right font-medium text-red-700">-{formatRupiah(salary.advanceDeduction)}</td></tr>}
                    <tr className="font-bold bg-blue-50"><td className="border border-gray-300 px-3 py-2 text-base">TOTAL DITERIMA</td><td className="border border-gray-300 px-3 py-2 text-right text-base text-blue-700">{formatRupiah(salary.netPay)}</td></tr>
                </tbody>
            </table>
            {salary.notes && <p className="text-xs text-gray-500 mb-5 italic">Catatan: {salary.notes}</p>}
            <div className="grid grid-cols-2 gap-6 mt-10 text-center text-xs">
                {[['Dibuat Oleh', 'Admin'], ['Penerima', salary.driverName]].map(([t, n]) => (
                    <div key={t}><p className="text-gray-500 mb-12">{t},</p><p className="border-t border-gray-400 pt-1 font-semibold">( {n} )</p></div>
                ))}
            </div>
            <div className="no-print mt-6 flex gap-3">
                <button onClick={() => window.print()} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold">Print PDF</button>
                <button onClick={() => router.back()} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold">Kembali</button>
            </div>
            <style jsx global>{`@media print { .no-print { display: none !important; } @page { size: A4; margin: 1cm; } }`}</style>
        </div>
    );
}

export default function DriverSalaryPrintPage() {
    return <Suspense fallback={<p className="p-8">Loading...</p>}><PrintContent /></Suspense>;
}
