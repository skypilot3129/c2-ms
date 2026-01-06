'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { subscribeToClients, deleteClient, searchClients } from '@/lib/firestore';
import type { Client } from '@/types/client';
import { Search, Plus, Edit2, Trash2, MapPin, Phone, User, ArrowUpDown, Download, Calendar, Filter, Printer } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';

type SortOption = 'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest';

export default function ClientsPage() {
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [filteredClients, setFilteredClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Subscribe to real-time updates
    useEffect(() => {
        if (!mounted || !user) return;

        const unsubscribe = subscribeToClients((updatedClients) => {
            setClients(updatedClients);
            // Initial filter & sort will be handled by the effect below
            setLoading(false);
        }, user.uid);

        return () => unsubscribe();
    }, [mounted, user]);

    // Handle Search & Filter & Sort
    useEffect(() => {
        let result = searchClients(clients, searchTerm);

        // Sorting Logic
        result.sort((a, b) => {
            switch (sortOption) {
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'date-newest':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'date-oldest':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                default:
                    return 0;
            }
        });

        setFilteredClients(result);
    }, [searchTerm, clients, sortOption]);

    const handleDelete = async (id: string) => {
        try {
            await deleteClient(id);
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting client:', error);
            alert('Gagal menghapus client. Silakan coba lagi.');
        }
    };

    const handleExportCSV = () => {
        const headers = ['Nama', 'Telepon', 'Kota', 'Alamat', 'Catatan'];
        const csvContent = [
            headers.join(','),
            ...filteredClients.map(client => [
                `"${client.name}"`,
                `"${client.phone}"`,
                `"${client.city}"`,
                `"${client.address.replace(/"/g, '""')}"`, // Escape quotes
                `"${client.notes.replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `clients_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    const getRandomColor = (name: string) => {
        const colors = [
            'from-blue-400 to-blue-600',
            'from-purple-400 to-purple-600',
            'from-green-400 to-green-600',
            'from-orange-400 to-orange-600',
            'from-pink-400 to-pink-600',
            'from-indigo-400 to-indigo-600',
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-20">
                {/* Header */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <Link href="/" className="text-sm text-gray-500 hover:text-blue-600 mb-1 inline-flex items-center gap-1 transition-colors">
                                    ← Kembali ke Home
                                </Link>
                                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                    <User className="text-blue-600" />
                                    Database Client
                                </h1>
                                <p className="text-gray-500 text-sm mt-1">Manajemen data pelanggan & kontak</p>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                                <button
                                    onClick={handleExportCSV}
                                    className="flex-1 md:flex-none border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                >
                                    <Download size={18} />
                                    Export CSV
                                </button>
                                <button
                                    onClick={() => window.open(`/clients/print-list?search=${searchTerm}`, '_blank')}
                                    className="flex-1 md:flex-none border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                >
                                    <Download size={18} className="rotate-180" /> {/* Using rotate for upload/print vibe or just use printer icon if available */}
                                    Cetak PDF
                                </button>
                                <Link
                                    href="/clients/new"
                                    className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-105"
                                >
                                    <Plus size={20} />
                                    Tambah Client
                                </Link>
                            </div>
                        </div>

                        {/* Search & Toolbar */}
                        <div className="mt-6 flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Cari client berdasarkan nama, kota, atau telepon..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    <select
                                        value={sortOption}
                                        onChange={(e) => setSortOption(e.target.value as SortOption)}
                                        className="bg-transparent text-sm font-medium text-gray-700 py-1.5 px-3 outline-none cursor-pointer"
                                    >
                                        <option value="name-asc">Nama (A-Z)</option>
                                        <option value="name-desc">Nama (Z-A)</option>
                                        <option value="date-newest">Terbaru</option>
                                        <option value="date-oldest">Terlama</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-8">
                    {/* Stats */}
                    {mounted && (
                        <div className="text-gray-500 text-sm mb-6 flex items-center gap-2">
                            Menampilkan <span className="font-semibold text-gray-800">{filteredClients.length}</span> client
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                                        <div className="flex-1">
                                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && filteredClients.length === 0 && (
                        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <User className="text-gray-400" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Tidak ada client ditemukan</h3>
                            <p className="text-gray-500 max-w-md mx-auto mb-6">
                                {searchTerm
                                    ? 'Coba gunakan kata kunci pencarian yang lain.'
                                    : 'Belum ada data client. Tambahkan client baru untuk memulai.'}
                            </p>
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="text-blue-600 font-medium hover:underline"
                                >
                                    Reset Pencarian
                                </button>
                            )}
                        </div>
                    )}

                    {/* Client Grid */}
                    {!loading && filteredClients.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredClients.map((client) => (
                                <div
                                    key={client.id}
                                    className="group bg-white rounded-2xl border border-gray-200 p-5 hover:border-blue-400 hover:shadow-xl transition-all duration-300 flex flex-col"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getRandomColor(client.name)} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                                                {getInitials(client.name)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-lg line-clamp-1" title={client.name}>
                                                    {client.name}
                                                </h3>
                                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {new Date(client.createdAt).toLocaleDateString('id-ID')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6 flex-1">
                                        {client.phone && (
                                            <div className="flex items-center gap-3 text-gray-600 text-sm bg-gray-50 p-2 rounded-lg group-hover:bg-blue-50 transition-colors">
                                                <Phone size={16} className="text-blue-500" />
                                                <span className="font-medium">{client.phone}</span>
                                            </div>
                                        )}
                                        {client.city && (
                                            <div className="flex items-center gap-3 text-gray-600 text-sm px-2">
                                                <MapPin size={16} className="text-orange-500 flex-shrink-0" />
                                                <span className="truncate">{client.city}</span>
                                            </div>
                                        )}
                                        {client.address && (
                                            <div className="text-gray-500 text-sm pl-9 line-clamp-2">
                                                {client.address}
                                            </div>
                                        )}
                                        {client.notes && (
                                            <div className="text-xs text-gray-400 italic pl-2 border-l-2 border-gray-200 mt-2">
                                                &quot;{client.notes}&quot;
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                                        <Link href={`/clients/${client.id}/edit`} className="flex-1">
                                            <button className="w-full bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                                                <Edit2 size={16} />
                                                Edit
                                            </button>
                                        </Link>
                                        <button
                                            onClick={() => setDeleteConfirm(client.id)}
                                            className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors"
                                            title="Hapus"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl scale-100 transform transition-all">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">Hapus Client?</h3>
                            <p className="text-gray-500 text-center mb-8 text-sm">
                                Tindakan ini tidak dapat dibatalkan. Semua data terkait client ini akan hilang.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirm)}
                                    className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                                >
                                    Ya, Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
