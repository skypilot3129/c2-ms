'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { AttendanceStats } from '@/lib/reports-helper';

function PrintContent() {
    const sp = useSearchParams();
    const router = useRouter();
    const [data, setData] = useState<{ periodTitle: string; stats: AttendanceStats } | null>(null);

    useEffect(() => {
        const raw = sp.get('data');
        if (raw) setData(JSON.parse(decodeURIComponent(raw)));
        const t = setTimeout(() => window.print(), 700);
        return () => clearTimeout(t);
    }, [sp]);

    if (!data) return <p className="p-8">Memuat Data...</p>;
    const { periodTitle, stats } = data;

    const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-white p-8 text-gray-900 max-w-4xl mx-auto" style={{ fontSize: '12px' }}>
            <div className="border-b-2 border-gray-800 pb-4 mb-5 flex justify-between items-start">
                <div>
                    <h1 className="text-xl font-bold uppercase tracking-wide">CAHAYA CARGO EXPRESS</h1>
                    <p className="text-xs text-gray-500 font-medium tracking-wide">Laporan Kehadiran Karyawan Operasional</p>
                </div>
                <div className="text-right text-xs text-gray-500 font-medium">
                    <p>Dicetak: {today}</p>
                </div>
            </div>

            <div className="text-center mb-6">
                <h2 className="text-base font-bold underline underline-offset-4 decoration-2 decoration-gray-300">
                    REKAPITULASI ABSENSI TIM OPERASIONAL
                </h2>
                <p className="text-xs text-gray-800 mt-1 font-semibold uppercase tracking-wider">Periode: {periodTitle}</p>
            </div>

            {/* General Highlights */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="border border-gray-300 p-3 rounded text-center">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Total Hari Kerja</p>
                    <p className="text-lg font-bold text-gray-800">{stats.totalWorkingDays} <span className="text-xs font-normal">hari</span></p>
                </div>
                <div className="border border-gray-300 p-3 rounded text-center">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Tingkat Absensi</p>
                    <p className="text-lg font-bold text-gray-800">{stats.attendanceRate}%</p>
                </div>
                <div className="border border-gray-300 p-3 rounded text-center">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Cetak Lembur</p>
                    <p className="text-lg font-bold text-gray-800">{stats.totalOvertimeEvents} <span className="text-xs font-normal">sesi</span></p>
                </div>
                <div className="border border-gray-300 p-3 rounded text-center">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Total Terlambat</p>
                    <p className="text-lg font-bold text-amber-700">{stats.totalLateCheckins} <span className="text-xs font-normal">kali</span></p>
                </div>
            </div>

            {/* Per-member details */}
            <div className="mb-6">
                <h3 className="font-bold text-[11px] uppercase tracking-wide text-gray-700 mb-2">RINCIAN KINERJA KARYAWAN ({stats.totalEmployees} Orang)</h3>
                <table className="w-full border-collapse border border-gray-400 text-xs text-gray-800">
                    <thead className="bg-gray-100 uppercase text-[10px]">
                        <tr>
                            <th className="border border-gray-400 px-2 py-2 text-center w-8">No</th>
                            <th className="border border-gray-400 px-2 py-2 text-left">Nama Karyawan</th>
                            <th className="border border-gray-400 px-2 py-2 text-center text-emerald-700">Hadir</th>
                            <th className="border border-gray-400 px-2 py-2 text-center text-amber-700">Terlambat</th>
                            <th className="border border-gray-400 px-2 py-2 text-center text-red-700">Alpha</th>
                            <th className="border border-gray-400 px-2 py-2 text-center text-gray-600">Izin</th>
                            <th className="border border-gray-400 px-2 py-2 text-center text-purple-700">Lembur</th>
                            <th className="border border-gray-400 px-2 py-2 text-center">Total Jam</th>
                            <th className="border border-gray-400 px-2 py-2 text-center font-bold">Skor Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.employeeBreakdown.map((emp, i) => (
                            <tr key={emp.employeeId} className={i % 2 !== 0 ? 'bg-gray-50/70' : ''}>
                                <td className="border border-gray-300 px-2 py-1.5 text-center font-medium">{i + 1}</td>
                                <td className="border border-gray-300 px-2 py-1.5 font-bold tracking-tight">{emp.employeeName}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-center">{emp.daysPresent}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-center font-bold text-amber-700">{emp.daysLate > 0 ? emp.daysLate : '-'}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-center font-bold text-red-700">{emp.daysAbsent > 0 ? emp.daysAbsent : '-'}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-center">{emp.daysLeave > 0 ? emp.daysLeave : '-'}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-center font-bold text-purple-700">{emp.overtimeCount > 0 ? emp.overtimeCount : '-'}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-center">{emp.totalHours.toFixed(1)}</td>
                                <td className="border border-gray-300 px-2 py-1.5 text-center font-bold">{emp.attendanceRate}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="no-print mt-8 flex gap-3 justify-end items-center">
                <button onClick={() => window.print()} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-colors">
                    Cetak File
                </button>
                <button onClick={() => router.back()} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold border border-gray-200 hover:bg-gray-200 transition-colors">
                    Tutup
                </button>
            </div>
            <style jsx global>{`
                @media print { 
                    .no-print { display: none !important; }
                    body { background: white; }
                    @page { size: A4 portrait; margin: 1.5cm; }
                }
            `}</style>
        </div>
    );
}

export default function AttendancePrintPage() {
    return <Suspense fallback={<p className="p-8">Loading print template...</p>}><PrintContent /></Suspense>;
}
