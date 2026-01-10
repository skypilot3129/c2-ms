'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import AttendanceDashboard from '@/components/AttendanceDashboard';
import { ClipboardList } from 'lucide-react';

export default function AttendanceAdminPage() {
    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex items-center gap-3">
                            <ClipboardList size={32} className="text-blue-500" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Monitor Absensi</h1>
                                <p className="text-sm text-gray-500">Dashboard kehadiran karyawan</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <AttendanceDashboard />
                </div>
            </div>
        </ProtectedRoute>
    );
}
