'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ArrowLeft, Printer, Download, Building2 } from 'lucide-react';
import { getPayrollByPeriod } from '@/lib/firestore-payroll';
import type { PayrollCalculation, PayrollPeriod } from '@/types/payroll';
import { formatPeriod } from '@/types/payroll';
import { formatRupiah } from '@/lib/currency';

export default function PayslipPage() {
    const params = useParams();
    const router = useRouter();
    const { employee, role } = useAuth();
    const [calculation, setCalculation] = useState<PayrollCalculation | null>(null);
    const [loading, setLoading] = useState(true);

    const employeeId = params.employeeId as string;
    const period = params.period as PayrollPeriod;

    useEffect(() => {
        const fetchPayslip = async () => {
            try {
                const payroll = await getPayrollByPeriod(period);
                if (payroll) {
                    const calc = payroll.calculations.find(c => c.employeeId === employeeId);

                    // Access control: employees can only see their own slip
                    if (role !== 'owner' && role !== 'admin') {
                        if (employee?.employeeId !== employeeId) {
                            router.push('/');
                            return;
                        }
                    }

                    setCalculation(calc || null);
                }
            } catch (error) {
                console.error('Error fetching payslip:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPayslip();
    }, [employeeId, period, employee, role, router]);

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center">
                    <p className="text-gray-500">Loading payslip...</p>
                </div>
            </ProtectedRoute>
        );
    }

    if (!calculation) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-gray-500 mb-4">Slip gaji tidak ditemukan</p>
                        <button
                            onClick={() => router.back()}
                            className="text-blue-600 hover:underline"
                        >
                            Kembali
                        </button>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header - Hidden when printing */}
                <div className="bg-white border-b print:hidden">
                    <div className="container mx-auto px-4 sm:px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => router.back()}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">Slip Gaji</h1>
                                    <p className="text-sm text-gray-500">
                                        {calculation.employeeName} • {formatPeriod(period)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                >
                                    <Printer size={18} />
                                    Print
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payslip Content */}
                <div className="container mx-auto px-4 sm:px-6 py-8">
                    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden print:shadow-none print:border-0">
                        {/* Company Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <Building2 size={32} />
                                        <div>
                                            <h1 className="text-2xl font-bold">PT CAHAYA CARGO EXPRESS</h1>
                                            <p className="text-blue-100 text-sm">Jasa Pengiriman Ekspedisi</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-blue-100 text-sm">SLIP GAJI</p>
                                    <p className="text-xl font-bold">{formatPeriod(period)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Employee Info */}
                        <div className="p-8 border-b border-gray-200">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Nama Karyawan</p>
                                    <p className="text-lg font-bold text-gray-800">{calculation.employeeName}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">ID Karyawan</p>
                                    <p className="text-lg font-bold text-gray-800">{calculation.employeeId}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Posisi</p>
                                    <p className="text-lg font-bold text-gray-800 capitalize">{calculation.employeeRole}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Hari Kerja</p>
                                    <p className="text-lg font-bold text-gray-800">{calculation.daysWorked} Hari</p>
                                </div>
                            </div>
                        </div>

                        {/* Salary Breakdown */}
                        <div className="p-8">
                            <h2 className="text-lg font-bold text-gray-800 mb-6">RINCIAN PENDAPATAN</h2>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                                    <span className="text-gray-700">Gaji Pokok</span>
                                    <span className="font-semibold text-gray-800">{formatRupiah(calculation.baseSalary)}</span>
                                </div>

                                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                                    <div>
                                        <span className="text-gray-700">Uang Harian</span>
                                        <span className="text-sm text-gray-500 ml-2">
                                            ({formatRupiah(calculation.dailyAllowance)} × {calculation.daysWorked} hari)
                                        </span>
                                    </div>
                                    <span className="font-semibold text-gray-800">{formatRupiah(calculation.totalAllowance)}</span>
                                </div>

                                {calculation.totalCommission > 0 && (
                                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                                        <div>
                                            <span className="text-gray-700">Komisi Trip</span>
                                            <span className="text-sm text-gray-500 ml-2">
                                                ({calculation.tripsCompleted} trip)
                                            </span>
                                        </div>
                                        <span className="font-semibold text-gray-800">{formatRupiah(calculation.totalCommission)}</span>
                                    </div>
                                )}

                                {calculation.overtimeEvents > 0 && (
                                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                                        <div>
                                            <span className="text-gray-700">Lembur Bongkar/Muat</span>
                                            <span className="text-sm text-gray-500 ml-2">
                                                ({calculation.overtimeEvents} kali)
                                            </span>
                                        </div>
                                        <span className="font-semibold text-gray-800">{formatRupiah(calculation.totalOvertime)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center py-4 bg-gray-50 rounded-lg px-4 mt-4">
                                    <span className="font-bold text-gray-700">TOTAL PENDAPATAN (Gross)</span>
                                    <span className="text-xl font-bold text-gray-800">{formatRupiah(calculation.grossPay)}</span>
                                </div>
                            </div>

                            {/* Deductions */}
                            {calculation.deductions.length > 0 && (
                                <div className="mt-8">
                                    <h2 className="text-lg font-bold text-gray-800 mb-6">POTONGAN</h2>
                                    <div className="space-y-4">
                                        {calculation.deductions.map((deduction, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-3 border-b border-gray-100">
                                                <div>
                                                    <span className="text-gray-700">{deduction.description}</span>
                                                    <span className="text-sm text-gray-500 ml-2">({deduction.type})</span>
                                                </div>
                                                <span className="font-semibold text-red-600">-{formatRupiah(deduction.amount)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between items-center py-3 bg-red-50 rounded-lg px-4">
                                            <span className="font-bold text-gray-700">Total Potongan</span>
                                            <span className="font-bold text-red-600">-{formatRupiah(calculation.totalDeductions)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Net Pay */}
                            <div className="mt-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-blue-100 text-sm mb-1">GAJI BERSIH (Take Home Pay)</p>
                                        <p className="text-3xl font-bold">{formatRupiah(calculation.netPay)}</p>
                                    </div>
                                    <CheckIcon />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-8 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-500">
                            <p>Slip gaji ini digenerate otomatis oleh sistem C2-MS</p>
                            <p className="mt-1">Tanggal: {new Date().toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}</p>
                        </div>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}

function CheckIcon() {
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="opacity-50">
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
            <path d="M16 24L21 29L32 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
