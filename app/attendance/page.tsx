'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import AttendanceCheckIn from '@/components/AttendanceCheckIn';
import { ClipboardList, ArrowLeft } from 'lucide-react';

export default function AttendancePage() {
    const { employee } = useAuth();
    const router = useRouter();

    // Use employee data from context
    const employeeId = employee?.employeeId || '';
    const employeeName = employee?.fullName || 'Karyawan';

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 py-8">
                {/* Header */}
                <div className="max-w-md mx-auto px-4 mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => router.push('/')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} className="text-gray-600" />
                        </button>
                        <div className="flex items-center gap-3">
                            <ClipboardList size={32} className="text-blue-500" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Absensi</h1>
                                <p className="text-sm text-gray-500">Check-in dan check-out harian</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-4">
                    <AttendanceCheckIn
                        employeeId={employeeId}
                        employeeName={employeeName}
                    />
                </div>
            </div>
        </ProtectedRoute>
    );
}
