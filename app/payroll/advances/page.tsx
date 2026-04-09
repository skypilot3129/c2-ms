'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToEmployees } from '@/lib/firestore-employees';
import { subscribeToEmployeeAdvances, addEmployeeAdvance, updateEmployeeAdvance, deleteEmployeeAdvance } from '@/lib/firestore-payroll-ops';
import type { Employee } from '@/types/employee';
import type { EmployeeAdvance, EmployeeAdvanceFormData } from '@/types/payroll-ops';
import { ADVANCE_STATUS_LABELS } from '@/types/payroll-ops';
import { formatRupiah } from '@/lib/currency';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, CreditCard, CheckCircle2, Clock, X, DollarSign } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];

const STATUS_COLORS = {
    active: 'bg-amber-100 text-amber-700 border-amber-200',
    deducted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cancelled: 'bg-gray-100 text-gray-400 border-gray-200',
};

const EMPTY_FORM: EmployeeAdvanceFormData = {
    employeeId: '',
    employeeName: '',
    amount: 0,
    date: today(),
    description: '',
};

export default function AdvancesPage() {
    const { user } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<EmployeeAdvanceFormData>(EMPTY_FORM);
    const [filterEmp, setFilterEmp] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('active');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const u1 = subscribeToEmployees(setEmployees);
        const u2 = subscribeToEmployeeAdvances(setAdvances);
        return () => { u1(); u2(); };
    }, []);

    const filtered = advances.filter(a => {
        if (filterEmp && a.employeeId !== filterEmp) return false;
        if (filterStatus && a.status !== filterStatus) return false;
        return true;
    });

    const totalActive = advances.filter(a => a.status === 'active').reduce((s, a) => s + a.amount, 0);

    const handleEmpSelect = (empId: string) => {
        const emp = employees.find(e => e.id === empId);
        setForm(f => ({ ...f, employeeId: empId, employeeName: emp?.fullName || '' }));
    };

    const handleSubmit = async () => {
        if (!form.employeeId || !form.amount || !form.description) {
            alert('Lengkapi: karyawan, jumlah, dan keterangan'); return;
        }
        setSaving(true);
        try {
            await addEmployeeAdvance(form);
            setShowForm(false);
            setForm(EMPTY_FORM);
        } catch { alert('Gagal menyimpan'); }
        finally { setSaving(false); }
    };

    const handleStatusChange = async (adv: EmployeeAdvance, status: EmployeeAdvance['status']) => {
        await updateEmployeeAdvance(adv.id, { status });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus bon ini?')) return;
        await deleteEmployeeAdvance(id);
    };

    return (
        <ProtectedRoute>
            <div className="space-y-5 pb-20">
                {/* Header */}
                <div className="flex items-center gap-3 flex-wrap">
                    <Link href="/payroll" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                        <ArrowLeft size={16} /> Kembali
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <CreditCard size={20} className="text-amber-600" /> Bon / Kasbon Karyawan
                        </h1>
                        <p className="text-xs text-gray-500">Kelola kasbon karyawan yang dipotong dari gaji</p>
                    </div>
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-amber-500/20 transition-all">
                        <Plus size={15} /> Tambah Bon
                    </button>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg shadow-amber-500/20">
                        <p className="text-amber-100 text-xs font-medium">Total Bon Aktif</p>
                        <p className="text-xl font-bold mt-1">{formatRupiah(totalActive)}</p>
                        <p className="text-amber-200 text-xs">{advances.filter(a => a.status === 'active').length} bon pending</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <p className="text-gray-500 text-xs font-medium">Total Dipotong</p>
                        <p className="text-xl font-bold mt-1 text-emerald-600">
                            {formatRupiah(advances.filter(a => a.status === 'deducted').reduce((s, a) => s + a.amount, 0))}
                        </p>
                        <p className="text-gray-400 text-xs">{advances.filter(a => a.status === 'deducted').length} bon selesai</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                    <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
                        className="flex-1 min-w-[140px] px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none">
                        <option value="">Semua Karyawan</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none">
                        <option value="">Semua Status</option>
                        <option value="active">Aktif</option>
                        <option value="deducted">Dipotong</option>
                        <option value="cancelled">Dibatalkan</option>
                    </select>
                </div>

                {/* List */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                    {filtered.length === 0 && (
                        <div className="p-12 text-center text-gray-400">
                            <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Belum ada bon karyawan</p>
                        </div>
                    )}
                    {filtered.map(adv => (
                        <div key={adv.id} className="px-4 py-4 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-sm text-gray-800">{adv.employeeName}</p>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[adv.status]}`}>
                                        {ADVANCE_STATUS_LABELS[adv.status]}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{adv.description} · {new Date(adv.date).toLocaleDateString('id-ID')}</p>
                                {adv.deductedMonth && <p className="text-[10px] text-emerald-600">Dipotong: {adv.deductedMonth}</p>}
                            </div>
                            <p className="font-bold text-amber-700 text-sm shrink-0">{formatRupiah(adv.amount)}</p>
                            {adv.status === 'active' && (
                                <div className="flex gap-1 shrink-0">
                                    <button onClick={() => handleStatusChange(adv, 'deducted')} title="Tandai dipotong"
                                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                                        <CheckCircle2 size={14} />
                                    </button>
                                    <button onClick={() => handleStatusChange(adv, 'cancelled')} title="Batalkan"
                                        className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors">
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                            <button onClick={() => handleDelete(adv.id)}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-800">Tambah Bon Karyawan</h3>
                                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">Karyawan</label>
                                    <select value={form.employeeId} onChange={e => handleEmpSelect(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-amber-200">
                                        <option value="">Pilih karyawan...</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">Jumlah (Rp)</label>
                                    <input type="number" min={0} placeholder="0"
                                        value={form.amount || ''}
                                        onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-amber-200 font-bold" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">Tanggal</label>
                                    <input type="date" value={form.date}
                                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-amber-200" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">Keterangan</label>
                                    <input type="text" placeholder="Keperluan bon..."
                                        value={form.description}
                                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-amber-200" />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium">Batal</button>
                                <button onClick={handleSubmit} disabled={saving}
                                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                                    {saving ? 'Menyimpan...' : 'Simpan Bon'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
