'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    User,
    Calendar,
    Clock,
    Wallet,
    FileText,
    ArrowLeft,
    TrendingUp,
    AlertCircle
} from 'lucide-react';
import { getEmployeeAttendance, getAttendanceSummary } from '@/lib/firestore-attendance';
import { getEmployeePayrollHistory } from '@/lib/firestore-payroll';
import { getMonthlySchedule } from '@/lib/firestore-operations';
import { formatRupiah } from '@/lib/currency';
import { formatPeriod } from '@/types/payroll';
import type { Attendance } from '@/types/attendance';
import type { PayrollCalculation } from '@/types/payroll';

export default function EmployeePortalPage() {
    const { employee } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'profile' | 'attendance' | 'payroll'>('profile');
    const [recentAttendance, setRecentAttendance] = useState<Attendance[]>([]);
    const [attendanceStats, setAttendanceStats] = useState<any>(null);
    const [payrollHistory, setPayrollHistory] = useState<PayrollCalculation[]>([]);
    const [monthlySchedule, setMonthlySchedule] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (employee) {
            loadEmployeeData();
        }
    }, [employee]);

    const loadEmployeeData = async () => {
        if (!employee) return;

        try {
            // Get current month dates
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const endDate = now.toISOString().split('T')[0];

            // Load attendance
            const attendance = await getEmployeeAttendance(employee.employeeId, startDate, endDate);
            setRecentAttendance(attendance);

            // Load attendance stats
            const stats = await getAttendanceSummary(employee.employeeId, startDate, endDate);
            setAttendanceStats(stats);

            // Load payroll history
            const payrolls = await getEmployeePayrollHistory(employee.employeeId, 6);
            setPayrollHistory(payrolls);

            // Load current monthly schedule
            const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const schedule = await getMonthlySchedule(monthStr);
            setMonthlySchedule(schedule);
        } catch (error) {
            console.error('Error loading employee data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!employee) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
                        <p className="text-gray-600">Data karyawan tidak ditemukan</p>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-4 text-blue-600 hover:underline"
                        >
                            Kembali ke Dashboard
                        </button>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    const attendanceRate = attendanceStats
        ? ((attendanceStats.present + attendanceStats.late) / attendanceStats.totalDays) * 100
        : 0;

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <div className="container mx-auto px-4 sm:px-6 py-6">
                        <div className="flex items-center gap-4 mb-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                    <User size={32} />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold">{employee.fullName}</h1>
                                    <p className="text-blue-100">{employee.employeeId} • {employee.role}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'profile'
                                    ? 'bg-white text-blue-600'
                                    : 'text-white hover:bg-white/10'
                                    }`}
                            >
                                <User size={16} className="inline mr-2" />
                                Profil
                            </button>
                            <button
                                onClick={() => setActiveTab('attendance')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'attendance'
                                    ? 'bg-white text-blue-600'
                                    : 'text-white hover:bg-white/10'
                                    }`}
                            >
                                <Calendar size={16} className="inline mr-2" />
                                Absensi
                            </button>
                            <button
                                onClick={() => setActiveTab('payroll')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'payroll'
                                    ? 'bg-white text-blue-600'
                                    : 'text-white hover:bg-white/10'
                                    }`}
                            >
                                <Wallet size={16} className="inline mr-2" />
                                Gaji
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="container mx-auto px-4 sm:px-6 py-8">
                    {activeTab === 'profile' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            {/* Personal Info */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Informasi Pribadi</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-500">Nama Lengkap</p>
                                        <p className="font-medium text-gray-800">{employee.fullName}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">ID Karyawan</p>
                                        <p className="font-medium text-gray-800">{employee.employeeId}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Email</p>
                                        <p className="font-medium text-gray-800">{employee.contact.email || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Telepon</p>
                                        <p className="font-medium text-gray-800">{employee.contact.phone || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Posisi</p>
                                        <p className="font-medium text-gray-800 capitalize">{employee.role}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Status</p>
                                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${employee.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {employee.status}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-sm text-gray-500">Alamat</p>
                                        <p className="font-medium text-gray-800">{employee.contact.address || '-'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Jadwal Pemuatan (Loading Schedule) */}
                            {monthlySchedule && (
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <Calendar size={20} className="text-purple-600" />
                                        Jadwal Pemuatan Bulan Ini
                                    </h2>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <div>
                                                <p className="text-sm text-gray-500">Bulan</p>
                                                <p className="font-bold text-gray-800">
                                                    {new Date(monthlySchedule.month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-500">Status</p>
                                                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase">
                                                    Terdaftar
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className={`p-4 rounded-xl border-2 transition-all ${
                                                monthlySchedule.loaderIds?.includes(employee.employeeId) 
                                                ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                                : 'bg-gray-50 border-gray-100 opacity-60'
                                            }`}>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <TrendingUp className={monthlySchedule.loaderIds?.includes(employee.employeeId) ? 'text-blue-600' : 'text-gray-400'} size={20} />
                                                    <p className="font-bold text-gray-800">Tim Muat</p>
                                                </div>
                                                <p className="text-sm text-gray-600">
                                                    {monthlySchedule.loaderIds?.includes(employee.employeeId) 
                                                        ? 'Anda ditugaskan sebagai tim muat bulan ini.' 
                                                        : 'Anda tidak masuk dalam tim muat bulan ini.'}
                                                </p>
                                            </div>

                                            <div className={`p-4 rounded-xl border-2 transition-all ${
                                                monthlySchedule.stackerPoolIds?.includes(employee.employeeId) 
                                                ? 'bg-purple-50 border-purple-200 shadow-sm' 
                                                : 'bg-gray-50 border-gray-100 opacity-60'
                                            }`}>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <TrendingUp className={monthlySchedule.stackerPoolIds?.includes(employee.employeeId) ? 'text-purple-600' : 'text-gray-400'} size={20} />
                                                    <p className="font-bold text-gray-800">Calon Penyusun</p>
                                                </div>
                                                <p className="text-sm text-gray-600">
                                                    {monthlySchedule.stackerPoolIds?.includes(employee.employeeId) 
                                                        ? 'Anda terpilih sebagai salah satu calon penyusun.' 
                                                        : 'Anda tidak masuk dalam daftar calon penyusun.'}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {!monthlySchedule.loaderIds?.includes(employee.employeeId) && !monthlySchedule.stackerPoolIds?.includes(employee.employeeId) && (
                                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800">
                                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                                <p>Anda belum terdaftar dalam jadwal pemuatan bulan ini. Silakan hubungi admin jika ini adalah kesalahan.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Data Identitas (KTP) */}
                            {employee.ktpIdentity && (
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h2 className="text-lg font-bold text-gray-800 mb-4">Data Identitas (Sesuai KTP)</h2>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500">NIK</p>
                                            <p className="font-medium text-gray-800">{employee.ktpIdentity.nik || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Nama Lengkap</p>
                                            <p className="font-medium text-gray-800">{employee.ktpIdentity.namaLengkap || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Tempat, Tanggal Lahir</p>
                                            <p className="font-medium text-gray-800">{employee.ktpIdentity.tempatLahir}, {employee.ktpIdentity.tanggalLahir}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Jenis Kelamin</p>
                                            <p className="font-medium text-gray-800">{employee.ktpIdentity.jenisKelamin}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Agama</p>
                                            <p className="font-medium text-gray-800">{employee.ktpIdentity.agama}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Status Perkawinan</p>
                                            <p className="font-medium text-gray-800">{employee.ktpIdentity.statusPerkawinan}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-sm text-gray-500">Alamat KTP</p>
                                            <p className="font-medium text-gray-800">
                                                {employee.ktpIdentity.alamatKTP} RT {employee.ktpIdentity.rt} RW {employee.ktpIdentity.rw}, 
                                                Kel/Desa {employee.ktpIdentity.kelurahan}, Kec. {employee.ktpIdentity.kecamatan}, 
                                                {employee.ktpIdentity.kabupatenKota}, Prov. {employee.ktpIdentity.provinsi}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Salary Info */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Informasi Gaji</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {employee.role === 'helper' ? (
                                        <>
                                            <div>
                                                <p className="text-sm text-gray-500">Gaji Kehadiran Harian</p>
                                                <p className="text-lg font-bold text-gray-800">{formatRupiah(employee.salaryConfig.dailyRate || 50000)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Bonus Susun Barang</p>
                                                <p className="text-lg font-bold text-gray-800">{formatRupiah(employee.salaryConfig.stackingBonus || 50000)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Potongan Telat (1-2 Jam)</p>
                                                <p className="font-medium text-amber-600">-{formatRupiah(employee.salaryConfig.lateDeduction1 || 10000)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Potongan Telat (&gt;2 Jam)</p>
                                                <p className="font-medium text-red-600">-{formatRupiah(employee.salaryConfig.lateDeduction2 || 20000)}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <p className="text-sm text-gray-500">Gaji Pokok</p>
                                                <p className="text-lg font-bold text-gray-800">{formatRupiah(employee.salaryConfig.baseSalary || 0)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Uang Harian</p>
                                                <p className="text-lg font-bold text-gray-800">{formatRupiah(employee.salaryConfig.allowance || 0)}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Job Description */}
                            {employee.jobdesk && (
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <FileText size={20} className="text-blue-600" />
                                        Job Description / Tugas & Tanggung Jawab
                                    </h2>
                                    <div className="text-gray-700 whitespace-pre-wrap bg-blue-50 p-4 rounded-lg border border-blue-200">
                                        {employee.jobdesk}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'attendance' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            {/* Stats Cards */}
                            {attendanceStats && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                        <p className="text-sm text-gray-500 mb-1">Hadir</p>
                                        <p className="text-2xl font-bold text-emerald-600">{attendanceStats.present}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                        <p className="text-sm text-gray-500 mb-1">Terlambat</p>
                                        <p className="text-2xl font-bold text-amber-600">{attendanceStats.late}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                        <p className="text-sm text-gray-500 mb-1">Lembur</p>
                                        <p className="text-2xl font-bold text-purple-600">{attendanceStats.overtimeCount}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                        <p className="text-sm text-gray-500 mb-1">Kehadiran</p>
                                        <p className="text-2xl font-bold text-blue-600">{attendanceRate.toFixed(0)}%</p>
                                    </div>
                                </div>
                            )}

                            {/* Recent Attendance */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-lg font-bold text-gray-800">Absensi Bulan Ini</h2>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {recentAttendance.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
                                            <p className="text-gray-500">Belum ada data absensi</p>
                                        </div>
                                    ) : (
                                        recentAttendance.map((att) => (
                                            <div key={att.id} className="p-4 hover:bg-gray-50">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-gray-800">{att.date}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${att.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                                                att.status === 'late' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-gray-100 text-gray-700'
                                                                }`}>
                                                                {att.status}
                                                            </span>
                                                            {att.overtimeCount > 0 && (
                                                                <span className="text-xs text-purple-600">
                                                                    +{att.overtimeCount} lembur
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm text-gray-500">Total Jam</p>
                                                        <p className="font-medium text-gray-800">{att.totalHours.toFixed(1)}h</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'payroll' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-lg font-bold text-gray-800">Riwayat Gaji</h2>
                                    <p className="text-sm text-gray-500">6 periode terakhir</p>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {payrollHistory.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <Wallet className="mx-auto text-gray-300 mb-4" size={48} />
                                            <p className="text-gray-500">Belum ada data gaji</p>
                                        </div>
                                    ) : (
                                        payrollHistory.map((payroll, idx) => (
                                            <div
                                                key={idx}
                                                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => router.push(`/payroll/slip/${employee.employeeId}/${payroll.period}`)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <Calendar size={20} className="text-blue-600" />
                                                            <h3 className="text-lg font-bold text-gray-800">
                                                                {formatPeriod(payroll.period)}
                                                            </h3>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-4">
                                                            <div>
                                                                <p className="text-xs text-gray-500">Hari Kerja</p>
                                                                <p className="text-sm font-medium text-gray-800">{payroll.daysWorked} hari</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-gray-500">Lembur</p>
                                                                <p className="text-sm font-medium text-gray-800">{payroll.overtimeEvents}x</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-gray-500">Gaji Bersih</p>
                                                                <p className="text-lg font-bold text-blue-600">{formatRupiah(payroll.netPay)}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <FileText size={20} className="text-gray-400" />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
