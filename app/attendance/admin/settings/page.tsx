'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import AttendanceLocationSettingsComponent from '@/components/AttendanceLocationSettings';
import { Settings, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AttendanceSettingsPage() {
    const router = useRouter();

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b">
                    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push('/attendance/admin')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft size={20} className="text-gray-600" />
                            </button>
                            <div className="flex items-center gap-3">
                                <Settings size={28} className="text-blue-500" />
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">Pengaturan Lokasi Absensi</h1>
                                    <p className="text-sm text-gray-500">Kelola lokasi kantor untuk validasi absensi</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
                    <AttendanceLocationSettingsComponent />
                </div>
            </div>
        </ProtectedRoute>
    );
}
