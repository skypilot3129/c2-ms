'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { subscribeToLoadingSessions } from '@/lib/firestore-loading';
import type { LoadingSession } from '@/types/loading-session';
import { formatRupiah } from '@/lib/currency';
import {
    Truck, Plus, Play, Clock, CheckCircle2, AlertTriangle, FileText,
    Printer, Users, Eye, Box, Scale, ArrowRight, ShieldAlert, PauseCircle
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function PemuatanDashboardPage() {
    const [sessions, setSessions] = useState<LoadingSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        const unsubscribe = subscribeToLoadingSessions((list) => {
            setSessions(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Filtered sessions
    const filteredSessions = sessions.filter(session => {
        const matchSearch = 
            session.sessionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.fleetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.plateNumber.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchStatus = statusFilter === 'all' || session.status === statusFilter;
        return matchSearch && matchStatus;
    });

    // KPI Metrics
    const activeSessionsCount = sessions.filter(s => s.status === 'loading' || s.status === 'paused').length;
    const completedSessionsCount = sessions.filter(s => s.status === 'completed').length;
    const totalKoliLoaded = sessions.reduce((sum, s) => sum + (s.totalKoli || 0), 0);
    const totalUangMuatAllocated = sessions.reduce((sum, s) => sum + (s.totalUangMuat || 0), 0);

    const getStatusBadge = (status: LoadingSession['status']) => {
        switch (status) {
            case 'loading':
                return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse"><Play size={10} /> Muat Berlangsung</span>;
            case 'paused':
                return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5"><PauseCircle size={10} /> Di-Pause / Izin</span>;
            case 'completed':
                return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5"><CheckCircle2 size={10} /> Selesai Muat</span>;
            case 'draft':
                return <span className="bg-slate-700 text-slate-300 border border-slate-600 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full">Draft</span>;
            default:
                return <span className="bg-slate-800 text-slate-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded">{status}</span>;
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-400 font-medium">Memuat modul Pemuatan Truk...</div>;
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
                
                {/* ── HEADER TOOLBAR ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 font-black">
                            <Truck size={28} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-white tracking-tight">PEMUATAN TRUK & SKETSA 3D</h1>
                                <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full">
                                    V2.0 LIVE STUDIO
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Manajemen sesi muat, sketsa 3D penataan bak truk, stopwatch timer, & tracking izin/kabur karyawan.
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/operations/pemuatan/new"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                    >
                        <Plus size={18} /> + Mulai Sesi Pemuatan Baru
                    </Link>
                </div>

                {/* ── KPI METRICS CARDS ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2 relative overflow-hidden">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-black uppercase tracking-wider">Sesi Muat Aktif</span>
                            <Play className="text-emerald-400" size={20} />
                        </div>
                        <p className="text-3xl font-black text-emerald-400 font-mono">{activeSessionsCount}</p>
                        <p className="text-[10px] text-slate-400">Armada sedang dimuat di gudang</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2 relative overflow-hidden">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-black uppercase tracking-wider">Sesi Selesai</span>
                            <CheckCircle2 className="text-blue-400" size={20} />
                        </div>
                        <p className="text-3xl font-black text-blue-400 font-mono">{completedSessionsCount}</p>
                        <p className="text-[10px] text-slate-400">Truk siap diberangkatkan</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2 relative overflow-hidden">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-black uppercase tracking-wider">Total Koli Dimuat</span>
                            <Box className="text-amber-400" size={20} />
                        </div>
                        <p className="text-3xl font-black text-amber-400 font-mono">{totalKoliLoaded.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">Akumulasi seluruh sesi muat</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2 relative overflow-hidden">
                        <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-black uppercase tracking-wider">Total Uang Muat</span>
                            <Users className="text-purple-400" size={20} />
                        </div>
                        <p className="text-2xl font-black text-purple-400 font-mono">{formatRupiah(totalUangMuatAllocated)}</p>
                        <p className="text-[10px] text-slate-400">Alokasi bonus/upah muat tim</p>
                    </div>
                </div>

                {/* ── SEARCH & FILTER TOOLBAR ── */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Cari sesi muat, nama armada, plat nomor..."
                        className="w-full md:w-80 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />

                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                        {['all', 'loading', 'paused', 'completed', 'draft'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all uppercase whitespace-nowrap ${
                                    statusFilter === st
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                }`}
                            >
                                {st === 'all' ? 'Semua Status' : st}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── SESSIONS LIST TABLE ── */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                                <tr>
                                    <th className="py-4 px-5">ID Sesi & Tanggal</th>
                                    <th className="py-4 px-5">Armada Unit / Plat</th>
                                    <th className="py-4 px-5">Tim Bertugas</th>
                                    <th className="py-4 px-5 text-center">Statistik Muatan</th>
                                    <th className="py-4 px-5 text-center">Status & Log Izin</th>
                                    <th className="py-4 px-5 text-right">Uang Muat</th>
                                    <th className="py-4 px-5 text-center">Tindakan Studio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredSessions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-16 text-slate-500 italic">
                                            Belum ada data sesi pemuatan. Klik "+ Mulai Sesi Pemuatan Baru" di atas.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSessions.map((session) => {
                                        const desertCount = (session.departureLogs || []).filter(l => l.reason.includes('Kabur')).length;
                                        const leaveCount = (session.departureLogs || []).filter(l => !l.reason.includes('Kabur')).length;

                                        return (
                                            <tr key={session.id} className="hover:bg-slate-800/40 transition-colors">
                                                
                                                {/* ID & Date */}
                                                <td className="py-4 px-5">
                                                    <span className="font-mono font-black text-indigo-400 text-sm block">
                                                        {session.sessionId}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {session.date}
                                                    </span>
                                                </td>

                                                {/* Fleet Unit */}
                                                <td className="py-4 px-5">
                                                    <span className="font-bold text-white text-sm block">
                                                        {session.fleetName}
                                                    </span>
                                                    <span className="font-mono text-emerald-400 text-[11px] font-bold">
                                                        {session.plateNumber} ({session.fleetType || 'Truk'})
                                                    </span>
                                                </td>

                                                {/* Team List */}
                                                <td className="py-4 px-5">
                                                    <div className="space-y-1">
                                                        {(session.assignedEmployees || []).slice(0, 3).map((emp, idx) => (
                                                            <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                                                                <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'deserted' ? 'bg-red-500' : emp.status === 'on_leave' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                                                <span className="font-medium text-slate-200">{emp.employeeName}</span>
                                                                <span className="text-[9px] text-slate-500">({emp.role})</span>
                                                            </div>
                                                        ))}
                                                        {(session.assignedEmployees || []).length > 3 && (
                                                            <span className="text-[10px] text-indigo-400 italic">
                                                                +{session.assignedEmployees.length - 3} anggota lainnya
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Cargo Stats */}
                                                <td className="py-4 px-5 text-center">
                                                    <span className="font-mono font-black text-amber-400 text-sm block">
                                                        {session.totalKoli || 0} Koli
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {((session.totalWeightKg || 0) / 1000).toFixed(2)} Ton • {session.totalCbm || 0} m³
                                                    </span>
                                                </td>

                                                {/* Status & Leave Badge */}
                                                <td className="py-4 px-5 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {getStatusBadge(session.status)}
                                                        {desertCount > 0 && (
                                                            <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <ShieldAlert size={10} /> {desertCount} Karyawan Kabur
                                                            </span>
                                                        )}
                                                        {leaveCount > 0 && desertCount === 0 && (
                                                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                                {leaveCount} Log Izin Keluar
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Uang Muat Share */}
                                                <td className="py-4 px-5 text-right font-mono font-black text-purple-300 text-sm">
                                                    {formatRupiah(session.totalUangMuat || 0)}
                                                </td>

                                                {/* Action Buttons */}
                                                <td className="py-4 px-5 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Link
                                                            href={`/operations/pemuatan/${session.id}`}
                                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                                                        >
                                                            <Box size={14} /> Studio 3D
                                                        </Link>
                                                        <Link
                                                            href={`/operations/pemuatan/${session.id}/print`}
                                                            target="_blank"
                                                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-3 py-2 rounded-xl border border-slate-700 transition-all flex items-center gap-1"
                                                            title="Cetak Laporan A4 Sesi Pemuatan"
                                                        >
                                                            <Printer size={14} /> Cetak
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
