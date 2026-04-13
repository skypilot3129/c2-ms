'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Download, TrendingUp, Clock, Users, AlertCircle, ChevronDown, ChevronUp, CheckCircle, Printer } from 'lucide-react';
import type { Attendance, AttendanceStatus } from '@/types/attendance';
import { ATTENDANCE_STATUS_LABELS } from '@/types/attendance';
import type { Employee } from '@/types/employee';
import {
    calculateAttendanceStats,
    type AttendanceStats
} from '@/lib/reports-helper';
import { getEmployeeAttendance, updateAttendanceStatus } from '@/lib/firestore-attendance';

interface AttendanceReportProps {
    employees: Employee[];
}

export default function AttendanceReport({ employees }: AttendanceReportProps) {
    const router = useRouter();
    
    // Default 1st day of current month to today
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    const [stats, setStats] = useState<AttendanceStats | null>(null);
    const [rawAttendances, setRawAttendances] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

    useEffect(() => {
        loadAttendanceData();
    }, [startDate, endDate, employees]);

    const loadAttendanceData = async () => {
        setLoading(true);
        try {
            // Fetch attendance for all employees using custom date range
            const allAttendances: Attendance[] = [];
            for (const emp of employees) {
                const empAttendances = await getEmployeeAttendance(emp.employeeId, startDate, endDate);
                allAttendances.push(...empAttendances);
            }

            const calculatedStats = calculateAttendanceStats(allAttendances, employees, startDate, endDate);
            setStats(calculatedStats);
            setRawAttendances(allAttendances);
        } catch (error) {
            console.error('Error loading attendance data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        if (stats) {
            const dataToPrint = {
                periodTitle: stats.period,
                stats,
                rawAttendances, // Include raw daily data
            };
            sessionStorage.setItem('attendance_print_data', JSON.stringify(dataToPrint));
            router.push(`/attendance/admin/print`);
        }
    };

    const handleOverrideStatus = async (empId: string, date: string, newStatus: AttendanceStatus) => {
        // Confirmation based on status
        let confirmMsg = 'Anda yakin ingin mengubah status absensi pada tanggal ini?';
        if (newStatus === 'present') confirmMsg = 'Tolerir keterlambatan dan anggap Hadir tepat waktu?';
        else if (newStatus === 'late_mild') confirmMsg = 'Ubah status menjadi Telat Ringan?';
        else if (newStatus === 'late_severe') confirmMsg = 'Ubah status menjadi Telat Berat?';
        else if (newStatus === 'absent') confirmMsg = 'Ubah status menjadi Alpha (Tidak Hadir)?';

        if (confirm(confirmMsg)) {
            try {
                await updateAttendanceStatus(empId, date, newStatus, 'Diubah manual oleh Admin');
                await loadAttendanceData(); // reload
            } catch (error) {
                alert('Gagal memperbarui status');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Memuat Laporan Absensi...</p>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-500">Tidak ada data absensi untuk periode ini</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Calendar className="text-blue-600" size={24} />
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Laporan Kehadiran Karyawan</h2>
                        <p className="text-sm text-gray-500">{stats.period}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="self-center text-gray-500 font-medium text-sm">s.d</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Printer size={18} />
                        Cetak PDF
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Calendar size={20} className="text-blue-600" />
                        </div>
                        <p className="text-sm text-gray-500">Total Hari Kerja</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalWorkingDays}</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <TrendingUp size={20} className="text-emerald-600" />
                        </div>
                        <p className="text-sm text-gray-500">Tingkat Absensi</p>
                    </div>
                    <p className="text-3xl font-bold text-emerald-600">{stats.attendanceRate.toFixed(1)}%</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Clock size={20} className="text-purple-600" />
                        </div>
                        <p className="text-sm text-gray-500">Sesi Lembur Kegiatan</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalOvertimeEvents}</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <AlertCircle size={20} className="text-amber-600" />
                        </div>
                        <p className="text-sm text-gray-500">Check-in Terlambat</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalLateCheckins}</p>
                </div>
            </div>

            {/* Employee Breakdown Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Users size={20} className="text-blue-600" />
                        Kinerja per Karyawan
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Ketuk/klik baris karyawan untuk melihat rincian presensi hariannya dan memberi kelonggaran.</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600 w-[200px]">Nama Karyawan</th>
                                <th className="px-3 py-3 text-center text-sm font-medium text-gray-600">Hadir</th>
                                <th className="px-3 py-3 text-center text-sm font-medium text-gray-600">Telat Ringan</th>
                                <th className="px-3 py-3 text-center text-sm font-medium text-gray-600">Telat Berat</th>
                                <th className="px-3 py-3 text-center text-sm font-medium text-gray-600">Alpha</th>
                                <th className="px-3 py-3 text-center text-sm font-medium text-gray-600">Izin</th>
                                <th className="px-3 py-3 text-center text-sm font-medium text-gray-600">Total Lembur</th>
                                <th className="px-3 py-3 text-center text-sm font-medium text-gray-600">Jam Kerja</th>
                                <th className="px-6 py-3 text-center text-sm font-medium text-gray-600">Skor</th>
                                <th className="px-3 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {stats.employeeBreakdown.map((emp) => {
                                const isExpanded = expandedEmp === emp.employeeId;
                                const empSpecificAttendances = rawAttendances.filter(a => a.employeeId === emp.employeeId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                return (
                                    <React.Fragment key={emp.employeeId}>
                                        <tr className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setExpandedEmp(isExpanded ? null : emp.employeeId)}>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-bold text-gray-800">{emp.employeeName}</p>
                                                    <p className="text-xs text-gray-500">{emp.employeeId}</p>
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 text-center text-sm text-gray-700">{emp.daysPresent}</td>
                                            <td className="px-3 py-4 text-center text-sm">
                                                <span className={emp.daysLateMild > 0 ? 'text-amber-600 font-bold' : 'text-gray-700'}>
                                                    {emp.daysLateMild}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-center text-sm">
                                                <span className={emp.daysLateSevere > 0 ? 'text-orange-600 font-bold' : 'text-gray-700'}>
                                                    {emp.daysLateSevere}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-center text-sm">
                                                <span className={emp.daysAbsent > 0 ? 'text-red-600 font-bold' : 'text-gray-700'}>
                                                    {emp.daysAbsent}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-center text-sm text-gray-700">{emp.daysLeave}</td>
                                            <td className="px-3 py-4 text-center text-sm">
                                                <span className={emp.overtimeCount > 0 ? 'text-purple-600 font-bold' : 'text-gray-700'}>
                                                    {emp.overtimeCount}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-center text-sm text-gray-700">{emp.totalHours.toFixed(1)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${emp.attendanceRate >= 90 ? 'bg-emerald-100 text-emerald-700' :
                                                        emp.attendanceRate >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {emp.attendanceRate.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-center text-gray-400">
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-gray-50/50">
                                                <td colSpan={9} className="p-0">
                                                    <div className="px-6 py-4 border-t border-b border-gray-100">
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Rincian Hari Presensi & Override</h4>
                                                        {empSpecificAttendances.length === 0 ? (
                                                            <p className="text-sm text-gray-400 italic">Tidak ada catatan presensi terekam.</p>
                                                        ) : (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                {empSpecificAttendances.map(att => {
                                                                    const dateObj = new Date(att.date + 'T00:00:00');
                                                                    const statusColors: Record<AttendanceStatus, string> = {
                                                                        present: 'bg-emerald-100 text-emerald-700 border-emerald-300',
                                                                        late: 'bg-amber-100 text-amber-700 border-amber-300',
                                                                        late_mild: 'bg-amber-100 text-amber-700 border-amber-300',
                                                                        late_severe: 'bg-orange-100 text-orange-700 border-orange-300',
                                                                        absent: 'bg-red-100 text-red-700 border-red-300',
                                                                        leave: 'bg-gray-200 text-gray-700 border-gray-300'
                                                                    };
                                                                    
                                                                    // Extract actual check-in time
                                                                    let jamMasuk = '-';
                                                                    if (att.shifts && att.shifts.length > 0) {
                                                                       const shift = att.shifts[0];
                                                                       if (shift.checkIn) {
                                                                           jamMasuk = new Date(shift.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                                                                       }
                                                                    }
                                                                    
                                                                    return (
                                                                        <div key={att.id} className={`p-3 rounded-xl border ${statusColors[att.status]} bg-white bg-opacity-40`}>
                                                                            <div className="flex items-center justify-between mb-1">
                                                                                <div className="font-medium text-sm text-gray-800">{dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                                                                                <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${statusColors[att.status]}`}>
                                                                                    {ATTENDANCE_STATUS_LABELS[att.status] || att.status}
                                                                                </div>
                                                                            </div>
                                                                            
                                                                            <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                                                                                <span className="flex items-center gap-1 font-medium bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                                                                                    <Clock size={12} /> Jam Masuk: {jamMasuk}
                                                                                </span>
                                                                                <span>{att.totalHours > 0 ? `${att.totalHours.toFixed(1)} Jam` : ''}</span>
                                                                            </div>
                                                                            
                                                                            <div className="mt-2 pt-2 border-t border-gray-200/50 flex flex-wrap gap-1">
                                                                                <span className="text-[9px] font-bold text-gray-400 w-full mb-0.5 uppercase tracking-wide">Ubah Status:</span>
                                                                                <button 
                                                                                    onClick={() => handleOverrideStatus(emp.employeeId, att.date, 'present')}
                                                                                    className="text-[10px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-200 px-1.5 py-1 rounded transition-colors"
                                                                                >Hadir</button>
                                                                                <button 
                                                                                    onClick={() => handleOverrideStatus(emp.employeeId, att.date, 'late_mild')}
                                                                                    className="text-[10px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-200 px-1.5 py-1 rounded transition-colors"
                                                                                >T.Ringan</button>
                                                                                <button 
                                                                                    onClick={() => handleOverrideStatus(emp.employeeId, att.date, 'late_severe')}
                                                                                    className="text-[10px] font-medium bg-orange-50 text-orange-700 hover:bg-orange-200 px-1.5 py-1 rounded transition-colors"
                                                                                >T.Berat</button>
                                                                                <button 
                                                                                    onClick={() => handleOverrideStatus(emp.employeeId, att.date, 'absent')}
                                                                                    className="text-[10px] font-medium bg-red-50 text-red-700 hover:bg-red-200 px-1.5 py-1 rounded transition-colors"
                                                                                >Alpha</button>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
