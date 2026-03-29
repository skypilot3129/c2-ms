'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import MonthlyOperationalSchedule from '@/components/MonthlyOperationalSchedule';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';

export default function MonthlySchedulePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
        }
    }, [user, authLoading, router]);

    if (authLoading || !user) {
        return null;
    }

    return (
        <ProtectedRoute>
            <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
                {/* Back button */}
                <div className="flex items-center gap-2">
                    <Link href="/">
                        <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                            <ArrowLeft size={16} />
                            Kembali
                        </button>
                    </Link>
                </div>

                {/* Jadwal Operasional */}
                <MonthlyOperationalSchedule />
            </div>
        </ProtectedRoute>
    );
}
