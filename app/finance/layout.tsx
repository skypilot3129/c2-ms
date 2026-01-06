'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, ArrowLeft, PieChart, Wallet, Receipt } from "lucide-react";

export default function FinanceLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    const menuItems = [
        {
            label: 'Piutang & Penagihan',
            icon: <Wallet size={20} />,
            href: '/finance/receivables',
            active: pathname === '/finance/receivables'
        },
        {
            label: 'Invoice',
            icon: <FileText size={20} />,
            href: '/finance/invoices',
            active: pathname.startsWith('/finance/invoices')
        },
        {
            label: 'Laporan Keuangan',
            icon: <PieChart size={20} />,
            href: '/finance/reports',
            active: pathname.startsWith('/finance/reports')
        },
        {
            label: 'Pengeluaran Umum',
            icon: <Wallet size={20} />,
            href: '/finance/expenses',
            active: pathname.startsWith('/finance/expenses')
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed h-full z-10 hidden md:block">
                <div className="p-6 border-b border-gray-100">
                    <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors mb-4">
                        <ArrowLeft size={18} />
                        <span className="text-sm font-medium">Menu Utama</span>
                    </Link>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <LayoutDashboard className="text-blue-600" />
                        Keuangan
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">C2-MS Finance Module</p>
                </div>
                <nav className="p-4 space-y-1">
                    <Link
                        key="/finance/receivables"
                        href="/finance/receivables"
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname === '/finance/receivables'
                            ? 'bg-blue-50 text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                    >
                        <Wallet size={20} />
                        Piutang & Penagihan
                    </Link>
                    <Link
                        href="/finance/invoices"
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname.startsWith('/finance/invoices')
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                            : 'text-gray-600 hover:bg-white hover:shadow-sm'
                            }`}
                    >
                        <FileText size={20} />
                        <span>Invoice</span>
                    </Link>

                    <Link
                        href="/finance/expenses"
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname.startsWith('/finance/expenses')
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                            : 'text-gray-600 hover:bg-white hover:shadow-sm'
                            }`}
                    >
                        <Wallet size={20} />
                        <span>Pengeluaran Umum</span>
                    </Link>

                    <Link
                        href="/finance/reports"
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname.startsWith('/finance/reports')
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                            : 'text-gray-600 hover:bg-white hover:shadow-sm'
                            }`}
                    >
                        <PieChart size={20} />
                        <span>Laporan Keuangan</span>
                    </Link>

                    <Link
                        href="/finance/tax"
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${pathname.startsWith('/finance/tax')
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                            : 'text-gray-600 hover:bg-white hover:shadow-sm'
                            }`}
                    >
                        <Receipt size={20} />
                        <span>Pajak & PPN</span>
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-8">
                {children}
            </main>
        </div>
    );
}
