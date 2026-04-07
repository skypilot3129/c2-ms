'use client';

import { useState } from 'react';
import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, ArrowLeft, PieChart, Wallet, Receipt, Menu, X, BarChart3, Target, ClipboardList } from "lucide-react";

export default function FinanceLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navLinks = [
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
            label: 'Pengeluaran Umum',
            icon: <Wallet size={20} />,
            href: '/finance/expenses',
            active: pathname === '/finance/expenses' || pathname === '/finance/expenses/'
        },
        {
            label: '↳ Analitik Kas',
            icon: <BarChart3 size={18} />,
            href: '/finance/expenses/analytics',
            active: pathname.startsWith('/finance/expenses/analytics')
        },
        {
            label: '↳ Anggaran',
            icon: <Target size={18} />,
            href: '/finance/expenses/budget',
            active: pathname.startsWith('/finance/expenses/budget')
        },
        {
            label: '↳ Perencanaan',
            icon: <ClipboardList size={18} />,
            href: '/finance/expenses/planning',
            active: pathname.startsWith('/finance/expenses/planning')
        },
        {
            label: 'Laporan Keuangan',
            icon: <PieChart size={20} />,
            href: '/finance/reports',
            active: pathname.startsWith('/finance/reports')
        },
        {
            label: 'Pajak & PPN',
            icon: <Receipt size={20} />,
            href: '/finance/tax',
            active: pathname.startsWith('/finance/tax')
        },
    ];

    // Get active page label for mobile header
    const activeLabel = navLinks.find(l => l.active)?.label || 'Keuangan';

    return (
        <div className="min-h-screen bg-gray-50 flex">

            {/* ── Desktop Sidebar ── */}
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
                    {navLinks.map(link => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                                link.active
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                        >
                            {link.icon}
                            <span>{link.label}</span>
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* ── Mobile Top Bar ── */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="text-gray-400 hover:text-blue-600 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                                <LayoutDashboard size={16} className="text-blue-600" />
                                Keuangan
                            </h1>
                            <p className="text-[10px] text-blue-600 font-semibold">{activeLabel}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {/* Mobile Dropdown Menu */}
                {mobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/30 z-10"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        {/* Menu Panel */}
                        <div className="absolute left-0 right-0 bg-white border-b border-gray-200 shadow-xl z-20 animate-in slide-in-from-top-2 duration-200">
                            <nav className="p-3 space-y-1">
                                {navLinks.map(link => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                                            link.active
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                    >
                                        {link.icon}
                                        <span className="text-sm">{link.label}</span>
                                    </Link>
                                ))}
                            </nav>
                        </div>
                    </>
                )}
            </div>

            {/* ── Main Content ── */}
            <main className="flex-1 md:ml-64 pt-16 md:pt-0 p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
