'use client';

import React, { useState } from 'react';
import type { AssignedEmployee, DepartureReason } from '@/types/loading-session';
import { UserX, AlertTriangle, Clock, ShieldAlert, LogOut, FileText } from 'lucide-react';

interface EmployeeDepartureModalProps {
    assignedEmployees: AssignedEmployee[];
    onClose: () => void;
    onSaveDeparture: (data: {
        employeeId: string;
        employeeName: string;
        role: string;
        departureTime: string;
        reason: DepartureReason;
        penaltyPercentage: number;
        notes?: string;
    }) => void;
}

const REASON_OPTIONS: Array<{ label: DepartureReason; defaultPenalty: number; iconColor: string }> = [
    { label: 'Sengaja Kabur / Lari', defaultPenalty: 100, iconColor: 'text-red-500' },
    { label: 'Izin Resmi (Izin Atasan)', defaultPenalty: 0, iconColor: 'text-emerald-500' },
    { label: 'Ke Toilet / Istirahat Makan', defaultPenalty: 15, iconColor: 'text-amber-500' },
    { label: 'Sakit / Hal Darurat', defaultPenalty: 0, iconColor: 'text-blue-500' },
];

export default function EmployeeDepartureModal({
    assignedEmployees,
    onClose,
    onSaveDeparture
}: EmployeeDepartureModalProps) {
    const activeEmployees = assignedEmployees.filter(e => e.status === 'active' || e.status === 'returned');

    const [selectedEmployeeId, setSelectedEmployeeId] = useState(activeEmployees[0]?.employeeId || '');
    const [reason, setReason] = useState<DepartureReason>('Sengaja Kabur / Lari');
    const [penaltyPct, setPenaltyPct] = useState(100);
    const [departureTime, setDepartureTime] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });
    const [notes, setNotes] = useState('');

    const handleReasonChange = (newReason: DepartureReason) => {
        setReason(newReason);
        const preset = REASON_OPTIONS.find(r => r.label === newReason);
        if (preset) {
            setPenaltyPct(preset.defaultPenalty);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const emp = assignedEmployees.find(e => e.employeeId === selectedEmployeeId);
        if (!emp) {
            alert('Pilih karyawan terlebih dahulu!');
            return;
        }

        onSaveDeparture({
            employeeId: emp.employeeId,
            employeeName: emp.employeeName,
            role: emp.role,
            departureTime: new Date(departureTime).toISOString(),
            reason,
            penaltyPercentage: Number(penaltyPct) || 0,
            notes: notes.trim(),
        });

        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl text-white animate-fade-in">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold">
                            <LogOut size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white">CATAT IZIN KELUAR / KABUR</h3>
                            <p className="text-xs text-slate-400">Log ketidakhadiran & penalti Uang Muat</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white font-bold text-sm"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    {/* Select Employee */}
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Pilih Karyawan Bertugas *
                        </label>
                        {activeEmployees.length === 0 ? (
                            <p className="text-red-400 text-xs italic">Tidak ada karyawan aktif bertugas.</p>
                        ) : (
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold focus:border-indigo-500 focus:outline-none"
                            >
                                {activeEmployees.map(emp => (
                                    <option key={emp.employeeId} value={emp.employeeId}>
                                        {emp.employeeName} ({emp.role})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Reason presets */}
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                            Alasan Ketidakhadiran / Meninggalkan Lokasi *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {REASON_OPTIONS.map(opt => (
                                <button
                                    key={opt.label}
                                    type="button"
                                    onClick={() => handleReasonChange(opt.label)}
                                    className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                                        reason === opt.label
                                            ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold shadow-md'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <ShieldAlert size={16} className={`shrink-0 mt-0.5 ${opt.iconColor}`} />
                                    <div>
                                        <span className="text-[11px] block leading-tight">{opt.label}</span>
                                        <span className="text-[9px] text-slate-400 font-mono">Penalti: {opt.defaultPenalty}%</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Departure Time & Penalty Inputs */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                Jam Keluar / Meninggalkan Lokasi *
                            </label>
                            <input
                                type="datetime-local"
                                value={departureTime}
                                onChange={(e) => setDepartureTime(e.target.value)}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-indigo-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase text-red-400 mb-1">
                                Besaran Penalti Uang Muat (%)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={penaltyPct}
                                onChange={(e) => setPenaltyPct(Number(e.target.value))}
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-black text-sm text-red-400 focus:border-red-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Penalty Alert Info Box */}
                    <div className={`p-3 rounded-2xl border ${penaltyPct > 0 ? 'bg-red-950/40 border-red-800 text-red-200' : 'bg-slate-950 border-slate-800 text-slate-300'}`}>
                        <div className="flex items-center gap-2 font-bold text-[11px]">
                            <AlertTriangle size={15} className={penaltyPct > 0 ? 'text-red-400' : 'text-emerald-400'} />
                            Dampak Terhadap Hak Uang Muat:
                        </div>
                        <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                            {penaltyPct === 100 ? (
                                <strong className="text-red-400">Karyawan HANGUS Uang Muat (0%) karena meninggalkan lokasi tanpa izin/kabur saat muat!</strong>
                            ) : penaltyPct > 0 ? (
                                `Karyawan dikenakan pemotongan porsi Uang Muat sebesar ${penaltyPct}%.`
                            ) : (
                                'Karyawan diizinkan resmi tanpa pemotongan penalti tambahan.'
                            )}
                        </p>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Catatan Detail Petugas / Saksi (Opsional)
                        </label>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Contoh: Pamit makan jam 14:00 tapi tidak kembali hingga muatan selesai..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                        />
                    </div>

                    {/* Submit Actions */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/30"
                        >
                            Simpan Log Izin/Kabur
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
