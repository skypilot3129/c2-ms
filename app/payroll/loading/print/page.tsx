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
    const { sessions, memberSummary, period } = data;

    const monthName = (p: string) => {
        const [y, m] = p.split('-');
        const n = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${n[+m - 1]} ${y}`;
    };

    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const grandTotal = memberSummary.reduce((s: number, [, d]: any) => s + d.total, 0);

    return (
        <div className="min-h-screen bg-white p-8 text-gray-900 max-w-3xl mx-auto" style={{ fontSize: '12px' }}>
            <div className="border-b-2 border-gray-800 pb-4 mb-5 flex justify-between items-start">
                <div>
                    <h1 className="text-xl font-bold">CAHAYA CARGO EXPRESS</h1>
                    <p className="text-xs text-gray-500">Jasa Pengiriman Barang Terpercaya</p>
                </div>
                <div className="text-right text-xs text-gray-500"><p>Dicetak: {today}</p></div>
            </div>

            <div className="text-center mb-5">
                <h2 className="text-base font-bold">REKAP UANG MUAT TIM OPERASIONAL</h2>
                <p className="text-xs text-gray-600">Periode: {monthName(period)}</p>
            </div>

            {/* Per-member summary */}
            <div className="mb-6">
                <h3 className="font-bold text-xs text-gray-700 mb-2">REKAP PER ANGGOTA</h3>
                <table className="w-full border-collapse border border-gray-300 text-xs">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border border-gray-300 px-2 py-1.5 text-left">No</th>
                            <th className="border border-gray-300 px-2 py-1.5 text-left">Nama</th>
                            <th className="border border-gray-300 px-2 py-1.5 text-center">Operasi</th>
                            <th className="border border-gray-300 px-2 py-1.5 text-right">Bagi Rata</th>
                            <th className="border border-gray-300 px-2 py-1.5 text-right">Bonus Susun</th>
                            <th className="border border-gray-300 px-2 py-1.5 text-right font-bold">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {memberSummary.map(([empId, d]: any, i: number) => (
                            <tr key={empId} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                                <td className="border border-gray-300 px-2 py-1.5 text-center">{i + 1}</td>
                                <td className="border border-gray-300 px-2 py-1.5 font-medium">{d.name}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-center">{d.sessions}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-right">{formatRupiah(d.totalShare)}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-right text-amber-700">{d.totalBonus > 0 ? formatRupiah(d.totalBonus) : '-'}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-right font-bold text-green-700">{formatRupiah(d.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 font-bold">
                            <td colSpan={5} className="border border-gray-300 px-2 py-2 text-right">TOTAL</td>
                            <td className="border border-gray-300 px-2 py-2 text-right text-green-700">{formatRupiah(grandTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Per-session detail */}
            <div>
                <h3 className="font-bold text-xs text-gray-700 mb-2">RINCIAN OPERASI ({sessions.length} sesi)</h3>
                {sessions.map((s: any, si: number) => {
                    const present = s.members.filter((m: any) => m.present);
                    return (
                        <div key={s.id} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 text-xs">
                                <span className={`font-bold px-2 py-0.5 rounded ${s.truckType === 'fuso' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'}`}>{s.truckType.toUpperCase()}</span>
                                <span className="font-bold">{new Date(s.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                {s.truckLabel && <span className="text-gray-500">· {s.truckLabel}</span>}
                                <span className="ml-auto text-gray-500">{formatRupiah(s.pool)} pool · {present.length} orang</span>
                            </div>
                            <table className="w-full text-xs">
                                <tbody>
                                    {present.map((m: any) => (
                                        <tr key={m.employeeId} className="border-t border-gray-100">
                                            <td className="px-3 py-1.5">{m.employeeName}{m.isStacker && <span className="ml-1 text-amber-600">(Susun)</span>}</td>
                                            <td className="px-3 py-1.5 text-right">{formatRupiah(m.shareAmount)}</td>
                                            <td className="px-3 py-1.5 text-right text-amber-600">{m.stackingBonus > 0 ? `+${formatRupiah(m.stackingBonus)}` : ''}</td>
                                            <td className="px-3 py-1.5 text-right font-bold text-green-700">{formatRupiah(m.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>

            <div className="no-print mt-6 flex gap-3">
                <button onClick={() => window.print()} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold">Print PDF</button>
                <button onClick={() => router.back()} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold">Kembali</button>
            </div>
            <style jsx global>{`@media print { .no-print { display: none !important; } @page { size: A4; margin: 1cm; } }`}</style>
        </div>
    );
}

export default function LoadingPrintPage() {
    return <Suspense fallback={<p className="p-8">Loading...</p>}><PrintContent /></Suspense>;
}
