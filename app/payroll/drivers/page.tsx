'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    subscribeToVehicleRentals, addVehicleRental, updateVehicleRental, deleteVehicleRental,
    subscribeToDriverAdvances, addDriverAdvance, updateDriverAdvance, deleteDriverAdvance,
    subscribeToDriverSalaries, addDriverSalary, updateDriverSalary, deleteDriverSalary,
} from '@/lib/firestore-payroll-ops';
import type {
    VehicleRental, VehicleRentalFormData,
    DriverAdvance, DriverAdvanceFormData,
    DriverSalary, DriverSalaryFormData,
} from '@/types/payroll-ops';
import { ADVANCE_STATUS_LABELS, DRIVER_SALARY_STATUS_LABELS } from '@/types/payroll-ops';
import { formatRupiah } from '@/lib/currency';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { ArrowLeft, Car, Plus, Trash2, Edit2, X, Save, Printer, CreditCard, Wallet, CheckCircle2 } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];
const now = new Date();
const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

type Tab = 'rentals' | 'driver_advances' | 'driver_salaries';

// ── Rental Form ──
const EMPTY_RENTAL: VehicleRentalFormData = {
    vehicleName: '', driverName: '', startDate: today(), endDate: '', amount: 0, period: defaultPeriod, description: '',
};

// ── Driver Advance Form ──
const EMPTY_DA: DriverAdvanceFormData = { driverName: '', amount: 0, date: today(), description: '' };

// ── Driver Salary Form ──
const EMPTY_DS: DriverSalaryFormData = { driverName: '', period: defaultPeriod, baseSalary: 0, bonusAmount: 0, advanceDeduction: 0, notes: '' };

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
            {children}
        </div>
    );
}

const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-violet-200";

