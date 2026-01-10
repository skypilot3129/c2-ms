'use client';

import { useState, useEffect } from 'react';
import { Users, Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getAttendanceByDate, subscribeToTodayAttendance } from '@/lib/firestore-attendance';
import { getEmployees } from '@/lib/firestore-employees';
import type { Attendance } from '@/types/attendance';
import type { Employee } from '@/types/employee';
import { ATTENDANCE_STATUS_LABELS, SHIFT_TYPE_LABELS } from '@/types/attendance';

export default function AttendanceDashboard() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    // Load employees
    useEffect(() => {
        loadEmployees();
    }, []);

    // Load attendance data
    useEffect(() => {
        const isToday = selectedDate === new Date().toISOString().split('T')[0];

        if (isToday) {
            // Subscribe to real-time updates for today
            const unsubscribe = subscribeToTodayAttendance((data) => {
                setAttendances(data);
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            // One-time fetch for historical dates
            loadAttendance();
        }
    }, [selectedDate]);

    const loadEmployees = async () => {
        try {
            const data = await getEmployees();
            setEmployees(data);
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    };

    const loadAttendance = async () => {
        setLoading(true);
        try {
            const data = await getAttendanceByDate(selectedDate);
            setAttendances(data);
        } catch (error) {
            console.error('Error loading attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    // Get employee name by ID
    const getEmployeeName = (employeeId: string) => {
        const emp = employees.find(e => e.id === employeeId);
        return emp ? emp.fullName : 'Unknown';
    };

    // Get employee role by ID
    const getEmployeeRole = (employeeId: string) => {
        const emp = employees.find(e => e.id === employeeId);
        return emp ? emp.role : '';
    };

    // Create map of employee IDs who have checked in
    const checkedInEmployeeIds = new Set(attendances.map(a => a.employeeId));

    // Get absent employees
    const absentEmployees = employees.filter(emp =>
        emp.status === 'active' && !checkedInEmployeeIds.has(emp.id)
    );

    // Statistics
    const stats = {
        total: employees.filter(e => e.status === 'active').length,
        present: attendances.filter(a => a.status === 'present').length,
        late: attendances.filter(a => a.status === 'late').length,
        absent: absentEmployees.length
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Dashboard Absensi</h2>
                    <p className="text-sm text-gray-500">Monitor kehadiran karyawan</p>
                </div>

                <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-gray-400" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-2 border rounded-lg"
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                        <Users size={20} className="text-gray-400" />
                    </div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-gray-500">Total Karyawan</div>
                </div>

                <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                        <CheckCircle size={20} className="text-green-500" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                    <div className="text-sm text-gray-500">Hadir</div>
                </div>

                <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                        <AlertCircle size={20} className="text-yellow-500" />
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
                    <div className="text-sm text-gray-500">Terlambat</div>
                </div>

                <div className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                        <XCircle size={20} className="text-red-500" />
                    </div>
                    <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
                    <div className="text-sm text-gray-500">Tidak Hadir</div>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                    <h3 className="font-semibold">Daftar Kehadiran</h3>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Karyawan</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Check-In</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Check-Out</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Total Jam</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Overtime</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {attendances.map((att) => {
                                    const firstShift = att.shifts[0];
                                    const lastShift = att.shifts[att.shifts.length - 1];

                                    return (
                                        <tr key={att.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <div className="font-medium">{getEmployeeName(att.employeeId)}</div>
                                                    <div className="text-xs text-gray-500 capitalize">{getEmployeeRole(att.employeeId)}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${att.status === 'present' ? 'bg-green-100 text-green-800' :
                                                        att.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                                            att.status === 'leave' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {ATTENDANCE_STATUS_LABELS[att.status]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {firstShift && (
                                                    <div>
                                                        <div className="font-medium">{formatTime(firstShift.checkIn)}</div>
                                                        <div className="text-xs text-gray-500">{SHIFT_TYPE_LABELS[firstShift.type]}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {lastShift?.checkOut ? (
                                                    <div className="font-medium">{formatTime(lastShift.checkOut)}</div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">Belum checkout</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-medium">{att.totalHours.toFixed(1)} jam</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {att.overtimeCount > 0 ? (
                                                    <span className="text-orange-600 font-medium">{att.overtimeCount}x</span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* Show absent employees */}
                                {absentEmployees.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-gray-50 opacity-60">
                                        <td className="px-4 py-3">
                                            <div>
                                                <div className="font-medium">{emp.fullName}</div>
                                                <div className="text-xs text-gray-500 capitalize">{emp.role}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                Tidak Hadir
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">-</td>
                                        <td className="px-4 py-3 text-gray-400">-</td>
                                        <td className="px-4 py-3 text-gray-400">-</td>
                                        <td className="px-4 py-3 text-gray-400">-</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
