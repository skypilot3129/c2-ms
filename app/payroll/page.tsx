'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Wallet, Users, CreditCard, Truck, Car, ArrowLeft, ChevronRight } from 'lucide-react';

const MODULE_CARDS = [
    {
        title: 'Gaji Karyawan',
        subtitle: 'Absensi harian & rekap gaji bulanan helper',
        icon: Users,
        color: 'from-blue-500 to-blue-600',
        shadow: 'shadow-blue-500/20',
        href: '/payroll/employees',
    },
    {
        title: 'Bon / Kasbon Karyawan',
        subtitle: 'Kelola kasbon yang dipotong dari gaji',
        icon: CreditCard,
        color: 'from-amber-500 to-amber-600',
        shadow: 'shadow-amber-500/20',
        href: '/payroll/advances',
    },
    {
        title: 'Kalkulator Uang Muat',
        subtitle: 'Bagi rata Fuso / Tronton + bonus tukang susun',
        icon: Truck,
        color: 'from-emerald-500 to-emerald-600',
        shadow: 'shadow-emerald-500/20',
        href: '/payroll/loading',
    },
    {
        title: 'Sewa Mobil & Sopir',
        subtitle: 'Sewa kendaraan, bon sopir, gaji sopir (CRUD + PDF)',
        icon: Car,
        color: 'from-violet-500 to-violet-600',
        shadow: 'shadow-violet-500/20',
        href: '/payroll/drivers',
    },
];

export default function PayrollPage() {
    const { role } = useAuth();
    const router = useRouter();

    if (role !== 'admin' && role !== 'pengurus') {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center p-8">
                        <p className="text-gray-600">Akses ditolak. Hanya Owner dan Admin yang dapat mengakses payroll.</p>
                        <button onClick={() => router.push('/')} className="mt-4 text-blue-600 hover:underline">
                            Kembali ke Dashboard
                        </button>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b">
                    <div className="container mx-auto px-4 sm:px-6 py-6">
                        <div className="flex items-center gap-4">
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
                                <p className="text-sm text-gray-500 ml-16">
                                    Kelola semua aspek penggajian dan kompensasi karyawan
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                        Modul Penggajian
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {MODULE_CARDS.map(card => {
                            const Icon = card.icon;
                            return (
                                <button
                                    key={card.href}
                                    onClick={() => router.push(card.href)}
                                    className={`group bg-gradient-to-br ${card.color} rounded-2xl p-5 text-white text-left shadow-lg ${card.shadow} hover:scale-[1.02] hover:shadow-xl transition-all duration-200`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                                            <Icon size={22} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-base mb-0.5">{card.title}</p>
                                            <p className="text-white/75 text-xs leading-relaxed">{card.subtitle}</p>
                                        </div>
                                        <ChevronRight
                                            size={18}
                                            className="text-white/50 group-hover:text-white/90 group-hover:translate-x-1 transition-all shrink-0 mt-1"
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
