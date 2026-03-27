'use client';

import { useState, useEffect } from 'react';
import { Users, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Pickaxe, Package, Shield, Truck, Edit, Trash2, X, Save } from 'lucide-react';
import { getAttendanceByDate, subscribeToTodayAttendance, deleteAttendanceRecord, updateAttendanceRecord } from '@/lib/firestore-attendance';
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
                    <h2 className="text-2xl font-bold text-gray-900">Dashboard Monitor</h2>
                    <p className="text-sm text-gray-500">Pantau kehadiran dan aktivitas kerja secara live</p>
                </div>

                <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-gray-400" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                        <Users size={20} className="text-gray-400" />
                    </div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-gray-500">Total Aktif</div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100 bg-gradient-to-br from-white to-green-50/50">
                    <div className="flex items-center justify-between mb-2">
                        <CheckCircle size={20} className="text-green-500" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                    <div className="text-sm text-gray-500">Hadir Tepat Waktu</div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-yellow-100 bg-gradient-to-br from-white to-yellow-50/50">
                    <div className="flex items-center justify-between mb-2">
                        <AlertCircle size={20} className="text-yellow-500" />
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
                    <div className="text-sm text-gray-500">Terlambat</div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100 bg-gradient-to-br from-white to-red-50/50">
                    <div className="flex items-center justify-between mb-2">
                        <XCircle size={20} className="text-red-500" />
                    </div>
                    <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
                    <div className="text-sm text-gray-500">Tidak Hadir</div>
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
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b bg-gray-50">
                            <h3 className="font-bold text-gray-800">Detail Personel Hadir</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50">
                            {attendances.map((att) => {
                                const activity = getEmployeeActivityStatus(att.employeeId);
                                const lastShift = att.shifts[att.shifts.length - 1];
                                
                                return (
                                    <div key={att.id} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-bold text-gray-900">{getEmployeeName(att.employeeId)}</h4>
                                                <p className="text-xs text-gray-500 capitalize">{getEmployeeRole(att.employeeId)}</p>
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
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded bg-blue-50 border border-blue-100"
                                                            title="Edit Absensi"
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        {role === 'admin' && (
                                                            <button
                                                                onClick={() => handleDelete(att)}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded bg-red-50 border border-red-100"
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
                                        <div className={`mt-3 mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${activity.color}`}>
                                            {activity.icon}
                                            {activity.label}
                                        </div>

                                        <div className="flex justify-between items-center text-sm pt-3 border-t border-gray-100 text-gray-500">
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
                            <div className="py-12 text-center text-gray-500">Belum ada absen kehadiran hari ini.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingAtt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="font-bold text-gray-800">Edit Absensi</h2>
                            <button onClick={() => setEditingAtt(null)} className="text-gray-500 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100">
                                <p className="font-bold">{getEmployeeName(editingAtt.employeeId)}</p>
                                <p className="text-sm opacity-80">{selectedDate}</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status Kehadiran</label>
                                <select 
                                    value={editStatus}
                                    onChange={e => setEditStatus(e.target.value as any)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                    {Object.entries(ATTENDANCE_STATUS_LABELS).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                                <textarea 
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                    placeholder="Alasan telat, sakit, dll."
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
                            <button 
                                onClick={() => setEditingAtt(null)}
                                className="px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-100"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Save size={18} />
                                {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

