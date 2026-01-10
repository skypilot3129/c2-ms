'use client';

import { useState, useEffect } from 'react';
import { Calendar, Download, TrendingUp, Clock, Users, AlertCircle } from 'lucide-react';
import type { Attendance } from '@/types/attendance';
import type { Employee } from '@/types/employee';
import {
    calculateAttendanceStats,
    exportAttendanceToCSV,
    getDateRange,
    type AttendanceStats
} from '@/lib/reports-helper';
import { getEmployeeAttendance } from '@/lib/firestore-attendance';

interface AttendanceReportProps {
    employees: Employee[];
}

export default function AttendanceReport({ employees }: AttendanceReportProps) {
    const [preset, setPreset] = useState<'this_month' | 'last_month' | 'last_3_months'>('this_month');
    const [stats, setStats] = useState<AttendanceStats | null>(null);
    const [loading, setLoading] = useState(false);

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
        } catch (error) {
            console.error('Error loading attendance data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (stats) {
            exportAttendanceToCSV(stats);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading attendance data...</p>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-500">No attendance data available</p>
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
                        <h2 className="text-xl font-bold text-gray-800">Attendance Report</h2>
                        <p className="text-sm text-gray-500">{stats.period}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <select
                        value={preset}
                        onChange={(e) => setPreset(e.target.value as any)}
                        className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="last_3_months">Last 3 Months</option>
                    </select>
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                        <Download size={18} />
                        Export CSV
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
                        <p className="text-sm text-gray-500">Working Days</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalWorkingDays}</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <TrendingUp size={20} className="text-emerald-600" />
                        </div>
                        <p className="text-sm text-gray-500">Attendance Rate</p>
                    </div>
                    <p className="text-3xl font-bold text-emerald-600">{stats.attendanceRate.toFixed(1)}%</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Clock size={20} className="text-purple-600" />
                        </div>
                        <p className="text-sm text-gray-500">Overtime Events</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalOvertimeEvents}</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <AlertCircle size={20} className="text-amber-600" />
                        </div>
                        <p className="text-sm text-gray-500">Late Check-ins</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalLateCheckins}</p>
                </div>
            </div>

            {/* Employee Breakdown Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Users size={20} className="text-blue-600" />
                        Employee Breakdown
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                                <th className="px-6 py-3 text-center text-sm font-medium text-gray-600">Present</th>
                                <th className="px-6 py-3 text-center text-sm font-medium text-gray-600">Late</th>
                                <th className="px-6 py-3 text-center text-sm font-medium text-gray-600">Absent</th>
                                <th className="px-6 py-3 text-center text-sm font-medium text-gray-600">Leave</th>
                                <th className="px-6 py-3 text-center text-sm font-medium text-gray-600">Overtime</th>
                                <th className="px-6 py-3 text-center text-sm font-medium text-gray-600">Total Hours</th>
                                <th className="px-6 py-3 text-center text-sm font-medium text-gray-600">Rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {stats.employeeBreakdown.map((emp) => (
                                <tr key={emp.employeeId} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-medium text-gray-800">{emp.employeeName}</p>
                                            <p className="text-xs text-gray-500">{emp.employeeId}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm text-gray-700">{emp.daysPresent}</td>
                                    <td className="px-6 py-4 text-center text-sm">
                                        <span className={emp.daysLate > 0 ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                                            {emp.daysLate}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm">
                                        <span className={emp.daysAbsent > 0 ? 'text-red-600 font-medium' : 'text-gray-700'}>
                                            {emp.daysAbsent}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm text-gray-700">{emp.daysLeave}</td>
                                    <td className="px-6 py-4 text-center text-sm">
                                        <span className={emp.overtimeCount > 0 ? 'text-purple-600 font-medium' : 'text-gray-700'}>
                                            {emp.overtimeCount}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm text-gray-700">{emp.totalHours.toFixed(1)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${emp.attendanceRate >= 90 ? 'bg-emerald-100 text-emerald-700' :
                                                emp.attendanceRate >= 75 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                            }`}>
                                            {emp.attendanceRate.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
