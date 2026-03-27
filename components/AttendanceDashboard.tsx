'use client';

import { useState, useEffect } from 'react';
import { Users, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Pickaxe, Package, Shield, Truck, Edit, Trash2, X, Save, Plus } from 'lucide-react';
import { getAttendanceByDate, subscribeToTodayAttendance, deleteAttendanceRecord, updateAttendanceRecord, addManualAttendance } from '@/lib/firestore-attendance';
import { getEmployees } from '@/lib/firestore-employees';
import { subscribeToDailyOperations } from '@/lib/firestore-operations';
import type { Attendance } from '@/types/attendance';
import type { Employee } from '@/types/employee';
import type { TruckOperation } from '@/types/truck-operation';
import { ATTENDANCE_STATUS_LABELS, SHIFT_TYPE_LABELS } from '@/types/attendance';
import { useAuth } from '@/context/AuthContext';

export default function AttendanceDashboard() {
    const { role } = useAuth();
    const isManager = ['admin', 'pengurus'].includes(role);

    const [todayStr] = useState(new Date().toISOString().split('T')[0]);
    const [selectedDate, setSelectedDate] = useState(todayStr);
    
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [operations, setOperations] = useState<TruckOperation[]>([]);
    const [loading, setLoading] = useState(true);

    // Editing State
    const [editingAtt, setEditingAtt] = useState<Attendance | null>(null);
    const [editStatus, setEditStatus] = useState<Attendance['status']>('present');
    const [editNotes, setEditNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Manual Add State
    const [isManualAddOpen, setIsManualAddOpen] = useState(false);
    const [manualEmpId, setManualEmpId] = useState('');
    const [manualTimeIn, setManualTimeIn] = useState('08:00');
    const [manualTimeOut, setManualTimeOut] = useState('');
    const [manualStatus, setManualStatus] = useState<Attendance['status']>('present');
    const [manualNotes, setManualNotes] = useState('');
    const [addingManual, setAddingManual] = useState(false);

    const handleAddManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualEmpId || !manualTimeIn) return;
        setAddingManual(true);
        try {
            await addManualAttendance(
                manualEmpId,
                selectedDate,
                manualTimeIn,
                manualTimeOut || null,
                manualStatus,
                manualNotes
            );
            setIsManualAddOpen(false);
            setManualEmpId('');
            setManualTimeOut('');
            setManualNotes('');
            // Optional: refresh if past date
            if (selectedDate !== todayStr) {
                const data = await getAttendanceByDate(selectedDate);
                setAttendances(data);
            }
        } catch (error) {
            alert('Gagal menambahkan absensi manual.');
        } finally {
            setAddingManual(false);
        }
    };

    const handleEditClick = (att: Attendance) => {
        setEditingAtt(att);
        setEditStatus(att.status);
        setEditNotes(att.notes || '');
    };

    const handleSaveEdit = async () => {
        if (!editingAtt || !editingAtt.id) return;
        setSaving(true);
        try {
            await updateAttendanceRecord(editingAtt.id, {
                status: editStatus,
                notes: editNotes,
            });
            setEditingAtt(null);
            if (selectedDate !== todayStr) {
                // Manually refresh if looking at past date
                const data = await getAttendanceByDate(selectedDate);
                setAttendances(data);
            }
        } catch (error) {
            alert('Gagal menyimpan data.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (att: Attendance) => {
        if (!att.id) return;
        if (!confirm(`Hapus data absensi ini secara permanen?`)) return;
        try {
            await deleteAttendanceRecord(att.id);
            if (selectedDate !== todayStr) {
                const data = await getAttendanceByDate(selectedDate);
                setAttendances(data);
            }
        } catch (error) {
            alert('Gagal menghapus data.');
        }
    };

    // Initial Load for Employees
    useEffect(() => {
        getEmployees().then(data => setEmployees(data)).catch(console.error);
    }, []);

    // Load Attendance & Operations Data
    useEffect(() => {
        const isToday = selectedDate === todayStr;

        let unsubOperations = () => {};
        let unsubAttendance = () => {};

        setLoading(true);

        if (isToday) {
            unsubAttendance = subscribeToTodayAttendance((data) => {
                setAttendances(data);
                setLoading(false);
            });
            
            unsubOperations = subscribeToDailyOperations(todayStr, (ops) => {
                setOperations(ops);
            });
        } else {
            getAttendanceByDate(selectedDate).then(data => {
                setAttendances(data);
                setLoading(false);
            });
            // Historic operations could be fetched here, but we focus on live real-time
            setOperations([]); 
        }

        return () => {
            unsubAttendance();
            unsubOperations();
        };
    }, [selectedDate, todayStr]);

    const getEmployeeName = (employeeId: string) => {
        const emp = employees.find(e => e.employeeId === employeeId);
        return emp ? emp.fullName : 'Unknown';
    };

    const getEmployeeRole = (employeeId: string) => {
        const emp = employees.find(e => e.employeeId === employeeId);
        return emp ? emp.role : '';
    };

    const checkedInEmployeeIds = new Set(attendances.map(a => a.employeeId));
    const absentEmployees = employees.filter(emp => emp.status === 'active' && !checkedInEmployeeIds.has(emp.employeeId));

    const stats = {
        total: employees.filter(e => e.status === 'active').length,
        present: attendances.filter(a => a.status === 'present').length,
        late: attendances.filter(a => a.status === 'late').length,
        absent: absentEmployees.length
    };

    const formatTime = (date: Date) => date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    // Determine employee's current real-time activity state
    const getEmployeeActivityStatus = (employeeId: string) => {
        const activeOps = operations.filter(op => op.status === 'loading');
        
        for (const op of activeOps) {
            if (op.stackerIds.includes(employeeId)) {
                return { type: 'stacking', label: `Sedang Susun (${op.truckNumber})`, color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <Pickaxe size={14} /> };
            }
            if (op.loaderIds.includes(employeeId)) {
                return { type: 'loading', label: `Sedang Muat (${op.truckNumber})`, color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Package size={14} /> };
            }
            if (op.escortId === employeeId) {
                return { type: 'escort', label: `Mengawal (${op.truckNumber})`, color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Shield size={14} /> };
            }
        }
        
        // Check if checked out
        const att = attendances.find(a => a.employeeId === employeeId);
        const lastShift = att?.shifts[att.shifts.length - 1];
        if (lastShift?.checkOut) {
            return { type: 'done', label: 'Selesai Shift', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: <CheckCircle size={14} /> };
        }
        
        return { type: 'standby', label: 'Standby', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={14} /> };
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard Monitor</h2>
                    <p className="text-gray-500 mt-1">Pantau kehadiran dan aktivitas kerja operasional hari ini</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm transition-all hover:border-blue-300">
                        <Calendar size={18} className="text-blue-500" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 outline-none text-gray-700 font-medium cursor-pointer"
                        />
                    </div>
                    {isManager && (
                        <button
                            onClick={() => setIsManualAddOpen(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-blue-500/20 active:scale-95 border border-blue-600 hover:border-blue-700"
                        >
                            <Plus size={18} />
                            <span className="hidden sm:inline">Tambah Absen</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50/50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-600 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            <Users size={24} />
                        </div>
                    </div>
                    <div className="text-4xl font-black text-gray-800 relative z-10 tabular-nums">{stats.total}</div>
                    <div className="text-sm font-semibold text-gray-500 mt-1 relative z-10">Total Karyawan</div>
                </div>

                <div className="bg-white p-5 rounded-3xl shadow-sm border border-green-100 bg-gradient-to-b from-white to-green-50/30 hover:shadow-md hover:shadow-green-500/10 hover:border-green-200 transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-100/50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center shadow-inner group-hover:bg-green-500 group-hover:text-white transition-colors">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                    <div className="text-4xl font-black text-green-600 relative z-10 tabular-nums">{stats.present}</div>
                    <div className="text-sm font-semibold text-gray-500 mt-1 relative z-10">Hadir Tepat Waktu</div>
                </div>

                <div className="bg-white p-5 rounded-3xl shadow-sm border border-yellow-100 bg-gradient-to-b from-white to-yellow-50/30 hover:shadow-md hover:shadow-yellow-500/10 hover:border-yellow-200 transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-100/50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-yellow-100 text-yellow-600 flex items-center justify-center shadow-inner group-hover:bg-yellow-500 group-hover:text-white transition-colors">
                            <AlertCircle size={24} />
                        </div>
                    </div>
                    <div className="text-4xl font-black text-yellow-600 relative z-10 tabular-nums">{stats.late}</div>
                    <div className="text-sm font-semibold text-gray-500 mt-1 relative z-10">Terlambat Datang</div>
                </div>

                <div className="bg-white p-5 rounded-3xl shadow-sm border border-red-100 bg-gradient-to-b from-white to-red-50/30 hover:shadow-md hover:shadow-red-500/10 hover:border-red-200 transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-100/50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner group-hover:bg-red-500 group-hover:text-white transition-colors">
                            <XCircle size={24} />
                        </div>
                    </div>
                    <div className="text-4xl font-black text-red-600 relative z-10 tabular-nums">{stats.absent}</div>
                    <div className="text-sm font-semibold text-gray-500 mt-1 relative z-10">Belum Hadir / Absen</div>
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border">
                    Menghubungkan ke server...
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Active Trucks Panel */}
                    {(selectedDate === todayStr) && operations.filter(o => o.status === 'loading').length > 0 && (
                        <div className="bg-blue-600 rounded-xl shadow-md overflow-hidden text-white">
                            <div className="p-4 bg-blue-700/50 border-b border-blue-500/50 flex items-center justify-between">
                                <h3 className="font-bold flex items-center gap-2">
                                    <Truck size={20} />
                                    Truk Sedang Pemuatan
                                </h3>
                                <span className="flex items-center gap-2 text-sm font-medium bg-blue-500 px-3 py-1 rounded-full animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-white"></span>
                                    {operations.filter(o => o.status === 'loading').length} Aktif
                                </span>
                            </div>
                            <div className="p-4 grid md:grid-cols-2 gap-4">
                                {operations.filter(o => o.status === 'loading').map(op => (
                                    <div key={op.id} className="bg-white/10 rounded-lg p-4 border border-white/20">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-bold text-lg">{op.truckNumber}</span>
                                            <span className="text-blue-200 text-sm">Mulai: {op.startTime ? formatTime(op.startTime) : '-'}</span>
                                        </div>
                                        <div className="text-sm text-blue-100 space-y-1">
                                            <p><span className="opacity-70">Penyusun:</span> {op.stackerIds.map(getEmployeeName).join(', ')}</p>
                                            <p><span className="opacity-70">Tim Muat:</span> {op.loaderIds.length} orang</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Employee Grid */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 bg-white flex items-center justify-between">
                            <h3 className="font-bold text-lg text-gray-800">Detail Personel Hadir</h3>
                            <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full text-xs border border-blue-100">
                                {attendances.length} Orang
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5 bg-gray-50">
                            {attendances.map((att) => {
                                const activity = getEmployeeActivityStatus(att.employeeId);
                                const lastShift = att.shifts[att.shifts.length - 1];
                                
                                return (
                                    <div key={att.id} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 font-bold flex items-center justify-center shrink-0 border border-blue-200 shadow-inner group-hover:scale-110 transition-transform">
                                                    {getInitials(getEmployeeName(att.employeeId))}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 truncate">{getEmployeeName(att.employeeId)}</h4>
                                                    <p className="text-xs font-medium text-gray-400 capitalize bg-gray-100 inline-block px-2 py-0.5 rounded-full mt-1 border border-gray-200">
                                                        {getEmployeeRole(att.employeeId)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded ${
                                                    att.status === 'present' ? 'bg-green-100 text-green-700' :
                                                    att.status === 'late' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {ATTENDANCE_STATUS_LABELS[att.status]}
                                                </span>
                                                {isManager && (
                                                    <div className="flex gap-1 mt-1">
                                                        <button
                                                            onClick={() => handleEditClick(att)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg bg-blue-50 border border-blue-100 transition-colors"
                                                            title="Edit Absensi"
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        {role === 'admin' && (
                                                            <button
                                                                onClick={() => handleDelete(att)}
                                                                className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg bg-red-50 border border-red-100 transition-colors"
                                                                title="Hapus Absensi"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Realtime Activity Badge */}
                                        <div className={`mb-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-colors ${activity.color}`}>
                                            {activity.icon}
                                            {activity.label}
                                        </div>

                                        <div className="flex justify-between items-center text-sm pt-4 border-t border-gray-100 text-gray-600 font-medium">
                                            <div className="flex items-center gap-1">
                                                <Clock size={14} className="text-green-500" />
                                                <span>{att.shifts[0] ? formatTime(att.shifts[0].checkIn) : '-'}</span>
                                            </div>
                                            <div>-</div>
                                            <div className="flex items-center gap-1">
                                                <span>{lastShift?.checkOut ? formatTime(lastShift.checkOut) : '...'}</span>
                                                <Clock size={14} className={lastShift?.checkOut ? 'text-blue-500' : 'text-gray-300'} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {attendances.length === 0 && (
                            <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center">
                                <AlertCircle size={40} className="text-gray-300 mb-3" />
                                <p className="font-medium text-lg text-gray-400">Belum ada absen kehadiran hari ini.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Manual Add Modal */}
            {isManualAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="font-bold text-xl text-gray-800">Tambah Absensi Manual</h2>
                            <button onClick={() => setIsManualAddOpen(false)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddManual}>
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Karyawan</label>
                                    <select 
                                        required
                                        value={manualEmpId}
                                        onChange={e => setManualEmpId(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                                    >
                                        <option value="">Pilih Karyawan...</option>
                                        {employees.filter(e => e.status === 'active' && !checkedInEmployeeIds.has(e.employeeId)).map(emp => (
                                            <option key={emp.employeeId} value={emp.employeeId}>{emp.fullName} ({emp.role})</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Jam Masuk <span className="text-red-500">*</span></label>
                                        <input 
                                            type="time" 
                                            required
                                            value={manualTimeIn}
                                            onChange={e => setManualTimeIn(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Jam Keluar</label>
                                        <input 
                                            type="time" 
                                            value={manualTimeOut}
                                            onChange={e => setManualTimeOut(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status Kehadiran</label>
                                    <select 
                                        value={manualStatus}
                                        onChange={e => setManualStatus(e.target.value as any)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                                    >
                                        {Object.entries(ATTENDANCE_STATUS_LABELS).map(([val, label]) => (
                                            <option key={val} value={val}>{label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Catatan</label>
                                    <textarea 
                                        value={manualNotes}
                                        onChange={e => setManualNotes(e.target.value)}
                                        rows={2}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-colors outline-none resize-none"
                                        placeholder="Alasan diset manual, telat, izin, dll."
                                    />
                                </div>
                            </div>
                            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                                <button 
                                    type="button"
                                    onClick={() => setIsManualAddOpen(false)}
                                    className="px-5 py-2.5 text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    disabled={addingManual || !manualEmpId || !manualTimeIn}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 font-medium text-white rounded-xl hover:bg-blue-700 flex-1 justify-center disabled:opacity-50 transition-colors shadow-sm hover:shadow-blue-500/20"
                                >
                                    {addingManual ? 'Menyimpan...' : 'Simpan Absensi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingAtt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="font-bold text-xl text-gray-800">Edit Absensi</h2>
                            <button onClick={() => setEditingAtt(null)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold">
                                    {getInitials(getEmployeeName(editingAtt.employeeId))}
                                </div>
                                <div>
                                    <p className="font-extrabold">{getEmployeeName(editingAtt.employeeId)}</p>
                                    <p className="text-sm opacity-80 font-medium">{selectedDate}</p>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status Kehadiran</label>
                                <select 
                                    value={editStatus}
                                    onChange={e => setEditStatus(e.target.value as any)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                                >
                                    {Object.entries(ATTENDANCE_STATUS_LABELS).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Catatan</label>
                                <textarea 
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-colors outline-none resize-none"
                                    placeholder="Alasan telat, sakit, dll."
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                            <button 
                                onClick={() => setEditingAtt(null)}
                                className="px-5 py-2.5 text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 font-medium text-white rounded-xl hover:bg-blue-700 flex-1 justify-center disabled:opacity-50 transition-colors shadow-sm hover:shadow-blue-500/20"
                            >
                                <Save size={18} />
                                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

