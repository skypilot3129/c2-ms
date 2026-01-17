'use client';

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { LogOut, User as UserIcon, LogIn, UserPlus, Package, Users, Ship, BarChart3, Plus, Search, FileText, ArrowRight, Wallet, Crown, Truck, Clock, UserCircle } from "lucide-react";
import InstallPrompt from "@/components/InstallPrompt";
import { useState, useEffect } from "react";

export default function Home() {
    const { user, logout, loading, role } = useAuth();
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 11) setGreeting('Selamat Pagi');
        else if (hour < 15) setGreeting('Selamat Siang');
        else if (hour < 18) setGreeting('Selamat Sore');
        else setGreeting('Selamat Malam');
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600 to-transparent opacity-10 pointer-events-none"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-purple-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
            <div className="absolute top-40 -left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

            <div className="container mx-auto px-4 py-8 relative z-10">
                <div className="max-w-6xl mx-auto">

                    {/* Header / Nav */}
                    <div className="flex justify-between items-center mb-12">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                                C2
                            </div>
                            <span className="text-xl font-bold text-gray-800 tracking-tight">Cahaya Cargo MS</span>
                        </div>

                        {!loading && (
                            <div>
                                {user ? (
                                    <div className="flex items-center gap-4">
                                        <div className="hidden md:block text-right">
                                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Logged in as</p>
                                            <p className="text-sm font-bold text-gray-800">{user.displayName || user.email}</p>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className="w-10 h-10 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center text-red-500 hover:bg-red-50 hover:border-red-100 transition-all"
                                            title="Logout"
                                        >
                                            <LogOut size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-3">
                                        <Link href="/login">
                                            <button className="text-sm font-semibold text-gray-600 hover:text-blue-600 transition-colors px-3 py-2">
                                                Login
                                            </button>
                                        </Link>
                                        <Link href="/register">
                                            <button className="bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/30 transition-all">
                                                Register
                                            </button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Hero Section */}
                    <div className="text-center mb-16 space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium mb-4 animate-fade-in-up">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            System Operational v2.0
                        </div>

                        {!loading && user ? (
                            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight mb-4">
                                {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                                    {user.displayName?.split(' ')[0] || 'Admin'}
                                </span>
                            </h1>
                        ) : (
                            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight mb-4">
                                Manajemen Logistik <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                                    Tanpa Batas
                                </span>
                            </h1>
                        )}

                        <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                            Platform terintegrasi untuk mengelola pengiriman, pelacakan resi, dan database client dengan efisiensi tinggi.
                        </p>
                    </div>

                    {/* Quick Actions (Shortcut Bar) - Hide for branch_manager */}
                    {user && role !== 'branch_manager' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-4xl mx-auto">
                            <Link href="/transactions/new" className="group">
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                            <Plus size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-gray-700">Buat Resi</p>
                                            <p className="text-xs text-gray-400">Transaksi Baru</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </Link>

                            <Link href="/clients/new" className="group">
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-green-200 transition-all flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                                            <UserPlus size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-gray-700">Client Baru</p>
                                            <p className="text-xs text-gray-400">Database</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={16} className="text-gray-300 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </Link>

                            <Link href="/transactions" className="group">
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                                            <Search size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-gray-700">Cari Resi</p>
                                            <p className="text-xs text-gray-400">Lacak Status</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={16} className="text-gray-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </Link>

                            <Link href="/transactions/print-bulk" className="group">
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition-all flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                                            <FileText size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-gray-700">Cetak Massal</p>
                                            <p className="text-xs text-gray-400">Invoice</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={16} className="text-gray-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </Link>
                        </div>
                    )}

                    {/* Main Features Grid */}
                    <div className="grid md:grid-cols-2 gap-6 relative z-10">
                        {/* Attendance - Accessible to ALL authenticated users */}
                        {user && (
                            <Link href="/attendance" className="group">
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform origin-top-right"></div>
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:rotate-6 transition-transform">
                                            <Clock size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">Absensi Karyawan</h2>
                                        <p className="text-gray-500 mb-6 leading-relaxed">
                                            Check-in dan check-out shift kerja, lembur bongkar/muat, dan monitoring kehadiran.
                                        </p>
                                        <div className="flex items-center text-blue-600 font-semibold gap-2">
                                            Catat Kehadiran <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* My Profile - Accessible to ALL authenticated users */}
                        {user && (
                            <Link href="/my-profile" className="group">
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform origin-top-right"></div>
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:rotate-6 transition-transform">
                                            <UserCircle size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">Profil Saya</h2>
                                        <p className="text-gray-500 mb-6 leading-relaxed">
                                            Lihat informasi pribadi, riwayat absensi, dan slip gaji Anda.
                                        </p>
                                        <div className="flex items-center text-indigo-600 font-semibold gap-2">
                                            Buka Profil <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}



                        {/* Owner Dashboard (Executive) - Owner ONLY */}
                        {user && role === 'owner' && (
                            <Link href="/dashboard/owner" className="group md:col-span-2">
                                <div className="bg-slate-900 rounded-3xl p-8 shadow-xl shadow-slate-900/20 border border-slate-700 hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

                                    <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                                        <div className="flex-1">
                                            <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 border border-indigo-500/30 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
                                                <Crown size={32} />
                                            </div>
                                            <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">Pusat Kendali Owner</h2>
                                            <p className="text-slate-400 mb-6 leading-relaxed max-w-xl">
                                                Dashboard eksklusif untuk pemilik bisnis. Pantau revenue real-time, profitabilitas, efisiensi rute, dan performa klien utama dalam satu tampilan premium.
                                            </p>
                                            <div className="flex items-center text-indigo-400 font-semibold gap-2 group-hover:text-white transition-colors">
                                                Akses Dashboard Eksekutif <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>
                                        <div className="hidden md:block pr-8 opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500">
                                            {/* Abstract Chart UI representation */}
                                            <div className="w-48 h-32 bg-slate-800/50 rounded-lg border border-slate-700 p-4 relative backdrop-blur-sm">
                                                <div className="flex items-end gap-1 h-full pb-2">
                                                    <div className="w-1/5 bg-indigo-500/40 h-[40%] rounded-t-sm"></div>
                                                    <div className="w-1/5 bg-indigo-500/60 h-[65%] rounded-t-sm"></div>
                                                    <div className="w-1/5 bg-indigo-500/80 h-[50%] rounded-t-sm"></div>
                                                    <div className="w-1/5 bg-indigo-500 h-[85%] rounded-t-sm"></div>
                                                    <div className="w-1/5 bg-emerald-400 h-[95%] rounded-t-sm shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* Resi & Transaksi - Hidden for branch_manager */}
                        {role !== 'branch_manager' && (
                            <Link href="/transactions" className="group">
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform origin-top-right"></div>
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:rotate-6 transition-transform">
                                            <Package size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">Resi & Transaksi</h2>
                                        <p className="text-gray-500 mb-6 leading-relaxed">
                                            Kelola pengiriman, buat STT, invoice, dan pantau status pembayaran dalam satu dashboard terpusat.
                                        </p>
                                        <div className="flex items-center text-blue-600 font-semibold gap-2">
                                            Buka Modul <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* Database Client - Hidden for branch_manager */}
                        {role !== 'branch_manager' && (
                            <Link href="/clients" className="group">
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-green-300 hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform origin-top-right"></div>
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mb-6 group-hover:rotate-6 transition-transform">
                                            <Users size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-green-600 transition-colors">Database Client</h2>
                                        <p className="text-gray-500 mb-6 leading-relaxed">
                                            Simpan data pengirim dan penerima langganan untuk mempercepat proses input transaksi.
                                        </p>
                                        <div className="flex items-center text-green-600 font-semibold gap-2">
                                            Kelola Client <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* Pemberangkatan - Hidden for branch_manager */}
                        {role !== 'branch_manager' && (
                            <Link href="/voyages" className="group">
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-purple-300 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform origin-top-right"></div>
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-6 group-hover:rotate-6 transition-transform">
                                            <Ship size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-purple-600 transition-colors">Pemberangkatan</h2>
                                        <p className="text-gray-500 mb-6 leading-relaxed">
                                            Manajemen manifest muatan, armada, dan perhitungan biaya operasional perjalanan.
                                        </p>
                                        <div className="flex items-center text-purple-600 font-semibold gap-2">
                                            Atur Jalan <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* Dashboard BI - Hidden for branch_manager */}
                        {role !== 'branch_manager' && (
                            <Link href="/dashboard" className="group">
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-orange-300 hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform origin-top-right"></div>
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-6 group-hover:rotate-6 transition-transform">
                                            <BarChart3 size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-orange-600 transition-colors">Laporan & Analitik</h2>
                                        <p className="text-gray-500 mb-6 leading-relaxed">
                                            Analisa performa bisnis, omzet bulanan, dan statistik pengiriman secara real-time.
                                        </p>
                                        <div className="flex items-center text-orange-600 font-semibold gap-2">
                                            Lihat Data <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* Finance Module - Hidden for branch_manager */}
                        {role !== 'branch_manager' && (
                            <Link href="/finance/receivables" className="group">
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-teal-300 hover:shadow-2xl hover:shadow-teal-500/10 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform origin-top-right"></div>
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 mb-6 group-hover:rotate-6 transition-transform">
                                            <Wallet size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-teal-600 transition-colors">Keuangan & Invoice</h2>
                                        <p className="text-gray-500 mb-6 leading-relaxed">
                                            Kelola penagihan piutang, buat invoice tagihan consolidated, dan monitor status pelunasan.
                                        </p>
                                        <div className="flex items-center text-teal-600 font-semibold gap-2">
                                            Kelola Keuangan <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* Armada & Maintenance Module - Hidden for branch_manager */}
                        {role !== 'branch_manager' && (
                            <Link href="/fleets" className="group">
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-rose-300 hover:shadow-2xl hover:shadow-rose-500/10 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform origin-top-right"></div>
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 mb-6 group-hover:rotate-6 transition-transform">
                                            <Truck size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-rose-600 transition-colors">Armada & Maintenance</h2>
                                        <p className="text-gray-500 mb-6 leading-relaxed">
                                            Manajemen aset kendaraan, jadwal servis, dan pelacakan biaya perawatan armada.
                                        </p>
                                        <div className="flex items-center text-rose-600 font-semibold gap-2">
                                            Atur Armada <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* Payroll & Gaji Module - Allow branch_manager */}
                        {user && (role === 'owner' || role === 'admin' || role === 'branch_manager') && (
                            <Link href="/payroll" className="group">
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-emerald-300 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform origin-top-right"></div>
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:rotate-6 transition-transform">
                                            <Wallet size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-emerald-600 transition-colors">Payroll & Gaji</h2>
                                        <p className="text-gray-500 mb-6 leading-relaxed">
                                            Generate payroll bulanan, kelola slip gaji karyawan, dan laporan penggajian otomatis.
                                        </p>
                                        <div className="flex items-center text-emerald-600 font-semibold gap-2">
                                            Kelola Payroll <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* HRD & Karyawan Module - Allow branch_manager */}
                        {user && (role === 'owner' || role === 'admin' || role === 'branch_manager') && (
                            <Link href="/employees" className="group">
                                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 hover:border-amber-300 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 relative overflow-hidden group-hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform origin-top-right"></div>
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-6 group-hover:rotate-6 transition-transform">
                                            <Users size={32} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-amber-600 transition-colors">HRD & Karyawan</h2>
                                        <p className="text-gray-500 mb-6 leading-relaxed">
                                            Manajemen data karyawan, kontrak, dokumen, dan pengaturan akses pengguna sistem.
                                        </p>
                                        <div className="flex items-center text-amber-600 font-semibold gap-2">
                                            Kelola Karyawan <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}
                    </div>

                    {/* Footer Simplified */}
                    <div className="mt-16 text-center border-t border-gray-200 pt-8">
                        <p className="text-gray-400 text-sm">
                            &copy; {new Date().getFullYear()} Cahaya Cargo Express Management System. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>

            <InstallPrompt />
        </div>
    );
}
