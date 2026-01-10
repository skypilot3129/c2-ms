'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
    Wallet,
    ArrowLeft,
    Download,
    CheckCircle,
    Users,
    Calendar,
    TrendingUp,
    Printer
} from 'lucide-react';
import { getPayrollById, updatePayrollStatus } from '@/lib/firestore-payroll';
import type { MonthlyPayroll } from '@/types/payroll';
import { formatPeriod, PAYROLL_STATUS_LABELS } from '@/types/payroll';
import { formatRupiah } from '@/lib/currency';

export default function PayrollDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { role } = useAuth();
    const [payroll, setPayroll] = useState<MonthlyPayroll | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const payrollId = params.id as string;

    useEffect(() => {
        const fetchPayroll = async () => {
            try {
                const data = await getPayrollById(payrollId);
                setPayroll(data);
            } catch (error) {
                console.error('Error fetching payroll:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPayroll();
    }, [payrollId]);

    const handleApprove = async () => {
        if (!payroll) return;

        if (!confirm(`Approve payroll ${formatPeriod(payroll.period)}?\n\nSetelah diapprove, status akan berubah ke "Disetujui".`)) {
            return;
        }

        setUpdating(true);
        try {
            await updatePayrollStatus(payrollId, 'approved');
            const updated = await getPayrollById(payrollId);
            setPayroll(updated);
        } catch (error) {
            alert('Gagal approve payroll');
        } finally {
            setUpdating(false);
        }
    };

    const handleMarkPaid = async () => {
        if (!payroll) return;

        if (!confirm(`Tandai payroll ${formatPeriod(payroll.period)} sebagai DIBAYAR?\n\nIni menandakan semua gaji sudah ditransfer.`)) {
            return;
        }

        setUpdating(true);
        try {
            await updatePayrollStatus(payrollId, 'paid');
            const updated = await getPayrollById(payrollId);
            setPayroll(updated);
        } catch (error) {
            alert('Gagal update status');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center">
                    <p className="text-gray-500">Loading...</p>
                </div>
            </ProtectedRoute>
        );
    }

    if (!payroll) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-gray-500 mb-4">Payroll tidak ditemukan</p>
                        <button
                            onClick={() => router.push('/payroll')}
                            className="text-blue-600 hover:underline"
                        >
                            Kembali ke Payroll
                        </button>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    const averagePay = payroll.totalEmployees > 0 ? payroll.totalNetPay / payroll.totalEmployees : 0;

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b sticky top-0 z-10">
                    <div className="container mx-auto px-4 sm:px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => router.push('/payroll')}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">
                                        Payroll {formatPeriod(payroll.period)}
                                    </h1>
                                    <p className="text-sm text-gray-500">
                                        {payroll.totalEmployees} karyawan • {PAYROLL_STATUS_LABELS[payroll.status]}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Printer size={18} />
                                    <span className="hidden sm:inline">Print</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="container mx-auto px-4 sm:px-6 py-8 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Users size={20} className="text-blue-600" />
                                </div>
                                <p className="text-sm text-gray-500">Total Karyawan</p>
                            </div>
                            <p className="text-3xl font-bold text-gray-800">{payroll.totalEmployees}</p>
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                    <Wallet size={20} className="text-emerald-600" />
                                </div>
                                <p className="text-sm text-gray-500">Total Net Pay</p>
                            </div>
                            <p className="text-2xl font-bold text-gray-800">{formatRupiah(payroll.totalNetPay)}</p>
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <TrendingUp size={20} className="text-purple-600" />
                                </div>
                                <p className="text-sm text-gray-500">Rata-rata</p>
                            </div>
                            <p className="text-2xl font-bold text-gray-800">{formatRupiah(averagePay)}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    {(role === 'owner' || role === 'admin') && payroll.status !== 'paid' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-blue-900">Status: {PAYROLL_STATUS_LABELS[payroll.status]}</p>
                                    <p className="text-sm text-blue-700">
                                        {payroll.status === 'draft' && 'Review perhitungan dan approve jika sudah sesuai'}
                                        {payroll.status === 'approved' && 'Tandai sebagai dibayar setelah transfer selesai'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {payroll.status === 'draft' && (
                                        <button
                                            onClick={handleApprove}
                                            disabled={updating}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 transition-colors flex items-center gap-2"
                                        >
                                            <CheckCircle size={18} />
                                            Approve
                                        </button>
                                    )}
                                    {payroll.status === 'approved' && (
                                        <button
                                            onClick={handleMarkPaid}
                                            disabled={updating}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 transition-colors flex items-center gap-2"
                                        >
                                            <CheckCircle size={18} />
                                            Tandai Dibayar
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Employee List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800">Detail Gaji Karyawan</h2>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Karyawan</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Gaji Pokok</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Uang Harian</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Lembur</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Gross Pay</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Net Pay</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {payroll.calculations.map((calc, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-gray-800">{calc.employeeName}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {calc.employeeId} • {calc.daysWorked} hari kerja
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-700">
                                                {formatRupiah(calc.baseSalary)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-700">
                                                {formatRupiah(calc.totalAllowance)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-700">
                                                {formatRupiah(calc.totalOvertime)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">
                                                {formatRupiah(calc.grossPay)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">
                                                {formatRupiah(calc.netPay)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => router.push(`/payroll/slip/${calc.employeeId}/${payroll.period}`)}
                                                    className="text-blue-600 hover:underline text-sm font-medium"
                                                >
                                                    Lihat Slip
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                    <tr>
                                        <td className="px-4 py-3 font-bold text-gray-800">TOTAL</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-800">
                                            {formatRupiah(payroll.calculations.reduce((s, c) => s + c.baseSalary, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-800">
                                            {formatRupiah(payroll.calculations.reduce((s, c) => s + c.totalAllowance, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-800">
                                            {formatRupiah(payroll.calculations.reduce((s, c) => s + c.totalOvertime, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-800">
                                            {formatRupiah(payroll.totalGrossPay)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-blue-600">
                                            {formatRupiah(payroll.totalNetPay)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
