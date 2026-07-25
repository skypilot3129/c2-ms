'use client';

import React, { use, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getLoadingSessionById } from '@/lib/firestore-loading';
import type { LoadingSession } from '@/types/loading-session';
import { formatRupiah, terbilang } from '@/lib/currency';
import { COMPANY_INFO } from '@/lib/company-config';
import { Printer, ArrowLeft, Truck, Users, Box, ShieldAlert } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function PrintLoadingReportPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const sessionIdParam = resolvedParams.id;

    const router = useRouter();
    const [session, setSession] = useState<LoadingSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSession = async () => {
            if (!sessionIdParam) return;
            const data = await getLoadingSessionById(sessionIdParam);
            if (data) setSession(data);
            setLoading(false);
        };
        fetchSession();
    }, [sessionIdParam]);

    if (loading) {
        return <div className="p-8 text-center text-slate-500 font-medium">Memuat cetakan laporan pemuatan A4...</div>;
    }

    if (!session) {
        return (
            <div className="p-12 text-center text-red-500 font-bold">
                Laporan sesi pemuatan tidak ditemukan.
            </div>
        );
    }

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { background: white !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .a4-page { box-shadow: none !important; margin: 0 !important; border: none !important; padding: 12mm 15mm !important; }
                }
                .daily-table th { background-color: #0f172a !important; color: white !important; padding: 5px 6px; font-size: 8pt; border: 1px solid #334155; }
                .daily-table td { padding: 4px 6px; font-size: 8pt; border: 1px solid #cbd5e1; }
                `
            }} />

            {/* Floating Top Control Toolbar */}
            <div className="no-print fixed top-4 right-4 z-50 flex items-center gap-3 bg-slate-900 text-white p-3 px-5 rounded-2xl shadow-2xl border border-slate-700">
                <button
                    onClick={() => router.back()}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5"
                >
                    <ArrowLeft size={16} /> Kembali
                </button>
                <button
                    onClick={() => window.print()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-1.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2 active:scale-95 cursor-pointer"
                >
                    <Printer size={16} /> Cetak Laporan A4
                </button>
            </div>

            {/* A4 Printable Sheet */}
            <div className="a4-page max-w-[210mm] min-h-[297mm] mx-auto bg-white p-8 shadow-2xl text-black">
                
                {/* Official Kop Surat */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-900 text-white font-black text-xl rounded-xl flex items-center justify-center">
                            CCE
                        </div>
                        <div>
                            <h1 className="font-black text-lg text-slate-900 tracking-tight leading-none uppercase">
                                {COMPANY_INFO.name}
                            </h1>
                            <p className="text-[8pt] text-slate-600 font-medium mt-1">
                                {COMPANY_INFO.address}, {COMPANY_INFO.city} • Telp: {COMPANY_INFO.phone}
                            </p>
                        </div>
                    </div>
                    <div className="text-right font-mono text-[8pt]">
                        <span className="font-black text-slate-900 text-sm block">DOKUMEN RESMI GUDANG</span>
                        <span className="text-slate-600">ID Sesi: <strong>{session.sessionId}</strong></span>
                    </div>
                </div>

                {/* Document Title Banner */}
                <div className="bg-slate-900 text-white p-2.5 rounded text-center mb-4">
                    <h2 className="font-black text-[11pt] uppercase tracking-wider">
                        LAPORAN PEMUATAN TRUK & REKAP UANG MUAT
                    </h2>
                    <p className="text-[8pt] text-slate-300 font-mono mt-0.5">
                        Tanggal: {session.date} • Operator Gudang: {session.createdBy}
                    </p>
                </div>

                {/* SECTION 1: ARMADA & METRIK SESI */}
                <div className="mb-4">
                    <h3 className="font-black text-[9pt] uppercase tracking-wide text-slate-900 mb-1.5 flex items-center gap-1.5">
                        I. SPESIFIKASI ARMADA TRUK & METRIK SESI PEMUATAN
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-[8.5pt] border border-slate-300 p-2.5 rounded bg-slate-50">
                        <div>
                            <p>Nama Armada: <strong className="text-slate-900">{session.fleetName}</strong></p>
                            <p>Plat Nomor: <strong className="font-mono text-slate-900">{session.plateNumber}</strong></p>
                            <p>Jenis Truk: <strong className="text-slate-900">{session.fleetType}</strong></p>
                        </div>
                        <div>
                            <p>Waktu Mulai: <strong className="font-mono">{session.startTime ? new Date(session.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</strong></p>
                            <p>Waktu Selesai: <strong className="font-mono">{session.endTime ? new Date(session.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Dalam Proses'}</strong></p>
                            <p>Total Durasi Sesi: <strong className="font-mono">{session.totalDurationMinutes || 0} Menit</strong></p>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: TIM BERTUGAS & PEMBAGIAN UANG MUAT */}
                <div className="mb-4">
                    <h3 className="font-black text-[9pt] uppercase tracking-wide text-slate-900 mb-1.5 flex items-center gap-1.5">
                        II. REKAPITULASI TIM BERTUGAS & ALOKASI PEMBAGIAN UANG MUAT
                    </h3>
                    <table className="daily-table w-full">
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}>NO</th>
                                <th style={{ width: '30%' }}>NAMA KARYAWAN BERTUGAS</th>
                                <th style={{ width: '20%' }}>PERAN (ROLE)</th>
                                <th style={{ width: '15%' }}>STATUS KEHADIRAN</th>
                                <th style={{ width: '15%' }} className="text-right">PORSI UANG MUAT (RP)</th>
                                <th style={{ width: '15%' }} className="text-center">PARAF PENERIMA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(session.assignedEmployees || []).map((emp, idx) => (
                                <tr key={emp.employeeId}>
                                    <td className="text-center font-bold">{idx + 1}</td>
                                    <td className="font-bold text-slate-900">{emp.employeeName}</td>
                                    <td className="font-medium text-slate-700">{emp.role}</td>
                                    <td className="text-center">
                                        <span className={`font-bold uppercase text-[7.5pt] px-1.5 py-0.5 rounded ${emp.status === 'deserted' ? 'bg-red-100 text-red-800 border border-red-300' : emp.status === 'on_leave' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800'}`}>
                                            {emp.status === 'deserted' ? 'KABUR / LARI' : emp.status === 'on_leave' ? 'IZIN KELUAR' : 'HADIR AKTIF'}
                                        </span>
                                    </td>
                                    <td className="text-right font-mono font-black text-slate-900">
                                        {formatRupiah(emp.uangMuatShare)}
                                    </td>
                                    <td className="text-center italic text-slate-400">...................</td>
                                </tr>
                            ))}
                            <tr className="bg-slate-100 font-black">
                                <td colSpan={4} className="text-right uppercase py-1.5 pr-3">TOTAL ALOKASI UANG MUAT :</td>
                                <td className="text-right font-mono text-emerald-800 font-black text-[9pt]">{formatRupiah(session.totalUangMuat || 0)}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* SECTION 3: LOG IZIN / KABUR KARYAWAN (IF ANY) */}
                {(session.departureLogs || []).length > 0 && (
                    <div className="mb-4">
                        <h3 className="font-black text-[9pt] uppercase tracking-wide text-red-900 mb-1.5 flex items-center gap-1.5">
                            III. CATATAN KETIDAKHADIRAN / IZIN KELUAR / KABUR KARYAWAN SAAT PEMUATAN
                        </h3>
                        <table className="daily-table w-full border-red-300">
                            <thead>
                                <tr>
                                    <th style={{ width: '5%' }}>NO</th>
                                    <th style={{ width: '25%' }}>KARYAWAN</th>
                                    <th style={{ width: '15%' }}>JAM KELUAR</th>
                                    <th style={{ width: '15%' }}>JAM KEMBALI</th>
                                    <th style={{ width: '25%' }}>ALASAN & CATATAN</th>
                                    <th style={{ width: '15%' }} className="text-center">PENALTI POTONGAN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {session.departureLogs.map((log, idx) => (
                                    <tr key={log.id} className="bg-red-50/40">
                                        <td className="text-center font-bold">{idx + 1}</td>
                                        <td className="font-bold text-red-900">{log.employeeName} ({log.role})</td>
                                        <td className="font-mono text-center">{new Date(log.departureTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="font-mono text-center">{log.returnTime ? new Date(log.returnTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Tidak Kembali'}</td>
                                        <td className="italic">{log.reason} {log.notes ? `("${log.notes}")` : ''}</td>
                                        <td className="text-center font-mono font-bold text-red-800">{log.penaltyPercentage}% Potong</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* SECTION 4: RINCIAN PENATAAN KOLI DI BAK TRUK */}
                <div className="mb-4">
                    <h3 className="font-black text-[9pt] uppercase tracking-wide text-slate-900 mb-1.5 flex items-center gap-1.5">
                        IV. RINCIAN DAFTAR BARANG / KOLI YANG DIMUAT DI BAK TRUK
                    </h3>
                    <table className="daily-table w-full">
                        <thead>
                            <tr>
                                <th style={{ width: '5%' }}>NO</th>
                                <th style={{ width: '18%' }}>NO STT</th>
                                <th style={{ width: '22%' }}>CLIENT / PENGIRIM</th>
                                <th style={{ width: '20%' }}>KOTA TUJUAN</th>
                                <th style={{ width: '10%' }} className="text-center">JUMLAH KOLI</th>
                                <th style={{ width: '10%' }} className="text-right">BERAT (KG)</th>
                                <th style={{ width: '15%' }} className="text-center">POSISI ZONA BAK</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(session.cargoItems || []).length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-3 text-slate-500 italic">
                                        Belum ada rincian koli ditambahkan di sketsa 3D bak truk.
                                    </td>
                                </tr>
                            ) : (
                                session.cargoItems.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="text-center font-bold">{idx + 1}</td>
                                        <td className="font-mono font-black text-indigo-900">{item.sttNumber}</td>
                                        <td className="font-medium text-slate-800">{item.clientName}</td>
                                        <td className="font-bold text-slate-900 uppercase">{item.destination}</td>
                                        <td className="text-center font-mono font-bold">{item.koliCount} Koli</td>
                                        <td className="text-right font-mono font-bold">{item.weightKg} Kg</td>
                                        <td className="text-center uppercase font-mono font-bold text-[7.5pt]">
                                            {item.zone === 'cabin_top' ? 'ATAS KABIN' : item.zone === 'tailgate_extension' ? 'GAYORAN (9-10M)' : item.zone === 'front' ? 'DEPAN (0-3M)' : item.zone === 'middle' ? 'TENGAH (3-6M)' : 'BELAKANG (6-9M)'} / {item.layer}
                                        </td>
                                    </tr>
                                ))
                            )}
                            <tr className="bg-slate-100 font-black">
                                <td colSpan={4} className="text-right uppercase py-1.5 pr-3">TOTAL REKAPITULASI MUATAN :</td>
                                <td className="text-center font-mono text-amber-800 font-black">{session.totalKoli || 0} Koli</td>
                                <td className="text-right font-mono text-emerald-800 font-black">{((session.totalWeightKg || 0) / 1000).toFixed(2)} Ton</td>
                                <td className="text-center font-mono text-indigo-900">{session.totalCbm || 0} m³</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Terbilang Box */}
                <div className="bg-emerald-50 border border-emerald-300 p-2 rounded mb-6 font-mono text-[8pt] italic">
                    <span className="font-bold mr-2 not-italic text-slate-900">Terbilang Alokasi Total Uang Muat:</span>
                    # {terbilang(session.totalUangMuat || 0)} #
                </div>

                {/* Signatures Footer */}
                <div className="flex justify-between items-end text-[8pt] pt-2 border-t border-slate-300">
                    <div className="leading-relaxed text-[7.5pt] text-slate-600">
                        <p className="font-bold text-slate-900 uppercase">Catatan Verifikasi Pemuatan:</p>
                        <p>• Seluruh barang yang dimuat telah disesuaikan dengan sketsa 3D bak truk dan ditata dengan aman.</p>
                        <p>• Pembagian Uang Muat telah diperhitungkan secara transparan sesuai jam aktif dan status ketidakhadiran.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-6 text-center text-[8pt] min-w-[340px]">
                        <div>
                            <p className="text-slate-600 font-semibold mb-10">Penyusun Utama,</p>
                            <p className="font-bold text-slate-900 underline">( .................... )</p>
                        </div>
                        <div>
                            <p className="text-slate-600 font-semibold mb-10">Kasir / Keuangan,</p>
                            <p className="font-bold text-slate-900 underline">( .................... )</p>
                        </div>
                        <div>
                            <p className="text-slate-600 font-semibold mb-10">Kepala Gudang,</p>
                            <p className="font-bold text-slate-900 underline">( .................... )</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
