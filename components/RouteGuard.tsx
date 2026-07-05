'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isModuleActive, AppModule } from '@/types/branch';

interface RouteGuardProps {
    module: AppModule;
    children: ReactNode;
}

export default function RouteGuard({ module, children }: RouteGuardProps) {
    const router = useRouter();
    const active = isModuleActive(module);

    useEffect(() => {
        if (!active) {
            router.push('/');
        }
    }, [active, router]);

    if (!active) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Akses Terbatas</h2>
                    <p className="text-gray-500">Modul ini tidak diaktifkan untuk cabang Anda.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
