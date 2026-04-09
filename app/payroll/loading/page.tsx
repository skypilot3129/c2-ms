'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToEmployees } from '@/lib/firestore-employees';
import { subscribeToLoadingSessions, addLoadingSession, updateLoadingSession, deleteLoadingSession } from '@/lib/firestore-payroll-ops';
import type { Employee } from '@/types/employee';
import type { LoadingSession, LoadingSessionFormData, LoadingMember } from '@/types/payroll-ops';
import { TRUCK_POOL, TRUCK_LABELS, computeLoadingShares } from '@/types/payroll-ops';
import { formatRupiah } from '@/lib/currency';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Truck, X, Edit2, Save, Printer, Users } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];
const now = new Date();
const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const monthName = (p: string) => {
    const [y, m] = p.split('-');
    const n = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${n[+m - 1]} ${y}`;
};

export default function LoadingPayPage() {
    const router = useRouter();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [sessions, setSessions] = useState<LoadingSession[]>([]);
    const [period, setPeriod] = useState(defaultPeriod);
    const [view, setView] = useState<'sessions' | 'summary'>('sessions');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formDate, setFormDate] = useState(today());
    const [formTruck, setFormTruck] = useState<'fuso' | 'tronton'>('fuso');
    const [formLabel, setFormLabel] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formMembers, setFormMembers] = useState<LoadingMember[]>([]);

    useEffect(() => {
        const u1 = subscribeToEmployees(data => {
            const helpers = data.filter(e => e.role === 'helper' && e.status === 'active');
            setEmployees(helpers);
        });
        return u1;
    }, []);

    useEffect(() => {
        const u = subscribeToLoadingSessions(period, setSessions);
        return u;
    }, [period]);

    const openNewForm = () => {
        setEditId(null);
        setFormDate(today());
        setFormTruck('fuso');
        setFormLabel('');
        setFormNotes('');
        const members: LoadingMember[] = employees.map(e => ({
            employeeId: e.id,
            employeeName: e.fullName,
            present: false,
            isStacker: false,
            contributionPercentage: 100,
            shareAmount: 0,
            stackingBonus: 0,
            total: 0,
        }));
        setFormMembers(members);
        setShowForm(true);
    };

    const openEditForm = (s: LoadingSession) => {
        setEditId(s.id);
        setFormDate(s.date);
        setFormTruck(s.truckType);
        setFormLabel(s.truckLabel || '');
        setFormNotes(s.notes || '');
        // Merge with current employee list  
        const saved = new Map(s.members.map(m => [m.employeeId, m]));
        const merged: LoadingMember[] = employees.map(e => {
            const existing = saved.get(e.id);
            return existing || {
                employeeId: e.id,
                employeeName: e.fullName,
                present: false,
                isStacker: false,
                contributionPercentage: 100,
                shareAmount: 0,
                stackingBonus: 0,
                total: 0,
            };
        });
        setFormMembers(merged);
        setShowForm(true);
    };

    const togglePresent = (empId: string) => {
        setFormMembers(prev => prev.map(m => m.employeeId === empId ? { ...m, present: !m.present, isStacker: m.present ? false : m.isStacker } : m));
    };
    const toggleStacker = (empId: string) => {
        setFormMembers(prev => prev.map(m => m.employeeId === empId && m.present ? { ...m, isStacker: !m.isStacker } : m));
    };
    const updateContribution = (empId: string, percentage: number) => {
        setFormMembers(prev => prev.map(m => m.employeeId === empId ? { ...m, contributionPercentage: percentage } : m));
    };

    // Live preview of splits
    const preview = useMemo(() => {
        const raw = { date: formDate, truckType: formTruck, pool: TRUCK_POOL[formTruck], members: formMembers, id: '', createdAt: new Date(), updatedAt: new Date() };
        return computeLoadingShares(raw as any);
    }, [formMembers, formTruck]);

    const handleSave = async () => {
        if (!formDate) { alert('Pilih tanggal'); return; }
        if (!formMembers.some(m => m.present)) { alert('Pilih minimal 1 anggota hadir'); return; }
        setSaving(true);
        const formData: LoadingSessionFormData = {
            date: formDate,
            truckType: formTruck,
            truckLabel: formLabel,
            notes: formNotes,
            members: formMembers.map(m => ({ employeeId: m.employeeId, employeeName: m.employeeName, present: m.present, isStacker: m.isStacker, contributionPercentage: m.contributionPercentage })),
        };
        try {
            if (editId) {
                await updateLoadingSession(editId, formData);
            } else {
                await addLoadingSession(formData);
            }
            setShowForm(false);
        } catch { alert('Gagal menyimpan'); }
        finally { setSaving(false); }
    };

    // Per-member summary for the period
    const memberSummary = useMemo(() => {
        const map: Record<string, { name: string; sessions: number; totalShare: number; totalBonus: number; total: number }> = {};
        sessions.forEach(s => {
            s.members.forEach(m => {
                if (!m.present) return;
                if (!map[m.employeeId]) map[m.employeeId] = { name: m.employeeName, sessions: 0, totalShare: 0, totalBonus: 0, total: 0 };
                map[m.employeeId].sessions++;
                map[m.employeeId].totalShare += m.shareAmount;
                map[m.employeeId].totalBonus += m.stackingBonus;
                map[m.employeeId].total += m.total;
            });
        });
        return Object.entries(map).sort(([, a], [, b]) => b.total - a.total);
    }, [sessions]);

    const handlePrint = () => {
        const data = encodeURIComponent(JSON.stringify({ sessions, memberSummary, period }));
        router.push(`/payroll/loading/print?data=${data}`);
    };

    return (
        <ProtectedRoute>
            <div className="space-y-5 pb-24">
                {/* Header */}
                <div className="flex items-center gap-3 flex-wrap">
                    <Link href="/payroll" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                        <ArrowLeft size={16} /> Kembali
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Truck size={20} className="text-green-600" /> Kalkulator Uang Muat
                        </h1>
                        <p className="text-xs text-gray-500">Bagi rata uang muat berdasarkan kehadiran di tiap operasi</p>
                    </div>
                </div>

                {/* Period + actions */}
                <div className="flex items-center gap-3 flex-wrap">
                    <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-green-200" />
                    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                        <button onClick={() => setView('sessions')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'sessions' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Operasi</button>
                        <button onClick={() => setView('summary')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'summary' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Rekap</button>
                    </div>
                    <div className="flex gap-2 ml-auto">
                        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                            <Printer size={14} /> Cetak
                        </button>
                        <button onClick={openNewForm} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-green-600/20 transition-all">
                            <Plus size={15} /> Tambah Operasi
                        </button>
                    </div>
                </div>

                {/* Rates info */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-green-500/20">
                        <p className="text-green-100 text-xs font-medium">Fuso</p>
                        <p className="text-2xl font-bold">Rp 650.000</p>
                        <p className="text-green-200 text-xs">dibagi rata hadir</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg shadow-blue-500/20">
                        <p className="text-blue-100 text-xs font-medium">Tronton</p>
                        <p className="text-2xl font-bold">Rp 850.000</p>
                        <p className="text-blue-200 text-xs">dibagi rata hadir + bonus susun</p>
                    </div>
                </div>

                {/* Sessions view */}
                {view === 'sessions' && (
                    <div className="space-y-3">
                        {sessions.length === 0 && (
                            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
                                <Truck size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Belum ada operasi muat di {monthName(period)}</p>
                            </div>
                        )}
                        {sessions.map(s => {
                            const present = s.members.filter(m => m.present);
                            const totalDistributed = present.reduce((sum, m) => sum + m.total, 0);
                            return (
                                <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${s.truckType === 'fuso' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {TRUCK_LABELS[s.truckType]}
                                        </span>
                                        <p className="font-bold text-sm text-gray-800 flex-1">
                                            {new Date(s.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                                            {s.truckLabel && <span className="text-gray-400 font-normal"> · {s.truckLabel}</span>}
                                        </p>
                                        <span className="text-xs text-gray-500">{present.length} orang</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => openEditForm(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><Edit2 size={13} /></button>
                                            <button onClick={() => { if (confirm('Hapus operasi ini?')) deleteLoadingSession(s.id); }}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {present.map(m => (
                                            <div key={m.employeeId} className="px-4 py-3 flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold shrink-0">{m.employeeName[0]}</div>
                                                <p className="text-sm font-medium text-gray-800 flex-1">
                                                    {m.employeeName}
                                                    {m.isStacker && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Susun</span>}
                                                    {m.contributionPercentage && m.contributionPercentage < 100 && <span className="ml-2 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">{m.contributionPercentage}%</span>}
                                                </p>
                                                <div className="text-right">
                                                    <p className="font-bold text-green-700 text-sm">{formatRupiah(m.total)}</p>
                                                    {m.stackingBonus > 0 && <p className="text-[10px] text-amber-600">+{formatRupiah(m.stackingBonus)} bonus</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="px-4 py-2 bg-green-50 flex justify-between items-center">
                                        <span className="text-xs text-green-700 font-medium">Total Terdistribusi</span>
                                        <span className="font-bold text-green-700">{formatRupiah(totalDistributed)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Summary view */}
                {view === 'summary' && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2"><Users size={15} className="text-green-600" /> Rekap per Karyawan — {monthName(period)}</h3>
                            <span className="text-xs text-gray-500">{sessions.length} operasi</span>
                        </div>
                        {memberSummary.length === 0 && (
                            <div className="p-8 text-center text-gray-400 text-sm">Belum ada data uang muat</div>
                        )}
                        <div className="divide-y divide-gray-50">
                            {memberSummary.map(([empId, data], idx) => (
                                <div key={empId} className="px-4 py-4 flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold shrink-0">{idx + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-800">{data.name}</p>
                                        <p className="text-xs text-gray-500">{data.sessions} operasi · Bagi rata: {formatRupiah(data.totalShare)}{data.totalBonus > 0 ? ` + Bonus susun: ${formatRupiah(data.totalBonus)}` : ''}</p>
                                    </div>
                                    <p className="font-bold text-green-700 text-base shrink-0">{formatRupiah(data.total)}</p>
                                </div>
                            ))}
                        </div>
                        {memberSummary.length > 0 && (
                            <div className="px-4 py-3 bg-green-50 flex justify-between items-center border-t border-green-100">
                                <span className="text-sm font-bold text-green-800">Total Uang Muat</span>
                                <span className="text-base font-bold text-green-800">{formatRupiah(memberSummary.reduce((s, [, d]) => s + d.total, 0))}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Add/Edit Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
                                <h3 className="font-bold text-gray-800">{editId ? 'Edit Operasi Muat' : 'Tambah Operasi Muat'}</h3>
                                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 block mb-1">Tanggal</label>
                                        <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-green-200" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 block mb-1">Jenis Truk</label>
                                        <select value={formTruck} onChange={e => setFormTruck(e.target.value as any)}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-green-200">
                                            <option value="fuso">Fuso (Rp 650.000)</option>
                                            <option value="tronton">Tronton (Rp 850.000)</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">Label Kendaraan (opsional)</label>
                                    <input type="text" placeholder="Mis: Fuso B 1234 XY" value={formLabel} onChange={e => setFormLabel(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-green-200" />
                                </div>

                                {/* Member toggles */}
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-2">
                                        Anggota Hadir ({formMembers.filter(m => m.present).length})
                                        <span className="text-gray-400 font-normal ml-1">— Ketuk nama untuk hadir, centang 📦 untuk susun</span>
                                    </label>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {formMembers.map(m => {
                                            const prev = preview.find(p => p.employeeId === m.employeeId);
                                            return (
                                                <div key={m.employeeId}
                                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${m.present ? 'bg-green-50 border-green-200' : 'border-gray-100 hover:bg-gray-50'}`}
                                                    onClick={() => togglePresent(m.employeeId)}>
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${m.present ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                        {m.employeeName[0]}
                                                    </div>
                                                    <p className="flex-1 text-sm font-medium text-gray-800">{m.employeeName}</p>
                                                    {m.present && (
                                                        <>
                                                            <select
                                                                onClick={e => e.stopPropagation()}
                                                                onChange={e => updateContribution(m.employeeId, parseInt(e.target.value))}
                                                                value={m.contributionPercentage ?? 100}
                                                                className="px-1.5 py-1 rounded-lg text-[10px] font-semibold border border-gray-200 bg-white text-gray-600 outline-none"
                                                            >
                                                                <option value={100}>100%</option>
                                                                <option value={75}>75%</option>
                                                                <option value={50}>50%</option>
                                                                <option value={25}>25%</option>
                                                            </select>
                                                            <button onClick={e => { e.stopPropagation(); toggleStacker(m.employeeId); }}
                                                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${m.isStacker ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-400 hover:border-amber-300'}`}>
                                                                📦 Susun
                                                            </button>
                                                            <span className="text-xs font-bold text-green-700 min-w-[60px] text-right">
                                                                {prev ? formatRupiah(prev.total) : '-'}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">Catatan</label>
                                    <input type="text" placeholder="Catatan operasional..."
                                        value={formNotes} onChange={e => setFormNotes(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-green-200" />
                                </div>

                                {/* Preview total */}
                                {formMembers.some(m => m.present) && (
                                    <div className="bg-green-50 rounded-xl px-4 py-3 flex justify-between items-center">
                                        <span className="text-sm text-green-700 font-medium">Total terdistribusi</span>
                                        <span className="font-bold text-green-800">{formatRupiah(preview.filter(m => m.present).reduce((s, m) => s + m.total, 0))}</span>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => setShowForm(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium">Batal</button>
                                    <button onClick={handleSave} disabled={saving}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                                        <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
