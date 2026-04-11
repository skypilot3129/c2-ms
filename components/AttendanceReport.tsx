'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Download, TrendingUp, Clock, Users, AlertCircle, ChevronDown, ChevronUp, CheckCircle, Printer } from 'lucide-react';
import type { Attendance } from '@/types/attendance';
import type { Employee } from '@/types/employee';
import {
    calculateAttendanceStats,
    exportAttendanceToCSV,
    getDateRange,
    type AttendanceStats
} from '@/lib/reports-helper';
import { getEmployeeAttendance, updateAttendanceStatus } from '@/lib/firestore-attendance';

interface AttendanceReportProps {
    employees: Employee[];
}

export default function AttendanceReport({ employees }: AttendanceReportProps) {
    const router = useRouter();
    const [preset, setPreset] = useState<'this_month' | 'last_month' | 'last_3_months'>('this_month');
    const [stats, setStats] = useState<AttendanceStats | null>(null);
    const [rawAttendances, setRawAttendances] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

    useEffect(() => {
        loadAttendanceData();
    }, [preset, employees]);

    const loadAttendanceData = async () => {
        setLoading(true);
        try {
            const { startDate, endDate } = getDateRange(preset);

            // Fetch attendance for all employees
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
            };
            const encoded = encodeURIComponent(JSON.stringify(dataToPrint));
            router.push(`/attendance/admin/print?data=${encoded}`);
        }
    };

    const handleTolerate = async (empId: string, date: string) => {
        if (confirm('Anda yakin ingin menoleransi keterlambatan ini dan menganggap karyawan ini Hadir tepat waktu?')) {
            try {
                await updateAttendanceStatus(empId, date, 'present', 'Dimaafkan/Toleransi oleh Admin');
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
                <div className="flex gap-3">
                    <select
                        value={preset}
                        onChange={(e) => setPreset(e.target.value as any)}
                        className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="this_month">Bulan Ini</option>
                        <option value="last_month">Bulan Terakhir</option>
                        <option value="last_3_months">3 Bulan Terakhir</option>
                    </select>
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
                                <th className="px-3 py-3 text-center text-sm font-medium text-gray-600">Telat</th>
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
                                                <span className={emp.daysLate > 0 ? 'text-amber-600 font-bold' : 'text-gray-700'}>
                                                    {emp.daysLate}
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
                                                                    const isLate = att.status === 'late';
                                                                    const statusLabels = { present: 'Hadir', absent: 'Alpha', late: 'Terlambat', leave: 'Izin/Cuti' };
                                                                    const statusColors = { present: 'bg-emerald-100 text-emerald-700', absent: 'bg-red-100 text-red-700', late: 'bg-amber-100 text-amber-700', leave: 'bg-gray-200 text-gray-700' };
                                                                    
                                                                    return (
                                                                        <div key={att.id} className={`p-3 rounded-xl border ${isLate ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'}`}>
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="font-medium text-sm text-gray-800">{dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                                                                                <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${statusColors[att.status]}`}>
                                                                                    {statusLabels[att.status]}
                                                                                </div>
                                                                            </div>
                                                                            <div className="mt-1 text-xs text-gray-500 flex justify-between items-center">
                                                                                <span>{att.totalHours > 0 ? `${att.totalHours.toFixed(1)} Jam Kerja` : '-'}</span>
                                                                                {isLate && (
                                                                                    <button 
                                                                                        onClick={() => handleTolerate(emp.employeeId, att.date)}
                                                                                        className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                                                                                    >
                                                                                        <CheckCircle size={12} /> Tolerir (Hadir)
                                                                                    </button>
                                                                                )}
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
