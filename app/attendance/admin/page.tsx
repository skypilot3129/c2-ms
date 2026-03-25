'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AttendanceDashboard from '@/components/AttendanceDashboard';
import AttendanceReport from '@/components/AttendanceReport';
import { ClipboardList, Settings, Users, FileText } from 'lucide-react';
import Link from 'next/link';
import { subscribeToEmployees } from '@/lib/firestore-employees';
import type { Employee } from '@/types/employee';

export default function AttendanceAdminPage() {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'reports'>('dashboard');
    const [employees, setEmployees] = useState<Employee[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeToEmployees((data) => {
            setEmployees(data);
        });
        return () => unsubscribe();
    }, []);

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <ClipboardList size={32} className="text-blue-500" />
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">Monitor Absensi</h1>
                                    <p className="text-sm text-gray-500">Dashboard kehadiran karyawan</p>
                                </div>
                            </div>
                            <Link
                                href="/attendance/admin/settings"
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 transition-colors"
                            >
                                <Settings size={16} />
                                Pengaturan Lokasi
                            </Link>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 border-b">
                            <button
                                onClick={() => setActiveTab('dashboard')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'dashboard'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Users size={16} className="inline mr-2" />
                                Dashboard Hari Ini
                            </button>
                            <button
                                onClick={() => setActiveTab('reports')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'reports'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <FileText size={16} className="inline mr-2" />
                                Laporan Absensi
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {activeTab === 'dashboard' && <AttendanceDashboard />}
                    {activeTab === 'reports' && <AttendanceReport employees={employees} />}
                </div>
            </div>
        </ProtectedRoute>
    );
}
