'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    getLoadingSessionById,
    updateLoadingSessionStatus,
    logEmployeeDeparture,
    returnEmployeeFromLeave,
    saveCargoStackLayout,
    calculateUangMuatShare
} from '@/lib/firestore-loading';
import type {
    LoadingSession,
    CargoStackItem,
    AssignedEmployee,
    EmployeeDepartureLog,
    DepartureReason
} from '@/types/loading-session';
import Truck3dVisualizer from '@/components/pemuatan/Truck3dVisualizer';
import EmployeeDepartureModal from '@/components/pemuatan/EmployeeDepartureModal';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah } from '@/lib/currency';
import {
    Truck, ArrowLeft, Play, Pause, CheckCircle2, Clock, Users,
    ShieldAlert, Plus, Printer, Box, Scale, RefreshCw, AlertTriangle, FileText
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function LoadingSessionStudioPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const sessionIdParam = resolvedParams.id;

    const router = useRouter();
    const { user } = useAuth();

    const [session, setSession] = useState<LoadingSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Modal state for Employee Departure
    const [showDepartureModal, setShowDepartureModal] = useState(false);

    // Toast state
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Load session data
    const fetchSession = async () => {
        if (!sessionIdParam) return;
        const data = await getLoadingSessionById(sessionIdParam);
        if (data) {
            setSession(data);

            // Compute elapsed seconds
            if (data.startTime) {
                const startMs = new Date(data.startTime).getTime();
                const endMs = data.endTime ? new Date(data.endTime).getTime() : Date.now();
                if (data.status === 'loading' || data.status === 'completed' || data.status === 'paused') {
                    setElapsedSeconds(Math.max(0, Math.floor((endMs - startMs) / 1000)));
                }
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSession();
    }, [sessionIdParam]);

    // Live Stopwatch Ticker
    useEffect(() => {
        if (!session || session.status !== 'loading') return;

        const interval = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [session?.status]);

    // Format HH:MM:SS
    const formatTimer = (totalSec: number) => {
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // Handle Status Change (Play, Pause, Complete)
    const handleStatusChange = async (newStatus: LoadingSession['status']) => {
        if (!session) return;
        try {
            const extraUpdates: Partial<LoadingSession> = {};
            if (newStatus === 'completed') {
                extraUpdates.totalDurationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
            }

            await updateLoadingSessionStatus(session.id, newStatus, extraUpdates);
            showToast(`Status pemuatan diubah menjadi: ${newStatus.toUpperCase()}`);
            fetchSession();
        } catch (error: any) {
            alert(`Gagal mengubah status: ${error.message}`);
        }
    };

    // Handle Save Cargo Stack Items from Visualizer
    const handleSaveCargoLayout = async (updatedCargoItems: CargoStackItem[]) => {
        if (!session) return;
        try {
            await saveCargoStackLayout(session.id, updatedCargoItems);
            showToast('Sketsa 3D penataan barang berhasil disimpan!');
            fetchSession();
        } catch (error: any) {
            console.error('Error saving cargo layout:', error);
            alert(`Gagal menyimpan layout cargo: ${error.message}`);
        }
    };

    // Handle Save Employee Departure Log
    const handleSaveEmployeeDeparture = async (departureData: {
        employeeId: string;
        employeeName: string;
        role: string;
        departureTime: string;
        reason: DepartureReason;
        penaltyPercentage: number;
        notes?: string;
    }) => {
        if (!session) return;
        try {
            const operatorName = user?.displayName || user?.email || 'Officer Pemuatan';
            await logEmployeeDeparture(session.id, {
                ...departureData,
                durationMinutes: 0,
                loggedBy: operatorName
            }, session.assignedEmployees);

            showToast(`Log izin/kabur ${departureData.employeeName} berhasil dicatat!`);
            fetchSession();
        } catch (error: any) {
            console.error('Error logging departure:', error);
            alert(`Gagal mencatat izin/kabur: ${error.message}`);
        }
    };

    // Handle Employee Return from Leave
    const handleReturnEmployee = async (employeeId: string, employeeName: string) => {
        if (!session) return;
        if (confirm(`Tandai karyawan ${employeeName} sudah kembali bertugas?`)) {
            try {
                await returnEmployeeFromLeave(session.id, employeeId, new Date().toISOString());
                showToast(`${employeeName} telah kembali bertugas!`);
                fetchSession();
            } catch (error: any) {
                alert(`Gagal memproses kembali: ${error.message}`);
            }
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-400 font-medium">Memuat Studio Pemuatan 3D...</div>;
    }

    if (!session) {
        return (
            <div className="p-12 text-center text-red-400 font-bold space-y-4">
                <p>Data sesi pemuatan tidak ditemukan.</p>
                <Link href="/operations/pemuatan" className="text-indigo-400 underline">
                    Kembali ke Dashboard Pemuatan
                </Link>
            </div>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-24">
                
                {/* Floating Toast Notification */}
                {toastMessage && (
                    <div className="fixed top-6 right-6 bg-slate-900 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-2.5 border border-slate-700 animate-bounce">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* ── TOP HEADER TOOLBAR & LIVE TIMER ── */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/operations/pemuatan"
                            className="w-10 h-10 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-white font-mono tracking-tight">{session.sessionId}</h1>
                                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                    {session.fleetType}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Armada: <strong className="text-white">{session.fleetName}</strong> ({session.plateNumber}) • Operator: {session.createdBy}
                            </p>
                        </div>
                    </div>

                    {/* LIVE STOPWATCH TIMER & STATUS CONTROLS */}
                    <div className="flex items-center gap-4 flex-wrap bg-slate-950 p-3 px-5 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-2.5">
                            <Clock size={20} className={session.status === 'loading' ? 'text-emerald-400 animate-spin' : 'text-slate-400'} />
                            <div>
                                <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Durasi Sesi Muat</span>
                                <span className="text-2xl font-black font-mono text-emerald-400">{formatTimer(elapsedSeconds)}</span>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-slate-800 mx-1 hidden sm:block"></div>

                        {/* Status Control Buttons */}
                        <div className="flex items-center gap-2">
                            {session.status === 'loading' && (
                                <button
                                    type="button"
                                    onClick={() => handleStatusChange('paused')}
                                    className="bg-amber-600/80 hover:bg-amber-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                >
                                    <Pause size={14} /> Pause / Jeda
                                </button>
                            )}

                            {session.status === 'paused' && (
                                <button
                                    type="button"
                                    onClick={() => handleStatusChange('loading')}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                >
                                    <Play size={14} /> Lanjutkan Sesi
                                </button>
                            )}

                            {session.status !== 'completed' && (
                                <button
                                    type="button"
                                    onClick={() => handleStatusChange('completed')}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                >
                                    <CheckCircle2 size={14} /> Selesaikan Sesi
                                </button>
                            )}

                            <Link
                                href={`/operations/pemuatan/${session.id}/print`}
                                target="_blank"
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
                            >
                                <Printer size={14} /> Cetak A4
                            </Link>
                        </div>
                    </div>
                </div>

                {/* ── MAIN STUDIO WORKSPACE (3 PANELS GRID) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* ── LEFT PANEL: TEAM ASSIGNMENT & UANG MUAT WAGE SPLIT (4 COLS) ── */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* Team Attendance Card */}
                        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 shadow-xl">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <div className="flex items-center gap-2">
                                    <Users className="text-purple-400" size={18} />
                                    <h3 className="font-black text-sm text-white">TIM KARYAWAN BERTUGAS</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowDepartureModal(true)}
                                    className="bg-red-600/80 hover:bg-red-600 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-xl border border-red-500/40 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                                >
                                    <ShieldAlert size={12} /> + Catat Izin / Kabur
                                </button>
                            </div>

                            <div className="space-y-3">
                                {(session.assignedEmployees || []).map(emp => (
                                    <div key={emp.employeeId} className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="font-bold text-white text-xs block">{emp.employeeName}</span>
                                                <span className="text-[9px] text-indigo-400 font-bold uppercase">{emp.role}</span>
                                            </div>

                                            {/* Status Badge */}
                                            {emp.status === 'active' && (
                                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                                    Aktif
                                                </span>
                                            )}
                                            {emp.status === 'deserted' && (
                                                <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[9px] font-black uppercase px-2 py-0.5 rounded-full animate-pulse">
                                                    Kabur / Lari
                                                </span>
                                            )}
                                            {emp.status === 'on_leave' && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                                        Izin Keluar
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReturnEmployee(emp.employeeId, emp.employeeName)}
                                                        className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded hover:bg-indigo-500"
                                                        title="Tandai sudah kembali"
                                                    >
                                                        ✓ Kembali
                                                    </button>
                                                </div>
                                            )}
                                            {emp.status === 'returned' && (
                                                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                                    Kembali
                                                </span>
                                            )}
                                        </div>

                                        {emp.notes && (
                                            <p className="text-[10px] text-slate-400 italic bg-slate-900/80 p-1.5 rounded">
                                                {emp.notes}
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between border-t border-slate-900 pt-2 text-[10px] font-mono">
                                            <span className="text-slate-400">Hak Uang Muat:</span>
                                            <span className={`font-black ${emp.uangMuatShare === 0 ? 'text-red-400 line-through' : 'text-emerald-400'}`}>
                                                {formatRupiah(emp.uangMuatShare)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Departure / Desertion History Logs */}
                        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-3 shadow-xl">
                            <h3 className="font-black text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <ShieldAlert size={16} /> LOG DEPARTURE & PENALTI IZA/KABUR
                            </h3>

                            {(session.departureLogs || []).length === 0 ? (
                                <p className="text-center py-4 text-slate-500 italic text-xs">
                                    Tidak ada catatan izin/kabur karyawan pada sesi ini.
                                </p>
                            ) : (
                                <div className="space-y-2 text-xs">
                                    {session.departureLogs.map(log => (
                                        <div key={log.id} className="bg-slate-950 border border-slate-800 p-3 rounded-2xl space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-white">{log.employeeName}</span>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${log.reason.includes('Kabur') ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-300'}`}>
                                                    {log.reason}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400">
                                                Jam Keluar: <strong className="text-slate-200">{new Date(log.departureTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</strong>
                                                {log.returnTime ? ` • Kembali: ${new Date(log.returnTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (${log.durationMinutes} menit)` : ' • (Belum Kembali)'}
                                            </p>
                                            {log.penaltyPercentage > 0 && (
                                                <p className="text-[10px] text-red-400 font-bold font-mono">
                                                    Penalti Potongan: {log.penaltyPercentage}%
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── CENTER PANEL: INTERACTIVE 3D CARGO STACKING VISUALIZER (8 COLS) ── */}
                    <div className="lg:col-span-8 space-y-6">
                        <Truck3dVisualizer
                            cargoItems={session.cargoItems || []}
                            onSaveCargoItems={handleSaveCargoLayout}
                            fleetType={session.fleetType}
                            plateNumber={session.plateNumber}
                            readOnly={session.status === 'completed'}
                        />
                    </div>
                </div>

                {/* MODAL: LOG EMPLOYEE DEPARTURE */}
                {showDepartureModal && (
                    <EmployeeDepartureModal
                        assignedEmployees={session.assignedEmployees || []}
                        onClose={() => setShowDepartureModal(false)}
                        onSaveDeparture={handleSaveEmployeeDeparture}
                    />
                )}
            </div>
        </ProtectedRoute>
    );
}
