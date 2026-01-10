'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import PayrollGenerator from '@/components/PayrollGenerator';
import PayrollSummary from '@/components/PayrollSummary';
import {
    Wallet,
    Plus,
    FileText,
    Calendar,
    CheckCircle,
    Clock,
    ArrowLeft,
    Eye,
    BarChart3
} from 'lucide-react';
import { subscribeToEmployees } from '@/lib/firestore-employees';
import { getAllPayrolls } from '@/lib/firestore-payroll';
import type { Employee } from '@/types/employee';
import type { MonthlyPayroll } from '@/types/payroll';
import { formatPeriod, PAYROLL_STATUS_LABELS } from '@/types/payroll';
import { formatRupiah } from '@/lib/currency';

export default function PayrollPage() {
    const { role } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'reports'>('generate');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [payrollHistory, setPayrollHistory] = useState<MonthlyPayroll[]>([]);
    const [loading, setLoading] = useState(true);

    // Access control
    if (role !== 'owner' && role !== 'admin') {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center p-8">
                        <p className="text-gray-600">Akses ditolak. Hanya Owner dan Admin yang dapat mengakses payroll.</p>
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

    useEffect(() => {
        const unsubEmployees = subscribeToEmployees((data) => {
            setEmployees(data);
            setLoading(false);
        });

        return () => unsubEmployees();
    }, []);

    useEffect(() => {
        const fetchHistory = async () => {
            const history = await getAllPayrolls(12);
            setPayrollHistory(history);
        };

        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab]);

    const handlePayrollGenerated = async () => {
        // Refresh history
        const history = await getAllPayrolls(12);
        setPayrollHistory(history);
        setActiveTab('history');
    };

    const getStatusBadge = (status: MonthlyPayroll['status']) => {
        const colors = {
            draft: 'bg-gray-100 text-gray-700 border-gray-200',
            approved: 'bg-blue-100 text-blue-700 border-blue-200',
            paid: 'bg-green-100 text-green-700 border-green-200'
        };

        const icons = {
            draft: Clock,
            approved: CheckCircle,
            paid: CheckCircle
        };

        const Icon = icons[status];

        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status]}`}>
                <Icon size={14} />
                {PAYROLL_STATUS_LABELS[status]}
            </span>
        );
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b">
                    <div className="container mx-auto px-4 sm:px-6 py-6">
                        <div className="flex items-center gap-4 mb-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                        <Wallet size={24} />
                                    </div>
                                    Payroll & Penggajian
                                </h1>
                                <p className="text-sm text-gray-500">Kelola penggajian karyawan bulanan</p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 border-b">
                            <button
                                onClick={() => setActiveTab('generate')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'generate'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Plus size={16} className="inline mr-2" />
                                Generate Payroll
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'history'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <FileText size={16} className="inline mr-2" />
                                Riwayat Payroll
                            </button>
                            <button
                                onClick={() => setActiveTab('reports')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'reports'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <BarChart3 size={16} className="inline mr-2" />
                                Laporan & Analitik
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="container mx-auto px-4 sm:px-6 py-8">
                    {activeTab === 'generate' && (
                        <div className="max-w-4xl mx-auto">
                            {loading ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-500">Loading employees...</p>
                                </div>
                            ) : (
                                <PayrollGenerator
                                    employees={employees}
                                    onSuccess={handlePayrollGenerated}
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="max-w-6xl mx-auto">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100">
                                    <h2 className="text-lg font-bold text-gray-800">Riwayat Payroll</h2>
                                    <p className="text-sm text-gray-500">12 periode terakhir</p>
                                </div>

                                {payrollHistory.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                                        <p className="text-gray-500">Belum ada riwayat payroll</p>
                                        <button
                                            onClick={() => setActiveTab('generate')}
                                            className="mt-4 text-blue-600 hover:underline text-sm font-medium"
                                        >
                                            Generate payroll pertama Anda
                                        </button>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {payrollHistory.map((payroll) => (
                                            <div
                                                key={payroll.id}
                                                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                                                onClick={() => router.push(`/payroll/${payroll.id}`)}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <Calendar size={20} className="text-blue-600" />
                                                            <h3 className="text-lg font-bold text-gray-800">
                                                                {formatPeriod(payroll.period)}
                                                            </h3>
                                                            {getStatusBadge(payroll.status)}
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-4 mt-4">
                                                            <div>
                                                                <p className="text-xs text-gray-500">Karyawan</p>
                                                                <p className="text-sm font-medium text-gray-800">
                                                                    {payroll.totalEmployees} orang
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-gray-500">Total Gross</p>
                                                                <p className="text-sm font-medium text-gray-800">
                                                                    {formatRupiah(payroll.totalGrossPay)}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-gray-500">Total Net</p>
                                                                <p className="text-sm font-bold text-blue-600">
                                                                    {formatRupiah(payroll.totalNetPay)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                                        <Eye size={20} className="text-gray-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="max-w-7xl mx-auto">
                            <PayrollSummary payrolls={payrollHistory} />
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
