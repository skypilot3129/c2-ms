'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { subscribeToFleets } from '@/lib/firestore-fleet';
import { subscribeToEmployees } from '@/lib/firestore-employees';
import { createLoadingSession, calculateUangMuatShare } from '@/lib/firestore-loading';
import type { Fleet } from '@/types/fleet';
import type { Employee } from '@/types/employee';
import type { AssignedEmployee } from '@/types/loading-session';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah } from '@/lib/currency';
import {
    Truck, Users, ArrowLeft, Play, ShieldAlert, Plus, Trash2,
    Calendar, CheckCircle2, DollarSign, FileText, Info
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function NewLoadingSessionPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [fleets, setFleets] = useState<Fleet[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form states
    const [selectedFleetId, setSelectedFleetId] = useState('');
    const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [totalUangMuat, setTotalUangMuat] = useState(300000);
    const [notes, setNotes] = useState('');

    // Selected Team Members
    const [assignedTeam, setAssignedTeam] = useState<AssignedEmployee[]>([]);
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [selectedEmpRole, setSelectedEmpRole] = useState<'Penyusun' | 'Loader/Helper' | 'Pengawal'>('Loader/Helper');

    useEffect(() => {
        if (!user) return;

        const unsubFleets = subscribeToFleets(user.uid, (list) => {
            setFleets(list);
            if (list.length > 0 && !selectedFleetId) {
                setSelectedFleetId(list[0].id);
            }
        });

        const unsubEmps = subscribeToEmployees((list) => {
            setEmployees(list.filter(e => e.status === 'active'));
            if (list.length > 0 && !selectedEmpId) {
                setSelectedEmpId(list[0].id);
            }
            setLoading(false);
        });

        return () => {
            unsubFleets();
            unsubEmps();
        };
    }, [user]);

    const handleAddTeamMember = () => {
        if (!selectedEmpId) return;
        const empObj = employees.find(e => e.id === selectedEmpId);
        if (!empObj) return;

        if (assignedTeam.some(t => t.employeeId === empObj.id)) {
            alert('Karyawan ini sudah ditambahkan ke tim bertugas!');
            return;
        }

        const newMember: AssignedEmployee = {
            employeeId: empObj.id,
            employeeName: empObj.fullName,
            role: selectedEmpRole,
            status: 'active',
            totalActiveMinutes: 60,
            uangMuatShare: 0,
        };

        const updatedTeam = [...assignedTeam, newMember];
        const recalculated = calculateUangMuatShare(updatedTeam, [], totalUangMuat, 60);
        setAssignedTeam(recalculated);
    };

    const handleRemoveTeamMember = (empId: string) => {
        const updated = assignedTeam.filter(t => t.employeeId !== empId);
        const recalculated = calculateUangMuatShare(updated, [], totalUangMuat, 60);
        setAssignedTeam(recalculated);
    };

    const handleUangMuatChange = (amount: number) => {
        setTotalUangMuat(amount);
        const recalculated = calculateUangMuatShare(assignedTeam, [], amount, 60);
        setAssignedTeam(recalculated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFleetId) {
            alert('Pilih armada truk terlebih dahulu!');
            return;
        }
        if (assignedTeam.length === 0) {
            alert('Harap pilih minimal 1 karyawan bertugas untuk sesi pemuatan ini!');
            return;
        }

        setSubmitting(true);
        try {
            const fleetObj = fleets.find(f => f.id === selectedFleetId);
            const fleetName = fleetObj?.name || 'Truk Pemuatan';
            const plateNumber = fleetObj?.plateNumber || 'Plat Unknown';
            const fleetType = fleetObj?.type || 'Truk Fuso Long';

            const operatorName = user?.displayName || user?.email || 'Officer Pemuatan';

            const newSessionId = await createLoadingSession({
                date: sessionDate,
                fleetId: selectedFleetId,
                fleetName,
                plateNumber,
                fleetType,
                status: 'loading',
                assignedEmployees: assignedTeam,
                departureLogs: [],
                cargoItems: [],
                startTime: new Date().toISOString(),
                totalDurationMinutes: 0,
                totalKoli: 0,
                totalWeightKg: 0,
                totalCbm: 0,
                totalUangMuat: Number(totalUangMuat) || 0,
                notes: notes.trim(),
                createdBy: operatorName,
            });

            router.push(`/operations/pemuatan/${newSessionId}`);
        } catch (error: any) {
            console.error('Error starting loading session:', error);
            alert(`Gagal memulai sesi pemuatan: ${error.message}`);
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-400 font-medium">Memuat data armada & karyawan...</div>;
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
                
                {/* Top Back Header */}
                <div className="flex items-center gap-3">
                    <Link
                        href="/operations/pemuatan"
                        className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-black text-white">MULAI SESI PEMUATAN BARU</h1>
                        <p className="text-xs text-slate-400">Pilih armada, atur tim bertugas, & alokasikan Uang Muat</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* SECTION 1: ARMADA & TANGGAL */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                        <h3 className="font-black text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                            <Truck size={18} /> 1. PILIH ARMADA TRUK & TANGGAL
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Pilih Unit Armada Truk *
                                </label>
                                {fleets.length === 0 ? (
                                    <p className="text-red-400 italic">Belum ada data armada di database Fleet.</p>
                                ) : (
                                    <select
                                        value={selectedFleetId}
                                        onChange={(e) => setSelectedFleetId(e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white font-bold text-sm focus:border-indigo-500 focus:outline-none"
                                    >
                                        {fleets.map(fleet => (
                                            <option key={fleet.id} value={fleet.id}>
                                                {fleet.name} • {fleet.plateNumber} ({fleet.type})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Tanggal Pemuatan *
                                </label>
                                <input
                                    type="date"
                                    value={sessionDate}
                                    onChange={(e) => setSessionDate(e.target.value)}
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white font-bold font-mono text-sm focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: TIM KARYAWAN BERTUGAS */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-sm text-purple-400 uppercase tracking-wider flex items-center gap-2">
                                <Users size={18} /> 2. TIM KARYAWAN BERTUGAS MUAT
                            </h3>
                            <span className="text-xs text-slate-400 font-mono">
                                {assignedTeam.length} Anggota Ditambahkan
                            </span>
                        </div>

                        {/* Add team member control */}
                        <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                        Pilih Karyawan Aktif
                                    </label>
                                    <select
                                        value={selectedEmpId}
                                        onChange={(e) => setSelectedEmpId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-indigo-500 focus:outline-none"
                                    >
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.fullName} ({emp.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                        Peran dalam Pemuatan
                                    </label>
                                    <select
                                        value={selectedEmpRole}
                                        onChange={(e) => setSelectedEmpRole(e.target.value as any)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="Loader/Helper">Loader / Helper</option>
                                        <option value="Penyusun">Penyusun (Stacker Utama)</option>
                                        <option value="Pengawal">Pengawal / Pengawas</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddTeamMember}
                                className="w-full bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Plus size={16} /> Tambah ke Daftar Tim Muat
                            </button>
                        </div>

                        {/* Team List Table */}
                        <div className="space-y-2">
                            {assignedTeam.length === 0 ? (
                                <p className="text-center py-6 text-slate-500 italic text-xs border border-dashed border-slate-800 rounded-2xl">
                                    Belum ada anggota tim ditambahkan. Silakan pilih karyawan di atas.
                                </p>
                            ) : (
                                assignedTeam.map((member, idx) => (
                                    <div
                                        key={member.employeeId}
                                        className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-400 font-mono">
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <span className="font-black text-white text-sm block">{member.employeeName}</span>
                                                <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                                                    {member.role}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right font-mono">
                                                <span className="text-[9px] text-slate-400 block uppercase">Estimasi Uang Muat</span>
                                                <span className="font-black text-emerald-400 text-sm">{formatRupiah(member.uangMuatShare)}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTeamMember(member.employeeId)}
                                                className="text-slate-500 hover:text-red-400 p-1.5 transition-colors"
                                                title="Keluarkan dari tim"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* SECTION 3: ANGGARAN UANG MUAT & CATATAN */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                        <h3 className="font-black text-sm text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                            <DollarSign size={18} /> 3. ALOKASI ANGGARAN UANG MUAT & CATATAN
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Total Anggaran Uang Muat (Rp) *
                                </label>
                                <input
                                    type="number"
                                    step="10000"
                                    min="0"
                                    value={totalUangMuat}
                                    onChange={(e) => handleUangMuatChange(Number(e.target.value))}
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-emerald-400 font-mono font-black text-base focus:border-emerald-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500 mt-1 block">
                                    Uang muat ini akan dibagi otomatis secara proporsional ke tim bertugas.
                                </span>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Catatan Pemuatan (Opsional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Contoh: Muatan sparepart berat & barang pecah belah..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-white focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-800">
                        <Link
                            href="/operations/pemuatan"
                            className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-2xl border border-slate-800 text-xs"
                        >
                            Batal
                        </Link>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            <Play size={18} /> {submitting ? 'Memulai Sesi...' : 'MULAI SESI PEMUATAN & BUKA STUDIO 3D'}
                        </button>
                    </div>
                </form>
            </div>
        </ProtectedRoute>
    );
}
