'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { subscribeToVoyages, deleteVoyage } from '@/lib/firestore-voyages';
import type { Voyage, VoyageStatus } from '@/types/voyage';
import {
    Plus,
    Ship,
    Calendar,
    Search,
    Anchor,
    Truck,
    Trash2,
    Eye,
    Printer
} from 'lucide-react';

export default function VoyagesPage() {
    const { user } = useAuth();
    const [voyages, setVoyages] = useState<Voyage[]>([]);
    const [filteredVoyages, setFilteredVoyages] = useState<Voyage[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<VoyageStatus | 'all'>('all');

    // Subscribe to real-time updates
    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToVoyages(user.uid, (data) => {
            setVoyages(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Filter logic
    useEffect(() => {
        let result = voyages;

        if (statusFilter !== 'all') {
            result = result.filter(v => v.status === statusFilter);
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(v =>
                v.route.toLowerCase().includes(lowerTerm) ||
                v.voyageNumber.toLowerCase().includes(lowerTerm) ||
                v.shipName?.toLowerCase().includes(lowerTerm) ||
                v.vehicleNumber?.toLowerCase().includes(lowerTerm)
            );
        }

        setFilteredVoyages(result);
    }, [voyages, statusFilter, searchTerm]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault(); // Prevent navigation
        if (confirm('Apakah Anda yakin ingin menghapus pemberangkatan ini?')) {
            try {
                await deleteVoyage(id);
            } catch (error) {
                console.error('Error deleting voyage:', error);
                alert('Gagal menghapus pemberangkatan');
            }
        }
    };

    const getStatusColor = (status: VoyageStatus) => {
        switch (status) {
            case 'planned': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'in-progress': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'completed': return 'bg-green-100 text-green-700 border-green-200';
            case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusLabel = (status: VoyageStatus) => {
        switch (status) {
            case 'planned': return 'Direncanakan';
            case 'in-progress': return 'Dalam Perjalanan';
            case 'completed': return 'Selesai';
            case 'cancelled': return 'Dibatalkan';
            default: return status;
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </ProtectedRoute>
        );
    }

    const stats = {
        total: voyages.length,
        planned: voyages.filter(v => v.status === 'planned').length,
        active: voyages.filter(v => v.status === 'in-progress').length,
        completed: voyages.filter(v => v.status === 'completed').length,
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-20">
                {/* Header Section */}
                <div className="bg-white border-b sticky top-0 z-10">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <Link href="/" className="text-sm text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                                    ← Kembali ke Home
                                </Link>
                                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                    Pemberangkatan
                                </h1>
                                <p className="text-gray-500 text-sm mt-1">Kelola jadwal & biaya operasional kapal</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => window.open(`/voyages/print-list?status=${statusFilter}&search=${searchTerm}`, '_blank')}
                                    className="border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                >
                                    <Printer size={20} />
                                    Cetak Laporan
                                </button>
                                <Link
                                    href="/voyages/new"
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-105"
                                >
                                    <Plus size={20} />
                                    Buat Pemberangkatan
                                </Link>
                            </div>
                        </div>

                        {/* Search & Filter Bar */}
                        <div className="mt-6 flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Cari rute, kapal, atau no. voyage..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                />
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto">
                                {[
                                    { id: 'all', label: 'Semua' },
                                    { id: 'planned', label: 'Direncanakan' },
                                    { id: 'in-progress', label: 'Jalan' },
                                    { id: 'completed', label: 'Selesai' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setStatusFilter(tab.id as any)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${statusFilter === tab.id
                                            ? 'bg-white text-gray-800 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Total</div>
                            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <div className="text-blue-600 text-xs font-medium uppercase tracking-wider mb-1">Direncanakan</div>
                            <div className="text-2xl font-bold text-blue-700">{stats.planned}</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                            <div className="text-orange-600 text-xs font-medium uppercase tracking-wider mb-1">Jalan</div>
                            <div className="text-2xl font-bold text-orange-700">{stats.active}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                            <div className="text-green-600 text-xs font-medium uppercase tracking-wider mb-1">Selesai</div>
                            <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
                        </div>
                    </div>

                    {/* Voyages List */}
                    {filteredVoyages.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Ship className="text-gray-400" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Belum ada pemberangkatan</h3>
                            <p className="text-gray-500 max-w-md mx-auto mb-6">
                                {searchTerm || statusFilter !== 'all'
                                    ? 'Tidak ada data yang cocok dengan filter pencarian Anda.'
                                    : 'Buat jadwal pemberangkatan baru untuk mulai mencatat biaya operasional.'}
                            </p>
                            {(searchTerm || statusFilter !== 'all') && (
                                <button
                                    onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                                    className="text-blue-600 font-medium hover:underline"
                                >
                                    Reset Filter
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredVoyages.map((voyage) => (
                                <div key={voyage.id} className="group bg-white rounded-2xl border border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
                                    {/* Card Header with Status Status Bar */}
                                    <div className={`h-1.5 w-full ${voyage.status === 'completed' ? 'bg-green-500' :
                                        voyage.status === 'in-progress' ? 'bg-orange-500' : 'bg-blue-500'
                                        }`} />

                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500 mb-2">
                                                    {voyage.voyageNumber}
                                                </span>
                                                <h3 className="text-lg font-bold text-gray-800 line-clamp-1" title={voyage.route}>
                                                    {voyage.route}
                                                </h3>
                                            </div>
                                            <div className="relative">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(voyage.status)}`}>
                                                    {getStatusLabel(voyage.status)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Info Grid */}
                                        <div className="space-y-3 mb-6">
                                            <div className="flex items-center text-gray-600 text-sm">
                                                <Calendar size={16} className="text-gray-400 mr-2 flex-shrink-0" />
                                                <span>{new Date(voyage.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            </div>

                                            {(voyage.shipName || voyage.vehicleNumber) && (
                                                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-gray-100">
                                                    {voyage.shipName && (
                                                        <div className="flex items-center text-gray-600 text-xs bg-gray-50 p-1.5 rounded-lg">
                                                            <Anchor size={14} className="text-blue-400 mr-2 flex-shrink-0" />
                                                            <span className="truncate">{voyage.shipName}</span>
                                                        </div>
                                                    )}
                                                    {voyage.vehicleNumber && (
                                                        <div className="flex items-center text-gray-600 text-xs bg-gray-50 p-1.5 rounded-lg">
                                                            <Truck size={14} className="text-orange-400 mr-2 flex-shrink-0" />
                                                            <span className="truncate">{voyage.vehicleNumber}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                                            <div className="text-xs text-gray-400">
                                                {voyage.transactionIds?.length || 0} Transaksi
                                            </div>
                                            <div className="flex gap-2">
                                                <Link
                                                    href={`/voyages/${voyage.id}`}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                    title="Lihat Detail"
                                                >
                                                    <Eye size={16} />
                                                </Link>
                                                <button
                                                    onClick={(e) => handleDelete(voyage.id, e)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