export default function DriversPage() {
    const router = useRouter();
    const [tab, setTab] = useState<Tab>('rentals');
    const [period, setPeriod] = useState(defaultPeriod);

    const [rentals, setRentals] = useState<VehicleRental[]>([]);
    const [driverAdv, setDriverAdv] = useState<DriverAdvance[]>([]);
    const [driverSal, setDriverSal] = useState<DriverSalary[]>([]);

    const [rentalForm, setRentalForm] = useState<VehicleRentalFormData>(EMPTY_RENTAL);
    const [editRentalId, setEditRentalId] = useState<string | null>(null);
    const [showRentalForm, setShowRentalForm] = useState(false);

    const [daForm, setDaForm] = useState<DriverAdvanceFormData>(EMPTY_DA);
    const [showDaForm, setShowDaForm] = useState(false);

    const [dsForm, setDsForm] = useState<DriverSalaryFormData>(EMPTY_DS);
    const [editDsId, setEditDsId] = useState<string | null>(null);
    const [showDsForm, setShowDsForm] = useState(false);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const u1 = subscribeToVehicleRentals(setRentals, period);
        const u2 = subscribeToDriverAdvances(setDriverAdv);
        const u3 = subscribeToDriverSalaries(setDriverSal, period);
        return () => { u1(); u2(); u3(); };
    }, [period]);

    // Rental handlers
    const openNewRental = () => { setEditRentalId(null); setRentalForm({ ...EMPTY_RENTAL, period }); setShowRentalForm(true); };
    const openEditRental = (r: VehicleRental) => {
        setEditRentalId(r.id);
        setRentalForm({ vehicleName: r.vehicleName, driverName: r.driverName || '', startDate: r.startDate, endDate: r.endDate || '', amount: r.amount, period: r.period, description: r.description || '' });
        setShowRentalForm(true);
    };
    const saveRental = async () => {
        if (!rentalForm.vehicleName || !rentalForm.amount) { alert('Isi nama kendaraan & jumlah sewa'); return; }
        setSaving(true);
        try {
            if (editRentalId) await updateVehicleRental(editRentalId, rentalForm as any);
            else await addVehicleRental(rentalForm);
            setShowRentalForm(false);
        } catch { alert('Gagal menyimpan'); }
        finally { setSaving(false); }
    };

    // Driver advance handlers
    const saveDa = async () => {
        if (!daForm.driverName || !daForm.amount || !daForm.description) { alert('Isi semua field'); return; }
        setSaving(true);
        try { await addDriverAdvance(daForm); setShowDaForm(false); setDaForm(EMPTY_DA); }
        catch { alert('Gagal menyimpan'); }
        finally { setSaving(false); }
    };

    // Driver salary handlers
    const openNewDs = () => { setEditDsId(null); setDsForm({ ...EMPTY_DS, period }); setShowDsForm(true); };
    const openEditDs = (s: DriverSalary) => {
        setEditDsId(s.id);
        setDsForm({ driverName: s.driverName, period: s.period, baseSalary: s.baseSalary, bonusAmount: s.bonusAmount, advanceDeduction: s.advanceDeduction, notes: s.notes || '' });
        setShowDsForm(true);
    };
    const saveDs = async () => {
        if (!dsForm.driverName || !dsForm.baseSalary) { alert('Isi nama sopir & gaji pokok'); return; }
        setSaving(true);
        try {
            if (editDsId) await updateDriverSalary(editDsId, dsForm as any);
            else await addDriverSalary(dsForm);
            setShowDsForm(false);
        } catch { alert('Gagal menyimpan'); }
        finally { setSaving(false); }
    };

    const printDriverSalary = (s: DriverSalary) => {
        const d = encodeURIComponent(JSON.stringify({ salary: s, period }));
        router.push(`/payroll/drivers/print?data=${d}`);
    };

    const TAB_STYLES = (t: Tab) => `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`;

    return (
        <ProtectedRoute>
            <div className="space-y-5 pb-20">
                {/* Header */}
                <div className="flex items-center gap-3 flex-wrap">
                    <Link href="/payroll" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
                        <ArrowLeft size={16} /> Kembali
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Car size={20} className="text-violet-600" /> Sewa Mobil & Sopir
                        </h1>
                        <p className="text-xs text-gray-500">Kelola sewa kendaraan, bon sopir, dan gaji sopir</p>
                    </div>
                </div>

                {/* Period + tabs */}
                <div className="flex items-center gap-3 flex-wrap">
                    <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none" />
                    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                        <button className={TAB_STYLES('rentals')} onClick={() => setTab('rentals')}>🚗 Sewa Mobil</button>
                        <button className={TAB_STYLES('driver_advances')} onClick={() => setTab('driver_advances')}>💳 Bon Sopir</button>
                        <button className={TAB_STYLES('driver_salaries')} onClick={() => setTab('driver_salaries')}>💰 Gaji Sopir</button>
                    </div>
                </div>

                {/* ── RENTALS TAB ── */}
                {tab === 'rentals' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-bold text-gray-700">Sewa Kendaraan</p>
                                <p className="text-xs text-gray-400">Total: {formatRupiah(rentals.reduce((s, r) => s + r.amount, 0))}</p>
                            </div>
                            <button onClick={openNewRental} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-600/20 transition-all">
                                <Plus size={14} /> Tambah
                            </button>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                            {rentals.length === 0 && <div className="p-10 text-center text-gray-400 text-sm"><Car size={32} className="mx-auto mb-3 opacity-30" />Belum ada data sewa</div>}
                            {rentals.map(r => (
                                <div key={r.id} className="px-4 py-4 flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-800">{r.vehicleName}</p>
                                        {r.driverName && <p className="text-xs text-gray-500">Sopir: {r.driverName}</p>}
                                        <p className="text-xs text-gray-400">{r.startDate}{r.endDate ? ` s/d ${r.endDate}` : ''} {r.description && `· ${r.description}`}</p>
                                    </div>
                                    <p className="font-bold text-violet-700 text-sm shrink-0">{formatRupiah(r.amount)}</p>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => openEditRental(r)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Edit2 size={13} /></button>
                                        <button onClick={() => { if (confirm('Hapus?')) deleteVehicleRental(r.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── DRIVER ADVANCES TAB ── */}
                {tab === 'driver_advances' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-bold text-gray-700">Bon Sopir</p>
                                <p className="text-xs text-gray-400">Aktif: {formatRupiah(driverAdv.filter(a => a.status === 'active').reduce((s, a) => s + a.amount, 0))}</p>
                            </div>
                            <button onClick={() => { setDaForm(EMPTY_DA); setShowDaForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-amber-500/20 transition-all">
                                <Plus size={14} /> Tambah Bon
                            </button>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                            {driverAdv.length === 0 && <div className="p-10 text-center text-gray-400 text-sm"><CreditCard size={32} className="mx-auto mb-3 opacity-30" />Belum ada bon sopir</div>}
                            {driverAdv.map(a => (
                                <div key={a.id} className="px-4 py-4 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-800">{a.driverName}</p>
                                        <p className="text-xs text-gray-500">{a.description} · {new Date(a.date).toLocaleDateString('id-ID')}</p>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${a.status === 'active' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>{ADVANCE_STATUS_LABELS[a.status]}</span>
                                    </div>
                                    <p className="font-bold text-amber-700 shrink-0">{formatRupiah(a.amount)}</p>
                                    {a.status === 'active' && <button onClick={() => updateDriverAdvance(a.id, { status: 'deducted' })} title="Tandai dipotong" className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><CheckCircle2 size={14} /></button>}
                                    <button onClick={() => { if (confirm('Hapus?')) deleteDriverAdvance(a.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── DRIVER SALARIES TAB ── */}
                {tab === 'driver_salaries' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-bold text-gray-700">Gaji Sopir</p>
                                <p className="text-xs text-gray-400">Total: {formatRupiah(driverSal.reduce((s, r) => s + r.netPay, 0))}</p>
                            </div>
                            <button onClick={openNewDs} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-600/20 transition-all">
                                <Plus size={14} /> Tambah Gaji
                            </button>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                            {driverSal.length === 0 && <div className="p-10 text-center text-gray-400 text-sm"><Wallet size={32} className="mx-auto mb-3 opacity-30" />Belum ada data gaji sopir</div>}
                            {driverSal.map(s => (
                                <div key={s.id} className="px-4 py-4 flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-sm text-gray-800">{s.driverName}</p>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{DRIVER_SALARY_STATUS_LABELS[s.status]}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">Gaji: {formatRupiah(s.baseSalary)}{s.bonusAmount > 0 ? ` + Bonus: ${formatRupiah(s.bonusAmount)}` : ''}{s.advanceDeduction > 0 ? ` - Bon: ${formatRupiah(s.advanceDeduction)}` : ''}</p>
                                        {s.notes && <p className="text-xs text-gray-400">{s.notes}</p>}
                                    </div>
                                    <p className="font-bold text-violet-700 text-sm shrink-0">{formatRupiah(s.netPay)}</p>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => printDriverSalary(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Printer size={13} /></button>
                                        <button onClick={() => openEditDs(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Edit2 size={13} /></button>
                                        {s.status === 'unpaid' && <button onClick={() => updateDriverSalary(s.id, { status: 'paid', paidAt: new Date() })} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 size={14} /></button>}
                                        <button onClick={() => { if (confirm('Hapus?')) deleteDriverSalary(s.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── RENTAL FORM MODAL ── */}
                {showRentalForm && (
                    <Modal title={editRentalId ? 'Edit Sewa Mobil' : 'Tambah Sewa Mobil'} onClose={() => setShowRentalForm(false)}>
                        <div className="space-y-3">
                            <Field label="Nama/Plat Kendaraan"><input className={inputCls} placeholder="Mis: Fuso B 1234 XY" value={rentalForm.vehicleName} onChange={e => setRentalForm(f => ({ ...f, vehicleName: e.target.value }))} /></Field>
                            <Field label="Nama Sopir (opsional)"><input className={inputCls} placeholder="Nama sopir..." value={rentalForm.driverName} onChange={e => setRentalForm(f => ({ ...f, driverName: e.target.value }))} /></Field>
                            <div className="grid grid-cols-2 gap-2">
                                <Field label="Mulai Sewa"><input type="date" className={inputCls} value={rentalForm.startDate} onChange={e => setRentalForm(f => ({ ...f, startDate: e.target.value }))} /></Field>
                                <Field label="Selesai (opsional)"><input type="date" className={inputCls} value={rentalForm.endDate} onChange={e => setRentalForm(f => ({ ...f, endDate: e.target.value }))} /></Field>
                            </div>
                            <Field label="Total Biaya Sewa (Rp)"><input type="number" min={0} className={inputCls} placeholder="0" value={rentalForm.amount || ''} onChange={e => setRentalForm(f => ({ ...f, amount: Number(e.target.value) }))} /></Field>
                            <Field label="Keterangan"><input className={inputCls} placeholder="Keterangan tambahan..." value={rentalForm.description} onChange={e => setRentalForm(f => ({ ...f, description: e.target.value }))} /></Field>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setShowRentalForm(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm">Batal</button>
                            <button onClick={saveRental} disabled={saving} className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                                {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </Modal>
                )}

                {/* ── DRIVER ADVANCE FORM MODAL ── */}
                {showDaForm && (
                    <Modal title="Tambah Bon Sopir" onClose={() => setShowDaForm(false)}>
                        <div className="space-y-3">
                            <Field label="Nama Sopir"><input className={inputCls} placeholder="Nama sopir..." value={daForm.driverName} onChange={e => setDaForm(f => ({ ...f, driverName: e.target.value }))} /></Field>
                            <Field label="Jumlah (Rp)"><input type="number" min={0} className={inputCls} value={daForm.amount || ''} onChange={e => setDaForm(f => ({ ...f, amount: Number(e.target.value) }))} /></Field>
                            <Field label="Tanggal"><input type="date" className={inputCls} value={daForm.date} onChange={e => setDaForm(f => ({ ...f, date: e.target.value }))} /></Field>
                            <Field label="Keterangan"><input className={inputCls} placeholder="Keperluan bon..." value={daForm.description} onChange={e => setDaForm(f => ({ ...f, description: e.target.value }))} /></Field>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setShowDaForm(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm">Batal</button>
                            <button onClick={saveDa} disabled={saving} className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                                {saving ? 'Menyimpan...' : 'Simpan Bon'}
                            </button>
                        </div>
                    </Modal>
                )}

                {/* ── DRIVER SALARY FORM MODAL ── */}
                {showDsForm && (
                    <Modal title={editDsId ? 'Edit Gaji Sopir' : 'Tambah Gaji Sopir'} onClose={() => setShowDsForm(false)}>
                        <div className="space-y-3">
                            <Field label="Nama Sopir"><input className={inputCls} placeholder="Nama sopir..." value={dsForm.driverName} onChange={e => setDsForm(f => ({ ...f, driverName: e.target.value }))} /></Field>
                            <Field label="Gaji Pokok (Rp)"><input type="number" min={0} className={inputCls} value={dsForm.baseSalary || ''} onChange={e => setDsForm(f => ({ ...f, baseSalary: Number(e.target.value) }))} /></Field>
                            <div className="grid grid-cols-2 gap-2">
                                <Field label="Bonus (Rp)"><input type="number" min={0} className={inputCls} value={dsForm.bonusAmount || ''} onChange={e => setDsForm(f => ({ ...f, bonusAmount: Number(e.target.value) }))} /></Field>
                                <Field label="Potongan Bon (Rp)"><input type="number" min={0} className={inputCls} value={dsForm.advanceDeduction || ''} onChange={e => setDsForm(f => ({ ...f, advanceDeduction: Number(e.target.value) }))} /></Field>
                            </div>
                            <div className="bg-violet-50 rounded-xl px-3 py-2 flex justify-between text-sm">
                                <span className="text-gray-600">Total Diterima</span>
                                <span className="font-bold text-violet-700">{formatRupiah(Math.max(0, dsForm.baseSalary + dsForm.bonusAmount - dsForm.advanceDeduction))}</span>
                            </div>
                            <Field label="Catatan"><input className={inputCls} placeholder="Catatan opsional..." value={dsForm.notes} onChange={e => setDsForm(f => ({ ...f, notes: e.target.value }))} /></Field>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setShowDsForm(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm">Batal</button>
                            <button onClick={saveDs} disabled={saving} className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                                {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </Modal>
                )}
            </div>
        </ProtectedRoute>
    );
}
